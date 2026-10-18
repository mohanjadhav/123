from typing import List

from fastapi import APIRouter, HTTPException

from lib.db import db
from models.labels import QueueJob, QueueJobCreate, QueueJobUpdate

router = APIRouter(tags=["queue"])


@router.get("/queue", response_model=List[QueueJob])
async def list_queue():
    docs = await db.print_queue.find({}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return [QueueJob(**d) for d in docs]


@router.post("/queue", response_model=QueueJob, status_code=201)
async def add_job(body: QueueJobCreate):
    tpl = await db.templates.find_one({"id": body.template_id}, {"_id": 0, "name": 1, "brand": 1})
    if not tpl:
        raise HTTPException(status_code=404, detail="Label not found")
    src = await db.sheet_sources.find_one({"id": body.source_id}, {"_id": 0, "name": 1}) if body.source_id else None
    job = QueueJob(template_id=body.template_id, template_name=tpl["name"], template_brand=tpl.get("brand", ""),
                   source_id=body.source_id, source_name=(src or {}).get("name", ""), items=body.items)
    await db.print_queue.insert_one(job.model_dump())
    return job


@router.patch("/queue/{id}", response_model=QueueJob)
async def update_job(id: str, body: QueueJobUpdate):
    patch = body.model_dump(exclude_none=True)
    if patch:
        await db.print_queue.update_one({"id": id}, {"$set": patch})
    doc = await db.print_queue.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    return QueueJob(**doc)


@router.delete("/queue/{id}", status_code=204)
async def delete_job(id: str):
    res = await db.print_queue.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")


@router.post("/queue/remove", status_code=204)
async def remove_jobs(ids: List[str]):
    """Remove several jobs (e.g. the ones just printed); empty list clears the whole queue."""
    await db.print_queue.delete_many({"id": {"$in": ids}} if ids else {})
