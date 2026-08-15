# -*- coding: utf-8 -*-
"""시즌(설날/추석) 상품 데이터 + 바코드 이미지 일괄 갱신 스크립트.

명절마다 GS25 카탈로그가 통째로 바뀐다. 같은 상품코드가 다른 상품을 가리키기
때문에 products.js 와 BarcodeImgs/ 를 **함께** 갈아끼워야 한다. 한쪽만 바꾸면
주문서에 엉뚱한 바코드가 찍혀 다른 상품이 배송된다.

관리자가 고치는 파일은 저장소 루트의 **시즌설정.txt** 하나다. "이름: 값" 한 줄
형식이라 쉼표나 괄호가 없고, 따라서 쉼표 하나로 전체가 깨지는 일이 없다.
보통은 GitHub Actions 의 "시즌 갱신"이 이 스크립트를 대신 실행한다.

season.json 은 이제 **스크립트가 관리하는 기억 파일**이다 (직접 고치지 않는다).
구매혜택 아이콘 번호마다 행사 비율과 그림 지문을 쌓아 두어, 다음 시즌에 번호가
바뀌어도 같은 그림이면 알아서 인계한다.

사용법:
    python tools/update_season.py                    # 시즌설정.txt 사용
    python tools/update_season.py --skip-barcodes    # products.js 만 다시 생성

하는 일:
    0. 시즌설정.txt 에서 매장 정보/시즌/행사 기간을 읽음
    1. 바코드북 PDF에서 상품코드와 위치를 추출
    2. 카탈로그 JSON을 내려받아 상품명/가격/구매혜택을 가져옴
    3. 두 소스의 상품명을 교차 검증 (불일치하면 경고)
    4. 구매혜택 아이콘을 그림 지문으로 대조해 행사(N+M)로 해석
       (지문도 처음 보는 아이콘이면 중단)
    5. products.js + store.js 생성
    6. BarcodeImgs/ 를 비우고 코드별 바코드 이미지를 다시 렌더링

의존성: pip install pdfplumber pymupdf pillow
"""
from __future__ import print_function

import argparse
import difflib
import glob
import hashlib
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
SETTINGS_TXT = os.path.join(REPO, "시즌설정.txt")
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
# 구매혜택 아이콘 -> 행사(N+M).
#
# 카탈로그의 attached / attached_e 는 아이콘 번호 목록이고, 실제 그림은
# <카탈로그 루트>/icons/benefit_<번호>.png 에 있다. 행사 비율은 그림 안에
# 글자로만 적혀 있어 자동으로 읽을 수 없다.
#
# ★ 시즌이 바뀌면 번호 체계가 달라진다. 그래서 번호가 아니라 **그림**을
#   기억한다 (season.json 의 '지문'). 지난 시즌 12번과 이번 시즌 37번이
#   같은 그림이면 비율을 그대로 인계하고, 지문까지 처음 보는 아이콘만
#   사람에게 묻는다. 확인 없이 넘기려면 --allow-unknown-benefits
#   (권장하지 않음 - 모르는 아이콘은 조용히 '없음'이 되어 덤을 빠뜨린다).
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


# ---------------------------------------------------------------------------
# 관리자 입력 파일 (시즌설정.txt)
#
# 예전에는 관리자가 season.json 을 직접 고쳤는데, 쉼표 하나만 빠져도 파일
# 전체가 깨지고 오류 메시지도 관리자에게는 읽히지 않았다. 그래서 사람이 쓰는
# 파일은 "이름: 값" 한 줄 형식으로 바꿨다 - 쉼표도 괄호도 없으니 구조가
# 깨질 수가 없고, 틀린 줄이 있으면 그 줄 번호만 짚어 주면 된다.
#
# 오타는 조용히 넘기지 않는다. 모르는 이름이 있으면 비슷한 이름을 제안하고
# 멈춘다 ("사전행사시작"을 "사전행사시자"로 적으면 값이 없는 셈이 되어
# 엉뚱한 날짜로 배포되기 때문이다).
# ---------------------------------------------------------------------------

# (정규화된 이름, 내부 이름, 필수 여부, 예시)
SETTING_FIELDS = [
    ("매장이름", "store_name", True, "LG 생산기술원점"),
    ("매장담당자", "store_manager", True, "홍길동"),
    ("매장전화번호", "store_phone", True, "010-0000-0000"),
    ("시즌이름", "season", True, "2026 추석"),
    ("카탈로그주소", "catalog", True, "https://gs25mobile.com/2026_2nd/products.json"),
    ("바코드PDF", "pdf", True, "BarcodeSource/20260815.pdf"),
    ("사전행사시작", "pre_start", True, "2026-08-17"),
    ("본행사시작", "main_start", True, "2026-09-05"),
    ("사전행사조건", "pre_note", False, "삼성/KB국민/비씨/신한카드 결제 시"),
]

