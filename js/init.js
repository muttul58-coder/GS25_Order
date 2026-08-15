// ========================================
// 우편번호 숫자만 입력 허용
// ========================================
document.addEventListener('input', function(e) {
    // 우편번호 숫자만 입력 허용
    if (e.target.matches('#ordererPostal, .sender-postal, .receiver-postal')) {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    }
    // 배송 상품 수량: 음수 방지 + 지급 수량 초과 방지
    // 인라인 oninput 이 먼저 실행돼 초과값 기준으로 검증되므로, 값을 되돌린 뒤 다시 검증한다
    if (e.target.matches('.delivery-product-qty')) {
        if (clampDeliveryQuantity(e.target)) {
            validateDeliveryQuantities();
        }
    }
});

// 붙여넣기·스피너 등 input 이벤트를 거치지 않는 경로 대비
document.addEventListener('change', function(e) {
    if (e.target.matches('.delivery-product-qty')) {
        if (clampDeliveryQuantity(e.target)) {
            validateDeliveryQuantities();
        }
    }
});

// ========================================
// 초기화 함수
// ========================================

/**
 * 매장 정보 표시 (store.js 의 STORE_INFO)
 *
 * season.json 을 고치고 시즌 갱신을 돌리면 여기까지 반영된다.
 * store.js 가 없으면 HTML 에 적힌 기존 내용을 그대로 둔다.
 */
function applyStoreInfo() {
    if (typeof STORE_INFO === 'undefined' || !STORE_INFO) return;

    const gap = '   ';
    const parts = [];
    if (STORE_INFO.name) parts.push(STORE_INFO.name);
    if (STORE_INFO.manager) parts.push('담당 : ' + STORE_INFO.manager);
    if (STORE_INFO.phone) parts.push('휴대전화 : ' + STORE_INFO.phone);
    if (parts.length === 0) return;

    const box = document.getElementById('shopInfo');
    if (box) box.textContent = parts.join(gap);
    if (STORE_INFO.name) document.title = '주문서 - ' + STORE_INFO.name;
}

/**
 * 페이지 로드 시 초기화 작업 수행
 */
function initializePage() {
    // products.js 파일 로드 상태 확인
    checkProductsDataLoaded();

    // 관리자 테스트 모드 (?admin=1 / ?test=main). 행사 자동 선택에만 영향을 준다.
    initAdminTestMode();

    const splitLink = document.getElementById('splitViewLink');
    if (splitLink) {
        // 이미 2단 화면(order_split.html) 안에 떠 있으면 숨긴다.
        // 그대로 두면 그 안에서 또 2단 화면이 열려 주문서가 겹겹이 쌓인다.
        if (window.top !== window.self) {
            splitLink.style.display = 'none';
        } else if (location.search) {
            // ?admin=1&test=pre 같은 설정을 그대로 들고 넘어간다.
            // 떼고 가면 미리보던 기간이 사라져 "왜 행사가 다르지" 가 된다.
            splitLink.href = 'order_split.html' + location.search;
        }
    }

    // 매장 정보 표시
    applyStoreInfo();

    // 현재 날짜/시간 표시
    updateDateTime();
    // 매 분마다 날짜/시간 업데이트
    setInterval(updateDateTime, 60000);

    // 첫 번째 섹션의 첫 번째 행에 이벤트 리스너 추가
    const firstRow = document.querySelector('.product-row');
    if (firstRow) {
        attachRowEventListeners(firstRow);
        attachProductCodeFormatting(firstRow);
    }

    // 전화번호 하이픈 자동 포맷팅 초기화
    initPhoneFormatting();

    // 정보 복사/동기화 리스너 초기화
    initCopySync();

    // 순차적 입력 가이드 이벤트 추가
    attachSequentialInputGuide();

    // 로컬 스토리지에서 모든 설정 불러오기
    loadAllSettings();

    // 첫 번째 섹션의 배송 상품 콤보박스 초기화
    const firstSection = document.querySelector('.order-section');
    if (firstSection) {
        refreshDeliveryProductSelects(firstSection);
    }

    // 배송 희망 일 오늘 날짜로 초기화 + 과거 날짜 선택 방지
    const today = getTodayDate();
    document.querySelectorAll('.delivery-date').forEach(input => {
        input.value = today;
        input.min = today;
    });
}

// ========================================
// 페이지 로드 이벤트
// ========================================

// DOM이 완전히 로드된 후 초기화 함수 실행
document.addEventListener('DOMContentLoaded', initializePage);
