        // ========================================
        // 인쇄 및 제출 함수
        // ========================================

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
                // 인쇄 대화상자 표시
                // (합계 행은 이미 No/작업 컬럼에 no-print 셀이 포함되어 있으므로 별도 조정 불필요)
                window.print();
            }
        }

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

            // 2. 각 섹션별 검증
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
                    showAlert(`⚠️ [주문 #${sectionNum}] 보내는 분 성명을 입력해주세요.`, 'warning');
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => senderName.classList.remove('error'), 3000);
                    return false;
                }

                if (!senderPhone.value.trim()) {
                    senderPhone.focus();
                    senderPhone.classList.add('error');
                    showAlert(`⚠️ [주문 #${sectionNum}] 보내는 분 전화번호를 입력해주세요.`, 'warning');
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => senderPhone.classList.remove('error'), 3000);
                    return false;
                }

                if (!senderPostal.value.trim()) {
                    senderPostal.focus();
                    senderPostal.classList.add('error');
                    showAlert(`⚠️ [주문 #${sectionNum}] 보내는 분 우편번호를 입력해주세요.`, 'warning');
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => senderPostal.classList.remove('error'), 3000);
                    return false;
                }

                if (!senderAddress.value.trim()) {
                    senderAddress.focus();
                    senderAddress.classList.add('error');
                    showAlert(`⚠️ [주문 #${sectionNum}] 보내는 분 주소를 입력해주세요.`, 'warning');
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
                    showAlert(`⚠️ [주문 #${sectionNum}] 받는 분 성명을 입력해주세요.`, 'warning');
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => receiverName.classList.remove('error'), 3000);
                    return false;
                }

                if (!receiverPhone.value.trim()) {
                    receiverPhone.focus();
                    receiverPhone.classList.add('error');
                    showAlert(`⚠️ [주문 #${sectionNum}] 받는 분 전화번호를 입력해주세요.`, 'warning');
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => receiverPhone.classList.remove('error'), 3000);
                    return false;
                }

                if (!receiverPostal.value.trim()) {
                    receiverPostal.focus();
                    receiverPostal.classList.add('error');
                    showAlert(`⚠️ [주문 #${sectionNum}] 받는 분 우편번호를 입력해주세요.`, 'warning');
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => receiverPostal.classList.remove('error'), 3000);
                    return false;
                }

                if (!receiverAddress.value.trim()) {
                    receiverAddress.focus();
                    receiverAddress.classList.add('error');
                    showAlert(`⚠️ [주문 #${sectionNum}] 받는 분 주소를 입력해주세요.`, 'warning');
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => receiverAddress.classList.remove('error'), 3000);
                    return false;
                }

                // 상품 정보 검증
                const rows = section.querySelectorAll('.product-row');
                for (let j = 0; j < rows.length; j++) {
                    const row = rows[j];
                    const rowNum = j + 1;
                    const productCode = row.querySelector('.product-code');
                    const quantity = row.querySelector('.quantity');
                    const unitPrice = row.querySelector('.unit-price');

                    if (!productCode.value.trim()) {
                        productCode.focus();
                        productCode.classList.add('error');
                        showAlert(`⚠️ [주문 #${sectionNum} - 상품 ${rowNum}] 상품 코드를 입력해주세요.`, 'warning');
                        section.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        setTimeout(() => productCode.classList.remove('error'), 3000);
                        return false;
                    }

                    if (!quantity.value || parseInt(quantity.value) <= 0) {
                        quantity.focus();
                        quantity.classList.add('error');
                        showAlert(`⚠️ [주문 #${sectionNum} - 상품 ${rowNum}] 수량을 입력해주세요.`, 'warning');
                        section.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        setTimeout(() => quantity.classList.remove('error'), 3000);
                        return false;
                    }

                    if (!unitPrice.value || parseFormattedNumber(unitPrice.value) <= 0) {
                        unitPrice.focus();
                        unitPrice.classList.add('error');
                        showAlert(`⚠️ [주문 #${sectionNum} - 상품 ${rowNum}] 단가를 입력해주세요.`, 'warning');
                        section.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        setTimeout(() => unitPrice.classList.remove('error'), 3000);
                        return false;
                    }
                }
            }

            return true;
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
            const data = {
                주문자정보: {
                    성명: document.getElementById('ordererName').value,
                    전화번호: document.getElementById('ordererPhone').value,
                    우편번호: document.getElementById('ordererPostal').value,
                    기본주소: document.getElementById('ordererAddress').value,
                    상세주소: document.getElementById('ordererAddressDetail').value
                },
                주문목록: []
            };

            const sections = document.querySelectorAll('.order-section');
            sections.forEach((section, index) => {
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
                    상품목록: []
                };

                const rows = section.querySelectorAll('.product-row');
                rows.forEach(row => {
                    const unitPriceValue = row.querySelector('.unit-price').value;
                    const totalPriceValue = row.querySelector('.total-price').value;

                    sectionData.상품목록.push({
                        상품코드: row.querySelector('.product-code').value,
                        상품이름: row.querySelector('.product-name').value,
                        수량: row.querySelector('.quantity').value,
                        단가: parseFormattedNumber(unitPriceValue),
                        금액: parseFormattedNumber(totalPriceValue)
                    });
                });

                data.주문목록.push(sectionData);
            });

            // 전체 합계 계산
            let allTotalQuantity = 0;
            let allGrandTotal = 0;
            data.주문목록.forEach(section => {
                section.상품목록.forEach(product => {
                    allTotalQuantity += Number(product.수량) || 0;
                    allGrandTotal += Number(product.금액) || 0;
                });
            });

            data.전체합계 = {
                총주문건수: data.주문목록.length,
                총수량: allTotalQuantity,
                총금액: allGrandTotal
            };

            return data;
        }
