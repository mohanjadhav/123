# BARCODR Studio — spec

EASY LABELS by HC — AzureLabel-style single-window barcode label designer (light theme). Multiple saved label templates per brand; print batches from Google Sheets / CSV / Excel.

## Data model (Mongo)
- `templates`: {id, name, brand, width_mm, height_mm, background, elements[], page_setup {paper label|a4|letter|custom, paper_w/h, orientation, cols/rows (0=auto), gap_x/y, margins, offset_x/y, order across|down, start_position}, source_id (remembered print-data sheet), created_at, updated_at}
  - element: {id, type: text|barcode|qrcode|rect|image, x,y,w,h (mm), content (static or `{{column}}`), font_family, font_size(pt), font_weight, italic, underline, strike, align, color, fill, stroke, stroke_width, radius, barcode_format: CODE128|CODE39|EAN13|UPC|ITF14, show_text, image_url, rotation}
- `sheet_sources`: {id, name, brand, url, template_id?, workbook ("google:<sheetId>" | "upload:<batch>"), workbook_name, tab, tab_index, created_at} — one source per TAB; tabs of one spreadsheet share `workbook`. url = Google/CSV link, "sample", or "upload:<id>"
- `sheet_uploads`: {id, name, columns, rows} for uploaded files
- `print_queue`: {id, template_id, template_name, template_brand, source_id, source_name, items:[{cells, qty>=1, selected}], selected, created_at} — spooled jobs (snapshot of rows) printed together.
- `sheet_copies`: {source_id, columns, rows:[{id, cells, qty, selected, origin}], qty_column (print qty read from this column; null = manual qty; kept on refresh), edited, updated_at} — editable in-app copy of a sheet; edits NEVER written to Google. origin = JSON signature of the original row (null = added in app). Print data in the designer comes from this copy.

## API (/api)
- templates: GET/POST /templates, GET/PUT/DELETE /templates/{id}, POST /templates/{id}/duplicate
- sources: GET/POST /sources, PUT/DELETE /sources/{id}
- POST /sheets/fetch {url} → {columns, rows, csv_url, name}. Google edit/share/publish links → CSV export (keeps gid). Private → 400 detail.
- POST /sheets/upload (multipart file .csv/.tsv/.xlsx) → created SheetSource[] (one per Excel tab, brand = tab name)

- GET /sheets/copy/{source_id} (creates from original on first call), PUT /sheets/copy/{source_id} {columns, rows}, POST /sheets/copy/{source_id}/refresh {mode: replace|merge} → {sheet, added}. merge keeps edits and appends original rows whose signature isn't known.

- POST /sheets/tabs {url} → [{name,gid,url}] (parses Google htmlview `items.push({name, gid})`). POST /sources/{id}/sync-tabs → creates/updates one source per tab (matched by gid, idempotent), returns tabs in order. Connecting a Google link auto-syncs tabs.

- Queue: GET /queue, POST /queue {template_id, source_id, items}, PATCH /queue/{id} {selected?, items?}, DELETE /queue/{id}, POST /queue/remove [ids] (empty = clear all).

