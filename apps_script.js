/**
 * LG 생산기술원점 주문서 - 자동 데이터 파싱 스크립트
 *
 * 이 스크립트는 구글 폼에서 받은 JSON 데이터를 자동으로 파싱하여
 * 보기 좋은 형태로 스프레드시트에 정리합니다.
 *
 * JSON 데이터 구조:
 * - 주문자정보: { 성명, 전화번호, 우편번호, 기본주소, 상세주소 }
 * - 주문목록: [{ 주문번호, 보내는분, 받는분, 상품목록 }]
 *   - 보내는분/받는분: { 성명, 전화번호, 우편번호, 기본주소, 상세주소 }
 *   - 상품목록: [{ 상품코드, 상품이름, 수량, 단가, 금액 }]
 * - 전체합계: { 총주문건수, 총수량, 총금액 }
 *
 * 사용 방법:
 * 1. 구글 스프레드시트에서 확장 프로그램 → Apps Script 클릭
 * 2. 이 코드를 복사해서 붙여넣기
 * 3. 저장 후 트리거 설정 (선택사항)
 */

/**
 * 폼 제출 시 자동으로 실행되는 트리거 함수
 *
 * 설정 방법:
 * 1. Apps Script 편집기에서 ⏰(트리거) 아이콘 클릭
 * 2. '+ 트리거 추가' 클릭
 * 3. 함수: onFormSubmit
 * 4. 이벤트 소스: 스프레드시트에서
 * 5. 이벤트 유형: 양식 제출 시
 * 6. 저장
 */
function onFormSubmit(e) {
  try {
    parseNewSubmission();
  } catch (error) {
    Logger.log('오류 발생: ' + error);
  }
}

/**
 * 가장 최근에 제출된 주문 데이터를 파싱하여 별도 시트에 정리
 */
function parseNewSubmission() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const formSheet = ss.getSheets()[0]; // 폼 응답 시트 (첫 번째 시트)

  // 마지막 행 가져오기 (가장 최근 제출)
  const lastRow = formSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('제출된 데이터가 없습니다.');
    return;
  }

  // 데이터 읽기 (실제 스프레드시트 열 순서에 맞춤)
  const timestamp = formSheet.getRange(lastRow, 1).getValue(); // A열: 타임스탬프
  const orderDateTime = formSheet.getRange(lastRow, 2).getValue(); // B열: 주문 일시
  const jsonData = formSheet.getRange(lastRow, 3).getValue(); // C열: 주문 데이터(JSON)
  const ordererName = formSheet.getRange(lastRow, 4).getValue(); // D열: 성명
  const ordererPhone = formSheet.getRange(lastRow, 5).getValue(); // E열: 전화번호

  // JSON 파싱
  let orderData;
  try {
    orderData = JSON.parse(jsonData);
  } catch (e) {
    Logger.log('JSON 파싱 오류: ' + e);
    return;
  }

  // 주문자 이름(전화번호 끝4자리)으로 시트 생성
  const ordererNameForSheet = (orderData['주문자정보'] && orderData['주문자정보']['성명']) || ordererName || '미확인';
  const rawPhone = (orderData['주문자정보'] && orderData['주문자정보']['전화번호']) || ordererPhone || '';
  const ordererPhoneForSheet = String(rawPhone).replace(/[^0-9]/g, '').slice(-4);
  const ordererLabel = ordererNameForSheet + (ordererPhoneForSheet ? '(' + ordererPhoneForSheet + ')' : '');
  const sheetName = ordererLabel + '_주문_' + Utilities.formatDate(new Date(timestamp), 'GMT+9', 'yyyyMMdd_HHmmss');
  let orderSheet = ss.getSheetByName(sheetName);

  if (!orderSheet) {
    orderSheet = ss.insertSheet(sheetName);
  } else {
    orderSheet.clear();
  }

  // 시트 포맷팅
  createOrderSheet(orderSheet, timestamp, orderDateTime, orderData);

  Logger.log('주문서 파싱 완료: ' + sheetName);
}

