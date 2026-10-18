import type { ReactNode } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Bold, CopyPlus, ImagePlus, Italic, RotateCcw, RotateCw, Strikethrough, Trash2, Underline, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FONTS, SIZE_PRESETS } from "@/lib/label";
import { ICONS } from "@/lib/icons";
import type { BarcodeFormat, Fit, LabelElement, ShapeKind, StrokeStyle, TemplateBase } from "@/lib/types";
import { cn } from "@/lib/utils";

const BARCODE_FORMATS: BarcodeFormat[] = ["CODE128", "CODE39", "EAN13", "UPC", "ITF14"];
const TYPE_LABEL: Record<LabelElement["type"], string> = { text: "Text", barcode: "Barcode", qrcode: "QR code", rect: "Shape", image: "Image", line: "Line", icon: "Icon", table: "Table" };
const SHAPE_LABEL: Record<ShapeKind, string> = { rect: "Rectangle / rounded box", ellipse: "Circle / ellipse", triangle: "Triangle", star: "Star", arrow: "Block arrow", diamond: "Diamond", hexagon: "Hexagon" };
const FIT_LABEL: Record<Fit, string> = { contain: "Fit inside (keep shape)", cover: "Fill & crop", fill: "Stretch" };

function Pick<T extends string>({ label, value, options, onChange, testId }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void; testId: string }) {
  return (
    <label className="grid gap-0.5 text-[10px] text-[#6B7280]">{label}
      <Select value={value} onValueChange={(v: string) => onChange(v as T)}>
        <SelectTrigger className="h-8 w-full bg-white text-xs" data-testid={testId}><SelectValue>{(v: string) => options[v as T] ?? v}</SelectValue></SelectTrigger>
        <SelectContent>{(Object.keys(options) as T[]).map((k) => <SelectItem key={k} value={k}>{options[k]}</SelectItem>)}</SelectContent>
      </Select>
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange, testId, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; testId: string; fmt: (v: number) => string }) {
  return (
    <label className="grid gap-0.5 text-[10px] text-[#6B7280]">
      <span className="flex justify-between">{label}<span className="font-mono text-[#374151]">{fmt(value)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} data-testid={testId} onChange={(e) => onChange(parseFloat(e.target.value))} className="accent-(--app-accent)" />
    </label>
  );
}

const STROKE_STYLES: Record<StrokeStyle, string> = { solid: "Solid", dashed: "Dashed", dotted: "Dotted" };

/** Fill colour with optional gradient (second colour + angle). */
function FillEditor({ el, onEl, label = "Fill" }: { el: LabelElement; onEl: (p: Partial<LabelElement>) => void; label?: string }) {
  const grad = !!el.fill2;
  return (
    <div className="grid gap-2">
      <div className="flex items-end gap-2">
        <Color label={label} testId="prop-fill-input" allowNone={!grad} value={el.fill} onChange={(v) => onEl({ fill: v })} />
        <label className="flex items-center gap-1.5 pb-1.5 text-[11px] text-[#374151]">
          <Checkbox data-testid="prop-gradient-toggle" checked={grad} onCheckedChange={(c) => onEl(c ? { fill2: "#1A73E8", fill: el.fill === "transparent" ? "#FFFFFF" : el.fill } : { fill2: "" })} /> Gradient
        </label>
        {grad && <Color label="To colour" testId="prop-fill2-input" value={el.fill2} onChange={(v) => onEl({ fill2: v })} />}
      </div>
      {grad && <Slider label="Gradient angle" testId="prop-gradient-angle" min={0} max={360} step={15} value={el.gradient_angle ?? 90} fmt={(v) => `${v}°`} onChange={(v) => onEl({ gradient_angle: v })} />}
    </div>
  );
}

