// ========================================
// 배송 상품 관리 함수
// ========================================

/**
 * 모든 배송 정보 섹션의 배송 상품 콤보박스 옵션 갱신
 */
function refreshAllDeliveryProductSelects() {
    document.querySelectorAll('.order-section').forEach(section => {
        refreshDeliveryProductSelects(section);
    });
    validateDeliveryQuantities();
}

/**
 * 특정 섹션의 배송 상품 콤보박스 옵션 갱신
 * - 다른 섹션에서 이미 주문 수량만큼 배분된 상품은 목록에서 제외
 * @param {HTMLElement} section - order-section 요소
 */
function refreshDeliveryProductSelects(section) {
    const products = getOrderProductList();

    // 다른 섹션에서 이미 배분된 수량 합산
    const otherAllocated = {};
    document.querySelectorAll('.order-section').forEach(otherSection => {
        if (otherSection === section) return; // 현재 섹션은 제외
        otherSection.querySelectorAll('.delivery-product-row').forEach(row => {
            const code = row.querySelector('.delivery-product-code-select').value;
            const qty = parseInt(row.querySelector('.delivery-product-qty').value) || 0;
            if (code) {
                otherAllocated[code] = (otherAllocated[code] || 0) + qty;
            }
        });
    });

    // 잔량이 남은 상품만 필터링
    const availableProducts = products.filter(p => {
        const allocated = otherAllocated[p.code] || 0;
        return p.qty - allocated > 0;
    });

    const selects = section.querySelectorAll('.delivery-product-code-select');
    selects.forEach(select => {
        const currentValue = select.value;

        // 같은 섹션 내 다른 콤보박스에서 이미 선택된 상품코드 수집
        const usedInSection = new Set();
        section.querySelectorAll('.delivery-product-code-select').forEach(otherSelect => {
            if (otherSelect === select) return; // 자기 자신은 제외
            if (otherSelect.value) {
                usedInSection.add(otherSelect.value);
            }
        });

        // 기존 옵션 제거 (첫 번째 "-- 선택 --" 제외)
        while (select.options.length > 1) {
            select.remove(1);
        }
        // 잔량이 남고, 같은 섹션에서 아직 선택되지 않은 상품만 옵션 추가
        availableProducts.forEach(p => {
            if (usedInSection.has(p.code)) return; // 같은 섹션에서 이미 선택됨
            const option = document.createElement('option');
            option.value = p.code;
            option.textContent = p.code;
            select.appendChild(option);
        });
        // 기존 선택값 복원 (현재 선택된 상품은 항상 유지)
        if (currentValue) {
            if (!select.querySelector('option[value="' + currentValue + '"]') && products.some(p => p.code === currentValue)) {
                const option = document.createElement('option');
                option.value = currentValue;
                option.textContent = currentValue;
                select.appendChild(option);
            }
            select.value = currentValue;
        } else {
            select.value = '';
            // 상품이름 필드도 초기화
            const row = select.closest('.delivery-product-row');
            if (row) {
                row.querySelector('.delivery-product-name').value = '';
            }
        }
    });
}

/**
 * 배송 상품 콤보박스 변경 시 상품이름 자동 표시
 * @param {HTMLSelectElement} select - 콤보박스 요소
 */
function onDeliveryProductCodeChange(select) {
    const row = select.closest('.delivery-product-row');
    const nameInput = row.querySelector('.delivery-product-name');
    const selectedCode = select.value;

    if (!selectedCode) {
        nameInput.value = '';
        return;
    }

    // 주문 상품 목록에서 해당 상품 이름 찾기
    const products = getOrderProductList();
    const found = products.find(p => p.code === selectedCode);
    nameInput.value = found ? found.name : '';

    validateDeliveryQuantities();
}

/**
 * 배송 상품 행 추가
 * @param {HTMLElement} button - 추가 버튼 요소
 */
function addDeliveryProductRow(button) {
    const section = button.closest('.order-section');
    const tbody = section.querySelector('.delivery-product-body');
    const rows = tbody.querySelectorAll('.delivery-product-row');
    const nextRowNumber = rows.length + 1;

    const newRow = document.createElement('tr');
    newRow.className = 'delivery-product-row';
    newRow.setAttribute('data-row', nextRowNumber);
    newRow.innerHTML = `
        <td class="row-number">${nextRowNumber}</td>
        <td>
            <select class="delivery-product-code-select" onchange="onDeliveryProductCodeChange(this)">
                <option value="">-- 선택 --</option>
            </select>
        </td>
        <td><input type="text" class="delivery-product-name" placeholder="상품이름" readonly></td>
        <td><input type="number" class="delivery-product-qty" placeholder="0" min="0" onfocus="this.select()" onchange="validateDeliveryQuantities()" oninput="validateDeliveryQuantities()"></td>
        <td class="no-print">
            <div class="action-buttons">
                <button type="button" class="remove-btn" onclick="removeDeliveryProductRow(this)">삭제</button>
            </div>
        </td>
    `;
    tbody.appendChild(newRow);

    // 콤보박스 옵션 갱신
    refreshDeliveryProductSelects(section);
}

/**
 * 배송 상품 행 삭제
 * @param {HTMLElement} button - 삭제 버튼 요소
 */
