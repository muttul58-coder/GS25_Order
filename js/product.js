// ========================================
// 상품 데이터 관리 함수
// ========================================

/**
 * 숫자만 입력된 상품코드에 하이픈 자동 삽입
 * PRODUCTS_DATA를 참조하여 3자리 카테고리(100~106)와 2자리 카테고리를 정확히 구분
 * @param {string} digits 숫자만으로 이루어진 문자열
 * @returns {string|null} 하이픈이 삽입된 코드 또는 null(아직 판단 불가)
 */
function autoInsertHyphen(digits) {
    var hasData = (typeof PRODUCTS_DATA !== 'undefined' && PRODUCTS_DATA);

    // 3자리 입력: "100"~"106"이면 3자리 카테고리 가능성 → 대기
    if (digits.length === 3) {
        var num3 = parseInt(digits);
        if (num3 >= 100 && num3 <= 106) {
            return null; // 아직 판단 불가, 추가 입력 대기
        }
        // 그 외는 2자리 카테고리 (예: "081" → "08-1")
        return digits.slice(0, 2) + '-' + digits.slice(2);
    }

    // 4자리 입력: "100x"~"106x"이면 3자리 카테고리 가능성 → 대기
    if (digits.length === 4) {
        var prefix3 = parseInt(digits.slice(0, 3));
        if (prefix3 >= 100 && prefix3 <= 106) {
            return null; // "1060" 등은 5자리 완성을 대기
        }
        // 그 외는 2자리 카테고리 (예: "0801" → "08-01")
        return digits.slice(0, 2) + '-' + digits.slice(2);
    }

    // 5자리 이상 입력: 3자리 vs 2자리 카테고리 판별
    if (digits.length >= 5) {
        var cat3 = digits.slice(0, 3); // 3자리 카테고리 후보
        var cat3num = parseInt(cat3);

        // 3자리 카테고리 범위(100~106)이면 PRODUCTS_DATA로 확인
        if (cat3num >= 100 && cat3num <= 106) {
            var code3 = cat3 + '-' + digits.slice(3);
            var code2 = digits.slice(0, 2) + '-' + digits.slice(2);

            if (hasData) {
                // 3자리 카테고리로 매칭되는 상품이 있으면 3자리 우선
                var formatted3 = formatCodeForLookup(code3);
                var formatted2 = formatCodeForLookup(code2);
                if (PRODUCTS_DATA[formatted3]) {
                    return code3;
                }
                if (PRODUCTS_DATA[formatted2]) {
                    return code2;
                }
                // 둘 다 없으면 3자리 카테고리 우선 (100~106 범위이므로)
                return code3;
            }
            // 데이터 없으면 3자리 카테고리 우선
            return code3;
        }

        // 100 미만이면 2자리 카테고리
        return digits.slice(0, 2) + '-' + digits.slice(2);
    }

    return null;
}

/**
 * 코드 문자열을 PRODUCTS_DATA 조회용으로 포맷팅 (패딩 적용)
 * @param {string} code "106-1" → "106-01", "8-1" → "08-01"
 */
function formatCodeForLookup(code) {
    var parts = code.split('-');
    if (parts.length !== 2) return code;
    var cat = parts[0];
    var num = parts[1];
    // 카테고리: 1자리면 2자리로 패딩 (8 → 08), 3자리는 그대로
    if (cat.length === 1) cat = '0' + cat;
    // 번호: 1자리면 2자리로 패딩 (1 → 01)
    if (num.length === 1) num = '0' + num;
    return cat + '-' + num;
}

/**
 * 상품 데이터 로드 상태 확인 및 표시
 */
