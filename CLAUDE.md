# CLAUDE.md — GS25 Order Form System

## Project Overview

GS25 convenience store parcel order management web application (Korean language). Handles multi-shipment order forms with product lookup, promotion calculation, barcode display, print optimization, and Google Forms submission.

**Live URL**: `https://muttul58-coder.github.io/GS25_Order/order_form.html`

## Tech Stack

- **Languages**: HTML5, CSS3, vanilla JavaScript (ES6+)
- **Frameworks**: None — pure static HTML/CSS/JS
- **Build system**: None — no npm, no bundler, no transpilation
- **Package manager**: None
- **Testing**: None — manual browser testing only
- **Deployment**: GitHub Pages (static files served as-is)

### External Dependencies (CDN)

| Dependency | Purpose |
|---|---|
| Daum Postcode API | Korean address/postcode lookup |
| html2canvas v1.4.1 | Image capture for "이미지 저장" feature |

### Local Data Modules (loaded via `<script src>`)

| File | Purpose |
|---|---|
| `products.js` | Product database — exports globals `PRODUCTS_DATA` (601 items: name, price, 행사, 구성 설명) and `PROMO_CONFIG` (season name, promotion period dates, catalog addresses). Generated from `시즌설정.txt`. |
| `store.js` | Exports globals `STORE_INFO` (store name, manager, phone) rendered in the page header, and `SITE_LINKS` (currently just `responseSheet`, read only by `admin.html`). Generated from `시즌설정.txt`. |
| `config.js` | Google Forms endpoint URL and entry IDs — exports global `GOOGLE_FORM_CONFIG` |

## File Structure

```
GS25_Order/
├── order_form.html       # Main HTML (~330 lines, HTML only)
├── product_detail.html   # Barcode click target — product photo/구성/행사 popup
├── order_split.html      # 상품 찾기 panel (left) + order form in an iframe (right)
├── admin.html            # 관리자 홈 — current-state readout + every admin link (not linked from the order form)
├── css/
│   ├── main.css          # Screen styles: layout, forms, tables, buttons, alerts (~854 lines)
│   ├── print.css         # Print-only @media print styles for A4 (~476 lines)
│   └── responsive.css    # Mobile responsive breakpoints (~81 lines)
├── js/
│   ├── utils.js          # Global vars, alerts, formatting, phone auto-hyphen (~100 lines)
│   ├── address.js        # Daum Postcode API address search (~75 lines)
│   ├── alcohol.js        # 주류 배송 불가 판별 + 안내 (~230 lines)
│   ├── product.js        # Product CRUD, calculation, barcode (~480 lines)
│   ├── delivery.js       # Delivery product management, quantity validation (~250 lines)
│   ├── copy-sync.js      # Info copy/sync between orderer, sender, receiver (~230 lines)
│   ├── validation.js     # Input validation, sequential input guide (~260 lines)
│   ├── section.js        # Delivery section add/remove/renumber (~165 lines)
│   ├── print-image.js    # Print layout, image save (html2canvas) (~425 lines)
│   ├── submit.js         # Google Forms submission, config status (~245 lines)
│   └── init.js           # Page initialization (DOMContentLoaded) (~63 lines)
├── config.js             # Google Forms configuration (9 lines)
├── products.js           # Product database (601 products, GENERATED)
├── apps_script.js        # Google Apps Script for Sheets automation (not loaded by HTML)
├── BarcodeImgs/          # 601 barcode JPEGs, one per code (GENERATED, e.g. 08-01.jpg)
├── BarcodeSource/        # Season barcode-book PDFs (source for BarcodeImgs/)
├── tools/
│   ├── update_season.py  # Regenerates products.js + BarcodeImgs/ from a season PDF
│   └── season_prep.py    # Step 0: verify the two links, fetch banner + unknown icons, draft 시즌설정.txt
├── plan.md               # PDF implementation plan
├── README.md             # Korean documentation
└── LICENSE               # MIT
```

### Modular Architecture

Application code is split into **3 CSS files** and **10 JS files** loaded via `<link>` and `<script src>` tags in `order_form.html`. All JS functions are in **global scope** (no ES modules, no bundler). HTML body uses inline `onclick` attributes that call global functions.

## Architecture & Code Organization

### Entry Point

`order_form.html` → loads all CSS/JS → `DOMContentLoaded` event (in `init.js`) → `initializePage()`

### Script Loading Order (dependency-based)

