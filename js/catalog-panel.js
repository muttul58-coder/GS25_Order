// ========================================
// 상품 찾기 패널 (order_split.html)
// ========================================

/**
 * 왼쪽에서 상품을 찾아 오른쪽 주문서에 담는 화면.
 *
 * 주문서는 iframe 으로 order_form.html 을 그대로 띄운다. 같은 사이트라서
 * 안쪽 함수를 그대로 부를 수 있고, 주문서를 복사해 두 벌로 만들지 않아도 된다.
 *
 * ★ 담기 버튼은 계산을 직접 하지 않는다. 상품코드 칸에 코드를 넣고
 *   blur 이벤트를 보내면, 점원이 손으로 입력했을 때와 똑같은 경로로
 *   상품명·단가·행사·지급수량·금액·바코드가 채워진다. 여기서 다시 구현하면
 *   언젠가 한쪽만 고쳐져서 두 화면이 다른 값을 말하게 된다.
 */

const CARDS_PER_PAGE = 30;

let catalogMatches = [];   // 현재 검색 결과 (코드 배열)
let catalogShown = 0;      // 그중 화면에 그린 개수
let catalogToastTimer = null;
let catalogCategory = null; // 고른 분류 {kind:'main'|'pre', id, label} 또는 null

/**
 * 주문서 iframe 의 window. 아직 안 떴으면 null.
 * @returns {Window|null}
 */
function orderWindow() {
    const frame = document.getElementById('orderFrame');
    try {
        return (frame && frame.contentWindow && frame.contentWindow.document.readyState !== 'loading')
            ? frame.contentWindow : null;
    } catch (e) {
        return null;
    }
}

/**
 * 검색어에 맞는 상품코드 목록.
 *
 * 상품명·상품코드·구성 설명을 모두 본다. 점원이 "한우"로도 찾고
 * "1005"처럼 코드 숫자로도 찾기 때문이다.
 *
 * @param {string} query
 * @returns {string[]} 상품코드 배열 (코드순)
 */
function searchProducts(query) {
    if (typeof PRODUCTS_DATA === 'undefined' || !PRODUCTS_DATA) return [];

    let codes = Object.keys(PRODUCTS_DATA).sort(compareProductCodes);

    // 분류를 골랐으면 먼저 그 안으로 좁힌다 (검색어와 함께 걸 수 있다)
    if (catalogCategory) {
        codes = codes.filter(function (code) {
            return inCategory(PRODUCTS_DATA[code], catalogCategory);
        });
    }

    const q = query.trim().toLowerCase();
    if (!q) return codes;

    // 숫자만 입력한 경우 하이픈을 무시하고 코드와 맞춰 본다 (1005 → 10-05)
    const digits = q.replace(/[^0-9]/g, '');

    return codes.filter(function (code) {
        const info = PRODUCTS_DATA[code];
        if (code.toLowerCase().indexOf(q) !== -1) return true;
        if (digits && code.replace('-', '').indexOf(digits) !== -1) return true;
        if (info.name && info.name.toLowerCase().indexOf(q) !== -1) return true;
        if (info.desc && info.desc.toLowerCase().indexOf(q) !== -1) return true;
        return false;
    });
}

/**
 * 이 상품이 그 분류에 들어 있는가
 * @param {object} info - PRODUCTS_DATA 항목
 * @param {{kind: string, id: number}} category
 */
function inCategory(info, category) {
    if (category.kind === 'pre') {
        return Array.isArray(info.preCat) && info.preCat.indexOf(category.id) !== -1;
    }
    return info.cat === category.id;
}

/**
 * 분류 목록. 카탈로그에서 이름을 못 가져온 시즌이면 번호로 만든다.
 *
 * 이름을 지어내지 않는 이유: 틀린 이름은 점원을 엉뚱한 묶음으로 보낸다.
 * "분류 3" 은 불친절하지만 거짓말은 아니다.
 *
 * @param {'main'|'pre'} kind
 * @returns {{id: number, label: string, count: number}[]}
 */
