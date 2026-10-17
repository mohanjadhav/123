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
  italic: boolean;
  underline: boolean;
  strike: boolean;
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

export interface PageSetup {
  paper: "label" | "a4" | "letter" | "custom";
  paper_w: number;
  paper_h: number;
  orientation: "portrait" | "landscape";
  cols: number; // 0 = auto
  rows: number; // 0 = auto
  gap_x: number;
  gap_y: number;
  margin_top: number;
  margin_right: number;
  margin_bottom: number;
  margin_left: number;
  offset_x: number;
  offset_y: number;
  order: "across" | "down";
  start_position: number;
}

/** What the label renderer needs. */
export type LabelShape = Pick<TemplateBase, "width_mm" | "height_mm" | "background" | "elements">;

export interface TemplateBase {
  name: string;
  brand: string;
  width_mm: number;
  height_mm: number;
  background: string;
  elements: LabelElement[];
  source_id: string | null;
  page_setup: PageSetup;
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
  workbook: string | null; // groups tabs of one spreadsheet / file
  workbook_name: string | null;
  tab: string | null;
  tab_index: number;
  created_at: string;
}

export interface SheetData {
  columns: string[];
  rows: Record<string, string>[];
  csv_url: string;
  name: string;
}

export type Row = Record<string, string>;
export type Mapping = Record<string, string>; // placeholder -> column

// Editable in-app copy of a sheet (backend SheetCopy). Edits never reach Google.
export interface CopyRow {
  id: string;
  cells: Record<string, string>;
  qty: number;
  selected: boolean;
  origin: string | null;
}

export interface SheetCopyUpdate {
  columns: string[];
  rows: CopyRow[];
  qty_column: string | null; // read print quantity from this column (null = manual qty)
}

export interface SheetCopy extends SheetCopyUpdate {
  source_id: string;
  edited: boolean;
  updated_at: string;
}

export interface CopyRefreshResult {
  sheet: SheetCopy;
  added: number;
}