```html
<!-- CSS -->
<link rel="stylesheet" href="css/main.css">
<link rel="stylesheet" href="css/admin-test.css">
<link rel="stylesheet" href="css/print.css">
<link rel="stylesheet" href="css/responsive.css">

<!-- External CDN -->
<script src="https://t1.daumcdn.net/.../postcode.v2.js"></script>
<script src="https://cdnjs.cloudflare.com/.../html2canvas.min.js"></script>

<!-- Data -->
<script src="products.js"></script>
<script src="config.js"></script>

<!-- App modules (order matters!) -->
<script src="js/utils.js"></script>          <!-- No dependencies -->
<script src="js/address.js"></script>        <!-- No dependencies -->
<script src="js/alcohol.js"></script>        <!-- No dependencies (reads PRODUCTS_DATA/CATEGORIES) -->
<script src="js/product.js"></script>        <!-- Depends on: utils, alcohol -->
<script src="js/delivery.js"></script>       <!-- Depends on: utils, product -->
<script src="js/copy-sync.js"></script>      <!-- Depends on: utils -->
<script src="js/validation.js"></script>     <!-- Depends on: utils, delivery -->
<script src="js/section.js"></script>        <!-- Depends on: utils, delivery, copy-sync, validation, product -->
<script src="js/print-image.js"></script>    <!-- Depends on: utils, product, validation, delivery -->
<script src="js/submit.js"></script>         <!-- Depends on: utils, validation -->
<script src="js/init.js"></script>           <!-- Depends on: all modules -->
```

### JS Module Details

| File | Key Functions | Description |
|---|---|---|
| `js/utils.js` | `showAlert()`, `formatNumberWithCommas()`, `parseFormattedNumber()`, `getTodayDate()`, `updateDateTime()`, `isMobileDevice()`, `formatPhoneNumber()`, `initPhoneFormatting()` | Global utilities, number formatting, phone auto-hyphen |
| `js/address.js` | `searchOrdererAddress()`, `searchSenderAddress()`, `searchReceiverAddress()` | Daum Postcode API integration |
| `js/alcohol.js` | `alcoholCategories()`, `isAlcoholInfo()`, `isAlcoholCode()`, `countAlcoholProducts()`, `scanOrderForAlcohol()`, `isAlcoholOnlyOrder()`, `markAlcoholRows()`, `updateAlcoholNotice()` | 주류 판별(분류 이름 기준) + 배송 불가 안내. `order_form.html` / `order_split.html` / `product_detail.html` / `admin.html` 네 화면이 모두 읽는다 |
| `js/product.js` | `resolveCodeDigits()`, `getProductInfo()`, `formatProductCode()`, `addProductRow()`, `calculateGivenQuantity()`, `getApplicableEvent()`, `applyCatalogEvent()`, `getRowGivenQuantity()`, `calculateRowTotal()`, `updateProductTotals()`, `updateBarcodeImages()`, `catalogSearchLink()`, `openCatalogPopup()` | Product code lookup, table row CRUD, promotion auto-select, given-quantity + total calculation, barcode display + detail popup |
| `js/delivery.js` | `refreshDeliveryProductSelects()`, `onDeliveryProductCodeChange()`, `addDeliveryProductRow()`, `removeDeliveryProductRow()`, `getDeliveryQuantityLimit()`, `clampDeliveryQuantity()`, `reconcileDeliveryQuantities()`, `validateDeliveryQuantities()` | Delivery product selection, quantity clamping/reconciliation, validation |
| `js/copy-sync.js` | `toggleOrdererInfoCopy()`, `toggleReceiverInfoCopy()`, `syncFromOrderer()`, `syncFromSender()`, `initCopySync()` | Auto-copy orderer info to sender/receiver with live sync |
| `js/validation.js` | `validateAllInputs()`, `checkOrdererInfoComplete()`, `checkSequentialInput()`, `attachSequentialInputGuide()` | Input validation, sequential input enforcement |
| `js/section.js` | `addSection()`, `removeSection()`, `renumberSections()` | Delivery section add/delete/reorder |
| `js/print-image.js` | `addPrintTitleColumn()`, `adjustAddressFontSize()`, `printOnly()`, `saveAsImage()`, `beforeprint`/`afterprint` handlers | A4 print layout with vertical title columns, image capture |
| `js/submit.js` | `submitOnly()`, `printOrder()`, `submitToGoogleForm()`, `collectOrderData()`, `checkConfigStatus()` | Google Forms submission, order data collection |
| `js/admin-test.js` | `getPromoDate()`, `getTestPromoDate()`, `setTestPromoDate()`, `describePromoPeriod()`, `refreshAllRowEvents()`, `renderTestBanner()`, `buildAdminPanel()`, `toggleAdminPanel()`, `initAdminTestMode()` | Admin preview of a different 행사 period (`?admin=1`, `?test=main`) |
| `js/init.js` | `initializePage()` | Page initialization: date/time, event listeners, postal filter |
| `js/catalog-panel.js` | `searchProducts()`, `runSearch()`, `buildCard()`, `addToOrder()`, `missingFieldOf()`, `openCatalog()`, `closeCatalog()` | `order_split.html` only: product search panel, 담기 into the order-form iframe |
| `js/admin-home.js` | `repoSlug()`, `siteUrl()`, `catalogSite()`, `countProducts()`, `renderStatus()`, `renderNow()`, `renderLinks()`, `loadLastUpdate()`, `copyLink()` | `admin.html` only: current-state readout, link assembly, 주소 복사 |

### CSS Module Details

