// ========================================
// 폼 전송 함수
// ========================================

/**
 * 주문 전송만 실행 (인쇄 없이)
 */
async function submitOnly() {
    // 입력 검증
    if (!validateAllInputs()) {
        return;
    }

    await submitToGoogleForm();
}

/**
 * 주문서 인쇄 및 구글 설문지 제출
 */
async function printOrder() {
    // 입력 검증
    if (!validateAllInputs()) {
        return;
    }

    // 구글 폼 제출
    const submitted = await submitToGoogleForm();

    if (submitted) {
        // PC/모바일 모두 브라우저 인쇄 대화상자 표시
        window.print();
    }
}

/**
 * 구글 설문지에 데이터 제출
 * @returns {Promise<boolean>} - 제출 성공 여부
 */
async function submitToGoogleForm() {
    // config.js에서 구글 폼 설정 가져오기
    if (typeof GOOGLE_FORM_CONFIG === 'undefined') {
        console.log('config.js 파일이 로드되지 않았습니다.');
        showAlert('⚠️ config.js 파일을 확인해주세요. 인쇄만 진행합니다.', 'warning');
        return true; // 인쇄는 진행
    }

    const googleFormUrl = GOOGLE_FORM_CONFIG.formUrl;

    // 구글 폼 URL이 설정되지 않았으면 제출하지 않음
    if (!googleFormUrl) {
        console.log('구글 폼 URL이 설정되지 않았습니다.');
        return true; // 인쇄는 진행
    }

    // Entry ID 가져오기
    const entryDateTime = GOOGLE_FORM_CONFIG.entries.dateTime;
    const entryName = GOOGLE_FORM_CONFIG.entries.name;
    const entryPhone = GOOGLE_FORM_CONFIG.entries.phone;
    const entryOrderData = GOOGLE_FORM_CONFIG.entries.orderData;

    // Entry ID가 모두 설정되었는지 확인
    if (!entryDateTime || !entryName || !entryPhone || !entryOrderData) {
        showAlert('⚠️ config.js에서 모든 Entry ID를 설정해주세요. 인쇄만 진행합니다.', 'warning');
        return true;
    }

    // 주문 데이터 수집
    const orderData = collectOrderData();

    // FormData 생성
    const formData = new FormData();
    formData.append(entryDateTime, document.getElementById('currentDateTime').textContent);
    formData.append(entryName, document.getElementById('ordererName').value);
    formData.append(entryPhone, document.getElementById('ordererPhone').value);
    formData.append(entryOrderData, JSON.stringify(orderData, null, 2));

    try {
        // 구글 폼에 제출 (no-cors 모드로 전송)
        await fetch(googleFormUrl, {
            method: 'POST',
            mode: 'no-cors',
            body: formData
        });

        showAlert('✅ 주문이 성공적으로 전송되었습니다!', 'success');
        return true;
    } catch (error) {
        console.error('구글 폼 제출 오류:', error);
        showAlert('⚠️ 주문 전송에 실패했습니다. 인쇄는 진행합니다.', 'warning');
        return true; // 오류가 있어도 인쇄는 진행
    }
}

/**
 * 모든 주문 데이터를 수집하여 객체로 반환
 * @returns {Object} - 주문 데이터 객체
 */
