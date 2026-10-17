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

from lib.db import db
from models.labels import SheetData, SheetFetchRequest, SheetSource, SheetSourceCreate

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
    for tab, table in tables:
        columns, rows = parse_table(table)
        if not columns:
            continue
        upload_id = str(uuid.uuid4())
        name = f"{stem} — {tab}" if multi else stem
        await db.sheet_uploads.insert_one({"id": upload_id, "name": name, "columns": columns, "rows": rows})
        src = SheetSource(name=name, brand=tab if multi else "General", url=f"upload:{upload_id}")
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
    docs = await db.sheet_sources.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
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
    src = SheetSource(**body.model_dump(), id=id, created_at=existing["created_at"])
    await db.sheet_sources.replace_one({"id": id}, src.model_dump())
    return src


@router.delete("/sources/{id}", status_code=204)
async def delete_source(id: str):
    doc = await db.sheet_sources.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Source not found")
    await db.sheet_sources.delete_one({"id": id})
    if doc["url"].startswith("upload:"):
        await db.sheet_uploads.delete_one({"id": doc["url"][7:]})
