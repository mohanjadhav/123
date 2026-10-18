from fastapi import APIRouter

from lib.db import db
from models.workspace import WorkspaceState

router = APIRouter()
KEY = {"_id": "workspace"}


@router.get("/workspace/state", response_model=WorkspaceState)
async def get_state():
    doc = await db.app_state.find_one(KEY, {"_id": 0})
    return WorkspaceState(**(doc or {}))


@router.put("/workspace/state", response_model=WorkspaceState)
async def put_state(body: WorkspaceState):
    await db.app_state.update_one(KEY, {"$set": body.model_dump()}, upsert=True)
    return body
