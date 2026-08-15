// ========================================
// 관리자 테스트 모드 - 행사 기간을 미리 보기
// ========================================

/**
 * 카탈로그는 상품마다 사전행사와 본행사 비율이 다르다. 2026 추석 기준으로
 * 601개 중 289개가 서로 다르고, 167개는 본행사(9/5)에야 행사가 켜진다.
 * 그때까지 "본행사 때 화면이 어떻게 보이는지" 확인할 방법이 없으면
 * 정작 9월 5일 아침에야 문제를 발견하게 된다.
 *
 * 그래서 행사 판정에 쓰는 '기준 날짜'만 바꿔서 미리 볼 수 있게 한다.
 *
 * ★ 바꾸는 것은 행사 자동 선택에 쓰는 날짜뿐이다. 주문 일시와 배송 희망일은
 *   실제 날짜 그대로 둔다 - 주문서에 가짜 날짜가 찍히면 안 된다.
 *
 * 안전 장치 (테스트 모드가 점원 화면에 남으면 엉뚱한 수량을 약속하게 된다)
 *   1. 기본값은 언제나 실제 날짜다. 주소에 ?admin=1 을 붙여야 메뉴가 나온다.
 *   2. 켜져 있으면 화면 맨 위에 빨간 띠가 뜨고, 인쇄물에도 그대로 찍힌다.
 *      테스트로 뽑은 주문서가 진짜와 구분되지 않으면 안 되기 때문이다.
 *   3. sessionStorage 에 저장하므로 탭을 닫으면 사라진다. localStorage 를
 *      쓰지 않는 이유가 이것이다 - 다음 사람이 켜진 줄 모르고 쓰면 안 된다.
 */

const ADMIN_TEST_KEY = 'gs25TestPromoDate';

/**
 * 행사 판정에 쓸 날짜. 테스트 모드가 켜져 있으면 그 날짜, 아니면 오늘.
 * getApplicableEvent() 만 이 함수를 쓴다.
 * @returns {string} YYYY-MM-DD
 */
function getPromoDate() {
    return getTestPromoDate() || getTodayDate();
}

/**
 * 테스트 기준 날짜 (꺼져 있으면 빈 문자열)
 * @returns {string}
 */
function getTestPromoDate() {
    try {
        return sessionStorage.getItem(ADMIN_TEST_KEY) || '';
    } catch (e) {
        return '';  // 시크릿 모드 등에서 막힐 수 있다. 그때는 실제 날짜로 동작.
    }
}

/**
 * 날짜 문자열에 일수를 더한다
 * @param {string} date - YYYY-MM-DD
 * @param {number} days
 * @returns {string} YYYY-MM-DD
 */
function shiftDate(date, days) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 기준 날짜가 어느 기간에 해당하는지 사람이 읽을 이름으로
 * @param {string} date - YYYY-MM-DD
 * @returns {string}
 */
function describePromoPeriod(date) {
    const cfg = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG) ? PROMO_CONFIG : {};
    if (cfg.mainStart && date >= cfg.mainStart) return '본행사';
    if (cfg.preStart && date < cfg.preStart) return '행사 시작 전';
    return '사전행사';
}

/**
 * 테스트 기준 날짜를 바꾸고 화면을 다시 계산한다
 * @param {string} date - YYYY-MM-DD, 빈 문자열이면 테스트 종료
 */
function setTestPromoDate(date) {
    try {
        if (date) {
            sessionStorage.setItem(ADMIN_TEST_KEY, date);
        } else {
            sessionStorage.removeItem(ADMIN_TEST_KEY);
        }
    } catch (e) {
        showAlert('이 브라우저에서는 테스트 모드를 저장할 수 없습니다.', 'error');
        return;
    }

    renderTestBanner();
    updateAdminPanelState();
    refreshAllRowEvents();

    if (date) {
        showAlert(`🔧 테스트 모드: ${date} (${describePromoPeriod(date)}) 기준으로 봅니다.`, 'info');
    } else {
        showAlert('테스트 모드를 껐습니다. 실제 날짜 기준으로 돌아갑니다.', 'success');
    }
}

/**
 * 주문서가 iframe 안에 있으면(order_split.html) 그 창, 아니면 null.
 * @returns {Window|null}
 */
