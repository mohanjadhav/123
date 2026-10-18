"""Image library: logos / backgrounds / pictures kept at original resolution for sharp printing."""
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, File, HTTPException, Response, UploadFile

from lib.db import db
from models.images import ImageAsset

router = APIRouter(prefix="/images", tags=["images"])
MAX_BYTES = 10 * 1024 * 1024
META = {"_id": 0, "data": 0}


def _asset(doc: dict) -> ImageAsset:
    return ImageAsset(**doc, url=f"/api/images/{doc['id']}/file")


@router.get("", response_model=List[ImageAsset])
async def list_images():
    docs = await db.images.find({}, META).sort("created_at", -1).to_list(500)
    return [_asset(d) for d in docs]


@router.post("", response_model=List[ImageAsset])
async def upload_images(files: List[UploadFile] = File(...)):
    out: List[ImageAsset] = []
    for f in files:
        ctype = (f.content_type or "").lower()
        if not ctype.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"{f.filename}: not an image file")
        raw = await f.read()
        if not raw:
            raise HTTPException(status_code=400, detail=f"{f.filename}: empty file")
        if len(raw) > MAX_BYTES:
            raise HTTPException(status_code=400, detail=f"{f.filename}: larger than 10 MB")
        doc = {"id": str(uuid.uuid4()), "name": f.filename or "image", "content_type": ctype, "size": len(raw),
               "created_at": datetime.now(timezone.utc)}
        await db.images.insert_one({**doc, "data": raw})
        out.append(_asset(doc))
    return out


@router.get("/{image_id}/file")
async def image_file(image_id: str):
    doc = await db.images.find_one({"id": image_id}, {"_id": 0, "data": 1, "content_type": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Image not found")
    return Response(content=bytes(doc["data"]), media_type=doc["content_type"],
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.delete("/{image_id}")
async def delete_image(image_id: str):
    res = await db.images.delete_one({"id": image_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"deleted": image_id}
