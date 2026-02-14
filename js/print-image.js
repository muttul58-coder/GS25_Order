// ========================================
// 인쇄 시 테이블 타이틀 컬럼 추가/제거
// ========================================

/**
 * 인쇄 전: 각 테이블 왼쪽에 세로 타이틀 컬럼 추가
 */
window.addEventListener('beforeprint', function() {
    // 0. PDF 파일명용 페이지 타이틀 변경 (주문서_성명_날짜시간)
    const ordererNameEl = document.getElementById('ordererName');
    const ordererName = ordererNameEl ? ordererNameEl.value.trim() : '';
    const now = new Date();
    const dateStr = now.getFullYear().toString()
        + String(now.getMonth() + 1).padStart(2, '0')
        + String(now.getDate()).padStart(2, '0')
        + String(now.getHours()).padStart(2, '0')
        + String(now.getMinutes()).padStart(2, '0');
    document._origTitle = document.title;
    if (ordererName) {
        document.title = '주문서_' + ordererName + '_' + dateStr;
    } else {
        document.title = '주문서_' + dateStr;
    }

    // 1. 주문자 정보 테이블
    const ordererTable = document.querySelector('.orderer-info-container table');
    if (ordererTable) {
        addPrintTitleColumn(ordererTable, '주문 정보', 'title-orderer');
    }

    // 2. 상품 정보 테이블 (orderer-info-container 안)
    const productTable = document.getElementById('productTable');
    if (productTable) {
        addProductPrintTitleColumn(productTable);
    }

    // 3. 각 주문 섹션의 보내는 분 / 받는 분 / 배송 상품 테이블
    const sections = document.querySelectorAll('.order-section');
    sections.forEach(section => {
        const tableWrappers = section.querySelectorAll('.table-responsive');
        // 순서: 0=보내는 분, 1=받는 분, 2=배송 상품
        if (tableWrappers[0]) {
            const senderTable = tableWrappers[0].querySelector('table');
            if (senderTable) addPrintTitleColumn(senderTable, '보내는 분', 'title-sender');
        }
        if (tableWrappers[1]) {
            const receiverTable = tableWrappers[1].querySelector('table');
            if (receiverTable) addPrintTitleColumn(receiverTable, '받는 분', 'title-receiver');
        }
        if (tableWrappers[2]) {
            const deliveryProductTable = tableWrappers[2].querySelector('table.delivery-product-section');
            if (deliveryProductTable) addDeliveryProductPrintTitleColumn(deliveryProductTable);
        }
    });

    // 4. 주소 input 텍스트 넘침 시 폰트 축소
    adjustAddressFontSize();
});

/**
 * 테이블에 세로 타이틀 컬럼 추가
 */
