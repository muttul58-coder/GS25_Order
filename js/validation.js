// ========================================
// 모든 입력 필드 검증
// ========================================

/**
 * 모든 입력 필드 검증
 * @returns {boolean} - 검증 통과 여부
 */
function validateAllInputs() {
    // 1. 주문자 정보 검증
    const ordererName = document.getElementById('ordererName');
    const ordererPhone = document.getElementById('ordererPhone');
    const ordererPostal = document.getElementById('ordererPostal');
    const ordererAddress = document.getElementById('ordererAddress');

    if (!ordererName.value.trim()) {
        ordererName.focus();
        ordererName.classList.add('error');
        showAlert('⚠️ 주문자 성명을 입력해주세요.', 'warning');
        setTimeout(() => ordererName.classList.remove('error'), 3000);
        return false;
    }

    if (!ordererPhone.value.trim()) {
        ordererPhone.focus();
        ordererPhone.classList.add('error');
        showAlert('⚠️ 주문자 전화번호를 입력해주세요.', 'warning');
        setTimeout(() => ordererPhone.classList.remove('error'), 3000);
        return false;
    }

    if (!ordererPostal.value.trim()) {
        ordererPostal.focus();
        ordererPostal.classList.add('error');
        showAlert('⚠️ 주문자 우편번호를 입력해주세요.', 'warning');
        setTimeout(() => ordererPostal.classList.remove('error'), 3000);
        return false;
    }

    if (!ordererAddress.value.trim()) {
        ordererAddress.focus();
        ordererAddress.classList.add('error');
        showAlert('⚠️ 주문자 주소를 입력해주세요.', 'warning');
        setTimeout(() => ordererAddress.classList.remove('error'), 3000);
        return false;
    }

    // 2. 상품 정보 검증
    const productRows = document.getElementById('productTableBody').querySelectorAll('.product-row');
    for (let j = 0; j < productRows.length; j++) {
        const row = productRows[j];
        const rowNum = j + 1;
        const productCode = row.querySelector('.product-code');
        const quantity = row.querySelector('.quantity');
        const unitPrice = row.querySelector('.unit-price');

        if (!productCode.value.trim()) {
            productCode.focus();
            productCode.classList.add('error');
            showAlert(`⚠️ [상품 ${rowNum}] 상품 코드를 입력해주세요.`, 'warning');
            document.querySelector('.orderer-info-container').scrollIntoView({ behavior: 'smooth', block: 'end' });
            setTimeout(() => productCode.classList.remove('error'), 3000);
            return false;
        }

        if (!quantity.value || parseInt(quantity.value) <= 0) {
            quantity.focus();
            quantity.classList.add('error');
            showAlert(`⚠️ [상품 ${rowNum}] 수량을 입력해주세요.`, 'warning');
            document.querySelector('.orderer-info-container').scrollIntoView({ behavior: 'smooth', block: 'end' });
            setTimeout(() => quantity.classList.remove('error'), 3000);
            return false;
        }

        if (!unitPrice.value || parseFormattedNumber(unitPrice.value) <= 0) {
            unitPrice.focus();
            unitPrice.classList.add('error');
            showAlert(`⚠️ [상품 ${rowNum}] 단가를 입력해주세요.`, 'warning');
            document.querySelector('.orderer-info-container').scrollIntoView({ behavior: 'smooth', block: 'end' });
            setTimeout(() => unitPrice.classList.remove('error'), 3000);
            return false;
        }
    }

    // 3. 각 섹션별 검증
    const sections = document.querySelectorAll('.order-section');
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const sectionNum = i + 1;

        // 보내는 분 정보 검증
        const senderName = section.querySelector('.sender-name');
        const senderPhone = section.querySelector('.sender-phone');
        const senderPostal = section.querySelector('.sender-postal');
        const senderAddress = section.querySelector('.sender-address');

        if (!senderName.value.trim()) {
            senderName.focus();
            senderName.classList.add('error');
            showAlert(`⚠️ [배송 정보 #${sectionNum}] 보내는 분 성명을 입력해주세요.`, 'warning');
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => senderName.classList.remove('error'), 3000);
            return false;
        }

        if (!senderPhone.value.trim()) {
            senderPhone.focus();
            senderPhone.classList.add('error');
            showAlert(`⚠️ [배송 정보 #${sectionNum}] 보내는 분 전화번호를 입력해주세요.`, 'warning');
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => senderPhone.classList.remove('error'), 3000);
            return false;
        }

        if (!senderPostal.value.trim()) {
            senderPostal.focus();
            senderPostal.classList.add('error');
            showAlert(`⚠️ [배송 정보 #${sectionNum}] 보내는 분 우편번호를 입력해주세요.`, 'warning');
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => senderPostal.classList.remove('error'), 3000);
            return false;
        }

        if (!senderAddress.value.trim()) {
            senderAddress.focus();
            senderAddress.classList.add('error');
            showAlert(`⚠️ [배송 정보 #${sectionNum}] 보내는 분 주소를 입력해주세요.`, 'warning');
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => senderAddress.classList.remove('error'), 3000);
            return false;
        }

        // 받는 분 정보 검증
        const receiverName = section.querySelector('.receiver-name');
        const receiverPhone = section.querySelector('.receiver-phone');
        const receiverPostal = section.querySelector('.receiver-postal');
        const receiverAddress = section.querySelector('.receiver-address');

        if (!receiverName.value.trim()) {
            receiverName.focus();
            receiverName.classList.add('error');
            showAlert(`⚠️ [배송 정보 #${sectionNum}] 받는 분 성명을 입력해주세요.`, 'warning');
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => receiverName.classList.remove('error'), 3000);
            return false;
        }

        if (!receiverPhone.value.trim()) {
            receiverPhone.focus();
            receiverPhone.classList.add('error');
            showAlert(`⚠️ [배송 정보 #${sectionNum}] 받는 분 전화번호를 입력해주세요.`, 'warning');
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => receiverPhone.classList.remove('error'), 3000);
            return false;
        }

        if (!receiverPostal.value.trim()) {
            receiverPostal.focus();
            receiverPostal.classList.add('error');
            showAlert(`⚠️ [배송 정보 #${sectionNum}] 받는 분 우편번호를 입력해주세요.`, 'warning');
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => receiverPostal.classList.remove('error'), 3000);
            return false;
        }

        if (!receiverAddress.value.trim()) {
            receiverAddress.focus();
            receiverAddress.classList.add('error');
            showAlert(`⚠️ [배송 정보 #${sectionNum}] 받는 분 주소를 입력해주세요.`, 'warning');
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => receiverAddress.classList.remove('error'), 3000);
            return false;
        }

        // 배송 상품 검증
        const deliveryRows = section.querySelectorAll('.delivery-product-row');
        for (let k = 0; k < deliveryRows.length; k++) {
            const dRow = deliveryRows[k];
            const dRowNum = k + 1;
            const dSelect = dRow.querySelector('.delivery-product-code-select');
            const dQty = dRow.querySelector('.delivery-product-qty');

            if (!dSelect.value) {
                dSelect.focus();
                dSelect.classList.add('error');
                showAlert(`⚠️ [배송 정보 #${sectionNum}] 배송 상품 ${dRowNum}번의 상품을 선택해주세요.`, 'warning');
                section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => dSelect.classList.remove('error'), 3000);
                return false;
            }

            if (!dQty.value || parseInt(dQty.value) <= 0) {
                dQty.focus();
                dQty.classList.add('error');
                showAlert(`⚠️ [배송 정보 #${sectionNum}] 배송 상품 ${dRowNum}번의 수량을 입력해주세요.`, 'warning');
                section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => dQty.classList.remove('error'), 3000);
                return false;
            }
        }
    }

    // 4. 배송 상품 수량 일치 검증
    if (!validateDeliveryQuantities()) {
        showAlert('⚠️ 배송 상품 수량이 주문 수량과 일치하지 않습니다. 확인해주세요.', 'warning');
        return false;
    }

    return true;
}

