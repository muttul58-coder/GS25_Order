// ========================================
// 이벤트 리스너 및 계산 함수
// ========================================

/**
 * 상품 행에 이벤트 리스너 추가 (수량, 단가 변경 시 금액 자동 계산)
 * @param {HTMLElement} row - 대상 행 요소
 */
function attachRowEventListeners(row) {
    const quantity = row.querySelector('.quantity');
    const unitPrice = row.querySelector('.unit-price');

    // 수량 변경 시 금액 재계산
    quantity.addEventListener('input', () => calculateRowTotal(row));

    // 단가 입력 시 천단위 쉼표 자동 포맷팅 및 금액 재계산
    unitPrice.addEventListener('input', function() {
        // 현재 커서 위치 저장
        let cursorPosition = this.selectionStart;
        const oldValue = this.value;
        const oldLength = oldValue.length;

        // 숫자만 추출
        const numbersOnly = oldValue.replace(/[^\d]/g, '');

        // 빈 값이면 그대로 유지
        if (!numbersOnly) {
            this.value = '';
            calculateRowTotal(row);
            return;
        }

        // 천단위 쉼표 적용
        const formatted = formatNumberWithCommas(parseInt(numbersOnly));
        this.value = formatted;

        // 커서 위치 조정 (쉼표가 추가되면 커서가 이동하므로 조정 필요)
        const newLength = formatted.length;
        const diff = newLength - oldLength;
        this.setSelectionRange(cursorPosition + diff, cursorPosition + diff);

        // 금액 재계산
        calculateRowTotal(row);
    });

    // 단가 필드에서 포커스가 벗어날 때도 포맷팅 확인
    unitPrice.addEventListener('blur', function() {
        const value = this.value.replace(/,/g, '');
        if (value) {
            this.value = formatNumberWithCommas(parseInt(value));
        }
    });
}

/**
 * 개별 행의 금액 계산 (수량 × 단가)
 * @param {HTMLElement} row - 대상 행 요소
 */
function calculateRowTotal(row) {
    const quantityInput = row.querySelector('.quantity');
    const unitPriceInput = row.querySelector('.unit-price');
    const totalPriceInput = row.querySelector('.total-price');

    const quantity = parseInt(quantityInput.value) || 0;
    const unitPrice = parseFormattedNumber(unitPriceInput.value) || 0;
    const total = quantity * unitPrice;

    // 금액 필드에 천단위 쉼표가 포함된 값 설정
    totalPriceInput.value = formatNumberWithCommas(total);

    // 해당 섹션의 합계 업데이트
    const section = row.closest('.order-section');
    updateSectionTotals(section);
}

/**
 * 섹션별 총 수량과 총 금액 계산 및 업데이트
 * @param {HTMLElement} section - 대상 섹션 요소
 */
function updateSectionTotals(section) {
    const rows = section.querySelectorAll('.product-row');
    let totalQuantity = 0;
    let grandTotal = 0;

    // 모든 행의 수량과 금액을 합산
    rows.forEach(row => {
        const quantity = parseInt(row.querySelector('.quantity').value) || 0;
        const totalPriceValue = row.querySelector('.total-price').value;
        const totalPrice = parseFormattedNumber(totalPriceValue) || 0;

        totalQuantity += quantity;
        grandTotal += totalPrice;
    });

    // 합계 필드 업데이트 (천단위 쉼표 포함)
    const totalQuantityEl = section.querySelector('.section-total-quantity');
    const grandTotalEl = section.querySelector('.section-grand-total');

    if (totalQuantityEl) totalQuantityEl.textContent = totalQuantity;
    if (grandTotalEl) grandTotalEl.textContent = formatNumberWithCommas(grandTotal) + '원';

    // 전체 합계 업데이트
    updateGrandTotals();
}

/**
 * 모든 섹션의 합계를 합산하여 전체 합계 업데이트
 */
function updateGrandTotals() {
    const sections = document.querySelectorAll('.order-section');
    let totalSections = sections.length;
    let totalQuantity = 0;
    let totalAmount = 0;

    sections.forEach(section => {
        const rows = section.querySelectorAll('.product-row');
        rows.forEach(row => {
            const quantity = parseInt(row.querySelector('.quantity').value) || 0;
            const totalPriceValue = row.querySelector('.total-price').value;
            const totalPrice = parseFormattedNumber(totalPriceValue) || 0;

            totalQuantity += quantity;
            totalAmount += totalPrice;
        });
    });

    const sectionsEl = document.getElementById('grandTotalSections');
    const quantityEl = document.getElementById('grandTotalQuantity');
    const amountEl = document.getElementById('grandTotalAmount');

    if (sectionsEl) sectionsEl.textContent = totalSections + '건';
    if (quantityEl) quantityEl.textContent = totalQuantity;
    if (amountEl) amountEl.textContent = formatNumberWithCommas(totalAmount) + '원';
}
