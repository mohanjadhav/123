"""App version, settings, and the "new version available" check against GitHub Releases."""
import os
import re

import httpx
from fastapi import APIRouter

from lib.db import db
from models.backup import AppInfo, AppSettings, AppSettingsUpdate, UpdateCheck

router = APIRouter(prefix="/app", tags=["app"])
REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def _version() -> str:
    return os.environ.get("APP_VERSION", "web")


def _clean_repo(value: str) -> str:
    """Accept 'owner/repo' or any github.com URL and return 'owner/repo' ('' if invalid)."""
    v = value.strip().removesuffix(".git").strip("/")
    m = re.search(r"github\.com[/:]([^/\s]+/[^/\s#?]+)", v)
    v = m.group(1) if m else v
    return v if REPO_RE.match(v) else ""


async def _settings() -> AppSettings:
    doc = await db.settings.find_one({"id": "app"}, {"_id": 0, "id": 0})
    return AppSettings(**(doc or {}))


async def _repo() -> str:
    return (await _settings()).update_repo or _clean_repo(os.environ.get("APP_REPO", ""))


def _ver_tuple(v: str) -> tuple[int, ...]:
    return tuple(int(x) for x in re.findall(r"\d+", v)[:4]) or (0,)


@router.get("/info", response_model=AppInfo)
async def app_info():
    return AppInfo(version=_version(), desktop=_version() != "web", update_repo=await _repo())


@router.get("/settings", response_model=AppSettings)
async def get_settings():
    return await _settings()


@router.put("/settings", response_model=AppSettings)
async def put_settings(body: AppSettingsUpdate):
    repo = _clean_repo(body.update_repo) if body.update_repo.strip() else ""
    if body.update_repo.strip() and not repo:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Enter the GitHub address like  owner/repo  or  https://github.com/owner/repo")
    s = AppSettings(update_repo=repo)
    await db.settings.replace_one({"id": "app"}, {"id": "app", **s.model_dump()}, upsert=True)
    return s


@router.get("/update-check", response_model=UpdateCheck)
async def update_check():
    current = _version()
    repo = await _repo()
    if not repo:
        return UpdateCheck(current=current, error="Add your GitHub repository in Settings to check for updates")
    try:
        async with httpx.AsyncClient(timeout=8, headers={"Accept": "application/vnd.github+json", "User-Agent": "RapidLabels"}) as c:
            r = await c.get(f"https://api.github.com/repos/{repo}/releases/latest")
    except httpx.HTTPError:
        return UpdateCheck(current=current, error="No internet connection — could not check for updates")
    if r.status_code == 404:
        return UpdateCheck(current=current, error=f"No installer published yet for {repo} (or the repository is private)")
    if r.status_code != 200:
        return UpdateCheck(current=current, error=f"GitHub did not answer (HTTP {r.status_code}) — try again later")
    rel = r.json()
    latest = str(rel.get("tag_name") or "").lstrip("v")
    asset = next((a.get("browser_download_url") for a in rel.get("assets", []) if str(a.get("name", "")).lower().endswith(".exe")), None)
    newer = current != "web" and bool(latest) and _ver_tuple(latest) > _ver_tuple(current)
    return UpdateCheck(current=current, latest=latest or None, update_available=newer, release_url=rel.get("html_url"),
                       download_url=asset, notes=str(rel.get("body") or "")[:2000])
