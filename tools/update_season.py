# -*- coding: utf-8 -*-
"""시즌(설날/추석) 상품 데이터 + 바코드 이미지 일괄 갱신 스크립트.

명절마다 GS25 카탈로그가 통째로 바뀐다. 같은 상품코드가 다른 상품을 가리키기
때문에 products.js 와 BarcodeImgs/ 를 **함께** 갈아끼워야 한다. 한쪽만 바꾸면
주문서에 엉뚱한 바코드가 찍혀 다른 상품이 배송된다.

사용법:
    python tools/update_season.py BarcodeSource/20260815.pdf \
        --catalog https://gs25mobile.com/2026_2nd/products.json \
        --season "2026 추석"

하는 일:
    1. 바코드북 PDF에서 상품코드 601개와 위치를 추출
    2. 카탈로그 JSON을 내려받아 상품명/가격/구매혜택을 가져옴
    3. 두 소스의 상품명을 교차 검증 (불일치하면 경고)
    4. 구매혜택 아이콘 번호를 행사(N+M)로 해석 (모르는 번호가 있으면 중단)
    5. products.js 생성
    6. BarcodeImgs/ 를 비우고 코드별 바코드 이미지를 다시 렌더링

의존성: pip install pdfplumber pymupdf
"""
from __future__ import print_function

import argparse
import glob
import io
import json
import os
import re
import sys

from io import BytesIO

try:
    import fitz  # PyMuPDF
    import pdfplumber
    from PIL import Image
except ImportError:
    sys.exit("필요한 패키지:  pip install pdfplumber pymupdf pillow")

try:
    from urllib.request import urlopen
except ImportError:  # py2
    from urllib2 import urlopen

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BARCODE_DIR = os.path.join(REPO, "BarcodeImgs")
PRODUCTS_JS = os.path.join(REPO, "products.js")

OUT_W = 600        # 출력 이미지 가로 픽셀
BAR_TRIM = 0.45    # 막대 위쪽에서 잘라낼 비율 (아래 55% + 숫자만 사용)
BAR_PAD = 2.0      # 막대 좌우로 남길 여백 (pt) - 조용 지대(quiet zone)

# 코드의 숫자/하이픈은 ToUnicode 매핑이 없어 pdfplumber 에서 (cid:NN) 으로 나온다.
# cid = 숫자 + 17, 하이픈은 14.
CID = {14: "-", 17: "0", 18: "1", 19: "2", 20: "3", 21: "4", 22: "5",
       23: "6", 24: "7", 25: "8", 26: "9"}
CID_RE = re.compile(r"\(cid:(\d+)\)")
CODE_RE = re.compile(r"^\d{2,3}-\d{2}$")
EPS = 1.5

# ---------------------------------------------------------------------------
# 구매혜택 아이콘 -> 행사(N+M)
#
# 카탈로그의 attached / attached_e 는 아이콘 번호 목록이고, 실제 그림은
# <카탈로그 루트>/icons/benefit_<번호>.png 에 있다. 행사 비율은 그림 안에
# 글자로만 적혀 있어 자동으로 읽을 수 없다. 아래 표는 2026 추석 아이콘을
# 직접 열어 보고 만든 것이다.
#
# ★ 시즌이 바뀌면 번호 체계가 달라질 수 있다. 갱신할 때 스크립트가 모르는
#   번호를 발견하면 멈추고 아이콘 주소를 알려주니, 그림을 열어 확인한 뒤
#   아래 두 표에 추가할 것. 확인 없이 넘기려면 --allow-unknown-benefits.
# ---------------------------------------------------------------------------
BENEFIT_PROMO = {
    2: "3+1", 6: "10+1", 7: "5+1", 8: "4+1", 9: "9+1", 10: "1+1",
    11: "7+1", 12: "2+1", 19: "6+1", 33: "8+1",
    48: "7+3", 51: "2+2", 52: "3+2",
    # 같은 비율이지만 "9월 5일부터" 문구가 함께 박힌 아이콘 (본행사용)
    15: "3+1", 30: "5+1", 31: "7+1", 32: "9+1", 34: "10+1",
    35: "8+1", 36: "2+1", 37: "4+1", 40: "1+1",
}

