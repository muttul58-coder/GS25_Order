// ========================================
// 상품 데이터 관리 함수
// ========================================

/**
 * 숫자만 입력된 상품코드를 "카테고리-번호"로 해석
 *
 * 카테고리 자릿수(2자리 / 3자리)를 범위로 추측하지 않고 PRODUCTS_DATA에
 * 실제로 존재하는 코드인지로 판별한다. 시즌마다 카테고리 체계가 바뀌어도
 * (예: 2026 추석은 08~94 전부 2자리) 코드 수정 없이 그대로 동작한다.
 *
 * @param {string} digits 숫자만으로 이루어진 문자열
 * @returns {{code: string, exact: boolean}|null}
 *          exact=true  → PRODUCTS_DATA에 존재하는 유일한 해석
 *          exact=false → 존재하지 않지만 형식상 가장 그럴듯한 해석
 *          null        → 아직 판단 불가(입력이 짧거나 해석이 둘 이상)
 */
function resolveCodeDigits(digits) {
    // 번호는 최대 2자리이므로 카테고리는 2자리 또는 3자리만 가능
    var candidates = [];
    for (var catLen = 2; catLen <= 3; catLen++) {
        var num = digits.slice(catLen);
        if (digits.length <= catLen || num.length > 2) continue;
        candidates.push(formatCodeForLookup(digits.slice(0, catLen) + '-' + num));
    }
    if (candidates.length === 0) return null;

    if (typeof PRODUCTS_DATA !== 'undefined' && PRODUCTS_DATA) {
        var hits = candidates.filter(function (c) { return PRODUCTS_DATA[c]; });
        if (hits.length === 1) return { code: hits[0], exact: true };
        // 2개 이상이면 모호 → 숫자를 더 받아야 판별 가능
        if (hits.length > 1) return null;
    }

    // 카탈로그에 없는 코드: 형식만 맞춰 돌려주고 "상품을 찾을 수 없음"으로 안내
    return { code: candidates[0], exact: false };
}

/**
 * 입력 중 하이픈 자동 삽입 (확실할 때만 개입)
 * @param {string} digits 숫자만으로 이루어진 문자열
 * @returns {string|null} 하이픈이 삽입된 코드 또는 null
 */