function addPrintTitleColumn(table, titleText, titleClass) {
    const allRows = table.querySelectorAll('tr');
    // no-print 행 및 숨겨진 행 제외한 실제 인쇄될 행 수 계산
    let printableRows = [];
    allRows.forEach(row => {
        if (!row.classList.contains('no-print') && row.style.display !== 'none') {
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
 * - DOM 노드를 직접 이동하여 input 값 보존
 */
function addProductPrintTitleColumn(table) {
    // thead/tbody/tfoot의 인쇄 가능한 모든 행 수집
    const allRows = table.querySelectorAll('tr');
    const printableRows = [];
    allRows.forEach(row => {
        if (!row.classList.contains('no-print') && row.style.display !== 'none') printableRows.push(row);
    });
    if (printableRows.length === 0) return;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    const tfoot = table.querySelector('tfoot');

    // 원본 구조 백업: DOM 노드 참조와 각 행의 소속 정보를 저장
    table.setAttribute('data-print-restructured', 'true');
    table._origStructure = {
        thead: thead,
        tbody: tbody,
        tfoot: tfoot,
        theadRows: thead ? Array.from(thead.querySelectorAll('tr')) : [],
        tbodyRows: tbody ? Array.from(tbody.querySelectorAll('tr')) : [],
        tfootRows: tfoot ? Array.from(tfoot.querySelectorAll('tr')) : []
    };

    // 모든 행을 table 직속으로 이동 (DOM 노드 이동이므로 input 값 보존)
    const allRowsList = Array.from(allRows);
    if (thead) thead.remove();
    if (tbody) tbody.remove();
    if (tfoot) tfoot.remove();
    allRowsList.forEach(row => table.appendChild(row));

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
    // 페이지 타이틀 복원
    if (document._origTitle) {
        document.title = document._origTitle;
        delete document._origTitle;
    }

    // 주소 폰트 크기 복원
    restoreAddressFontSize();

    // 타이틀 셀 제거
    const titleCells = document.querySelectorAll('[data-print-title="true"]');
    titleCells.forEach(cell => cell.remove());

    // 상품 테이블 구조 복원 (DOM 노드를 원래 thead/tbody/tfoot로 되돌림)
    const restructured = document.querySelectorAll('[data-print-restructured="true"]');
    restructured.forEach(table => {
        const orig = table._origStructure;
        if (!orig) return;

        // table 직속의 모든 행을 분리
        const currentRows = Array.from(table.querySelectorAll(':scope > tr'));
        currentRows.forEach(row => row.remove());

        // 원래 구조로 복원: thead/tbody/tfoot에 행을 다시 넣고 table에 추가
        if (orig.thead) {
            orig.theadRows.forEach(row => orig.thead.appendChild(row));
            table.appendChild(orig.thead);
        }
        if (orig.tbody) {
            orig.tbodyRows.forEach(row => orig.tbody.appendChild(row));
            table.appendChild(orig.tbody);
        }
        if (orig.tfoot) {
            orig.tfootRows.forEach(row => orig.tfoot.appendChild(row));
            table.appendChild(orig.tfoot);
        }

        table.removeAttribute('data-print-restructured');
        delete table._origStructure;

        // 이벤트 리스너 재연결
        const rows = table.querySelectorAll('.product-row');
        rows.forEach(row => {
            attachRowEventListeners(row);
            attachProductCodeFormatting(row);
        });
    });
});

// ========================================
// 인쇄 및 이미지 저장 함수
// ========================================

/**
 * 인쇄만 실행 (구글 폼 전송 없이)
 * PC/모바일 모두 window.print() → 브라우저 인쇄 미리보기
 * 인쇄 미리보기에서 "PDF로 저장" 선택 가능
 */
function printOnly() {
    if (!validateAllInputs()) return;
    window.print();
}

/**
 * 주문서 이미지 캡쳐 공통 함수
 * html2canvas로 화면을 캡쳐하여 canvas와 파일명을 반환
 * @returns {Promise<{canvas: HTMLCanvasElement, fileName: string} | null>}
 */
async function captureOrderImage() {
    // 1. 파일명 생성
    const ordererNameEl = document.getElementById('ordererName');
    const ordererName = ordererNameEl ? ordererNameEl.value.trim() : '';
    const now = new Date();
    const dateStr = now.getFullYear().toString()
        + String(now.getMonth() + 1).padStart(2, '0')
        + String(now.getDate()).padStart(2, '0')
        + String(now.getHours()).padStart(2, '0')
        + String(now.getMinutes()).padStart(2, '0');
    const fileName = ordererName
        ? '주문서_' + ordererName + '_' + dateStr + '.png'
        : '주문서_' + dateStr + '.png';

    // 2. 버튼, 알림 등 불필요한 요소 숨김
    const noPrintEls = document.querySelectorAll('.no-print');
    noPrintEls.forEach(el => { el.style.display = 'none'; });
    const alertBox = document.getElementById('alertBox');
    if (alertBox) alertBox.style.display = 'none';

    // 3. 컨테이너 스타일 임시 조정 (그림자, 둥근모서리 제거)
    const container = document.querySelector('.container');
    const origStyle = container.style.cssText;
    container.style.boxShadow = 'none';
    container.style.borderRadius = '0';
    container.style.background = 'white';

    // 3-1. 모바일 대응: 컨테이너를 데스크톱 너비로 확장하여 전체 캡쳐
    const isMobile = window.innerWidth < 800;
    const origBodyOverflow = document.body.style.overflow;
    const tableResponsives = container.querySelectorAll('.table-responsive');
    const origTableResponsiveStyles = [];
    if (isMobile) {
        container.style.width = '1024px';
        container.style.maxWidth = '1024px';
        container.style.padding = '25px';
        document.body.style.overflow = 'hidden';
        tableResponsives.forEach(el => {
            origTableResponsiveStyles.push(el.style.cssText);
            el.style.overflowX = 'visible';
            el.style.overflow = 'visible';
        });
        container.querySelectorAll('table').forEach(t => {
            t.style.minWidth = '0';
            t.style.width = '100%';
        });
    }

    // 3-2. 이미지 캡쳐용 인적사항 테이블 컬럼 너비 조정
    const origThWidths = [];
    container.querySelectorAll('th[style*="width: 90px"]').forEach(th => {
        origThWidths.push({ el: th, orig: th.style.width });
        th.style.width = '70px';
    });
    container.querySelectorAll('th[style*="width: 160px"]').forEach(th => {
        origThWidths.push({ el: th, orig: th.style.width });
        th.style.width = '120px';
    });
    container.querySelectorAll('th[style*="width: 150px"]').forEach(th => {
        origThWidths.push({ el: th, orig: th.style.width });
        th.style.width = '70px';
    });

    // 4. input/select/textarea를 span으로 임시 교체 (html2canvas 텍스트 잘림 방지)
    const replacedElements = [];
    container.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.offsetParent === null && el.type !== 'hidden') return;
        if (el.type === 'hidden') return;

        const span = document.createElement('span');
        const styles = window.getComputedStyle(el);

        span.style.display = styles.display === 'none' ? 'none' : 'inline-flex';
        span.style.alignItems = 'center';
        span.style.width = styles.width;
        span.style.height = styles.height;
        span.style.padding = styles.padding;
        span.style.margin = styles.margin;
        span.style.border = styles.border;
        span.style.borderRadius = styles.borderRadius;
        span.style.backgroundColor = styles.backgroundColor;
        span.style.fontSize = styles.fontSize;
        span.style.fontFamily = styles.fontFamily;
        span.style.fontWeight = styles.fontWeight;
        span.style.color = styles.color;
        span.style.textAlign = styles.textAlign;
        span.style.overflow = 'hidden';
        span.style.whiteSpace = 'nowrap';
        span.style.boxSizing = 'border-box';

        if (el.tagName === 'SELECT') {
            span.textContent = el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
        } else {
            span.textContent = el.value;
        }

        span.setAttribute('data-capture-replacement', 'true');
        el.style.display = 'none';
        el.parentNode.insertBefore(span, el.nextSibling);
        replacedElements.push(el);
    });

    // 5. 렌더링 대기
    await new Promise(r => setTimeout(r, 800));

    // 6. html2canvas 캡쳐
    let canvas = null;
    try {
        canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            windowWidth: isMobile ? 1100 : undefined,
            width: container.scrollWidth,
            height: container.scrollHeight
        });
    } catch(e) {
        console.error('이미지 캡쳐 실패:', e);
    }

    // 7. DOM 복원
    replacedElements.forEach(el => { el.style.display = ''; });
    container.querySelectorAll('[data-capture-replacement]').forEach(s => s.remove());
    noPrintEls.forEach(el => { el.style.display = ''; });
    container.style.cssText = origStyle;
    origThWidths.forEach(({ el, orig }) => { el.style.width = orig; });
    if (isMobile) {
        document.body.style.overflow = origBodyOverflow;
        tableResponsives.forEach((el, i) => {
            el.style.cssText = origTableResponsiveStyles[i] || '';
        });
        container.querySelectorAll('table').forEach(t => {
            t.style.minWidth = '';
            t.style.width = '';
        });
    }

    if (!canvas) return null;
    return { canvas, fileName };
}