function checkProductsDataLoaded() {
    const statusDiv = document.getElementById('productDataStatus');
    const statusText = document.getElementById('productDataStatusText');

    if (!statusDiv || !statusText) {
        // 설정 패널이 제거된 경우 콘솔 로그만 출력
        if (typeof PRODUCTS_DATA !== 'undefined' && PRODUCTS_DATA) {
            console.log('상품 데이터 로드 완료:', PRODUCTS_DATA);
            return true;
        }
        return false;
    }

    if (typeof PRODUCTS_DATA !== 'undefined' && PRODUCTS_DATA) {
        const productCount = Object.keys(PRODUCTS_DATA).length;
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.style.border = '2px solid #c3e6cb';
        statusText.innerHTML = `✅ <strong>products.js</strong> 로드 완료 (상품 <strong>${productCount}</strong>개)`;
        console.log('상품 데이터 로드 완료:', PRODUCTS_DATA);
        showAlert(`✅ 상품 데이터가 성공적으로 로드되었습니다! (상품 ${productCount}개)`, 'success');
        return true;
    } else {
        statusDiv.style.backgroundColor = '#ffebee';
        statusDiv.style.border = '2px solid #f44336';
        statusText.innerHTML = '❌ <strong>products.js</strong> 파일을 찾을 수 없습니다. HTML 파일과 같은 폴더에 있는지 확인해주세요.';
        console.error('products.js 파일이 로드되지 않았습니다.');
        showAlert('⚠️ products.js 파일을 HTML 파일과 같은 폴더에 위치시켜주세요.', 'error');
        return false;
    }
}

/**
 * 상품 코드로 상품 정보 검색
 * @param {string} code - 상품 코드 (예: "08-01")
 * @returns {Object|null} - 상품 정보 또는 null
 */
function getProductInfo(code) {
    if (typeof PRODUCTS_DATA === 'undefined' || !PRODUCTS_DATA) {
        return null;
    }
    return PRODUCTS_DATA[code] || null;
}

// ========================================
// 상품 행 관리 함수
// ========================================

/**
 * 섹션 내에 새로운 상품 행 추가
 */
function addProductRow() {
    const tbody = document.getElementById('productTableBody');
    const rows = tbody.querySelectorAll('.product-row');

    // 현재 마지막 행이 완료되었는지 확인
    if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        const productCode = lastRow.querySelector('.product-code');
        const quantity = lastRow.querySelector('.quantity');
        const unitPrice = lastRow.querySelector('.unit-price');

        if (!productCode.value.trim()) {
            productCode.focus();
            productCode.classList.add('error');
            showAlert('⚠️ 현재 상품의 코드를 먼저 입력해주세요.', 'warning');
            setTimeout(() => productCode.classList.remove('error'), 3000);
            return;
        }
        if (!quantity.value || parseInt(quantity.value) <= 0) {
            quantity.focus();
            quantity.classList.add('error');
            showAlert('⚠️ 현재 상품의 수량을 먼저 입력해주세요.', 'warning');
            setTimeout(() => quantity.classList.remove('error'), 3000);
            return;
        }
        if (!unitPrice.value || parseInt(unitPrice.value) <= 0) {
            unitPrice.focus();
            unitPrice.classList.add('error');
            showAlert('⚠️ 현재 상품의 단가를 먼저 입력해주세요.', 'warning');
            setTimeout(() => unitPrice.classList.remove('error'), 3000);
            return;
        }
    }

    const nextRowNumber = rows.length + 1;

    // 새 행 생성
    const newRow = document.createElement('tr');
    newRow.className = 'product-row';
    newRow.setAttribute('data-row', nextRowNumber);

    // 행 HTML 구조 생성
    newRow.innerHTML = `
        <td class="row-number">${nextRowNumber}</td>
        <td><input type="text" class="product-code" placeholder="00-00" inputmode="numeric" required></td>
        <td><input type="text" class="product-name" placeholder="상품이름" readonly></td>
        <td>
            <select class="event-type">
                <option value="">없음</option>
                <option value="1+1">1+1</option>
                <option value="2+1">2+1</option>
                <option value="3+1">3+1</option>
                <option value="4+1">4+1</option>
                <option value="5+1">5+1</option>
                <option value="6+1">6+1</option>
                <option value="7+1">7+1</option>
                <option value="8+1">8+1</option>
                <option value="9+1">9+1</option>
                <option value="10+1">10+1</option>
                <option value="11+1">11+1</option>
                <option value="12+1">12+1</option>
                <option value="13+1">13+1</option>
                <option value="14+1">14+1</option>
                <option value="15+1">15+1</option>
                <option value="16+1">16+1</option>
                <option value="17+1">17+1</option>
                <option value="18+1">18+1</option>
                <option value="19+1">19+1</option>
                <option value="20+1">20+1</option>
            </select>
        </td>
        <td><input type="number" class="quantity" placeholder="0" min="0" inputmode="numeric" onfocus="this.select()" required></td>
        <td><input type="text" class="unit-price" placeholder="______" required></td>
        <td><input type="text" class="total-price" readonly></td>
        <td class="no-print">
            <div class="action-buttons">
                <button type="button" class="remove-btn" onclick="removeProductRow(this)">삭제</button>
            </div>
        </td>
    `;

    // tbody에 새 행 추가
    tbody.appendChild(newRow);

    // 새로 추가된 행에 이벤트 리스너 및 포맷팅 적용
    attachRowEventListeners(newRow);
    attachProductCodeFormatting(newRow);

    // 합계 업데이트
    updateProductTotals();

    // 배송 상품 콤보박스 동기화
    refreshAllDeliveryProductSelects();
    // 바코드 이미지 업데이트
    updateBarcodeImages();

    showAlert('✅ 새로운 상품 행이 추가되었습니다.', 'success');

    // 상품코드 필드에 포커스
    const newProductCode = newRow.querySelector('.product-code');
    if (newProductCode) {
        setTimeout(() => newProductCode.focus(), 50);
    }
}

