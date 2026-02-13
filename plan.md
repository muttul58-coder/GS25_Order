# PDF 저장 기능 재구현 계획

## 문제점
- 현재 `html2pdf.js` (html2canvas 기반)는 **화면 캡처** 방식
- 바코드 이미지 tainted canvas 에러 발생
- 모바일에서 화면 일부만 캡처됨
- 인쇄 화면(`@media print`)과 결과가 다름

## 해결 방안: `window.print()` + 숨겨진 iframe 방식

브라우저의 기본 인쇄 엔진을 활용하되, **숨겨진 iframe** 안에서 `window.print()`를 호출합니다.
이렇게 하면 `@media print` CSS가 그대로 적용되어 인쇄 화면과 100% 동일한 결과를 얻습니다.

사용자가 인쇄 대화상자에서 "PDF로 저장"(대상 선택)만 하면 됩니다.

### 핵심 차이
| | 인쇄 버튼 | PDF 저장 버튼 |
|---|---|---|
| 동작 | `window.print()` 직접 호출 | `window.print()` 호출 (동일) |
| 차이점 | 없음 (브라우저 인쇄 대화상자) | 없음 |

→ 사실상 동일한 동작이지만, **모바일 사용자를 위해 "PDF 저장" 라벨로 별도 버튼 제공**

## 구현 단계

### 1단계: `html2pdf.js` CDN 제거
- `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js">` 삭제

### 2단계: `savePDF()` 함수 완전 교체
- 기존 html2pdf.js 기반 코드 전부 삭제
- `window.print()` 호출로 단순 교체
- 모바일에서는 인쇄 대화상자의 "PDF로 저장" 옵션 안내 메시지 표시

### 3단계: 불필요한 함수 제거
- `applyPrintLayout()` 함수 제거 (beforeprint 이벤트가 이미 처리)
- `removePrintLayout()` 함수 제거 (afterprint 이벤트가 이미 처리)

### 4단계: PDF 버튼 스타일 유지
- `.pdf-btn` 스타일은 그대로 유지 (빨간색 버튼)
