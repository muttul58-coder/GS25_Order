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
| `products.js` | Product database — exports global `PRODUCTS_DATA` object (646 items) |
| `config.js` | Google Forms endpoint URL and entry IDs — exports global `GOOGLE_FORM_CONFIG` |

## File Structure

```
GS25_Order/
├── order_form.html       # Main HTML (~330 lines, HTML only)
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
├── products.js           # Product database (646 products)
├── apps_script.js        # Google Apps Script for Sheets automation (not loaded by HTML)
├── BarcodeImgs/          # 687 barcode JPEG images (named by product code, e.g. 08-01.jpg)
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
| `js/product.js` | `checkProductsDataLoaded()`, `getProductInfo()`, `formatProductCode()`, `addProductRow()`, `removeProductRow()`, `calculateRowTotal()`, `updateProductTotals()`, `updateBarcodeImages()` | Product code lookup, table row CRUD, total calculation, barcode display |
| `js/delivery.js` | `refreshDeliveryProductSelects()`, `onDeliveryProductCodeChange()`, `addDeliveryProductRow()`, `removeDeliveryProductRow()`, `validateDeliveryQuantities()` | Delivery product selection and quantity validation |
| `js/copy-sync.js` | `toggleOrdererInfoCopy()`, `toggleReceiverInfoCopy()`, `syncFromOrderer()`, `syncFromSender()`, `initCopySync()` | Auto-copy orderer info to sender/receiver with live sync |
| `js/validation.js` | `validateAllInputs()`, `checkOrdererInfoComplete()`, `checkSequentialInput()`, `attachSequentialInputGuide()` | Input validation, sequential input enforcement |
| `js/section.js` | `addSection()`, `removeSection()`, `renumberSections()` | Delivery section add/delete/reorder |
| `js/print-image.js` | `addPrintTitleColumn()`, `adjustAddressFontSize()`, `printOnly()`, `saveAsImage()`, `beforeprint`/`afterprint` handlers | A4 print layout with vertical title columns, image capture |
| `js/submit.js` | `submitOnly()`, `printOrder()`, `submitToGoogleForm()`, `collectOrderData()`, `checkConfigStatus()` | Google Forms submission, order data collection |
| `js/init.js` | `initializePage()` | Page initialization: date/time, event listeners, postal filter |

### CSS Module Details

| File | Content |
|---|---|
| `css/main.css` | Screen styles: reset, layout, forms, tables, buttons, alerts, section theming (orderer/sender/receiver colors), barcode grid, validation error states |
| `css/print.css` | `@media print` block: A4 optimization, vertical title columns, element hiding, page break rules |
| `css/responsive.css` | `@media (max-width: 768px)` and `@media (max-width: 480px)` breakpoints |

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

1. **HTML structure**: Edit `order_form.html`
2. **Screen styles**: Edit `css/main.css`
3. **Print styles**: Edit `css/print.css`
4. **Mobile styles**: Edit `css/responsive.css`
5. **JavaScript logic**: Edit the appropriate `js/*.js` file based on function area
6. Open in browser to test — no build step required, just refresh

### File Co-location Requirement

`config.js`, `products.js`, `css/`, `js/`, and `BarcodeImgs/` **must be in the same directory** as `order_form.html` for the application to work.

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
