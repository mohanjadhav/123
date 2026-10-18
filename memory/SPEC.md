# BARCODR Studio — spec

RAPID LABELS by MOHAN — AzureLabel-style single-window barcode label designer (light theme). Multiple saved label templates per brand; print batches from Google Sheets / CSV / Excel.

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

## HD design elements (latest)
- Element types: text, barcode, qrcode, rect (with `shape`: rect | ellipse | triangle | star | arrow | diamond | hexagon), line (horizontal, any direction via free `rotation`; `arrows` none/end/both), icon (`icon` key from `lib/icons.tsx`: veg/non-veg marks, packaging, safety, contact, badges), table (`table_rows` × `table_cols`, `content` = one line per row, cells split by `|`, {{fields}} allowed, `table_header` bold+fill row), image (`image_fit` contain/cover/fill).
- Styling on elements: fill + gradient (`fill2`, `gradient_angle`), border colour/width/`stroke_style` solid/dashed/dotted, corner radius, `opacity`, free `rotation` (float), to front/back. Shapes/lines/icons are SVG drawn in mm units (crisp at any DPI).
- Template: `background_image` (library URL, link or {{column}}), `background_fit`, `background_opacity`.
- Image library: `/api/images` (POST multipart `files`, GET list, GET `/{id}/file` raw bytes at original resolution, DELETE). Mongo collection `images` (bytes in `data`). Max 10 MB, image/* only. UI: `components/workspace/ImageLibrary.tsx`; left palette tools Image / Logo / Background open it; Inspector "Change image" and "Background picture" too.
- Page setup `dpi` (0 | 203 | 300 | 600): barcode bar modules snapped to whole printer dots (`Codes.tsx` snapWidth).

## Run on GitHub (Codespaces)
- `.devcontainer/` (python 3.11 + node 22 + mongo:7 via compose, app shares db network → localhost:27017). `setup.sh` (postCreate): installs deps (skips emergentintegrations), writes backend/.env, runs seed.py + import_seed_data.py. `start.sh` (postStart): uvicorn :8001 + vite :3000. User guide: `RUN_ON_GITHUB.md`.
- `backend/seed_data/labels.json` = export of templates (+ referenced library images); `import_seed_data.py` inserts missing by id (idempotent). Re-export if labels change before pushing.

## Windows desktop app (installer built by GitHub Actions)
- `desktop/launcher.py`: starts bundled mongod (127.0.0.1:47812, data %LOCALAPPDATA%\RapidLabels\db, reuses an orphaned one), imports backend `server.app`, mounts the built React app (`frontend_dist`) at "/" AFTER the /api routes (SPA fallback to index.html), seeds (seed.py + import_seed_data.py) on the uvicorn loop, serves 127.0.0.1:47811, opens a pywebview (WebView2) window; `--browser` opens default browser + small "running" window; `--serve-only` for smoke tests. Second launch reuses the running server.
- `desktop/rapid_labels.spec` (PyInstaller onedir, windowed), `desktop/installer.iss` (Inno Setup, per-user, Start menu + desktop + "open in browser" shortcut), `desktop/requirements.txt` (pins MUST match backend/requirements.txt), `desktop/icon.ico`.
- `.github/workflows/windows-installer.yml`: on push to main + manual → yarn build → pip → download MongoDB 7.0.14 → pyinstaller → smoke test (--serve-only, API + index) → iscc → artifact + GitHub Release v1.0.<run>.
- `backend/export_seed_data.py` refreshes `seed_data/labels.json` from the DB.
- Never `pip install -r desktop/requirements.txt` in the Emergent pod (pyinstaller/pywebview are Windows build-only).

## Backup/Restore, Updates, Align & Snap (latest)
- `GET /api/backup` → `.rlbackup` JSON file (format "rapid-labels-backup", collections templates, sheet_sources, sheet_copies (key source_id), sheet_uploads, print_queue, images; bytes as {"$b64"}, datetimes as {"$dt"}). `POST /api/backup/restore` (multipart `file`) MERGES via upsert on the key → RestoreResult {restored, total}; non-backup file → 400.
- `GET /api/app/info` {version (env APP_VERSION, "web" on Emergent), desktop, update_repo}; `GET/PUT /api/app/settings` {update_repo "owner/repo", accepts github URLs, invalid → 400; stored in `settings` collection id "app"}; `GET /api/app/update-check` → GitHub releases/latest compare (update_available only on desktop). Desktop build writes app.json {version 1.0.<run>, repo github.repository} → launcher sets APP_VERSION/APP_REPO.
- UI: toolbar cog "Settings & backup" → `components/SettingsDialog.tsx`; `UpdateBanner` under the toolbar (desktop only, dismiss per version).
- Canvas multi-select (`selectedIds` in Workspace): Shift/Ctrl+click toggle, drag box on empty label, Ctrl+A, Esc; group drag; arrows/Delete apply to all. Snap (footer toggle, localStorage rl.snap; Alt = no snap) to label edges/centre + other elements' edges/centres, pink guides; resize snaps right/bottom edge. `lib/align.ts`: alignEls (1 element → label, many → group box), distributeEls (3+), snapBox, snapEdge. Inspector: multi panel (align/space/arrange/duplicate/delete all) + "Align on label" for one element.

## Print history & barcode generator (latest)
- Every Print click (designer `runPrint`, Sheet Data, Print Queue) → `useRecordPrint()` (lib/history.ts) → `POST /api/history` {origin, parts[{template_id/name, source_id/name, labels}], tz}; toast "Undo count" → `DELETE /api/history/{id}`; `DELETE /api/history/last`. Day is computed server-side in the browser's tz. `GET /api/history/summary?tz&days=14&range_days` → today/week/total, zero-filled by_day, by_sheet, by_label, recent. Page `/history` (pages/History.tsx); toolbar badge "Today: N" (testid today-printed-badge). Collection `print_history`.
- Barcode generator (Sheet Data → "Generate barcodes", components/workspace/BarcodeGenerator.tsx): serial (prefix + zero-padded number) or EAN-13 (GS1 company prefix 3–11 digits + item number + check digit). Fills ONLY empty cells of a chosen or new column in the app's sheet copy (never the Google Sheet); optional only-ticked rows. `POST /api/barcodes/reserve` {kind, prefix, count, digits, start?} atomically hands out numbers and remembers next per `kind:prefix` (collection `barcode_counters`, starts at 1); `GET /api/barcodes/counters`. Both collections are included in backups.
- Duplicate barcode check (components/workspace/DuplicateGuard.tsx): before Print in designer + Sheet Data, `barcodeColumns()` = columns used by the label's barcode/QR placeholders (via mapping), else columns named barcode/ean/gtin/upc; `findDuplicates()` flags values in 2+ rows where ≥1 row is being printed (ticked, or the single row). Dialog "Cancel — let me fix it" / "Print anyway". Copies of one row (qty) are not duplicates. Print Queue is not checked.
- Designer print-data grid also has "Generate barcodes" (grid-generate-barcodes-button) → same BarcodeGenerator on the shared sheet copy.
- Duplicate highlighting: `duplicateCells(rows, barcodeColumns(...))` → red cells (data-duplicate attr, tooltip) in designer DataGrid (`dupCells` prop) and Sheet Data, plus "⚠ N duplicate barcodes" chip (duplicate-count-chip). Updates live while editing.
- Print Queue: `findQueueDuplicates()` compares ticked items across all ticked jobs (each job's own template barcode columns/mapping); same guard dialog lists "Sheet (label) · row N".

## Free web hosting on Render (no password, by user choice)
- `render.yaml` (Blueprint, plan free, docker, dockerfilePath ./render/Dockerfile, context repo root, env MONGO_URL sync:false → user pastes MongoDB Atlas M0 link, DB_NAME rapid_labels, healthCheck /api/templates).
- `render/Dockerfile`: node:22 builds frontend → python:3.11-slim installs backend reqs (minus emergentintegrations) → CMD seed.py + import_seed_data.py + `uvicorn serve_web:app --port $PORT`. `backend/serve_web.py` mounts the React build (FRONTEND_DIST) at "/" after /api with SPA fallback. Dockerfile kept out of repo root so Emergent's deploy isn't affected. Guide: `RUN_ON_RENDER.md`.

## Open label & reopen last label (latest)
- Open label dialog (LabelDialogs.tsx OpenLabelDialog): "Start new" row = all STARTERS incl. Blank (one click → `starterToTemplate()` → create), then ONE flat grid of all saved labels (server order = most recently edited first), current one marked IN USE; search by name/brand; loading / error + Retry states; count "N labels saved".
- New labels (both dialogs) are linked to the sheet currently in use (`createLinked` → source_id = current source).
- Tabs persistence fix: Workspace waits for `templatesQ.isSuccess` before filtering/persisting `bc.openTabs` / `bc.activeTab` (previously the empty list during loading wiped them). On open: last active label + its linked sheet (template.source_id) reopen; if none survive, the most recently edited label opens.
- GET /api/templates skips (logs) invalid docs instead of failing the whole list; toasts show the server's error detail (apiErrorDetail handles FastAPI validation lists).
