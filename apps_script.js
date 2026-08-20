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
 *    "시즌": "2026 추석",                                            // 바코드 그림 주소에 쓴다
 *    "주문자정보": { 성명, 전화번호, 우편번호, 기본주소, 상세주소 },
 *    "상품목록": [{ 상품코드, 상품이름, 행사, 수량, 단가, 금액 }],
 *    "배송불가": { 사유, 상품목록: [{ 상품코드, 상품이름, 지급수량 }] },   // 주류만. 없으면 키 자체가 없다
 *    "주문목록": [{                                                      // 전부 주류면 빈 배열
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
 *     (반드시 응답 시트를 연 상태에서. script.google.com 에서 새로 만들면
 *      시트에 붙지 않아 아무것도 동작하지 않는다)
 *  2. 이 코드를 전체 복사하여 붙여넣기
 *  3. 저장(Ctrl+S)
 *  4. 스프레드시트 탭으로 돌아가 새로고침(F5) → '주문서 관리' 메뉴 확인
 *     onOpen 은 시트를 열 때 저절로 실행된다. 편집기에서 손으로 실행하면
 *     붙어 있는 문서가 없어 "Cannot call SpreadsheetApp.getUi()" 가 난다.
 *     정상이니 그냥 새로고침하면 된다.
 *  5. (선택) 트리거 설정 → onFormSubmit → 양식 제출 시
 *  6. (선택) Sheets API 서비스 활성화 (행 높이 자동 조정용)
 *     - Apps Script 편집기 → 서비스(+) → Google Sheets API → 추가
 */

// ============================================================
//  설정 상수
// ============================================================

/** 출력 시트의 총 열 수 */
var TOTAL_COLS = 9;

/**
 * 바코드 이미지 주소 (주문서가 올라가 있는 GitHub Pages)
 *
 * 예전에는 '상품목록' 시트에 바코드 그림 601장을 붙여 두고 VLOOKUP 으로
 * 꺼내 썼다. 그 방식은 명절마다 사람이 그림을 전부 다시 붙여야 했고,
 * 붙이는 방법(셀 안 / 셀 위)이 조금만 달라도 조용히 빈칸이 됐다.
 *
 * 지금은 주문서와 같은 그림을 주소로 바로 가져온다. 시즌 갱신이
 * BarcodeImgs/ 를 다시 만들어 올리면 여기도 저절로 새 바코드가 된다.
 * 시트에 그림을 붙일 일이 없고, '상품목록' 시트도 필요 없다.
 *
 * ※ 시즌이 바뀌어도 주소가 같으면 구글이 옛 그림을 캐시해 둘 수 있다.
 *   그래서 주소 뒤에 시즌 이름을 붙여 시즌마다 다른 주소가 되게 한다.
 */
var BARCODE_BASE = 'https://muttul58-coder.github.io/GS25_Order/BarcodeImgs/';

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
  // '상품목록' 은 이제 쓰지 않는다 (바코드는 주소로 가져온다). 남아 있어도
  // 지우지는 않는다 - 지우는 것은 사람이 판단할 일이다.
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
  r = writeProductSection(sheet, r, data['상품목록'] || [], data['시즌'] || '');
  r = writeNoDeliverySection(sheet, r, data['배송불가'] || null);

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

// ── 배송 불가 (주류 · 매장 수령) ──
//
// 주류는 택배로 못 보내므로 주문서에서 배송 상품 배분에 넣지 않는다.
// 그 사실을 시트에 적지 않으면, 상품 정보에는 있는데 배송 상품 목록에는 없는
// 상품이 되어 빠뜨린 주문처럼 보인다. 주문이 전부 주류면 배송 섹션 자체가 없다.
function writeNoDeliverySection(sheet, r, noDelivery) {
  if (!noDelivery) return r;
  var products = noDelivery['상품목록'] || [];
  if (products.length === 0) return r;

  mergeAndSet(sheet, r, 1, 1, TOTAL_COLS, '🚫 배송 불가 — ' + (noDelivery['사유'] || '매장 수령'));
  sheet.getRange(r, 1)
    .setFontWeight('bold').setHorizontalAlignment('center')
    .setBackground('#dc2626').setFontColor('white');
  r++;

  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    mergeAndSet(sheet, r, 1, 1, TOTAL_COLS,
      (p['상품코드'] || '') + '  ' + (p['상품이름'] || '')
      + '  ·  ' + (Number(p['지급수량']) || 0) + '개');
    sheet.getRange(r, 1)
      .setHorizontalAlignment('center')
      .setBackground('#fef2f2').setFontColor('#7f1d1d');
    r++;
  }

  return r + 1;
}

/**
 * 상품코드에 해당하는 바코드 그림 주소
 *
 * 시즌 이름을 뒤에 붙이는 이유: 명절이 바뀌면 같은 상품코드가 다른 상품을
 * 가리키므로 그림도 달라진다. 주소가 같으면 구글이 캐시해 둔 옛 그림을
 * 계속 보여줄 수 있어, 시즌마다 주소가 달라지도록 만든다.
 * 시즌 이름이 없는 옛 주문은 캐시가 남아 있어도 어차피 옛 그림이 맞다.
 */
function barcodeUrl(code, season) {
  var url = BARCODE_BASE + encodeURIComponent(code) + '.jpg';
  if (season) {
    url += '?v=' + encodeURIComponent(season);
  }
  return url;
}


// ── 상품 정보 ──
function writeProductSection(sheet, r, products, season) {
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

    // 바코드 이미지: 주문서와 같은 그림을 주소로 가져온다 (BARCODE_BASE 설명 참고)
    var code = String(prod['상품코드'] || '').trim();
    if (code) {
      sheet.getRange(r, 8)
        .setFormula('=IFERROR(IMAGE("' + barcodeUrl(code, season) + '",1),"")')
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


// ============================================================
//  8. 주문 확인 화면 (웹 앱)
// ============================================================
//
// 구글 시트 탭을 뒤지지 않고 주문을 보기 위한 화면이다.
// 시트에는 주문 하나가 JSON 한 덩어리로 들어 있고(C열), 지금까지는 그것을
// 풀어 '주문 시트'를 한 장씩 만들어 왔다. 주문이 쌓일수록 탭이 늘어나
// 찾기가 어려워진다. 이 화면은 같은 JSON 을 목록과 상세로 보여 준다.
//
// ── 화면 이동을 하지 않는 이유 ────────────────────────────
// 구글은 웹 앱 화면을 **샌드박스 iframe** 안에 넣어 띄운다. 그래서 페이지
// 안에서 '?row=2' 같은 주소로 이동시키면 iframe 자신의 주소를 기준으로
// 풀려 엉뚱한 곳으로 가고, 화면이 텅 빈 채로 남는다. 웹 앱 전체 주소를
// ScriptApp.getService().getUrl() 로 얻어 붙이는 방법도 있지만, 그 값이
// 빈 문자열로 오는 경우가 있어 같은 증상이 조용히 되살아난다.
//
// 그래서 **이동을 아예 하지 않는다.** 목록은 한 번에 다 그려 두고,
// 검색은 브라우저 안에서 걸러내고, 상세는 google.script.run 으로 받아
// 같은 페이지에 끼워 넣는다. 주소를 만들 일이 없으니 틀릴 일도 없다.
//
// ── 배포 방법 (최초 1회) ──────────────────────────────────
//   Apps Script 편집기 → 배포 → 새 배포 → 유형 '웹 앱'
//     실행 계정      : 웹 앱에 액세스하는 사용자      ★ 중요
//     액세스 권한    : Google 계정이 있는 모든 사용자  ★ 중요
//   → 배포하면 주소가 나온다. 그 주소를 시즌설정.txt 의
//     '주문 확인 주소' 줄에 넣으면 관리자 홈에 버튼이 생긴다.
//
//   왜 이 조합인가: 스크립트가 **접속한 사람의 자격으로** 시트를 읽는다.
//   그래서 시트를 공유받지 못한 사람은 주소를 알아내 들어와도 아무것도
//   못 본다. 즉 시트의 공유 목록이 그대로 이 화면의 접근 권한이 된다.
//   ('실행 계정: 나' 로 두면 누구나 남의 주문을 다 보게 되므로 쓰지 말 것.
//    코드에서 이메일로 걸러내는 방법은 개인 지메일 계정에서 접속자
//    이메일이 빈 값으로 와서 믿을 수 없다.)
//
//   코드를 고친 뒤에는 '배포 관리 → 수정 → 버전: 새 버전' 으로 다시
//   배포해야 반영된다. 저장만 해서는 옛 화면이 그대로 뜬다.


function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('스프레드시트를 열지 못했습니다.');
    return viewerPage(renderOrderList(ss), '주문 확인');

  } catch (err) {
    // 시트를 공유받지 못한 사람이 들어오면 여기로 온다.
    // 구글이 던지는 영문 예외를 그대로 보여주면 고장난 것처럼 보인다.
    return viewerPage(
      '<div class="empty"><h2>주문을 볼 권한이 없습니다</h2>'
      + '<p>이 주문서의 응답 시트를 공유받은 구글 계정으로 로그인해야 합니다.</p>'
      + '<p class="sub">지금 로그인된 계정으로는 열 수 없습니다. '
      + '매장 담당자에게 시트 공유를 요청하세요.</p>'
      + '<p class="sub">(안내: ' + escapeHtml(String(err && err.message || err)) + ')</p></div>',
      '권한 없음');
  }
}


/**
 * 응답 시트에서 주문 한 건을 읽어 온다
 * @returns {Object|null} {row, timestamp, orderDateTime, name, phone, data}
 */
function readOrderRow(ss, row) {
  var sheet = ss.getSheets()[0];
  if (row < 2 || row > sheet.getLastRow()) return null;

  var values = sheet.getRange(row, 1, 1, 5).getValues()[0];
  var json = String(values[2] || '').trim();
  if (!json) return null;

  var data;
  try {
    data = JSON.parse(json);
  } catch (err) {
    return { row: row, timestamp: values[0], orderDateTime: values[1],
             name: values[3], phone: values[4], data: null, broken: String(err) };
  }
  return { row: row, timestamp: values[0], orderDateTime: values[1],
           name: values[3], phone: values[4], data: data };
}


/**
 * 클라이언트(google.script.run)가 부르는 상세 화면
 *
 * 접속한 사람 자격으로 실행되므로, 시트를 못 보는 사람은 여기서도
 * 예외가 나서 아무것도 얻지 못한다. 따로 막을 것이 없다.
 */
function getOrderDetailHtml(row) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('스프레드시트를 열지 못했습니다.');
  return renderOrderDetail(ss, Number(row));
}


