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
        <div class="section-number-row">
            <div class="section-number">배송 정보 #${sectionCounter}</div>
            <button type="button" class="section-delete-btn no-print" onclick="removeSection(this)">🗑️ 섹션 삭제</button>
            <div class="delivery-date-area">
                <label>배송 희망 일 :
                    <input type="date" class="delivery-date" value="${getTodayDate()}" lang="ko">
                </label>
            </div>
        </div>

        <!-- 보내는 분 정보 -->
        <div class="section-header">
            <span>보내는 분</span>
            <div class="header-checkbox-area no-print">
                <label class="checkbox-label">
                    <input type="checkbox" class="copy-orderer-info" onchange="toggleOrdererInfoCopy(this)">
                    <span>주문 정보와 동일</span>
                </label>
            </div>
        </div>
        <div class="table-responsive">
            <table>
                <tr>
                    <th style="width: 90px;">성명</th>
                    <th style="width: 160px;">전화번호</th>
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
                    <span>주문 정보와 동일</span>
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
                    <th style="width: 160px;">전화번호</th>
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

        <!-- 배송 상품 -->
        <div class="section-header delivery-product-section">
            <span>배송 상품</span>
        </div>
        <div class="table-responsive">
            <table class="delivery-product-section">
                <thead>
                    <tr>
                        <th style="width: 40px;">No.</th>
                        <th style="width: 100px;">상품코드</th>
                        <th>상품이름</th>
                        <th style="width: 70px;">수량</th>
                        <th style="width: 100px;" class="no-print">작업</th>
                    </tr>
                </thead>
                <tbody class="delivery-product-body">
                    <tr class="delivery-product-row" data-row="1">
                        <td class="row-number">1</td>
                        <td>
                            <select class="delivery-product-code-select" onchange="onDeliveryProductCodeChange(this)">
                                <option value="">-- 선택 --</option>
                            </select>
                        </td>
                        <td><input type="text" class="delivery-product-name" placeholder="상품이름" readonly></td>
                        <td><input type="number" class="delivery-product-qty" value="0" min="0" onchange="validateDeliveryQuantities()" oninput="validateDeliveryQuantities()"></td>
                        <td class="no-print">
                            <div class="action-buttons">
                                <button type="button" class="remove-btn" onclick="removeDeliveryProductRow(this)">삭제</button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="add-row-container no-print">
            <button type="button" class="add-btn" onclick="addDeliveryProductRow(this)">+ 상품 추가</button>
        </div>
        <div class="delivery-quantity-message"></div>
    `;

    // 컨테이너에 새 섹션 추가
    container.appendChild(newSection);

    // 새 섹션의 보내는 분 → 받는 분 동기화 리스너 등록
    attachSenderSyncListeners(newSection);

    // 새 섹션의 전화번호 필드에 하이픈 포맷팅 적용
    newSection.querySelectorAll('.sender-phone, .receiver-phone').forEach(input => {
        attachPhoneFormatting(input);
    });

    // 새 섹션의 배송 상품 콤보박스 초기화
    refreshDeliveryProductSelects(newSection);

    // 성공 메시지 표시
    showAlert('✅ 새로운 배송 정보가 추가되었습니다.', 'success');

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
        showAlert('⚠️ 최소 1개의 배송 정보는 있어야 합니다.', 'warning');
        return;
    }

    const section = button.closest('.order-section');
    if (!section) {
        console.error('섹션을 찾을 수 없습니다.');
        return;
    }

    const sectionNumber = section.querySelector('.section-number').textContent;

    // 삭제 확인
    const confirmDelete = confirm(`${sectionNumber}을(를) 삭제하시겠습니까?\n(보내는 분, 받는 분, 배송 상품 정보가 삭제됩니다)`);
    if (!confirmDelete) {
        return;
    }

    // 섹션 제거
    section.remove();

    // 섹션 번호 재정렬
    renumberSections();

    // 배송 상품 수량 검증
    validateDeliveryQuantities();

    showAlert('✅ 배송 정보가 삭제되었습니다.', 'success');
}

/**
 * 모든 섹션의 번호를 재정렬
 */
function renumberSections() {
    const sections = document.querySelectorAll('.order-section');
    sections.forEach((section, index) => {
        const sectionNumber = section.querySelector('.section-number');
        sectionNumber.textContent = `배송 정보 #${index + 1}`;
        section.setAttribute('data-section', index + 1);
    });
    sectionCounter = sections.length;
}