/**
 * 주소를 기본주소 + 상세주소로 합쳐서 반환
 * @param {Object} info - 주소 정보 객체
 * @returns {string} - 합쳐진 주소 문자열
 */
function getFullAddress(info) {
  if (!info) return '';
  var base = info['기본주소'] || '';
  var detail = info['상세주소'] || '';
  base = String(base).trim();
  detail = String(detail).trim();
  if (base && detail) return base + ' ' + detail;
  return base || detail || '';
}

/**
 * 우편번호를 문자열로 변환 (앞자리 0 보존)
 * @param {*} postal - 우편번호 값
 * @returns {string} - 5자리 우편번호 문자열
 */
function formatPostalCode(postal) {
  if (!postal && postal !== 0) return '';
  var str = String(postal).trim();
  // 5자리 미만이면 앞에 0 채우기
  while (str.length < 5) {
    str = '0' + str;
  }
  return str;
}

/**
 * 셀에 우편번호를 문자열 형식으로 입력
 * @param {Range} range - 대상 셀
 * @param {*} postal - 우편번호 값
 */
function setPostalCell(range, postal) {
  var formatted = formatPostalCode(postal);
  range.setNumberFormat('@'); // 문자열(텍스트) 형식으로 지정
  range.setValue(formatted);
}

/**
 * 인적사항(성명, 전화번호, 우편번호, 주소)을 시트에 출력
 * @param {Sheet} orderSheet - 대상 시트
 * @param {number} currentRow - 현재 행 번호
 * @param {Object} info - 인적사항 객체
 * @param {string} labelBg - 라벨 배경색
 * @returns {number} - 다음 행 번호
 */
function writePersonInfo(orderSheet, currentRow, info, labelBg) {
  if (!info) info = {};
  var fullAddress = getFullAddress(info);

  // 1행: 성명, 전화번호
  orderSheet.getRange(currentRow, 1).setValue('성명').setFontWeight('bold').setBackground(labelBg);
  orderSheet.getRange(currentRow, 2).setValue(info['성명'] || '');
  orderSheet.getRange(currentRow, 3).setValue('전화번호').setFontWeight('bold').setBackground(labelBg);
  orderSheet.getRange(currentRow, 4, 1, 6).merge();
  orderSheet.getRange(currentRow, 4).setValue(info['전화번호'] || '');
  currentRow++;

  // 2행: 우편번호, 주소
  orderSheet.getRange(currentRow, 1).setValue('우편번호').setFontWeight('bold').setBackground(labelBg);
  setPostalCell(orderSheet.getRange(currentRow, 2), info['우편번호']);
  orderSheet.getRange(currentRow, 3).setValue('주소').setFontWeight('bold').setBackground(labelBg);
  orderSheet.getRange(currentRow, 4, 1, 6).merge();
  orderSheet.getRange(currentRow, 4).setValue(fullAddress);
  currentRow++;

  return currentRow;
}

/**
 * 주문서 시트 생성 (공통 함수)
 */