// ========================================
// 순차적 입력 검증 함수
// ========================================

/**
 * 주문자 정보 완료 여부 확인
 * @returns {Object} - {complete: boolean, missingField: HTMLElement, fieldName: string}
 */
function checkOrdererInfoComplete() {
    const ordererName = document.getElementById('ordererName');
    const ordererPhone = document.getElementById('ordererPhone');
    const ordererPostal = document.getElementById('ordererPostal');
    const ordererAddress = document.getElementById('ordererAddress');

    if (!ordererName.value.trim()) {
        return { complete: false, missingField: ordererName, fieldName: '주문자 성명' };
    }
    if (!ordererPhone.value.trim()) {
        return { complete: false, missingField: ordererPhone, fieldName: '주문자 전화번호' };
    }
    if (!ordererPostal.value.trim()) {
        return { complete: false, missingField: ordererPostal, fieldName: '주문자 우편번호' };
    }
    if (!ordererAddress.value.trim()) {
        return { complete: false, missingField: ordererAddress, fieldName: '주문자 주소' };
    }

    return { complete: true };
}

/**
 * 보내는 분 정보 완료 여부 확인 (첫 번째 섹션)
 * @returns {Object} - {complete: boolean, missingField: HTMLElement, fieldName: string}
 */
function checkSenderInfoComplete() {
    const firstSection = document.querySelector('.order-section[data-section="1"]');
    if (!firstSection) return { complete: true };

    const senderName = firstSection.querySelector('.sender-name');
    const senderPhone = firstSection.querySelector('.sender-phone');
    const senderPostal = firstSection.querySelector('.sender-postal');
    const senderAddress = firstSection.querySelector('.sender-address');

    if (!senderName.value.trim()) {
        return { complete: false, missingField: senderName, fieldName: '보내는 분 성명' };
    }
    if (!senderPhone.value.trim()) {
        return { complete: false, missingField: senderPhone, fieldName: '보내는 분 전화번호' };
    }
    if (!senderPostal.value.trim()) {
        return { complete: false, missingField: senderPostal, fieldName: '보내는 분 우편번호' };
    }
    if (!senderAddress.value.trim()) {
        return { complete: false, missingField: senderAddress, fieldName: '보내는 분 주소' };
    }

    return { complete: true };
}

