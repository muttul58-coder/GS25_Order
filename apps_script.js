/**
 * ============================================================
 *  GS25 주문서 - Google Apps Script (자동 데이터 파싱)
 * ============================================================
 *
 * 이 스크립트는 order_form.html에서 Google Forms로 제출된 JSON 데이터를
 * 파싱하여 보기 좋은 주문서 시트로 자동 변환합니다.
 *
 * ────────────────────────────────────────────────────────────
 *  핵심: 열 순서를 하드코딩하지 않고 자동 감지합니다.
 *  - 모든 열을 순회하며 JSON 문자열(`{`로 시작)이 있는 열을 찾습니다.
 *  - 타임스탬프는 항상 A열(1열)입니다.
 *  - 나머지 열(주문일시, 성명, 전화번호)은 JSON 열을 제외한 순서로 매핑합니다.
 * ────────────────────────────────────────────────────────────
 *
 *  JSON 데이터 구조 (order_form.html → collectOrderData):
 *  {
 *    "주문자정보": { 성명, 전화번호, 우편번호, 기본주소, 상세주소 },
 *    "상품목록": [{ 상품코드, 상품이름, 행사, 수량, 단가, 금액 }],
 *    "주문목록": [{
 *      주문번호,
 *      보내는분: { 성명, 전화번호, 우편번호, 기본주소, 상세주소 },
 *      받는분:   { 성명, 전화번호, 우편번호, 기본주소, 상세주소 },
 *      배송상품목록: [{ 상품코드, 상품이름, 수량 }]
 *    }],
 *    "전체합계": { 총주문건수, 총수량, 총금액 }
 *  }
 *
 * ────────────────────────────────────────────────────────────
 *  설치 방법
 * ────────────────────────────────────────────────────────────
 *  1. Google Sheets → 확장 프로그램 → Apps Script
 *  2. 이 코드를 전체 복사하여 붙여넣기
 *  3. 저장(Ctrl+S)
 *  4. onOpen 실행하여 메뉴 활성화 (최초 1회)
 *  5. (선택) 트리거 설정 → onFormSubmit → 양식 제출 시
 *  6. (선택) Sheets API 서비스 활성화 (행 높이 자동 조정용)
 *     - Apps Script 편집기 → 서비스(+) → Google Sheets API → 추가
 */

// ============================================================
//  설정 상수
// ============================================================

/** 출력 시트의 총 열 수 */
var TOTAL_COLS = 9;

/** 폼 응답 시트 데이터 행 높이 */
var FORM_ROW_HEIGHT = 50;

// ────────────────────────────────────────────────────────────
//  색상 테마 (order_form.html UI 색상과 동일 계열)
// ────────────────────────────────────────────────────────────
var COLOR = {
  TITLE_BG:           '#1e40af',  TITLE_FG:           'white',
  ORDERER_HEADER_BG:  '#0891b2',  ORDERER_HEADER_FG:  'white',  ORDERER_LABEL_BG:  '#cffafe',
  PRODUCT_HEADER_BG:  '#16a34a',  PRODUCT_HEADER_FG:  'white',  PRODUCT_COL_BG:    '#dcfce7',  PRODUCT_TOTAL_BG:  '#bbf7d0',
  SECTION_BG:         '#059669',  SECTION_FG:         'white',
  SENDER_HEADER_BG:   '#ea580c',  SENDER_HEADER_FG:   'white',  SENDER_LABEL_BG:   '#ffedd5',
  RECEIVER_HEADER_BG: '#9333ea',  RECEIVER_HEADER_FG: 'white',  RECEIVER_LABEL_BG: '#f3e8ff',
  DELIVERY_HEADER_BG: '#0d9488',  DELIVERY_HEADER_FG: 'white',  DELIVERY_COL_BG:   '#ccfbf1',  DELIVERY_TOTAL_BG: '#99f6e4',
  GRAND_HEADER_BG:    '#1e40af',  GRAND_HEADER_FG:    'white',  GRAND_LABEL_BG:    '#dbeafe',   GRAND_VALUE_BG:    '#eff6ff',
  TIMESTAMP_BG:       '#f1f5f9',
  BORDER_COLOR:       '#cbd5e1'
};