function createOrderSheet(orderSheet, timestamp, orderDateTime, orderData) {
  orderSheet.clear();

  var currentRow = 1;

  // 제목
  orderSheet.getRange(currentRow, 1, 1, 9).merge();
  orderSheet.getRange(currentRow, 1).setValue('주 문 서');
  orderSheet.getRange(currentRow, 1).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center');
  orderSheet.getRange(currentRow, 1).setBackground('#f9f3c4');
  currentRow += 2;

  // 주문 일시
  orderSheet.getRange(currentRow, 1).setValue('제출 시각:');
  orderSheet.getRange(currentRow, 2, 1, 2).merge();
  orderSheet.getRange(currentRow, 2).setValue(timestamp);
  currentRow++;

  orderSheet.getRange(currentRow, 1).setValue('주문 일시:');
  orderSheet.getRange(currentRow, 2, 1, 2).merge();
  orderSheet.getRange(currentRow, 2).setValue(orderDateTime);
  currentRow += 2;

  // ▣ 주문자 정보
  orderSheet.getRange(currentRow, 1, 1, 9).merge();
  orderSheet.getRange(currentRow, 1).setValue('▣ 주문자 정보');
  orderSheet.getRange(currentRow, 1).setFontWeight('bold').setBackground('#9C27B0').setFontColor('white');
  orderSheet.getRange(currentRow, 1).setHorizontalAlignment('center');
  currentRow++;

  var ordererInfo = orderData['주문자정보'] || {};
  currentRow = writePersonInfo(orderSheet, currentRow, ordererInfo, '#e1bee7');

  currentRow += 2;

  // 전체 합계를 위한 누적 변수
  var allTotalQuantity = 0;
  var allGrandTotal = 0;

  // 각 주문 섹션 처리
  var sections = orderData['주문목록'] || [];
  for (var idx = 0; idx < sections.length; idx++) {
    var section = sections[idx];

    // 섹션 제목
    orderSheet.getRange(currentRow, 1, 1, 9).merge();
    orderSheet.getRange(currentRow, 1).setValue('━━━━━ 주문 #' + section['주문번호'] + ' ━━━━━');
    orderSheet.getRange(currentRow, 1).setFontWeight('bold').setBackground('#4CAF50').setFontColor('white');
    orderSheet.getRange(currentRow, 1).setHorizontalAlignment('center');
    currentRow++;

    // ▶ 보내는 분
    orderSheet.getRange(currentRow, 1, 1, 9).merge();
    orderSheet.getRange(currentRow, 1).setValue('▶ 보내는 분');
    orderSheet.getRange(currentRow, 1).setFontWeight('bold').setBackground('#ffb3ba');
    currentRow++;

    var senderInfo = section['보내는분'] || {};
    currentRow = writePersonInfo(orderSheet, currentRow, senderInfo, '#ffe6e6');
    currentRow++;

    // ▶ 받는 분
    orderSheet.getRange(currentRow, 1, 1, 9).merge();
    orderSheet.getRange(currentRow, 1).setValue('▶ 받는 분');
    orderSheet.getRange(currentRow, 1).setFontWeight('bold').setBackground('#d4e9ff');
    currentRow++;

    var receiverInfo = section['받는분'] || {};
    currentRow = writePersonInfo(orderSheet, currentRow, receiverInfo, '#e3f2fd');
    currentRow++;

    // ▶ 상품 정보
    orderSheet.getRange(currentRow, 1, 1, 9).merge();
    orderSheet.getRange(currentRow, 1).setValue('▶ 상품 정보');
    orderSheet.getRange(currentRow, 1).setFontWeight('bold').setBackground('#fff3cd');
    currentRow++;

    // 상품 테이블 헤더
    var headers = ['No.', '상품코드', '상품이름', '수량', '단가', '금액', '바코드'];
    for (var i = 0; i < headers.length; i++) {
      orderSheet.getRange(currentRow, i + 1).setValue(headers[i]);
      orderSheet.getRange(currentRow, i + 1).setFontWeight('bold').setBackground('#fff9c4');
      orderSheet.getRange(currentRow, i + 1).setHorizontalAlignment('center');
    }
    currentRow++;

    // 상품 데이터
    var totalQuantity = 0;
    var grandTotal = 0;
    var products = section['상품목록'] || [];

    for (var p = 0; p < products.length; p++) {
      var product = products[p];
      var quantity = Number(product['수량']) || 0;
      var unitPrice = Number(product['단가']) || 0;
      var totalPrice = Number(product['금액']) || 0;

      totalQuantity += quantity;
      grandTotal += totalPrice;

      var productRow = [
        p + 1,
        product['상품코드'] || '',
        product['상품이름'] || '',
        quantity,
        unitPrice.toLocaleString(),
        totalPrice.toLocaleString()
      ];

      for (var j = 0; j < productRow.length; j++) {
        orderSheet.getRange(currentRow, j + 1).setValue(productRow[j]);
        orderSheet.getRange(currentRow, j + 1).setHorizontalAlignment('center');
      }

      // G열(7열): VLOOKUP으로 상품목록 시트에서 바코드 이미지 가져오기
      var productCode = String(product['상품코드'] || '').trim();
      if (productCode) {
        // VLOOKUP(상품코드, 상품목록!B:C, 2, FALSE)
        var vlookupFormula = '=IFERROR(VLOOKUP("' + productCode + '",상품목록!B:C,2,FALSE),"")';
        orderSheet.getRange(currentRow, 7).setFormula(vlookupFormula);
        orderSheet.getRange(currentRow, 7).setHorizontalAlignment('center');
      }

      // 상품 행 높이 150
      orderSheet.setRowHeight(currentRow, 100);

      currentRow++;
    }

    // 섹션 합계 행
    orderSheet.getRange(currentRow, 1, 1, 3).merge();
    orderSheet.getRange(currentRow, 1).setValue('합계').setFontWeight('bold').setBackground('#fffacd');
    orderSheet.getRange(currentRow, 1).setHorizontalAlignment('center');

    orderSheet.getRange(currentRow, 4).setValue(totalQuantity).setFontWeight('bold').setBackground('#fffacd');
    orderSheet.getRange(currentRow, 4).setHorizontalAlignment('center');

    orderSheet.getRange(currentRow, 5).setValue('총 금액:').setFontWeight('bold').setBackground('#fffacd');
    orderSheet.getRange(currentRow, 5).setHorizontalAlignment('center');

    orderSheet.getRange(currentRow, 6).setValue(grandTotal.toLocaleString() + ' 원').setFontWeight('bold').setBackground('#fffacd');
    orderSheet.getRange(currentRow, 6).setHorizontalAlignment('center');

    // 전체 합계에 누적
    allTotalQuantity += totalQuantity;
    allGrandTotal += grandTotal;

    currentRow += 3; // 섹션 간격
  }

  // ━━━ 전체 합계 ━━━
  orderSheet.getRange(currentRow, 1, 1, 9).merge();
  orderSheet.getRange(currentRow, 1).setValue('━━━━━ 전체 합계 ━━━━━');
  orderSheet.getRange(currentRow, 1).setFontSize(12).setFontWeight('bold')
    .setBackground('#2563eb').setFontColor('white').setHorizontalAlignment('center');
  currentRow++;

  // 전체 합계 헤더
  var grandHeaders = ['총 주문 건수', '총 수량', '총 금액'];
  var grandHeaderCols = [1, 3, 5];
  var grandHeaderSpans = [2, 2, 2];

  for (var h = 0; h < grandHeaders.length; h++) {
    orderSheet.getRange(currentRow, grandHeaderCols[h], 1, grandHeaderSpans[h]).merge();
    orderSheet.getRange(currentRow, grandHeaderCols[h]).setValue(grandHeaders[h]);
    orderSheet.getRange(currentRow, grandHeaderCols[h]).setFontWeight('bold')
      .setBackground('#dbeafe').setHorizontalAlignment('center');
  }
  currentRow++;

  // 전체 합계 값 (JSON에 있으면 사용, 없으면 계산값 사용)
  var jsonGrandTotal = orderData['전체합계'];
  var finalSections = jsonGrandTotal ? (jsonGrandTotal['총주문건수'] || sections.length) : sections.length;
  var finalQuantity = jsonGrandTotal ? (jsonGrandTotal['총수량'] || allTotalQuantity) : allTotalQuantity;
  var finalAmount = jsonGrandTotal ? (jsonGrandTotal['총금액'] || allGrandTotal) : allGrandTotal;

  var grandValues = [finalSections + '건', finalQuantity, Number(finalAmount).toLocaleString() + ' 원'];

  for (var v = 0; v < grandValues.length; v++) {
    orderSheet.getRange(currentRow, grandHeaderCols[v], 1, grandHeaderSpans[v]).merge();
    orderSheet.getRange(currentRow, grandHeaderCols[v]).setValue(grandValues[v]);
    orderSheet.getRange(currentRow, grandHeaderCols[v]).setFontSize(12).setFontWeight('bold')
      .setBackground('#eff6ff').setHorizontalAlignment('center');
  }
  currentRow += 2;

  // 열 너비 자동 조정
  for (var c = 1; c <= 9; c++) {
    orderSheet.autoResizeColumn(c);
  }
  // G열(7열) 바코드 너비 300으로 고정
  orderSheet.setColumnWidth(7, 200);

  // 테두리 추가
  var lastDataRow = currentRow - 1;
  orderSheet.getRange(1, 1, lastDataRow, 9).setBorder(true, true, true, true, true, true);
}