/**
 * 상품 행 삭제
 * @param {HTMLElement} button - 삭제 버튼 요소
 */
function removeProductRow(button) {
    const tbody = document.getElementById('productTableBody');
    const rows = tbody.querySelectorAll('.product-row');

    // 최소 1개의 행은 유지해야 함
    if (rows.length <= 1) {
        showAlert('⚠️ 최소 1개의 상품은 있어야 합니다.', 'warning');
        return;
    }

    const row = button.closest('.product-row');
    row.remove();

    // 행 번호 재정렬
    renumberProductRows();

    // 합계 업데이트
    updateProductTotals();

    // 배송 상품 콤보박스 동기화
    refreshAllDeliveryProductSelects();
    // 바코드 이미지 업데이트
    updateBarcodeImages();

    showAlert('✅ 상품 행이 삭제되었습니다.', 'success');
}

/**
 * 상품 테이블 내 모든 행의 번호를 재정렬
 */
function renumberProductRows() {
    const tbody = document.getElementById('productTableBody');
    const rows = tbody.querySelectorAll('.product-row');
    rows.forEach((row, index) => {
        const rowNumber = row.querySelector('.row-number');
        if (rowNumber) {
            rowNumber.textContent = index + 1;
        }
        row.setAttribute('data-row', index + 1);
    });
}

/**
 * 주문 상품 테이블에서 유효한 상품 목록 추출 (수량 포함)
 * @returns {Array} - [{code, name, qty}, ...]
 */
function getOrderProductList() {
    const rows = document.getElementById('productTableBody').querySelectorAll('.product-row');
    const list = [];
    rows.forEach(row => {
        const code = row.querySelector('.product-code').value.trim();
        const name = row.querySelector('.product-name').value.trim();
        const qty = parseInt(row.querySelector('.quantity').value) || 0;
        if (code && name) {
            list.push({ code, name, qty });
        }
    });
    return list;
}

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
    const eventType = row.querySelector('.event-type');

    // 수량 변경 시 금액 재계산 및 배송 수량 검증
    quantity.addEventListener('input', () => {
        // 음수 방지
        if (quantity.value && parseInt(quantity.value) < 0) {
            quantity.value = 0;
        }
        calculateRowTotal(row);
        validateDeliveryQuantities();
    });

    // 수량 필드에서 Enter 시 다음 행의 상품코드로 이동 (없으면 새 행 추가)
    quantity.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const tbody = document.getElementById('productTableBody');
            const rows = Array.from(tbody.querySelectorAll('.product-row'));
            const currentIndex = rows.indexOf(row);
            if (currentIndex < rows.length - 1) {
                // 다음 행의 상품코드에 포커스
                const nextCode = rows[currentIndex + 1].querySelector('.product-code');
                if (nextCode) nextCode.focus();
            } else {
                // 마지막 행이면 새 행 추가
                addProductRow();
            }
        }
    });

    // 행사 변경 시 금액 재계산
    if (eventType) {
        eventType.addEventListener('change', () => calculateRowTotal(row));
    }

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
    const eventTypeSelect = row.querySelector('.event-type');

    const quantity = parseInt(quantityInput.value) || 0;
    const unitPrice = parseFormattedNumber(unitPriceInput.value) || 0;
    const eventValue = eventTypeSelect ? eventTypeSelect.value : '';

    let total = 0;

    if (eventValue && quantity > 0 && unitPrice > 0) {
        // 행사 적용: "N+1" → (N+1)개 묶음당 N개만 결제
        const n = parseInt(eventValue.split('+')[0]);
        const bundleSize = n + 1;       // 묶음 크기 (예: 2+1 → 3개)
        const bundles = Math.floor(quantity / bundleSize); // 완성된 묶음 수
        const remainder = quantity % bundleSize;           // 나머지 개수
        const paidQuantity = (bundles * n) + remainder;    // 실제 결제 수량
        total = paidQuantity * unitPrice;
    } else {
        total = quantity * unitPrice;
    }

    // 금액 필드에 천단위 쉼표가 포함된 값 설정
    totalPriceInput.value = formatNumberWithCommas(total);

    // 합계 업데이트
    updateProductTotals();
}

