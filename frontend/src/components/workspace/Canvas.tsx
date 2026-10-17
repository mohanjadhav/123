import { useRef } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { elementBoxStyle, Label as LabelView, Scaled } from "@/components/label/Label";
import { Button } from "@/components/ui/button";
import { MM_TO_PX } from "@/lib/label";
import type { LabelElement, Mapping, Row, TemplateBase } from "@/lib/types";
import { cn } from "@/lib/utils";

const RULER = 22;
const round = (n: number) => Math.round(n * 2) / 2;

function Ruler({ lengthMm, zoom, vertical }: { lengthMm: number; zoom: number; vertical?: boolean }) {
  const px = MM_TO_PX * zoom;
  const len = lengthMm * px;
  const ticks: { pos: number; size: number; label?: string }[] = [];
  const step = px < 2.5 ? 5 : 1;
  for (let mm = 0; mm <= lengthMm; mm += step) {
    const size = mm % 10 === 0 ? 10 : mm % 5 === 0 ? 6 : 3;
    ticks.push({ pos: mm * px, size, label: mm % 10 === 0 && (px >= 1.5 || mm % 20 === 0) ? String(mm) : undefined });
  }
  return (
    <svg width={vertical ? RULER : len} height={vertical ? len : RULER} className="block overflow-visible text-[#6B7280]" aria-hidden>
      {ticks.map((t) =>
        vertical ? (
          <g key={t.pos}>
            <line x1={RULER - t.size} x2={RULER} y1={t.pos} y2={t.pos} stroke="currentColor" strokeWidth={0.7} />
            {t.label && <text x={2} y={t.pos + 9} fontSize={8} fill="currentColor">{t.label}</text>}
          </g>
        ) : (
          <g key={t.pos}>
            <line y1={RULER - t.size} y2={RULER} x1={t.pos} x2={t.pos} stroke="currentColor" strokeWidth={0.7} />
            {t.label && <text x={t.pos + 2} y={9} fontSize={8} fill="currentColor">{t.label}</text>}
          </g>
        ),
      )}
    </svg>
  );
}

export function Canvas({ tpl, row, mapping, zoom, onZoom, fitZoom, selectedId, onSelect, onChangeEl, onBeginChange, onDropField }: {
  tpl: TemplateBase;
  row: Row | null;
  mapping: Mapping;
  zoom: number;
  onZoom: (z: number) => void;
  fitZoom: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChangeEl: (id: string, patch: Partial<LabelElement>) => void;
  onBeginChange: () => void;
  onDropField: (col: string, xMm: number, yMm: number) => void;
}) {
  const drag = useRef<{ id: string; mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; moved: boolean } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const down = (e: ReactPointerEvent<HTMLDivElement>, el: LabelElement, mode: "move" | "resize") => {
    e.stopPropagation();
    onSelect(el.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: el.id, mode, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h, moved: false };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / (MM_TO_PX * zoom);
    const dy = (e.clientY - d.sy) / (MM_TO_PX * zoom);
    if (!d.moved) {
      if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) return;
      d.moved = true;
      onBeginChange(); // one undo step per drag
    }
    if (d.mode === "move") onChangeEl(d.id, { x: round(d.ox + dx), y: round(d.oy + dy) });
    else onChangeEl(d.id, { w: Math.max(1, round(d.ow + dx)), h: Math.max(1, round(d.oh + dy)) });
  };
  const up = () => { drag.current = null; };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const col = e.dataTransfer.getData("application/x-label-field");
    if (!col || !stageRef.current) return;
    e.preventDefault();
    const r = stageRef.current.getBoundingClientRect();
    onDropField(col, round((e.clientX - r.left) / (MM_TO_PX * zoom)), round((e.clientY - r.top) / (MM_TO_PX * zoom)));
  };

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#E3E6EA]" data-testid="canvas-editor-container">
      <div className="flex-1 overflow-auto" onPointerDown={() => onSelect(null)}>
        <div className="flex min-h-full min-w-max items-center justify-center p-10">
          <div className="grid" style={{ gridTemplateColumns: `${RULER}px auto`, gridTemplateRows: `${RULER}px auto` }}>
            <div className="grid place-items-center bg-[#F3F4F6] text-[8px] font-semibold text-[#6B7280]">mm</div>
            <div className="bg-[#F3F4F6]"><Ruler lengthMm={tpl.width_mm} zoom={zoom} /></div>
            <div className="bg-[#F3F4F6]"><Ruler lengthMm={tpl.height_mm} zoom={zoom} vertical /></div>
            <div ref={stageRef} onDragOver={(e) => e.dataTransfer.types.includes("application/x-label-field") && e.preventDefault()} onDrop={onDrop}>
              <Scaled widthMm={tpl.width_mm} heightMm={tpl.height_mm} scale={zoom} className="shadow-[0_2px_10px_rgba(0,0,0,0.15)] outline outline-1 outline-[#C7CCD3]">
                <LabelView
                  template={tpl}
                  row={row}
                  mapping={mapping}
                  testId="canvas-label-stage"
                  renderElement={(el, body) => (
                    <div
                      key={el.id}
                      data-testid={`canvas-element-${el.id}`}
                      style={elementBoxStyle(el)}
                      className={cn("cursor-move touch-none select-none", el.id === selectedId ? "outline outline-[1.5px] outline-[#1A73E8]" : "hover:outline hover:outline-1 hover:outline-dashed hover:outline-[#1A73E8]/60")}
                      onPointerDown={(e) => down(e, el, "move")}
                      onPointerMove={move}
                      onPointerUp={up}
                    >
                      {body}
                      {el.id === selectedId && (
                        <div data-testid="resize-handle" className="absolute -bottom-1 -right-1 size-2.5 cursor-se-resize rounded-[1px] border border-white bg-[#1A73E8]"
                          onPointerDown={(e) => down(e, el, "resize")} onPointerMove={move} onPointerUp={up} />
                      )}
                    </div>
                  )}
                />
              </Scaled>
            </div>
          </div>
        </div>
      </div>
      <div className="flex h-9 shrink-0 items-center gap-1 border-t border-[#D9DDE3] bg-white px-3 text-xs text-[#4B5563]">
        <Button variant="ghost" size="icon-xs" data-testid="zoom-out-button" onClick={() => onZoom(Math.max(0.25, zoom - 0.25))}><Minus /></Button>
        <Button variant="ghost" size="icon-xs" data-testid="zoom-fit-button" title="Fit" onClick={() => onZoom(fitZoom)}><Maximize /></Button>
        <Button variant="ghost" size="icon-xs" data-testid="zoom-in-button" onClick={() => onZoom(Math.min(8, zoom + 0.25))}><Plus /></Button>
        <span className="w-12 text-center font-mono" data-testid="zoom-level">{Math.round(zoom * 100)}%</span>
        <span className="ml-auto font-mono text-[#6B7280]" data-testid="label-dimensions">{tpl.width_mm} × {tpl.height_mm} mm</span>
      </div>
    </div>
  );
}