/**
 * 모든 폼 응답을 한 번에 파싱 (수동 실행용)
 *
 * 사용 방법:
 * 1. Apps Script 편집기에서 이 함수 선택
 * 2. 실행 버튼(▶) 클릭
 */
function parseAllSubmissions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var formSheet = ss.getSheets()[0]; // 폼 응답 시트

  var lastRow = formSheet.getLastRow();

  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('파싱할 데이터가 없습니다.');
    return;
  }

  var successCount = 0;
  var errorCount = 0;

  // 각 행을 처리
  for (var row = 2; row <= lastRow; row++) {
    try {
      var timestamp = formSheet.getRange(row, 1).getValue(); // A열: 타임스탬프
      var orderDateTime = formSheet.getRange(row, 2).getValue(); // B열: 주문 일시
      var jsonData = formSheet.getRange(row, 3).getValue(); // C열: 주문 데이터(JSON)
      var formName = formSheet.getRange(row, 4).getValue(); // D열: 성명
      var formPhone = formSheet.getRange(row, 5).getValue(); // E열: 전화번호

      // JSON 파싱
      var orderData;
      try {
        orderData = JSON.parse(jsonData);
      } catch (e) {
        Logger.log('행 ' + row + ': JSON 파싱 오류 - ' + e);
        errorCount++;
        continue;
      }

      // 주문자 이름(전화번호 끝4자리)으로 시트 생성
      var ordererNameForSheet = (orderData['주문자정보'] && orderData['주문자정보']['성명']) || formName || '미확인';
      var rawPhone = (orderData['주문자정보'] && orderData['주문자정보']['전화번호']) || formPhone || '';
      var ordererPhoneForSheet = String(rawPhone).replace(/[^0-9]/g, '').slice(-4);
      var ordererLabel = ordererNameForSheet + (ordererPhoneForSheet ? '(' + ordererPhoneForSheet + ')' : '');
      var sheetName = ordererLabel + '_주문_' + Utilities.formatDate(new Date(timestamp), 'GMT+9', 'yyyyMMdd_HHmmss');
      var orderSheet = ss.getSheetByName(sheetName);

      if (orderSheet) {
        Logger.log('행 ' + row + ': 이미 처리됨 - ' + sheetName);
        continue;
      }

      orderSheet = ss.insertSheet(sheetName);

      // 시트 내용 생성
      createOrderSheet(orderSheet, timestamp, orderDateTime, orderData);

      Logger.log('행 ' + row + ': 파싱 완료 - ' + sheetName);
      successCount++;

    } catch (error) {
      Logger.log('행 ' + row + ': 오류 발생 - ' + error);
      errorCount++;
    }
  }

  SpreadsheetApp.getUi().alert(
    '파싱 완료!\n성공: ' + successCount + '건\n실패: ' + errorCount + '건'
  );
}

/**
 * 메뉴 추가 (스프레드시트 열 때 자동 실행)
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📋 주문서 관리')
      .addItem('🔄 최신 주문 파싱', 'parseNewSubmission')
      .addItem('📊 모든 주문 파싱', 'parseAllSubmissions')
      .addToUi();
}
