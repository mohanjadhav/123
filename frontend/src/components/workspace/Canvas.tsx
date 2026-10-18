import { useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { Magnet, Maximize, Minus, Plus } from "lucide-react";
import { bbox, intersects, snapBox, snapEdge } from "@/lib/align";
import { elementBoxStyle, Label as LabelView, Scaled } from "@/components/label/Label";
import { Button } from "@/components/ui/button";
import { MM_TO_PX } from "@/lib/label";
import { uiZoom } from "@/lib/theme";
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

type Origin = { x: number; y: number; w: number; h: number };
type Drag = { mode: "move" | "resize"; id: string; sx: number; sy: number; origins: Record<string, Origin>; others: Box[]; moved: boolean };
type Box = { l: number; t: number; r: number; b: number };
const toBox = (e: Origin): Box => ({ l: e.x, t: e.y, r: e.x + e.w, b: e.y + e.h });

export function Canvas({ tpl, row, mapping, zoom, onZoom, fitZoom, selectedIds, onSelectIds, onChangeEls, onBeginChange, onDropField }: {
  tpl: TemplateBase;
  row: Row | null;
  mapping: Mapping;
  zoom: number;
  onZoom: (z: number) => void;
  fitZoom: number;
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  onChangeEls: (patches: Record<string, Partial<LabelElement>>) => void;
  onBeginChange: () => void;
  onDropField: (col: string, xMm: number, yMm: number) => void;
}) {
  const drag = useRef<Drag | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [snap, setSnap] = useState(() => localStorage.getItem("rl.snap") !== "off");
  const single = selectedIds.length === 1 ? selectedIds[0] : null;
  const pxPerMm = () => MM_TO_PX * zoom * uiZoom(); // screen px per mm (canvas zoom × app size)

  const down = (e: ReactPointerEvent<HTMLDivElement>, el: LabelElement, mode: "move" | "resize") => {
    e.stopPropagation();
    if (mode === "move" && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      onSelectIds(selectedIds.includes(el.id) ? selectedIds.filter((i) => i !== el.id) : [...selectedIds, el.id]);
      return;
    }
    const ids = mode === "resize" ? [el.id] : selectedIds.includes(el.id) ? selectedIds : [el.id];
    if (!selectedIds.includes(el.id) || mode === "resize") onSelectIds(ids);
    e.currentTarget.setPointerCapture(e.pointerId);
    const origins: Record<string, Origin> = {};
    for (const x of tpl.elements) if (ids.includes(x.id)) origins[x.id] = { x: x.x, y: x.y, w: x.w, h: x.h };
    const others = tpl.elements.filter((x) => !ids.includes(x.id)).map(toBox);
    drag.current = { mode, id: el.id, sx: e.clientX, sy: e.clientY, origins, others, moved: false };
  };

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const k = pxPerMm();
    const dx = (e.clientX - d.sx) / k;
    const dy = (e.clientY - d.sy) / k;
    if (!d.moved) {
      if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) return;
      d.moved = true;
      onBeginChange(); // one undo step per drag
    }
    const useSnap = snap && !e.altKey;
    const th = 6 / k; // 6 screen px
    const patches: Record<string, Partial<LabelElement>> = {};
    if (d.mode === "move") {
      const ob = bbox(Object.values(d.origins));
      const s = useSnap ? snapBox({ l: ob.l + dx, t: ob.t + dy, r: ob.r + dx, b: ob.b + dy }, d.others, tpl, th) : { dx: null, dy: null, gx: [], gy: [] };
      for (const [id, o] of Object.entries(d.origins)) {
        patches[id] = {
          x: s.dx !== null ? Math.round((o.x + dx + s.dx) * 100) / 100 : round(o.x + dx),
          y: s.dy !== null ? Math.round((o.y + dy + s.dy) * 100) / 100 : round(o.y + dy),
        };
      }
      setGuides({ x: s.gx, y: s.gy });
    } else {
      const o = d.origins[d.id];
      const xs = [0, tpl.width_mm / 2, tpl.width_mm, ...d.others.flatMap((b) => [b.l, (b.l + b.r) / 2, b.r])];
      const ys = [0, tpl.height_mm / 2, tpl.height_mm, ...d.others.flatMap((b) => [b.t, (b.t + b.b) / 2, b.b])];
      const hx = useSnap ? snapEdge(o.x + o.w + dx, xs, th) : null;
      const hy = useSnap ? snapEdge(o.y + o.h + dy, ys, th) : null;
      patches[d.id] = {
        w: Math.max(1, hx !== null ? Math.round((hx - o.x) * 100) / 100 : round(o.w + dx)),
        h: Math.max(1, hy !== null ? Math.round((hy - o.y) * 100) / 100 : round(o.h + dy)),
      };
      setGuides({ x: hx !== null ? [hx] : [], y: hy !== null ? [hy] : [] });
    }
    onChangeEls(patches);
  };
  const up = () => { drag.current = null; setGuides({ x: [], y: [] }); };

  // Drag a box on empty label space to select several elements (Shift adds to the selection).
  const startMarquee = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const k = pxPerMm();
    const at = (ev: PointerEvent | ReactPointerEvent) => ({ x: (ev.clientX - r.left) / k, y: (ev.clientY - r.top) / k });
    const start = at(e);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    let box: Box = { l: start.x, t: start.y, r: start.x, b: start.y };
    const onMove = (ev: PointerEvent) => {
      const p = at(ev);
      box = { l: Math.min(start.x, p.x), t: Math.min(start.y, p.y), r: Math.max(start.x, p.x), b: Math.max(start.y, p.y) };
      setMarquee(box);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setMarquee(null);
      if (box.r - box.l < 0.5 && box.b - box.t < 0.5) return onSelectIds(additive ? selectedIds : []);
      const hits = tpl.elements.filter((x) => intersects(toBox(x), box)).map((x) => x.id);
      onSelectIds(additive ? [...new Set([...selectedIds, ...hits])] : hits);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const col = e.dataTransfer.getData("application/x-label-field");
    if (!col || !stageRef.current) return;
    e.preventDefault();
    const r = stageRef.current.getBoundingClientRect();
    const k = pxPerMm();
    onDropField(col, round((e.clientX - r.left) / k), round((e.clientY - r.top) / k));
  };
  const hair = `${1 / zoom}px`;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#E3E6EA]" data-testid="canvas-editor-container">
      <div className="flex-1 overflow-auto" onPointerDown={(e) => !(e.shiftKey || e.ctrlKey) && onSelectIds([])}>
        <div className="flex min-h-full min-w-max items-center justify-center p-10">
          <div className="grid" style={{ gridTemplateColumns: `${RULER}px auto`, gridTemplateRows: `${RULER}px auto` }}>
            <div className="grid place-items-center bg-[#F3F4F6] text-[8px] font-semibold text-[#6B7280]">mm</div>
            <div className="bg-[#F3F4F6]"><Ruler lengthMm={tpl.width_mm} zoom={zoom} /></div>
            <div className="bg-[#F3F4F6]"><Ruler lengthMm={tpl.height_mm} zoom={zoom} vertical /></div>
            <div ref={stageRef} onDragOver={(e) => e.dataTransfer.types.includes("application/x-label-field") && e.preventDefault()} onDrop={onDrop}>
              <Scaled widthMm={tpl.width_mm} heightMm={tpl.height_mm} scale={zoom} className="shadow-[0_2px_10px_rgba(0,0,0,0.15)] outline outline-1 outline-[#C7CCD3]">
                <div className="relative">
                <LabelView
                  onBackgroundPointerDown={startMarquee}
                  template={tpl}
                  dpi={tpl.page_setup?.dpi ?? 0}
                  row={row}
                  mapping={mapping}
                  testId="canvas-label-stage"
                  renderElement={(el, body) => (
                    <div
                      key={el.id}
                      data-testid={`canvas-element-${el.id}`}
                      style={elementBoxStyle(el)}
                      className={cn("cursor-move touch-none select-none", selectedIds.includes(el.id) ? "outline outline-[1.5px] outline-(--app-accent)" : "hover:outline hover:outline-1 hover:outline-dashed hover:outline-(--app-accent)/60")}
                      onPointerDown={(e) => down(e, el, "move")}
                      onPointerMove={move}
                      onPointerUp={up}
                    >
                      {body}
                      {el.id === single && (
                        <div data-testid="resize-handle" className="absolute -bottom-1 -right-1 size-2.5 cursor-se-resize rounded-[1px] border border-white bg-(--app-accent)"
                          onPointerDown={(e) => down(e, el, "resize")} onPointerMove={move} onPointerUp={up} />
                      )}
                    </div>
                  )}
                />
                <div className="pointer-events-none absolute inset-0" data-testid="canvas-overlay">
                  {guides.x.map((x) => <div key={`gx${x}`} data-testid="snap-guide-x" className="absolute inset-y-0 bg-[#EC4899]" style={{ left: `${x}mm`, width: hair, marginLeft: `-${1 / zoom / 2}px` }} />)}
                  {guides.y.map((y) => <div key={`gy${y}`} data-testid="snap-guide-y" className="absolute inset-x-0 bg-[#EC4899]" style={{ top: `${y}mm`, height: hair, marginTop: `-${1 / zoom / 2}px` }} />)}
                  {marquee && <div data-testid="selection-marquee" className="absolute border border-dashed border-(--app-accent) bg-(--app-accent)/10"
                    style={{ left: `${marquee.l}mm`, top: `${marquee.t}mm`, width: `${marquee.r - marquee.l}mm`, height: `${marquee.b - marquee.t}mm`, borderWidth: hair }} />}
                </div>
                </div>
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
        <span className="mx-1 h-4 w-px bg-[#E5E7EB]" />
        <button data-testid="snap-toggle" title="Snap to label edges, centre and other elements (hold Alt while dragging to skip)"
          onClick={() => { localStorage.setItem("rl.snap", snap ? "off" : "on"); setSnap(!snap); }}
          className={cn("flex h-6 items-center gap-1 rounded px-1.5 transition-colors duration-150 [&_svg]:size-3.5", snap ? "bg-[#FCE7F3] text-[#BE185D]" : "text-[#6B7280] hover:bg-[#F3F4F6]")}>
          <Magnet /> Snap {snap ? "on" : "off"}
        </button>
        {selectedIds.length > 1 && <span className="ml-2 text-(--app-accent)" data-testid="canvas-selection-count">{selectedIds.length} selected</span>}
        <span className="ml-3 hidden text-[#9CA3AF] xl:inline">Shift+click or drag a box to select several</span>
        <span className="ml-auto font-mono text-[#6B7280]" data-testid="label-dimensions">{tpl.width_mm} × {tpl.height_mm} mm</span>
      </div>
    </div>
  );
}
