// Hand-written mirrors of backend/models/labels.py — keep in sync.
export type ElementType = "text" | "barcode" | "qrcode" | "rect" | "image";
export type BarcodeFormat = "CODE128" | "CODE39" | "EAN13" | "UPC" | "ITF14";
export type Align = "left" | "center" | "right";

export interface LabelElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  font_family: string;
  font_size: number;
  font_weight: number;
  align: Align;
  color: string;
  fill: string;
  stroke: string;
  stroke_width: number;
  radius: number;
  barcode_format: BarcodeFormat;
  show_text: boolean;
  image_url: string;
  rotation: number;
}

export interface TemplateBase {
  name: string;
  brand: string;
  width_mm: number;
  height_mm: number;
  background: string;
  elements: LabelElement[];
}

export interface Template extends TemplateBase {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface SheetSourceCreate {
  name: string;
  brand: string;
  url: string;
  template_id: string | null;
}

export interface SheetSource extends SheetSourceCreate {
  id: string;
  created_at: string;
}

export interface SheetData {
  columns: string[];
  rows: Record<string, string>[];
  csv_url: string;
}

export type Row = Record<string, string>;
export type Mapping = Record<string, string>; // placeholder -> column
