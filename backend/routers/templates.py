from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException

from lib.db import db
from models.labels import Template, TemplateBase

router = APIRouter(tags=["templates"])


@router.get("/templates", response_model=List[Template])
async def list_templates():
    docs = await db.templates.find({}, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    return [Template(**d) for d in docs]


@router.get("/templates/{id}", response_model=Template)
async def get_template(id: str):
    doc = await db.templates.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    return Template(**doc)


@router.post("/templates", response_model=Template, status_code=201)
async def create_template(body: TemplateBase):
    tpl = Template(**body.model_dump())
    await db.templates.insert_one(tpl.model_dump())
    return tpl


@router.put("/templates/{id}", response_model=Template)
async def update_template(id: str, body: TemplateBase):
    existing = await db.templates.find_one({"id": id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    tpl = Template(**body.model_dump(), id=id, created_at=existing["created_at"],
                   updated_at=datetime.now(timezone.utc))
    await db.templates.replace_one({"id": id}, tpl.model_dump())
    return tpl


@router.post("/templates/{id}/duplicate", response_model=Template, status_code=201)
async def duplicate_template(id: str):
    doc = await db.templates.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    base = TemplateBase(**doc)
    base.name = f"{base.name} (copy)"
    tpl = Template(**base.model_dump())
    await db.templates.insert_one(tpl.model_dump())
    return tpl


@router.delete("/templates/{id}", status_code=204)
async def delete_template(id: str):
    res = await db.templates.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