// ============================================================
//  1. 트리거 및 메뉴
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('주문서 관리')
    .addItem('최신 주문 파싱', 'parseNewSubmission')
    .addItem('모든 주문 파싱', 'parseAllSubmissions')
    .addSeparator()
    .addItem('열 구조 진단', 'diagnoseColumns')
    .addItem('생성된 주문 시트 전체 삭제', 'deleteAllOrderSheets')
    .addToUi();
}

function onFormSubmit(e) {
  try {
    parseNewSubmission();
  } catch (error) {
    Logger.log('onFormSubmit 오류: ' + error);
  }
  // 폼 제출 시 WRAP이 재적용되므로, 파싱 성공/실패와 무관하게 항상 행 높이 재설정
  try {
    var formSheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    shrinkFormSheetRows(formSheet);
  } catch (err) {
    Logger.log('행 높이 설정 오류: ' + err);
  }
}


// ============================================================
//  2. 열 구조 자동 감지
// ============================================================

/**
 * 폼 응답 시트의 특정 행에서 각 데이터가 어느 열에 있는지 자동 감지
 *
 * 전략:
 *  1) A열(1열)은 항상 Google Forms 타임스탬프
 *  2) B열~마지막열을 순회하며 셀 값이 JSON(`{`로 시작)인 열을 찾음
 *  3) JSON이 아닌 나머지 열에서 주문일시/성명/전화번호를 추출
 *
 * @param {Sheet} formSheet - 폼 응답 시트
 * @param {number} row - 데이터 행 번호
 * @returns {Object|null} - { timestamp, orderDateTime, formName, formPhone, jsonData } 또는 null
 */
function detectAndReadRow(formSheet, row) {
  var lastCol = formSheet.getLastColumn();
  if (lastCol < 2) return null;

  // 전체 행 데이터를 한 번에 읽기 (API 호출 최소화)
  var rowData = formSheet.getRange(row, 1, 1, lastCol).getValues()[0];

  var timestamp = rowData[0]; // A열은 항상 타임스탬프
  var jsonCol = -1;
  var jsonData = null;

  // JSON 열 찾기: { 로 시작하는 문자열
  for (var c = 1; c < lastCol; c++) {
    var val = String(rowData[c]).trim();
    if (val.charAt(0) === '{') {
      jsonCol = c;
      jsonData = val;
      break;
    }
  }

  if (jsonCol === -1 || !jsonData) {
    Logger.log('행 ' + row + ': JSON 데이터를 찾을 수 없습니다. 열 수: ' + lastCol);
    Logger.log('행 ' + row + ': 각 열 데이터 미리보기:');
    for (var d = 0; d < lastCol; d++) {
      var preview = String(rowData[d]).substring(0, 80);
      Logger.log('  [' + (d + 1) + '열] ' + preview);
    }
    return null;
  }

  // JSON 열을 제외한 나머지 열에서 주문일시/성명/전화번호 추출
  var otherValues = [];
  for (var c2 = 1; c2 < lastCol; c2++) {
    if (c2 !== jsonCol) {
      otherValues.push(rowData[c2]);
    }
  }

  // otherValues에서 주문일시/성명/전화번호 구분
  var orderDateTime = '';
  var formName = '';
  var formPhone = '';

  for (var k = 0; k < otherValues.length; k++) {
    var v = String(otherValues[k]).trim();
    if (!v) continue;

    // 전화번호 패턴: 010-xxxx-xxxx 또는 숫자만
    if (/^[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}$/.test(v) || /^01[0-9]{8,9}$/.test(v)) {
      formPhone = v;
    }
    // 날짜/시간 패턴: 2026-02-11 또는 2026.02.11 등
    else if (/^20\d{2}[\-\.\/]/.test(v) || otherValues[k] instanceof Date) {
      orderDateTime = otherValues[k]; // 원본 값 유지 (Date 객체일 수 있음)
    }
    // 나머지는 성명으로 추정
    else if (!formName) {
      formName = v;
    }
  }

  return {
    timestamp: timestamp,
    orderDateTime: orderDateTime,
    formName: formName,
    formPhone: formPhone,
    jsonData: jsonData
  };
}


