from typing import Dict, Optional

from pydantic import BaseModel, Field


class RestoreResult(BaseModel):
    """Counts of items merged per collection (added or replaced by the backup copy)."""
    restored: Dict[str, int]
    total: int


class AppSettings(BaseModel):
    update_repo: str = ""  # GitHub "owner/repo" whose Releases publish RapidLabels-Setup.exe


class AppSettingsUpdate(BaseModel):
    update_repo: str = Field(default="", max_length=200)


class AppInfo(BaseModel):
    version: str  # e.g. "1.0.12"; "web" when not running the Windows app
    desktop: bool
    update_repo: str  # effective repo (saved setting, else the one baked in by the build)


class UpdateCheck(BaseModel):
    current: str
    latest: Optional[str] = None
    update_available: bool = False
    release_url: Optional[str] = None  # GitHub release page
    download_url: Optional[str] = None  # direct RapidLabels-Setup.exe link
    notes: str = ""
    error: Optional[str] = None  # friendly reason when the check could not run