# 행사가 아닌 아이콘 (무료배송 조건, 냉장/냉동, 할인율, 증정품, 한정수량 등).
# 주문서의 '행사' 칸은 덤으로 주는 개수만 다루므로 여기 있는 것은 무시한다.
BENEFIT_OTHER = {
    1, 3, 4, 5, 13, 14, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
    38, 39, 41, 42, 43, 44, 45, 46, 47, 49, 50, 53, 54, 55,
}

# 본행사 시작일. 이 날부터 attached(본행사) 혜택이, 그 전에는
# attached_e(사전행사) 혜택이 적용된다. --main-start 로 바꿀 수 있다.
DEFAULT_MAIN_START = "2026-09-05"


def decid(s):
    return CID_RE.sub(lambda m: CID.get(int(m.group(1)), m.group(0)), s)


def code_key(code):
    a, b = code.split("-")
    return (int(a), int(b))


def cluster(values, eps=EPS):
    out = []
    for v in sorted(values):
        if not out or v - out[-1] > eps:
            out.append(v)
        else:
            out[-1] = (out[-1] + v) / 2.0
    return out


def grid_for_page(page):
    """셀 테두리 좌표. 바코드 막대도 얇은 세로 사각형이라 길이로 걸러낸다."""
    xs, ys = [], []
    for d in page.get_drawings():
        r = d["rect"]
        if r.width < 1 and r.height > 60:
            xs.append((r.x0 + r.x1) / 2.0)
        elif r.height < 1 and r.width > 100:
            ys.append((r.y0 + r.y1) / 2.0)
    return cluster(xs), cluster(ys)


def span(lines, v):
    for a, b in zip(lines, lines[1:]):
        if a - EPS <= v <= b + EPS:
            return a, b
    return None


def read_pdf(pdf_path):
    """[(page_index, code, x0, top)] 와 {code: name} 반환."""
    positions = []
    with pdfplumber.open(pdf_path) as pdf:
        for pno, page in enumerate(pdf.pages):
            for w in page.extract_words():
                t = decid(w["text"])
                if CODE_RE.match(t):
                    positions.append((pno, t, w["x0"], w["x1"], w["top"]))

    # 상품명은 PyMuPDF 로만 제대로 디코딩된다 → 같은 줄에서 코드 오른쪽 글자들
    names = {}
    doc = fitz.open(pdf_path)
    for pno, page in enumerate(doc):
        words = page.get_text("words")
        on_page = [p for p in positions if p[0] == pno]
        for _, code, x0, x1, top in on_page:
            nxt = [p[2] for p in on_page if abs(p[4] - top) < 4.0 and p[2] > x0]
            limit = min(nxt) if nxt else 1e9
            same = [w for w in words
                    if abs(w[1] - top) < 4.0 and w[0] >= x1 - 1 and w[0] < limit - 1]
            same.sort(key=lambda w: w[0])
            name = re.sub(r"\s+", " ", " ".join(w[4] for w in same)).strip()
            if name and code not in names:
                names[code] = name
    doc.close()
    return positions, names


def load_catalog(source):
    if source.startswith("http"):
        raw = urlopen(source).read().decode("utf-8")
    else:
        raw = io.open(source, encoding="utf-8").read()
    return json.loads(raw)


def benefit_codes(field):
    """attached / attached_e 문자열("3,15,1")을 번호 목록으로."""
    out = []
    for t in str(field or "").split(","):
        t = t.strip()
        if t.isdigit():
            out.append(int(t))
    return out


def scan_benefits(catalog):
    """카탈로그에 쓰인 혜택 번호를 모아 미확인 번호를 골라낸다.

    @returns (사용된 번호 집합, 표에 없는 번호 집합)
    """
    used = set()
    for r in catalog:
        used |= set(benefit_codes(r.get("attached")))
        used |= set(benefit_codes(r.get("attached_e")))
    return used, used - set(BENEFIT_PROMO) - BENEFIT_OTHER


def promo_of(field):
    """혜택 목록에서 행사(N+M) 하나를 뽑는다. 없으면 None.

    @returns (행사 문자열|None, 중복 발견 여부)
    """
    hits = [BENEFIT_PROMO[n] for n in benefit_codes(field) if n in BENEFIT_PROMO]
    if not hits:
        return None, False
    return hits[0], len(set(hits)) > 1


