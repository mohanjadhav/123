import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, Barcode, Circle, Database, Diamond, Hexagon, Image as ImageIcon, Minus, MoveHorizontal, MoveRight, QrCode, RectangleHorizontal,
  Search, Shapes, Square, Star, Table, Triangle, Type, Wallpaper, BadgeCheck, Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ICONS } from "@/lib/icons";
import type { ElementType, LabelElement } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Library = "image" | "logo" | "background";
export type Tool = { key: string; label: string; icon: ReactNode; type?: ElementType; patch?: Partial<LabelElement>; library?: Library };

export const TOOLS: Tool[] = [
  { key: "text", type: "text", label: "Text", icon: <Type /> },
  { key: "barcode", type: "barcode", label: "Barcode", icon: <Barcode /> },
  { key: "qrcode", type: "qrcode", label: "QR code", icon: <QrCode /> },
  { key: "table", type: "table", label: "Table", icon: <Table /> },
  { key: "image", label: "Image", icon: <ImageIcon />, library: "image" },
  { key: "logo", label: "Logo", icon: <BadgeCheck />, library: "logo" },
  { key: "background", label: "Background", icon: <Wallpaper />, library: "background" },
];

const box = { stroke_width: 0.4, fill: "transparent", stroke: "#111827" };
export const SHAPES: Tool[] = [
  { key: "shape", type: "rect", label: "Rectangle", icon: <Square />, patch: { ...box, radius: 0, w: 24, h: 12 } },
  { key: "rounded", type: "rect", label: "Rounded box", icon: <RectangleHorizontal />, patch: { ...box, radius: 2.5, w: 24, h: 12 } },
  { key: "ellipse", type: "rect", label: "Circle / ellipse", icon: <Circle />, patch: { ...box, shape: "ellipse", w: 14, h: 14 } },
  { key: "triangle", type: "rect", label: "Triangle", icon: <Triangle />, patch: { ...box, shape: "triangle", w: 14, h: 12 } },
  { key: "star", type: "rect", label: "Star", icon: <Star />, patch: { ...box, shape: "star", fill: "#F9AB00", stroke_width: 0, w: 14, h: 14 } },
  { key: "arrow-shape", type: "rect", label: "Block arrow", icon: <ArrowRight />, patch: { ...box, shape: "arrow", fill: "#111827", stroke_width: 0, w: 18, h: 10 } },
  { key: "diamond", type: "rect", label: "Diamond", icon: <Diamond />, patch: { ...box, shape: "diamond", w: 14, h: 14 } },
  { key: "hexagon", type: "rect", label: "Hexagon", icon: <Hexagon />, patch: { ...box, shape: "hexagon", w: 16, h: 14 } },
  { key: "line", type: "line", label: "Line", icon: <Minus /> },
  { key: "dashed-line", type: "line", label: "Dashed line", icon: <Minus className="[stroke-dasharray:4_3]" />, patch: { stroke_style: "dashed" } },
  { key: "arrow-line", type: "line", label: "Arrow", icon: <MoveRight />, patch: { arrows: "end" } },
  { key: "double-arrow", type: "line", label: "Double arrow", icon: <MoveHorizontal />, patch: { arrows: "both" } },
];

const tileCls = "flex h-12 flex-col items-center justify-center gap-0.5 rounded text-[10px] leading-none text-[#374151] transition-colors duration-150 hover:bg-(--app-accent-soft) hover:text-(--app-accent) [&_svg]:size-4";

function ShapesMenu({ onTool }: { onTool: (t: Tool) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={tileCls} data-testid="add-shapes-menu-button" title="Shapes & lines"><Shapes /> Shapes</PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-64 p-2" data-testid="shapes-menu">
        <p className="px-1 pb-1.5 text-[11px] font-semibold text-[#4B5563]">Shapes &amp; lines</p>
        <div className="grid grid-cols-4 gap-1">
          {SHAPES.map((t) => (
            <button key={t.key} title={t.label} data-testid={`add-${t.key}-button`} onClick={() => { onTool(t); setOpen(false); }} className={tileCls}>
              {t.icon}<span className="max-w-full truncate px-0.5">{t.label}</span>
            </button>
          ))}
        </div>
        <p className="px-1 pt-1.5 text-[10px] text-[#9CA3AF]">Tip: set any angle in Rotation to draw lines in any direction.</p>
      </PopoverContent>
    </Popover>
  );
}