/** 목록 — 한 번에 다 그린다. 검색은 브라우저가 이 안에서 걸러낸다. */
function renderOrderList(ss) {
  var sheet = ss.getSheets()[0];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return '<div class="empty"><h2>아직 주문이 없습니다</h2></div>';
  }

  var rows = [];
  for (var r = lastRow; r >= 2; r--) {     // 최근 주문이 위로
    var o = readOrderRow(ss, r);
    if (o) rows.push(o);
  }

  var html = ''
    + '<div class="search">'
    + '<input type="text" id="q" placeholder="성명 · 전화번호 · 상품코드 · 상품이름 · 받는 분"'
    + ' oninput="filterList()" autocomplete="off">'
    + '</div>'
    + '<p class="count"><span id="shown">' + rows.length + '</span>건</p>'
    + '<table class="list"><thead><tr>'
    + '<th>주문 일시</th><th>주문자</th><th>전화번호</th><th>상품</th>'
    + '<th class="num">금액</th><th>배송</th><th></th>'
    + '</tr></thead><tbody id="rows">';

  for (var i = 0; i < rows.length; i++) {
    var o = rows[i];
    var d = o.data || {};
    var products = d['상품목록'] || [];
    var sections = d['주문목록'] || [];
    var totals = d['전체합계'] || {};

    var first = products.length ? String(products[0]['상품이름'] || '') : '';
    var label = first + (products.length > 1 ? ' 외 ' + (products.length - 1) + '건' : '');

    html += '<tr data-find="' + escapeHtml(searchKey(o)) + '">'
      + '<td class="when">' + escapeHtml(String(o.orderDateTime || o.timestamp || '')) + '</td>'
      + '<td class="who">' + escapeHtml(String(o.name || '')) + '</td>'
      + '<td>' + escapeHtml(String(o.phone || '')) + '</td>'
      + '<td class="what">' + escapeHtml(label)
      + (o.broken ? ' <span class="bad">읽기 실패</span>' : '') + '</td>'
      + '<td class="num">' + formatNumber(totals['총금액'] || 0) + '</td>'
      + '<td>' + (sections.length ? sections.length + '곳' : '<span class="muted">없음</span>')
      + (d['배송불가'] ? ' <span class="tag-alcohol">매장수령</span>' : '') + '</td>'
      + '<td><button class="go" onclick="openOrder(' + o.row + ')">열기</button></td>'
      + '</tr>';
  }

  html += '</tbody></table>'
    + '<p class="none" id="none" style="display:none">찾는 주문이 없습니다.</p>';
  return html;
}


