# -*- coding: utf-8 -*-
"""새 시즌 준비 0단계 — 링크 두 개만 받아서 확인하고 재료를 모은다.

    python tools/season_prep.py <카탈로그 주소> [바코드 PDF (파일 또는 링크)]

update_season.py 를 돌리기 **전에** 실행한다. 아무것도 고치지 않고
(바코드 PDF 를 BarcodeSource/ 에 받는 것만 예외) 다음을 해 준다.

  1. 카탈로그 주소를 products.json 주소로 다듬고, 실제로 열리는지 확인
  2. 상품 수와 필수 항목이 우리가 아는 모양인지 확인
  3. 사전행사 배너 그림을 내려받는다 -> 행사 날짜는 그림 안의 글자라
     사람(또는 그림을 읽을 수 있는 도구)이 봐야 한다
  4. 이번 시즌이 쓰는 구매혜택 아이콘 중 **처음 보는 것**만 골라 내려받는다
  5. 위 결과로 시즌설정.txt 에 넣을 내용을 만들어 보여 준다 (날짜만 비워 둠)

왜 따로 두는가: update_season.py 는 "다 갖춰졌을 때 한 번에 만드는" 도구라,
주소가 틀렸거나 아이콘이 처음 보는 것이면 한참 가다가 멈춘다. 준비 단계에서
막힐 곳을 먼저 다 보여주면 왕복이 한 번으로 끝난다.

이 스크립트는 저장소를 바꾸지 않는다. 내려받은 그림은 .season_prep/ 에 두고
그 폴더는 .gitignore 에 있다.
"""

import io
import json
import os
import re
import sys
from urllib.request import urlopen

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import update_season as us  # noqa: E402  (같은 폴더의 본 스크립트를 그대로 쓴다)

REPO = us.REPO
OUT_DIR = os.path.join(REPO, ".season_prep")

# 카탈로그 사이트에서 행사 기간이 적혀 있는 그림들.
# 날짜는 어느 시즌이든 이 두 장 안에 글자로 그려져 있었다.
BANNERS = [
    "headers/event_header_1.png",
    "events/event_1.jpg",
]


def catalog_root(text):
    """관리자가 어떤 형태로 주소를 주든 카탈로그 폴더 주소로 다듬는다.

    https://gs25mobile.com/2027_1st            -> 그대로
    https://gs25mobile.com/2027_1st/category   -> /category 를 뗀다
    https://gs25mobile.com/2027_1st/products.json -> 파일 이름을 뗀다
    """
    url = text.strip().rstrip("/")
    if not url.startswith("http"):
        sys.exit("[!] 카탈로그 주소는 http 로 시작해야 합니다: %s" % text)
    url = re.sub(r"/products\.json$", "", url)
    url = re.sub(r"/(category|products|goods)(/.*)?$", "", url)
    return url


def fetch(url, timeout=30):
    return urlopen(url, timeout=timeout).read()


def save(name, data):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name.replace("/", "_"))
    with open(path, "wb") as f:
        f.write(data)
    return path


def take_pdf(source):
    """바코드 PDF 를 BarcodeSource/ 에 놓고 저장소 기준 상대 경로를 돌려준다.

    링크면 받아서 저장하고, 이미 있는 파일이면 그대로 쓴다.
    파일 이름은 건드리지 않는다 - 시즌설정.txt 에 적을 이름과 같아야 한다.
    """
    if not source:
        return None

    if source.startswith("http"):
        name = os.path.basename(source.split("?")[0]) or "barcode.pdf"
        if not name.lower().endswith(".pdf"):
            name += ".pdf"
        dest = os.path.join(REPO, "BarcodeSource", name)
        if os.path.exists(dest):
            print("   이미 있는 파일이라 그대로 씁니다: BarcodeSource/%s" % name)
        else:
            data = fetch(source, timeout=120)
            if data[:4] != b"%PDF":
                sys.exit("[!] 받은 파일이 PDF 가 아닙니다. 주소를 확인하세요: %s" % source)
            with open(dest, "wb") as f:
                f.write(data)
            print("   내려받음: BarcodeSource/%s (%d bytes)" % (name, len(data)))
        return "BarcodeSource/" + name

    path = source if os.path.isabs(source) else os.path.join(REPO, source)
    if not os.path.exists(path):
        sys.exit("[!] 바코드 PDF 를 찾지 못했습니다: %s" % source)

    inside = os.path.join(REPO, "BarcodeSource", os.path.basename(path))
    if os.path.abspath(path) != os.path.abspath(inside):
        with open(path, "rb") as src, open(inside, "wb") as dst:
            dst.write(src.read())
        print("   BarcodeSource/ 로 복사했습니다: %s" % os.path.basename(path))
    return "BarcodeSource/" + os.path.basename(path)