function categoryList(kind) {
    const table = (typeof CATEGORIES !== 'undefined' && CATEGORIES) ? CATEGORIES[kind] : null;
    const counts = {};

    Object.keys(PRODUCTS_DATA).forEach(function (code) {
        const info = PRODUCTS_DATA[code];
        const ids = (kind === 'pre')
            ? (Array.isArray(info.preCat) ? info.preCat : [])
            : (info.cat ? [info.cat] : []);
        ids.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    });

    if (table) {
        return table
            .filter(function (row) { return counts[row.id]; })
            .map(function (row) {
                return { id: row.id, label: row.label, count: counts[row.id] };
            });
    }

    return Object.keys(counts).map(Number).sort(function (a, b) { return a - b; })
        .map(function (id) {
            return { id: id, label: '분류 ' + id, count: counts[id] };
        });
}

/**
 * 상품코드 정렬 (08-01 < 08-02 < 10-01 < 106-01)
 */
function compareProductCodes(a, b) {
    const pa = a.split('-');
    const pb = b.split('-');
    const d = parseInt(pa[0], 10) - parseInt(pb[0], 10);
    if (d !== 0) return d;
    return parseInt(pa[1], 10) - parseInt(pb[1], 10);
}

/**
 * 카탈로그의 분류 목록 화면. 상품 대신 분류를 나열한다.
 *
 * 코드를 모르는 채로 "무슨 세트가 있나" 훑을 때 쓴다. 카탈로그 사이트의
 * 목록 페이지와 같은 묶음·같은 순서다.
 */
function showCategoryIndex() {
    const list = document.getElementById('catalogList');
    const count = document.getElementById('catalogCount');
    list.innerHTML = '';
    if (count) count.textContent = '분류를 고르세요';

    const cfg = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG) ? PROMO_CONFIG : {};

    const n = appendCategoryGroup(list, 'pre',
        '사전행사 (' + (cfg.preStart || '') + ' ~ ' + shiftBefore(cfg.mainStart) + ')')
        + appendCategoryGroup(list, 'main',
        '본행사 (' + (cfg.mainStart || '') + ' ~)');

    // 카탈로그가 분류 정보를 안 주는 시즌이면 여기가 텅 빈다.
    // 빈 화면으로 두면 점원이 고장인 줄 알고 멈춘다 - 검색은 멀쩡하다고 알려 준다.
    if (!n) {
        list.innerHTML = '<div class="catalog-empty">'
            + '이번 시즌 카탈로그에는 분류 정보가 없습니다.<br>'
            + '위 검색창으로 상품 이름이나 코드를 찾아 주세요.</div>';
        const count = document.getElementById('catalogCount');
        if (count) count.textContent = '분류 정보 없음';
    }

    updateCategoryButton();
}

/**
 * 본행사 시작 하루 전 (사전행사 마지막 날). 날짜가 없으면 빈 문자열.
 */
function shiftBefore(date) {
    if (!date || typeof shiftDate !== 'function') return '';
    return shiftDate(date, -1);
}

/**
 * 분류 한 묶음을 그린다
 * @returns {number} 그린 분류 개수
 */
function appendCategoryGroup(list, kind, title) {
    const rows = categoryList(kind);
    if (!rows.length) return 0;

    const head = document.createElement('div');
    head.className = 'cat-group';
    head.textContent = title;
    list.appendChild(head);

    rows.forEach(function (row) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'cat-item';

        const label = document.createElement('span');
        label.textContent = row.label;
        item.appendChild(label);

        const n = document.createElement('span');
        n.className = 'cat-count';
        n.textContent = row.count + '개';
        item.appendChild(n);

        item.onclick = function () {
            pickCategory(kind, row.id, row.label);
        };
        list.appendChild(item);
    });

    return rows.length;
}

/**
 * 분류를 골라 그 안의 상품만 본다
 */
function pickCategory(kind, id, label) {
    catalogCategory = { kind: kind, id: id, label: label };
    runSearch();
    document.getElementById('catalogList').scrollTop = 0;
}

/**
 * 분류 선택을 풀고 전체로 돌아간다
 */
function clearCategory() {
    catalogCategory = null;
    runSearch();
}