/**
 * 열 구조 진단 함수 (디버깅용 - 메뉴에서 실행)
 */
function diagnoseColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var formSheet = ss.getSheets()[0];
  var lastRow = formSheet.getLastRow();
  var lastCol = formSheet.getLastColumn();

  if (lastRow < 1) {
    SpreadsheetApp.getUi().alert('시트에 데이터가 없습니다.');
    return;
  }

  var msg = '폼 응답 시트 진단 결과\n\n';
  msg += '총 열 수: ' + lastCol + '열\n';
  msg += '총 행 수: ' + lastRow + '행 (헤더 포함)\n\n';

  // 헤더 행 (1행) 읽기
  if (lastCol > 0) {
    var headers = formSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    msg += '── 헤더 (1행) ──\n';
    for (var h = 0; h < headers.length; h++) {
      msg += '  [' + String.fromCharCode(65 + h) + '열] ' + headers[h] + '\n';
    }
  }

  // 데이터 행 (2행) 미리보기
  if (lastRow >= 2) {
    var data = formSheet.getRange(2, 1, 1, lastCol).getValues()[0];
    msg += '\n── 데이터 미리보기 (2행) ──\n';
    for (var d = 0; d < data.length; d++) {
      var preview = String(data[d]).substring(0, 60);
      var isJson = String(data[d]).trim().charAt(0) === '{';
      msg += '  [' + String.fromCharCode(65 + d) + '열] ' + preview + (isJson ? ' <-- JSON' : '') + '\n';
    }

    // 자동 감지 테스트
    var detected = detectAndReadRow(formSheet, 2);
    if (detected) {
      msg += '\n── 자동 감지 결과 ──\n';
      msg += '  타임스탬프: ' + detected.timestamp + '\n';
      msg += '  주문 일시: ' + detected.orderDateTime + '\n';
      msg += '  성명: ' + detected.formName + '\n';
      msg += '  전화번호: ' + detected.formPhone + '\n';
      msg += '  JSON 길이: ' + detected.jsonData.length + '자\n';
      msg += '  JSON 시작: ' + detected.jsonData.substring(0, 50) + '...\n';
    } else {
      msg += '\n[실패] 자동 감지 실패! JSON 데이터를 찾을 수 없습니다.\n';
    }
  }

  SpreadsheetApp.getUi().alert(msg);
}


// ============================================================
//  3. 파싱 함수 (단건 / 전체)
// ============================================================

function parseNewSubmission() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var formSheet = ss.getSheets()[0];
  var lastRow = formSheet.getLastRow();

  if (lastRow < 2) {
    Logger.log('제출된 데이터가 없습니다.');
    return;
  }

  var result = processRow(ss, formSheet, lastRow);
  if (result.status === 'success') {
    Logger.log('주문서 파싱 완료: ' + result.sheetName);
  } else {
    Logger.log('파싱 결과: ' + result.status + ' - ' + (result.message || ''));
  }

  // 폼 응답 시트 전체 데이터 행 높이를 축소
  shrinkFormSheetRows(formSheet);
}

function parseAllSubmissions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var formSheet = ss.getSheets()[0];
  var lastRow = formSheet.getLastRow();

  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('파싱할 데이터가 없습니다.');
    return;
  }

  var successCount = 0;
  var skipCount = 0;
  var errorCount = 0;
  var errorMessages = [];

  for (var row = 2; row <= lastRow; row++) {
    var result = processRow(ss, formSheet, row);
    if (result.status === 'success') {
      successCount++;
    } else if (result.status === 'skip') {
      skipCount++;
    } else {
      errorCount++;
      errorMessages.push('행 ' + row + ': ' + (result.message || '알 수 없는 오류'));
    }
  }

  var msg = '파싱 완료!\n' +
    '성공: ' + successCount + '건\n' +
    '건너뜀(이미 처리): ' + skipCount + '건\n' +
    '실패: ' + errorCount + '건';

  if (errorMessages.length > 0) {
    msg += '\n\n── 오류 상세 ──\n' + errorMessages.join('\n');
  }

  // 폼 응답 시트 전체 데이터 행 높이를 축소
  shrinkFormSheetRows(formSheet);

  SpreadsheetApp.getUi().alert(msg);
}

