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
| html2pdf.js v0.10.2 | PDF generation (deprecated — see `plan.md`) |

### Local Modules (loaded via `<script src>`)

| File | Purpose |
|---|---|
| `products.js` | Product database — exports global `PRODUCTS_DATA` object (646 items) |
| `config.js` | Google Forms endpoint URL and entry IDs — exports global `GOOGLE_FORM_CONFIG` |

## File Structure

```
GS25_Order/
├── order_form.html       # Main application (~4,700 lines, monolithic HTML+CSS+JS)
├── config.js             # Google Forms configuration (9 lines)
├── products.js           # Product database (646 products)
├── apps_script.js        # Google Apps Script for Sheets automation (not loaded by HTML)
├── styles.css            # Additional CSS (largely unused — styles are inline in HTML)
├── print.css             # Print-specific styles
├── BarcodeImgs/          # 687 barcode JPEG images (named by product code, e.g. 08-01.jpg)
├── js/                   # UNUSED modular JS files (NOT loaded by HTML — legacy/abandoned)
│   ├── section.js
│   ├── submit.js
│   ├── print.js
│   ├── product-code.js
│   ├── calculation.js
│   ├── address.js
│   └── copy-sync.js
├── plan.md               # PDF implementation plan
├── README.md             # Korean documentation
└── LICENSE               # MIT
```

### Critical: Monolithic Architecture

All application logic lives inside `order_form.html` as inline `<script>` and `<style>` blocks. The `js/` folder contains abandoned modular extractions that are **never loaded** — modifying them has no effect. When making code changes, edit the inline code within `order_form.html` directly.

## Architecture & Code Organization

### Entry Point

`order_form.html` → `DOMContentLoaded` event → `initializePage()`

### Script Loading Order

1. Daum Postcode API (async CDN)
2. `products.js` (defines `PRODUCTS_DATA`)
3. `config.js` (defines `GOOGLE_FORM_CONFIG`)
4. html2pdf.js (CDN)
5. Inline `<script>` block (~1,700+ lines of application code)

### Major Code Sections (within inline script)

| Function Area | Key Functions | Description |
|---|---|---|
| Product management | `getProductInfo()`, `formatProductCode()`, `addProductRow()`, `removeProductRow()`, `calculateRowTotal()`, `updateProductTotals()` | Product code lookup, table row CRUD, total calculation |
| Address search | `searchOrdererAddress()`, `searchSenderAddress()`, `searchReceiverAddress()` | Daum Postcode API integration |
| Section management | `addSection()`, `removeSection()`, `renumberSections()` | Delivery section add/delete/reorder |
| Delivery products | `refreshAllDeliveryProductSelects()`, `addDeliveryProductRow()`, `removeDeliveryProductRow()`, `validateDeliveryQuantities()` | Delivery product selection and quantity validation |
| Copy/sync | `toggleOrdererInfoCopy()`, `toggleReceiverInfoCopy()`, `syncFromOrderer()`, `syncFromSender()` | Auto-copy orderer info to sender/receiver |
| Calculations | `calculateRowTotal()`, `updateProductTotals()`, `formatNumberWithCommas()`, `parseFormattedNumber()` | Promotion math (1+1, 2+1), totals |
| Barcodes | `updateBarcodeImages()` | Load barcode JPEGs from `BarcodeImgs/` |
| Printing | `addPrintTitleColumn()`, `adjustAddressFontSize()`, `beforeprint`/`afterprint` handlers | A4 print layout with vertical title columns |
| PDF/Print output | `printOnly()`, `savePDF()`, `applyPrintLayout()`, `removePrintLayout()` | Print dialog and PDF generation |
| Form submission | `validateAllInputs()`, `collectOrderData()`, `submitToGoogleForm()` | Validation, JSON assembly, Google Forms POST |
| Phone formatting | `formatPhoneNumber()`, `attachPhoneFormatting()` | Auto-insert hyphens in phone numbers |
| Sequential validation | `checkOrdererInfoComplete()`, `checkSequentialInput()` | Block premature section addition |
| Settings | `checkConfigStatus()` | Display config.js status indicator |

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

- **Event handling**: Inline `onclick` attributes on dynamically created elements
- **DOM manipulation**: Direct `querySelector`/`querySelectorAll`
- **Error indication**: `.error` CSS class added to invalid inputs
- **User feedback**: Custom `showAlert(message, type)` function
- **Number formatting**: Comma-separated display with `formatNumberWithCommas()` / `parseFormattedNumber()` for parsing
- **Async operations**: `async/await` with `fetch()` for Google Forms submission
- **Debug logging**: `console.log()` for product lookups and form submissions

### Product Code Format

- Standard format: `XX-YY` (e.g., `08-01`, `106-09`)
- Auto-normalization: `8-1` → `08-01` via `formatProductCode()`
- Product categories span codes 08–106

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

1. Edit `order_form.html` directly (inline CSS/JS)
2. Open in browser to test
3. No build step required — just refresh the page

### File Co-location Requirement

`config.js`, `products.js`, and `BarcodeImgs/` **must be in the same directory** as `order_form.html` for the application to work.

### Adding Products

Edit `products.js` — add entries to the `PRODUCTS_DATA` object:
```javascript
"XX-YY": { "name": "상품명", "price": 12345 }
```
Add corresponding barcode image as `BarcodeImgs/XX-YY.jpg`.

### Google Forms Configuration

Edit `config.js` with the form URL and entry IDs. The status indicator on the page shows:
- Green: config loaded and valid
- Yellow: partial configuration
- Red: config missing or broken

### Known Issues / Active Work

- **PDF export**: html2pdf.js has tainted canvas errors with barcode images and mobile partial capture. `plan.md` documents the plan to replace with `window.print()` + browser "Save to PDF".
- **Unused files**: `js/` folder and `styles.css` are vestigial — do not reference or load them.

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

- **Do not modify files in `js/`** — they are not loaded and changes have no effect
- **All code changes must go in `order_form.html`** inline scripts/styles
- **No server-side component** — everything is client-side
- **No environment variables** — configuration is in `config.js`
- **Google Forms submission uses no-cors mode** — response status cannot be read; success is assumed if no network error
- **Client-side validation only** — no server-side validation exists