# 관리자가 조금 다르게 적어도 알아듣도록
SETTING_ALIASES = {
    "매장명": "매장이름", "점포이름": "매장이름", "점포명": "매장이름",
    "담당자": "매장담당자", "담당자이름": "매장담당자",
    "전화번호": "매장전화번호", "매장연락처": "매장전화번호", "연락처": "매장전화번호",
    "시즌": "시즌이름", "명절": "시즌이름",
    "카탈로그": "카탈로그주소", "카탈로그URL": "카탈로그주소", "카탈로그링크": "카탈로그주소",
    "바코드파일": "바코드PDF", "바코드PDF파일": "바코드PDF", "바코드북": "바코드PDF",
    "PDF": "바코드PDF",
    "사전행사시작일": "사전행사시작", "사전행사": "사전행사시작",
    "본행사시작일": "본행사시작", "본행사": "본행사시작",
    "사전행사안내": "사전행사조건", "사전행사카드": "사전행사조건",
}

BENEFIT_KEY_RE = re.compile(r"^구매혜택0*(\d+)$")
NO_PROMO_WORDS = {"없음", "없슴", "아님", "행사아님", "해당없음", "해당사항없음", "X", "-"}


def norm_key(text):
    """줄 앞부분(이름)을 비교용으로 다듬는다: 공백 제거 + 영문 대문자."""
    return re.sub(r"\s+", "", text).upper()


def clean_value(text):
    """값에서 따옴표와 끝 쉼표를 걷어낸다.

    JSON 을 고치던 습관으로 `"2026 추석",` 처럼 적어도 그대로 통하게 한다.
    """
    v = text.strip()
    v = re.sub(r"[,，]+$", "", v).strip()
    pairs = [('"', '"'), ("'", "'"), ("“", "”"), ("‘", "’")]
    for a, b in pairs:
        if len(v) >= 2 and v[0] == a and v[-1] == b:
            return v[1:-1].strip()
    return v


def normalize_date(value):
    """2026.8.17 / 2026/08/17 / 2026-8-17 을 2026-08-17 로. 못 읽으면 None."""
    v = re.sub(r"[.‧/\s]+", "-", value.strip()).strip("-")
    v = re.sub(r"[년월]", "-", v).replace("일", "").strip("-")
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", v)
    if not m:
        return None
    y, mo, d = (int(x) for x in m.groups())
    if not (1 <= mo <= 12 and 1 <= d <= 31):
        return None
    return "%04d-%02d-%02d" % (y, mo, d)


def normalize_benefit(value):
    """'2+1' / '2 + 1' / '없음' 을 표준형으로. 못 읽으면 None."""
    t = re.sub(r"\s+", "", value).replace("＋", "+").replace("＋", "+")
    if t.upper() in NO_PROMO_WORDS:
        return "없음"
    m = re.match(r"^(\d+)\+(\d+)$", t)
    if not m:
        return None
    return "%d+%d" % (int(m.group(1)), int(m.group(2)))


