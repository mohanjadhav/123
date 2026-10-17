import csv
import io
import re
from typing import List

import uuid
from pathlib import PurePath
from urllib.parse import unquote

import httpx
import openpyxl
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from lib.db import db
import json
from datetime import datetime, timezone

from models.labels import (
    CopyRefreshRequest, CopyRefreshResult, CopyRow, SheetCopy, SheetCopyUpdate,
    SheetData, SheetFetchRequest, SheetSource, SheetSourceCreate,
)

router = APIRouter(tags=["sheets"])

SAMPLE_COLUMNS = ["brand_name", "sku", "product_title", "barcode_value", "price", "batch_no", "qr_url"]
SAMPLE_ROWS = [
    ["AURA Studio", "AUR-TS-001", "Linen Overshirt — Sand", "123456789012", "$89.00", "B24-07", "https://aura.example/p/001"],
    ["AURA Studio", "AUR-TS-002", "Merino Crew — Charcoal", "123456789029", "$120.00", "B24-07", "https://aura.example/p/002"],
    ["AURA Studio", "AUR-TS-003", "Wide Trouser — Ink", "123456789036", "$140.00", "B24-08", "https://aura.example/p/003"],
    ["Nordic Hearth Roastery", "NHR-ETH-250", "Ethiopia Guji 250g", "590123412345", "$18.50", "R-1102", "https://nordichearth.example/brew/eth"],
    ["Nordic Hearth Roastery", "NHR-COL-250", "Colombia Huila 250g", "590123412352", "$17.00", "R-1103", "https://nordichearth.example/brew/col"],
    ["Nordic Hearth Roastery", "NHR-KEN-250", "Kenya Nyeri 250g", "590123412369", "$21.00", "R-1104", "https://nordichearth.example/brew/ken"],
    ["OmniParts Depot", "OPD-A12-B04", "M6 Hex Bolt x100", "OPD00001204", "$6.40", "W-33", "https://omniparts.example/bin/a12b04"],
    ["OmniParts Depot", "OPD-A12-B05", "M8 Washer x200", "OPD00001205", "$4.10", "W-33", "https://omniparts.example/bin/a12b05"],
    ["OmniParts Depot", "OPD-C03-B11", "Cable Tie 200mm x500", "OPD00003011", "$9.90", "W-34", "https://omniparts.example/bin/c03b11"],
]


def to_csv_url(url: str) -> str:
    url = url.strip()
    if "docs.google.com/spreadsheets" not in url:
        return url  # assume direct CSV link
    gid_match = re.search(r"[#&?]gid=(\d+)", url)
    gid = gid_match.group(1) if gid_match else None
    if "/d/e/" in url:  # "Publish to web" links
        base = url.split("?")[0].split("#")[0]
        base = re.sub(r"/pub(html)?$", "/pub", base)
        if not base.endswith("/pub"):
            base = base.rstrip("/") + "/pub"
        return f"{base}?output=csv" + (f"&gid={gid}" if gid else "")
    id_match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url)
    if not id_match:
        raise HTTPException(status_code=400, detail="Could not read a Google Sheet ID from that URL")
    return f"https://docs.google.com/spreadsheets/d/{id_match.group(1)}/export?format=csv" + (
        f"&gid={gid}" if gid else ""
    )


def _cell(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))  # keep barcodes like 5901234123457 intact
    return str(v)


def parse_csv(text: str) -> tuple[List[str], List[dict[str, str]]]:
    return parse_table(list(csv.reader(io.StringIO(text.lstrip("\ufeff")))))


def parse_table(table: List[list]) -> tuple[List[str], List[dict[str, str]]]:
    all_rows = [[_cell(c) for c in r] for r in table]
    all_rows = [r for r in all_rows if any(c.strip() for c in r)]
    if not all_rows:
        return [], []
    raw_headers = all_rows[0]
    columns: List[str] = []
    for i, h in enumerate(raw_headers):
        name = h.strip() or f"column_{i + 1}"
        while name in columns:
            name += "_"
        columns.append(name)
    rows = [{c: (r[i].strip() if i < len(r) else "") for i, c in enumerate(columns)} for r in all_rows[1:]]
    return columns, rows


