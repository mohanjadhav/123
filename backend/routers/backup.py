"""Backup & Restore: every label, sheet (+ in-app edits), print-queue job and library image in ONE file.
Restore MERGES: items with the same id are replaced by the backup copy, everything else is added."""
import base64
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, File, HTTPException, Response, UploadFile

from datetime import timezone
from lib.db import db
from models.backup import RestoreResult

router = APIRouter(prefix="/backup", tags=["backup"])

# collection -> field that identifies the same item on another laptop
COLLECTIONS = {
    "templates": "id",
    "sheet_sources": "id",
    "sheet_copies": "source_id",
    "sheet_uploads": "id",
    "print_queue": "id",
    "images": "id",
    "print_history": "id",
    "barcode_counters": "key",
}
FORMAT = "rapid-labels-backup"


def _enc(v: Any) -> Any:
    if isinstance(v, (bytes, bytearray)):
        return {"$b64": base64.b64encode(bytes(v)).decode()}
    if isinstance(v, datetime):
        return {"$dt": v.isoformat()}
    if isinstance(v, dict):
        return {k: _enc(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_enc(x) for x in v]
    return v


def _dec(v: Any) -> Any:
    if isinstance(v, dict):
        if set(v) == {"$b64"}:
            return base64.b64decode(v["$b64"])
        if set(v) == {"$dt"}:
            return datetime.fromisoformat(v["$dt"])
        return {k: _dec(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_dec(x) for x in v]
    return v


@router.get("")
async def download_backup():
    data = {name: [_enc(d) for d in await db[name].find({}, {"_id": 0}).to_list(None)] for name in COLLECTIONS}
    stamp = datetime.now(timezone.utc)
    body = json.dumps({"format": FORMAT, "version": 1, "created_at": stamp.isoformat(), "collections": data}, ensure_ascii=False)
    fname = f"RapidLabels-backup-{stamp.strftime('%Y-%m-%d-%H%M')}.rlbackup"
    return Response(content=body, media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.post("/restore", response_model=RestoreResult)
async def restore_backup(file: UploadFile = File(...)):
    try:
        payload = json.loads((await file.read()).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="That file is not a RAPID LABELS backup") from exc
    if not isinstance(payload, dict) or payload.get("format") != FORMAT or not isinstance(payload.get("collections"), dict):
        raise HTTPException(status_code=400, detail="That file is not a RAPID LABELS backup")
    restored: dict[str, int] = {}
    for name, key in COLLECTIONS.items():
        docs = payload["collections"].get(name) or []
        n = 0
        for raw in docs:
            doc = _dec(raw)
            if not isinstance(doc, dict) or key not in doc:
                continue
            doc.pop("_id", None)
            await db[name].replace_one({key: doc[key]}, doc, upsert=True)
            n += 1
        restored[name] = n
    return RestoreResult(restored=restored, total=sum(restored.values()))