/**
 * 분류 버튼 눌렀을 때: 목록 화면 열기 / 이미 분류 안이면 해제
 */
function toggleCategoryIndex() {
    if (catalogCategory) {
        clearCategory();
    } else {
        showCategoryIndex();
    }
}

function updateCategoryButton() {
    const btn = document.getElementById('catalogCatBtn');
    if (btn) btn.textContent = catalogCategory ? '분류 해제' : '분류 목록';
}

/**
 * 검색 실행 후 목록을 처음부터 다시 그린다
 */
function runSearch() {
    const input = document.getElementById('catalogQuery');
    catalogMatches = searchProducts(input ? input.value : '');
    catalogShown = 0;

    const list = document.getElementById('catalogList');
    list.innerHTML = '';

    const count = document.getElementById('catalogCount');
    if (count) {
        count.innerHTML = '';
        if (catalogCategory) {
            const tag = document.createElement('button');
            tag.type = 'button';
            tag.className = 'cat-tag';
            tag.textContent = catalogCategory.label + ' ✕';
            tag.title = '분류 선택 해제';
            tag.onclick = clearCategory;
            count.appendChild(tag);
        }
        const text = document.createElement('span');
        text.textContent = catalogMatches.length
            ? `상품 ${catalogMatches.length}개`
            : '찾는 상품이 없습니다';
        count.appendChild(text);
    }

    updateCategoryButton();

    if (!catalogMatches.length) {
        list.innerHTML = '<div class="catalog-empty">'
            + '검색 결과가 없습니다.<br>'
            + '상품 이름의 일부나 상품코드로 찾아보세요. (예: 한우, 1005)</div>';
        return;
    }

    showMoreCards();
}

/**
 * 다음 묶음을 그린다. 601개를 한 번에 그리면 폰에서 버벅인다.
 */
function showMoreCards() {
    const list = document.getElementById('catalogList');
    const oldMore = document.getElementById('catalogMore');
    if (oldMore) oldMore.remove();

    const end = Math.min(catalogShown + CARDS_PER_PAGE, catalogMatches.length);
    for (let i = catalogShown; i < end; i++) {
        list.appendChild(buildCard(catalogMatches[i]));
    }
    catalogShown = end;

    if (catalogShown < catalogMatches.length) {
        const more = document.createElement('button');
        more.id = 'catalogMore';
        more.type = 'button';
        more.className = 'catalog-more';
        more.textContent = `더 보기 (남은 ${catalogMatches.length - catalogShown}개)`;
        more.onclick = showMoreCards;
        list.appendChild(more);
    }
}

/**
 * 상품 카드 하나
 * @param {string} code
 * @returns {HTMLElement}
 */
function buildCard(code) {
    const info = PRODUCTS_DATA[code];
    const cfg = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG) ? PROMO_CONFIG : {};
    const applicable = getApplicableEvent(info);

    const card = document.createElement('div');
    card.className = 'product-card';

    if (cfg.catalogImage) {
        const img = document.createElement('img');
        img.className = 'thumb';
        img.loading = 'lazy';
        img.alt = '';
        img.onerror = function () { this.style.visibility = 'hidden'; };
        img.src = cfg.catalogImage + encodeURIComponent(code) + '.webp';
        card.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'body';

    const codeEl = document.createElement('span');
    codeEl.className = 'code';
    codeEl.textContent = code;
    body.appendChild(codeEl);

    const name = document.createElement('div');
    name.className = 'name';
    // 상품명은 카탈로그에서 온 남의 글이다. HTML 로 넣지 않는다.
    name.textContent = info.name;
    body.appendChild(name);

    const priceLine = document.createElement('div');
    if (info.marketPrice) {
        const m = document.createElement('span');
        m.className = 'market';
        m.textContent = '시세반영';
        priceLine.appendChild(m);
    } else {
        const p = document.createElement('span');
        p.className = 'price';
        p.textContent = formatNumberWithCommas(info.price) + '원';
        priceLine.appendChild(p);
    }
    if (applicable.event) {
        const e = document.createElement('span');
        e.className = 'event';
        e.textContent = applicable.event;
        priceLine.appendChild(e);
    }
    body.appendChild(priceLine);

    if (info.desc) {
        const d = document.createElement('div');
        d.className = 'desc';
        d.textContent = info.desc;
        body.appendChild(d);
    }

    card.appendChild(body);

    const buttons = document.createElement('div');
    buttons.className = 'card-buttons';

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn-add';
    add.textContent = '담기';
    add.onclick = function () { addToOrder(code); };
    buttons.appendChild(add);

    const detail = document.createElement('button');
    detail.type = 'button';
    detail.className = 'btn-detail';
    detail.textContent = '상세';
    detail.onclick = function () { openDetail(code); };
    buttons.appendChild(detail);

    card.appendChild(buttons);
    return card;
}

