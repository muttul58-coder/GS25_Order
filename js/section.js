// ========================================
// 섹션 관리 함수
// ========================================

/**
 * 새로운 주문 섹션(보내는 분 + 받는 분 + 상품 정보) 추가
 */
function addSection() {
    // 순차적 입력 검증 - 주문 #1이 완료되지 않았으면 섹션 추가 불가
    if (!checkSequentialInput()) {
        return;
    }

    sectionCounter++;
    const container = document.getElementById('orderSectionsContainer');

    // 새 섹션 div 생성
    const newSection = document.createElement('div');
    newSection.className = 'order-section';
    newSection.setAttribute('data-section', sectionCounter);

    // 섹션 HTML 구조 생성
    newSection.innerHTML = `
        <div class="section-number">주문 #${sectionCounter}</div>
        <button type="button" class="section-delete-btn no-print" onclick="removeSection(this)">🗑️ 섹션 삭제</button>

        <!-- 보내는 분 정보 -->
        <div class="section-header">
            <span>보내는 분</span>
            <div class="header-checkbox-area no-print">
                <label class="checkbox-label">
                    <input type="checkbox" class="copy-orderer-info" onchange="toggleOrdererInfoCopy(this)">
                    <span>주문자 정보와 동일</span>
                </label>
            </div>
        </div>
        <div class="table-responsive">
            <table>
                <tr>
                    <th style="width: 90px;">성명</th>
                    <th style="width: 150px;">전화번호</th>
                    <th style="width: 150px;">우편번호</th>
                    <th>주소</th>
                </tr>
                <tr>
                    <td><input type="text" class="sender-name" placeholder="______" required></td>
                    <td><input type="tel" class="sender-phone" placeholder="010-0000-0000" required></td>
                    <td>
                        <div class="postal-input-wrapper">
                            <input type="text" class="sender-postal" placeholder="00000" maxlength="5" required>
                            <button type="button" class="postal-search-btn no-print" onclick="searchSenderAddress(this)">검색</button>
                        </div>
                    </td>
                    <td class="address-field">
                        <input type="text" class="sender-address" placeholder="기본주소" required>
                        <input type="text" class="sender-address-detail" placeholder="상세주소 입력">
                    </td>
                </tr>
            </table>
        </div>

        <!-- 받는 분 정보 -->
        <div class="section-header receiver-section">
            <span>받는 분</span>
            <div class="header-checkbox-area no-print">
                <label class="checkbox-label">
                    <input type="checkbox" class="copy-orderer-to-receiver" onchange="toggleReceiverInfoCopy(this, 'orderer')">
                    <span>주문자 정보와 동일</span>
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" class="copy-sender-to-receiver" onchange="toggleReceiverInfoCopy(this, 'sender')">
                    <span>보내는 분 정보와 동일</span>
                </label>
            </div>
        </div>
        <div class="table-responsive">
            <table class="receiver-section">
                <tr>
                    <th style="width: 90px;">성명</th>
                    <th style="width: 150px;">전화번호</th>
                    <th style="width: 150px;">우편번호</th>
                    <th>주소</th>
                </tr>
                <tr>
                    <td><input type="text" class="receiver-name" placeholder="______" required></td>
                    <td><input type="tel" class="receiver-phone" placeholder="010-0000-0000" required></td>
                    <td>
                        <div class="postal-input-wrapper">
                            <input type="text" class="receiver-postal" placeholder="00000" maxlength="5" required>
                            <button type="button" class="postal-search-btn no-print" onclick="searchReceiverAddress(this)">검색</button>
                        </div>
                    </td>
                    <td class="address-field">
                        <input type="text" class="receiver-address" placeholder="기본주소" required>
                        <input type="text" class="receiver-address-detail" placeholder="상세주소 입력">
                    </td>
                </tr>
            </table>
        </div>

        <!-- 상품 정보 -->
        <div class="section-header product-section">상품 정보</div>
        <div class="table-responsive">
            <table class="product-section">
                <thead>
                    <tr>
                        <th style="width: 20px;">No.</th>
                        <th style="width: 80px;">상품 코드</th>
                        <th>상품이름</th>
                        <th style="width: 60px;">수량</th>
                        <th style="width: 100px;">단가</th>
                        <th style="width: 100px;">금액</th>
                        <th style="width: 100px;" class="no-print">작업</th>
                    </tr>
                </thead>
                <tbody class="product-table-body">
                    <tr class="product-row" data-row="1">
                        <td class="row-number">1</td>
                        <td><input type="text" class="product-code" placeholder="00-00" required></td>
                        <td><input type="text" class="product-name" placeholder="상품이름" readonly></td>
                        <td><input type="number" class="quantity" value="0" min="0" required></td>
                        <td><input type="text" class="unit-price" placeholder="______" required></td>
                        <td><input type="text" class="total-price" readonly></td>
                        <td class="no-print">
                            <div class="action-buttons">
                                <button type="button" class="remove-btn" onclick="removeProductRow(this)">삭제</button>
                            </div>
                        </td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr class="no-print">
                        <td colspan="7" class="add-row-container">
                            <button type="button" class="add-btn" onclick="addProductRowInSection(this)">+ 상품 추가</button>
                        </td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="3">총 수량</td>
                        <td class="section-total-quantity">0</td>
                        <td>총 금액</td>
                        <td class="section-grand-total">0원</td>
                        <td class="no-print"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    // 컨테이너에 새 섹션 추가
    container.appendChild(newSection);

    // 새 섹션의 보내는 분 → 받는 분 동기화 리스너 등록
    attachSenderSyncListeners(newSection);

    // 새 섹션의 첫 번째 상품 행에 이벤트 리스너 및 포맷팅 적용
    const firstRow = newSection.querySelector('.product-row');
    attachRowEventListeners(firstRow);
    attachProductCodeFormatting(firstRow);

    // 전체 합계 업데이트
    updateGrandTotals();

    // 성공 메시지 표시
    showAlert('✅ 새로운 주문 섹션이 추가되었습니다.', 'success');

    // 새 섹션으로 부드럽게 스크롤
    newSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 섹션 삭제
 * @param {HTMLElement} button - 삭제 버튼 요소
 */
function removeSection(button) {
    const sections = document.querySelectorAll('.order-section');

    // 최소 1개의 섹션은 유지해야 함
    if (sections.length <= 1) {
        showAlert('⚠️ 최소 1개의 주문 섹션은 있어야 합니다.', 'warning');
        return;
    }

    const section = button.closest('.order-section');
    if (!section) {
        console.error('섹션을 찾을 수 없습니다.');
        return;
    }

    const sectionNumber = section.querySelector('.section-number').textContent;

    // 삭제 확인
    const confirmDelete = confirm(`${sectionNumber} 섹션 전체를 삭제하시겠습니까?\n(보내는 분, 받는 분, 상품 정보가 모두 삭제됩니다)`);
    if (!confirmDelete) {
        return;
    }

    // 섹션 제거
    section.remove();

    // 섹션 번호 재정렬
    renumberSections();

    // 전체 합계 업데이트
    updateGrandTotals();

    showAlert('✅ 주문 섹션이 삭제되었습니다.', 'success');
}

/**
 * 모든 섹션의 번호를 재정렬
 */
function renumberSections() {
    const sections = document.querySelectorAll('.order-section');
    sections.forEach((section, index) => {
        const sectionNumber = section.querySelector('.section-number');
        sectionNumber.textContent = `주문 #${index + 1}`;
        section.setAttribute('data-section', index + 1);
    });
    sectionCounter = sections.length;
}

