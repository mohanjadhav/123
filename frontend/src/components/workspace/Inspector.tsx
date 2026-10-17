import type { ChangeEvent, ReactNode } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Bold, CopyPlus, Italic, Strikethrough, Trash2, Underline,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FONTS, SIZE_PRESETS } from "@/lib/label";
import type { BarcodeFormat, LabelElement, TemplateBase } from "@/lib/types";
import { cn } from "@/lib/utils";

const BARCODE_FORMATS: BarcodeFormat[] = ["CODE128", "CODE39", "EAN13", "UPC", "ITF14"];
const TYPE_LABEL: Record<LabelElement["type"], string> = { text: "Text", barcode: "Barcode", qrcode: "QR code", rect: "Shape", image: "Image" };

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
            className={cn("rounded border px-1.5 py-1 text-[10px]", none ? "border-[#1A73E8] bg-[#E8F0FE] text-[#1A73E8]" : "border-[#D1D5DB] text-[#4B5563]")}>None</button>
        )}
      </span>
    </label>
  );
}

function Toggle({ active, onClick, children, testId, title }: { active: boolean; onClick: () => void; children: ReactNode; testId: string; title: string }) {
  return (
    <button type="button" title={title} data-testid={testId} onClick={onClick}
      className={cn("grid size-7 place-items-center rounded border transition-colors duration-150 [&_svg]:size-3.5",
        active ? "border-[#1A73E8] bg-[#E8F0FE] text-[#1A73E8]" : "border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F3F4F6]")}>
      {children}
    </button>
  );
}

export function Inspector({ tpl, selected, columns, onEl, onTpl, onArrange, onDuplicate, onDelete, onInsertField }: {
  tpl: TemplateBase;
  selected: LabelElement | null;
  columns: string[];
  onEl: (patch: Partial<LabelElement>) => void;
  onTpl: (patch: Partial<TemplateBase>) => void;
  onArrange: (dir: "front" | "back") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onInsertField: (col: string) => void;
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
        <p className="px-3 py-3 text-[11px] leading-relaxed text-[#6B7280]">
          Click an element to edit it. Drag fields from <b>Data fields</b> onto the label. Arrow keys nudge (Shift = 5 mm), Ctrl+Z / Ctrl+Y undo &amp; redo, Ctrl+S saves.
        </p>
      </div>
    );
  }

  const el = selected;
  const onImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) return toast.error("Image must be under 1.5 MB");
    const reader = new FileReader();
    reader.onload = () => onEl({ image_url: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div data-testid="prop-inspector-panel">
      <div className="border-b border-[#E5E7EB] bg-[#F8F9FB] px-3 py-2 text-xs font-semibold text-[#1F2937]">{TYPE_LABEL[el.type]} properties</div>

      {el.type !== "rect" && el.type !== "image" && (
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

      {el.type === "text" && (
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
              <Color label="Background" testId="prop-fill-input" allowNone value={el.fill} onChange={(v) => onEl({ fill: v })} />
            </div>
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
          </div>
        </Group>
      )}

      {el.type === "qrcode" && (
        <Group title="QR code">
          <Color label="Colour" testId="prop-qr-color-input" value={el.color} onChange={(v) => onEl({ color: v })} />
        </Group>
      )}

      {el.type === "image" && (
        <Group title="Image">
          <div className="grid gap-2">
            <Input data-testid="prop-image-url-input" className="h-8 bg-white text-xs" placeholder="https://… or {{image_column}}"
              value={el.image_url.startsWith("data:") ? "(uploaded image)" : el.image_url} onChange={(e) => onEl({ image_url: e.target.value })} />
            <Input type="file" accept="image/*" data-testid="prop-image-upload-input" className="h-8 bg-white text-xs" onChange={onImageUpload} />
          </div>
        </Group>
      )}

      {el.type === "rect" && (
        <Group title="Shape">
          <div className="grid grid-cols-2 gap-2">
            <Color label="Fill" testId="prop-fill-input" allowNone value={el.fill} onChange={(v) => onEl({ fill: v })} />
            <Color label="Border colour" testId="prop-stroke-input" value={el.stroke} onChange={(v) => onEl({ stroke: v })} />
            <Num label="Border (mm)" testId="prop-stroke-width-input" step={0.1} value={el.stroke_width} onChange={(v) => onEl({ stroke_width: Math.max(0, v) })} />
            <Num label="Corner radius (mm)" testId="prop-radius-input" value={el.radius} onChange={(v) => onEl({ radius: Math.max(0, v) })} />
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
        <label className="mt-2 grid gap-0.5 text-[10px] text-[#6B7280]">Rotation
          <Select value={String(el.rotation)} onValueChange={(v: string) => onEl({ rotation: Number(v) })}>
            <SelectTrigger className="h-8 w-full bg-white" data-testid="prop-rotation-select"><SelectValue>{(v) => `${v}°`}</SelectValue></SelectTrigger>
            <SelectContent>{[0, 90, 180, 270].map((r) => <SelectItem key={r} value={String(r)}>{r}°</SelectItem>)}</SelectContent>
          </Select>
        </label>
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