/**
 * 상세 창 (주문서의 바코드를 누른 것과 같은 창)
 */
function openDetail(code) {
    const url = 'product_detail.html?code=' + encodeURIComponent(code);
    if (typeof openCatalogPopup === 'function' && openCatalogPopup(url)) return;
    window.open(url, '_blank', 'noopener');
}

/**
 * 상품을 주문서에 담는다.
 *
 * 마지막 행이 비어 있으면 거기에, 아니면 새 행을 만들어 넣는다.
 * 새 행 만들기는 주문서의 addProductRow() 를 그대로 부른다 - 수량·단가가
 * 빠진 채로 다음 상품을 담는 것을 막는 검사가 그 안에 들어 있다.
 *
 * @param {string} code
 */
function addToOrder(code) {
    const win = orderWindow();
    if (!win) {
        panelToast('주문서가 아직 준비되지 않았습니다. 잠시 후 다시 눌러주세요.', 'warning');
        return;
    }

    const doc = win.document;
    const rows = Array.prototype.slice.call(doc.querySelectorAll('.product-row'));
    if (!rows.length) {
        panelToast('주문서에서 상품 표를 찾지 못했습니다.', 'error');
        return;
    }

    // 이미 담긴 상품이면 새로 넣지 않는다. 조용히 수량을 바꾸면
    // 점원이 모르는 사이에 주문 수량이 늘어난다.
    const already = rows.find(function (row) {
        const el = row.querySelector('.product-code');
        return el && el.value.trim() === code;
    });
    if (already) {
        const qty = already.querySelector('.quantity');
        const no = already.querySelector('.row-number');
        flashRow(win, already);
        if (qty) qty.focus();
        panelToast(`이미 ${no ? no.textContent : ''}번에 담긴 상품입니다. 수량을 조정해 주세요.`, 'warning');
        return;
    }

    let target = rows[rows.length - 1];
    const lastCode = target.querySelector('.product-code');

    if (lastCode && lastCode.value.trim()) {
        // 마지막 행이 미완성이면 addProductRow() 가 거절한다.
        // 그 안내는 주문서 쪽에 뜨는데, 폰에서는 패널에 가려 안 보일 수 있다.
        const missing = missingFieldOf(target);
        if (missing) {
            flashRow(win, target);
            missing.field.focus();
            panelToast(missing.message, 'warning');
            return;
        }

        win.addProductRow();
        const after = doc.querySelectorAll('.product-row');
        target = after[after.length - 1];
    }

    const input = target.querySelector('.product-code');
    input.value = code;
    // 주문서의 자동완성은 blur/Enter 에서 돈다. 같은 길로 보낸다.
    input.dispatchEvent(new win.Event('blur', { bubbles: true }));

    flashRow(win, target);

    const info = PRODUCTS_DATA[code];
    panelToast(`${code} ${info ? info.name : ''} 담았습니다.`
        + (info && info.marketPrice ? ' 시세(단가)를 입력해 주세요.' : ''),
        info && info.marketPrice ? 'warning' : 'success');

    // 폰에서는 패널이 주문서를 덮고 있다. 담은 결과를 봐야 하므로 닫는다.
    if (isNarrowScreen()) closeCatalog();
}

/**
 * 행에서 비어 있는 필수 항목 찾기 (주문서 addProductRow 의 검사와 같은 순서)
 * @returns {{field: HTMLElement, message: string}|null}
 */
