import { newElement } from "@/lib/label";
import type { LabelElement, TemplateBase } from "@/lib/types";

const BIG = { width_mm: 400, height_mm: 400 };
const el = (type: LabelElement["type"], p: Partial<LabelElement>): LabelElement => ({ ...newElement(type, BIG), ...p });

export interface Starter {
  key: string;
  title: string;
  description: string;
  tpl: Omit<TemplateBase, "name" | "brand" | "source_id" | "page_setup" | "background_image" | "background_fit" | "background_opacity" | "pinned">;
}

export const STARTERS: Starter[] = [
  {
    key: "blank",
    title: "Blank label",
    description: "Start from an empty canvas",
    tpl: { width_mm: 60, height_mm: 40, background: "#FFFFFF", elements: [] },
  },
  {
    key: "price",
    title: "Retail price tag",
    description: "Brand, name, big price, barcode",
    tpl: {
      width_mm: 60, height_mm: 40, background: "#FFFFFF",
      elements: [
        el("text", { x: 3, y: 2.5, w: 54, h: 5, content: "{{brand}}", font_size: 7, font_weight: 600, color: "#1A73E8" }),
        el("text", { x: 3, y: 7.5, w: 54, h: 9, content: "{{name}}", font_size: 10, font_weight: 700 }),
        el("text", { x: 3, y: 16.5, w: 30, h: 9, content: "{{price}}", font_size: 18, font_weight: 700, color: "#D93025" }),
        el("text", { x: 34, y: 18.5, w: 23, h: 5, content: "SKU {{sku}}", font_size: 6.5, align: "right", font_family: "IBM Plex Mono" }),
        el("barcode", { x: 3, y: 27, w: 54, h: 11, content: "{{barcode}}" }),
      ],
    },
  },
  {
    key: "product",
    title: "Product barcode",
    description: "Small sticker: name + barcode",
    tpl: {
      width_mm: 50, height_mm: 25, background: "#FFFFFF",
      elements: [
        el("text", { x: 2, y: 1.5, w: 46, h: 5, content: "{{name}}", font_size: 7.5, font_weight: 600, align: "center" }),
        el("barcode", { x: 3, y: 7, w: 44, h: 16, content: "{{barcode}}" }),
      ],
    },
  },
  {
    key: "shelf",
    title: "Shelf / bin tag",
    description: "Large SKU, description, location",
    tpl: {
      width_mm: 76, height_mm: 25, background: "#FFFFFF",
      elements: [
        el("text", { x: 2, y: 2, w: 46, h: 8, content: "{{sku}}", font_size: 14, font_weight: 700, font_family: "IBM Plex Mono" }),
        el("text", { x: 2, y: 10.5, w: 46, h: 5, content: "{{name}}", font_size: 7 }),
        el("barcode", { x: 2, y: 16, w: 46, h: 7.5, content: "{{barcode}}", show_text: false }),
        el("rect", { x: 50, y: 2, w: 24, h: 21, fill: "#111827", stroke_width: 0, radius: 1.5 }),
        el("text", { x: 50, y: 8.5, w: 24, h: 8, content: "{{location}}", font_size: 13, font_weight: 700, color: "#FFFFFF", align: "center" }),
      ],
    },
  },
  {
    key: "qr",
    title: "QR asset tag",
    description: "QR code with asset ID & owner",
    tpl: {
      width_mm: 50, height_mm: 30, background: "#FFFFFF",
      elements: [
        el("rect", { x: 1, y: 1, w: 48, h: 28, stroke: "#111827", stroke_width: 0.4, radius: 2 }),
        el("qrcode", { x: 3, y: 4, w: 22, h: 22, content: "{{link}}" }),
        el("text", { x: 27, y: 5, w: 21, h: 4, content: "ASSET", font_size: 6, font_weight: 600, color: "#6B7280" }),
        el("text", { x: 27, y: 9, w: 21, h: 8, content: "{{sku}}", font_size: 10, font_weight: 700, font_family: "IBM Plex Mono" }),
        el("text", { x: 27, y: 18, w: 21, h: 8, content: "{{brand}}", font_size: 7 }),
      ],
    },
  },
  {
    key: "shipping",
    title: "Shipping 4 × 6 in",
    description: "Thermal shipping label",
    tpl: {
      width_mm: 101.6, height_mm: 152.4, background: "#FFFFFF",
      elements: [
        el("text", { x: 5, y: 5, w: 60, h: 6, content: "FROM: {{brand}}", font_size: 9, font_weight: 600 }),
        el("rect", { x: 5, y: 14, w: 91.6, h: 0.5, fill: "#111827", stroke_width: 0 }),
        el("text", { x: 5, y: 18, w: 91.6, h: 6, content: "SHIP TO", font_size: 8, font_weight: 600, color: "#6B7280" }),
        el("text", { x: 5, y: 25, w: 91.6, h: 30, content: "{{name}}\n{{address}}", font_size: 14, font_weight: 700 }),
        el("rect", { x: 5, y: 60, w: 91.6, h: 0.5, fill: "#111827", stroke_width: 0 }),
        el("barcode", { x: 8, y: 66, w: 85.6, h: 38, content: "{{barcode}}" }),
        el("qrcode", { x: 5, y: 112, w: 34, h: 34, content: "{{link}}" }),
        el("text", { x: 44, y: 115, w: 52, h: 30, content: "ORDER\n{{sku}}", font_size: 16, font_weight: 700, font_family: "IBM Plex Mono" }),
      ],
    },
  },
];