/** 검색에 쓸 글자들을 한 줄로 모은다 (성명·전화·상품·받는 분) */
function searchKey(o) {
  var d = o.data || {};
  var parts = [String(o.name || ''), String(o.phone || '')];

  var products = d['상품목록'] || [];
  for (var i = 0; i < products.length; i++) {
    parts.push(String(products[i]['상품코드'] || ''));
    parts.push(String(products[i]['상품이름'] || ''));
  }
  var sections = d['주문목록'] || [];
  for (var s = 0; s < sections.length; s++) {
    var recv = sections[s]['받는분'] || {};
    parts.push(String(recv['성명'] || ''));
    parts.push(String(recv['전화번호'] || ''));
  }
  return parts.join(' ').toLowerCase().replace(/\s+/g, ' ');
}


/** 상세 — 주문서와 같은 순서로 보여 준다 */
function renderOrderDetail(ss, row) {
  var o = readOrderRow(ss, row);
  if (!o) {
    return '<div class="empty"><h2>그런 주문이 없습니다</h2></div>';
  }
  if (!o.data) {
    return '<div class="empty"><h2>주문 데이터를 읽지 못했습니다</h2>'
      + '<p class="sub">' + escapeHtml(String(o.broken)) + '</p></div>';
  }

  var d = o.data;
  var season = d['시즌'] || '';
  var html = '<div class="detail-top">'
    + '<button class="back" onclick="closeOrder()">← 목록</button>'
    + '<div class="when">' + escapeHtml(String(o.orderDateTime || o.timestamp || ''))
    + (season ? ' <span class="season">' + escapeHtml(season) + '</span>' : '') + '</div>'
    + '<button class="print" onclick="window.print()">인쇄</button>'
    + '</div>';

  html += personBlock('주문 정보', d['주문자정보'] || {}, 'orderer');

  var products = d['상품목록'] || [];
  html += '<h3 class="sec product">상품 정보</h3>'
    + '<table class="grid"><thead><tr>'
    + '<th>상품코드</th><th>상품이름</th><th>행사</th><th class="num">수량</th>'
    + '<th class="num">지급수량</th><th class="num">단가</th><th class="num">금액</th><th>바코드</th>'
    + '</tr></thead><tbody>';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var code = String(p['상품코드'] || '').trim();
    var ev = p['행사'] || '없음';
    // loading="lazy" 를 쓰지 않는다. 인쇄할 때 아직 안 받은 그림은 빈칸으로
    // 찍히는데, 이 화면에는 인쇄 단추가 있고 한 주문의 바코드는 몇 장뿐이다.
    html += '<tr>'
      + '<td class="code">' + escapeHtml(code) + '</td>'
      + '<td>' + escapeHtml(String(p['상품이름'] || '')) + '</td>'
      + '<td' + (ev !== '없음' && ev !== '' ? ' class="event"' : '') + '>' + escapeHtml(ev) + '</td>'
      + '<td class="num">' + (p['수량'] || 0) + '</td>'
      + '<td class="num">' + (p['지급수량'] || '') + '</td>'
      + '<td class="num">' + formatNumber(p['단가'] || 0) + '</td>'
      + '<td class="num">' + formatNumber(p['금액'] || 0) + '</td>'
      + '<td class="bar">' + (code
          ? '<img src="' + escapeHtml(barcodeUrl(code, season)) + '" alt="' + escapeHtml(code) + '">'
          : '') + '</td>'
      + '</tr>';
  }
  html += '</tbody></table>';

  var nd = d['배송불가'];
  if (nd && (nd['상품목록'] || []).length) {
    html += '<div class="nodelivery"><b>🚫 배송 불가 — ' + escapeHtml(String(nd['사유'] || '매장 수령')) + '</b><ul>';
    var list = nd['상품목록'];
    for (var n = 0; n < list.length; n++) {
      html += '<li>' + escapeHtml(String(list[n]['상품코드'] || '')) + ' '
        + escapeHtml(String(list[n]['상품이름'] || ''))
        + ' · ' + (list[n]['지급수량'] || 0) + '개</li>';
    }
    html += '</ul></div>';
  }

  var sections = d['주문목록'] || [];
  for (var s = 0; s < sections.length; s++) {
    var sec = sections[s];
    html += '<h3 class="sec ship">배송 정보 #' + (sec['주문번호'] || (s + 1))
      + (sec['배송희망일'] ? ' <small>배송 희망일 ' + escapeHtml(String(sec['배송희망일'])) + '</small>' : '')
      + '</h3>';
    html += personBlock('보내는 분', sec['보내는분'] || {}, 'sender');
    html += personBlock('받는 분', sec['받는분'] || {}, 'receiver');

    var dp = sec['배송상품목록'] || [];
    if (dp.length) {
      html += '<table class="grid small"><thead><tr><th>상품코드</th><th>상품이름</th><th class="num">수량</th></tr></thead><tbody>';
      for (var k = 0; k < dp.length; k++) {
        html += '<tr><td class="code">' + escapeHtml(String(dp[k]['상품코드'] || '')) + '</td>'
          + '<td>' + escapeHtml(String(dp[k]['상품이름'] || '')) + '</td>'
          + '<td class="num">' + (dp[k]['수량'] || 0) + '</td></tr>';
      }
      html += '</tbody></table>';
    }
  }

  var t = d['전체합계'] || {};
  html += '<div class="grand">'
    + '<span>총 주문 건수 <b>' + (t['총주문건수'] || 0) + '</b></span>'
    + '<span>총 수량 <b>' + (t['총수량'] || 0) + '</b></span>'
    + '<span>총 지급수량 <b>' + (t['총지급수량'] || 0) + '</b></span>'
    + '<span>총 금액 <b>' + formatNumber(t['총금액'] || 0) + ' 원</b></span>'
    + '</div>';

  return html;
}


