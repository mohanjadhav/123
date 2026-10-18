from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class PrintPart(BaseModel):
    template_id: str = ""
    template_name: str = ""
    source_id: Optional[str] = None
    source_name: str = ""  # sheet / brand tab name ("" = no sheet)
    labels: int = Field(ge=0)


class PrintLogCreate(BaseModel):
    origin: Literal["designer", "sheet", "queue"]
    parts: List[PrintPart] = Field(min_length=1)
    tz: str = "UTC"  # browser time zone, so "today" is the user's day


class PrintLog(BaseModel):
    id: str
    created_at: datetime
    day: str  # YYYY-MM-DD in the user's time zone
    origin: str
    labels: int
    parts: List[PrintPart]


class DayCount(BaseModel):
    day: str
    labels: int


class NameCount(BaseModel):
    name: str
    labels: int
    prints: int


class HistorySummary(BaseModel):
    today: str
    today_labels: int
    week_labels: int  # last 7 days incl. today
    total_labels: int
    by_day: List[DayCount]  # zero-filled, oldest -> newest
    by_sheet: List[NameCount]  # within range_days
    by_label: List[NameCount]
    recent: List[PrintLog]


class BarcodeReserve(BaseModel):
    kind: Literal["serial", "ean13"]
    prefix: str = Field(default="", max_length=20)  # serial: any text; ean13: GS1 company prefix digits
    count: int = Field(ge=1, le=10000)
    digits: int = Field(default=6, ge=1, le=12)  # serial: zero-padded width
    start: Optional[int] = Field(default=None, ge=0)  # override the remembered next number


class BarcodeCounter(BaseModel):
    key: str  # "serial:HC-" or "ean13:890123"
    kind: str
    prefix: str
    next: int


class BarcodeBatch(BaseModel):
    values: List[str]
    next: int  # next number that will be used for this prefix
