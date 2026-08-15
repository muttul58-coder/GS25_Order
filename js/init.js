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
 * 페이지 로드 시 초기화 작업 수행
 */
function initializePage() {
    // products.js 파일 로드 상태 확인
    checkProductsDataLoaded();

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