function deleteAllOrderSheets() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    '주의',
    '폼 응답 시트(첫 번째 시트)와 상품목록 시트를 제외한\n생성된 주문 시트를 모두 삭제합니다.\n계속하시겠습니까?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var deleteCount = 0;

  // 보호할 시트 이름 목록 (첫 번째 시트 + 상품목록)
  var firstSheetName = sheets[0].getName();

  for (var i = sheets.length - 1; i >= 0; i--) {
    var name = sheets[i].getName();
    // 첫 번째 시트(폼 응답)와 '상품목록' 시트는 보호
    if (name === firstSheetName || name === '상품목록') continue;
    ss.deleteSheet(sheets[i]);
    deleteCount++;
  }

  ui.alert(deleteCount + '개 시트를 삭제했습니다.');
}


// ============================================================
//  4. 행 처리 (핵심 로직)
// ============================================================

/**
 * 폼 응답 시트의 특정 행을 파싱하여 주문서 시트 생성
 */
function processRow(ss, formSheet, row) {
  try {
    // 자동 감지로 데이터 읽기
    var rowInfo = detectAndReadRow(formSheet, row);
    if (!rowInfo) {
      return { status: 'error', message: 'JSON 데이터 열을 찾을 수 없음' };
    }

    // JSON 파싱
    var orderData;
    try {
      orderData = JSON.parse(rowInfo.jsonData);
    } catch (e) {
      Logger.log('행 ' + row + ': JSON 파싱 오류 - ' + e);
      Logger.log('행 ' + row + ': JSON 시작 부분 - ' + rowInfo.jsonData.substring(0, 200));
      return { status: 'error', message: 'JSON 파싱 오류: ' + e.message };
    }

    // 시트 이름 생성
    var ordererName = safeGet(orderData, '주문자정보', '성명') || rowInfo.formName || '미확인';
    var rawPhone = safeGet(orderData, '주문자정보', '전화번호') || rowInfo.formPhone || '';
    var phoneLast4 = String(rawPhone).replace(/[^0-9]/g, '').slice(-4);
    var label = ordererName + (phoneLast4 ? '(' + phoneLast4 + ')' : '');

    var ts = rowInfo.timestamp;
    var dateStr;
    try {
      dateStr = Utilities.formatDate(new Date(ts), 'GMT+9', 'yyyyMMdd_HHmmss');
    } catch (e) {
      dateStr = Utilities.formatDate(new Date(), 'GMT+9', 'yyyyMMdd_HHmmss');
    }
    var sheetName = row + '_' + label + '_주문_' + dateStr;

    // 시트 이름 길이 제한 (Google Sheets 최대 100자)
    if (sheetName.length > 100) {
      sheetName = sheetName.substring(0, 100);
    }

    // 이미 처리된 시트인지 확인
    if (ss.getSheetByName(sheetName)) {
      return { status: 'skip', sheetName: sheetName };
    }

    // 시트 생성 ('상품목록' 시트 바로 뒤에 삽입)
    var allSheets = ss.getSheets();
    var insertIndex = allSheets.length; // 기본: 맨 끝
    var productSheet = ss.getSheetByName('상품목록');
    if (productSheet) {
      insertIndex = productSheet.getIndex();
    }
    var orderSheet = ss.insertSheet(sheetName, insertIndex);
    createOrderSheet(orderSheet, rowInfo.timestamp, rowInfo.orderDateTime, orderData);

    Logger.log('행 ' + row + ': 파싱 완료 - ' + sheetName);
    return { status: 'success', sheetName: sheetName };

  } catch (error) {
    Logger.log('행 ' + row + ': 오류 발생 - ' + error);
    Logger.log('행 ' + row + ': 스택 - ' + error.stack);
    return { status: 'error', message: String(error) };
  }
}


