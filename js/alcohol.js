// ========================================
// 주류 배송 불가 처리
// ========================================
//
// 주류는 택배로 보낼 수 없다. 손님이 매장에서 직접 받아 가야 한다.
// 그래서 주류는 배송 상품 배분에서 아예 빠지고, 주문한 상품이 전부 주류이면
// 배송 정보 자체를 받지 않고 안내 문구로 대치한다.
//
// **판별은 카탈로그 분류의 '이름'으로 한다. 번호로 하지 않는다.**
// 분류 번호는 시즌마다 다시 매겨진다 (2026 추석은 10=양주/와인, 11=소주/전통주).
// 번호를 코드에 적어 두면 다음 시즌에 조용히 엉뚱한 분류가 주류가 되고,
// 그 순간 이 화면은 "배송되는 술"과 "배송 안 되는 통조림"을 만들어 낸다.
//
// order_form.html / order_split.html / product_detail.html 세 화면이 모두 읽는다.
// 화면마다 따로 판단하면 같은 상품을 놓고 서로 다른 말을 하게 된다.

const ALCOHOL_LABEL_PATTERN = /양주|와인|위스키|소주|전통주|증류주|막걸리|약주|청주|사케|맥주|주류/;

let alcoholCategoryCache = null;

/**
 * 주류로 볼 분류 번호를 정한다
 *
 * 1순위는 시즌 갱신이 확정해 준 `PROMO_CONFIG.noDeliveryCats` 다
 * (`tools/update_season.py`). 갱신은 이 값을 정하지 못하면 아예 멈추므로,
 * 값이 있다는 것은 사람이 한 번 확인했다는 뜻이다. 관리자가 `시즌설정.txt` 의
 * `배송 불가 분류` 줄로 직접 정할 수도 있고, 그 값이 여기로 그대로 온다.
 *
 * 2순위(아래 이름 맞추기)는 그 값이 아직 없는 products.js — 즉 이 기능이
 * 생기기 전에 만들어진 파일 — 를 위한 대비책이다. 다음 갱신부터는 쓰이지 않는다.
 *
 * @returns {{main: Set, pre: Set, labels: Array, known: boolean, source: string}}
 *          known 이 false 면 판별이 불가능한 상태다
 */
function alcoholCategories() {
    if (alcoholCategoryCache) return alcoholCategoryCache;

    const cfg = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG) ? PROMO_CONFIG : {};
    if (cfg.noDeliveryCats) {
        // 비어 있어도(= 술이 없는 시즌) 확정된 값이다. known 은 true 다.
        alcoholCategoryCache = {
            main: new Set(cfg.noDeliveryCats.main || []),
            pre: new Set(cfg.noDeliveryCats.pre || []),
            labels: (cfg.noDeliveryLabels || []).slice(),
            known: true,
            source: '시즌 갱신'
        };
        return alcoholCategoryCache;
    }

    const cats = (typeof CATEGORIES !== 'undefined' && CATEGORIES) ? CATEGORIES : null;
    const labels = [];
    const pick = function (list) {
        const ids = new Set();
        (list || []).forEach(function (c) {
            if (c && ALCOHOL_LABEL_PATTERN.test(c.label || '')) {
                ids.add(c.id);
                if (labels.indexOf(c.label) === -1) labels.push(c.label);
            }
        });
        return ids;
    };

    alcoholCategoryCache = {
        main: pick(cats && cats.main),
        pre: pick(cats && cats.pre),
        labels: labels,
        known: !!cats,
        source: '분류 이름'
    };

    if (!alcoholCategoryCache.known) {
        // 시즌 갱신 때 카탈로그의 분류 이름 긁기가 실패하면 CATEGORIES 가 null 이 된다.
        // 그러면 주류를 가려낼 방법이 없다. 조용히 넘어가면 주류가 배송 가능한
        // 상품으로 섞여 들어가므로 최소한 흔적은 남긴다. (관리자 홈에도 표시된다)
        console.error('[주류] 카탈로그 분류 이름(CATEGORIES)이 없어 주류를 가려낼 수 없습니다. 배송 불가 안내가 표시되지 않습니다.');
    }
    return alcoholCategoryCache;
}

/**
 * 상품 정보가 주류인지
 * @param {Object} info - PRODUCTS_DATA 항목
 * @returns {boolean}
 */
function isAlcoholInfo(info) {
    if (!info) return false;
    const cats = alcoholCategories();
    if (info.cat !== undefined && cats.main.has(info.cat)) return true;
    if (info.preCat !== undefined && cats.pre.has(info.preCat)) return true;
    return false;
}

/**
 * 상품코드가 주류인지
 * @param {string} code - 상품 코드 (예: "53-01")
 * @returns {boolean}
 */
function isAlcoholCode(code) {
    if (!code) return false;
    if (typeof PRODUCTS_DATA === 'undefined' || !PRODUCTS_DATA) return false;
    return isAlcoholInfo(PRODUCTS_DATA[code]);
}

/**
 * 카탈로그 전체의 주류 품목 수 (관리자 홈에서 "정상"인지 확인하는 용도)
 * @returns {number}
 */
function countAlcoholProducts() {
    if (typeof PRODUCTS_DATA === 'undefined' || !PRODUCTS_DATA) return 0;
    return Object.keys(PRODUCTS_DATA).filter(function (code) {
        return isAlcoholInfo(PRODUCTS_DATA[code]);
    }).length;
}

// ========================================
// 주문서 화면 (order_form.html 전용)
// ========================================

