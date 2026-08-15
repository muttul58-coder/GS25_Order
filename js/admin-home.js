// ========================================
// admin.html (관리자 홈) — 지금 상태 + 링크 모음
// ========================================

/**
 * 이 화면이 있는 이유는 "링크를 모으기" 가 아니다.
 *
 * 시즌 갱신은 1년에 두 번뿐이라, 정작 할 때가 되면
 *   - 지금 올라가 있는 게 어느 시즌이었나
 *   - 지금이 사전행사인가 본행사인가, 행사가 안 붙는 게 정상인가
 * 부터 다시 헤매게 된다. 이 값들은 전부 products.js / store.js 안에 이미 있으므로
 * **읽어서 보여주면 된다.** 손으로 적어두는 순간 다음 시즌에 거짓말이 되므로
 * 이 화면에는 시즌에 따라 달라지는 값을 절대 적어 두지 않는다.
 *
 * 행사 기간 판정은 js/admin-test.js 의 describePromoPeriod() 를 그대로 쓴다.
 * 여기서 따로 계산하면 주문서와 이 화면이 서로 다른 말을 할 수 있다.
 */

// file:// 로 열었거나 GitHub Pages 가 아닐 때 쓰는 대비값.
// 실제로는 아래 repoSlug() 가 주소에서 알아내므로, 저장소를 옮겨도 따라간다.
const DEFAULT_REPO = 'muttul58-coder/GS25_Order';

const SETTINGS_FILE = '시즌설정.txt';
const WORKFLOW_FILE = 'season-update.yml';
const BARCODE_DIR = 'BarcodeSource';

/**
 * 지금 열려 있는 주소에서 GitHub 저장소를 알아낸다.
 * 예) muttul58-coder.github.io/GS25_Order/admin.html -> muttul58-coder/GS25_Order
 * @returns {string} "소유자/저장소"
 */
function repoSlug() {
    const host = window.location.hostname;
    if (host.endsWith('.github.io')) {
        const owner = host.split('.')[0];
        const seg = window.location.pathname.split('/').filter(Boolean);
        // 프로젝트 페이지면 첫 칸이 저장소 이름, 사용자 페이지면 호스트가 곧 저장소다
        return owner + '/' + (seg.length > 1 ? seg[0] : host);
    }
    return DEFAULT_REPO;
}

/**
 * 이 페이지 기준의 절대 주소 (복사 버튼이 쓴다)
 * @param {string} rel - 예: 'order_form.html'
 * @returns {string}
 */
function siteUrl(rel) {
    return new URL(rel, window.location.href).href;
}

/**
 * GS25 카탈로그 사이트 주소. products.js 의 사진 주소에서 뒤를 떼어 만든다.
 * 시즌마다 폴더가 바뀌므로 여기에 적어두면 안 된다.
 * @returns {string} 못 알아내면 빈 문자열
 */
function catalogSite() {
    const img = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG.catalogImage) || '';
    const root = img.replace(/\/goods\/?$/, '');
    return root ? root + '/category' : '';
}

/**
 * 두 날짜 사이의 일수 (b - a)
 * @param {string} a - YYYY-MM-DD
 * @param {string} b - YYYY-MM-DD
 * @returns {number}
 */
function daysBetween(a, b) {
    const ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00');
    return Math.round(ms / 86400000);
}

/**
 * 상품 데이터에서 숫자들을 센다 (총 개수, 시세반영, 사전/본행사 품목)
 * @returns {{total:number, market:number, pre:number, main:number}}
 */
function countProducts() {
    const data = (typeof PRODUCTS_DATA !== 'undefined' && PRODUCTS_DATA) || {};
    const codes = Object.keys(data);
    return {
        total: codes.length,
        market: codes.filter(c => data[c].marketPrice).length,
        pre: codes.filter(c => data[c].eventPre).length,
        main: codes.filter(c => data[c].eventMain).length
    };
}

/**
 * '지금 상태' 칸을 채운다
 */