@router.post("/sheets/fetch", response_model=SheetData)
async def fetch_sheet(body: SheetFetchRequest):
    if body.url.strip() == "sample":
        return sample_sheet()
    if body.url.startswith("upload:"):
        doc = await db.sheet_uploads.find_one({"id": body.url[7:]}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Uploaded sheet not found")
        return SheetData(columns=doc["columns"], rows=doc["rows"], csv_url=body.url, name=doc["name"])
    csv_url = to_csv_url(body.url)
    if not csv_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Enter a full https:// Google Sheets or CSV URL")
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
            res = await client.get(csv_url)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach the sheet: {exc}") from exc
    content_type = res.headers.get("content-type", "")
    if res.status_code >= 400 or "text/html" in content_type:
        raise HTTPException(
            status_code=400,
            detail="Sheet is not publicly readable. Set sharing to 'Anyone with the link can view' or publish it to the web.",
        )
    columns, rows = parse_csv(res.text)
    if not columns:
        raise HTTPException(status_code=400, detail="The sheet is empty")
    return SheetData(columns=columns, rows=rows, csv_url=csv_url, name=_filename(res.headers.get("content-disposition", "")))


def _filename(disposition: str) -> str:
    m = re.search(r"filename\*=UTF-8''([^;]+)", disposition) or re.search(r'filename="?([^";]+)"?', disposition)
    return PurePath(unquote(m.group(1))).stem if m else ""


@router.post("/sheets/upload", response_model=List[SheetSource], status_code=201)
async def upload_sheet(file: UploadFile = File(...)):
    """CSV or Excel upload. Every non-empty Excel tab becomes its own saved sheet (one per brand)."""
    raw = await file.read()
    if len(raw) > 10_000_000:
        raise HTTPException(status_code=400, detail="File must be under 10 MB")
    fname = file.filename or "upload"
    stem = PurePath(fname).stem
    tables: List[tuple[str, List[list]]] = []
    if fname.lower().endswith((".xlsx", ".xlsm")):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Could not read that Excel file") from exc
        tables = [(ws.title, [list(r) for r in ws.iter_rows(values_only=True)]) for ws in wb.worksheets]
    elif fname.lower().endswith((".csv", ".txt", ".tsv")):
        text = raw.decode("utf-8-sig", errors="replace")
        delim = "\t" if fname.lower().endswith(".tsv") else ","
        tables = [("", list(csv.reader(io.StringIO(text), delimiter=delim)))]
    else:
        raise HTTPException(status_code=400, detail="Upload a .csv or .xlsx file")
    created: List[SheetSource] = []
    multi = len(tables) > 1
    batch = f"upload:{uuid.uuid4()}"
    for tab, table in tables:
        columns, rows = parse_table(table)
        if not columns:
            continue
        upload_id = str(uuid.uuid4())
        name = f"{stem} — {tab}" if multi else stem
        await db.sheet_uploads.insert_one({"id": upload_id, "name": name, "columns": columns, "rows": rows})
        src = SheetSource(name=name, brand=tab if multi else "General", url=f"upload:{upload_id}",
                          workbook=batch, workbook_name=stem, tab=tab or stem, tab_index=len(created))
        await db.sheet_sources.insert_one(src.model_dump())
        created.append(src)
    if not created:
        raise HTTPException(status_code=400, detail="The file has no data rows")
    return created


@router.get("/sheets/sample", response_model=SheetData)
def sample_sheet():
    rows = [dict(zip(SAMPLE_COLUMNS, r)) for r in SAMPLE_ROWS]
    return SheetData(columns=SAMPLE_COLUMNS, rows=rows, csv_url="sample", name="Sample multi-brand sheet")


@router.get("/sources", response_model=List[SheetSource])
async def list_sources():
    docs = await db.sheet_sources.find({}, {"_id": 0}).sort([("created_at", -1), ("tab_index", 1)]).to_list(1000)
    return [SheetSource(**d) for d in docs]


@router.post("/sources", response_model=SheetSource, status_code=201)
async def create_source(body: SheetSourceCreate):
    src = SheetSource(**body.model_dump())
    await db.sheet_sources.insert_one(src.model_dump())
    return src


@router.put("/sources/{id}", response_model=SheetSource)
async def update_source(id: str, body: SheetSourceCreate):
    existing = await db.sheet_sources.find_one({"id": id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Source not found")
    keep = {k: existing.get(k) for k in ("workbook", "workbook_name", "tab", "tab_index") if existing.get(k) is not None}
    src = SheetSource(**body.model_dump(), id=id, created_at=existing["created_at"], **keep)
    await db.sheet_sources.replace_one({"id": id}, src.model_dump())
    return src


@router.delete("/sources/{id}", status_code=204)
async def delete_source(id: str):
    doc = await db.sheet_sources.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Source not found")
    await db.sheet_sources.delete_one({"id": id})
    await db.sheet_copies.delete_one({"source_id": id})
    if doc["url"].startswith("upload:"):
        await db.sheet_uploads.delete_one({"id": doc["url"][7:]})


# ---- Editable in-app copy of a sheet. Edits never touch the original Google Sheet / file.

def _sig(cells: dict) -> str:
    return json.dumps(cells, sort_keys=True, ensure_ascii=False)


async def _original(source_id: str) -> SheetData:
    src = await db.sheet_sources.find_one({"id": source_id}, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return await fetch_sheet(SheetFetchRequest(url=src["url"]))


def _fresh_copy(source_id: str, data: SheetData) -> SheetCopy:
    rows = [CopyRow(cells=r, origin=_sig(r)) for r in data.rows]
    return SheetCopy(source_id=source_id, columns=data.columns, rows=rows)


async def _store(copy: SheetCopy) -> SheetCopy:
    await db.sheet_copies.replace_one({"source_id": copy.source_id}, copy.model_dump(), upsert=True)
    return copy


@router.get("/sheets/copy/{source_id}", response_model=SheetCopy)
async def get_copy(source_id: str):
    doc = await db.sheet_copies.find_one({"source_id": source_id}, {"_id": 0})
    if doc:
        return SheetCopy(**doc)
    return await _store(_fresh_copy(source_id, await _original(source_id)))


@router.put("/sheets/copy/{source_id}", response_model=SheetCopy)
async def save_copy(source_id: str, body: SheetCopyUpdate):
    if not await db.sheet_sources.find_one({"id": source_id}):
        raise HTTPException(status_code=404, detail="Sheet not found")
    edited = any(r.origin is None or r.origin != _sig(r.cells) for r in body.rows)
    prev = await db.sheet_copies.find_one({"source_id": source_id}, {"_id": 0, "rows.origin": 1})
    if prev and len(prev.get("rows", [])) != len(body.rows):
        edited = True
    copy = SheetCopy(source_id=source_id, columns=body.columns, rows=body.rows, qty_column=body.qty_column,
                     edited=edited, updated_at=datetime.now(timezone.utc))
    return await _store(copy)


@router.post("/sheets/copy/{source_id}/refresh", response_model=CopyRefreshResult)
async def refresh_copy(source_id: str, body: CopyRefreshRequest):
    data = await _original(source_id)
    doc = await db.sheet_copies.find_one({"source_id": source_id}, {"_id": 0})
    if body.mode == "replace" or not doc:
        fresh = _fresh_copy(source_id, data)
        qc = (doc or {}).get("qty_column")
        fresh.qty_column = qc if qc in fresh.columns else None  # keep the quantity-column setting
        copy = await _store(fresh)
        return CopyRefreshResult(sheet=copy, added=len(copy.rows))
    current = SheetCopy(**doc)
    known = {r.origin for r in current.rows if r.origin}
    new_rows = [CopyRow(cells=r, origin=_sig(r)) for r in data.rows if _sig(r) not in known]
    columns = current.columns + [c for c in data.columns if c not in current.columns]
    copy = SheetCopy(source_id=source_id, columns=columns, rows=current.rows + new_rows, qty_column=current.qty_column,
                     edited=current.edited, updated_at=datetime.now(timezone.utc))
    return CopyRefreshResult(sheet=await _store(copy), added=len(new_rows))


# ---- Google Sheets tabs (one spreadsheet, many brand tabs)

class SheetTab(BaseModel):
    name: str
    gid: str
    url: str


def _google_id(url: str) -> str | None:
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url)
    return m.group(1) if m and "/d/e/" not in url else None


def _gid(url: str) -> str | None:
    m = re.search(r"[#&?]gid=(\d+)", url)
    return m.group(1) if m else None


async def google_tabs(sheet_id: str) -> List[SheetTab]:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
            res = await client.get(f"https://docs.google.com/spreadsheets/d/{sheet_id}/htmlview")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Google Sheets: {exc}") from exc
    items = re.findall(r'items\.push\(\{name:\s*"((?:[^"\\]|\\.)*)",\s*pageUrl:[^}]*?gid:\s*"(\d+)"', res.text)
    tabs: List[SheetTab] = []
    for raw, gid in items:
        name = json.loads(f'"{raw}"')  # unescape \uXXXX / \" sequences
        tabs.append(SheetTab(name=name, gid=gid, url=f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit#gid={gid}"))
    return tabs


@router.post("/sheets/tabs", response_model=List[SheetTab])
async def list_tabs(body: SheetFetchRequest):
    sheet_id = _google_id(body.url)
    if not sheet_id:
        raise HTTPException(status_code=400, detail="Not a Google Sheets link")
    return await google_tabs(sheet_id)


@router.post("/sources/{id}/sync-tabs", response_model=List[SheetSource])
async def sync_tabs(id: str):
    """Make every tab of this source's Google spreadsheet a saved sheet; returns all tabs in order."""
    doc = await db.sheet_sources.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Source not found")
    src = SheetSource(**doc)
    sheet_id = _google_id(src.url)
    if not sheet_id:
        if src.workbook:  # uploads are grouped at upload time
            docs = await db.sheet_sources.find({"workbook": src.workbook}, {"_id": 0}).sort("tab_index", 1).to_list(200)
            return [SheetSource(**d) for d in docs]
        return [src]
    tabs = await google_tabs(sheet_id)
    if not tabs:
        return [src]
    workbook = f"google:{sheet_id}"
    wb_name = src.workbook_name
    if not wb_name:
        try:
            data = await fetch_sheet(SheetFetchRequest(url=src.url))
            first = next((t for t in tabs if t.gid == _gid(src.url)), tabs[0])
            wb_name = re.sub(rf"\s*-\s*{re.escape(first.name)}$", "", data.name) or data.name or "Google Sheet"
        except HTTPException:
            wb_name = "Google Sheet"
    existing = await db.sheet_sources.find({"$or": [{"workbook": workbook}, {"url": {"$regex": re.escape(sheet_id)}}]}, {"_id": 0}).to_list(500)
    by_gid = {(_gid(e["url"]) or "0"): e for e in existing}
    out: List[SheetSource] = []
    for i, tab in enumerate(tabs):
        meta = {"workbook": workbook, "workbook_name": wb_name, "tab": tab.name, "tab_index": i}
        hit = by_gid.get(tab.gid)
        if hit:
            await db.sheet_sources.update_one({"id": hit["id"]}, {"$set": {**meta, "name": f"{wb_name} — {tab.name}"}})
            out.append(SheetSource(**{**hit, **meta, "name": f"{wb_name} — {tab.name}"}))
        else:
            new = SheetSource(name=f"{wb_name} — {tab.name}", brand=tab.name, url=tab.url, template_id=src.template_id, **meta)
            await db.sheet_sources.insert_one(new.model_dump())
            out.append(new)
    return out