/**
 * 상품 테이블의 총 수량과 총 금액 계산 및 업데이트
 */
function updateProductTotals() {
    const tbody = document.getElementById('productTableBody');
    const rows = tbody.querySelectorAll('.product-row');
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
    const totalQuantityEl = document.getElementById('totalQuantity');
    const grandTotalEl = document.getElementById('totalAmount');

    if (totalQuantityEl) totalQuantityEl.textContent = totalQuantity;
    if (grandTotalEl) grandTotalEl.textContent = formatNumberWithCommas(grandTotal);
}

/**
 * 바코드 이미지 영역 업데이트
 * 상품 행의 상품코드를 수집하여 바코드 이미지를 표시
 */
function updateBarcodeImages() {
    const tbody = document.getElementById('productTableBody');
    const rows = tbody.querySelectorAll('.product-row');
    const row1 = document.querySelector('.barcode-row-1 .barcode-grid');
    const row2 = document.querySelector('.barcode-row-2 .barcode-grid');
    const row3 = document.querySelector('.barcode-row-3 .barcode-grid');
    const row2Tr = document.querySelector('.barcode-row-2');
    const row3Tr = document.querySelector('.barcode-row-3');

    if (!row1 || !row2 || !row3) return;

    // 유효한 상품코드 수집
    const codes = [];
    rows.forEach(row => {
        const code = row.querySelector('.product-code').value.trim();
        if (code && code.includes('-')) {
            codes.push(code);
        }
    });

    // 1줄 슬롯 (0~3)
    const slots1 = row1.querySelectorAll('.barcode-slot');
    // 2줄 슬롯 (4~7)
    const slots2 = row2.querySelectorAll('.barcode-slot');
    // 3줄 슬롯 (8~11)
    const slots3 = row3.querySelectorAll('.barcode-slot');

    // 1줄 업데이트
    slots1.forEach((slot, i) => {
        slot.innerHTML = '';
        if (codes[i]) {
            const img = document.createElement('img');
            img.src = 'BarcodeImgs/' + codes[i] + '.jpg';
            img.alt = codes[i];
            img.onerror = function () { this.style.display = 'none'; };
            slot.appendChild(img);
        }
    });

    // 2줄 업데이트
    let hasRow2 = false;
    slots2.forEach((slot, i) => {
        slot.innerHTML = '';
        const idx = i + 4;
        if (codes[idx]) {
            const img = document.createElement('img');
            img.src = 'BarcodeImgs/' + codes[idx] + '.jpg';
            img.alt = codes[idx];
            img.onerror = function () { this.style.display = 'none'; };
            slot.appendChild(img);
            hasRow2 = true;
        }
    });

    // 3줄 업데이트
    let hasRow3 = false;
    slots3.forEach((slot, i) => {
        slot.innerHTML = '';
        const idx = i + 8;
        if (codes[idx]) {
            const img = document.createElement('img');
            img.src = 'BarcodeImgs/' + codes[idx] + '.jpg';
            img.alt = codes[idx];
            img.onerror = function () { this.style.display = 'none'; };
            slot.appendChild(img);
            hasRow3 = true;
        }
    });

    // 2줄, 3줄 표시/숨김
    row2Tr.style.display = hasRow2 ? '' : 'none';
    row3Tr.style.display = hasRow3 ? '' : 'none';
}

