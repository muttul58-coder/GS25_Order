// ========================================
// 상품 코드 포맷팅 및 자동완성 함수
// ========================================

/**
 * 숫자를 천단위 쉼표 형식으로 변환
 * @param {number} num - 변환할 숫자
 * @returns {string} - 천단위 쉼표가 추가된 문자열
 */
function formatNumberWithCommas(num) {
    if (!num && num !== 0) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 천단위 쉼표가 포함된 문자열을 숫자로 변환
 * @param {string} str - 변환할 문자열
 * @returns {number} - 변환된 숫자
 */
function parseFormattedNumber(str) {
    if (!str) return 0;
    return parseInt(str.toString().replace(/,/g, '')) || 0;
}

/**
 * 상품 코드 입력 필드에 포맷팅 및 자동완성 기능 추가
 * @param {HTMLElement} row - 대상 행 요소
 */
function attachProductCodeFormatting(row) {
    const productCodeInput = row.querySelector('.product-code');
    const productNameInput = row.querySelector('.product-name');
    const quantityInput = row.querySelector('.quantity');
    const unitPriceInput = row.querySelector('.unit-price');

    // Enter 키 입력 시 Tab 키처럼 동작
    productCodeInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // 기본 Enter 동작 방지

            // blur 이벤트를 트리거하여 포맷팅 및 자동완성 실행
            this.blur();

            // 다음 필드(수량)로 포커스 이동
            if (quantityInput) {
                setTimeout(() => {
                    quantityInput.focus();
                    quantityInput.select(); // 내용 전체 선택
                }, 100);
            }
        }
    });

    // 상품 코드 입력 시 포맷팅 및 자동완성
    productCodeInput.addEventListener('blur', function() {
        const code = this.value.trim();

        // 상품 코드가 비어있으면 상품이름과 필드 초기화
        if (!code) {
			productNameInput.value = '';
			productNameInput.placeholder = '※ 상품 코드 형식 오류';
			quantityInput.value = '1'; // 수량은 1로 초기화
			unitPriceInput.value = '';
			row.querySelector('.total-price').value = '';
            return;
        }

        // 상품 코드 포맷팅
        const formatSuccess = formatProductCode(this);

        // 포맷팅이 실패하면 상품이름, 단가, 금액 지우기
		if (!formatSuccess) {
			productNameInput.value = '';
			productNameInput.placeholder = '※ 상품 코드 형식 오류';
			quantityInput.value = '1'; // 수량은 1로 초기화
			unitPriceInput.value = '';
			row.querySelector('.total-price').value = '';
			return;
		}

        // 포맷팅된 코드로 상품 정보 검색
        const formattedCode = this.value.trim();

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

                // 수량을 상품 정보의 기본 수량으로 설정 (있는 경우), 없으면 1로 유지
                if (productInfo.quantity) {
                    quantityInput.value = productInfo.quantity;
                }

                // 단가를 상품 정보의 가격으로 자동 입력
                unitPriceInput.value = productInfo.price;

                // 금액 재계산 (천단위 쉼표 포함)
                calculateRowTotal(row);

                console.log(`상품 정보 자동완성: ${formattedCode} -> ${productInfo.name} (수량: ${quantityInput.value}, 단가: ${productInfo.price}원)`);
            } else {
                // 상품을 찾지 못한 경우 - 상품이름 지우기
                productNameInput.value = '';
				quantityInput.value = '1'; // 수량은 1로 초기화
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
    });

    // 실시간으로도 확인 (입력 중)
    productCodeInput.addEventListener('input', function() {
        const code = this.value.trim();

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

                // 단가를 상품 정보의 가격으로 자동 입력
                unitPriceInput.value = productInfo.price;

                // 금액 재계산 (천단위 쉼표 포함)
                calculateRowTotal(row);
            } else {
                // 상품을 찾지 못하면 상품이름 지우기
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