## UI — routes: `/queue` Print queue page; `/data/:sourceId` Sheet Data page; everything else → designer (any path) `pages/Workspace.tsx`
- Toolbar: Preview, Print, Save, Undo, Redo, Label properties, Open label, New label, Create a copy.
- Label tabs (open labels persisted in localStorage `bc.openTabs`), close with x.
- Left: tool palette (text, barcode, qrcode, shape, line, image) → testids add-<key>-button; "Data fields" = sheet column headers (click inserts {{col}} into selected element or adds new text; drag onto label to place); Elements list.
- Center: canvas with mm rulers, drag/resize, zoom (-, fit, +). Canvas previews first ticked sheet row.
- Right: Inspector — Label properties when nothing selected (name, brand, size preset, w/h, colour); element props incl. B/I/U/S toggles, align, font, colours, barcode format, position, arrange, delete.
- Bottom: "Label print data" grid: Import (dialog: Google link Connect + upload CSV/Excel), sheet select (saved on label immediately as source_id), Refresh (links only), delete sheet, search, select-all, per-row checkbox + Print qty, per-row print, Preview, Print. Rows default all ticked, qty 1.
- Sheet Data page (`pages/SheetData.tsx`, opened by "Edit data" in the grid): click a cell to edit (Enter/Tab move, Esc cancel), edited cells highlighted yellow (tooltip shows original), app-added rows green bar; Add row, duplicate/delete row, per-row checkbox + Qty, select all, search, Refresh from Google (asks merge vs replace when edited), Reset to original. Auto-saves (debounced) via lib/useSheetCopy (shared react-query key ["copy", sourceId] with designer).
- Qty is always editable via QtyStepper (−/input/+). With a qty column set, withQty() writes the number into that column's cell in the app copy (Google untouched). withTick on a qty-0 row sets qty 1 in either mode.
- Tick rules (lib/grid): fresh copies start UNTICKED with qty 0; choosing a qty column ticks rows with qty>0 (tickByQty); typing manual qty>0 ticks, 0 unticks (withManualQty); ticking a manual row with qty 0 sets qty 1 (withTick); editing the qty-column cell re-ticks.
- Print queue (pages/PrintQueue.tsx): "Add to queue" (designer grid + Sheet Data toolbar) snapshots ticked rows with qty>0 for the current label; queue page lists jobs (tick job, expand → tick rows / edit qty), select all, remove selected, clear, batch Preview with page nav, "Print all selected" prints all jobs in ONE print using CSS named pages (@page lbl-<templateId>) so mixed label sizes keep their own paper; after printing asks to remove printed jobs. Toolbar "Print queue (N)".
- Qty from column: QtyColumnSelect in designer grid + Sheet Data toolbar; lib/grid rowQty() parses "2", "2.0", "1,000"; blank/0 = not printed; expandRows() builds print list. Suggests columns matching qty|quantity|copies|print|labels|nos|count|pcs.
- SheetTabs (components/workspace/SheetTabs.tsx): Excel-style tab bar for sibling tabs (same workbook) + Sync/Find tabs; shown in designer grid (switching relinks the label) and on Sheet Data page (navigates). Sheet Data page also has label picker (default: label linked to sheet) + Preview/Print.
- Page setup dialog (toolbar "Page setup"), saved instantly per label; print CSS hides every body child except .print-root; @page size = computed page, margin 0.
- Themes: lib/theme.ts (blue, emerald, teal, purple, pink, red, orange, graphite) via html[data-theme] + --app-accent* CSS vars; picker in toolbar; localStorage `el.theme`.
- New label dialog: starter gallery (blank, price, product, shelf, qr, shipping). Starter placeholders {{brand}},{{name}},{{price}},{{sku}},{{barcode}},{{location}},{{link}},{{address}} auto-map to columns by fuzzy name (contains match).
- Print preview dialog: paper (roll / A4 / Letter), margin, gap, summary, missing-fields warning, page navigation, Print. Print uses window.print with only .print-root visible.
- Shortcuts: Ctrl+S, Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z, Delete, arrows (Shift = 5mm).

## Seed (backend/seed.py, idempotent)
- Templates tpl-aura-hangtag, tpl-nordic-jar, tpl-omni-bin; source src-sample "Sample multi-brand sheet" (url "sample", 9 rows: brand_name, sku, product_title, barcode_value, price, batch_no, qr_url)

No auth.

## Appearance & fit (latest)
- Appearance panel (palette button, every page header; `lib/theme.ts` + `components/ThemePicker.tsx`), saved in localStorage `el.prefs` = {theme, custom, mode, font, zoom}:
  - Light / Dark mode (dark = CSS invert of UI on `html[data-mode=dark]`; labels/swatches/images carry `.true-color` and are re-inverted so label colours are exact; print disables filters).
  - 13 preset accent colours + any custom colour (hover/soft shades derived with color-mix from `--app-accent`).
  - UI font: IBM Plex Sans, Geist, DM Sans, Space Grotesk, IBM Plex Mono, Lora.
  - App size 70–140% (−/+ and slider): `#root { zoom }` and `.app-screen` height = 100dvh/zoom so every page fills exactly one screen. Canvas drag/drop & column resize divide pointer deltas by `uiZoom()`.
- Toolbars never overflow the window: designer toolbar shows text only for key actions (xl+), others icon+tooltip; print-data toolbar wraps onto a second line (Print / Add to queue group stays visible).
- Local file import: .xlsx/.xlsm, .xls (xlrd), .ods LibreOffice Calc (odfpy), .csv/.tsv — each workbook tab becomes one sheet.