// ============================================================
//  5. 주문서 시트 생성 (메인 레이아웃)
// ============================================================

function createOrderSheet(sheet, timestamp, orderDateTime, data) {
  sheet.clear();
  var r = 1;

  r = writeTitle(sheet, r);
  r = writeTimestamps(sheet, r, timestamp, orderDateTime);
  r = writeOrdererSection(sheet, r, data['주문자정보'] || {});
  r = writeProductSection(sheet, r, data['상품목록'] || []);

  var sections = data['주문목록'] || [];
  for (var i = 0; i < sections.length; i++) {
    r = writeDeliverySection(sheet, r, sections[i], i + 1);
  }

  r = writeGrandTotal(sheet, r, data['전체합계'] || {}, sections.length, data['상품목록'] || []);
  finalizeSheet(sheet, r - 1);
}


// ============================================================
//  6. 각 섹션 작성 함수
// ============================================================

// ── 타이틀 ──
function writeTitle(sheet, r) {
  mergeAndSet(sheet, r, 1, 1, TOTAL_COLS, '주 문 서');
  sheet.getRange(r, 1)
    .setFontSize(18).setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground(COLOR.TITLE_BG).setFontColor(COLOR.TITLE_FG);
  return r + 2;
}

// ── 타임스탬프 ──
function writeTimestamps(sheet, r, timestamp, orderDateTime) {
  sheet.getRange(r, 1).setValue('제출 시각').setFontWeight('bold').setBackground(COLOR.TIMESTAMP_BG);
  sheet.getRange(r, 2, 1, 3).merge();
  sheet.getRange(r, 2).setValue(timestamp);
  r++;

  if (orderDateTime) {
    sheet.getRange(r, 1).setValue('주문 일시').setFontWeight('bold').setBackground(COLOR.TIMESTAMP_BG);
    sheet.getRange(r, 2, 1, 3).merge();
    sheet.getRange(r, 2).setValue(orderDateTime);
    r++;
  }

  return r + 1;
}

// ── 주문자 정보 ──
function writeOrdererSection(sheet, r, info) {
  mergeAndSet(sheet, r, 1, 1, TOTAL_COLS, '주문자 정보');
  sheet.getRange(r, 1)
    .setFontWeight('bold').setHorizontalAlignment('center')
    .setBackground(COLOR.ORDERER_HEADER_BG).setFontColor(COLOR.ORDERER_HEADER_FG);
  r++;
  r = writePersonInfo(sheet, r, info, COLOR.ORDERER_LABEL_BG);
  return r + 1;
}

