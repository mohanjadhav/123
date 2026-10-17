# BARCODR Studio — spec

Barcode/QR label designer with multiple saved templates per brand, printing batches from public Google Sheets.

## Data model (Mongo)
- `templates`: {id, name, brand, width_mm, height_mm, background, elements[], created_at, updated_at}
  - element: {id, type: text|barcode|qrcode|rect|image, x,y,w,h (mm), content (static or `{{column}}`), font_family, font_size(pt), font_weight, align, color, fill, stroke, stroke_width, radius, barcode_format: CODE128|CODE39|EAN13|UPC|ITF14, show_text, image_url (url, data URL or `{{column}}`), rotation}
- `sheet_sources`: {id, name, brand, url, template_id?, created_at} — saved Google Sheets (one per brand/tab).

## API (/api)
- templates: GET/POST /templates, GET/PUT/DELETE /templates/{id}, POST /templates/{id}/duplicate
- sources: GET/POST /sources, PUT/DELETE /sources/{id}
- POST /sheets/fetch {url} → {columns, rows, csv_url}. Converts Google Sheets edit/share/publish URLs (keeps gid) to CSV export; url "sample" returns built-in sample data. Private sheet → 400 with detail.
- GET /sheets/sample

## Pages
- `/` template library grouped/filtered by brand; create (size presets), duplicate, delete.
- `/editor/:id` drag/resize canvas (mm), add text/barcode/QR/shape/image, inspector, column chips binding from a saved sheet, live data preview with row nav, save (Ctrl+S).
- `/print?template=id` choose saved sheet or paste URL, template, field mapping (auto by name), filter by brand column + search, select rows, layout roll / A4 / Letter with margin/gap/copies, preview, Print selected or per-row single label print (window.print, @media print renders only .print-root).

## Seed (backend/seed.py, idempotent)
- Templates: tpl-aura-hangtag (AURA Studio), tpl-nordic-jar (Nordic Hearth Roastery), tpl-omni-bin (OmniParts Depot)
- Source: src-sample "Sample multi-brand sheet" (url "sample", 9 rows, columns brand_name, sku, product_title, barcode_value, price, batch_no, qr_url)

No auth.
