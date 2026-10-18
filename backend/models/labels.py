import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

ElementType = Literal["text", "barcode", "qrcode", "rect", "image", "line", "icon", "table"]
ShapeKind = Literal["rect", "ellipse", "triangle", "star", "arrow", "diamond", "hexagon"]
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
    italic: bool = False
    underline: bool = False
    strike: bool = False
    align: Literal["left", "center", "right"] = "left"
    color: str = "#0F0F10"
    fill: str = "transparent"
    stroke: str = "#0F0F10"
    stroke_width: float = 0
    radius: float = 0
    barcode_format: BarcodeFormat = "CODE128"
    show_text: bool = True
    image_url: str = ""
    rotation: float = 0  # degrees, any angle
    # high-definition design extras
    shape: ShapeKind = "rect"  # for type "rect"
    fill2: str = ""  # gradient end colour ("" = solid fill)
    gradient_angle: float = 90
    stroke_style: Literal["solid", "dashed", "dotted"] = "solid"
    opacity: float = Field(default=1, ge=0, le=1)
    arrows: Literal["none", "end", "both"] = "none"  # for type "line"
    icon: str = ""  # icon-library key for type "icon"
    image_fit: Literal["contain", "cover", "fill"] = "contain"
    table_rows: int = Field(default=3, ge=1, le=30)
    table_cols: int = Field(default=2, ge=1, le=12)
    table_header: bool = True


class PageSetup(BaseModel):
    """Printer page setup, saved per label. Geometry in mm."""
    paper: Literal["label", "a4", "letter", "custom"] = "label"  # "label" = roll: page sized to the label row
    paper_w: float = Field(default=210, gt=0, le=1000)
    paper_h: float = Field(default=297, gt=0, le=2000)
    orientation: Literal["portrait", "landscape"] = "portrait"
    cols: int = Field(default=0, ge=0, le=50)  # 0 = auto-fit (roll: 1)
    rows: int = Field(default=0, ge=0, le=100)  # 0 = auto-fit
    gap_x: float = Field(default=0, ge=0, le=100)
    gap_y: float = Field(default=0, ge=0, le=100)
    margin_top: float = Field(default=0, ge=0, le=100)
    margin_right: float = Field(default=0, ge=0, le=100)
    margin_bottom: float = Field(default=0, ge=0, le=100)
    margin_left: float = Field(default=0, ge=0, le=100)
    offset_x: float = Field(default=0, ge=-50, le=50)  # printer calibration shift
    offset_y: float = Field(default=0, ge=-50, le=50)
    order: Literal["across", "down"] = "across"
    start_position: int = Field(default=1, ge=1, le=1000)  # skip used labels on a partly used sheet
    dpi: int = Field(default=0, ge=0, le=1200)  # printer resolution; 0 = vector/any. 203/300/600 snaps barcode bars to printer dots


class TemplateBase(BaseModel):
    name: str = Field(min_length=1)
    brand: str = "General"
    width_mm: float = Field(gt=0, le=400)
    height_mm: float = Field(gt=0, le=400)
    background: str = "#FFFFFF"
    background_image: str = ""  # full-label background picture (library URL, link or {{column}})
    background_fit: Literal["cover", "contain", "fill"] = "cover"
    background_opacity: float = Field(default=1, ge=0, le=1)
    elements: List[LabelElement] = []
    source_id: Optional[str] = None  # remembered print-data sheet
    page_setup: PageSetup = Field(default_factory=PageSetup)


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
    workbook: Optional[str] = None  # groups tabs of one spreadsheet/file (Google sheet id or "upload:<batch>")
    workbook_name: Optional[str] = None
    tab: Optional[str] = None  # tab name inside the workbook
    tab_index: int = 0
    created_at: datetime = Field(default_factory=_now)


class SheetFetchRequest(BaseModel):
    url: str = Field(min_length=1)


class SheetData(BaseModel):
    columns: List[str]
    rows: List[dict[str, str]]
    csv_url: str
    name: str = ""


class CopyRow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cells: dict[str, str] = {}
    qty: int = Field(default=0, ge=0, le=9999)  # manual quantity (0 = not printed)
    selected: bool = False  # ticked only when the row has a quantity > 0
    origin: Optional[str] = None  # signature of the Google/original row it came from (None = added in app)


class SheetCopyUpdate(BaseModel):
    columns: List[str]
    rows: List[CopyRow]
    qty_column: Optional[str] = None  # read print quantity per row from this column (None = manual qty)


class SheetCopy(SheetCopyUpdate):
    source_id: str
    edited: bool = False
    updated_at: datetime = Field(default_factory=_now)


class CopyRefreshRequest(BaseModel):
    mode: Literal["replace", "merge"]


class CopyRefreshResult(BaseModel):
    sheet: SheetCopy
    added: int


class QueueItem(BaseModel):
    cells: dict[str, str]
    qty: int = Field(default=1, ge=1, le=9999)
    selected: bool = True


class QueueJobCreate(BaseModel):
    template_id: str
    source_id: Optional[str] = None
    items: List[QueueItem] = Field(min_length=1)


class QueueJobUpdate(BaseModel):
    selected: Optional[bool] = None
    items: Optional[List[QueueItem]] = None


class QueueJob(BaseModel):
    """A spooled print job: a snapshot of rows + quantities, printed later together with other jobs."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    template_id: str
    template_name: str
    template_brand: str
    source_id: Optional[str] = None
    source_name: str = ""
    items: List[QueueItem]
    selected: bool = True
    created_at: datetime = Field(default_factory=_now)