// ── 상품 정보 ──
function writeProductSection(sheet, r, products) {
  if (!products || products.length === 0) return r;

  mergeAndSet(sheet, r, 1, 1, TOTAL_COLS, '상품 정보');
  sheet.getRange(r, 1)
    .setFontWeight('bold').setHorizontalAlignment('center')
    .setBackground(COLOR.PRODUCT_HEADER_BG).setFontColor(COLOR.PRODUCT_HEADER_FG);
  r++;

  // 헤더 행
  var headers = ['No.', '상품코드', '상품이름', '행사', '수량', '단가', '금액', '바코드'];
  for (var i = 0; i < headers.length; i++) {
    sheet.getRange(r, i + 1)
      .setValue(headers[i]).setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground(COLOR.PRODUCT_COL_BG);
  }
  r++;

  var totalQty = 0;
  var totalAmt = 0;

  for (var p = 0; p < products.length; p++) {
    var prod = products[p];
    var qty = Number(prod['수량']) || 0;
    var unitPrice = Number(prod['단가']) || 0;
    var amount = Number(prod['금액']) || 0;
    var eventType = prod['행사'] || '없음';

    totalQty += qty;
    totalAmt += amount;

    var vals = [
      p + 1,
      prod['상품코드'] || '',
      prod['상품이름'] || '',
      eventType,
      qty,
      formatNumber(unitPrice),
      formatNumber(amount)
    ];
    for (var j = 0; j < vals.length; j++) {
      sheet.getRange(r, j + 1).setValue(vals[j]).setHorizontalAlignment('center');
    }

    // 행사 강조 (빨간색 볼드)
    if (eventType !== '없음' && eventType !== '') {
      sheet.getRange(r, 4).setFontColor('#dc2626').setFontWeight('bold');
    }

    // 바코드 이미지: 상품목록 시트에서 VLOOKUP
    var code = String(prod['상품코드'] || '').trim();
    if (code) {
      sheet.getRange(r, 8)
        .setFormula('=IFERROR(VLOOKUP("' + code + '",상품목록!B:C,2,FALSE),"")')
        .setHorizontalAlignment('center');
    }

    // 바코드 이미지 표시를 위한 행 높이
    sheet.setRowHeight(r, 100);
    r++;
  }

  // 합계 행
  mergeAndSet(sheet, r, 1, 1, 3, '합계');
  sheet.getRange(r, 1).setFontWeight('bold').setHorizontalAlignment('center').setBackground(COLOR.PRODUCT_TOTAL_BG);
  sheet.getRange(r, 4).setValue('').setBackground(COLOR.PRODUCT_TOTAL_BG);
  sheet.getRange(r, 5).setValue(totalQty).setFontWeight('bold').setHorizontalAlignment('center').setBackground(COLOR.PRODUCT_TOTAL_BG);
  sheet.getRange(r, 6).setValue('총 금액').setFontWeight('bold').setHorizontalAlignment('right').setBackground(COLOR.PRODUCT_TOTAL_BG);
  sheet.getRange(r, 7).setValue(formatNumber(totalAmt) + ' 원').setFontWeight('bold').setHorizontalAlignment('center').setBackground(COLOR.PRODUCT_TOTAL_BG);
  sheet.getRange(r, 8).setValue('').setBackground(COLOR.PRODUCT_TOTAL_BG);

  return r + 2;
}

// ── 배송 섹션 (보내는 분 + 받는 분 + 배송 상품) ──
function writeDeliverySection(sheet, r, section, sectionNum) {
  // 배송 섹션 헤더
  mergeAndSet(sheet, r, 1, 1, TOTAL_COLS, '━━━━━  배송 #' + sectionNum + '  ━━━━━');
  sheet.getRange(r, 1)
    .setFontSize(11).setFontWeight('bold').setHorizontalAlignment('center')
    .setBackground(COLOR.SECTION_BG).setFontColor(COLOR.SECTION_FG);
  r++;

  // 보내는 분
  mergeAndSet(sheet, r, 1, 1, TOTAL_COLS, '보내는 분');
  sheet.getRange(r, 1).setFontWeight('bold').setBackground(COLOR.SENDER_HEADER_BG).setFontColor(COLOR.SENDER_HEADER_FG);
  r++;
  r = writePersonInfo(sheet, r, section['보내는분'] || {}, COLOR.SENDER_LABEL_BG);
  r++;

  // 받는 분
  mergeAndSet(sheet, r, 1, 1, TOTAL_COLS, '받는 분');
  sheet.getRange(r, 1).setFontWeight('bold').setBackground(COLOR.RECEIVER_HEADER_BG).setFontColor(COLOR.RECEIVER_HEADER_FG);
  r++;
  r = writePersonInfo(sheet, r, section['받는분'] || {}, COLOR.RECEIVER_LABEL_BG);
  r++;

  // 배송 상품
  var deliveryProducts = section['배송상품목록'] || [];
  if (deliveryProducts.length > 0) {
    mergeAndSet(sheet, r, 1, 1, TOTAL_COLS, '배송 상품');
    sheet.getRange(r, 1).setFontWeight('bold').setBackground(COLOR.DELIVERY_HEADER_BG).setFontColor(COLOR.DELIVERY_HEADER_FG);
    r++;

    // 배송 상품 헤더
    var dHeaders = ['No.', '상품코드', '상품이름', '수량'];
    for (var h = 0; h < dHeaders.length; h++) {
      sheet.getRange(r, h + 1).setValue(dHeaders[h]).setFontWeight('bold')
        .setHorizontalAlignment('center').setBackground(COLOR.DELIVERY_COL_BG);
    }
    r++;

    var dTotalQty = 0;
    for (var d = 0; d < deliveryProducts.length; d++) {
      var dp = deliveryProducts[d];
      var dQty = Number(dp['수량']) || 0;
      dTotalQty += dQty;

      sheet.getRange(r, 1).setValue(d + 1).setHorizontalAlignment('center');
      sheet.getRange(r, 2).setValue(dp['상품코드'] || '').setHorizontalAlignment('center');
      sheet.getRange(r, 3).setValue(dp['상품이름'] || '').setHorizontalAlignment('center');
      sheet.getRange(r, 4).setValue(dQty).setHorizontalAlignment('center');
      r++;
    }

    // 배송 상품 소계
    mergeAndSet(sheet, r, 1, 1, 3, '소계');
    sheet.getRange(r, 1).setFontWeight('bold').setHorizontalAlignment('center').setBackground(COLOR.DELIVERY_TOTAL_BG);
    sheet.getRange(r, 4).setValue(dTotalQty).setFontWeight('bold').setHorizontalAlignment('center').setBackground(COLOR.DELIVERY_TOTAL_BG);
    r++;
  }

  return r + 1;
}

