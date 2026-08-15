# -*- coding: utf-8 -*-
"""시즌(설날/추석) 상품 데이터 + 바코드 이미지 일괄 갱신 스크립트.

명절마다 GS25 카탈로그가 통째로 바뀐다. 같은 상품코드가 다른 상품을 가리키기
때문에 products.js 와 BarcodeImgs/ 를 **함께** 갈아끼워야 한다. 한쪽만 바꾸면
주문서에 엉뚱한 바코드가 찍혀 다른 상품이 배송된다.

설정은 저장소 루트의 season.json 한 곳에 모여 있다. 명절마다 그 파일만 고치면
되고, 보통은 GitHub Actions 의 "시즌 갱신"이 이 스크립트를 대신 실행한다.

사용법:
    python tools/update_season.py                    # season.json 사용
    python tools/update_season.py --skip-barcodes    # products.js 만 다시 생성

하는 일:
    0. season.json 에서 매장 정보/시즌/행사 기간/구매혜택 표를 읽음
    1. 바코드북 PDF에서 상품코드와 위치를 추출
    2. 카탈로그 JSON을 내려받아 상품명/가격/구매혜택을 가져옴
    3. 두 소스의 상품명을 교차 검증 (불일치하면 경고)
    4. 구매혜택 아이콘 번호를 행사(N+M)로 해석 (모르는 번호가 있으면 중단)
    5. products.js + store.js 생성
    6. BarcodeImgs/ 를 비우고 코드별 바코드 이미지를 다시 렌더링

의존성: pip install pdfplumber pymupdf pillow
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
STORE_JS = os.path.join(REPO, "store.js")
SEASON_JSON = os.path.join(REPO, "season.json")
ICON_SHEET = os.path.join(REPO, "unknown_benefit_icons.png")

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
# 구매혜택 아이콘 -> 행사(N+M).  season.json 의 '구매혜택'에서 채워진다.
#
# 카탈로그의 attached / attached_e 는 아이콘 번호 목록이고, 실제 그림은
# <카탈로그 루트>/icons/benefit_<번호>.png 에 있다. 행사 비율은 그림 안에
# 글자로만 적혀 있어 자동으로 읽을 수 없다. 그래서 사람이 한 번 보고
# season.json 에 적어 두는 구조다.
#
# ★ 시즌이 바뀌면 번호 체계가 달라질 수 있다. 모르는 번호를 발견하면
#   아이콘을 한 장에 모아 저장하고 멈춘다. 확인 없이 넘기려면
#   --allow-unknown-benefits (권장하지 않음).
# ---------------------------------------------------------------------------
BENEFIT_PROMO = {}
BENEFIT_OTHER = set()


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


def load_season_config(path):
    """season.json 을 읽어 스크립트가 쓰는 형태로 바꾼다.

    관리자가 손으로 고치는 파일이라 한글 키를 쓴다. 빠진 항목이 있으면
    무엇이 없는지 정확히 알려주고 멈춘다 (조용히 기본값으로 넘어가면
    엉뚱한 날짜/행사로 주문서가 배포된다).
    """
    if not os.path.exists(path):
        sys.exit("[!] 설정 파일이 없습니다: %s" % path)
    with io.open(path, encoding="utf-8") as f:
        try:
            cfg = json.load(f)
        except ValueError as e:
            sys.exit("[!] season.json 형식이 잘못됐습니다 (쉼표/따옴표 확인): %s" % e)

    def need(section, key):
        if section not in cfg:
            sys.exit('[!] season.json 에 "%s" 항목이 없습니다.' % section)
        value = cfg[section].get(key)
        if value in (None, ""):
            sys.exit('[!] season.json 의 "%s > %s" 값이 비어 있습니다.' % (section, key))
        return value

    benefit = cfg.get("구매혜택", {})
    promo = {}
    for k, v in (benefit.get("행사") or {}).items():
        if not str(k).isdigit():
            continue  # "_설명" 같은 주석 키는 건너뛴다
        if not re.match(r"^\d+\+\d+$", str(v)):
            sys.exit('[!] 행사 표기가 잘못됐습니다: 아이콘 %s -> "%s" (예: "2+1")' % (k, v))
        promo[int(k)] = str(v)

    return {
        "store": {
            "name": need("매장", "이름"),
            "manager": need("매장", "담당자"),
            "phone": need("매장", "전화번호"),
        },
        "season": need("시즌", "이름"),
        "catalog": need("시즌", "카탈로그주소"),
        "pdf": need("시즌", "바코드PDF"),
        "pre_start": need("행사기간", "사전행사시작"),
        "main_start": need("행사기간", "본행사시작"),
        "pre_note": cfg.get("행사기간", {}).get("사전행사조건", ""),
        "promo": promo,
        "other": set(int(n) for n in (benefit.get("행사아님") or [])),
    }


def write_store_js(store, season):
    """매장 정보를 주문서가 읽는 전역으로 내보낸다."""
    body = json.dumps(store, ensure_ascii=False, indent=2).replace("\n", "\n")
    text = (
        "// 매장 정보 (season.json 에서 자동 생성 - 직접 편집하지 마세요)\n"
        "// 시즌: %s\n\n"
        "const STORE_INFO = %s;\n" % (season, body)
    )
    with io.open(STORE_JS, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(text)


def save_unknown_icon_sheet(catalog_url, codes):
    """모르는 혜택 아이콘을 한 장에 모아 저장한다 (번호와 함께).

    번호만 알려주면 관리자가 주소를 하나씩 열어야 한다. 그림 한 장이면
    바로 보고 season.json 에 옮겨 적을 수 있다.
    """
    root = catalog_url.rsplit("/", 1)[0]
    try:
        from PIL import ImageDraw
        tiles = []
        for n in sorted(codes):
            data = urlopen("%s/icons/benefit_%d.png" % (root, n)).read()
            tiles.append((n, Image.open(BytesIO(data)).convert("RGB")))
        if not tiles:
            return None
        cell, cols = 150, min(6, len(tiles))
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell, rows * (cell + 22)), "white")
        draw = ImageDraw.Draw(sheet)
        for i, (n, im) in enumerate(tiles):
            x, y = (i % cols) * cell, (i // cols) * (cell + 22)
            sheet.paste(im.resize((cell - 10, cell - 10), Image.LANCZOS), (x + 5, y + 20))
            draw.text((x + 6, y + 4), "%d번" % n, fill="black")
        sheet.save(ICON_SHEET)
        return ICON_SHEET
    except Exception as e:
        print("   (아이콘 모음 이미지를 만들지 못했습니다: %s)" % e)
        return None


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


def write_products_js(catalog, season, source_desc, pre_start, main_start, pre_note):
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
        "// 행사: 사전행사 %d개 (%s ~) / 본행사 %d개 (%s ~)\n\n"
        "const PROMO_CONFIG = {\n"
        "  preStart: \"%s\",   // 이 날부터 사전행사(eventPre) 적용\n"
        "  mainStart: \"%s\",  // 이 날부터 본행사(eventMain) 적용\n"
        "  preNote: %s\n"
        "};\n\n"
        % (season, source_desc, len(catalog), len(market),
           n_pre, pre_start, n_main, main_start,
           pre_start, main_start, json.dumps(pre_note, ensure_ascii=False))
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
    global BENEFIT_PROMO, BENEFIT_OTHER

    ap = argparse.ArgumentParser(description="시즌 상품/바코드 일괄 갱신")
    ap.add_argument("--config", default=SEASON_JSON,
                    help="설정 파일 (기본: season.json)")
    ap.add_argument("--allow-unknown-benefits", action="store_true",
                    help="처음 보는 구매혜택 아이콘이 있어도 계속 진행")
    ap.add_argument("--skip-barcodes", action="store_true",
                    help="바코드 이미지는 건드리지 않고 products.js 만 다시 만든다")
    args = ap.parse_args()

    print("0) 설정 읽는 중: %s" % args.config)
    cfg = load_season_config(args.config)
    BENEFIT_PROMO = cfg["promo"]
    BENEFIT_OTHER = cfg["other"]
    pdf_path = cfg["pdf"] if os.path.isabs(cfg["pdf"]) else os.path.join(REPO, cfg["pdf"])
    if not os.path.exists(pdf_path):
        sys.exit("[!] 바코드 PDF가 없습니다: %s\n"
                 "    season.json 의 '바코드PDF' 경로와 실제 올린 파일 이름이 같은지 확인하세요."
                 % cfg["pdf"])
    print("   매장: %s / %s / %s"
          % (cfg["store"]["name"], cfg["store"]["manager"], cfg["store"]["phone"]))
    print("   시즌: %s  (사전행사 %s ~, 본행사 %s ~)"
          % (cfg["season"], cfg["pre_start"], cfg["main_start"]))

    print("1) PDF 읽는 중: %s" % cfg["pdf"])
    positions, pdf_names = read_pdf(pdf_path)
    pdf_codes = {p[1] for p in positions}
    print("   상품코드 %d개" % len(pdf_codes))

    print("2) 카탈로그 읽는 중: %s" % cfg["catalog"])
    try:
        catalog = load_catalog(cfg["catalog"])
    except Exception as e:
        sys.exit("[!] 카탈로그를 읽지 못했습니다: %s\n"
                 "    season.json 의 '카탈로그주소'가 맞는지, 브라우저에서 열리는지 확인하세요." % e)
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
        root = cfg["catalog"].rsplit("/", 1)[0]
        print("   [!] 처음 보는 혜택 아이콘 %d개: %s"
              % (len(unknown), sorted(unknown)))
        for n in sorted(unknown):
            print("       %s/icons/benefit_%d.png" % (root, n))
        sheet = save_unknown_icon_sheet(cfg["catalog"], unknown)
        if sheet:
            print("   모아 놓은 그림: %s" % os.path.basename(sheet))
        print("   그림을 보고 season.json 의 '구매혜택'에 추가하세요.")
        print("     - 1+1, 2+1 처럼 덤을 주는 아이콘 -> '행사' 에 \"번호\": \"2+1\"")
        print("     - 무료배송/냉장/할인 등 나머지    -> '행사아님' 목록에 번호만")
        if not args.allow_unknown_benefits:
            print("   행사를 잘못 넣으면 청구액이 틀어지므로 여기서 멈춥니다.")
            return 1

    print("5) products.js / store.js 생성")
    market, n_pre, n_main, conflicts = write_products_js(
        catalog, cfg["season"], cfg["catalog"],
        cfg["pre_start"], cfg["main_start"], cfg["pre_note"])
    write_store_js(cfg["store"], cfg["season"])
    print("   상품 %d개, 시세반영 %d개 %s" % (len(catalog), len(market), market))
    print("   행사: 사전행사 %d개 (%s ~) / 본행사 %d개 (%s ~)"
          % (n_pre, cfg["pre_start"], n_main, cfg["main_start"]))
    if conflicts:
        print("   [!] 한 상품에 행사 아이콘이 여러 개: %s" % conflicts[:10])

    if args.skip_barcodes:
        print("6) 바코드 이미지 렌더링 건너뜀 (--skip-barcodes)")
        return 0

    print("6) 바코드 이미지 렌더링")
    written, skipped, fallback = render_barcodes(pdf_path, positions)
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