def load_settings(path):
    """시즌설정.txt 를 읽어 스크립트가 쓰는 형태로 바꾼다.

    틀린 줄을 만나도 바로 멈추지 않고 끝까지 읽어 **한 번에 모두** 알려준다.
    한 줄 고치고 다시 돌리기를 반복하지 않게 하기 위해서다.
    """
    if not os.path.exists(path):
        sys.exit("[!] 설정 파일이 없습니다: %s" % os.path.basename(path))

    with io.open(path, encoding="utf-8-sig") as f:
        lines = f.read().splitlines()

    known = {name: internal for name, internal, _, _ in SETTING_FIELDS}
    optional = set(name for name, _, required, _ in SETTING_FIELDS if not required)
    values, benefits, problems, seen = {}, {}, [], {}

    for no, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue

        m = re.match(r"^([^:：=]+)[:：=](.*)$", line)
        if not m:
            problems.append((no, raw, "'이름: 값' 형식이 아닙니다. 이름 뒤에 쌍점(:)을 넣어 주세요."))
            continue

        key, value = norm_key(m.group(1)), clean_value(m.group(2))
        key = SETTING_ALIASES.get(key, key)

        bm = BENEFIT_KEY_RE.match(key)
        if bm:
            rate = normalize_benefit(value)
            if rate is None:
                problems.append((no, raw,
                                 "구매혜택은 '2+1' 처럼 적거나, 덤이 아니면 '없음' 이라고 적어 주세요."))
            else:
                benefits[int(bm.group(1))] = rate
            continue

        if key not in known:
            hint = difflib.get_close_matches(key, list(known) + ["구매혜택12"], 1, 0.5)
            tail = ("  '%s' 을(를) 쓰시려던 것 같습니다." % hint[0]) if hint else ""
            problems.append((no, raw, "모르는 이름입니다.%s" % tail))
            continue

        if key in seen:
            problems.append((no, raw, "'%s' 이(가) %d번째 줄에도 있습니다. 하나만 남겨 주세요."
                             % (key, seen[key])))
            continue
        seen[key] = no

        if value == "":
            # 필수가 아닌 항목(사전행사 조건)은 비워 두어도 된다
            if key in optional:
                continue
            problems.append((no, raw, "값이 비어 있습니다."))
            continue
        values[known[key]] = (value, no)

    # 필수 항목 확인
    for name, internal, required, sample in SETTING_FIELDS:
        if required and internal not in values:
            problems.append((0, "", "'%s' 줄이 없습니다. 이렇게 한 줄 추가하세요 ->  %s: %s"
                             % (name, name, sample)))

    # 값 형식 확인
    out = {internal: v for internal, (v, _) in values.items()}
    for internal, label in (("pre_start", "사전행사 시작"), ("main_start", "본행사 시작")):
        if internal not in out:
            continue
        fixed = normalize_date(out[internal])
        if fixed is None:
            problems.append((values[internal][1], out[internal],
                             "%s 은(는) 2026-08-17 처럼 적어 주세요." % label))
        else:
            out[internal] = fixed

    if "catalog" in out and not out["catalog"].startswith("http"):
        problems.append((values["catalog"][1], out["catalog"],
                         "카탈로그 주소는 http 로 시작하는 products.json 주소여야 합니다."))

    if problems:
        # 줄 번호 순으로. 줄이 아예 없는 항목(번호 0)은 맨 뒤에 모아 보여 준다.
        problems.sort(key=lambda p: (p[0] == 0, p[0]))
        print("[!] %s 을(를) 읽지 못했습니다. 아래 %d곳을 고쳐 주세요.\n"
              % (os.path.basename(path), len(problems)))
        for no, raw, why in problems:
            if no:
                print("  %d번째 줄:  %s" % (no, raw.strip()))
            print("      -> %s\n" % why)
        sys.exit(1)

    if out["pre_start"] > out["main_start"]:
        sys.exit("[!] 사전행사 시작(%s)이 본행사 시작(%s)보다 늦습니다. 날짜를 확인해 주세요."
                 % (out["pre_start"], out["main_start"]))

    return {
        "store": {
            "name": out["store_name"],
            "manager": out["store_manager"],
            "phone": out["store_phone"],
        },
        "season": out["season"],
        "catalog": out["catalog"],
        "pdf": out["pdf"],
        "pre_start": out["pre_start"],
        "main_start": out["main_start"],
        "pre_note": out.get("pre_note", ""),
        "benefit_overrides": benefits,
    }