// ── 전체 합계 ──
function writeGrandTotal(sheet, r, grandTotal, sectionCount, products) {
  // 상품 목록에서 합계 직접 계산 (검증용)
  var calcQty = 0, calcAmt = 0;
  for (var i = 0; i < products.length; i++) {
    calcQty += Number(products[i]['수량']) || 0;
    calcAmt += Number(products[i]['금액']) || 0;
  }

  var finalSections = grandTotal['총주문건수'] || sectionCount;
  var finalQty = grandTotal['총수량'] || calcQty;
  var finalAmt = grandTotal['총금액'] || calcAmt;

  // 전체 합계 헤더
  mergeAndSet(sheet, r, 1, 1, TOTAL_COLS, '━━━━━  전체 합계  ━━━━━');
  sheet.getRange(r, 1).setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center')
    .setBackground(COLOR.GRAND_HEADER_BG).setFontColor(COLOR.GRAND_HEADER_FG);
  r++;

  // 라벨 행
  var labels = ['총 주문 건수', '총 수량', '총 금액'];
  var cols = [1, 4, 7];
  var spans = [3, 3, 3];

  for (var h = 0; h < labels.length; h++) {
    mergeAndSet(sheet, r, cols[h], 1, spans[h], labels[h]);
    sheet.getRange(r, cols[h]).setFontWeight('bold').setHorizontalAlignment('center').setBackground(COLOR.GRAND_LABEL_BG);
  }
  r++;

  // 값 행
  var values = [finalSections + ' 건', finalQty + ' 개', formatNumber(finalAmt) + ' 원'];
  for (var v = 0; v < values.length; v++) {
    mergeAndSet(sheet, r, cols[v], 1, spans[v], values[v]);
    sheet.getRange(r, cols[v]).setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center').setBackground(COLOR.GRAND_VALUE_BG);
  }

  return r + 2;
}


// ============================================================
//  7. 공통 유틸리티 함수
// ============================================================

/**
 * 인적사항(성명/전화번호/우편번호/주소) 2행 작성
 */
function writePersonInfo(sheet, r, info, labelBg) {
  if (!info) info = {};

  // 1행: 성명 + 전화번호
  sheet.getRange(r, 1).setValue('성명').setFontWeight('bold').setBackground(labelBg);
  sheet.getRange(r, 2).setValue(info['성명'] || '');
  sheet.getRange(r, 3).setValue('전화번호').setFontWeight('bold').setBackground(labelBg);
  sheet.getRange(r, 4, 1, 6).merge();
  sheet.getRange(r, 4).setValue(info['전화번호'] || '');
  r++;

  // 2행: 우편번호 + 주소
  sheet.getRange(r, 1).setValue('우편번호').setFontWeight('bold').setBackground(labelBg);
  setPostalCell(sheet.getRange(r, 2), info['우편번호']);
  sheet.getRange(r, 3).setValue('주소').setFontWeight('bold').setBackground(labelBg);
  sheet.getRange(r, 4, 1, 6).merge();
  sheet.getRange(r, 4).setValue(getFullAddress(info));

  return r + 1;
}

