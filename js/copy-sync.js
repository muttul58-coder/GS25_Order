// ========================================
// 날짜/시간 관련 함수
// ========================================

/**
 * 현재 날짜와 시간을 업데이트하여 표시
 * 형식: YYYY-MM-DD HH:MM
 */
function updateDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    document.getElementById('currentDateTime').textContent =
        `${year}-${month}-${day} ${hours}:${minutes}`;
}

// ========================================
// 주문자 정보 복사 함수
// ========================================

/**
 * 주문자 정보를 보내는 분 필드로 복사하거나 초기화
 * @param {HTMLInputElement} checkbox - 체크박스 요소
 */
function toggleOrdererInfoCopy(checkbox) {
    const section = checkbox.closest('.order-section');
    const senderName = section.querySelector('.sender-name');
    const senderPhone = section.querySelector('.sender-phone');
    const senderPostal = section.querySelector('.sender-postal');
    const senderAddress = section.querySelector('.sender-address');
    const senderAddressDetail = section.querySelector('.sender-address-detail');

    if (checkbox.checked) {
        // 주문자 정보를 보내는 분 필드로 복사
        senderName.value = document.getElementById('ordererName').value;
        senderPhone.value = document.getElementById('ordererPhone').value;
        senderPostal.value = document.getElementById('ordererPostal').value;
        senderAddress.value = document.getElementById('ordererAddress').value;
        senderAddressDetail.value = document.getElementById('ordererAddressDetail').value;

        // 필드를 읽기 전용으로 설정
        senderName.readOnly = true;
        senderPhone.readOnly = true;
        senderPostal.readOnly = true;
        senderAddress.readOnly = true;
        senderAddressDetail.readOnly = true;

        // 시각적 피드백 (배경색 변경)
        senderName.style.backgroundColor = '#f0f0f0';
        senderPhone.style.backgroundColor = '#f0f0f0';
        senderPostal.style.backgroundColor = '#f0f0f0';
        senderAddress.style.backgroundColor = '#f0f0f0';
        senderAddressDetail.style.backgroundColor = '#f0f0f0';

        showAlert('✅ 주문자 정보가 보내는 분 필드로 복사되었습니다.', 'success');
    } else {
        // 필드 초기화 및 편집 가능하게 설정
        senderName.value = '';
        senderPhone.value = '';
        senderPostal.value = '';
        senderAddress.value = '';
        senderAddressDetail.value = '';

        senderName.readOnly = false;
        senderPhone.readOnly = false;
        senderPostal.readOnly = false;
        senderAddress.readOnly = false;
        senderAddressDetail.readOnly = false;

        // 배경색 원래대로
        senderName.style.backgroundColor = '';
        senderPhone.style.backgroundColor = '';
        senderPostal.style.backgroundColor = '';
        senderAddress.style.backgroundColor = '';
        senderAddressDetail.style.backgroundColor = '';
    }
}

/**
 * 받는 분 필드에 주문자 또는 보내는 분 정보 복사
 * @param {HTMLInputElement} checkbox - 체크박스 요소
 * @param {string} sourceType - 'orderer' 또는 'sender'
 */
function toggleReceiverInfoCopy(checkbox, sourceType) {
    const section = checkbox.closest('.order-section');
    const receiverName = section.querySelector('.receiver-name');
    const receiverPhone = section.querySelector('.receiver-phone');
    const receiverPostal = section.querySelector('.receiver-postal');
    const receiverAddress = section.querySelector('.receiver-address');
    const receiverAddressDetail = section.querySelector('.receiver-address-detail');

    if (checkbox.checked) {
        // 다른 체크박스가 체크되어 있으면 해제
        const otherCheckbox = sourceType === 'orderer'
            ? section.querySelector('.copy-sender-to-receiver')
            : section.querySelector('.copy-orderer-to-receiver');

        if (otherCheckbox && otherCheckbox.checked) {
            otherCheckbox.checked = false;
        }

        // 소스에 따라 정보 복사
        if (sourceType === 'orderer') {
            // 주문자 정보 복사
            receiverName.value = document.getElementById('ordererName').value;
            receiverPhone.value = document.getElementById('ordererPhone').value;
            receiverPostal.value = document.getElementById('ordererPostal').value;
            receiverAddress.value = document.getElementById('ordererAddress').value;
            receiverAddressDetail.value = document.getElementById('ordererAddressDetail').value;
            showAlert('✅ 주문자 정보가 받는 분 필드로 복사되었습니다.', 'success');
        } else if (sourceType === 'sender') {
            // 보내는 분 정보 복사
            const senderName = section.querySelector('.sender-name');
            const senderPhone = section.querySelector('.sender-phone');
            const senderPostal = section.querySelector('.sender-postal');
            const senderAddress = section.querySelector('.sender-address');
            const senderAddressDetail = section.querySelector('.sender-address-detail');

            receiverName.value = senderName.value;
            receiverPhone.value = senderPhone.value;
            receiverPostal.value = senderPostal.value;
            receiverAddress.value = senderAddress.value;
            receiverAddressDetail.value = senderAddressDetail.value;
            showAlert('✅ 보내는 분 정보가 받는 분 필드로 복사되었습니다.', 'success');
        }

        // 필드를 읽기 전용으로 설정
        receiverName.readOnly = true;
        receiverPhone.readOnly = true;
        receiverPostal.readOnly = true;
        receiverAddress.readOnly = true;
        receiverAddressDetail.readOnly = true;

        // 시각적 피드백 (배경색 변경)
        receiverName.style.backgroundColor = '#f0f0f0';
        receiverPhone.style.backgroundColor = '#f0f0f0';
        receiverPostal.style.backgroundColor = '#f0f0f0';
        receiverAddress.style.backgroundColor = '#f0f0f0';
        receiverAddressDetail.style.backgroundColor = '#f0f0f0';

    } else {
        // 필드 초기화 및 편집 가능하게 설정
        receiverName.value = '';
        receiverPhone.value = '';
        receiverPostal.value = '';
        receiverAddress.value = '';
        receiverAddressDetail.value = '';

        receiverName.readOnly = false;
        receiverPhone.readOnly = false;
        receiverPostal.readOnly = false;
        receiverAddress.readOnly = false;
        receiverAddressDetail.readOnly = false;

        // 배경색 원래대로
        receiverName.style.backgroundColor = '';
        receiverPhone.style.backgroundColor = '';
        receiverPostal.style.backgroundColor = '';
        receiverAddress.style.backgroundColor = '';
        receiverAddressDetail.style.backgroundColor = '';
    }
}