function autoInsertHyphen(digits) {
    var resolved = resolveCodeDigits(digits);
    return (resolved && resolved.exact) ? resolved.code : null;
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
                <option value="2+2">2+2</option>
                <option value="3+2">3+2</option>
                <option value="7+3">7+3</option>
            </select>
        </td>
        <td><input type="number" class="quantity" placeholder="0" min="0" inputmode="numeric" onfocus="this.select()" required></td>
        <td><input type="text" class="given-quantity" readonly tabindex="-1"></td>
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
 * 주문 상품 테이블에서 유효한 상품 목록 추출
 *
 * qty 는 구매 수량이 아니라 **지급 수량**이다. 배송 상품은 덤을 포함해
 * 실제로 나가는 개수를 배분해야 하므로 지급 수량이 기준이 된다.
 * 같은 상품코드가 여러 행에 입력된 경우 하나로 합산한다.
 * (합산하지 않으면 배송 상품 콤보박스에 같은 코드가 중복으로 표시된다)
 * @returns {Array} - [{code, name, qty}, ...]
 */
function getOrderProductList() {
    const rows = document.getElementById('productTableBody').querySelectorAll('.product-row');
    const byCode = new Map();
    rows.forEach(row => {
        const code = row.querySelector('.product-code').value.trim();
        const name = row.querySelector('.product-name').value.trim();
        const qty = getRowGivenQuantity(row);
        if (!code || !name) return;

        if (byCode.has(code)) {
            byCode.get(code).qty += qty;
        } else {
            byCode.set(code, { code, name, qty });
        }
    });
    return Array.from(byCode.values());
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

    // 고치기 직전 지급 수량을 기억 (증가/감소 판단 기준)
    quantity.addEventListener('focus', rememberGivenQuantities);

    // 입력이 확정됐을 때만 배송 배분을 정리한다 (타이핑 중간값으로 깎이면 복구 불가)
    quantity.addEventListener('change', () => {
        reconcileDeliveryQuantities();
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

    // 행사 변경 시 금액/지급수량 재계산
    // 행사가 바뀌면 지급 수량이 달라지므로 배송 배분도 다시 확인해야 한다
    if (eventType) {
        eventType.addEventListener('focus', rememberGivenQuantities);
        eventType.addEventListener('change', () => {
            calculateRowTotal(row);
            reconcileDeliveryQuantities();
        });
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
 * 행사를 반영한 지급 수량 계산
 *
 * '수량'은 손님이 결제하는 개수이고, 행사 "N+M"은 N개를 살 때마다 M개를
 * 덤으로 주는 것이다. 따라서 실제로 나가는 개수는 수량 + (수량 / N) * M 이다.
 *   1+1 : 1개 구매 → 2개 지급
 *   2+1 : 1개 구매 → 1개 지급 / 2개 구매 → 3개 지급 / 4개 구매 → 6개 지급
 *   7+3 : 7개 구매 → 10개 지급 / 14개 구매 → 20개 지급
 *
 * @param {number} quantity - 구매(결제) 수량
 * @param {string} eventValue - 행사 값 ("", "1+1", "2+1", "7+3" ...)
 * @returns {number} 실제 지급되는 수량
 */
function calculateGivenQuantity(quantity, eventValue) {
    if (!eventValue || quantity <= 0) return quantity;

    const parts = eventValue.split('+');
    const n = parseInt(parts[0]);
    // 덤 개수가 적히지 않은 예전 형식("2+")은 1개로 본다
    const bonus = parts.length > 1 ? (parseInt(parts[1]) || 1) : 1;
    if (!n || n <= 0) return quantity;

    return quantity + Math.floor(quantity / n) * bonus;
}

/**
 * 오늘 기준으로 적용되는 행사를 고른다
 *
 * 카탈로그는 사전행사와 본행사의 행사율을 따로 준다 (2026 추석은 601개 중
 * 118개가 서로 다르다). 기간은 products.js 의 PROMO_CONFIG 에서 온다.
 *   ~ 사전행사 시작 전 : 행사 없음
 *   사전행사 ~ 본행사 전 : eventPre
 *   본행사 ~            : eventMain
 *
 * @param {Object} productInfo - PRODUCTS_DATA 항목
 * @returns {{event: string, period: string}} period 는 'none'|'pre'|'main'
 */
function getApplicableEvent(productInfo) {
    if (!productInfo) return { event: '', period: 'none' };

    const cfg = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG) ? PROMO_CONFIG : {};
    // 날짜 형식이 같으므로 문자열 비교로 충분.
    // 관리자 테스트 모드가 켜져 있으면 그 기준 날짜를 쓴다 (js/admin-test.js).
    // 주문 일시·배송 희망일은 여기 영향을 받지 않는다.
    const today = (typeof getPromoDate === 'function') ? getPromoDate() : getTodayDate();

    if (cfg.mainStart && today >= cfg.mainStart) {
        return { event: productInfo.eventMain || '', period: 'main' };
    }
    // 사전행사가 아직 시작되지 않았으면 어떤 행사도 적용되지 않는다
    if (cfg.preStart && today < cfg.preStart) {
        return { event: '', period: 'none' };
    }
    // 사전행사 기간: 사전행사 대상이 아니면 행사 없음
    return { event: productInfo.eventPre || '', period: 'pre' };
}

/**
 * 카탈로그 행사를 행 의 '행사' 콤보박스에 적용
 *
 * 어디까지나 자동 입력이다. 매장 사정으로 행사가 다를 수 있으니 점원이
 * 언제든 직접 바꿀 수 있어야 한다.
 *
 * @param {HTMLElement} row - 상품 행
 * @param {Object} productInfo - PRODUCTS_DATA 항목
 * @returns {{event: string, period: string}} 실제로 선택된 행사
 */
function applyCatalogEvent(row, productInfo) {
    const select = row.querySelector('.event-type');
    if (!select) return { event: '', period: 'none' };

    const applicable = getApplicableEvent(productInfo);
    if (!applicable.event) {
        select.value = '';
        return applicable;
    }

    // 콤보박스에 없는 비율이면 항목을 만들어 준다.
    // 시즌마다 행사 종류가 바뀌므로 목록에 없다고 조용히 '없음'이 되면 안 된다.
    if (!select.querySelector(`option[value="${applicable.event}"]`)) {
        const option = document.createElement('option');
        option.value = applicable.event;
        option.textContent = applicable.event;
        select.appendChild(option);
    }
    select.value = applicable.event;
    return applicable;
}

/**
 * 상품 행의 지급 수량 (입력값에서 직접 계산)
 * @param {HTMLElement} row - 상품 행
 * @returns {number}
 */
function getRowGivenQuantity(row) {
    const quantity = parseInt(row.querySelector('.quantity').value) || 0;
    const eventSelect = row.querySelector('.event-type');
    return calculateGivenQuantity(quantity, eventSelect ? eventSelect.value : '');
}

/**
 * 개별 행의 지급 수량과 금액 계산
 *
 * 금액은 항상 수량 × 단가이다. 행사 할인은 값을 깎아주는 것이 아니라
 * 덤을 더 주는 방식이므로 청구액에는 영향을 주지 않는다.
 *
 * @param {HTMLElement} row - 대상 행 요소
 */
function calculateRowTotal(row) {
    const quantityInput = row.querySelector('.quantity');
    const unitPriceInput = row.querySelector('.unit-price');
    const totalPriceInput = row.querySelector('.total-price');
    const givenQuantityInput = row.querySelector('.given-quantity');
    const eventTypeSelect = row.querySelector('.event-type');

    const quantity = parseInt(quantityInput.value) || 0;
    const unitPrice = parseFormattedNumber(unitPriceInput.value) || 0;
    const eventValue = eventTypeSelect ? eventTypeSelect.value : '';

    // 지급 수량 표시
    if (givenQuantityInput) {
        const given = calculateGivenQuantity(quantity, eventValue);
        givenQuantityInput.value = given > 0 ? given : '';
        // 덤이 붙은 행은 눈에 띄게 표시
        givenQuantityInput.classList.toggle('has-bonus', given > quantity);
    }

    // 금액 필드에 천단위 쉼표가 포함된 값 설정
    totalPriceInput.value = formatNumberWithCommas(quantity * unitPrice);

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
    let totalGiven = 0;
    let grandTotal = 0;

    // 모든 행의 수량, 지급 수량, 금액을 합산
    rows.forEach(row => {
        const quantity = parseInt(row.querySelector('.quantity').value) || 0;
        const givenInput = row.querySelector('.given-quantity');
        const given = givenInput ? (parseInt(givenInput.value) || 0) : quantity;
        const totalPriceValue = row.querySelector('.total-price').value;
        const totalPrice = parseFormattedNumber(totalPriceValue) || 0;

        totalQuantity += quantity;
        totalGiven += given;
        grandTotal += totalPrice;
    });

    // 합계 필드 업데이트 (천단위 쉼표 포함)
    const totalQuantityEl = document.getElementById('totalQuantity');
    const totalGivenEl = document.getElementById('totalGivenQuantity');
    const grandTotalEl = document.getElementById('totalAmount');

    if (totalQuantityEl) totalQuantityEl.textContent = totalQuantity;
    if (totalGivenEl) totalGivenEl.textContent = totalGiven;
    if (grandTotalEl) grandTotalEl.textContent = formatNumberWithCommas(grandTotal);
}

/**
 * 바코드 이미지 영역 업데이트
 * 상품 행의 상품코드를 수집하여 바코드 이미지를 표시
 */
const BARCODE_SLOTS_PER_ROW = 4;

/**
 * 바코드 한 줄(tr) 생성
 */
function createBarcodeRow() {
    const tr = document.createElement('tr');
    tr.className = 'barcode-row';

    const td = document.createElement('td');
    td.colSpan = 12;
    td.className = 'barcode-container';

    const grid = document.createElement('div');
    grid.className = 'barcode-grid';
    for (let i = 0; i < BARCODE_SLOTS_PER_ROW; i++) {
        const slot = document.createElement('div');
        slot.className = 'barcode-slot';
        grid.appendChild(slot);
    }

    td.appendChild(grid);
    tr.appendChild(td);
    return tr;
}

/**
 * 바코드를 감쌀 카탈로그 링크. 주소를 모르면 null 을 돌려준다.
 *
 * 주소는 PROMO_CONFIG.catalogSearch 에 시즌마다 새로 생성된다
 * (tools/update_season.py). 여기에 상수로 적어 두면 다음 시즌에
 * 지난 시즌 카탈로그가 열려 엉뚱한 상품을 보여주게 된다.
 *
 * @param {string} code - 상품코드 (예: 08-01)
 * @returns {HTMLAnchorElement|null}
 */
function catalogSearchLink(code) {
    const base = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG)
        ? PROMO_CONFIG.catalogSearch : '';
    if (!base) return null;

    const a = document.createElement('a');
    a.href = base + encodeURIComponent(code);
    a.target = '_blank';
    // 새 창에서 원래 주문서 창을 건드리지 못하게 한다
    a.rel = 'noopener noreferrer';
    a.className = 'barcode-link';
    a.title = code + ' 상품 정보를 카탈로그에서 보기 (새 창)';
    return a;
}

function updateBarcodeImages() {
    const tbody = document.getElementById('productTableBody');
    const table = document.getElementById('productTable');
    const tfoot = table ? table.querySelector('tfoot') : null;
    if (!tbody || !tfoot) return;

    // 유효한 상품코드 수집
    const codes = [];
    tbody.querySelectorAll('.product-row').forEach(row => {
        const code = row.querySelector('.product-code').value.trim();
        if (code && code.includes('-')) {
            codes.push(code);
        }
    });

    // 필요한 줄 수만큼 바코드 행을 늘리거나 줄인다 (상품 개수 제한 없음, 최소 1줄 유지)
    const needed = Math.max(1, Math.ceil(codes.length / BARCODE_SLOTS_PER_ROW));
    const rows = Array.from(tfoot.querySelectorAll('.barcode-row'));

    while (rows.length < needed) {
        const tr = createBarcodeRow();
        tfoot.appendChild(tr);
        rows.push(tr);
    }
    while (rows.length > needed) {
        rows.pop().remove();
    }

    // 슬롯 채우기
    rows.forEach((tr, rowIndex) => {
        tr.style.display = '';
        tr.querySelectorAll('.barcode-slot').forEach((slot, i) => {
            slot.innerHTML = '';
            const code = codes[rowIndex * BARCODE_SLOTS_PER_ROW + i];
            if (!code) return;
            const img = document.createElement('img');
            img.src = 'BarcodeImgs/' + code + '.jpg';
            img.alt = code;
            img.onerror = function () { this.style.display = 'none'; };

            const link = catalogSearchLink(code);
            if (link) {
                // 바코드를 누르면 카탈로그에서 그 상품을 새 창으로 확인할 수 있다.
                // 점원이 상품 사진과 구성을 손님에게 보여줄 때 쓴다.
                link.appendChild(img);
                slot.appendChild(link);
            } else {
                slot.appendChild(img);
            }
        });
    });
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

                // 카탈로그의 구매혜택에서 가져온 행사를 자동 선택 (직접 바꿀 수 있음)
                const appliedEvent = applyCatalogEvent(row, productInfo);

                if (productInfo.marketPrice) {
                    // 금/은 등 시세반영 상품: 단가를 비워두고 직접 입력받는다
                    unitPriceInput.value = '';
                    unitPriceInput.placeholder = '시세 입력';
                    calculateRowTotal(row);
                    showAlert(`💡 [${formattedCode}] 시세반영 상품입니다. 당일 단가를 입력해주세요.`, 'warning');
                    setTimeout(() => unitPriceInput.focus(), 100);
                } else {
                    // 단가를 상품 정보의 가격으로 자동 입력 (천단위 쉼표 포함)
                    unitPriceInput.value = formatNumberWithCommas(productInfo.price);
                    unitPriceInput.placeholder = '______';

                    // 금액 재계산 (천단위 쉼표 포함)
                    calculateRowTotal(row);

                    // 행사 필드로 포커스 이동
                    const eventTypeSelect = row.querySelector('.event-type');
                    if (eventTypeSelect) {
                        setTimeout(() => eventTypeSelect.focus(), 100);
                    }
                }

                if (appliedEvent.event) {
                    // 사전행사 혜택은 조건부인 경우가 있다(2026 추석은 특정 카드 결제 건).
                    // 조건을 빼고 알리면 점원이 덤을 약속했다가 못 주게 된다.
                    const preNote = (typeof PROMO_CONFIG !== 'undefined' && PROMO_CONFIG)
                        ? PROMO_CONFIG.preNote : '';
                    const condition = (appliedEvent.period === 'pre' && preNote)
                        ? ` (사전행사 · ${preNote})` : '';
                    showAlert(`🎁 [${formattedCode}] ${appliedEvent.event} 행사 상품입니다${condition}. 행사가 다르면 직접 바꿔주세요.`, 'success');
                }

                console.log(`상품 정보 자동완성: ${formattedCode} -> ${productInfo.name} (수량: ${quantityInput.value}, 단가: ${productInfo.marketPrice ? '시세반영' : productInfo.price + '원'}, 행사: ${appliedEvent.event || '없음'}/${appliedEvent.period})`);
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

                if (productInfo.marketPrice) {
                    // 시세반영 상품은 단가를 채우지 않는다 (blur/Enter 시 안내)
                    unitPriceInput.placeholder = '시세 입력';
                } else {
                    // 단가를 상품 정보의 가격으로 자동 입력 (천단위 쉼표 포함)
                    unitPriceInput.value = formatNumberWithCommas(productInfo.price);
                    unitPriceInput.placeholder = '______';
                }

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

    // 하이픈이 없는 경우 - 숫자만으로 해석 시도 후, 실패하면 오류
    if (!value.includes('-')) {
        const resolved = resolveCodeDigits(value);
        if (resolved) {
            input.value = resolved.code;
            return true;
        }
        input.classList.add('error');
        input.value = value;
        showAlert('⚠️ 상품 코드 형식이 올바르지 않습니다. (예: 08-01)', 'warning');
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
