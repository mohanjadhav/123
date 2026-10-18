"""Refresh seed_data/labels.json from the current database (labels + the library images they use).
Run before saving to GitHub so new installers / Codespaces include your latest labels:
    cd backend && python export_seed_data.py
"""
import asyncio
import base64
import json
import re
from pathlib import Path

from lib.db import db

OUT = Path(__file__).parent / "seed_data" / "labels.json"


async def main():
    tpls = await db.templates.find({}, {"_id": 0}).to_list(None)
    for t in tpls:
        t["source_id"] = None  # sheets are imported again on the new copy (kept private)
        for k in ("created_at", "updated_at"):
            if hasattr(t.get(k), "isoformat"):
                t[k] = t[k].isoformat()
    ids = set(re.findall(r"/api/images/([0-9a-f-]{36})/file", json.dumps(tpls)))
    imgs = []
    for d in await db.images.find({"id": {"$in": list(ids)}}, {"_id": 0}).to_list(None):
        d["data"] = base64.b64encode(bytes(d["data"])).decode()
        d["created_at"] = d["created_at"].isoformat()
        imgs.append(d)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"templates": tpls, "images": imgs}, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"exported {len(tpls)} labels, {len(imgs)} images -> {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
