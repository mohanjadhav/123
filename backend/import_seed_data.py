"""Load bundled labels (seed_data/labels.json) into an empty/new database. Safe to run many times."""
import asyncio
import base64
import json
from datetime import datetime
from pathlib import Path

from lib.db import db, ensure_indexes

DATA = Path(__file__).parent / "seed_data" / "labels.json"


def _dt(v):
    return datetime.fromisoformat(v) if isinstance(v, str) else v


async def main():
    await ensure_indexes()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    added = 0
    for t in data.get("templates", []):
        if not await db.templates.find_one({"id": t["id"]}):
            for k in ("created_at", "updated_at"):
                if k in t:
                    t[k] = _dt(t[k])
            await db.templates.insert_one(t)
            added += 1
    for img in data.get("images", []):
        if not await db.images.find_one({"id": img["id"]}):
            await db.images.insert_one({**img, "data": base64.b64decode(img["data"]), "created_at": _dt(img["created_at"])})
    print(f"labels ready ({added} added)")


if __name__ == "__main__":
    asyncio.run(main())