function removeDeliveryProductRow(button) {
    const section = button.closest('.order-section');
    const tbody = section.querySelector('.delivery-product-body');
    const rows = tbody.querySelectorAll('.delivery-product-row');

    if (rows.length <= 1) {
        showAlert('⚠️ 최소 1개의 배송 상품은 있어야 합니다.', 'warning');
        return;
    }

    const row = button.closest('.delivery-product-row');
    row.remove();

    renumberDeliveryProductRows(section);
    validateDeliveryQuantities();
}

/**
 * 배송 상품 행 번호 재정렬
 * @param {HTMLElement} section - order-section 요소
 */
function renumberDeliveryProductRows(section) {
    const rows = section.querySelectorAll('.delivery-product-row');
    rows.forEach((row, index) => {
        const rowNumber = row.querySelector('.row-number');
        if (rowNumber) {
            rowNumber.textContent = index + 1;
        }
        row.setAttribute('data-row', index + 1);
    });
}

/**
 * 배송 상품 수량 합산 검증 및 안내 메시지 표시
 * 각 상품코드별로 주문 수량과 배송 수량 합계를 비교
 */
function validateDeliveryQuantities() {
    // 주문 상품별 수량 수집
    const orderProducts = {};
    const productRows = document.getElementById('productTableBody').querySelectorAll('.product-row');
    productRows.forEach(row => {
        const code = row.querySelector('.product-code').value.trim();
        const qty = parseInt(row.querySelector('.quantity').value) || 0;
        if (code) {
            orderProducts[code] = (orderProducts[code] || 0) + qty;
        }
    });

    // 배송 상품별 수량 합산
    const deliveryProducts = {};
    document.querySelectorAll('.order-section').forEach(section => {
        section.querySelectorAll('.delivery-product-row').forEach(row => {
            const code = row.querySelector('.delivery-product-code-select').value;
            const qty = parseInt(row.querySelector('.delivery-product-qty').value) || 0;
            if (code) {
                deliveryProducts[code] = (deliveryProducts[code] || 0) + qty;
            }
        });
    });

    // 불일치 확인
    let hasIssue = false;
    let allMatch = true;
    const messages = [];

    for (const code in orderProducts) {
        const orderQty = orderProducts[code];
        const deliveryQty = deliveryProducts[code] || 0;
        if (deliveryQty !== orderQty) {
            allMatch = false;
            if (deliveryQty > orderQty) {
                hasIssue = true;
                messages.push(`⚠️ [${code}] 배송 수량(${deliveryQty})이 주문 수량(${orderQty})을 초과합니다.`);
            } else if (deliveryQty > 0 && deliveryQty < orderQty) {
                messages.push(`ℹ️ [${code}] 배송 수량(${deliveryQty}) / 주문 수량(${orderQty})`);
            }
        }
    }

    // 배송에만 있고 주문에 없는 상품 체크
    for (const code in deliveryProducts) {
        if (!orderProducts[code] && deliveryProducts[code] > 0) {
            hasIssue = true;
            messages.push(`⚠️ [${code}] 주문 목록에 없는 상품입니다.`);
        }
    }

    // 메시지 표시 (모든 섹션에)
    document.querySelectorAll('.delivery-quantity-message').forEach(msgDiv => {
        if (hasIssue) {
            msgDiv.className = 'delivery-quantity-message quantity-mismatch-warning';
            msgDiv.innerHTML = messages.join('<br>');
        } else if (allMatch && Object.keys(orderProducts).length > 0 && Object.keys(deliveryProducts).length > 0) {
            msgDiv.className = 'delivery-quantity-message quantity-match-ok';
            msgDiv.textContent = '✅ 모든 상품의 배송 수량이 주문 수량과 일치합니다.';
        } else if (messages.length > 0) {
            msgDiv.className = 'delivery-quantity-message quantity-mismatch-warning';
            msgDiv.innerHTML = messages.join('<br>');
        } else {
            msgDiv.className = 'delivery-quantity-message';
            msgDiv.textContent = '';
        }
    });

    return !hasIssue && allMatch;
}

/**
 * 배송 상품 테이블 인쇄용 세로 타이틀 컬럼 추가
 * - DOM 노드를 직접 이동하여 input 값 보존
 * @param {HTMLElement} table - delivery-product-section 테이블
 */
function addDeliveryProductPrintTitleColumn(table) {
    const allRows = table.querySelectorAll('tr');
    const printableRows = [];
    allRows.forEach(row => {
        if (!row.classList.contains('no-print') && row.style.display !== 'none') printableRows.push(row);
    });
    if (printableRows.length === 0) return;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    // 원본 구조 백업
    table.setAttribute('data-print-restructured', 'true');
    table._origStructure = {
        thead: thead,
        tbody: tbody,
        tfoot: null,
        theadRows: thead ? Array.from(thead.querySelectorAll('tr')) : [],
        tbodyRows: tbody ? Array.from(tbody.querySelectorAll('tr')) : [],
        tfootRows: []
    };

    // 모든 행을 table 직속으로 이동
    const allRowsList = Array.from(allRows);
    if (thead) thead.remove();
    if (tbody) tbody.remove();
    allRowsList.forEach(row => table.appendChild(row));

    // 첫 번째 인쇄 행에 전체 rowspan 셀 추가
    const titleCell = document.createElement('td');
    titleCell.className = 'print-title-cell title-delivery-product';
    titleCell.setAttribute('rowspan', printableRows.length);
    titleCell.textContent = '배송상품';
    titleCell.setAttribute('data-print-title', 'true');
    printableRows[0].insertBefore(titleCell, printableRows[0].firstChild);
}
