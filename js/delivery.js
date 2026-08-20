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
        const row = select.closest('.delivery-product-row');

        // 기존 선택값 복원 (현재 선택된 상품은 항상 유지)
        if (currentValue && products.some(p => p.code === currentValue)) {
            if (!select.querySelector('option[value="' + currentValue + '"]')) {
                const option = document.createElement('option');
                option.value = currentValue;
                option.textContent = currentValue;
                select.appendChild(option);
            }
            select.value = currentValue;
        } else {
            // 선택한 적이 없거나, 주문 목록에서 사라진 상품인 경우
            // 상품이름/수량이 남아 있으면 채워진 행처럼 보이므로 함께 비운다
            select.value = '';
            if (row) {
                row.querySelector('.delivery-product-name').value = '';
                if (currentValue) {
                    row.querySelector('.delivery-product-qty').value = '';
                }
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
 * 이 행에 더 넣을 수 있는 최대 수량 계산
 * 지급 수량에서 다른 행(모든 섹션)에 이미 배분된 수량을 뺀 잔량
 * @param {HTMLElement} row - delivery-product-row 요소
 * @returns {number|null} - 상한값. 상품 미선택 등 판단 불가하면 null
 */
function getDeliveryQuantityLimit(row) {
    const select = row.querySelector('.delivery-product-code-select');
    if (!select || !select.value) return null; // 상품을 아직 고르지 않음
    const code = select.value;

    const found = getOrderProductList().find(p => p.code === code);
    if (!found) return null; // 주문 목록에 없는 상품 → validate 쪽에서 경고

    // 같은 상품코드를 쓰는 다른 행의 배분량 합산
    let allocatedElsewhere = 0;
    document.querySelectorAll('.delivery-product-row').forEach(other => {
        if (other === row) return;
        const otherSelect = other.querySelector('.delivery-product-code-select');
        if (!otherSelect || otherSelect.value !== code) return;
        allocatedElsewhere += parseInt(other.querySelector('.delivery-product-qty').value) || 0;
    });

    return Math.max(0, found.qty - allocatedElsewhere);
}

/**
 * 배송 수량 입력값을 지급 수량 범위로 제한
 * 초과 입력은 값 자체를 되돌려 더 이상 올라가지 않게 한다
 * @param {HTMLInputElement} input - delivery-product-qty 입력 필드
 * @returns {boolean} - 값을 조정했으면 true
 */
function clampDeliveryQuantity(input) {
    const row = input.closest('.delivery-product-row');
    if (!row) return false;
    if (input.value === '') return false; // 지우는 중

    const value = parseInt(input.value);
    if (isNaN(value)) {
        input.value = '';
        return true;
    }

    // 음수 방지
    if (value < 0) {
        input.value = 0;
        return true;
    }

    const limit = getDeliveryQuantityLimit(row);
    if (limit === null || value <= limit) return false;

    input.value = limit;
    const code = row.querySelector('.delivery-product-code-select').value;
    if (limit === 0) {
        showAlert(`⚠️ [${code}] 지급 수량이 다른 행에 모두 배분되어 더 입력할 수 없습니다.`, 'warning');
    } else {
        showAlert(`⚠️ [${code}] 배분 가능한 수량은 ${limit}개입니다.`, 'warning');
    }
    return true;
}

// 수정 직전의 지급 수량 (증가/감소를 구분해 안내 문구를 고르기 위함)
let lastGivenByCode = {};

/**
 * 현재 지급 수량을 기억해 둔다
 * 수량/행사 필드에 포커스가 들어오는 시점, 즉 "고치기 직전" 값이 기준이 된다
 */
function rememberGivenQuantities() {
    lastGivenByCode = {};
    getOrderProductList().forEach(p => { lastGivenByCode[p.code] = p.qty; });
}

/**
 * 주문 수량/행사가 바뀌었을 때 배송 배분을 지급 수량에 맞춰 정리
 * - 지급 수량이 줄면 초과분을 자동으로 깎는다 (마지막 행부터)
 * - 지급 수량이 늘면 값은 건드리지 않고 수정하라고 안내한다
 *
 * 주문 수량 입력의 'input' 이 아니라 'change'(입력 확정) 에서만 호출한다.
 * 한 글자씩 반응하면 "5 -> 1 -> 12" 처럼 고쳐 쓰는 중간 상태에서
 * 배송 수량이 1로 깎여 되돌릴 수 없게 된다.
 */
function reconcileDeliveryQuantities() {
    const givenByCode = {};
    getOrderProductList().forEach(p => { givenByCode[p.code] = p.qty; });

    // 상품코드별 배송 행 수집 (모든 섹션)
    const rowsByCode = {};
    document.querySelectorAll('.delivery-product-row').forEach(row => {
        const code = row.querySelector('.delivery-product-code-select').value;
        if (!code) return;
        if (!rowsByCode[code]) rowsByCode[code] = [];
        rowsByCode[code].push(row);
    });

    const reduced = [];
    const shortfall = [];

    for (const code in rowsByCode) {
        const limit = givenByCode[code];
        if (limit === undefined) continue; // 주문에서 사라진 상품 → refresh 가 정리

        const rows = rowsByCode[code];
        const total = rows.reduce((sum, r) =>
            sum + (parseInt(r.querySelector('.delivery-product-qty').value) || 0), 0);
        if (total === 0) continue; // 아직 배분 전 → 안내 불필요

        if (total > limit) {
            // 마지막 행부터 깎아 먼저 입력한 배분을 최대한 보존
            let excess = total - limit;
            for (let i = rows.length - 1; i >= 0 && excess > 0; i--) {
                const input = rows[i].querySelector('.delivery-product-qty');
                const value = parseInt(input.value) || 0;
                const cut = Math.min(value, excess);
                if (cut > 0) {
                    input.value = value - cut;
                    excess -= cut;
                }
            }
            reduced.push(`[${code}] ${total}→${limit}개`);
        } else if (total < limit) {
            const previous = lastGivenByCode[code];
            shortfall.push({
                text: `[${code}] ${total}/${limit}개`,
                increased: previous !== undefined && limit > previous
            });
        }
    }

    lastGivenByCode = givenByCode;

    refreshAllDeliveryProductSelects(); // 콤보 옵션 갱신 + 검증 메시지 갱신

    if (reduced.length > 0) {
        showAlert(`⚠️ 지급 수량이 줄어 배송 수량을 자동 조정했습니다. ${reduced.join(', ')}`, 'warning');
    } else if (shortfall.length > 0) {
        const grew = shortfall.some(s => s.increased);
        const detail = shortfall.map(s => s.text).join(', ');
        showAlert(grew
            ? `⚠️ 지급 수량이 늘었습니다. 배송 정보의 수량을 수정해 주세요. ${detail}`
            : `⚠️ 배송 수량이 지급 수량과 다릅니다. 배송 정보의 수량을 확인해 주세요. ${detail}`,
            'warning');
    }
}

/**
 * 배송 상품 수량 합산 검증 및 안내 메시지 표시
 * 각 상품코드별로 주문 수량과 배송 수량 합계를 비교
 */
function validateDeliveryQuantities() {
    // 주문 상품별 수량 수집
    // 구매 수량이 아니라 지급 수량(덤 포함) 기준 — 실제로 배송되는 개수와 맞춰야 한다
    // 주류는 배송 대상이 아니므로 세지 않는다. 세면 배분할 방법이 없는 상품을 두고
    // "배송 수량 0 / 지급 수량 1" 이 영원히 뜨면서 전송까지 막힌다.
    const orderProducts = {};
    const productRows = document.getElementById('productTableBody').querySelectorAll('.product-row');
    productRows.forEach(row => {
        const code = row.querySelector('.product-code').value.trim();
        const qty = getRowGivenQuantity(row);
        if (code && !(typeof isAlcoholCode === 'function' && isAlcoholCode(code))) {
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
    // 아래 messages 는 innerHTML 로 들어간다(줄바꿈에 <br> 을 쓴다).
    // 상품코드는 점원이 직접 친 값이라 형식 검사를 통과하지 못한 글자가
    // 그대로 남아 있을 수 있으므로 반드시 escapeHtml() 을 거친다.
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
                messages.push(`⚠️ [${escapeHtml(code)}] 배송 수량(${deliveryQty})이 지급 수량(${orderQty})을 초과합니다.`);
            } else {
                // 0개도 반드시 안내한다. 안내가 없으면 사용자는 어떤 상품이
                // 배분되지 않았는지 모른 채 전송 단계에서 막히게 된다.
                messages.push(`ℹ️ [${escapeHtml(code)}] 배송 수량(${deliveryQty}) / 지급 수량(${orderQty})`);
            }
        }
    }

    // 배송에만 있고 주문에 없는 상품 체크
    for (const code in deliveryProducts) {
        if (!orderProducts[code] && deliveryProducts[code] > 0) {
            hasIssue = true;
            messages.push(`⚠️ [${escapeHtml(code)}] 주문 목록에 없는 상품입니다.`);
        }
    }

    // 메시지 표시 (모든 섹션에)
    document.querySelectorAll('.delivery-quantity-message').forEach(msgDiv => {
        if (hasIssue) {
            msgDiv.className = 'delivery-quantity-message quantity-mismatch-warning';
            msgDiv.innerHTML = messages.join('<br>');
        } else if (allMatch && Object.keys(orderProducts).length > 0 && Object.keys(deliveryProducts).length > 0) {
            msgDiv.className = 'delivery-quantity-message quantity-match-ok';
            msgDiv.textContent = '✅ 모든 상품의 배송 수량이 지급 수량과 일치합니다.';
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
