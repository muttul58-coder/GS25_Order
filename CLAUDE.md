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
| `store.js` | Exports global `STORE_INFO` (store name, manager, phone) rendered in the page header. Generated from `시즌설정.txt`. |
| `config.js` | Google Forms endpoint URL and entry IDs — exports global `GOOGLE_FORM_CONFIG` |

## File Structure

```
GS25_Order/
├── order_form.html       # Main HTML (~330 lines, HTML only)
├── product_detail.html   # Barcode click target — product photo/구성/행사 popup
├── order_split.html      # 상품 찾기 panel (left) + order form in an iframe (right)
├── css/
│   ├── main.css          # Screen styles: layout, forms, tables, buttons, alerts (~854 lines)
│   ├── print.css         # Print-only @media print styles for A4 (~476 lines)
│   └── responsive.css    # Mobile responsive breakpoints (~81 lines)
├── js/
│   ├── utils.js          # Global vars, alerts, formatting, phone auto-hyphen (~100 lines)
│   ├── address.js        # Daum Postcode API address search (~75 lines)
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
│   └── update_season.py  # Regenerates products.js + BarcodeImgs/ from a season PDF
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
<script src="js/product.js"></script>        <!-- Depends on: utils -->
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

### CSS Module Details

| File | Content |
|---|---|
| `css/main.css` | Screen styles: reset, layout, forms, tables, buttons, alerts, section theming (orderer/sender/receiver colors), barcode grid, validation error states |
| `css/print.css` | `@media print` block: A4 optimization, vertical title columns, element hiding, page break rules |
| `css/responsive.css` | `@media (max-width: 768px)` and `@media (max-width: 480px)` breakpoints |
| `css/catalog-panel.css` | `order_split.html` only: two-column split, product cards, phone overlay below 900px |

### Data Flow

1. User fills form → `validateAllInputs()` checks all fields
2. `collectOrderData()` assembles structured JSON
3. `submitToGoogleForm()` POSTs via `fetch()` (no-cors mode) to Google Forms
4. `window.print()` opens browser print dialog
5. (Optional) `apps_script.js` on Google Sheets parses responses into formatted sheets

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

`PROMO_CONFIG.preNote` carries the 사전행사 condition (2026 추석: the bonus only applies
to 삼성/KB국민/비씨/신한 card payments) and is appended to the auto-select toast. Do not
drop it — a clerk who promises a bonus that the payment method does not qualify for
has to make it good.

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

`load_settings()` is deliberately lenient about *form* and strict about *identity*.
It accepts `:` `：` `=`, quotes, trailing commas, and `2027.1.5` / `2027/01/05` dates;
it also accepts short aliases (`담당자`, `카탈로그 링크`). But an unrecognised field name
is an error with a `difflib` suggestion, never a silent skip — `사전행사시자` must not
quietly become "no pre-event date". Problems are collected and reported **all at once**
with line numbers so the admin does not fix-and-rerun one line at a time.

Config errors must fail loudly with a Korean message naming the offending line —
never fall back to defaults, because a silent default would deploy wrong dates or
promotions to a live store.

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

The script cross-checks product names between the PDF and the catalog JSON, and
fails if the code sets do not line up 1:1. Any non-zero exit or `[!]` line means
the two sources disagree — resolve before deploying.

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