function renderStatus() {
    const cfg = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG) ? PROMO_CONFIG : {};
    const today = getTodayDate();
    const phase = describePromoPeriod(today);
    const n = countProducts();

    const cls = { '행사 시작 전': 'phase-before', '사전행사': 'phase-pre', '본행사': 'phase-main' };

    setText('factSeason', cfg.season || '(알 수 없음)');
    setText('factToday', today);

    const badge = document.getElementById('factPhase');
    badge.textContent = phase;
    badge.className = 'phase ' + (cls[phase] || '');

    setHtml('factCount',
        n.total + '<span class="unit">개</span>'
        + (n.market ? ' <span class="unit">(시세반영 ' + n.market + ')</span>' : ''));

    setHtml('factPre', (cfg.preStart || '?') + ' <span class="unit">~ · ' + n.pre + '품목</span>');
    setHtml('factMain', (cfg.mainStart || '?') + ' <span class="unit">~ · ' + n.main + '품목</span>');

    const store = (typeof STORE_INFO !== 'undefined' && STORE_INFO) || {};
    const who = [store.name, store.manager, store.phone].filter(Boolean).join(' · ');
    setText('storeLine', who || '매장 정보 없음');
}

/**
 * '지금 할 일' 칸. 기간에 따라 문장이 달라진다.
 *
 * 관리자가 제일 자주 하는 오해가 "행사가 안 붙는데 고장난 것 아니냐" 이므로,
 * 그게 정상인 기간에는 정상이라고 먼저 말해 준다.
 */
function renderNow() {
    const cfg = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG) ? PROMO_CONFIG : {};
    const today = getTodayDate();
    const phase = describePromoPeriod(today);
    const n = countProducts();
    const box = document.getElementById('nowBox');

    let tone = '', title = '', lines = [];

    if (phase === '행사 시작 전') {
        const d = cfg.preStart ? daysBetween(today, cfg.preStart) : null;
        tone = 'warn';
        title = '아직 행사 기간이 아닙니다'
            + (d !== null ? ' — 사전행사까지 ' + (d === 0 ? '오늘' : 'D-' + d) : '');
        lines.push('주문서에서 행사가 자동으로 선택되지 않는 것이 <b>정상</b>입니다. '
            + '사전행사 시작일(' + (cfg.preStart || '?') + ')부터 붙습니다.');
        lines.push('그때 화면이 어떻게 보이는지 미리 보시려면 아래 <b>행사 미리보기</b>를 쓰세요.');
    } else if (phase === '사전행사') {
        const d = cfg.mainStart ? daysBetween(today, cfg.mainStart) : null;
        tone = '';
        title = '사전행사 기간입니다'
            + (d !== null ? ' — 본행사까지 ' + (d === 0 ? '오늘' : 'D-' + d) : '');
        lines.push('지금은 사전행사 ' + n.pre + '품목에만 행사가 붙습니다. '
            + '본행사 ' + n.main + '품목은 ' + (cfg.mainStart || '?') + '부터 바뀝니다 — '
            + '지금 안 붙는 상품이 있어도 <b>정상</b>입니다.');
        if (cfg.preNote) {
            lines.push('사전행사 조건: <b>' + escapeHtml(cfg.preNote) + '</b> — '
                + '조건에 맞지 않으면 덤이 나가지 않으니 손님께 미리 확인하세요.');
        }
    } else {
        tone = 'ok';
        title = '본행사 기간입니다';
        lines.push('카탈로그의 본행사 행사(' + n.main + '품목)가 적용되고 있습니다. '
            + '따로 하실 일은 없습니다.');
        lines.push('다음 명절이 되면 아래 <b>새 시즌으로 바꾸기</b> 를 순서대로 누르시면 됩니다.');
    }

    box.className = 'now' + (tone ? ' ' + tone : '');
    box.innerHTML = '<h3>' + title + '</h3>'
        + lines.map(t => '<p>' + t + '</p>').join('');
}

/**
 * 링크의 주소를 채운다. 저장소 주소는 repoSlug() 로 조립하므로
 * 이 파일 말고 다른 곳에 GitHub 주소를 적어 둘 필요가 없다.
 */