/**
 * 기본주소 + 상세주소 결합
 */
function getFullAddress(info) {
  if (!info) return '';
  var base = String(info['기본주소'] || '').trim();
  var detail = String(info['상세주소'] || '').trim();
  if (base && detail) return base + ' ' + detail;
  return base || detail || '';
}

/**
 * 우편번호 셀 설정 (텍스트 형식, 5자리 패딩)
 */
function setPostalCell(range, postal) {
  if (!postal && postal !== 0) { range.setValue(''); return; }
  var str = String(postal).trim();
  while (str.length < 5) str = '0' + str;
  range.setNumberFormat('@');
  range.setValue(str);
}

/**
 * 셀 병합 후 값 설정
 */
function mergeAndSet(sheet, row, col, numRows, numCols, value) {
  if (numCols > 1 || numRows > 1) {
    sheet.getRange(row, col, numRows, numCols).merge();
  }
  sheet.getRange(row, col).setValue(value);
}

/**
 * 숫자를 천단위 쉼표 형식으로 변환
 */
function formatNumber(num) {
  num = Number(num) || 0;
  return num.toLocaleString('ko-KR');
}

/**
 * 중첩 객체에서 안전하게 값 추출
 * @param {Object} obj - 대상 객체
 * @param {...string} keys - 중첩 키들
 * @returns {*} - 찾은 값 또는 undefined
 */
function safeGet(obj) {
  var result = obj;
  for (var i = 1; i < arguments.length; i++) {
    if (result == null) return undefined;
    result = result[arguments[i]];
  }
  return result;
}

/**
 * 폼 응답 시트의 데이터 행 높이를 축소
 * Sheets API v4를 사용하여 행 높이를 강제 설정
 */
function shrinkFormSheetRows(formSheet) {
  var maxRow = formSheet.getMaxRows();
  if (maxRow < 2) return;
  var lastCol = formSheet.getMaxColumns();
  if (lastCol < 1) return;

  var dataRange = formSheet.getRange(2, 1, maxRow - 1, lastCol);

  // 줄바꿈을 CLIP으로 변경
  dataRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  // 변경사항 즉시 반영
  SpreadsheetApp.flush();

  // Sheets API v4로 행 높이 강제 설정
  try {
    var ssId = formSheet.getParent().getId();
    var sheetId = formSheet.getSheetId();

    var requests = [{
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: 'ROWS',
          startIndex: 1,       // 0-based -> 2행 = index 1
          endIndex: maxRow      // maxRow행까지 (exclusive)
        },
        properties: {
          pixelSize: FORM_ROW_HEIGHT
        },
        fields: 'pixelSize'
      }
    }];

    Sheets.Spreadsheets.batchUpdate({ requests: requests }, ssId);
  } catch (e) {
    // Sheets API가 활성화되지 않은 경우 기본 방식으로 폴백
    Logger.log('Sheets API 사용 불가 (서비스 활성화 필요) - 기본 방식으로 행 높이 설정: ' + e);
    for (var row = 2; row <= maxRow; row++) {
      formSheet.setRowHeight(row, FORM_ROW_HEIGHT);
    }
  }
}

/**
 * 시트 마무리 (열 너비 자동 조정, 테두리 설정)
 */
function finalizeSheet(sheet, lastRow) {
  // 열 크기 자동 조정
  for (var c = 1; c <= TOTAL_COLS; c++) {
    sheet.autoResizeColumn(c);
  }

  // 바코드 열은 고정 폭 지정
  sheet.setColumnWidth(8, 200);
  if (sheet.getColumnWidth(1) < 80) sheet.setColumnWidth(1, 80);

  // 테두리 설정
  if (lastRow > 0) {
    sheet.getRange(1, 1, lastRow, TOTAL_COLS)
      .setBorder(true, true, true, true, true, true, COLOR.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);
  }
}