// ========================================
// 정보 동기화 (원본 변경 시 복사된 곳 자동 업데이트)
// ========================================

/**
 * 주문자 정보 변경 시: 체크된 보내는 분 / 받는 분 자동 업데이트
 */
function syncFromOrderer() {
    const ordererData = {
        name: document.getElementById('ordererName').value,
        phone: document.getElementById('ordererPhone').value,
        postal: document.getElementById('ordererPostal').value,
        address: document.getElementById('ordererAddress').value,
        addressDetail: document.getElementById('ordererAddressDetail').value
    };

    // 모든 주문 섹션에서 "주문자 정보와 동일" 체크된 보내는 분 업데이트
    document.querySelectorAll('.copy-orderer-info:checked').forEach(cb => {
        const section = cb.closest('.order-section');
        section.querySelector('.sender-name').value = ordererData.name;
        section.querySelector('.sender-phone').value = ordererData.phone;
        section.querySelector('.sender-postal').value = ordererData.postal;
        section.querySelector('.sender-address').value = ordererData.address;
        section.querySelector('.sender-address-detail').value = ordererData.addressDetail;

        // 보내는 분이 변경되었으므로 → 보내는 분 복사 체크된 받는 분도 업데이트
        syncFromSender(section);
    });

    // 모든 주문 섹션에서 "주문자 정보와 동일" 체크된 받는 분 업데이트
    document.querySelectorAll('.copy-orderer-to-receiver:checked').forEach(cb => {
        const section = cb.closest('.order-section');
        section.querySelector('.receiver-name').value = ordererData.name;
        section.querySelector('.receiver-phone').value = ordererData.phone;
        section.querySelector('.receiver-postal').value = ordererData.postal;
        section.querySelector('.receiver-address').value = ordererData.address;
        section.querySelector('.receiver-address-detail').value = ordererData.addressDetail;
    });
}

/**
 * 보내는 분 정보 변경 시: 체크된 받는 분 자동 업데이트
 */
function syncFromSender(section) {
    const cb = section.querySelector('.copy-sender-to-receiver');
    if (cb && cb.checked) {
        section.querySelector('.receiver-name').value = section.querySelector('.sender-name').value;
        section.querySelector('.receiver-phone').value = section.querySelector('.sender-phone').value;
        section.querySelector('.receiver-postal').value = section.querySelector('.sender-postal').value;
        section.querySelector('.receiver-address').value = section.querySelector('.sender-address').value;
        section.querySelector('.receiver-address-detail').value = section.querySelector('.sender-address-detail').value;
    }
}

// 주문자 정보 input에 이벤트 리스너 등록
['ordererName', 'ordererPhone', 'ordererPostal', 'ordererAddress', 'ordererAddressDetail'].forEach(id => {
    document.getElementById(id).addEventListener('input', syncFromOrderer);
});

/**
 * 보내는 분 input에 이벤트 리스너 등록 (동적 섹션 포함)
 */
function attachSenderSyncListeners(section) {
    ['.sender-name', '.sender-phone', '.sender-postal', '.sender-address', '.sender-address-detail'].forEach(sel => {
        const input = section.querySelector(sel);
        if (input) {
            input.addEventListener('input', function() {
                syncFromSender(section);
            });
        }
    });
}

// 기존 첫 번째 섹션에 리스너 등록
document.querySelectorAll('.order-section').forEach(section => {
    attachSenderSyncListeners(section);
});