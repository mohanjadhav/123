import { useState } from "react";
import type { ReactNode } from "react";
import { Barcode, Database, Image as ImageIcon, Minus, QrCode, Search, Square, Type } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ElementType, LabelElement } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Tool = { key: string; type: ElementType; label: string; icon: ReactNode; patch?: Partial<LabelElement> };
export const TOOLS: Tool[] = [
  { key: "text", type: "text", label: "Text", icon: <Type /> },
  { key: "barcode", type: "barcode", label: "Barcode", icon: <Barcode /> },
  { key: "qrcode", type: "qrcode", label: "QR code", icon: <QrCode /> },
  { key: "shape", type: "rect", label: "Rectangle", icon: <Square /> },
  { key: "line", type: "rect", label: "Line", icon: <Minus />, patch: { h: 0.4, fill: "#111827", stroke_width: 0, radius: 0 } },
  { key: "image", type: "image", label: "Image", icon: <ImageIcon /> },
];

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
      <div className="grid grid-cols-6 gap-0.5 border-b border-[#E5E7EB] p-1.5" data-testid="tool-palette">
        {TOOLS.map((t) => (
          <button key={t.key} title={`Add ${t.label}`} data-testid={`add-${t.key === "shape" ? "shape" : t.key}-button`} onClick={() => onTool(t)}
            className="grid h-8 place-items-center rounded text-[#374151] transition-colors duration-150 hover:bg-(--app-accent-soft) hover:text-(--app-accent) [&_svg]:size-4">
            {t.icon}
          </button>
        ))}
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
            <span className="w-11 shrink-0 text-[9px] uppercase text-[#9CA3AF]">{el.type === "rect" ? "shape" : el.type}</span>
            <span className="truncate">{el.content || (el.image_url.startsWith("data:") ? "uploaded image" : el.image_url) || "—"}</span>
          </button>
        ))}
        {layers.length === 0 && <p className="px-2 text-[11px] text-[#9CA3AF]">Use the tools above to add elements.</p>}
      </div>
    </aside>
  );
}
