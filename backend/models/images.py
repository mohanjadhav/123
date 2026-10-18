from datetime import datetime

from pydantic import BaseModel


class ImageAsset(BaseModel):
    """A reusable picture (logo, background, product photo) stored at full resolution."""
    id: str
    name: str
    content_type: str
    size: int  # bytes
    url: str  # relative /api URL usable directly in labels
    created_at: datetime
