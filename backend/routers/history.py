"""Print history (labels printed per day / sheet / label) and the barcode number generator."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException
from pymongo import ReturnDocument

from lib.db import db
from models.history import (
    BarcodeBatch, BarcodeCounter, BarcodeReserve, DayCount, HistorySummary, NameCount, PrintLog, PrintLogCreate,
)

router = APIRouter(tags=["history"])


def _zone(tz: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def _today(tz: str) -> datetime:
    return datetime.now(_zone(tz))


# ---------------- print history ----------------

@router.post("/history", response_model=PrintLog)
async def record_print(body: PrintLogCreate):
    parts = [p for p in body.parts if p.labels > 0]
    if not parts:
        raise HTTPException(status_code=400, detail="Nothing was printed")
    log = PrintLog(id=str(uuid.uuid4()), created_at=datetime.now(timezone.utc), day=_today(body.tz).strftime("%Y-%m-%d"),
                   origin=body.origin, labels=sum(p.labels for p in parts), parts=parts)
    await db.print_history.insert_one(log.model_dump())
    return log


@router.delete("/history/last", response_model=Optional[PrintLog])
async def undo_last():
    doc = await db.print_history.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not doc:
        raise HTTPException(status_code=404, detail="No print counts to undo")
    await db.print_history.delete_one({"id": doc["id"]})
    return PrintLog(**doc)


@router.delete("/history/{log_id}")
async def delete_log(log_id: str):
    res = await db.print_history.delete_one({"id": log_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Print count not found")
    return {"deleted": log_id}


@router.get("/history/summary", response_model=HistorySummary)
async def summary(tz: str = "UTC", days: int = 14, range_days: int = 30):
    days = max(1, min(days, 90))
    today = _today(tz).date()
    chart_days = [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]
    since_range = (today - timedelta(days=max(1, range_days) - 1)).isoformat() if range_days > 0 else "0000"
    week_from = (today - timedelta(days=6)).isoformat()

    per_day = {d["_id"]: d["labels"] async for d in db.print_history.aggregate([{"$group": {"_id": "$day", "labels": {"$sum": "$labels"}}}])}
    total = sum(per_day.values())

    async def by(field: str) -> List[NameCount]:
        rows = db.print_history.aggregate([
            {"$match": {"day": {"$gte": since_range}}},
            {"$unwind": "$parts"},
            {"$group": {"_id": f"$parts.{field}", "labels": {"$sum": "$parts.labels"}, "prints": {"$sum": 1}}},
            {"$sort": {"labels": -1}}, {"$limit": 50},
        ])
        return [NameCount(name=r["_id"] or "(no sheet)", labels=r["labels"], prints=r["prints"]) async for r in rows]

    recent = [PrintLog(**d) for d in await db.print_history.find({}, {"_id": 0}).sort("created_at", -1).to_list(25)]
    return HistorySummary(
        today=today.isoformat(), today_labels=per_day.get(today.isoformat(), 0),
        week_labels=sum(v for k, v in per_day.items() if k >= week_from), total_labels=total,
        by_day=[DayCount(day=d, labels=per_day.get(d, 0)) for d in chart_days],
        by_sheet=await by("source_name"), by_label=await by("template_name"), recent=recent,
    )


# ---------------- barcode numbers ----------------

def ean13_check(d12: str) -> str:
    s = sum(int(c) * (3 if i % 2 else 1) for i, c in enumerate(d12))
    return str((10 - s % 10) % 10)


@router.get("/barcodes/counters", response_model=List[BarcodeCounter])
async def counters():
    return [BarcodeCounter(**d) for d in await db.barcode_counters.find({}, {"_id": 0}).sort("key", 1).to_list(200)]


@router.post("/barcodes/reserve", response_model=BarcodeBatch)
async def reserve(body: BarcodeReserve):
    """Hand out `count` new numbers and remember where to continue — never the same number twice per prefix."""
    prefix = body.prefix.strip()
    if body.kind == "ean13":
        if not prefix.isdigit() or not 3 <= len(prefix) <= 11:
            raise HTTPException(status_code=400, detail="EAN-13 company prefix must be 3–11 digits (e.g. 890 + your GS1 company number)")
        width = 12 - len(prefix)
    else:
        width = body.digits
    key = f"{body.kind}:{prefix}"
    if body.start is not None:
        await db.barcode_counters.update_one({"key": key}, {"$set": {"next": body.start, "kind": body.kind, "prefix": prefix}}, upsert=True)
    doc = await db.barcode_counters.find_one_and_update(
        {"key": key}, {"$inc": {"next": body.count}, "$setOnInsert": {"kind": body.kind, "prefix": prefix}},
        upsert=True, return_document=ReturnDocument.AFTER, projection={"_id": 0},
    )
    if body.start is None and doc["next"] == body.count:  # brand-new counter starts at 1, not 0
        doc = await db.barcode_counters.find_one_and_update({"key": key}, {"$inc": {"next": 1}}, return_document=ReturnDocument.AFTER, projection={"_id": 0})
    first = doc["next"] - body.count
    if body.kind == "ean13" and doc["next"] - 1 >= 10 ** width:
        await db.barcode_counters.update_one({"key": key}, {"$inc": {"next": -body.count}})
        raise HTTPException(status_code=400, detail=f"Not enough EAN-13 item numbers left for prefix {prefix} (max {10 ** width - 1})")
    values = []
    for n in range(first, doc["next"]):
        if body.kind == "ean13":
            d12 = f"{prefix}{n:0{width}d}"
            values.append(d12 + ean13_check(d12))
        else:
            values.append(f"{prefix}{n:0{width}d}")
    return BarcodeBatch(values=values, next=doc["next"])