/**
 * 받는 분 정보 완료 여부 확인 (첫 번째 섹션)
 * @returns {Object} - {complete: boolean, missingField: HTMLElement, fieldName: string}
 */
function checkReceiverInfoComplete() {
    const firstSection = document.querySelector('.order-section[data-section="1"]');
    if (!firstSection) return { complete: true };

    const receiverName = firstSection.querySelector('.receiver-name');
    const receiverPhone = firstSection.querySelector('.receiver-phone');
    const receiverPostal = firstSection.querySelector('.receiver-postal');
    const receiverAddress = firstSection.querySelector('.receiver-address');

    if (!receiverName.value.trim()) {
        return { complete: false, missingField: receiverName, fieldName: '받는 분 성명' };
    }
    if (!receiverPhone.value.trim()) {
        return { complete: false, missingField: receiverPhone, fieldName: '받는 분 전화번호' };
    }
    if (!receiverPostal.value.trim()) {
        return { complete: false, missingField: receiverPostal, fieldName: '받는 분 우편번호' };
    }
    if (!receiverAddress.value.trim()) {
        return { complete: false, missingField: receiverAddress, fieldName: '받는 분 주소' };
    }

    return { complete: true };
}

/**
 * 상품 정보 완료 여부 확인 (첫 번째 섹션)
 * @returns {Object} - {complete: boolean, missingField: HTMLElement, fieldName: string}
 */