function collectOrderData() {
    // 상품 목록 수집
    const productList = [];
    const productRows = document.getElementById('productTableBody').querySelectorAll('.product-row');
    let allTotalQuantity = 0;
    let allGrandTotal = 0;
    productRows.forEach(row => {
        const unitPriceValue = row.querySelector('.unit-price').value;
        const totalPriceValue = row.querySelector('.total-price').value;
        const qty = Number(row.querySelector('.quantity').value) || 0;
        const amt = parseFormattedNumber(totalPriceValue) || 0;

        productList.push({
            상품코드: row.querySelector('.product-code').value,
            상품이름: row.querySelector('.product-name').value,
            행사: row.querySelector('.event-type').value || '없음',
            수량: row.querySelector('.quantity').value,
            단가: parseFormattedNumber(unitPriceValue),
            금액: amt
        });
        allTotalQuantity += qty;
        allGrandTotal += amt;
    });

    const data = {
        주문자정보: {
            성명: document.getElementById('ordererName').value,
            전화번호: document.getElementById('ordererPhone').value,
            우편번호: document.getElementById('ordererPostal').value,
            기본주소: document.getElementById('ordererAddress').value,
            상세주소: document.getElementById('ordererAddressDetail').value
        },
        상품목록: productList,
        주문목록: []
    };

    const sections = document.querySelectorAll('.order-section');
    sections.forEach((section, index) => {
        // 배송 상품 목록 수집
        const deliveryProductList = [];
        section.querySelectorAll('.delivery-product-row').forEach(dRow => {
            const dCode = dRow.querySelector('.delivery-product-code-select').value;
            const dName = dRow.querySelector('.delivery-product-name').value;
            const dQty = parseInt(dRow.querySelector('.delivery-product-qty').value) || 0;
            if (dCode) {
                deliveryProductList.push({
                    상품코드: dCode,
                    상품이름: dName,
                    수량: dQty
                });
            }
        });

        const sectionData = {
            주문번호: index + 1,
            보내는분: {
                성명: section.querySelector('.sender-name').value,
                전화번호: section.querySelector('.sender-phone').value,
                우편번호: section.querySelector('.sender-postal').value,
                기본주소: section.querySelector('.sender-address').value,
                상세주소: section.querySelector('.sender-address-detail').value
            },
            받는분: {
                성명: section.querySelector('.receiver-name').value,
                전화번호: section.querySelector('.receiver-phone').value,
                우편번호: section.querySelector('.receiver-postal').value,
                기본주소: section.querySelector('.receiver-address').value,
                상세주소: section.querySelector('.receiver-address-detail').value
            },
            배송상품목록: deliveryProductList
        };

        data.주문목록.push(sectionData);
    });

    data.전체합계 = {
        총주문건수: data.주문목록.length,
        총수량: allTotalQuantity,
        총금액: allGrandTotal
    };

    return data;
}

// ========================================
// 로컬 스토리지 관련 함수
// ========================================

/**
 * config.js 설정 상태 확인 및 표시
 */
function checkConfigStatus() {
    const statusDiv = document.getElementById('configStatus');
    const statusText = document.getElementById('configStatusText');

    if (!statusDiv || !statusText) return;

    if (typeof GOOGLE_FORM_CONFIG === 'undefined') {
        statusDiv.style.backgroundColor = '#f8d7da';
        statusDiv.style.border = '2px solid #f5c6cb';
        statusText.textContent = '❌ config.js 파일이 로드되지 않았습니다.';
        statusText.style.color = '#721c24';
        return;
    }

    const hasUrl = GOOGLE_FORM_CONFIG.formUrl && GOOGLE_FORM_CONFIG.formUrl.trim() !== '';
    const hasAllEntries = GOOGLE_FORM_CONFIG.entries.dateTime &&
                          GOOGLE_FORM_CONFIG.entries.name &&
                          GOOGLE_FORM_CONFIG.entries.phone &&
                          GOOGLE_FORM_CONFIG.entries.orderData;

    if (hasUrl && hasAllEntries) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.style.border = '2px solid #c3e6cb';
        statusText.textContent = '✅ 모든 설정이 완료되었습니다!';
        statusText.style.color = '#155724';
    } else if (hasUrl || hasAllEntries) {
        statusDiv.style.backgroundColor = '#fff3cd';
        statusDiv.style.border = '2px solid #ffeaa7';
        statusText.textContent = '⚠️ 일부 설정이 누락되었습니다. config.js 파일을 확인해주세요.';
        statusText.style.color = '#856404';
    } else {
        statusDiv.style.backgroundColor = '#f8d7da';
        statusDiv.style.border = '2px solid #f5c6cb';
        statusText.textContent = '❌ 설정이 완료되지 않았습니다. config.js 파일을 설정해주세요.';
        statusText.style.color = '#721c24';
    }
}

/**
 * 모든 설정 저장
 * (호환성 유지를 위해 빈 함수로 남김 - 실제로는 config.js에서 관리)
 */
function saveAllSettings() {
    showAlert('💡 설정은 config.js 파일에서 관리됩니다.', 'warning');
}

/**
 * 로컬 스토리지에서 모든 설정 불러오기
 * (호환성 유지를 위해 빈 함수로 남김 - 실제로는 config.js에서 관리)
 */
function loadAllSettings() {
    console.log('config.js에서 설정을 가져옵니다.');
    // config.js 설정 상태 확인
    checkConfigStatus();
}
