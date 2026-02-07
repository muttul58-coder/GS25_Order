        // ========================================
        // 알림 메시지 표시 함수
        // ========================================

        /**
         * 사용자에게 알림 메시지 표시
         * @param {string} message - 표시할 메시지
         * @param {string} type - 메시지 타입 ('success', 'warning', 'error')
         */
        function showAlert(message, type = 'success') {
            const alertBox = document.getElementById('alertBox');
            alertBox.textContent = message;
            alertBox.className = `alert ${type}`;
            alertBox.style.display = 'block';

            // 3초 후 자동으로 숨김
            setTimeout(() => {
                alertBox.style.display = 'none';
            }, 3000);
        }

        // ========================================
        // 인쇄 시 테이블 타이틀 컬럼 추가/제거
        // ========================================

        /**
         * 인쇄 전: 각 테이블 왼쪽에 세로 타이틀 컬럼 추가
         */
        window.addEventListener('beforeprint', function() {
            // 1. 주문자 정보 테이블
            const ordererTable = document.querySelector('.orderer-info-container table');
            if (ordererTable) {
                addPrintTitleColumn(ordererTable, '주문자', 'title-orderer');
            }

            // 2. 각 주문 섹션의 보내는 분 / 받는 분 / 상품 정보 테이블
            const sections = document.querySelectorAll('.order-section');
            sections.forEach(section => {
                const tableWrappers = section.querySelectorAll('.table-responsive');
                // 순서: 0=보내는 분, 1=받는 분, 2=상품 정보
                if (tableWrappers[0]) {
                    const senderTable = tableWrappers[0].querySelector('table');
                    if (senderTable) addPrintTitleColumn(senderTable, '보내는 분', 'title-sender');
                }
                if (tableWrappers[1]) {
                    const receiverTable = tableWrappers[1].querySelector('table');
                    if (receiverTable) addPrintTitleColumn(receiverTable, '받는 분', 'title-receiver');
                }
                if (tableWrappers[2]) {
                    const productTable = tableWrappers[2].querySelector('table');
                    if (productTable) addProductPrintTitleColumn(productTable);
                }
            });

            // 3. 전체 합계 테이블
            const grandTotalTable = document.querySelector('.grand-total-container table');
            if (grandTotalTable) {
                addPrintTitleColumn(grandTotalTable, '전체 합계', 'title-grand-total');
            }

            // 4. 주소 input 텍스트 넘침 시 폰트 축소
            adjustAddressFontSize();
        });

        /**
         * 테이블에 세로 타이틀 컬럼 추가
         */
        function addPrintTitleColumn(table, titleText, titleClass) {
            const allRows = table.querySelectorAll('tr');
            // no-print 행 제외한 실제 인쇄될 행 수 계산
            let printableRows = [];
            allRows.forEach(row => {
                if (!row.classList.contains('no-print')) {
                    printableRows.push(row);
                }
            });

            if (printableRows.length === 0) return;

            let titleInserted = false;
            allRows.forEach(row => {
                if (row.classList.contains('no-print')) return;

                if (!titleInserted) {
                    // 첫 번째 인쇄 행에 rowspan 타이틀 셀 추가
                    const titleCell = document.createElement('td');
                    titleCell.className = 'print-title-cell ' + titleClass;
                    titleCell.setAttribute('rowspan', printableRows.length);
                    titleCell.textContent = titleText;
                    titleCell.setAttribute('data-print-title', 'true');
                    row.insertBefore(titleCell, row.firstChild);
                    titleInserted = true;
                }
            });
        }

        /**
         * 상품 정보 테이블 전용: thead/tbody/tfoot 통합 후 전체 세로 병합
         */
        function addProductPrintTitleColumn(table) {
            // thead/tbody/tfoot의 인쇄 가능한 모든 행 수집
            const allRows = table.querySelectorAll('tr');
            const printableRows = [];
            allRows.forEach(row => {
                if (!row.classList.contains('no-print')) printableRows.push(row);
            });
            if (printableRows.length === 0) return;

            // thead/tbody/tfoot 제거 → 행들을 table 직속으로 이동
            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');
            const tfoot = table.querySelector('tfoot');
            const allRowsCopy = Array.from(allRows);

            // 원본 구조 백업 (afterprint 복원용)
            table.setAttribute('data-print-restructured', 'true');
            table._origHTML = table.innerHTML;

            // 모든 행을 table 직속으로 이동
            if (thead) thead.remove();
            if (tbody) tbody.remove();
            if (tfoot) tfoot.remove();
            allRowsCopy.forEach(row => table.appendChild(row));

            // 첫 번째 인쇄 행에 전체 rowspan 셀 추가
            const titleCell = document.createElement('td');
            titleCell.className = 'print-title-cell title-product';
            titleCell.setAttribute('rowspan', printableRows.length);
            titleCell.textContent = '상품정보';
            titleCell.setAttribute('data-print-title', 'true');
            printableRows[0].insertBefore(titleCell, printableRows[0].firstChild);
        }

        /**
         * 주소 input 텍스트가 넘치면 폰트 크기를 축소
         */
        function adjustAddressFontSize() {
            // td.address-field 단위로 처리 - 항상 두 줄로 표시
            document.querySelectorAll('td.address-field').forEach(td => {
                const inputs = td.querySelectorAll('input');
                if (inputs.length < 2) return;

                const addr1 = inputs[0]; // 기본주소
                const addr2 = inputs[1]; // 상세주소

                // 모든 input 숨기기
                inputs.forEach(input => {
                    input.style.display = 'none';
                    input.setAttribute('data-print-hidden', 'true');
                });

                // 기본주소 span (1줄)
                const span1 = document.createElement('span');
                span1.className = 'print-address-text print-address-full';
                span1.textContent = addr1.value || '';
                span1.setAttribute('data-print-replace', 'true');
                td.appendChild(span1);

                // 상세주소 span (2줄) - block 요소라 자동 줄바꿈
                const span2 = document.createElement('span');
                span2.className = 'print-address-text print-address-full';
                span2.textContent = addr2.value || '';
                span2.setAttribute('data-print-replace', 'true');
                td.appendChild(span2);
            });
        }

        /**
         * 주소 input 폰트 크기 복원
         */
        function restoreAddressFontSize() {
            // span, br 제거하고 input 복원
            document.querySelectorAll('[data-print-replace]').forEach(el => {
                el.remove();
            });
            document.querySelectorAll('input[data-print-hidden]').forEach(input => {
                input.style.display = '';
                input.removeAttribute('data-print-hidden');
            });
        }

        /**
         * 인쇄 후: 추가한 타이틀 컬럼 제거 및 테이블 구조 복원
         */
        window.addEventListener('afterprint', function() {
            // 주소 폰트 크기 복원
            restoreAddressFontSize();

            // 타이틀 셀 제거
            const titleCells = document.querySelectorAll('[data-print-title="true"]');
            titleCells.forEach(cell => cell.remove());

            // 상품 테이블 구조 복원
            const restructured = document.querySelectorAll('[data-print-restructured="true"]');
            restructured.forEach(table => {
                table.innerHTML = table._origHTML;
                table.removeAttribute('data-print-restructured');
                delete table._origHTML;

                // 이벤트 리스너 재연결
                const rows = table.querySelectorAll('.product-row');
                rows.forEach(row => {
                    attachRowEventListeners(row);
                    attachProductCodeFormatting(row);
                });
            });
        });