function BorderEditor({ el, onEl, radius }: { el: LabelElement; onEl: (p: Partial<LabelElement>) => void; radius?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Color label="Border colour" testId="prop-stroke-input" value={el.stroke} onChange={(v) => onEl({ stroke: v })} />
      <Num label="Border (mm)" testId="prop-stroke-width-input" step={0.1} value={el.stroke_width} onChange={(v) => onEl({ stroke_width: Math.max(0, v) })} />
      <Pick label="Border style" testId="prop-stroke-style-select" value={el.stroke_style ?? "solid"} options={STROKE_STYLES} onChange={(v) => onEl({ stroke_style: v })} />
      {radius && <Num label="Corner radius (mm)" testId="prop-radius-input" value={el.radius} onChange={(v) => onEl({ radius: Math.max(0, v) })} />}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-[#E5E7EB] px-3 py-3">
      <h4 className="mb-2 text-[11px] font-semibold text-[#4B5563]">{title}</h4>
      {children}
    </section>
  );
}

function Num({ label, value, onChange, step = 0.5, testId }: { label: string; value: number; onChange: (v: number) => void; step?: number; testId: string }) {
  return (
    <label className="grid gap-0.5 text-[10px] text-[#6B7280]">
      {label}
      <Input type="number" step={step} value={Number.isFinite(value) ? value : 0} data-testid={testId} className="h-7 bg-white font-mono text-xs"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </label>
  );
}

function Color({ label, value, onChange, allowNone, testId }: { label: string; value: string; onChange: (v: string) => void; allowNone?: boolean; testId: string }) {
  const none = value === "transparent";
  return (
    <label className="grid gap-0.5 text-[10px] text-[#6B7280]">
      {label}
      <span className="flex items-center gap-1">
        <input type="color" data-testid={testId} value={none ? "#ffffff" : value} onChange={(e) => onChange(e.target.value)}
          className={cn("h-7 w-9 cursor-pointer rounded border border-[#D1D5DB] bg-white p-0.5", none && "opacity-40")} />
        {allowNone && (
          <button type="button" data-testid={`${testId}-none`} onClick={() => onChange(none ? "#111827" : "transparent")}
            className={cn("rounded border px-1.5 py-1 text-[10px]", none ? "border-(--app-accent) bg-(--app-accent-soft) text-(--app-accent)" : "border-[#D1D5DB] text-[#4B5563]")}>None</button>
        )}
      </span>
    </label>
  );
}

function Toggle({ active, onClick, children, testId, title }: { active: boolean; onClick: () => void; children: ReactNode; testId: string; title: string }) {
  return (
    <button type="button" title={title} data-testid={testId} onClick={onClick}
      className={cn("grid size-7 place-items-center rounded border transition-colors duration-150 [&_svg]:size-3.5",
        active ? "border-(--app-accent) bg-(--app-accent-soft) text-(--app-accent)" : "border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F3F4F6]")}>
      {children}
    </button>
  );
}

export function Inspector({ tpl, selected, columns, onEl, onTpl, onArrange, onDuplicate, onDelete, onInsertField, onOpenLibrary }: {
  tpl: TemplateBase;
  selected: LabelElement | null;
  columns: string[];
  onEl: (patch: Partial<LabelElement>) => void;
  onTpl: (patch: Partial<TemplateBase>) => void;
  onArrange: (dir: "front" | "back") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onInsertField: (col: string) => void;
  onOpenLibrary: (target: "replace" | "background") => void;
}) {
  if (!selected) {
    return (
      <div data-testid="label-properties-panel">
        <div className="border-b border-[#E5E7EB] bg-[#F8F9FB] px-3 py-2 text-xs font-semibold text-[#1F2937]">Label properties</div>
        <Group title="General">
          <div className="grid gap-2">
            <label className="grid gap-0.5 text-[10px] text-[#6B7280]">Label name
              <Input data-testid="template-name-input" className="h-8 bg-white" value={tpl.name} onChange={(e) => onTpl({ name: e.target.value })} />
            </label>
            <label className="grid gap-0.5 text-[10px] text-[#6B7280]">Brand
              <Input data-testid="template-brand-input" className="h-8 bg-white" value={tpl.brand} onChange={(e) => onTpl({ brand: e.target.value })} />
            </label>
          </div>
        </Group>
        <Group title="Size">
          <Select value="" onValueChange={(v: string) => { const p = SIZE_PRESETS[Number(v)]; if (p) onTpl({ width_mm: p.w, height_mm: p.h }); }}>
            <SelectTrigger className="mb-2 h-8 w-full bg-white" data-testid="template-size-preset-select"><SelectValue placeholder="Size preset…">{() => "Size preset…"}</SelectValue></SelectTrigger>
            <SelectContent>{SIZE_PRESETS.map((p, i) => <SelectItem key={p.label} value={String(i)}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Num label="Width (mm)" testId="template-width-input" value={tpl.width_mm} onChange={(v) => onTpl({ width_mm: Math.max(5, v) })} />
            <Num label="Height (mm)" testId="template-height-input" value={tpl.height_mm} onChange={(v) => onTpl({ height_mm: Math.max(5, v) })} />
          </div>
        </Group>
        <Group title="Appearance">
          <Color label="Label colour" testId="template-background-input" value={tpl.background} onChange={(v) => onTpl({ background: v })} />
        </Group>
        <Group title="Background picture">
          <div className="grid gap-2" data-testid="template-background-image-group">
            {tpl.background_image ? (
              <div className="flex items-center gap-2">
                <div className="true-color grid size-12 shrink-0 place-items-center overflow-hidden rounded border border-[#E5E7EB] bg-[#F3F4F6]">
                  {tpl.background_image.includes("{{") ? <span className="px-0.5 text-center font-mono text-[8px]">{tpl.background_image}</span> : <img src={tpl.background_image} alt="" className="max-h-full max-w-full object-contain" />}
                </div>
                <Button size="sm" variant="outline" className="bg-white" data-testid="template-background-change" onClick={() => onOpenLibrary("background")}><ImagePlus /> Change</Button>
                <Button size="icon-sm" variant="ghost" title="Remove background picture" data-testid="template-background-remove" onClick={() => onTpl({ background_image: "" })}><X /></Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="justify-start bg-white" data-testid="template-background-choose" onClick={() => onOpenLibrary("background")}><ImagePlus /> Choose background picture…</Button>
            )}
            {columns.length > 0 && (
              <Select value="" onValueChange={(v: string) => onTpl({ background_image: `{{${v}}}` })}>
                <SelectTrigger className="h-8 w-full bg-white text-xs" data-testid="template-background-column"><SelectValue placeholder="…or picture link from a sheet column">{() => "…or picture link from a sheet column"}</SelectValue></SelectTrigger>
                <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {tpl.background_image && (
              <>
                <Pick label="Fit" testId="template-background-fit" value={tpl.background_fit ?? "cover"} options={FIT_LABEL} onChange={(v) => onTpl({ background_fit: v })} />
                <Slider label="Picture opacity" testId="template-background-opacity" min={0.05} max={1} step={0.05} value={tpl.background_opacity ?? 1} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => onTpl({ background_opacity: v })} />
              </>
            )}
          </div>
        </Group>
        <p className="px-3 py-3 text-[11px] leading-relaxed text-[#6B7280]">
          Click an element to edit it. Drag fields from <b>Data fields</b> onto the label. Arrow keys nudge (Shift = 5 mm), Ctrl+Z / Ctrl+Y undo &amp; redo, Ctrl+S saves.
        </p>
      </div>
    );
  }

  const el = selected;
  const isShape = el.type === "rect";
  const isRectShape = isShape && (!el.shape || el.shape === "rect");

  return (
    <div data-testid="prop-inspector-panel">
      <div className="border-b border-[#E5E7EB] bg-[#F8F9FB] px-3 py-2 text-xs font-semibold text-[#1F2937]">
        {isShape && el.shape && el.shape !== "rect" ? SHAPE_LABEL[el.shape] : TYPE_LABEL[el.type]} properties
      </div>

      {(el.type === "text" || el.type === "barcode" || el.type === "qrcode") && (
        <Group title={el.type === "text" ? "Text" : "Value"}>
          <Textarea data-testid="prop-content-input" rows={3} className="bg-white font-mono text-xs" value={el.content}
            onChange={(e) => onEl({ content: e.target.value })} placeholder="Type text or insert a {{field}}" />
          {columns.length > 0 && (
            <Select value="" onValueChange={(v: string) => onInsertField(v)}>
              <SelectTrigger className="mt-2 h-8 w-full bg-white" data-testid="prop-binding-select"><SelectValue placeholder="Insert data field…">{() => "Insert data field…"}</SelectValue></SelectTrigger>
              <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </Group>
      )}

      {el.type === "table" && (
        <Group title="Table">
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Num label="Rows" testId="prop-table-rows" step={1} value={el.table_rows} onChange={(v) => onEl({ table_rows: Math.max(1, Math.min(30, Math.round(v))) })} />
              <Num label="Columns" testId="prop-table-cols" step={1} value={el.table_cols} onChange={(v) => onEl({ table_cols: Math.max(1, Math.min(12, Math.round(v))) })} />
            </div>
            <Textarea data-testid="prop-table-content" rows={4} className="bg-white font-mono text-xs" value={el.content} onChange={(e) => onEl({ content: e.target.value })} />
            <p className="-mt-1 text-[10px] leading-snug text-[#9CA3AF]">One line per row, separate cells with <b>|</b>. Fields work too, e.g. <span className="font-mono">MRP|{"{{MRP}}"}</span></p>
            {columns.length > 0 && (
              <Select value="" onValueChange={(v: string) => onEl({ content: `${el.content}${el.content.endsWith("\n") || !el.content ? "" : "|"}{{${v}}}` })}>
                <SelectTrigger className="h-8 w-full bg-white" data-testid="prop-table-field-select"><SelectValue placeholder="Insert data field…">{() => "Insert data field…"}</SelectValue></SelectTrigger>
                <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <label className="flex items-center gap-2 text-xs text-[#374151]">
              <Checkbox data-testid="prop-table-header" checked={el.table_header} onCheckedChange={(c) => onEl({ table_header: !!c })} /> First row is a bold header
            </label>
            {el.table_header && <FillEditor el={el} onEl={onEl} label="Header fill" />}
            <BorderEditor el={el} onEl={onEl} />
          </div>
        </Group>
      )}

      {(el.type === "text" || el.type === "table") && (
        <Group title="Font">
          <div className="grid gap-2">
            <Select value={el.font_family} onValueChange={(v: string) => onEl({ font_family: v })}>
              <SelectTrigger className="h-8 w-full bg-white" data-testid="prop-font-select"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(FONTS).map((f) => <SelectItem key={f} value={f}><span style={{ fontFamily: FONTS[f] }}>{f}</span></SelectItem>)}</SelectContent>
            </Select>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <Num label="Size (pt)" testId="prop-font-size-input" value={el.font_size} onChange={(v) => onEl({ font_size: Math.max(2, v) })} />
              <div className="flex gap-1">
                <Toggle title="Bold" testId="prop-bold-toggle" active={el.font_weight >= 600} onClick={() => onEl({ font_weight: el.font_weight >= 600 ? 400 : 700 })}><Bold /></Toggle>
                <Toggle title="Italic" testId="prop-italic-toggle" active={el.italic} onClick={() => onEl({ italic: !el.italic })}><Italic /></Toggle>
                <Toggle title="Underline" testId="prop-underline-toggle" active={el.underline} onClick={() => onEl({ underline: !el.underline })}><Underline /></Toggle>
                <Toggle title="Strikethrough" testId="prop-strike-toggle" active={el.strike} onClick={() => onEl({ strike: !el.strike })}><Strikethrough /></Toggle>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex gap-1">
                <Toggle title="Align left" testId="prop-align-left" active={el.align === "left"} onClick={() => onEl({ align: "left" })}><AlignLeft /></Toggle>
                <Toggle title="Center" testId="prop-align-center" active={el.align === "center"} onClick={() => onEl({ align: "center" })}><AlignCenter /></Toggle>
                <Toggle title="Align right" testId="prop-align-right" active={el.align === "right"} onClick={() => onEl({ align: "right" })}><AlignRight /></Toggle>
              </div>
              <Color label="Colour" testId="prop-color-input" value={el.color} onChange={(v) => onEl({ color: v })} />
            </div>
          </div>
        </Group>
      )}

      {el.type === "text" && (
        <Group title="Box">
          <div className="grid gap-2">
            <FillEditor el={el} onEl={onEl} label="Background" />
            <BorderEditor el={el} onEl={onEl} radius />
          </div>
        </Group>
      )}

      {el.type === "barcode" && (
        <Group title="Barcode">
          <div className="grid gap-2">
            <Select value={el.barcode_format} onValueChange={(v: string) => onEl({ barcode_format: v as BarcodeFormat })}>
              <SelectTrigger className="h-8 w-full bg-white" data-testid="prop-barcode-format"><SelectValue /></SelectTrigger>
              <SelectContent>{BARCODE_FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-xs text-[#374151]">
              <Checkbox data-testid="prop-show-text-checkbox" checked={el.show_text} onCheckedChange={(c) => onEl({ show_text: !!c })} /> Show number under bars
            </label>
            <p className="text-[10px] leading-snug text-[#9CA3AF]">For thermal printers set the printer DPI in Page setup — bars snap to printer dots for sharp scans.</p>
          </div>
        </Group>
      )}

      {el.type === "qrcode" && (
        <Group title="QR code">
          <Color label="Colour" testId="prop-qr-color-input" value={el.color} onChange={(v) => onEl({ color: v })} />
        </Group>
      )}

      {el.type === "icon" && (
        <Group title="Icon">
          <div className="grid gap-2">
            <div className="grid max-h-40 grid-cols-6 gap-1 overflow-y-auto rounded border border-[#E5E7EB] p-1" data-testid="prop-icon-grid">
              {ICONS.map((i) => (
                <button key={i.key} title={i.label} data-testid={`prop-icon-${i.key}`} onClick={() => onEl({ icon: i.key, ...(i.color ? { color: i.color } : {}) })}
                  className={cn("true-color grid size-8 place-items-center rounded p-1 transition-colors duration-150", el.icon === i.key ? "bg-(--app-accent-soft) ring-1 ring-(--app-accent)" : "hover:bg-[#F3F4F6]")}>
                  {i.render(i.color ?? "#1F2937")}
                </button>
              ))}
            </div>
            <Color label="Colour" testId="prop-icon-color-input" value={el.color} onChange={(v) => onEl({ color: v })} />
          </div>
        </Group>
      )}

      {el.type === "image" && (
        <Group title="Image">
          <div className="grid gap-2">
            <Button size="sm" variant="outline" className="justify-start bg-white" data-testid="prop-image-library-button" onClick={() => onOpenLibrary("replace")}>
              <ImagePlus /> {el.image_url ? "Change image (library / upload)" : "Choose image (library / upload)"}
            </Button>
            <Input data-testid="prop-image-url-input" className="h-8 bg-white text-xs" placeholder="https://… or {{image_column}}"
              value={el.image_url.startsWith("data:") ? "(uploaded image)" : el.image_url.startsWith("/api/images/") ? "(library image)" : el.image_url} onChange={(e) => onEl({ image_url: e.target.value })} />
            {columns.length > 0 && (
              <Select value="" onValueChange={(v: string) => onEl({ image_url: `{{${v}}}` })}>
                <SelectTrigger className="h-8 w-full bg-white text-xs" data-testid="prop-image-column-select"><SelectValue placeholder="Different picture per row (sheet column)…">{() => "Different picture per row (sheet column)…"}</SelectValue></SelectTrigger>
                <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Pick label="Fit" testId="prop-image-fit-select" value={el.image_fit ?? "contain"} options={FIT_LABEL} onChange={(v) => onEl({ image_fit: v })} />
          </div>
        </Group>
      )}

      {isShape && (
        <Group title="Shape">
          <div className="grid gap-2">
            <Pick label="Shape" testId="prop-shape-select" value={el.shape ?? "rect"} options={SHAPE_LABEL} onChange={(v) => onEl({ shape: v })} />
            <FillEditor el={el} onEl={onEl} />
            <BorderEditor el={el} onEl={onEl} radius={isRectShape} />
          </div>
        </Group>
      )}

      {el.type === "line" && (
        <Group title="Line">
          <div className="grid grid-cols-2 gap-2">
            <Color label="Colour" testId="prop-stroke-input" value={el.stroke} onChange={(v) => onEl({ stroke: v })} />
            <Num label="Thickness (mm)" testId="prop-stroke-width-input" step={0.1} value={el.stroke_width} onChange={(v) => onEl({ stroke_width: Math.max(0.05, v) })} />
            <Pick label="Style" testId="prop-stroke-style-select" value={el.stroke_style ?? "solid"} options={STROKE_STYLES} onChange={(v) => onEl({ stroke_style: v })} />
            <Pick label="Arrowheads" testId="prop-arrows-select" value={el.arrows ?? "none"} options={{ none: "None", end: "One end", both: "Both ends" }} onChange={(v) => onEl({ arrows: v })} />
          </div>
        </Group>
      )}

      <Group title="Position & size (mm)">
        <div className="grid grid-cols-2 gap-2">
          <Num label="X" testId="prop-x-input" value={el.x} onChange={(v) => onEl({ x: v })} />
          <Num label="Y" testId="prop-y-input" value={el.y} onChange={(v) => onEl({ y: v })} />
          <Num label="Width" testId="prop-width-input" value={el.w} onChange={(v) => onEl({ w: Math.max(0.2, v) })} />
          <Num label="Height" testId="prop-height-input" value={el.h} onChange={(v) => onEl({ h: Math.max(0.2, v) })} />
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
          <Num label="Rotation (°, any angle)" testId="prop-rotation-input" step={1} value={el.rotation} onChange={(v) => onEl({ rotation: ((Math.round(v * 10) / 10) % 360 + 360) % 360 })} />
          <div className="flex gap-1">
            <Toggle title="Rotate 15° left" testId="prop-rotate-left" active={false} onClick={() => onEl({ rotation: (el.rotation + 345) % 360 })}><RotateCcw /></Toggle>
            <Toggle title="Rotate 15° right" testId="prop-rotate-right" active={false} onClick={() => onEl({ rotation: (el.rotation + 15) % 360 })}><RotateCw /></Toggle>
            {[0, 90].map((r) => (
              <button key={r} type="button" data-testid={`prop-rotation-${r}`} onClick={() => onEl({ rotation: r })}
                className={cn("h-7 rounded border px-1.5 font-mono text-[10px]", el.rotation === r ? "border-(--app-accent) bg-(--app-accent-soft) text-(--app-accent)" : "border-[#D1D5DB] bg-white text-[#374151]")}>{r}°</button>
            ))}
          </div>
        </div>
        <div className="mt-2">
          <Slider label="Opacity" testId="prop-opacity-slider" min={0.05} max={1} step={0.05} value={el.opacity ?? 1} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => onEl({ opacity: v })} />
        </div>
      </Group>

      <Group title="Arrange">
        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="outline" size="sm" className="bg-white" data-testid="bring-front-button" onClick={() => onArrange("front")}><ArrowUpToLine /> To front</Button>
          <Button variant="outline" size="sm" className="bg-white" data-testid="send-back-button" onClick={() => onArrange("back")}><ArrowDownToLine /> To back</Button>
          <Button variant="outline" size="sm" className="bg-white" data-testid="duplicate-element-button" onClick={onDuplicate}><CopyPlus /> Duplicate</Button>
          <Button variant="outline" size="sm" className="bg-white text-[#D93025] hover:text-[#D93025]" data-testid="delete-element-button" onClick={onDelete}><Trash2 /> Delete</Button>
        </div>
      </Group>
    </div>
  );
}