function renderLinks() {
    const repo = repoSlug();
    const gh = 'https://github.com/' + repo;
    const sheet = (typeof SITE_LINKS !== 'undefined' && SITE_LINKS.responseSheet) || '';

    setHref('linkUpload', gh + '/upload/main/' + BARCODE_DIR);
    setHref('linkSettings', gh + '/edit/main/' + encodeURIComponent(SETTINGS_FILE));
    setHref('linkRun', gh + '/actions/workflows/' + WORKFLOW_FILE);
    setHref('linkHistory', gh + '/commits/main/products.js');
    setHref('linkRepo', gh);

    const site = catalogSite();
    const row = document.getElementById('rowCatalog');
    if (site) {
        setHref('linkCatalog', site);
    } else if (row) {
        row.remove();
    }

    const sheetRow = document.getElementById('rowSheet');
    if (sheet) {
        setHref('linkSheet', sheet);
    } else if (sheetRow) {
        // 주소를 안 적어 두었으면 어디에 적는지를 대신 알려 준다.
        // 링크를 그냥 지우면 "왜 없지" 하고 다시 헤매게 된다.
        sheetRow.querySelector('.text').innerHTML =
            '<b>주문 내역 보기</b><small>아직 주소를 적어두지 않았습니다. '
            + '시즌설정.txt 의 <b>응답 시트 주소</b> 줄에 구글 스프레드시트 주소를 넣으면 여기 버튼이 생깁니다.</small>';
        const btn = sheetRow.querySelector('.go');
        if (btn) btn.remove();
    }
}

/**
 * 마지막 갱신 날짜를 GitHub 에서 물어본다.
 *
 * 저장소에 날짜를 적어두지 않는 이유: 갱신 때마다 값이 바뀌면 바코드가 하나도
 * 안 바뀐 실행에서도 매번 커밋이 생겨, "바뀐 게 없으면 커밋도 없다" 는 확인
 * 수단이 사라진다. 그래서 커밋 기록에서 읽어 온다.
 *
 * 실패해도 화면은 그대로 쓸 수 있어야 하므로 조용히 넘어간다.
 */
async function loadLastUpdate() {
    const el = document.getElementById('factUpdated');
    try {
        const res = await fetch('https://api.github.com/repos/' + repoSlug()
            + '/commits?path=products.js&per_page=1');
        if (!res.ok) throw new Error(res.status);
        const rows = await res.json();
        const iso = rows && rows[0] && rows[0].commit
            && (rows[0].commit.committer || rows[0].commit.author).date;
        if (!iso) throw new Error('빈 응답');

        const date = iso.slice(0, 10);
        const ago = daysBetween(date, getTodayDate());
        el.innerHTML = date + '<span class="unit">· '
            + (ago <= 0 ? '오늘' : ago + '일 전') + '</span>';
    } catch (e) {
        el.innerHTML = '<span class="unit">확인 못 함 — 아래 갱신 기록에서 보세요</span>';
    }
}

/**
 * 주소 복사 버튼. 점원·손님에게 보낼 주소를 여기서 바로 복사한다.
 * @param {HTMLButtonElement} btn
 * @param {string} rel - 이 페이지 기준 상대 주소
 */
function copyLink(btn, rel) {
    const url = siteUrl(rel);
    const done = () => {
        const old = btn.textContent;
        btn.textContent = '복사됨';
        setTimeout(() => { btn.textContent = old; }, 1500);
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(done, () => window.prompt('아래 주소를 복사하세요', url));
        return;
    }
    // http:// 나 file:// 에서는 clipboard 를 못 쓴다. 그때는 직접 복사하게 보여 준다.
    window.prompt('아래 주소를 복사하세요', url);
}

// ---- 잔심부름 -----------------------------------------------------------

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function setHref(id, url) {
    const el = document.getElementById(id);
    if (el) el.href = url;
}

/** 카탈로그에서 온 문구를 화면에 넣기 전에 태그를 막는다 */
function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    renderStatus();
    renderNow();
    renderLinks();
    loadLastUpdate();
});