/**
 * canvas를 Blob(PNG)으로 변환하는 유틸리티
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas) {
    return new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
    });
}

/**
 * 이미지로 저장 (html2canvas 캡쳐 방식)
 * 화면에 보이는 그대로 캡쳐 → PNG 다운로드
 * @media print CSS는 사용하지 않음 (축소 문제 방지)
 */
async function saveAsImage() {
    if (!validateAllInputs()) return;

    showAlert('이미지를 생성하고 있습니다... 잠시 기다려주세요.', 'info');
    await new Promise(r => setTimeout(r, 300));

    const result = await captureOrderImage();
    if (!result) {
        showAlert('이미지 저장에 실패했습니다. 인쇄 버튼으로 PDF 저장을 이용해주세요.', 'error');
        return;
    }

    const { canvas, fileName } = result;
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showAlert('이미지가 저장되었습니다! (' + fileName + ')', 'success');
}

/**
 * 카카오톡 공유 (Web Share API 활용)
 * 모바일: 이미지 파일을 카카오톡/메시지 앱으로 직접 공유
 * PC: Web Share API 지원 시 공유, 미지원 시 이미지 다운로드 + 안내
 */
async function shareToKakao() {
    if (!validateAllInputs()) return;

    showAlert('공유할 이미지를 생성하고 있습니다... 잠시 기다려주세요.', 'info');
    await new Promise(r => setTimeout(r, 300));

    const result = await captureOrderImage();
    if (!result) {
        showAlert('이미지 생성에 실패했습니다. 다시 시도해주세요.', 'error');
        return;
    }

    const { canvas, fileName } = result;
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], fileName, { type: 'image/png' });

    // Web Share API 지원 여부 확인 (파일 공유 가능 여부)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: '주문서',
                text: '주문서 이미지입니다.',
                files: [file]
            });
            showAlert('✅ 공유가 완료되었습니다!', 'success');
        } catch (err) {
            // 사용자가 공유를 취소한 경우
            if (err.name === 'AbortError') {
                showAlert('공유가 취소되었습니다.', 'info');
            } else {
                console.error('공유 실패:', err);
                // 공유 실패 시 다운로드로 대체
                fallbackDownloadAndGuide(canvas, fileName);
            }
        }
    } else {
        // Web Share API 미지원 (주로 PC 브라우저)
        fallbackDownloadAndGuide(canvas, fileName);
    }
}

