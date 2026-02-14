// ========================================
// 전역 변수 선언
// ========================================
let sectionCounter = 1; // 섹션 번호를 추적하는 카운터

// ========================================
// 알림 메시지 표시 함수
// ========================================

/**
 * 사용자에게 알림 메시지 표시
 * @param {string} message - 표시할 메시지
 * @param {string} type - 메시지 타입 ('success', 'warning', 'error')
 */
function showAlert(message, type = 'success') {
    const alertBox = document.getElementById('alertBox');
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    alertBox.style.display = 'block';

    // 3초 후 자동으로 숨김
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 3000);
}

// ========================================
// 숫자 포맷팅 함수
// ========================================

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
function getTodayDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * 숫자를 천단위 쉼표 형식으로 변환
 * @param {number} num - 변환할 숫자
 * @returns {string} - 천단위 쉼표가 추가된 문자열
 */
function formatNumberWithCommas(num) {
    if (!num && num !== 0) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 천단위 쉼표가 포함된 문자열을 숫자로 변환
 * @param {string} str - 변환할 문자열
 * @returns {number} - 변환된 숫자
 */
function parseFormattedNumber(str) {
    if (!str) return 0;
    return parseInt(str.toString().replace(/,/g, '')) || 0;
}

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
// 모바일 감지
// ========================================

/**
 * 모바일 환경 감지
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (window.innerWidth <= 768 && 'ontouchstart' in window);
}

// ========================================
// 전화번호 하이픈 자동 포맷팅
// ========================================

/**
 * 전화번호에 하이픈 자동 추가
 * 지원 형식: 02-000-0000, 0X0-000-0000, 0X0-0000-0000, 000-0000-0000
 * @param {string} value - 입력된 전화번호
 * @returns {string} - 하이픈이 추가된 전화번호
 */
function formatPhoneNumber(value) {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '');

    if (numbers.length === 0) return '';

    // 02 지역번호 (02-XXX-XXXX 또는 02-XXXX-XXXX)
    if (numbers.startsWith('02')) {
        if (numbers.length <= 2) return numbers;
        if (numbers.length <= 5) return numbers.slice(0, 2) + '-' + numbers.slice(2);
        if (numbers.length <= 9) return numbers.slice(0, 2) + '-' + numbers.slice(2, 5) + '-' + numbers.slice(5);
        return numbers.slice(0, 2) + '-' + numbers.slice(2, 6) + '-' + numbers.slice(6, 10);
    }

    // 그 외 (0X0-XXX-XXXX 또는 0X0-XXXX-XXXX)
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return numbers.slice(0, 3) + '-' + numbers.slice(3);
    if (numbers.length <= 10) return numbers.slice(0, 3) + '-' + numbers.slice(3, 6) + '-' + numbers.slice(6);
    return numbers.slice(0, 3) + '-' + numbers.slice(3, 7) + '-' + numbers.slice(7, 11);
}

/**
 * 전화번호 input에 하이픈 자동 포맷팅 이벤트 리스너 추가
 * @param {HTMLInputElement} input - 전화번호 입력 필드
 */
function attachPhoneFormatting(input) {
    input.addEventListener('input', function() {
        const formatted = formatPhoneNumber(this.value);
        if (formatted !== this.value) {
            this.value = formatted;
        }
    });
}

// ========================================
// 커스텀 확인 대화상자
// ========================================

/**
 * 커스텀 확인 대화상자 표시 (confirm 대체)
 * @param {string} message - 표시할 메시지
 * @param {Function} onConfirm - 확인 시 콜백
 * @param {Function} [onCancel] - 취소 시 콜백
 */
function showConfirmDialog(message, onConfirm, onCancel) {
    // 이미 있으면 제거
    const existing = document.getElementById('confirmDialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'confirmDialog';
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-box">
            <p class="confirm-message">${message}</p>
            <div class="confirm-buttons">
                <button type="button" class="confirm-btn confirm-yes">확인</button>
                <button type="button" class="confirm-btn confirm-no">취소</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.confirm-yes').addEventListener('click', function() {
        overlay.remove();
        if (onConfirm) onConfirm();
    });
    overlay.querySelector('.confirm-no').addEventListener('click', function() {
        overlay.remove();
        if (onCancel) onCancel();
    });
    // 오버레이 클릭 시 취소
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.remove();
            if (onCancel) onCancel();
        }
    });
}

/**
 * 페이지 내 모든 전화번호 필드에 포맷팅 적용
 */
function initPhoneFormatting() {
    // 주문자 전화번호
    const ordererPhone = document.getElementById('ordererPhone');
    if (ordererPhone) attachPhoneFormatting(ordererPhone);

    // 모든 섹션의 보내는 분 / 받는 분 전화번호
    document.querySelectorAll('.sender-phone, .receiver-phone').forEach(input => {
        attachPhoneFormatting(input);
    });
}
