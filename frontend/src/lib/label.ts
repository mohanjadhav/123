import type { LabelElement, LabelShape, Mapping, PageSetup, Row, SheetData, SheetSource, Template, TemplateBase } from "@/lib/types";
import { apiGet, apiPost } from "@/lib/api";

export const FONTS: Record<string, string> = {
  "IBM Plex Sans": "'IBM Plex Sans', sans-serif",
  "IBM Plex Mono": "'IBM Plex Mono', monospace",
  Geist: "'Geist Variable', sans-serif",
  "DM Sans": "'DM Sans Variable', sans-serif",
  "Space Grotesk": "'Space Grotesk Variable', sans-serif",
  Lora: "'Lora Variable', serif",
  "Playfair Display": "'Playfair Display Variable', serif",
};

export const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "4 × 6 in shipping", w: 101.6, h: 152.4 },
  { label: "3 × 2 in retail", w: 76.2, h: 50.8 },
  { label: "2 × 1 in shelf tag", w: 50.8, h: 25.4 },
  { label: "100 × 50 mm", w: 100, h: 50 },
  { label: "50 × 80 mm hangtag", w: 50, h: 80 },
  { label: "70 × 50 mm jar", w: 70, h: 50 },
];

export const MM_TO_PX = 96 / 25.4;

export const DEFAULT_PAGE_SETUP: PageSetup = {
  paper: "label", paper_w: 210, paper_h: 297, orientation: "portrait", cols: 0, rows: 0, gap_x: 0, gap_y: 0,
  margin_top: 0, margin_right: 0, margin_bottom: 0, margin_left: 0, offset_x: 0, offset_y: 0, order: "across", start_position: 1,
};

const PLACEHOLDER = /\{\{\s*([^}]+?)\s*\}\}/g;

export function placeholdersOf(tpl: TemplateBase): string[] {
  const set = new Set<string>();
  for (const el of tpl.elements) {
    for (const src of [el.content, el.image_url]) {
      for (const m of src.matchAll(PLACEHOLDER)) set.add(m[1]);
    }
  }
  return [...set];
}

export function interpolate(text: string, row: Row | null | undefined, mapping: Mapping): string {
  if (!row) return text;
  return text.replace(PLACEHOLDER, (_, key: string) => {
    const col = mapping[key] ?? key;
    return row[col] ?? "";
  });
}

export function autoMapping(placeholders: string[], columns: string[]): Mapping {
  const map: Mapping = {};
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const p of placeholders) {
    const n = norm(p);
    const hit =
      columns.find((c) => c === p) ??
      columns.find((c) => norm(c) === n) ??
      (n.length >= 3 ? columns.find((c) => norm(c).includes(n) || (norm(c).length >= 3 && n.includes(norm(c)))) : undefined);
    if (hit) map[p] = hit;
  }
  return map;
}

export function newElement(type: LabelElement["type"], tpl: Pick<LabelShape, "width_mm" | "height_mm">): LabelElement {
  const base: LabelElement = {
    id: crypto.randomUUID(),
    type,
    x: 3,
    y: 3,
    w: Math.min(30, tpl.width_mm - 6),
    h: 8,
    content: "",
    font_family: "IBM Plex Sans",
    font_size: 10,
    font_weight: 500,
    italic: false,
    underline: false,
    strike: false,
    align: "left",
    color: "#0F0F10",
    fill: "transparent",
    stroke: "#0F0F10",
    stroke_width: 0,
    radius: 0,
    barcode_format: "CODE128",
    show_text: true,
    image_url: "",
    rotation: 0,
  };
  const fit = (w: number, h: number) => ({ w: Math.min(w, tpl.width_mm - 6), h: Math.min(h, tpl.height_mm - 6) });
  switch (type) {
    case "text":
      return { ...base, content: "Label text" };
    case "barcode":
      return { ...base, ...fit(40, 15), content: "123456789012" };
    case "qrcode": {
      const s = Math.min(18, tpl.width_mm - 6, tpl.height_mm - 6);
      return { ...base, w: s, h: s, content: "https://example.com" };
    }
    case "rect":
      return { ...base, ...fit(20, 10), stroke_width: 0.5, radius: 1 };
    case "image":
      return { ...base, ...fit(18, 12) };
  }
}

export const fetchTemplates = () => apiGet<Template[]>("/templates");
export const fetchSources = () => apiGet<SheetSource[]>("/sources");
export const fetchSheet = (url: string) => apiPost<SheetData>("/sheets/fetch", { url });