/** 인적사항 한 덩어리 */
function personBlock(title, info, kind) {
  var addr = String(info['기본주소'] || '');
  if (info['상세주소']) addr += ' ' + info['상세주소'];
  return '<div class="person ' + kind + '">'
    + '<div class="p-title">' + escapeHtml(title) + '</div>'
    + '<div class="p-body">'
    + '<span class="nm">' + escapeHtml(String(info['성명'] || '')) + '</span>'
    + '<span class="ph">' + escapeHtml(String(info['전화번호'] || '')) + '</span>'
    + '<span class="ad">' + (info['우편번호'] ? '(' + escapeHtml(String(info['우편번호'])) + ') ' : '')
    + escapeHtml(addr) + '</span>'
    + '</div></div>';
}


/** HTML 에 넣을 때 남의 글이 태그로 해석되지 않게 한다 */
function escapeHtml(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


/** 공통 껍데기 (스타일 + 화면 전환 스크립트 포함) */
function viewerPage(body, title) {
  var html = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + escapeHtml(title) + '</title><style>' + VIEWER_CSS + '</style></head>'
    + '<body><div class="wrap">'
    + '<h1 id="head">주문 확인</h1>'
    + '<div id="list">' + body + '</div>'
    + '<div id="detail" style="display:none"></div>'
    + '<div id="loading" style="display:none">불러오는 중…</div>'
    + '</div><script>' + VIEWER_JS + '</' + 'script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}


// 화면 전환은 전부 브라우저 안에서 한다. 주소로 이동하지 않는다 (맨 위 설명 참고).
var VIEWER_JS = [
  'function $(id){return document.getElementById(id);}',
  'function filterList(){',
  '  var q=$("q").value.trim().toLowerCase();',
  '  var rows=$("rows").getElementsByTagName("tr"), n=0;',
  '  for(var i=0;i<rows.length;i++){',
  '    var hit = !q || rows[i].getAttribute("data-find").indexOf(q)!==-1;',
  '    rows[i].style.display = hit ? "" : "none";',
  '    if(hit) n++;',
  '  }',
  '  $("shown").textContent=n;',
  '  $("none").style.display = n ? "none" : "";',
  '}',
  'function openOrder(row){',
  '  $("list").style.display="none";',
  '  $("loading").style.display="";',
  '  google.script.run',
  '    .withSuccessHandler(function(html){',
  '      $("loading").style.display="none";',
  '      $("detail").innerHTML=html;',
  '      $("detail").style.display="";',
  '      window.scrollTo(0,0);',
  '    })',
  // 조용히 실패하면 "아무것도 안 나온다" 가 된다. 무슨 일인지 반드시 보여 준다.
  '    .withFailureHandler(function(err){',
  '      $("loading").style.display="none";',
  '      $("detail").innerHTML=\'<div class="empty"><h2>주문을 불러오지 못했습니다</h2>\'',
  '        +\'<p class="sub">\'+String(err && err.message ? err.message : err)+\'</p>\'',
  '        +\'<p><button class="back" onclick="closeOrder()">← 목록</button></p></div>\';',
  '      $("detail").style.display="";',
  '    })',
  '    .getOrderDetailHtml(row);',
  '}',
  'function closeOrder(){',
  '  $("detail").style.display="none";',
  '  $("detail").innerHTML="";',
  '  $("list").style.display="";',
  '}'
].join('\n');


var VIEWER_CSS = [
  ':root{--ink:#0f172a;--soft:#475569;--mute:#94a3b8;--line:#e2e8f0;--bg:#f8fafc;',
  '--orderer:#0891b2;--sender:#ea580c;--receiver:#9333ea;--product:#16a34a;--stop:#dc2626;}',
  '*{box-sizing:border-box;}',
  'body{margin:0;padding:18px;background:var(--bg);color:var(--ink);',
  'font-family:-apple-system,"Malgun Gothic","맑은 고딕",sans-serif;font-size:14px;line-height:1.5;}',
  '.wrap{max-width:1000px;margin:0 auto;}',
  'h1{font-size:20px;margin:0 0 14px;}',
  '.search{margin-bottom:10px;}',
  '.search input{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:8px;font-size:14px;}',
  '.count{color:var(--soft);font-size:13px;margin:0 0 8px;}',
  '.none{padding:24px;text-align:center;color:var(--soft);background:#fff;border-radius:10px;}',
  '#loading{padding:24px;text-align:center;color:var(--soft);}',
  'table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;}',
  'th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle;}',
  'th{background:#f1f5f9;font-size:12px;color:var(--soft);white-space:nowrap;}',
  '.num{text-align:right;white-space:nowrap;}',
  '.list .when{white-space:nowrap;color:var(--soft);font-size:13px;}',
  '.list .who{font-weight:700;}',
  '.list .what{color:var(--soft);}',
  '.muted{color:var(--mute);}',
  '.bad{color:var(--stop);font-weight:700;}',
  '.tag-alcohol{display:inline-block;padding:0 6px;border-radius:4px;background:#fee2e2;',
  'color:#b91c1c;font-size:11px;font-weight:700;}',
  '.go{padding:5px 13px;border:0;border-radius:6px;background:#2563eb;color:#fff;',
  'font-size:13px;font-weight:700;cursor:pointer;}',
  '.empty{background:#fff;border-radius:10px;padding:32px;text-align:center;}',
  '.empty h2{margin:0 0 8px;font-size:17px;}',
  '.empty .sub{color:var(--soft);font-size:13px;word-break:break-all;}',
  '.detail-top{display:flex;align-items:center;gap:12px;margin-bottom:12px;}',
  '.detail-top .when{flex:1;color:var(--soft);font-size:13px;}',
  '.detail-top .season{background:#e0f2fe;color:#0369a1;padding:1px 7px;border-radius:5px;font-size:12px;}',
  '.back,.print{padding:6px 14px;border:1px solid var(--line);border-radius:8px;background:#fff;',
  'cursor:pointer;font-size:13px;font-weight:700;}',
  '.sec{margin:18px 0 6px;padding:6px 10px;border-radius:6px;color:#fff;font-size:14px;}',
  '.sec small{font-weight:400;opacity:.9;}',
  '.sec.product{background:var(--product);}',
  '.sec.ship{background:#0d9488;}',
  '.person{display:flex;background:#fff;border-radius:8px;margin-bottom:6px;overflow:hidden;}',
  '.p-title{width:88px;flex:none;padding:9px;color:#fff;font-weight:700;font-size:12px;',
  'display:flex;align-items:center;justify-content:center;text-align:center;}',
  '.person.orderer .p-title{background:var(--orderer);}',
  '.person.sender .p-title{background:var(--sender);}',
  '.person.receiver .p-title{background:var(--receiver);}',
  '.p-body{flex:1;padding:9px 12px;display:flex;flex-wrap:wrap;gap:4px 16px;align-items:baseline;}',
  '.p-body .nm{font-weight:700;}',
  '.p-body .ph{color:var(--soft);}',
  '.p-body .ad{flex-basis:100%;color:var(--soft);font-size:13px;}',
  '.grid .code{font-family:monospace;font-weight:700;}',
  '.grid .event{color:var(--stop);font-weight:700;}',
  // 바코드는 눈으로 읽고 스캐너로도 찍는 것이라 작으면 쓸모가 없다.
  // 원본이 600x484 라 높이만 정하면 가로는 알아서 따라온다.
  '.grid .bar img{height:110px;width:auto;display:block;}',
  '.grid.small{margin-bottom:6px;}',
  '.nodelivery{margin:10px 0;padding:11px 14px;background:#fef2f2;border:2px solid #fca5a5;',
  'border-left:6px solid var(--stop);border-radius:8px;color:#7f1d1d;}',
  '.nodelivery ul{margin:6px 0 0;padding-left:18px;}',
  '.grand{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:14px;padding:12px 14px;',
  'background:#eff6ff;border-radius:8px;}',
  '.grand b{font-size:15px;}',
  '@media print{body{background:#fff;padding:0;}.detail-top .print,.back,#head{display:none;}}',
  '@media (max-width:640px){',
  'body{padding:10px;}',
  '.list th:nth-child(3),.list td:nth-child(3),.list th:nth-child(5),.list td:nth-child(5){display:none;}',
  '.grid .bar{display:none;}',
  '}'
].join('');