// ========================================
// 상품 코드 포맷팅 및 자동완성 함수
// ========================================

/**
 * 상품 코드 입력 필드에 포맷팅 및 자동완성 기능 추가
 * @param {HTMLElement} row - 대상 행 요소
 */
function attachProductCodeFormatting(row) {
    const productCodeInput = row.querySelector('.product-code');
    const productNameInput = row.querySelector('.product-name');
    const quantityInput = row.querySelector('.quantity');
    const unitPriceInput = row.querySelector('.unit-price');

    /**
     * 상품코드 검색 실행 (blur/Enter 공용)
     */
    function searchProductCode() {
        const code = productCodeInput.value.trim();

        // 상품 코드가 비어있으면 필드 초기화
        if (!code) {
            productNameInput.value = '';
            productNameInput.placeholder = '상품이름';
            quantityInput.value = '0';
            unitPriceInput.value = '';
            row.querySelector('.total-price').value = '';
            calculateRowTotal(row);
            return;
        }

        // 상품 코드 포맷팅
        const formatSuccess = formatProductCode(productCodeInput);

        // 포맷팅이 실패하면 상품이름, 단가, 금액 지우기
        if (!formatSuccess) {
            productNameInput.value = '';
            productNameInput.placeholder = '※ 상품 코드 형식 오류';
            quantityInput.value = '0';
            unitPriceInput.value = '';
            row.querySelector('.total-price').value = '';
            calculateRowTotal(row);
            return;
        }

        // 포맷팅된 코드로 상품 정보 검색
        const formattedCode = productCodeInput.value.trim();

        if (formattedCode) {
            // products.js 파일이 로드되었는지 확인
            if (typeof PRODUCTS_DATA === 'undefined' || !PRODUCTS_DATA) {
                productNameInput.value = '';
                productNameInput.placeholder = '※ products.js 파일 로드 필요';
                console.error('products.js 파일이 로드되지 않았습니다.');
                return;
            }

            const productInfo = getProductInfo(formattedCode);

            if (productInfo) {
                // 상품이름 자동 입력
                productNameInput.value = productInfo.name;
                productNameInput.placeholder = '상품이름';

                // 수량을 1로 설정
                quantityInput.value = '1';

                // 단가를 상품 정보의 가격으로 자동 입력 (천단위 쉼표 포함)
                unitPriceInput.value = formatNumberWithCommas(productInfo.price);

                // 금액 재계산 (천단위 쉼표 포함)
                calculateRowTotal(row);

                // 행사 필드로 포커스 이동
                const eventTypeSelect = row.querySelector('.event-type');
                if (eventTypeSelect) {
                    setTimeout(() => eventTypeSelect.focus(), 100);
                }

                console.log(`상품 정보 자동완성: ${formattedCode} -> ${productInfo.name} (수량: ${quantityInput.value}, 단가: ${productInfo.price}원)`);
            } else {
                // 상품을 찾지 못한 경우
                productNameInput.value = '';
                quantityInput.value = '0';
                unitPriceInput.value = '';
                row.querySelector('.total-price').value = '';
                productNameInput.placeholder = '※ 상품을 찾을 수 없음';
                console.log(`상품 코드 "${formattedCode}"에 해당하는 상품을 찾을 수 없습니다.`);

                // 상품코드로 포커스 이동 및 전체 선택
                setTimeout(() => {
                    productCodeInput.focus();
                    productCodeInput.select();
                }, 100);
            }
        }

        // 배송 상품 콤보박스 동기화
        refreshAllDeliveryProductSelects();
        // 바코드 이미지 업데이트
        updateBarcodeImages();
    }

    // Enter 키 입력 시 검색 실행
    productCodeInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchProductCode();
        }
    });

    // 포커스 아웃 시 검색 실행
    productCodeInput.addEventListener('blur', function() {
        searchProductCode();
    });

    // 실시간으로도 확인 (입력 중) + 하이픈 자동 삽입
    productCodeInput.addEventListener('input', function() {
        let code = this.value;

        // 숫자와 하이픈만 허용
        code = code.replace(/[^0-9-]/g, '');
        if (code !== this.value) {
            this.value = code;
        }

        // 하이픈 자동 삽입: 숫자만 입력되었을 때 카테고리-번호 자동 분리
        if (!code.includes('-') && code.length >= 3) {
            var inserted = autoInsertHyphen(code);
            if (inserted) {
                this.value = inserted;
                code = inserted;
            }
        }

        code = code.trim();

        // 코드가 비어있으면 상품이름 지우기
        if (!code) {
            productNameInput.value = '';
            productNameInput.placeholder = '상품이름';
            return;
        }

        // products.js가 로드되어 있고, 코드에 하이픈이 있을 때만 실시간 검색
        if (typeof PRODUCTS_DATA !== 'undefined' && PRODUCTS_DATA && code && code.includes('-')) {
            const productInfo = getProductInfo(code);
            if (productInfo) {
                productNameInput.value = productInfo.name;
                productNameInput.placeholder = '상품이름';

                // 수량을 상품 정보의 기본 수량으로 설정 (있는 경우)
                if (productInfo.quantity) {
                    quantityInput.value = productInfo.quantity;
                }

                // 단가를 상품 정보의 가격으로 자동 입력 (천단위 쉼표 포함)
                unitPriceInput.value = formatNumberWithCommas(productInfo.price);

                // 금액 재계산 (천단위 쉼표 포함)
                calculateRowTotal(row);
            } else {
                productNameInput.value = '';
                productNameInput.placeholder = '상품이름';
            }
        }
    });
}