/**
 * Web Share API 미지원 환경에서 이미지 다운로드 후 안내 표시
 */
function fallbackDownloadAndGuide(canvas, fileName) {
    // 이미지 다운로드
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 카카오톡 전송 안내 대화상자 표시
    showShareGuideDialog(fileName);
}

/**
 * 카카오톡 전송 안내 대화상자
 */
function showShareGuideDialog(fileName) {
    const existing = document.getElementById('shareGuideDialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'shareGuideDialog';
    overlay.className = 'confirm-overlay';
    overlay.innerHTML =
        '<div class="share-guide-box">' +
            '<div class="share-guide-icon">💬</div>' +
            '<h3 class="share-guide-title">카카오톡으로 전송하기</h3>' +
            '<p class="share-guide-filename">' + fileName + '</p>' +
            '<div class="share-guide-steps">' +
                '<div class="share-guide-step">' +
                    '<span class="step-number">1</span>' +
                    '<span class="step-text">이미지가 다운로드되었습니다</span>' +
                '</div>' +
                '<div class="share-guide-step">' +
                    '<span class="step-number">2</span>' +
                    '<span class="step-text">카카오톡 대화방을 열어주세요</span>' +
                '</div>' +
                '<div class="share-guide-step">' +
                    '<span class="step-number">3</span>' +
                    '<span class="step-text"><strong>+ 버튼 → 사진/파일</strong>에서 다운로드한 이미지를 선택하여 전송하세요</span>' +
                '</div>' +
            '</div>' +
            '<div class="share-guide-buttons">' +
                '<button type="button" class="confirm-btn confirm-yes" id="shareGuideOkBtn">확인</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    // 확인 버튼 이벤트
    document.getElementById('shareGuideOkBtn').addEventListener('click', function() {
        overlay.remove();
    });

    // 오버레이 클릭 시 닫기
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });
}