function IconsMenu({ onTool }: { onTool: (t: Tool) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = ICONS.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(shown.map((i) => i.group))];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={tileCls} data-testid="add-icons-menu-button" title="Icons & symbols"><Sparkles /> Icons</PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-2" data-testid="icons-menu">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons (veg, fragile, phone…)" className="mb-2 h-7 text-xs" data-testid="icons-search-input" />
        <div className="max-h-80 overflow-y-auto">
          {groups.map((g) => (
            <div key={g} className="mb-2">
              <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{g}</p>
              <div className="grid grid-cols-6 gap-1">
                {shown.filter((i) => i.group === g).map((i) => (
                  <button key={i.key} title={i.label} data-testid={`add-icon-${i.key}`}
                    onClick={() => { onTool({ key: `icon-${i.key}`, type: "icon", label: i.label, icon: null, patch: { icon: i.key, color: i.color ?? "#111827" } }); setOpen(false); }}
                    className="true-color grid size-10 place-items-center rounded border border-transparent p-1.5 transition-colors duration-150 hover:border-(--app-accent) hover:bg-(--app-accent-soft)">
                    {i.render(i.color ?? "#1F2937")}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {shown.length === 0 && <p className="py-4 text-center text-xs text-[#9CA3AF]">No icons match.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function LeftPanel({ onTool, columns, sourceName, onPickField, onOpenImport, layers, selectedId, onSelect }: {
  onTool: (t: Tool) => void;
  columns: string[];
  sourceName: string | null;
  onPickField: (col: string) => void;
  onOpenImport: () => void;
  layers: LabelElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const shown = columns.filter((c) => c.toLowerCase().includes(q.toLowerCase()));
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[#D9DDE3] bg-white" data-testid="left-dock">
      <div className="grid grid-cols-5 gap-0.5 border-b border-[#E5E7EB] p-1.5" data-testid="tool-palette">
        {TOOLS.map((t) => (
          <button key={t.key} title={`Add ${t.label}`} data-testid={`add-${t.key}-button`} onClick={() => onTool(t)} className={tileCls}>
            {t.icon}<span className="max-w-full truncate px-0.5">{t.label}</span>
          </button>
        ))}
        <ShapesMenu onTool={onTool} />
        <IconsMenu onTool={onTool} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col" data-testid="data-fields-panel">
        <div className="flex items-center justify-between px-3 pb-1.5 pt-2.5">
          <h4 className="text-xs font-semibold text-[#1F2937]">Data fields</h4>
          {sourceName && <span className="max-w-28 truncate text-[10px] text-[#188038]" title={sourceName} data-testid="data-fields-source">● {sourceName}</span>}
        </div>
        {columns.length === 0 ? (
          <div className="mx-3 rounded-lg border border-dashed border-[#C7CCD3] p-3 text-center text-[11px] leading-relaxed text-[#6B7280]" data-testid="data-fields-empty">
            <Database className="mx-auto mb-1.5 size-5 text-[#9CA3AF]" />
            Connect a Google Sheet to see its column headers here.
            <button data-testid="data-fields-import-button" onClick={onOpenImport} className="mt-2 block w-full rounded bg-(--app-accent) py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-(--app-accent-hover)">
              Import data
            </button>
          </div>
        ) : (
          <>
            <div className="relative mx-3 mb-1.5">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fields" data-testid="data-fields-search" className="h-7 bg-white pl-7 text-xs" />
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2" data-testid="column-chips">
              {shown.map((c) => (
                <li key={c}>
                  <button
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("application/x-label-field", c); e.dataTransfer.effectAllowed = "copy"; }}
                    onClick={() => onPickField(c)}
                    data-testid={`column-chip-${c}`}
                    title="Click to insert into the selected element, or drag onto the label"
                    className="flex w-full cursor-grab items-center gap-2 rounded px-2 py-1 text-left text-xs text-[#1F2937] transition-colors duration-150 hover:bg-(--app-accent-soft) active:cursor-grabbing"
                  >
                    <span className="grid size-4 place-items-center rounded-sm bg-[#E6F4EA] font-mono text-[8px] font-bold text-[#188038]">ab</span>
                    <span className="truncate">{c}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="max-h-48 shrink-0 overflow-y-auto border-t border-[#E5E7EB] px-1.5 pb-2" data-testid="layers-list">
        <h4 className="sticky top-0 bg-white px-1.5 pb-1 pt-2 text-xs font-semibold text-[#1F2937]">Elements</h4>
        {[...layers].reverse().map((el) => (
          <button key={el.id} data-testid={`layer-item-${el.id}`} onClick={() => onSelect(el.id)}
            className={cn("flex w-full items-center gap-2 truncate rounded px-2 py-1 text-left text-xs transition-colors duration-150",
              el.id === selectedId ? "bg-(--app-accent-soft) text-(--app-accent)" : "text-[#374151] hover:bg-[#F3F4F6]")}>
            <span className="w-11 shrink-0 text-[9px] uppercase text-[#9CA3AF]">{el.type === "rect" ? (el.shape && el.shape !== "rect" ? el.shape : "shape") : el.type}</span>
            <span className="truncate">{el.type === "icon" ? el.icon : el.type === "table" ? el.content.split("\n")[0] : el.content || (el.image_url.startsWith("data:") ? "uploaded image" : el.image_url.startsWith("/api/images/") ? "library image" : el.image_url) || "—"}</span>
          </button>
        ))}
        {layers.length === 0 && <p className="px-2 text-[11px] text-[#9CA3AF]">Use the tools above to add elements.</p>}
      </div>
    </aside>
  );
}