/**
 * 상품 코드를 표준 형식으로 포맷팅
 * 형식: 00-00 또는 000-00 (예: 8-1 → 08-01, 106-1 → 106-01)
 * @param {HTMLInputElement} input - 상품 코드 입력 필드
 * @returns {boolean} - 포맷팅 성공 여부
 */
function formatProductCode(input) {
    // 숫자와 하이픈만 허용
    let value = input.value.replace(/[^0-9-]/g, '');

    if (!value) {
        // 빈 값이면 처리 안 함
        return true;
    }

    // 하이픈이 없는 경우 - 오류
    if (!value.includes('-')) {
        input.classList.add('error');
        input.value = value;
        showAlert('⚠️ 상품 코드는 하이픈(-)을 포함해야 합니다. (예: 08-01)', 'warning');
        setTimeout(() => {
            input.classList.remove('error');
        }, 3000);
        return false;
    }

    // 하이픈이 여러 개인 경우 - 첫 번째 하이픈만 사용
    const parts = value.split('-');
    if (parts.length > 2) {
        // 첫 번째와 두 번째 부분만 사용
        value = parts[0] + '-' + parts.slice(1).join('');
    }

    // 하이픈으로 분리
    const [part1, part2] = value.split('-');

    // 앞부분과 뒷부분이 모두 있어야 함
    if (!part1 || !part2) {
        input.classList.add('error');
        input.value = value;
        showAlert('⚠️ 상품 코드 형식이 올바르지 않습니다. (예: 08-01)', 'warning');
        setTimeout(() => {
            input.classList.remove('error');
        }, 3000);
        return false;
    }

    // 앞부분 포맷팅: 1자리면 0 추가, 2자리 이상이면 그대로 (최대 3자리)
    let formattedPart1 = part1;
    if (part1.length === 1) {
        formattedPart1 = '0' + part1;
    } else if (part1.length > 3) {
        formattedPart1 = part1.substring(0, 3);
    }

    // 뒷부분 포맷팅: 2자리로 패딩 (00-99)
    let formattedPart2 = part2.padStart(2, '0').substring(0, 2);

    // 최종 포맷팅된 값
    const formattedValue = `${formattedPart1}-${formattedPart2}`;
    input.value = formattedValue;

    return true;
}