// ========================================
// 상품 행 관리 함수
// ========================================

/**
 * 섹션 내에 새로운 상품 행 추가
 * @param {HTMLElement} button - 상품 추가 버튼 요소
 */
function addProductRowInSection(button) {
    const section = button.closest('.order-section');
    const tbody = section.querySelector('.product-table-body');
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
        <td><input type="text" class="product-code" placeholder="00-00" required></td>
        <td><input type="text" class="product-name" placeholder="상품이름" readonly></td>
        <td><input type="number" class="quantity" value="0" min="0" required></td>
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

    // 해당 섹션의 합계 업데이트
    updateSectionTotals(section);

    showAlert('✅ 새로운 상품 행이 추가되었습니다.', 'success');
}

/**
 * 상품 행 삭제
 * @param {HTMLElement} button - 삭제 버튼 요소
 */
function removeProductRow(button) {
    const section = button.closest('.order-section');
    const rows = section.querySelectorAll('.product-row');

    // 최소 1개의 행은 유지해야 함
    if (rows.length <= 1) {
        showAlert('⚠️ 최소 1개의 상품은 있어야 합니다.', 'warning');
        return;
    }

    const row = button.closest('.product-row');
    row.remove();

    // 해당 섹션의 행 번호 재정렬
    renumberRowsInSection(section);

    // 해당 섹션의 합계 업데이트
    updateSectionTotals(section);

    showAlert('✅ 상품 행이 삭제되었습니다.', 'success');
}

/**
 * 섹션 내 모든 행의 번호를 재정렬
 * @param {HTMLElement} section - 대상 섹션 요소
 */
function renumberRowsInSection(section) {
    const rows = section.querySelectorAll('.product-row');
    rows.forEach((row, index) => {
        const rowNumber = row.querySelector('.row-number');
        if (rowNumber) {
            rowNumber.textContent = index + 1;
        }
        row.setAttribute('data-row', index + 1);
    });
}