function checkProductInfoComplete() {
    const tbody = document.getElementById('productTableBody');
    if (!tbody) return { complete: true };

    const firstRow = tbody.querySelector('.product-row');
    if (!firstRow) return { complete: true };

    const productCode = firstRow.querySelector('.product-code');
    const quantity = firstRow.querySelector('.quantity');
    const unitPrice = firstRow.querySelector('.unit-price');

    if (!productCode.value.trim()) {
        return { complete: false, missingField: productCode, fieldName: '상품 코드' };
    }
    if (!quantity.value || parseInt(quantity.value) <= 0) {
        return { complete: false, missingField: quantity, fieldName: '수량' };
    }
    if (!unitPrice.value || parseInt(unitPrice.value) <= 0) {
        return { complete: false, missingField: unitPrice, fieldName: '단가' };
    }

    return { complete: true };
}

/**
 * 순차적 입력 검증 - 주문 #1이 완료되었는지 확인
 * @returns {boolean} - 검증 통과 여부
 */
function checkSequentialInput() {
    // 1. 주문자 정보 확인
    const ordererCheck = checkOrdererInfoComplete();
    if (!ordererCheck.complete) {
        ordererCheck.missingField.focus();
        ordererCheck.missingField.classList.add('error');
        showAlert(`⚠️ [주문 정보] ${ordererCheck.fieldName}을(를) 먼저 입력해주세요.`, 'warning');
        setTimeout(() => {
            ordererCheck.missingField.classList.remove('error');
        }, 3000);
        return false;
    }

    // 2. 상품 정보 확인
    const productCheck = checkProductInfoComplete();
    if (!productCheck.complete) {
        productCheck.missingField.focus();
        productCheck.missingField.classList.add('error');
        showAlert(`⚠️ [상품 정보] ${productCheck.fieldName}을(를) 입력해주세요.`, 'warning');

        // 상품 테이블로 스크롤
        document.querySelector('.orderer-info-container').scrollIntoView({ behavior: 'smooth', block: 'end' });

        setTimeout(() => {
            productCheck.missingField.classList.remove('error');
        }, 3000);
        return false;
    }

    // 3. 주문 #1 보내는 분 정보 확인
    const senderCheck = checkSenderInfoComplete();
    if (!senderCheck.complete) {
        senderCheck.missingField.focus();
        senderCheck.missingField.classList.add('error');
        showAlert(`⚠️ [배송 정보 #1 - 보내는 분] ${senderCheck.fieldName}을(를) 입력해주세요.`, 'warning');

        // 해당 섹션으로 스크롤
        const firstSection = document.querySelector('.order-section[data-section="1"]');
        firstSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        setTimeout(() => {
            senderCheck.missingField.classList.remove('error');
        }, 3000);
        return false;
    }

    // 4. 주문 #1 받는 분 정보 확인
    const receiverCheck = checkReceiverInfoComplete();
    if (!receiverCheck.complete) {
        receiverCheck.missingField.focus();
        receiverCheck.missingField.classList.add('error');
        showAlert(`⚠️ [배송 정보 #1 - 받는 분] ${receiverCheck.fieldName}을(를) 입력해주세요.`, 'warning');

        // 해당 섹션으로 스크롤
        const firstSection = document.querySelector('.order-section[data-section="1"]');
        firstSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(() => {
            receiverCheck.missingField.classList.remove('error');
        }, 3000);
        return false;
    }

    return true;
}

/**
 * 필드에 순차적 입력 가이드 이벤트 리스너 추가
 */