| File | Content |
|---|---|
| `css/main.css` | Screen styles: reset, layout, forms, tables, buttons, alerts, section theming (orderer/sender/receiver colors), barcode grid, validation error states |
| `css/print.css` | `@media print` block: A4 optimization, vertical title columns, element hiding, page break rules |
| `css/responsive.css` | `@media (max-width: 768px)` and `@media (max-width: 480px)` breakpoints |
| `css/catalog-panel.css` | `order_split.html` only: two-column split, product cards, phone overlay below 900px |
| `css/admin-home.css` | `admin.html` only. Deliberately duplicates `docs/manual.html`'s color tokens so the two admin-facing screens match; rename tokens in one and fix the other. |
| `css/admin-test.css` | Test banner + admin panel. Loaded by **both** `order_form.html` and `order_split.html` — the split shell does not load `main.css`, so keeping these here is what stops the admin UI rendering unstyled there. |

### Data Flow

1. User fills form → `validateAllInputs()` checks all fields
2. `collectOrderData()` assembles structured JSON
3. `submitToGoogleForm()` POSTs via `fetch()` (no-cors mode) to Google Forms
4. `window.print()` opens browser print dialog
5. (Optional) `apps_script.js` on Google Sheets parses responses into formatted sheets

**주문 확인 화면 (`doGet()` in `apps_script.js`).** A web app served by Apps Script that
lists orders and renders one in the order-form layout, so the admin never has to hunt
through spreadsheet tabs. It reads the same `주문 데이터 (JSON)` column the per-order
sheets are built from, so there is no second source of truth.

Deployment must be **실행 계정 = 웹 앱에 액세스하는 사용자** + **액세스 = Google 계정이
있는 모든 사용자**. That combination makes the script read the sheet *as the visitor*, so
the sheet's own sharing list becomes the access list and someone who guesses the URL sees
nothing. Do not deploy it as 실행 계정 = 나 — that publishes every customer's name, phone
and address to anyone with the link. An email allowlist is not a substitute:
`Session.getActiveUser().getEmail()` returns `""` for consumer Gmail visitors when
executing as the owner, so the check would silently pass everyone. The unauthorized case
is caught in `doGet()` and rendered as a Korean explanation rather than Google's raw
exception. Everything the page prints goes through `escapeHtml()` — customer text and
catalog product names are other people's writing.

The web app URL lands in `SITE_LINKS.orderViewer` via `시즌설정.txt`'s `주문 확인 주소`,
the same path `응답 시트 주소` already takes. `admin.html` shows deployment instructions
in place of the button while it is empty, rather than hiding the row.

**Barcodes in the generated sheet come from GitHub Pages, not from the spreadsheet.**
`apps_script.js` writes `=IMAGE(BARCODE_BASE + <코드>.jpg?v=<시즌>)`. The older design
kept 601 pictures pasted into a `상품목록` sheet and pulled them with `VLOOKUP(…,B:C,2)`;
that required a human to re-paste every image each season, and silently produced blanks
when the images landed *over* the cells instead of *in* them — which is how it failed in
2026 추석 (688 stale pictures, none readable by `VLOOKUP`). Since `BarcodeImgs/` is
already regenerated by the season refresh and served publicly, the sheet should read the
same file the order form prints. `collectOrderData()` therefore sends `시즌`, and the
season is appended as a query string so a reused code cannot show Google's cached copy of
last season's barcode. Do not reintroduce a picture-holding sheet.

## Key Conventions

### Language

- All UI text, comments, variable names in user-facing strings, and documentation are in **Korean**
- Code identifiers (function names, variable names) are in English
- Commit messages are in Korean

### Code Patterns

- **Event handling**: Inline `onclick` attributes on HTML elements (both static and dynamically created)
- **DOM manipulation**: Direct `querySelector`/`querySelectorAll`
- **Error indication**: `.error` CSS class added to invalid inputs
- **User feedback**: Custom `showAlert(message, type)` function (in `utils.js`)
- **Number formatting**: Comma-separated display with `formatNumberWithCommas()` / `parseFormattedNumber()` for parsing
- **Async operations**: `async/await` with `fetch()` for Google Forms submission
- **Debug logging**: `console.log()` for product lookups and form submissions
- **Global scope**: All functions are global (no ES modules) — loaded via `<script src>` tags

### Product Code Format

- Standard format: `XX-YY` or `XXX-YY` (e.g., `08-01`, `106-09`)
- Auto-normalization: `8-1` → `08-01` via `formatProductCode()`
- Digits-only entry (`1005` → `10-05`) is resolved by `resolveCodeDigits()`, which
  picks the split that actually exists in `PRODUCTS_DATA` rather than guessing
  category width from a numeric range. Do not reintroduce range-based guessing:
  seasons have shipped both `10-05` and `100-05`, and only the catalog can
  disambiguate them.
- Category codes change every season — the current catalog (2026 추석) spans 08–94

### Promotion Semantics (수량 vs 지급수량)

The product table has two quantity columns and they mean different things:

- **수량** — what the customer pays for. User-entered.
- **지급수량** — what actually ships, bonus included. Read-only, computed by
  `calculateGivenQuantity()` as `quantity + floor(quantity / N) * M` for an
  `"N+M"` event. Most events are `N+1`, but the 2026 추석 catalog also ships
  `7+3`, `2+2` and `3+2` — do not assume the bonus is 1.

`금액` is always `수량 × 단가`. A promotion adds free goods; it does **not** discount
the price. (Before 2026-08 the form modelled this the other way round — 수량 meant
units received and the price was reduced — so old orders are not comparable.)

Delivery-product allocation validates against **지급수량**, not 수량, since that is
what leaves the warehouse. `getOrderProductList()` therefore returns given quantities,
and `clampDeliveryQuantity()` blocks entering more than the remaining given quantity.

**Auto-selection.** `applyCatalogEvent()` fills the 행사 dropdown from `products.js`
when a product code is looked up. The clerk can always override it — store-level
promotions do not always match the catalog.

**사전행사 vs 본행사.** The catalog carries two different rates per product and they
disagree for 118 of the 601 items. `getApplicableEvent()` returns `{event, period}`
by comparing today against `PROMO_CONFIG.preStart` / `.mainStart` (both generated into
`products.js`): nothing before 사전행사 opens, `eventPre` during it, `eventMain` from
본행사 on. Getting this wrong silently ships the wrong count, so the dates are data,
not constants in the JS. For 2026 추석 the periods come from the catalog site's own
banner — 08-17~09-04 사전행사 (127품목, matching the extracted count exactly), 09-05~ 본행사.

**Previewing another period.** `getApplicableEvent()` takes its date from
`getPromoDate()` (`js/admin-test.js`), not `getTodayDate()` — deliberately, so the
admin can see the 본행사 view before 09-05 without falsifying the 주문 일시 or
배송 희망일, which still read the real date. The override is off by default, needs
`?admin=1` / `?test=main`, lives in `sessionStorage` so it dies with the tab, and
paints a red banner that **also prints** (`.test-mode-banner` is deliberately not
`.no-print`) — a test printout must never pass for a real order form. Changing the
period must call `calculateRowTotal()` per row, not just `updateProductTotals()`:
the latter only sums, so 지급수량 would keep the old promotion's value.

**Test mode spans two documents in `order_split.html`** — the shell and the embedded
order form each run `admin-test.js` against one shared `sessionStorage`, so each draws
its own banner. Two rules keep them from disagreeing:

- `setTestPromoDate()` propagates **both** ways. Downward via `refreshAllRowEvents()` →
  `orderFrameWindow()`; upward via `shellWindow()`, which repaints the shell's banner and
  admin panel. Without the upward half, turning test mode off from inside the frame
  cleared the date and the frame's banner but left the shell's red band and its
  "테스트 중" label standing — the screen claimed a test was running when it was not,
  which is the exact failure the banner exists to prevent.
- The frame's banner is `display:none` on screen (`.test-mode-banner.framed`) because
  the shell already shows one; stacking two is just noise. It comes back **in print**,
  since the printed document is the iframe. Do not delete the framed banner instead of
  hiding it — then a test printout would look like a real order form.

`shellWindow()` tests `typeof parent.renderTestBanner === 'function'`, not merely that a
parent exists: that both proves same-origin access and means the outer document really
does paint a banner to defer to.

`PROMO_CONFIG.preNote` carries the 사전행사 condition (2026 추석: the bonus only applies
to 삼성/KB국민/비씨/신한 card payments) and is appended to the auto-select toast. Do not
drop it — a clerk who promises a bonus that the payment method does not qualify for
has to make it good.

### 주류 배송 불가 (`js/alcohol.js`)

주류는 택배로 보낼 수 없다 — 손님이 매장에서 직접 받아 가야 한다. 2026 추석
카탈로그에서는 601개 중 85개(양주/와인 62, 소주/전통주 23)가 여기 해당한다.

**판별은 카탈로그 분류의 *이름*으로 한다. 번호로 하지 않는다.** 분류 번호는
시즌마다 다시 매겨지므로 `cat === 10` 같은 상수를 코드에 적으면 다음 시즌에
조용히 엉뚱한 분류가 주류가 된다 — 그 순간 이 화면은 "배송되는 술"과 "배송 안 되는
통조림"을 만들어 낸다.

**정하는 곳은 시즌 갱신이다.** `tools/update_season.py` 의 `resolve_no_delivery()`
가 `NO_DELIVERY_WORDS` 로 분류 이름을 걸러 `PROMO_CONFIG.noDeliveryCats` /
`.noDeliveryLabels` 를 `products.js` 에 적고, `alcoholCategories()` 는 그 값을
읽기만 한다. 주문서가 스스로 이름을 맞춰 보는 경로(`ALCOHOL_LABEL_PATTERN`)는
**이 필드가 없는 옛 `products.js` 를 위한 대비책일 뿐**이다. 두 낱말 목록은 같아야
한다 — 한쪽만 고치면 갱신 전과 후가 서로 다른 말을 한다.

