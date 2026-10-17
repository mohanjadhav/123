# BARCODR Studio — spec

AzureLabel-style single-window barcode label designer (light theme). Multiple saved label templates per brand; print batches from Google Sheets / CSV / Excel.

## Data model (Mongo)
- `templates`: {id, name, brand, width_mm, height_mm, background, elements[], source_id (remembered print-data sheet), created_at, updated_at}
  - element: {id, type: text|barcode|qrcode|rect|image, x,y,w,h (mm), content (static or `{{column}}`), font_family, font_size(pt), font_weight, italic, underline, strike, align, color, fill, stroke, stroke_width, radius, barcode_format: CODE128|CODE39|EAN13|UPC|ITF14, show_text, image_url, rotation}
- `sheet_sources`: {id, name, brand, url, template_id?, created_at}. url = Google/CSV link, "sample", or "upload:<id>"
- `sheet_uploads`: {id, name, columns, rows} for uploaded files
- `sheet_copies`: {source_id, columns, rows:[{id, cells, qty, selected, origin}], edited, updated_at} — editable in-app copy of a sheet; edits NEVER written to Google. origin = JSON signature of the original row (null = added in app). Print data in the designer comes from this copy.

## API (/api)
- templates: GET/POST /templates, GET/PUT/DELETE /templates/{id}, POST /templates/{id}/duplicate
- sources: GET/POST /sources, PUT/DELETE /sources/{id}
- POST /sheets/fetch {url} → {columns, rows, csv_url, name}. Google edit/share/publish links → CSV export (keeps gid). Private → 400 detail.
- POST /sheets/upload (multipart file .csv/.tsv/.xlsx) → created SheetSource[] (one per Excel tab, brand = tab name)

- GET /sheets/copy/{source_id} (creates from original on first call), PUT /sheets/copy/{source_id} {columns, rows}, POST /sheets/copy/{source_id}/refresh {mode: replace|merge} → {sheet, added}. merge keeps edits and appends original rows whose signature isn't known.

## UI — routes: `/data/:sourceId` Sheet Data page; everything else → designer (any path) `pages/Workspace.tsx`
- Toolbar: Preview, Print, Save, Undo, Redo, Label properties, Open label, New label, Create a copy.
- Label tabs (open labels persisted in localStorage `bc.openTabs`), close with x.
- Left: tool palette (text, barcode, qrcode, shape, line, image) → testids add-<key>-button; "Data fields" = sheet column headers (click inserts {{col}} into selected element or adds new text; drag onto label to place); Elements list.
- Center: canvas with mm rulers, drag/resize, zoom (-, fit, +). Canvas previews first ticked sheet row.
- Right: Inspector — Label properties when nothing selected (name, brand, size preset, w/h, colour); element props incl. B/I/U/S toggles, align, font, colours, barcode format, position, arrange, delete.
- Bottom: "Label print data" grid: Import (dialog: Google link Connect + upload CSV/Excel), sheet select (saved on label immediately as source_id), Refresh (links only), delete sheet, search, select-all, per-row checkbox + Print qty, per-row print, Preview, Print. Rows default all ticked, qty 1.
- Sheet Data page (`pages/SheetData.tsx`, opened by "Edit data" in the grid): click a cell to edit (Enter/Tab move, Esc cancel), edited cells highlighted yellow (tooltip shows original), app-added rows green bar; Add row, duplicate/delete row, per-row checkbox + Qty, select all, search, Refresh from Google (asks merge vs replace when edited), Reset to original. Auto-saves (debounced) via lib/useSheetCopy (shared react-query key ["copy", sourceId] with designer).
- New label dialog: starter gallery (blank, price, product, shelf, qr, shipping). Starter placeholders {{brand}},{{name}},{{price}},{{sku}},{{barcode}},{{location}},{{link}},{{address}} auto-map to columns by fuzzy name (contains match).
- Print preview dialog: paper (roll / A4 / Letter), margin, gap, summary, missing-fields warning, page navigation, Print. Print uses window.print with only .print-root visible.
- Shortcuts: Ctrl+S, Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z, Delete, arrows (Shift = 5mm).

## Seed (backend/seed.py, idempotent)
- Templates tpl-aura-hangtag, tpl-nordic-jar, tpl-omni-bin; source src-sample "Sample multi-brand sheet" (url "sample", 9 rows: brand_name, sku, product_title, barcode_value, price, batch_no, qr_url)

No auth.