def main():
    if len(sys.argv) < 2:
        # 모듈 docstring 을 그대로 찍지 않는다. 윈도우 콘솔은 cp949 라서
        # 문서에 쓴 줄표(—)나 화살표(→) 하나에 UnicodeEncodeError 로 죽는다.
        # 사용법은 cp949 로 찍히는 글자만 쓴다.
        print("사용법: python tools/season_prep.py <카탈로그 주소> [바코드 PDF 파일 또는 링크]")
        print("예:     python tools/season_prep.py https://gs25mobile.com/2027_1st/category "
              "BarcodeSource/20270105.pdf")
        print("자세한 설명은 이 파일 맨 위의 주석이나 docs/관리자안내.md 를 보세요.")
        return 2

    root = catalog_root(sys.argv[1])
    pdf_arg = sys.argv[2] if len(sys.argv) > 2 else None
    products_url = root + "/products.json"

    print("1) 카탈로그 확인: %s" % products_url)
    try:
        catalog = us.load_catalog(products_url)
    except Exception as e:
        sys.exit("[!] 카탈로그를 읽지 못했습니다: %s\n"
                 "    브라우저에서 %s 가 열리는지 확인하세요." % (e, products_url))
    us.check_catalog_shape(catalog)          # 항목 이름이 바뀌었으면 여기서 멈춘다
    codes = [r["code"] for r in catalog]
    print("   상품 %d개 (%s ... %s)" % (len(catalog), codes[0], codes[-1]))
    # 숫자가 아닌 가격("시세반영" 등)은 단가를 비워 두고 점원이 직접 넣는다.
    # 판정 기준은 write_products_js() 와 같아야 한다 - 문자열 비교가 아니라 int 여부.
    market = [r["code"] for r in catalog if not isinstance(r.get("price"), int)]
    if market:
        print("   시세반영 상품 %d개: %s" % (len(market), market[:10]))

    print("2) 사전행사 배너 내려받기 (행사 날짜는 그림 안에 글자로 있습니다)")
    banners = []
    for name in BANNERS:
        try:
            path = save(name, fetch(root + "/" + name))
            banners.append(path)
            print("   %s" % path)
        except Exception as e:
            print("   (없거나 못 받음: %s - %s)" % (name, e))
    if not banners:
        print("   [!] 배너를 한 장도 못 받았습니다. 행사 날짜는 카탈로그 사이트에서 직접 보세요.")

    print("3) 구매혜택 아이콘 확인 (지난 시즌 기억과 대조)")
    used = us.scan_benefits(catalog)
    memory = us.load_benefit_memory(us.SEASON_JSON)
    resolved, _notes, unknown = us.resolve_benefits(used, memory, {}, root)
    print("   쓰이는 아이콘 %d개 / 지난 시즌에서 알아낸 것 %d개" % (len(used), len(resolved)))
    for n, why, hint in unknown:
        try:
            path = save("benefit_%d.png" % n, fetch("%s/icons/benefit_%d.png" % (root, n)))
        except Exception as e:
            path = "(못 받음: %s)" % e
        print("   [!] %d번 - %s" % (n, why))
        print("       %s" % path)
        if hint:
            print("       %s" % hint)
    if unknown:
        print("   위 그림을 보고 비율을 읽어 시즌설정.txt 맨 아래에 적으세요.")
        print("   덤이면  '구매혜택 %d: 2+1',  덤이 아니면  '구매혜택 %d: 없음'"
              % (unknown[0][0], unknown[0][0]))
        print("   ★ 2+1 과 3+1 은 글자 하나만 다릅니다. 확대해서 보세요.")
    else:
        print("   [OK] 처음 보는 아이콘이 없습니다. 손댈 것이 없습니다.")

    pdf_rel = None
    if pdf_arg:
        print("4) 바코드 PDF")
        pdf_rel = take_pdf(pdf_arg)
        positions, _names = us.read_pdf(os.path.join(REPO, pdf_rel))
        pdf_codes = {p[1] for p in positions}
        print("   상품코드 %d개" % len(pdf_codes))
        only_pdf = sorted(pdf_codes - set(codes))
        only_web = sorted(set(codes) - pdf_codes)
        if only_pdf or only_web:
            print("   [!] 카탈로그와 코드가 다릅니다 - 같은 시즌 파일이 맞는지 확인하세요.")
            print("       PDF에만: %s" % only_pdf[:10])
            print("       카탈로그에만: %s" % only_web[:10])
        else:
            print("   [OK] 카탈로그와 상품코드 %d개가 1:1로 맞습니다." % len(pdf_codes))
    else:
        print("4) 바코드 PDF - 안 주셨습니다 (나중에 BarcodeSource/ 에 올리세요)")

    print("\n5) 시즌설정.txt 에 넣을 내용 (날짜 3줄은 배너를 보고 채우세요)")
    print("-" * 58)
    print("시즌 이름: %s" % season_guess(root))
    print("카탈로그 주소: %s" % products_url)
    print("바코드 PDF: %s" % (pdf_rel or "BarcodeSource/<올린 파일 이름>"))
    print("사전행사 시작: ")
    print("본행사 시작:            # 사전행사 끝난 날 + 1일")
    print("사전행사 조건: ")
    print("-" * 58)
    return 0


def season_guess(root):
    """폴더 이름에서 시즌 이름을 짐작한다 (2027_1st -> 2027 설날).

    어디까지나 초안이다. 맞는지는 사람이 보고 고친다.
    """
    m = re.search(r"/(\d{4})_(\d)(?:st|nd|rd|th)", root)
    if not m:
        return "<시즌 이름>"
    return "%s %s" % (m.group(1), "설날" if m.group(2) == "1" else "추석")


if __name__ == "__main__":
    sys.exit(main())
