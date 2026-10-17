"""Idempotent seed: sample brand templates + the built-in sample data source."""
import asyncio

from lib.db import db, ensure_indexes
from models.labels import LabelElement as E, SheetSource, Template

TEMPLATES = [
    Template(
        id="tpl-aura-hangtag", name="Apparel Hangtag", brand="AURA Studio", width_mm=50, height_mm=80,
        elements=[
            E(id="a1", type="text", x=4, y=5, w=42, h=9, content="AURA", font_family="Playfair Display",
              font_size=20, font_weight=700, align="center"),
            E(id="a2", type="rect", x=14, y=16, w=22, h=0.4, fill="#0F0F10"),
            E(id="a3", type="text", x=4, y=20, w=42, h=10, content="{{product_title}}", font_size=8.5, align="center"),
            E(id="a4", type="text", x=4, y=32, w=42, h=9, content="{{price}}", font_size=16, font_weight=700, align="center"),
            E(id="a5", type="text", x=4, y=43, w=42, h=5, content="SKU {{sku}}", font_family="IBM Plex Mono",
              font_size=7, align="center", color="#555A64"),
            E(id="a6", type="barcode", x=5, y=52, w=40, h=22, content="{{barcode_value}}"),
        ],
    ),
    Template(
        id="tpl-nordic-jar", name="Coffee Bag Label", brand="Nordic Hearth Roastery", width_mm=70, height_mm=50,
        background="#F3EBDD",
        elements=[
            E(id="n1", type="rect", x=2, y=2, w=66, h=46, stroke="#3B2A1A", stroke_width=0.5, radius=3),
            E(id="n2", type="text", x=5, y=5, w=40, h=6, content="NORDIC HEARTH", font_family="IBM Plex Mono",
              font_size=7, font_weight=600, color="#3B2A1A"),
            E(id="n3", type="text", x=5, y=12, w=40, h=14, content="{{product_title}}", font_family="Lora",
              font_size=13, font_weight=700, color="#3B2A1A"),
            E(id="n4", type="text", x=5, y=28, w=40, h=5, content="Batch {{batch_no}} · {{price}}", font_size=7, color="#3B2A1A"),
            E(id="n5", type="qrcode", x=48, y=5, w=17, h=17, content="{{qr_url}}"),
            E(id="n6", type="barcode", x=5, y=35, w=60, h=11, content="{{barcode_value}}", show_text=False),
        ],
    ),
    Template(
        id="tpl-omni-bin", name="Bin & Shelf Tag", brand="OmniParts Depot", width_mm=76, height_mm=25,
        elements=[
            E(id="o1", type="text", x=2, y=2, w=44, h=9, content="{{sku}}", font_family="IBM Plex Mono",
              font_size=14, font_weight=700),
            E(id="o2", type="text", x=2, y=11, w=44, h=5, content="{{product_title}}", font_size=7),
            E(id="o3", type="barcode", x=2, y=16, w=44, h=8, content="{{barcode_value}}", barcode_format="CODE39", show_text=False),
            E(id="o4", type="rect", x=48, y=2, w=26, h=21, fill="#0F0F10", radius=1.5),
            E(id="o5", type="text", x=48, y=8, w=26, h=9, content="{{batch_no}}", font_size=14, font_weight=700,
              color="#FDFDFC", align="center"),
        ],
    ),
]


async def main():
    await ensure_indexes()
    for t in TEMPLATES:
        if not await db.templates.find_one({"id": t.id}):
            await db.templates.insert_one(t.model_dump())
    if not await db.sheet_sources.find_one({"id": "src-sample"}):
        await db.sheet_sources.insert_one(
            SheetSource(id="src-sample", name="Sample multi-brand sheet", brand="All brands", url="sample").model_dump()
        )
    print("seeded")


if __name__ == "__main__":
    asyncio.run(main())