갱신은 **정하지 못하면 만들지 않고 멈춘다.** 분류 이름을 못 가져왔거나(스크랩
실패) 이름 중에 술로 보이는 것이 없으면, 이번 시즌 분류 목록을 전부 찍어 주고
`시즌설정.txt` 에 `배송불가 분류:` 한 줄을 적으라고 안내한 뒤 종료한다. 이름·번호
모두 받고, 술이 없는 시즌은 `없음` 이라고 적는다. 관리자가 적은 값은 자동 판별을
이긴다. 여기서 멈추는 이유는 상품명 불일치와 같다 — 갱신이 멈추면 주문서는 이전
상태 그대로라 손님이 잘못 안내받는 일은 없지만, 판단 없이 배포하면 술이 배송되는
상품으로 섞여 들어간다. `tools/season_prep.py` 가 0단계에서 같은 판정을 미리
보여 주므로, 실제로 이 정지에 걸리는 일은 드물어야 한다.

주문서 쪽 `console.error` 와 **관리자 홈의 `배송 불가 (주류)` 칸**은 그래도 남겨
둔다. 0 이라고만 적으면 관리자는 "이번 시즌엔 술이 없구나"로 읽으므로 "판별 불가"와
구분해야 하고, 값의 **출처**(`시즌 갱신` / `분류 이름`)도 함께 보여 준다. 이 칸의
숫자와 이름은 전부 데이터에서 계산한다. 시즌 값을 적지 말 것.

동작은 두 갈래다:

- **주류 + 일반 상품이 섞인 주문** — 배송 정보 영역은 그대로 둔다. 일반 상품은
  어딘가로 보내야 하기 때문이다. 주류만 배송 배분에서 빠지고, 어떤 상품이 매장
  수령인지 빨간 띠로 알린다.
- **주문한 상품이 전부 주류** — 받을 배송지가 없으므로 `#orderSectionsContainer`
  와 `배송 정보 추가` 버튼을 숨기고 안내가 그 자리를 대신한다.

주류를 배송에서 빼는 지점은 **두 곳이고 둘 다 필요하다**: `getOrderProductList()`
(배송 상품 콤보박스와 잔량 계산의 유일한 입력)와 `validateDeliveryQuantities()`
(자체적으로 상품 행을 훑는다). 후자를 빠뜨리면 배분할 방법이 없는 상품을 두고
"배송 수량 0 / 지급 수량 1"이 영원히 뜨면서 전송까지 막힌다.

전부 주류일 때는 `validateAllInputs()` / `checkSequentialInput()` 이 섹션 검사를
건너뛰고, `collectOrderData()` 는 숨겨 둔 빈 칸을 긁지 않는다(`주문목록: []`).
대신 `배송불가: { 사유, 상품목록 }` 을 싣는다 — 이걸 안 보내면 시트를 받는 쪽에서는
상품 정보에는 있는데 배송 상품 목록에는 없는 상품이 되어 빠뜨린 주문으로 보인다.
`apps_script.js` 의 `writeNoDeliverySection()` 이 그 칸을 그린다(관리자가 Apps
Script 를 다시 배포해야 반영된다).

안내와 행 뱃지는 **인쇄된다**(`.no-print` 가 아니다). 종이에서 배송지 칸만 비어
있으면 빠뜨린 주문서로 보이기 때문이다. 조회 시점 알림은 행사 알림보다 **뒤에**
띄운다 — 알림 자리가 하나뿐이라 나중에 부른 쪽이 화면에 남고, 덤을 못 받는 것보다
배송이 안 되는 쪽이 큰 일이다. 그래서 그 문구에 행사도 함께 적는다.

### Color Scheme (section theming)

| Section | Color | Hex |
|---|---|---|
| Orderer (주문자) | Cyan | `#0891b2` |
| Sender (보내는 분) | Orange | `#ea580c` |
| Receiver (받는 분) | Purple | `#9333ea` |
| Delivery products (배송 상품) | Teal | `#0d9488` |

### Print Layout

- Optimized for A4 paper (210mm × 297mm)
- Vertical title columns auto-inserted during print
- `@media print` CSS hides UI-only elements
- DOM node reference approach (not `innerHTML`) to preserve input values across print

## Development Workflow

### Making Changes

1. **HTML structure**: Edit `order_form.html`
2. **Screen styles**: Edit `css/main.css`
3. **Print styles**: Edit `css/print.css`
4. **Mobile styles**: Edit `css/responsive.css`
5. **JavaScript logic**: Edit the appropriate `js/*.js` file based on function area
6. Open in browser to test — no build step required, just refresh

### File Co-location Requirement

`config.js`, `products.js`, `product_detail.html`, `order_split.html`, `css/`, `js/`, and `BarcodeImgs/` **must be in the same directory** as `order_form.html` for the application to work.

### Seasonal Catalog Refresh (설날/추석)

**`products.js`, `store.js` and `BarcodeImgs/` are generated — do not hand-edit them.**

