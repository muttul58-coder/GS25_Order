// ========================================
// 우편번호 검색 함수
// ========================================

/**
 * 주문자 우편번호 검색
 */
function searchOrdererAddress() {
    // 카카오 Postcode API 로드 확인
    if (typeof daum === 'undefined' || typeof daum.Postcode === 'undefined') {
        alert('우편번호 검색 서비스를 불러오는 중입니다.\n잠시 후 다시 시도해주세요.\n\n인터넷 연결을 확인해주세요.');
        console.error('Daum Postcode API가 로드되지 않았습니다.');
        return;
    }

    new daum.Postcode({
        oncomplete: function(data) {
            // 우편번호와 주소 정보를 해당 필드에 넣기
            document.getElementById('ordererPostal').value = data.zonecode;
            document.getElementById('ordererAddress').value = data.roadAddress || data.jibunAddress;
            // 상세주소 필드로 포커스 이동
            document.getElementById('ordererAddressDetail').focus();
            // "주문 정보와 동일" 체크된 보내는 분/받는 분 자동 동기화
            syncFromOrderer();
        }
    }).open();
}

/**
 * 보내는 분 우편번호 검색
 * @param {HTMLElement} button - 검색 버튼 요소
 */
function searchSenderAddress(button) {
    // 카카오 Postcode API 로드 확인
    if (typeof daum === 'undefined' || typeof daum.Postcode === 'undefined') {
        alert('우편번호 검색 서비스를 불러오는 중입니다.\n잠시 후 다시 시도해주세요.\n\n인터넷 연결을 확인해주세요.');
        console.error('Daum Postcode API가 로드되지 않았습니다.');
        return;
    }

    const section = button.closest('.order-section');
    const postalInput = section.querySelector('.sender-postal');
    const addressInput = section.querySelector('.sender-address');
    const addressDetailInput = section.querySelector('.sender-address-detail');

    new daum.Postcode({
        oncomplete: function(data) {
            postalInput.value = data.zonecode;
            addressInput.value = data.roadAddress || data.jibunAddress;
            addressDetailInput.focus();
            // "보내는 분 정보와 동일" 체크된 받는 분 자동 동기화
            syncFromSender(section);
        }
    }).open();
}

/**
 * 받는 분 우편번호 검색
 * @param {HTMLElement} button - 검색 버튼 요소
 */
function searchReceiverAddress(button) {
    // 카카오 Postcode API 로드 확인
    if (typeof daum === 'undefined' || typeof daum.Postcode === 'undefined') {
        alert('우편번호 검색 서비스를 불러오는 중입니다.\n잠시 후 다시 시도해주세요.\n\n인터넷 연결을 확인해주세요.');
        console.error('Daum Postcode API가 로드되지 않았습니다.');
        return;
    }

    const section = button.closest('.order-section');
    const postalInput = section.querySelector('.receiver-postal');
    const addressInput = section.querySelector('.receiver-address');
    const addressDetailInput = section.querySelector('.receiver-address-detail');

    new daum.Postcode({
        oncomplete: function(data) {
            postalInput.value = data.zonecode;
            addressInput.value = data.roadAddress || data.jibunAddress;
            addressDetailInput.focus();
        }
    }).open();
}
