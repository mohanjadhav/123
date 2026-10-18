// Hand-written mirrors of backend/models/labels.py — keep in sync.
export type ElementType = "text" | "barcode" | "qrcode" | "rect" | "image" | "line" | "icon" | "table";
export type ShapeKind = "rect" | "ellipse" | "triangle" | "star" | "arrow" | "diamond" | "hexagon";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type Fit = "contain" | "cover" | "fill";
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
  rotation: number; // degrees, any angle
  shape: ShapeKind; // for type "rect"
  fill2: string; // gradient end colour ("" = solid)
  gradient_angle: number;
  stroke_style: StrokeStyle;
  opacity: number; // 0..1
  arrows: "none" | "end" | "both"; // for type "line"
  icon: string; // icon-library key for type "icon"
  image_fit: Fit;
  table_rows: number;
  table_cols: number;
  table_header: boolean;
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
  dpi: number; // printer resolution; 0 = vector/any, 203/300/600 snaps barcode bars to printer dots
}

/** What the label renderer needs. */
export type LabelShape = Pick<TemplateBase, "width_mm" | "height_mm" | "background" | "elements">
  & Partial<Pick<TemplateBase, "background_image" | "background_fit" | "background_opacity">>;

export interface TemplateBase {
  name: string;
  brand: string;
  width_mm: number;
  height_mm: number;
  background: string;
  background_image: string; // full-label background picture
  background_fit: "cover" | "contain" | "fill";
  background_opacity: number;
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

// Print queue (backend QueueJob): spooled jobs printed together in one batch.
export interface QueueItem {
  cells: Record<string, string>;
  qty: number;
  selected: boolean;
}

export interface QueueJobCreate {
  template_id: string;
  source_id: string | null;
  items: QueueItem[];
}

export interface QueueJobUpdate {
  selected?: boolean;
  items?: QueueItem[];
}

export interface QueueJob {
  id: string;
  template_id: string;
  template_name: string;
  template_brand: string;
  source_id: string | null;
  source_name: string;
  items: QueueItem[];
  selected: boolean;
  created_at: string;
}

// backend/models/images.py
export interface ImageAsset {
  id: string;
  name: string;
  content_type: string;
  size: number;
  url: string; // relative /api URL usable directly in labels
  created_at: string;
}

// backend/models/backup.py
export interface RestoreResult {
  restored: Record<string, number>; // collection -> items added or replaced
  total: number;
}
export interface AppSettings {
  update_repo: string; // GitHub "owner/repo"
}
export interface AppInfo {
  version: string; // "web" when not the Windows app
  desktop: boolean;
  update_repo: string;
}
export interface UpdateCheck {
  current: string;
  latest: string | null;
  update_available: boolean;
  release_url: string | null;
  download_url: string | null;
  notes: string;
  error: string | null;
}