function attachSequentialInputGuide() {
    const firstSection = document.querySelector('.order-section[data-section="1"]');
    if (!firstSection) return;

    // 상품 정보 필드들에 포커스 이벤트 추가 (주문자 정보 다음)
    const productTbody = document.getElementById('productTableBody');
    const firstRow = productTbody ? productTbody.querySelector('.product-row') : null;
    if (firstRow) {
        const productFields = [
            firstRow.querySelector('.product-code'),
            firstRow.querySelector('.quantity'),
            firstRow.querySelector('.unit-price')
        ];

        productFields.forEach(field => {
            if (field) {
                field.addEventListener('focus', function() {
                    const ordererCheck = checkOrdererInfoComplete();
                    if (!ordererCheck.complete) {
                        setTimeout(() => {
                            ordererCheck.missingField.focus();
                            ordererCheck.missingField.classList.add('error');
                            showAlert(`⚠️ [주문 정보] ${ordererCheck.fieldName}을(를) 먼저 입력해주세요.`, 'warning');
                            setTimeout(() => {
                                ordererCheck.missingField.classList.remove('error');
                            }, 3000);
                        }, 100);
                    }
                });
            }
        });
    }

    // 보내는 분 필드들에 포커스 이벤트 추가 (주문자 정보 + 상품 정보 다음)
    const senderFields = [
        firstSection.querySelector('.sender-name'),
        firstSection.querySelector('.sender-phone'),
        firstSection.querySelector('.sender-postal'),
        firstSection.querySelector('.sender-address')
    ];

    senderFields.forEach(field => {
        if (field) {
            field.addEventListener('focus', function() {
                const ordererCheck = checkOrdererInfoComplete();
                if (!ordererCheck.complete) {
                    setTimeout(() => {
                        ordererCheck.missingField.focus();
                        ordererCheck.missingField.classList.add('error');
                        showAlert(`⚠️ [주문 정보] ${ordererCheck.fieldName}을(를) 먼저 입력해주세요.`, 'warning');
                        setTimeout(() => {
                            ordererCheck.missingField.classList.remove('error');
                        }, 3000);
                    }, 100);
                    return;
                }

                const productCheck = checkProductInfoComplete();
                if (!productCheck.complete) {
                    setTimeout(() => {
                        productCheck.missingField.focus();
                        productCheck.missingField.classList.add('error');
                        showAlert(`⚠️ [상품 정보] ${productCheck.fieldName}을(를) 먼저 입력해주세요.`, 'warning');
                        setTimeout(() => {
                            productCheck.missingField.classList.remove('error');
                        }, 3000);
                    }, 100);
                }
            });
        }
    });

    // 받는 분 필드들에 포커스 이벤트 추가 (주문자 정보 + 상품 정보 + 보내는 분 다음)
    const receiverFields = [
        firstSection.querySelector('.receiver-name'),
        firstSection.querySelector('.receiver-phone'),
        firstSection.querySelector('.receiver-postal'),
        firstSection.querySelector('.receiver-address')
    ];

    receiverFields.forEach(field => {
        if (field) {
            field.addEventListener('focus', function() {
                const ordererCheck = checkOrdererInfoComplete();
                if (!ordererCheck.complete) {
                    setTimeout(() => {
                        ordererCheck.missingField.focus();
                        ordererCheck.missingField.classList.add('error');
                        showAlert(`⚠️ [주문 정보] ${ordererCheck.fieldName}을(를) 먼저 입력해주세요.`, 'warning');
                        setTimeout(() => {
                            ordererCheck.missingField.classList.remove('error');
                        }, 3000);
                    }, 100);
                    return;
                }

                const productCheck = checkProductInfoComplete();
                if (!productCheck.complete) {
                    setTimeout(() => {
                        productCheck.missingField.focus();
                        productCheck.missingField.classList.add('error');
                        showAlert(`⚠️ [상품 정보] ${productCheck.fieldName}을(를) 먼저 입력해주세요.`, 'warning');
                        setTimeout(() => {
                            productCheck.missingField.classList.remove('error');
                        }, 3000);
                    }, 100);
                    return;
                }

                const senderCheck = checkSenderInfoComplete();
                if (!senderCheck.complete) {
                    setTimeout(() => {
                        senderCheck.missingField.focus();
                        senderCheck.missingField.classList.add('error');
                        showAlert(`⚠️ [보내는 분] ${senderCheck.fieldName}을(를) 먼저 입력해주세요.`, 'warning');
                        setTimeout(() => {
                            senderCheck.missingField.classList.remove('error');
                        }, 3000);
                    }, 100);
                }
            });
        }
    });
}