function missingFieldOf(row) {
    const quantity = row.querySelector('.quantity');
    const unitPrice = row.querySelector('.unit-price');
    const name = row.querySelector('.product-name');
    const label = name && name.value ? name.value : row.querySelector('.product-code').value;

    if (!quantity.value || parseInt(quantity.value, 10) <= 0) {
        return { field: quantity, message: `먼저 "${label}" 의 수량을 입력해 주세요.` };
    }
    if (!unitPrice.value || parseInt(unitPrice.value.replace(/[^0-9]/g, ''), 10) <= 0) {
        return { field: unitPrice, message: `먼저 "${label}" 의 단가를 입력해 주세요. (시세반영 상품입니다)` };
    }
    return null;
}

/**
 * 방금 담긴 행을 잠깐 표시해 준다. 표가 길면 어디에 들어갔는지 안 보인다.
 */
function flashRow(win, row) {
    try {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (e) {
        row.scrollIntoView();
    }
    const before = row.style.backgroundColor;
    row.style.transition = 'background-color 0.4s';
    row.style.backgroundColor = '#ccfbf1';
    win.setTimeout(function () { row.style.backgroundColor = before; }, 1200);
}

/**
 * 패널 안쪽 알림. 주문서 안의 알림은 폰에서 패널에 가려 안 보인다.
 */
function panelToast(message, type) {
    const old = document.getElementById('panelToast');
    if (old) old.remove();
    if (catalogToastTimer) clearTimeout(catalogToastTimer);

    const toast = document.createElement('div');
    toast.id = 'panelToast';
    toast.className = 'panel-toast' + (type && type !== 'success' ? ' ' + type : '');
    toast.textContent = message;
    document.querySelector('.catalog').appendChild(toast);

    catalogToastTimer = setTimeout(function () { toast.remove(); }, 3500);
}

// ========================================
// 폰: 패널 여닫기
// ========================================

function isNarrowScreen() {
    return window.matchMedia('(max-width: 900px)').matches;
}

function openCatalog() {
    document.querySelector('.catalog').classList.add('open');

    if (!document.getElementById('catalogBackdrop')) {
        const back = document.createElement('div');
        back.id = 'catalogBackdrop';
        back.className = 'catalog-backdrop';
        back.onclick = closeCatalog;
        document.body.appendChild(back);
    }

    const input = document.getElementById('catalogQuery');
    if (input) input.focus();
}

function closeCatalog() {
    document.querySelector('.catalog').classList.remove('open');
    const back = document.getElementById('catalogBackdrop');
    if (back) back.remove();
}

function toggleCatalog() {
    if (document.querySelector('.catalog').classList.contains('open')) {
        closeCatalog();
    } else {
        openCatalog();
    }
}

// ========================================
// 시작
// ========================================

function initCatalogPanel() {
    const cfg = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG) ? PROMO_CONFIG : {};
    const season = document.getElementById('catalogSeason');
    if (season) season.textContent = cfg.season || '';

    // 테스트 모드가 켜져 있으면 여기에도 띠를 그린다.
    // 패널의 행사 표시도 그 기준 날짜를 따르기 때문이다.
    if (typeof initAdminTestMode === 'function') initAdminTestMode();

    // 주문서(iframe)와 이 화면은 따로 뜬다. 주소의 ?test= 로 테스트 모드를
    // 켜는 순간, 주문서가 이미 다 떠 있었다면 그쪽에는 띠가 없다.
    // 늦게 뜨든 먼저 뜨든 같은 화면이 되도록 뜬 뒤에 한 번 더 맞춘다.
    const frame = document.getElementById('orderFrame');
    if (frame) {
        frame.addEventListener('load', function () {
            try {
                if (typeof frame.contentWindow.renderTestBanner === 'function') {
                    frame.contentWindow.renderTestBanner();
                }
            } catch (e) { /* 접근이 막히면 그냥 둔다 */ }
        });
    }

    const input = document.getElementById('catalogQuery');
    let timer = null;
    input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(runSearch, 150);
    });
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(timer);
            runSearch();
        }
    });

    runSearch();
}

document.addEventListener('DOMContentLoaded', initCatalogPanel);