/**
 * 주문 상품 행을 훑어 주류 / 배송 가능 상품으로 나눈다
 *
 * 수량은 지급 수량(덤 포함) 기준이다. 배송 정보와 같은 기준으로 세지 않으면
 * 안내에 적힌 개수와 배송 상품 칸의 개수가 서로 달라진다.
 *
 * @returns {{alcohol: Array, deliverable: Array}} 각 항목 {code, name, qty}
 */
function scanOrderForAlcohol() {
    const empty = { alcohol: [], deliverable: [] };
    const tbody = document.getElementById('productTableBody');
    if (!tbody) return empty;

    const alcohol = new Map();
    const deliverable = new Map();

    tbody.querySelectorAll('.product-row').forEach(function (row) {
        const codeInput = row.querySelector('.product-code');
        const nameInput = row.querySelector('.product-name');
        if (!codeInput || !nameInput) return;

        const code = codeInput.value.trim();
        const name = nameInput.value.trim();
        // 이름이 비어 있으면 아직 조회되지 않은 행이다 (오타 포함)
        if (!code || !name) return;

        const bucket = isAlcoholCode(code) ? alcohol : deliverable;
        const qty = (typeof getRowGivenQuantity === 'function') ? getRowGivenQuantity(row) : 0;
        if (bucket.has(code)) {
            bucket.get(code).qty += qty;
        } else {
            bucket.set(code, { code: code, name: name, qty: qty });
        }
    });

    return {
        alcohol: Array.from(alcohol.values()),
        deliverable: Array.from(deliverable.values())
    };
}

/**
 * 주문한 상품이 전부 주류인가
 *
 * 이 때만 배송 정보를 통째로 안내 문구로 대치한다. 한 개라도 배송 가능한
 * 상품이 있으면 그 상품은 어딘가로 보내야 하므로 배송 정보 칸이 필요하다.
 * @returns {boolean}
 */
function isAlcoholOnlyOrder() {
    const scan = scanOrderForAlcohol();
    return scan.alcohol.length > 0 && scan.deliverable.length === 0;
}

/**
 * 주류 행에 표시를 붙이고 뗀다 (인쇄물에도 남는다)
 */
function markAlcoholRows() {
    const tbody = document.getElementById('productTableBody');
    if (!tbody) return;

    tbody.querySelectorAll('.product-row').forEach(function (row) {
        const codeInput = row.querySelector('.product-code');
        const nameInput = row.querySelector('.product-name');
        if (!codeInput || !nameInput) return;

        const isAlcohol = !!codeInput.value.trim() && !!nameInput.value.trim()
            && isAlcoholCode(codeInput.value.trim());
        row.classList.toggle('alcohol-row', isAlcohol);

        const cell = nameInput.parentElement;
        let badge = cell.querySelector('.alcohol-badge');
        if (isAlcohol && !badge) {
            badge = document.createElement('span');
            badge.className = 'alcohol-badge';
            badge.textContent = '🚫 배송불가 · 매장수령';
            cell.appendChild(badge);
        } else if (!isAlcohol && badge) {
            badge.remove();
        }
    });
}

/**
 * 주류 안내를 다시 그린다
 *
 * 상품이 바뀔 때마다 호출된다 (상품코드 조회 / 행 삭제 / 수량·행사 변경).
 * 상품이 전부 주류이면 배송 정보 영역을 숨기고 안내가 그 자리를 대신한다.
 *
 * @returns {boolean} 배송 정보를 감췄으면 true
 */
function updateAlcoholNotice() {
    markAlcoholRows();

    const scan = scanOrderForAlcohol();
    const onlyAlcohol = scan.alcohol.length > 0 && scan.deliverable.length === 0;

    const container = document.getElementById('orderSectionsContainer');
    const addSectionBtn = document.querySelector('.add-section-btn');
    if (container) container.style.display = onlyAlcohol ? 'none' : '';
    if (addSectionBtn) addSectionBtn.style.display = onlyAlcohol ? 'none' : '';

    const notice = document.getElementById('alcoholNotice');
    if (!notice) return onlyAlcohol;

    if (scan.alcohol.length === 0) {
        // 클래스도 되돌린다. 남겨 두면 다음에 띄울 때 이전 모양으로 잠깐 그려진다
        notice.className = 'alcohol-notice';
        notice.style.display = 'none';
        notice.textContent = '';
        return false;
    }

    notice.className = 'alcohol-notice' + (onlyAlcohol ? ' alcohol-notice-only' : '');
    notice.style.display = '';
    notice.textContent = '';

    const title = document.createElement('div');
    title.className = 'alcohol-notice-title';
    title.textContent = onlyAlcohol
        ? '🚫 주류는 택배 배송이 되지 않습니다'
        : '🚫 아래 주류는 택배 배송이 되지 않습니다';
    notice.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'alcohol-notice-list';
    scan.alcohol.forEach(function (p) {
        const li = document.createElement('li');
        const code = document.createElement('span');
        code.className = 'code';
        code.textContent = p.code;
        li.appendChild(code);
        // 상품이름은 카탈로그에서 온 남의 글이다. HTML 로 넣지 않는다.
        li.appendChild(document.createTextNode(
            ' ' + p.name + (p.qty > 0 ? ' · ' + p.qty + '개' : '')));
        list.appendChild(li);
    });
    notice.appendChild(list);

    const help = document.createElement('div');
    help.className = 'alcohol-notice-help';
    help.textContent = onlyAlcohol
        ? '주문하신 상품이 모두 주류라 배송 정보를 받지 않습니다. 손님께 매장 수령을 안내해 주세요.'
        : '주류는 배송 상품 목록에 나오지 않습니다. 매장 수령으로 안내하시고, 나머지 상품만 배송 정보에 배분해 주세요.';
    notice.appendChild(help);

    return onlyAlcohol;
}