**The refresh is meant to run without a developer.** All admin inputs live in
`시즌설정.txt` — a flat `이름: 값` line format, deliberately **not** JSON: the admin
edits it in the GitHub web editor, and a single missing comma used to break the whole
file with an error message they could not read. There is nothing to unbalance in a
line format. `.github/workflows/season-update.yml` runs `tools/update_season.py` on
manual dispatch, commits the generated files, and GitHub Pages redeploys from `main`.
`docs/관리자안내.md` is the admin-facing guide and the source of truth for the
procedure — keep it in sync with any change to `시즌설정.txt`'s fields or the
workflow's inputs. `docs/manual.html` is the same content as a standalone page
served by GitHub Pages (`/GS25_Order/docs/manual.html`); it is hand-maintained
alongside the markdown, so change both together or the admin reads stale steps. Do not reintroduce required CLI flags
for season data, and do not move admin-supplied values back into JSON: both lose the
"no developer needed" property.

**관리자 홈 (`admin.html`).** The refresh runs twice a year, so by the time it comes
round the admin has forgotten not *where the links are* but *what normal looks like* —
which season is live, whether 행사 not being auto-selected today is a bug or the
calendar. Every one of those answers already exists in `products.js` / `store.js`, so
this page reads them: season, product count, 사전/본행사 dates with their item counts,
which period today falls in, days to the next one, and a "지금 할 일" paragraph that
changes with the period. **Never hard-code a season-dependent value into this page** —
a hand-written date becomes a lie the moment the season turns, and this is the one
screen the admin trusts to tell them the truth.

It reuses `describePromoPeriod()` from `js/admin-test.js` rather than deciding periods
itself, for the same reason `product_detail.html` does: two implementations means two
screens that can disagree. GitHub links are assembled from `repoSlug()`, which reads
owner/repo out of `location` (falling back to a constant off GitHub Pages), so the
addresses are not written down a fourth time after the README and the two manuals.
"마지막 갱신" comes from the GitHub commits API for `products.js` and fails soft —
writing a timestamp into the repo instead would make every run produce a commit, which
would destroy the "an unchanged rebuild commits nothing" check that catches bad barcode
diffs.

GitHub Pages cannot password-protect anything, so this page is obscurity, not security:
`noindex`, and **the order form must never link to it**. That is acceptable because the
GitHub links inside it require a login to do anything, and the rest are already public.
Do not "solve" this by moving the site off Pages — that would take the whole
no-developer property with it. The 주문서/상품 찾기 addresses sit in their own section
with 주소 복사 buttons, because those are the two the clerk is meant to receive.

`load_settings()` is deliberately lenient about *form* and strict about *identity*.
It accepts `:` `：` `=`, quotes, trailing commas, and `2027.1.5` / `2027/01/05` dates;
it also accepts short aliases (`담당자`, `카탈로그 링크`). But an unrecognised field name
is an error with a `difflib` suggestion, never a silent skip — `사전행사시자` must not
quietly become "no pre-event date". Problems are collected and reported **all at once**
with line numbers so the admin does not fix-and-rerun one line at a time.

Config errors must fail loudly with a Korean message naming the offending line —
never fall back to defaults, because a silent default would deploy wrong dates or
promotions to a live store.

`배송불가 분류` is optional and normally left absent — the run resolves it from the
catalog's own category names. It exists so a season whose labels break the automatic
match can still be fixed without a developer (see **주류 배송 불가** above). It is the
one field that must **not** be carried over from last season: the numbers change, and
a stale line would silently mark the wrong categories.

**`season.json` is no longer the admin's file.** It is now script-managed memory:
`{아이콘 번호: {행사, 지문, 대략}}`. `migrate_old_json()` converts a pre-existing
old-shape `season.json` into `시즌설정.txt` automatically, and `load_benefit_memory()`
still reads the old `행사`/`행사아님` shape, so neither needs to be kept by hand.

The GS25 catalog is replaced wholesale every 설날/추석. Codes are reused for
*different* products across seasons (in the 2026 추석 change, 371 of the carried-over
codes pointed at a different item), so `products.js` and `BarcodeImgs/` must be
regenerated **together**. Updating only one of them prints a barcode that scans as
a different product than the order form shows.

1. Drop the new barcode-book PDF into `BarcodeSource/`
2. Point `시즌설정.txt` at it and at the season's catalog JSON
   (`<catalog-root>/products.json`, e.g. `https://gs25mobile.com/2026_2nd/products.json`),
   and set the 행사 dates
3. Run the **시즌 갱신** workflow (or `python tools/update_season.py` locally)

Step 3 cross-checks the PDF against the catalog JSON and **stops the run** — before
anything is generated, so a failed update leaves the live form untouched — when either
the code sets do not line up 1:1 **or** a shared code carries a different 상품명 in the
two sources. The barcode that gets printed comes from the PDF while the name and price
on screen come from the catalog, so a name disagreement means the paper and the screen
may be describing different goods. This used to print `[!]` and carry on, which let a
green check ship a mismatch; a stop is always the safe direction here. `--allow-name-mismatch`
overrides it and is deliberately **not** exposed as a workflow input — an admin should
never be able to click past this, and the failure message says so. On the real 2026 추석
data the check is 601/601 exact after whitespace stripping, so the strictness costs
nothing in practice.