function orderFrameWindow() {
    const frame = document.getElementById('orderFrame');
    try {
        if (frame && frame.contentWindow
            && typeof frame.contentWindow.refreshAllRowEvents === 'function') {
            return frame.contentWindow;
        }
    } catch (e) { /* 다른 출처면 접근이 막힌다 */ }
    return null;
}

/**
 * 이미 입력된 상품 행들의 행사를 새 기준 날짜로 다시 채운다.
 *
 * 점원이 직접 고른 행사도 함께 덮어쓴다. 테스트 모드는 "지금 이 날짜면
 * 자동으로 뭐가 선택되나"를 보는 기능이므로 그게 맞다.
 */
function refreshAllRowEvents() {
    // 2단 화면(order_split.html)에서는 주문서가 iframe 안에 있다.
    // 여기(바깥 문서)에는 상품 표가 없으므로, 안쪽에 대신 시켜야 한다.
    // 이걸 빼먹으면 화면 위 띠는 "사전행사" 라고 하는데 표의 행사는 본행사
    // 그대로 남는다 - 점원이 잘못된 지급수량을 약속하게 된다.
    const inner = orderFrameWindow();
    if (inner) {
        // 인쇄되는 빨간 띠도 안쪽 문서의 것이다. 함께 다시 그린다.
        if (typeof inner.renderTestBanner === 'function') inner.renderTestBanner();
        inner.refreshAllRowEvents();
        return;
    }

    document.querySelectorAll('.product-row').forEach(row => {
        const codeInput = row.querySelector('.product-code');
        if (!codeInput || !codeInput.value.trim()) return;

        const info = getProductInfo(codeInput.value.trim());
        if (!info) return;

        applyCatalogEvent(row, info);
        // 행사가 바뀌면 지급수량도 다시 계산해야 한다.
        // updateProductTotals() 는 합계만 내므로 이것만으로는 부족하다.
        calculateRowTotal(row);
    });

    if (typeof updateProductTotals === 'function') updateProductTotals();
    // 배송 상품 배정은 지급수량 기준이라, 지급수량이 줄면 함께 조정해야 한다
    if (typeof reconcileDeliveryQuantities === 'function') reconcileDeliveryQuantities();
    // 섹션 하나짜리 refreshDeliveryProductSelects(section) 이 아니라
    // 모든 배송 섹션을 도는 쪽을 불러야 한다. 인자 없이 부르면 그 안에서
    // undefined.querySelectorAll 로 터진다.
    if (typeof refreshAllDeliveryProductSelects === 'function') refreshAllDeliveryProductSelects();
}

/**
 * 테스트 모드 알림 띠. 인쇄물에도 찍히도록 no-print 를 붙이지 않는다.
 *
 * 띠 안에 끄기 버튼을 같이 둔다. 테스트를 켠 탭에서 주소의 ?admin=1 만
 * 지우면 관리자 메뉴는 사라지지만 테스트 모드는 그대로 남는다 (같은 탭이라
 * sessionStorage 가 유지된다). 그때 끌 방법이 없으면 안 되므로, 띠를 보는
 * 사람은 누구나 바로 끌 수 있어야 한다.
 */
function renderTestBanner() {
    const existing = document.getElementById('testModeBanner');
    const date = getTestPromoDate();

    if (!date) {
        if (existing) existing.remove();
        return;
    }

    const banner = existing || document.createElement('div');
    banner.id = 'testModeBanner';
    banner.className = 'test-mode-banner';
    banner.innerHTML = '';

    const text = document.createElement('span');
    text.textContent =
        `🔧 테스트 모드 — ${date} (${describePromoPeriod(date)}) 기준으로 보고 있습니다. ` +
        `실제 오늘은 ${getTodayDate()} 입니다. 이 주문서는 실제 주문에 쓰지 마세요.`;
    banner.appendChild(text);

    // 인쇄물에는 버튼이 필요 없다
    const off = document.createElement('button');
    off.type = 'button';
    off.className = 'test-mode-off no-print';
    off.textContent = '테스트 끄기';
    off.onclick = () => setTestPromoDate('');
    banner.appendChild(off);

    if (!existing) {
        document.body.insertBefore(banner, document.body.firstChild);
    }
}

/**
 * 관리자 메뉴 버튼들의 선택 상태를 현재 기준 날짜에 맞춘다
 */
