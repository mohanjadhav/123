import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

ElementType = Literal["text", "barcode", "qrcode", "rect", "image"]
BarcodeFormat = Literal["CODE128", "CODE39", "EAN13", "UPC", "ITF14"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class LabelElement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: ElementType
    x: float = 2  # all geometry in mm
    y: float = 2
    w: float = 30
    h: float = 8
    content: str = ""  # static text or {{column}} placeholders
    font_family: str = "IBM Plex Sans"
    font_size: float = 10  # pt
    font_weight: int = 500
    align: Literal["left", "center", "right"] = "left"
    color: str = "#0F0F10"
    fill: str = "transparent"
    stroke: str = "#0F0F10"
    stroke_width: float = 0
    radius: float = 0
    barcode_format: BarcodeFormat = "CODE128"
    show_text: bool = True
    image_url: str = ""
    rotation: int = 0


class TemplateBase(BaseModel):
    name: str = Field(min_length=1)
    brand: str = "General"
    width_mm: float = Field(gt=0, le=400)
    height_mm: float = Field(gt=0, le=400)
    background: str = "#FDFDFC"
    elements: List[LabelElement] = []


class Template(TemplateBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class SheetSourceCreate(BaseModel):
    name: str = Field(min_length=1)
    brand: str = "General"
    url: str = Field(min_length=1)
    template_id: Optional[str] = None


class SheetSource(SheetSourceCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=_now)


class SheetFetchRequest(BaseModel):
    url: str = Field(min_length=1)


class SheetData(BaseModel):
    columns: List[str]
    rows: List[dict[str, str]]
    csv_url: str