def migrate_old_json(json_path, txt_path):
    """시즌설정.txt 가 없고 옛 season.json 만 있으면 자동으로 옮겨 준다.

    관리자가 손으로 다시 옮겨 적다가 값을 흘리는 일이 없게 하기 위한 것이다.
    """
    if os.path.exists(txt_path) or not os.path.exists(json_path):
        return False
    try:
        with io.open(json_path, encoding="utf-8") as f:
            cfg = json.load(f)
    except (ValueError, IOError):
        return False
    store, season, period = cfg.get("매장"), cfg.get("시즌"), cfg.get("행사기간")
    if not (isinstance(store, dict) and isinstance(season, dict) and isinstance(period, dict)):
        return False

    rows = [
        ("매장 이름", store.get("이름", "")),
        ("매장 담당자", store.get("담당자", "")),
        ("매장 전화번호", store.get("전화번호", "")),
        ("시즌 이름", season.get("이름", "")),
        ("카탈로그 주소", season.get("카탈로그주소", "")),
        ("바코드 PDF", season.get("바코드PDF", "")),
        ("사전행사 시작", period.get("사전행사시작", "")),
        ("본행사 시작", period.get("본행사시작", "")),
        ("사전행사 조건", period.get("사전행사조건", "")),
    ]
    text = ("# 예전 season.json 에서 자동으로 옮겨 적었습니다.\n"
            "# 앞으로는 이 파일만 고치시면 됩니다. 쉼표나 괄호는 필요 없습니다.\n\n")
    text += "".join("%s: %s\n" % r for r in rows)
    with io.open(txt_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    return True


# ---------------------------------------------------------------------------
# 구매혜택 기억 파일 (season.json) - 스크립트가 쓰고 읽는다
# ---------------------------------------------------------------------------

def load_benefit_memory(path):
    """{번호: {"행사", "지문", "대략"}} 형태의 기억을 읽는다. 옛 형식도 받아들인다."""
    if not os.path.exists(path):
        return {}
    try:
        with io.open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (ValueError, IOError) as e:
        print("   (season.json 을 읽지 못해 기억 없이 시작합니다: %s)" % e)
        return {}

    section = data.get("구매혜택")
    if not isinstance(section, dict):
        return {}

    memory = {}
    for key, val in section.items():          # 새 형식
        if str(key).isdigit() and isinstance(val, dict):
            memory[int(key)] = {
                "행사": str(val.get("행사") or "없음"),
                "지문": val.get("지문") or "",
                "대략": val.get("대략") or "",
            }

    old_promo = section.get("행사")            # 옛 형식 (지문 없음)
    if isinstance(old_promo, dict):
        for key, val in old_promo.items():
            if str(key).isdigit():
                memory.setdefault(int(key), {"행사": str(val), "지문": "", "대략": ""})
    for n in (section.get("행사아님") or []):
        try:
            memory.setdefault(int(n), {"행사": "없음", "지문": "", "대략": ""})
        except (TypeError, ValueError):
            pass
    return memory


def save_benefit_memory(path, memory, season):
    body = {}
    for n in sorted(memory):
        body[str(n)] = {
            "행사": memory[n]["행사"],
            "지문": memory[n].get("지문", ""),
            "대략": memory[n].get("대략", ""),
        }
    data = {
        "_설명": "자동 생성 파일입니다. 직접 고치지 마세요.",
        "_고칠파일": "관리자가 고치는 파일은 시즌설정.txt 입니다.",
        "_내용": ("구매혜택 아이콘 번호 -> 행사 비율. '지문'은 아이콘 그림을 알아보기 위한 값이라, "
                  "다음 시즌에 번호가 바뀌어도 같은 그림이면 자동으로 인계됩니다."),
        "마지막시즌": season,
        "구매혜택": body,
    }
    with io.open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


# ---------------------------------------------------------------------------
# 아이콘 그림 지문
# ---------------------------------------------------------------------------

_ICON_CACHE = {}


def icon_fingerprint(root, n):
    """아이콘 그림의 (정확지문, 대략지문). 내려받지 못하면 (None, None).

    정확지문은 픽셀이 하나도 다르지 않을 때만 일치한다. 행사 아이콘은
    '2+1' 과 '3+1' 처럼 글자 한 자만 다른 경우가 많아서, 비슷한 그림을
    같다고 보면 엉뚱한 수량이 나간다. 그래서 **자동 인계는 정확지문으로만**
    하고, 대략지문은 사람에게 "이것과 비슷합니다" 라고 힌트를 줄 때만 쓴다.
    """
    if n in _ICON_CACHE:
        return _ICON_CACHE[n]
    exact = rough = None
    try:
        data = urlopen("%s/icons/benefit_%d.png" % (root, n), timeout=20).read()
        im = Image.open(BytesIO(data)).convert("RGB")
        h = hashlib.sha256()
        h.update(("%dx%d|" % im.size).encode("ascii"))
        h.update(im.tobytes())
        exact = h.hexdigest()[:32]

        px = list(im.convert("L").resize((9, 8), Image.LANCZOS).getdata())
        bits = 0
        for row in range(8):
            for col in range(8):
                left, right = px[row * 9 + col], px[row * 9 + col + 1]
                bits = (bits << 1) | (1 if left > right else 0)
        rough = "%016x" % bits
    except Exception:
        pass
    _ICON_CACHE[n] = (exact, rough)
    return _ICON_CACHE[n]


def rough_distance(a, b):
    if not a or not b:
        return 64
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def resolve_benefits(used, memory, overrides, root):
    """쓰인 아이콘 번호마다 행사 비율을 정한다.

    우선순위
      1. 시즌설정.txt 에 관리자가 직접 적은 값
      2. 그림 지문이 정확히 같은 지난 기억 (번호가 바뀌어도 인계된다)
      3. 지문이 아직 없는 같은 번호의 기억 (지문 도입 전 자료)
      4. 아이콘을 내려받지 못했으나 같은 번호의 기억이 있는 경우

    번호는 그대로인데 그림이 바뀐 경우는 인계하지 않는다. 조용히 넘기면
    작년 비율로 올해 주문이 나가기 때문에, 가장 확인이 필요한 경우다.

    @returns (번호->비율, 알림 목록, 모르는 번호 목록[(번호, 사유, 힌트)])
    """
    by_print = {}
    for n, rec in memory.items():
        if rec.get("지문"):
            by_print.setdefault(rec["지문"], (n, rec["행사"]))

    resolved, notes, unknown = {}, [], []

    for n in sorted(used):
        if n in overrides:
            resolved[n] = overrides[n]
            notes.append("%2d번 -> %-4s (시즌설정.txt 에 적으신 값)" % (n, overrides[n]))
            continue

        exact, rough = icon_fingerprint(root, n)
        prev = memory.get(n)

        if exact and exact in by_print:
            src, rate = by_print[exact]
            resolved[n] = rate
            if src == n:
                notes.append("%2d번 -> %-4s (지난 시즌과 같은 그림)" % (n, rate))
            else:
                notes.append("%2d번 -> %-4s (지난 시즌 %d번과 같은 그림 - 번호만 바뀜)"
                             % (n, rate, src))
            continue

        if prev and not prev.get("지문"):
            resolved[n] = prev["행사"]
            notes.append("%2d번 -> %-4s (예전 기록, 이번에 그림도 기억함)" % (n, prev["행사"]))
            continue

        if prev and not exact:
            resolved[n] = prev["행사"]
            notes.append("%2d번 -> %-4s (그림을 못 받아 기억한 값 사용)" % (n, prev["행사"]))
            continue

        if prev:
            why = "번호는 그대로인데 아이콘 그림이 바뀌었습니다 (지난 기록: %s)" % prev["행사"]
        else:
            why = "처음 보는 아이콘입니다"

        hint = ""
        best, best_d = None, 99
        for m, rec in memory.items():
            d = rough_distance(rough, rec.get("대략"))
            if d < best_d:
                best, best_d = m, d
        if best is not None and best_d <= 10:
            hint = "지난 %d번(%s)과 비슷해 보입니다. 같은 것인지 확인하세요." % (
                best, memory[best]["행사"])
        unknown.append((n, why, hint))

    return resolved, notes, unknown


def write_store_js(store, season):
    """매장 정보를 주문서가 읽는 전역으로 내보낸다."""
    body = json.dumps(store, ensure_ascii=False, indent=2).replace("\n", "\n")
    text = (
        "// 매장 정보 (시즌설정.txt 에서 자동 생성 - 직접 편집하지 마세요)\n"
        "// 시즌: %s\n\n"
        "const STORE_INFO = %s;\n" % (season, body)
    )
    with io.open(STORE_JS, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(text)


def save_unknown_icon_sheet(catalog_url, codes):
    """모르는 혜택 아이콘을 한 장에 모아 저장한다 (번호와 함께).

    번호만 알려주면 관리자가 주소를 하나씩 열어야 한다. 그림 한 장이면
    바로 보고 시즌설정.txt 에 옮겨 적을 수 있다.
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


def load_categories(catalog_url):
    """카탈로그의 분류 이름표를 가져온다.

    분류 번호(products.json 의 sort)는 데이터에 있지만 **이름은 없다.**
    이름은 카탈로그 사이트의 자바스크립트 안에 Ta 라는 배열로 박혀 있다.
    [ [사전행사 분류...], [본행사 분류...] ] 두 묶음이고, type 이 "list" 인
    것만 상품 목록이다(나머지는 안내 배너).

    남의 압축된 코드에서 긁어오는 것이라 시즌이 바뀌면 깨질 수 있다.
    깨져도 상품 데이터는 멀쩡하므로 여기서 멈추지 않고 (None, 사유) 를
    돌려준다. 부르는 쪽이 크게 경고하고 "분류 3" 처럼 번호로 보여 준다.
    이름을 지어내는 것보다 번호가 낫다 - 틀린 이름은 엉뚱한 데서 상품을 찾게 한다.

    @returns ((사전행사 [(번호, 이름)], 본행사 [(번호, 이름)]), None) 또는 (None, 사유)
    """
    if not catalog_url.startswith("http"):
        return None, "카탈로그가 인터넷 주소가 아닙니다"

    root = catalog_url.rsplit("/", 1)[0]
    try:
        index = urlopen(root + "/", timeout=30).read().decode("utf-8", "replace")
    except Exception as e:
        return None, "카탈로그 첫 화면을 못 받았습니다 (%s)" % e

    m = re.search(r'src="([^"]*index-[^"]*\.js)"', index)
    if not m:
        return None, "카탈로그 첫 화면에서 자바스크립트 주소를 찾지 못했습니다"

    src = m.group(1)
    if not src.startswith("http"):
        src = root.rsplit("/", 1)[0] + src if src.startswith("/") else root + "/" + src
    try:
        script = urlopen(src, timeout=60).read().decode("utf-8", "replace")
    except Exception as e:
        return None, "카탈로그 자바스크립트를 못 받았습니다 (%s)" % e

    m = re.search(r'\bTa\s*=\s*\[', script)
    if not m:
        return None, "분류 표(Ta)를 찾지 못했습니다 - 카탈로그 구조가 바뀐 듯합니다"

    start = script.index("[", m.start())
    depth, i = 0, start
    while i < len(script):
        if script[i] == "[":
            depth += 1
        elif script[i] == "]":
            depth -= 1
            if depth == 0:
                break
        i += 1
    if depth != 0:
        return None, "분류 표가 중간에 끊겼습니다"

    blob = script[start + 1:i]

    # 바깥 배열 안의 두 묶음을 대괄호 균형으로 가른다
    groups, depth, chunk = [], 0, []
    for ch in blob:
        if ch == "[":
            depth += 1
            if depth == 1:
                chunk = []
                continue
        elif ch == "]":
            depth -= 1
            if depth == 0:
                groups.append("".join(chunk))
                continue
        if depth >= 1:
            chunk.append(ch)

    if len(groups) < 2:
        return None, "분류 표의 묶음이 2개가 아닙니다 (%d개)" % len(groups)

    item_re = re.compile(
        r'\{\s*id:\s*(\d+),\s*type:\s*"(\w+)",\s*(?:header:\s*!\d,\s*)?label:\s*"([^"]*)"')

    parsed = []
    for group in groups[:2]:
        rows = []
        for num, kind, label in item_re.findall(group):
            # type 이 "event" 인 항목은 상품 목록이 아니라 안내 배너다
            if kind != "list":
                continue
            num = int(num)
            if num == 0:      # "전체보기" - 분류가 아니다
                continue
            rows.append((num, label))
        parsed.append(rows)

    if not parsed[0] or not parsed[1]:
        return None, "분류 이름이 비어 있습니다 (사전 %d개 / 본 %d개)" % (
            len(parsed[0]), len(parsed[1]))

    return (parsed[0], parsed[1]), None


def benefit_codes(field):
    """attached / attached_e 문자열("3,15,1")을 번호 목록으로."""
    out = []
    for t in str(field or "").split(","):
        t = t.strip()
        if t.isdigit():
            out.append(int(t))
    return out


def scan_benefits(catalog):
    """카탈로그에 실제로 쓰인 혜택 아이콘 번호 집합."""
    used = set()
    for r in catalog:
        used |= set(benefit_codes(r.get("attached")))
        used |= set(benefit_codes(r.get("attached_e")))
    return used


def promo_of(field):
    """혜택 목록에서 행사(N+M) 하나를 뽑는다. 없으면 None.

    @returns (행사 문자열|None, 중복 발견 여부)
    """
    hits = [BENEFIT_PROMO[n] for n in benefit_codes(field) if n in BENEFIT_PROMO]
    if not hits:
        return None, False
    return hits[0], len(set(hits)) > 1


def catalog_search_url(catalog_url):
    """카탈로그 사이트에서 상품코드로 검색한 화면의 주소 (뒤에 코드를 붙여 쓴다).

    카탈로그는 React 단일 페이지 앱이고, 검색창에 입력하면
    <루트>/products/1/0?search=<검색어> 로 이동한다. 그 주소를 직접 열어도
    같은 화면이 나오므로 (서버가 어떤 경로든 index.html 을 돌려준다)
    주문서의 바코드에서 바로 연결할 수 있다.

    1/0 은 라우트의 :page/:classId 로, "본행사 목록 · 분류 제한 없음" 을 뜻한다.
    분류를 걸면 그 분류에 없는 상품이 검색되지 않으므로 0 이어야 한다.

    시즌마다 루트가 바뀌므로(2026_2nd → 2027_1st …) 상수로 두지 않고
    카탈로그 주소에서 만들어 products.js 에 적어 둔다.
    """
    root = catalog_url.rsplit("/", 1)[0]
    return "%s/products/1/0?search=" % root


def catalog_image_url(catalog_url):
    """상품 사진이 있는 곳 (뒤에 <상품코드>.webp 를 붙인다).

    카탈로그의 products.json 에 picture 항목이 있지만 2026 추석 601개 전부
    "<상품코드>.webp" 였다. 코드에서 만들 수 있으므로 601줄을 늘리지 않는다.
    (혹시 규칙이 깨지는 시즌이 오면 check_picture_names() 가 잡아 준다.)
    """
    root = catalog_url.rsplit("/", 1)[0]
    return "%s/goods/" % root


def catalog_icon_url(catalog_url):
    """안내 아이콘이 있는 곳 (뒤에 <번호>.png 를 붙인다).

    행사 비율을 읽어낼 때 쓰는 그 아이콘들과 같은 폴더다
    (<루트>/icons/benefit_<번호>.png).
    """
    root = catalog_url.rsplit("/", 1)[0]
    return "%s/icons/benefit_" % root


def check_picture_names(catalog):
    """사진 파일 이름이 <상품코드>.webp 규칙을 지키는지 확인한다.

    이 규칙이 깨지면 상세 창에 사진이 안 뜨거나 - 더 나쁘게는 - 다른 상품
    사진이 뜬다. 조용히 넘어가면 안 되므로 어긋난 코드를 돌려준다.
    """
    return [r["code"] for r in catalog
            if (r.get("picture") or "") != r["code"] + ".webp"]


def pre_category_of(row):
    """사전행사 분류 번호. 대상이 아니면 None.

    카탈로그는 event 를 5글자 o/x 문자열로 준다("xxxox" = 4번 분류).
    2026 추석 기준 o 가 두 개인 상품은 없었고, 켜진 개수 합(127)이
    attached_e 를 가진 상품 수와 정확히 같았다. 그래도 첫 번째 것만 쓰지 않고
    두 개 이상이면 알 수 있도록 목록으로 돌려준다.
    """
    flags = str(row.get("event") or "")
    return [i + 1 for i, ch in enumerate(flags) if ch in ("o", "O")]


def write_products_js(catalog, season, source_desc, pre_start, main_start, pre_note,
                      categories):
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
        # 상세 창(product_detail.html)에 보여 줄 구성 설명.
        # 카탈로그 상세 화면과 같은 문구라야 점원이 손님에게 그대로 읽어 줄 수 있다.
        desc = " ".join((r.get("description") or "").split())
        if desc:
            fields.append('"desc": %s' % json.dumps(desc, ensure_ascii=False))

        # 행사가 아닌 안내 아이콘(냉장·냉동·무료배송 등).
        # 무슨 그림인지는 이미지 안에 글자로만 있어서 글로 옮길 수 없다.
        # 카탈로그가 하는 것처럼 그림 그대로 상세 창에 보여 준다.
        #
        # attached(본행사)만 본다. attached_e(사전행사)에만 있는 안내 아이콘은
        # 2026 추석 기준 하나도 없었고, 행사 비율은 이미 글자로 따로 보여 주므로
        # 여기에 행사 아이콘까지 넣으면 사전행사 기간에 두 값이 어긋나 보인다.
        info_icons = [n for n in benefit_codes(r.get("attached")) if n in BENEFIT_OTHER]
        if info_icons:
            fields.append('"icons": %s' % json.dumps(info_icons))

        # 분류(카탈로그 목록에서 이 상품이 들어 있는 묶음)
        if isinstance(r.get("sort"), int) and r["sort"] > 0:
            fields.append('"cat": %d' % r["sort"])
        pre_cats = pre_category_of(r)
        if pre_cats:
            fields.append('"preCat": %s' % json.dumps(pre_cats))

        entries.append('  "%s": { %s }' % (code, ", ".join(fields)))

    header = (
        "// GS25 %s 상품 데이터 (tools/update_season.py 자동 생성 - 직접 편집하지 마세요)\n"
        "// 출처: %s\n"
        "// 상품 %d개 / 시세반영 상품 %d개 (price 0 + marketPrice)\n"
        "// 행사: 사전행사 %d개 (%s ~) / 본행사 %d개 (%s ~)\n\n"
        "const PROMO_CONFIG = {\n"
        "  season: %s,\n"
        "  preStart: \"%s\",   // 이 날부터 사전행사(eventPre) 적용\n"
        "  mainStart: \"%s\",  // 이 날부터 본행사(eventMain) 적용\n"
        "  preNote: %s,\n"
        "  catalogSearch: %s,  // 카탈로그 검색 주소 (뒤에 상품코드가 붙는다)\n"
        "  catalogImage: %s,  // 상품 사진 주소 (뒤에 <상품코드>.webp 가 붙는다)\n"
        "  catalogIcons: %s   // 안내 아이콘 주소 (뒤에 <번호>.png 가 붙는다)\n"
        "};\n\n"
        % (season, source_desc, len(catalog), len(market),
           n_pre, pre_start, n_main, main_start,
           json.dumps(season, ensure_ascii=False),
           pre_start, main_start, json.dumps(pre_note, ensure_ascii=False),
           json.dumps(catalog_search_url(source_desc), ensure_ascii=False),
           json.dumps(catalog_image_url(source_desc), ensure_ascii=False),
           json.dumps(catalog_icon_url(source_desc), ensure_ascii=False))
    )
    # 저장소가 CRLF 로 보관돼 있다. LF 로 쓰면 줄바꿈만 바뀐 거대한 diff 가 생긴다.
    with io.open(PRODUCTS_JS, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(header
                + categories_block(categories)
                + "const PRODUCTS_DATA = {\n" + ",\n".join(entries) + "\n};\n")
    return market, n_pre, n_main, conflicts


def categories_block(categories):
    """분류 이름표를 products.js 에 적는다.

    이름을 못 가져왔으면 null 로 둔다. 화면은 그때 "분류 3" 처럼 번호로
    보여 준다 - 지어낸 이름을 보여 주면 점원이 엉뚱한 묶음을 뒤진다.
    """
    if not categories:
        return ("// 분류 이름을 가져오지 못했습니다. 화면에는 번호로 표시됩니다.\n"
                "const CATEGORIES = null;\n\n")

    pre, main = categories

    def rows(items):
        return ",\n".join(
            '    { "id": %d, "label": %s }' % (num, json.dumps(label, ensure_ascii=False))
            for num, label in items)

    return ("// 카탈로그 목록의 분류 (카탈로그 사이트에서 가져옴)\n"
            "const CATEGORIES = {\n"
            "  pre: [\n%s\n  ],\n"
            "  main: [\n%s\n  ]\n"
            "};\n\n" % (rows(pre), rows(main)))


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
    ap.add_argument("--config", default=SETTINGS_TXT,
                    help="관리자 설정 파일 (기본: 시즌설정.txt)")
    ap.add_argument("--allow-unknown-benefits", action="store_true",
                    help="처음 보는 구매혜택 아이콘이 있어도 계속 진행")
    ap.add_argument("--skip-barcodes", action="store_true",
                    help="바코드 이미지는 건드리지 않고 products.js 만 다시 만든다")
    args = ap.parse_args()

    if migrate_old_json(SEASON_JSON, args.config):
        print("   예전 season.json 의 설정을 %s 로 옮겼습니다."
              % os.path.basename(args.config))

    print("0) 설정 읽는 중: %s" % os.path.basename(args.config))
    cfg = load_settings(args.config)
    pdf_path = cfg["pdf"] if os.path.isabs(cfg["pdf"]) else os.path.join(REPO, cfg["pdf"])
    if not os.path.exists(pdf_path):
        sys.exit("[!] 바코드 PDF가 없습니다: %s\n"
                 "    %s 의 '바코드 PDF' 줄과 BarcodeSource/ 에 올린 파일 이름이 같은지 확인하세요."
                 % (cfg["pdf"], os.path.basename(args.config)))
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
                 "    시즌설정.txt 의 '카탈로그 주소'가 맞는지, 브라우저에서 열리는지 확인하세요." % e)
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

    print("4) 구매혜택 아이콘 확인 (그림 지문 대조)")
    root = cfg["catalog"].rsplit("/", 1)[0]
    used = scan_benefits(catalog)
    memory = load_benefit_memory(SEASON_JSON)
    resolved, notes, unknown = resolve_benefits(
        used, memory, cfg["benefit_overrides"], root)
    for line in notes:
        print("   %s" % line)
    print("   사용된 아이콘 %d개 / 알아낸 것 %d개 (그 중 행사 %d개)"
          % (len(used), len(resolved),
             len([r for r in resolved.values() if r != "없음"])))

    if unknown:
        setting_name = os.path.basename(args.config)
        print("   [!] 확인이 필요한 아이콘 %d개" % len(unknown))
        for n, why, hint in unknown:
            print("       %d번 - %s" % (n, why))
            print("            %s/icons/benefit_%d.png" % (root, n))
            if hint:
                print("            %s" % hint)
        sheet = save_unknown_icon_sheet(cfg["catalog"], [n for n, _, _ in unknown])
        if sheet:
            print("   모아 놓은 그림: %s" % os.path.basename(sheet))
        print("   그림을 보고 %s 아래쪽에 한 줄씩 추가한 뒤 다시 실행하세요." % setting_name)
        for n, _, _ in unknown:
            print("       구매혜택 %d: 2+1        <- 덤을 주면 비율, 아니면 '없음'" % n)
        if not args.allow_unknown_benefits:
            print("   행사를 잘못 넣으면 실제 배송 수량이 틀어지므로 여기서 멈춥니다.")
            return 1
        print("   [!] --allow-unknown-benefits 로 계속합니다 (모르는 아이콘은 '없음' 처리).")

    BENEFIT_PROMO = {n: r for n, r in resolved.items() if r != "없음"}
    BENEFIT_OTHER = set(n for n, r in resolved.items() if r == "없음")

    # 이번에 알아낸 내용을 기억에 반영한다 (다음 시즌 자동 인계용).
    # 쓰이지 않은 옛 번호도 그대로 남겨 둔다 - 그림이 돌아올 수 있다.
    for n, rate in resolved.items():
        exact, rough = icon_fingerprint(root, n)
        prev = memory.get(n, {})
        memory[n] = {
            "행사": rate,
            "지문": exact or prev.get("지문", ""),
            "대략": rough or prev.get("대략", ""),
        }
    save_benefit_memory(SEASON_JSON, memory, cfg["season"])

    print("5) products.js / store.js 생성")
    categories, cat_error = load_categories(cfg["catalog"])
    if cat_error:
        print("   [!] 분류 이름을 가져오지 못했습니다: %s" % cat_error)
        print("       상품 데이터는 정상입니다. 목록 화면에만 이름 대신 번호가 나옵니다.")
    else:
        print("   분류: 사전행사 %d개 / 본행사 %d개"
              % (len(categories[0]), len(categories[1])))
        known = set(n for n, _ in categories[1])
        missing = sorted(set(r["sort"] for r in catalog
                             if isinstance(r.get("sort"), int)) - known)
        if missing:
            print("   [!] 이름이 없는 분류 번호: %s" % missing)

    market, n_pre, n_main, conflicts = write_products_js(
        catalog, cfg["season"], cfg["catalog"],
        cfg["pre_start"], cfg["main_start"], cfg["pre_note"], categories)
    write_store_js(cfg["store"], cfg["season"])
    print("   상품 %d개, 시세반영 %d개 %s" % (len(catalog), len(market), market))
    print("   행사: 사전행사 %d개 (%s ~) / 본행사 %d개 (%s ~)"
          % (n_pre, cfg["pre_start"], n_main, cfg["main_start"]))
    if conflicts:
        print("   [!] 한 상품에 행사 아이콘이 여러 개: %s" % conflicts[:10])
    odd_pictures = check_picture_names(catalog)
    if odd_pictures:
        print("   [!] 사진 이름이 <상품코드>.webp 가 아닌 상품 %d개: %s"
              % (len(odd_pictures), odd_pictures[:10]))
        print("       상세 창에 사진이 안 나오거나 다른 상품 사진이 나옵니다.")
        print("       tools/update_season.py 의 catalog_image_url() 을 고쳐야 합니다.")

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