Only the name has a second source. **Price does not** — it exists only in the catalog,
which is why the admin checklist still asks for a five-code price spot check by eye.

Barcode rendering is deterministic: re-running with the same PDF reproduces all 601
JPEGs byte-for-byte, so the workflow's commit stays empty unless something genuinely
changed. If a barcode diff appears without a PDF change, something is wrong.

Products priced `"시세반영"` (gold/silver bars) are emitted as
`{ "price": 0, "marketPrice": true }`; the form then leaves 단가 blank and prompts
the clerk for the day's price instead of pre-filling 0.

**Split screen (`order_split.html`).** A second entry point: 상품 찾기 panel on the
left (500px, fixed), `order_form.html` in an iframe on the right. The order form is
**not duplicated** — the shell embeds it, and because both are same-origin the 담기
button calls into the frame directly.

담기 never computes anything. It writes the code into the row's 상품코드 input and
dispatches `blur` on it, which is exactly the path a clerk's own typing takes, so
상품명·단가·행사·지급수량·금액·바코드 all come from the existing autocomplete. Adding a
second product calls the form's own `addProductRow()` rather than building a row —
that keeps its guard against leaving 수량/단가 blank. The panel pre-checks the same
fields (`missingFieldOf()`) only so the reason appears in the panel, since on a phone
the form's own alert sits behind the overlay; 시세반영 items are the case that actually
hits this. An already-added code is refused, not silently incremented.

Printing was verified: `print()` from inside the iframe fires `beforeprint` only in
the frame, never in the shell, so the printout is the order form alone — the panel
cannot leak onto paper. Do not "fix" this by adding print rules to the shell.

Below 900px the two-column layout does not fit, so the panel becomes a full-width
overlay behind a floating 상품 찾기 button, and a successful 담기 closes it — otherwise
the clerk cannot see the row that was just added. A blocked 담기 deliberately leaves
it open so the message is read.

**Category browsing.** The panel's 분류 목록 button shows the catalog's own groups —
사전행사 5 and 본행사 29 for 2026 추석 — and picking one filters the list; a 검색어 can be
combined with it. Counts are computed from the data, so they always match what the
list shows.

The numbers come from `products.json` (`sort` → `cat`, the 5-char o/x `event` string →
`preCat`), but the **labels do not exist in that file**. They are minified into the
catalog's own JS bundle as an array named `Ta`, which `load_categories()` scrapes:
fetch the catalog index, find `assets/index-*.js`, bracket-match `Ta = [ … ]`, keep the
`type: "list"` rows. Scraping someone else's minified build is the fragile step here.
It therefore **fails soft**: a season where the scrape breaks still gets correct
products, `CATEGORIES` becomes `null`, and the UI labels groups "분류 3" by number. Do
not invent names in the fallback — a wrong label sends the clerk hunting in the wrong
group, while a bare number is merely unhelpful. The run prints `[!]` with the reason,
and separately lists any `sort` value that has no label.

**Info icons (냉장·냉동·무료배송).** The catalog shows these as small chips, and their
text exists **only inside the icon PNGs** — the same wall as the promotion rates. So the
detail window renders the catalog's own images (`PROMO_CONFIG.catalogIcons` +
`<번호>.png`) instead of trying to name them. `products.js` carries the numbers per
product as `icons`.

Which numbers: exactly those in `attached` that `resolve_benefits()` classified as
**not** a promotion (`BENEFIT_OTHER`). Promotion icons are deliberately excluded — the
행사 is shown as text with its period, and the catalog's icon is 본행사-only, so
including it would contradict the 사전행사 line on the same screen. Only `attached` is
read, never `attached_e`: in 2026 추석 no info icon appeared solely in `attached_e`.
Icons are 128×128 with the glyph inset, so they need ~38px of height to stay legible.

**Product detail window.** Clicking a barcode opens `product_detail.html?code=<코드>`
— photo, name, price, 구성 설명 and both 행사 rates — in a 500×900 popup pinned to the
right of the screen so the order form stays visible (`catalogSearchLink()` /
`openCatalogPopup()` in `js/product.js`). The anchor keeps its `href`/`target`, and
`preventDefault()` runs only after `window.open` succeeds, so a blocked popup still
opens as a normal tab. The window name is fixed, so clicking several products reuses
one window instead of stacking them.

We render this ourselves rather than linking GS25's own detail view because that view
is a modal held in React state with **no URL**, and the catalog is a different origin
— the popup cannot be scripted or clicked on the user's behalf (verified:
`contentDocument` is `null`, any access throws `SecurityError`). Do not attempt to
automate it; the fix is to render from data we already have. A **GS25 원본 카탈로그에서
보기** link at the bottom of the detail window (built from `PROMO_CONFIG.catalogSearch`) is
the one reader of that value — it lands on the catalog's search result for the code,
which is as deep as an outside link can go.