function updateAdminPanelState() {
    const panel = document.getElementById('adminPanel');
    if (!panel) return;

    const current = getTestPromoDate();
    panel.querySelectorAll('[data-test-date]').forEach(btn => {
        const isOn = btn.dataset.testDate === current;
        btn.classList.toggle('active', isOn);
    });

    const input = panel.querySelector('#adminTestDate');
    if (input) input.value = current || getTodayDate();

    const now = panel.querySelector('#adminCurrentBasis');
    if (now) {
        const basis = current || getTodayDate();
        now.textContent = `${basis} (${describePromoPeriod(basis)})`
            + (current ? ' — 테스트 중' : ' — 실제 날짜');
    }
}

/**
 * 관리자 메뉴를 만든다. 주소에 ?admin=1 이 있을 때만 부른다.
 */
function buildAdminPanel() {
    const cfg = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG) ? PROMO_CONFIG : {};
    const preStart = cfg.preStart || getTodayDate();
    const mainStart = cfg.mainStart || getTodayDate();

    const panel = document.createElement('div');
    panel.id = 'adminPanel';
    panel.className = 'admin-panel no-print';
    panel.innerHTML = `
        <div class="admin-panel-title">
            🔧 관리자 — 행사 기간 테스트
            <button type="button" class="admin-panel-close" onclick="toggleAdminPanel()">✕</button>
        </div>
        <div class="admin-panel-body">
            <div class="admin-basis">지금 기준: <strong id="adminCurrentBasis"></strong></div>
            <div class="admin-buttons">
                <button type="button" data-test-date="${shiftDate(preStart, -1)}"
                        onclick="setTestPromoDate('${shiftDate(preStart, -1)}')">
                    행사 시작 전<br><small>${shiftDate(preStart, -1)}</small>
                </button>
                <button type="button" data-test-date="${preStart}"
                        onclick="setTestPromoDate('${preStart}')">
                    사전행사<br><small>${preStart} ~</small>
                </button>
                <button type="button" data-test-date="${mainStart}"
                        onclick="setTestPromoDate('${mainStart}')">
                    본행사<br><small>${mainStart} ~</small>
                </button>
            </div>
            <div class="admin-custom">
                <label for="adminTestDate">직접 고르기</label>
                <input type="date" id="adminTestDate" lang="ko"
                       onchange="setTestPromoDate(this.value)">
            </div>
            <button type="button" class="admin-reset" onclick="setTestPromoDate('')">
                테스트 끝내기 (실제 날짜로)
            </button>
            <p class="admin-note">
                행사 자동 선택에 쓰는 날짜만 바뀝니다. 주문 일시와 배송 희망일은
                실제 날짜 그대로입니다. 탭을 닫으면 테스트 모드는 저절로 꺼집니다.
            </p>
        </div>
    `;
    document.body.appendChild(panel);
    updateAdminPanelState();
}

/**
 * 관리자 메뉴 열기/닫기
 */
function toggleAdminPanel() {
    const panel = document.getElementById('adminPanel');
    if (panel) {
        panel.remove();
    } else {
        buildAdminPanel();
    }
}

/**
 * 페이지 시작 시 호출. 주소의 ?admin=1 / ?test=... 를 읽는다.
 *
 * ?test=main | pre | none | YYYY-MM-DD 로 메뉴 없이 바로 켤 수도 있다.
 * 관리자가 즐겨찾기 하나로 원하는 화면을 열 수 있게 하기 위한 것이다.
 */
function initAdminTestMode() {
    const params = new URLSearchParams(window.location.search);
    const cfg = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG) ? PROMO_CONFIG : {};

    const test = params.get('test');
    if (test !== null) {
        const preset = {
            main: cfg.mainStart || '',
            pre: cfg.preStart || '',
            none: cfg.preStart ? shiftDate(cfg.preStart, -1) : '',
            off: ''
        };
        const date = (test in preset) ? preset[test]
                   : (/^\d{4}-\d{2}-\d{2}$/.test(test) ? test : '');
        try {
            if (date) {
                sessionStorage.setItem(ADMIN_TEST_KEY, date);
            } else {
                sessionStorage.removeItem(ADMIN_TEST_KEY);
            }
        } catch (e) { /* 저장 못 해도 화면은 그려준다 */ }
    }

    renderTestBanner();

    if (params.get('admin') === '1' || params.get('관리자') === '1') {
        buildAdminPanel();
    }
}