def write_products_js(catalog, season, source_desc, main_start):
    entries, market, conflicts = [], [], []
    n_pre = n_main = 0

    for r in sorted(catalog, key=lambda r: code_key(r["code"])):
        code, name, price = r["code"], r["name"], r["price"]

        # 사전행사(attached_e)와 본행사(attached)의 행사가 다를 수 있다
        pre, dup_pre = promo_of(r.get("attached_e"))
        main, dup_main = promo_of(r.get("attached"))
        if dup_pre or dup_main:
            conflicts.append(code)
        if pre:
            n_pre += 1
        if main:
            n_main += 1

        fields = ['"name": %s' % json.dumps(name, ensure_ascii=False)]
        if isinstance(price, int):
            fields.append('"price": %d' % price)
        else:
            # "시세반영" 등 숫자가 아닌 가격 → 단가를 직접 입력받는다
            market.append(code)
            fields.append('"price": 0')
            fields.append('"marketPrice": true')
        if pre:
            fields.append('"eventPre": "%s"' % pre)
        if main:
            fields.append('"eventMain": "%s"' % main)

        entries.append('  "%s": { %s }' % (code, ", ".join(fields)))

    header = (
        "// GS25 %s 상품 데이터 (tools/update_season.py 자동 생성 - 직접 편집하지 마세요)\n"
        "// 출처: %s\n"
        "// 상품 %d개 / 시세반영 상품 %d개 (price 0 + marketPrice)\n"
        "// 행사: 사전행사 %d개 / 본행사 %d개 (본행사 시작 %s)\n\n"
        "const PROMO_CONFIG = { mainStart: \"%s\" };\n\n"
        % (season, source_desc, len(catalog), len(market),
           n_pre, n_main, main_start, main_start)
    )
    # 저장소가 CRLF 로 보관돼 있다. LF 로 쓰면 줄바꿈만 바뀐 거대한 diff 가 생긴다.
    with io.open(PRODUCTS_JS, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(header + "const PRODUCTS_DATA = {\n" + ",\n".join(entries) + "\n};\n")
    return market, n_pre, n_main, conflicts


def page_graphics(page):
    """페이지의 도형/이미지 위치를 한 번만 모아 둔다 (셀마다 재조회하면 느리다)."""
    rects = [d["rect"] for d in page.get_drawings()]
    images = []
    for info in page.get_images(full=True):
        xref = info[0]
        for r in page.get_image_rects(xref):
            images.append((r, xref))
    return rects, images


def graphic_bbox(cell, rects, images):
    """셀 안 바코드 그래픽의 위치와 종류.

    카탈로그에는 두 종류가 섞여 있다.
      - 1D 바코드: 얇은 세로 막대 벡터 도형
      - QR 코드  : 삽입된 래스터 이미지 (금·은바 등 81-xx)
    @returns (Rect, 'bars'|'image') 또는 (None, None)
    """
    inner = fitz.Rect(cell.x0 + 2, cell.y0 + 2, cell.x1 - 2, cell.y1 - 2)

    bars = [r for r in rects
            if inner.x0 <= r.x0 and r.x1 <= inner.x1
            and inner.y0 <= r.y0 and r.y1 <= inner.y1
            and r.width < 3 and 5 < r.height < cell.height * 0.8]
    if len(bars) >= 10:     # 막대가 이만큼 있으면 1D 바코드로 본다
        return fitz.Rect(min(b.x0 for b in bars), min(b.y0 for b in bars),
                         max(b.x1 for b in bars), max(b.y1 for b in bars)), "bars"

    for r, xref in images:
        center = fitz.Point((r.x0 + r.x1) / 2.0, (r.y0 + r.y1) / 2.0)
        if inner.contains(center):
            return r, ("image", xref)

    return None, None


NEAREST = getattr(getattr(Image, "Resampling", Image), "NEAREST")


def upscale_qr(doc, xref, width):
    """QR 원본 래스터를 계단식(nearest)으로 확대하고 조용 지대(quiet zone)를 붙인다.

    삽입된 QR은 84x84 정도로 작아서 부드러운 보간으로 키우면 모듈 경계가
    뭉개진다. 정수배 계단식 확대라야 각 모듈이 또렷한 사각형으로 남는다.
    """
    info = doc.extract_image(xref)
    qr = Image.open(BytesIO(info["image"])).convert("RGB")

    quiet = max(2, qr.width // 20)
    canvas = Image.new("RGB", (qr.width + quiet * 2, qr.height + quiet * 2), "white")
    canvas.paste(qr, (quiet, quiet))

    scale = max(1, int(width // canvas.width))
    out = canvas.resize((canvas.width * scale, canvas.height * scale), NEAREST)

    if out.width < width:   # 남는 폭은 흰 여백으로 채워 가로를 맞춘다
        padded = Image.new("RGB", (width, out.height), "white")
        padded.paste(out, ((width - out.width) // 2, 0))
        out = padded
    return out


def render_clip(page, clip, width):
    """clip 영역을 지정한 픽셀 폭으로 렌더링 (벡터라 확대해도 선명하다)."""
    zoom = width / clip.width
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip,
                          colorspace=fitz.csRGB)
    return Image.open(BytesIO(pix.tobytes("png")))


def compose_cell(page, cell, rects, images):
    """머리글(코드+상품명)은 그대로 두고 바코드만 가로 폭에 꽉 차게 확대.

    원본 셀에서 바코드는 가로의 3분의 1만 차지해 인쇄 시 스캔하기에 좁다.
    좌우 여백을 잘라내고 폭을 채우면 같은 인쇄 높이에서 약 2배 넓어진다.

    1D 바코드는 막대 위쪽 45%를 잘라낸다. 높이가 줄어도 읽히는 데다,
    이미지가 세로로 길어지면 (인쇄 CSS가 높이 고정이라) 오히려 가로가 좁아진다.
    QR은 정사각형 비율을 지켜야 읽히므로 자르지 않고 그대로 확대한다.
    """
    bbox, kind = graphic_bbox(cell, rects, images)
    if bbox is None:
        # 바코드를 못 찾으면 셀 전체를 그대로 사용 (안전한 기본값)
        return render_clip(page, fitz.Rect(cell.x0 + 1, cell.y0 + 1,
                                           cell.x1 - 1, cell.y1 - 1), OUT_W)

    head = fitz.Rect(cell.x0 + 1.5, cell.y0 + 1.5, cell.x1 - 1.5, bbox.y0 - 1)
    top = render_clip(page, head, OUT_W)

    if kind == "bars":
        # 아래쪽은 셀 끝까지 — 막대 밑 숫자(2347 2198)까지 포함
        strip = fitz.Rect(bbox.x0 - BAR_PAD, bbox.y0 + bbox.height * BAR_TRIM,
                          bbox.x1 + BAR_PAD, cell.y1 - 1)
        bottom = render_clip(page, strip, OUT_W)
    else:
        # QR: 삽입된 원본(84x84 등)을 계단식으로 확대한다.
        # 부드러운 보간으로 키우면 모듈 경계가 뭉개져 스캔이 어려워진다.
        bottom = upscale_qr(page.parent, kind[1], OUT_W)

    out = Image.new("RGB", (OUT_W, top.height + bottom.height), "white")
    out.paste(top, (0, 0))
    out.paste(bottom, (0, top.height))
    return out


def render_barcodes(pdf_path, positions):
    for old in glob.glob(os.path.join(BARCODE_DIR, "*.jpg")):
        os.remove(old)
    if not os.path.isdir(BARCODE_DIR):
        os.makedirs(BARCODE_DIR)

    doc = fitz.open(pdf_path)
    written, skipped, fallback = set(), [], []
    for pno, page in enumerate(doc):
        xs, ys = grid_for_page(page)
        rects, images = page_graphics(page)
        for p in [q for q in positions if q[0] == pno]:
            _, code, x0, _, top = p
            cx, cy = span(xs, x0), span(ys, top)
            if not cx or not cy:
                skipped.append(code)
                continue
            cell = fitz.Rect(cx[0], cy[0], cx[1], cy[1])
            if graphic_bbox(cell, rects, images)[0] is None:
                fallback.append(code)
            img = compose_cell(page, cell, rects, images)
            img.save(os.path.join(BARCODE_DIR, code + ".jpg"),
                     "JPEG", quality=92)
            written.add(code)
    doc.close()
    return written, skipped, fallback


def main():
    ap = argparse.ArgumentParser(description="시즌 상품/바코드 일괄 갱신")
    ap.add_argument("pdf", help="바코드북 PDF (예: BarcodeSource/20260815.pdf)")
    ap.add_argument("--catalog", required=True,
                    help="카탈로그 products.json URL 또는 로컬 경로")
    ap.add_argument("--season", default="", help='예: "2026 추석"')
    ap.add_argument("--main-start", default=DEFAULT_MAIN_START,
                    help="본행사 시작일 YYYY-MM-DD (이 날부터 본행사 행사 적용)")
    ap.add_argument("--allow-unknown-benefits", action="store_true",
                    help="처음 보는 구매혜택 아이콘이 있어도 계속 진행")
    ap.add_argument("--skip-barcodes", action="store_true",
                    help="바코드 이미지는 건드리지 않고 products.js 만 다시 만든다")
    args = ap.parse_args()

    print("1) PDF 읽는 중: %s" % args.pdf)
    positions, pdf_names = read_pdf(args.pdf)
    pdf_codes = {p[1] for p in positions}
    print("   상품코드 %d개" % len(pdf_codes))

    print("2) 카탈로그 읽는 중: %s" % args.catalog)
    catalog = load_catalog(args.catalog)
    web = {r["code"]: r for r in catalog}
    print("   상품 %d개" % len(web))

    print("3) 교차 검증")
    only_pdf = sorted(pdf_codes - set(web))
    only_web = sorted(set(web) - pdf_codes)
    mismatch = [(c, pdf_names[c], web[c]["name"]) for c in sorted(pdf_codes & set(web))
                if c in pdf_names
                and pdf_names[c].replace(" ", "") != web[c]["name"].replace(" ", "")]
    print("   PDF에만 있는 코드: %d %s" % (len(only_pdf), only_pdf[:10]))
    print("   카탈로그에만 있는 코드: %d %s" % (len(only_web), only_web[:10]))
    print("   상품명 불일치: %d" % len(mismatch))
    for m in mismatch[:10]:
        print("      %s  pdf=%r  web=%r" % m)
    if only_pdf or only_web or mismatch:
        print("   [!] 두 소스가 완전히 일치하지 않습니다. 위 목록을 확인하세요.")

    print("4) 구매혜택 아이콘 확인")
    used, unknown = scan_benefits(catalog)
    print("   사용된 혜택 번호 %d개 / 행사로 해석 %d개"
          % (len(used), len(used & set(BENEFIT_PROMO))))
    if unknown:
        root = args.catalog.rsplit("/", 1)[0]
        print("   [!] 처음 보는 혜택 아이콘 %d개: %s"
              % (len(unknown), sorted(unknown)))
        for n in sorted(unknown):
            print("       %s/icons/benefit_%d.png" % (root, n))
        print("   그림을 열어 확인한 뒤 BENEFIT_PROMO / BENEFIT_OTHER 에 추가하세요.")
        if not args.allow_unknown_benefits:
            print("   행사를 잘못 넣으면 청구액이 틀어지므로 여기서 멈춥니다.")
            return 1

    print("5) products.js 생성")
    market, n_pre, n_main, conflicts = write_products_js(
        catalog, args.season or "시즌", args.catalog, args.main_start)
    print("   상품 %d개, 시세반영 %d개 %s" % (len(catalog), len(market), market))
    print("   행사: 사전행사 %d개 / 본행사 %d개 (본행사 시작 %s)"
          % (n_pre, n_main, args.main_start))
    if conflicts:
        print("   [!] 한 상품에 행사 아이콘이 여러 개: %s" % conflicts[:10])

    if args.skip_barcodes:
        print("6) 바코드 이미지 렌더링 건너뜀 (--skip-barcodes)")
        return 0

    print("6) 바코드 이미지 렌더링")
    written, skipped, fallback = render_barcodes(args.pdf, positions)
    print("   %d개 생성, 건너뜀 %d개 %s" % (len(written), len(skipped), skipped[:10]))
    if fallback:
        print("   [!] 바코드를 못 찾아 셀 통째로 사용한 코드 %d개: %s"
              % (len(fallback), fallback[:10]))

    missing = sorted(set(web) - written)
    orphan = sorted(written - set(web))
    print("7) 최종 확인")
    print("   바코드 없는 상품: %d %s" % (len(missing), missing[:10]))
    print("   상품 없는 바코드: %d %s" % (len(orphan), orphan[:10]))
    if missing or orphan:
        print("   [!] 1:1 대응이 아닙니다. 위 목록을 확인하세요.")
        return 1
    print("   [OK] 상품 %d개 ↔ 바코드 %d개 완전 일치" % (len(web), len(written)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