`product_detail.html` loads `js/utils.js`, `js/admin-test.js` and `js/product.js` so
`getApplicableEvent()` decides the period exactly once, for both screens — a second
implementation would let the two windows disagree about the 행사. It also calls
`renderTestBanner()`, since `sessionStorage` carries the admin test date into the
popup and a detail window silently showing real-date 행사 would contradict the form.
Product names and descriptions come from GS25 and are inserted with `textContent`,
never raw HTML.

Both season-generated addresses live in `PROMO_CONFIG` (`catalogSearch`,
`catalogImage`, built by `catalog_search_url()` / `catalog_image_url()` from the
season's 카탈로그 주소) — never hardcode them, or next season's form shows last
season's product for a reused code. Photos are `<root>/goods/<상품코드>.webp`; that
naming held for all 601 items in 2026 추석, and `check_picture_names()` prints a `[!]`
if a future season breaks it rather than letting the wrong photo appear.

**Promotions.** The catalog stores them as 구매혜택 icon numbers in `attached`
(본행사) / `attached_e` (사전행사); the rate is only readable from the icon image at
`<catalog-root>/icons/benefit_<n>.png` — **the one step that cannot be fully automated.**

Because **icon numbering is season-specific**, the script keys its memory on the
*image*, not the number. `icon_fingerprint()` returns two hashes and they have
different jobs:

- **지문** — SHA-256 of the raw RGB pixels. Used for automatic carry-over, and *only*
  this. If last season's #12 and this season's #37 are pixel-identical, the rate
  transfers and the admin does nothing.
- **대략** — an 8×8 dHash, used **only** to phrase a hint to a human. Never to decide
  a rate. This is not caution for its own sake: the real `2+1` and `3+1` icons differ
  by a single glyph and sit 7 bits apart, well inside any sane "same image" threshold.
  A perceptual match here would silently ship the wrong count.

`resolve_benefits()` stops for two cases: an unseen fingerprint, and — importantly —
a **known number whose image changed**, which would otherwise apply last season's rate
to this season's promotion. Unknown icons are downloaded into a single labelled contact
sheet (`unknown_benefit_icons.png`, uploaded by the workflow as an artifact) and the
script prints the exact `구매혜택 <n>: <rate>` lines to paste into `시즌설정.txt`, where
an admin entry always overrides. `--allow-unknown-benefits` skips the check, but an
unrecognised promotion silently becomes 없음 and the clerk ships the wrong count.

Take the 행사 dates from the season's 사전행사 banner at
`<catalog-root>/headers/event_header_1.png` and `<catalog-root>/events/event_1.jpg`;
the dated icons ("9월 5일부터") corroborate the 본행사 date, and the banner's 품목 count
is a free check on the extracted `eventPre` total (2026 추석: both said 127).

**Running the refresh on the admin's behalf.** The admin hands over exactly two things —
the catalog site URL and the barcode-book PDF — and `.claude/skills/season-refresh/SKILL.md`
is the procedure for that. Start with `python tools/season_prep.py <카탈로그 주소> <PDF>`:
it normalises the URL, verifies the catalog opens and still has the fields we expect,
checks PDF ↔ catalog codes 1:1, downloads the 사전행사 banner and any *unseen* benefit
icons into `.season_prep/` (gitignored), and prints a `시즌설정.txt` draft with only the
three dates blank. It changes nothing except placing the PDF in `BarcodeSource/`, so a
wrong URL costs one command instead of a half-finished run.

The dates and the icon rates are then read **from the images** — that is the whole reason
this can be done at all, and also why both must be confirmed with the admin before use:
banner wording shifts between seasons, and the real `2+1` and `3+1` icons differ by one
glyph. The barcode scan test cannot be delegated at all; `products.json` carries no
barcode number, so there is no ground truth to check the rendered JPEG against.

Dependencies: `pip install pdfplumber pymupdf pillow`

### Google Forms Configuration

Edit `config.js` with the form URL and entry IDs. The status indicator on the page shows:
- Green: config loaded and valid
- Yellow: partial configuration
- Red: config missing or broken

### Known Issues / Active Work

- **PDF export**: html2pdf.js has been replaced with html2canvas for image capture. `plan.md` documents the original plan.
- **Legacy files**: `styles.css` and `print.css` (root level) are vestigial and not loaded.

## Commit Message Convention

Commit messages are written in Korean, typically prefixed with a date:
```
2026_0210_상품추가 기능 수정_바코드 이미지 크기 수정
```
Or short descriptions:
```
PDF 저장 테스트
데이터 사라지는 부분, 전화번호 하이픈 추가 형식 수정
```

## Important Warnings

- **No server-side component** — everything is client-side
- **No environment variables** — configuration is in `config.js`
- **Script loading order matters** — see dependency chain above; changing order may cause `ReferenceError`
- **All functions must remain global** — HTML `onclick` attributes reference global functions
- **Google Forms submission uses no-cors mode** — response status cannot be read; success is assumed if no network error
- **Client-side validation only** — no server-side validation exists
