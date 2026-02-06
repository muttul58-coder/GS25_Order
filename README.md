# 주문서 웹 페이지 주소 : 
https://muttul58-coder.github.io/GS25_Order/order_form.html

# 주문서 양식 - 구글 폼 연동 설정 가이드
## 📋 파일 구성

1. **order_form.html** - 주문서 양식 메인 파일
2. **config.js** - 구글 폼 설정 파일 (Entry ID 및 URL 관리)
3. **products.js** - 상품 데이터 파일 (별도 제공)

## ⚙️ 구글 폼 설정 방법

### 1단계: config.js 파일 편집

`config.js` 파일을 메모장이나 텍스트 편집기로 엽니다.

### 2단계: 구글 폼 URL 입력

```javascript
formUrl: "https://docs.google.com/forms/d/e/YOUR_FORM_ID/formResponse"
```

- 구글 폼에서 "미리 채우기 링크 가져오기"를 선택
- 생성된 URL에서 `/formResponse` 부분까지 복사
- `formUrl` 값에 붙여넣기

### 3단계: Entry ID 찾기

1. 구글 폼 편집 화면 → 우측 상단 ⋮ 클릭
2. "미리 채우기 링크 가져오기" 선택
3. 각 질문에 샘플 답변 입력
4. "링크 가져오기" 클릭
5. 생성된 URL에서 `entry.숫자` 부분을 찾습니다

예시 URL:
```
https://docs.google.com/forms/d/e/.../viewform?
  entry.1513670625=2025-01-15&
  entry.1154584229=홍길동&
  entry.1054209127=010-1234-5678&
  entry.941076937=주문데이터
```

### 4단계: Entry ID 입력

config.js 파일에 찾은 Entry ID를 입력합니다:

```javascript
entries: {
    dateTime: "entry.1513670625",    // 주문 일시
    name: "entry.1154584229",         // 성명
    phone: "entry.1054209127",        // 전화번호
    orderData: "entry.941076937"      // 주문 데이터
}
```

### 5단계: 파일 저장 및 테스트

1. config.js 파일 저장
2. order_form.html 파일 열기
3. 설정 상태 확인 (녹색 체크: 정상, 빨간색: 오류)
4. 테스트 주문 입력 후 제출
5. 구글 폼 응답 확인

## ⚠️ 주의사항

- config.js, order_form.html, products.js 파일은 같은 폴더에 있어야 합니다
- Entry ID는 정확히 입력해야 합니다 (대소문자, 숫자 모두 정확히)
- config.js 파일을 수정한 후에는 페이지를 새로고침해야 합니다

## 🔒 보안 안내

- Entry ID는 민감한 정보가 아니므로 하드코딩해도 보안 문제가 없습니다
- config.js 파일은 설정 변경을 쉽게 하기 위한 것입니다
- 구글 폼 자체는 별도의 권한 설정으로 보호됩니다

## 📞 문제 해결

### 설정 상태가 빨간색으로 표시됨
→ config.js 파일이 같은 폴더에 있는지 확인
→ config.js 파일 내용이 올바른지 확인

### 제출 시 "Entry ID가 설정되지 않았습니다" 메시지
→ config.js에서 모든 Entry ID가 입력되었는지 확인
→ Entry ID 형식이 "entry.숫자" 형태인지 확인

### 구글 폼에 데이터가 전송되지 않음
→ formUrl이 `/formResponse`로 끝나는지 확인
→ Entry ID가 실제 구글 폼 필드와 일치하는지 확인
→ 브라우저 콘솔(F12)에서 오류 메시지 확인
