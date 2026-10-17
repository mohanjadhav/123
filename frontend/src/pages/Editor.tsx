import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine, ArrowUpToLine, Barcode, ChevronLeft, ChevronRight, CopyPlus, Image as ImageIcon,
  Minus, Plus, Printer, QrCode, Save, Square, Trash2, Type,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { elementBoxStyle, Label as LabelView, Scaled } from "@/components/label/Label";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SheetImporter, VariableChips } from "@/components/SheetImporter";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { apiGet, apiPut } from "@/lib/api";
import { fetchSheet, fetchSources, FONTS, MM_TO_PX, newElement } from "@/lib/label";
import type { BarcodeFormat, ElementType, LabelElement, Template, TemplateBase } from "@/lib/types";
import { cn } from "@/lib/utils";

const ADDERS: { type: ElementType; label: string; icon: ReactNode; testId: string }[] = [
  { type: "text", label: "Text", icon: <Type />, testId: "add-text-button" },
  { type: "barcode", label: "Barcode", icon: <Barcode />, testId: "add-barcode-button" },
  { type: "qrcode", label: "QR code", icon: <QrCode />, testId: "add-qrcode-button" },
  { type: "rect", label: "Shape", icon: <Square />, testId: "add-shape-button" },
  { type: "image", label: "Image", icon: <ImageIcon />, testId: "add-image-button" },
];
const BARCODE_FORMATS: BarcodeFormat[] = ["CODE128", "CODE39", "EAN13", "UPC", "ITF14"];
const round = (n: number) => Math.round(n * 2) / 2;
const panel = "border-[#2A303C] bg-[#16191F]";

function NumField({ label, value, onChange, step = 0.5, testId }: { label: string; value: number; onChange: (v: number) => void; step?: number; testId: string }) {
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
      <Input type="number" step={step} value={Number.isFinite(value) ? value : 0} data-testid={testId} className="h-8 font-mono text-xs"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  );
}

function ColorField({ label, value, onChange, allowNone, testId }: { label: string; value: string; onChange: (v: string) => void; allowNone?: boolean; testId: string }) {
  const none = value === "transparent";
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="color" data-testid={testId} value={none ? "#ffffff" : value} onChange={(e) => onChange(e.target.value)}
          className={cn("h-8 w-10 cursor-pointer rounded border border-[#2A303C] bg-transparent", none && "opacity-30")} />
        {allowNone && (
          <button type="button" data-testid={`${testId}-none`} onClick={() => onChange(none ? "#0F0F10" : "transparent")}
            className={cn("rounded border px-2 py-1 text-[10px]", none ? "border-[#FF5B26] text-[#FF7143]" : "border-[#2A303C] text-neutral-400")}>
            None
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-[#2A303C] px-4 py-4">
      <h4 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">{title}</h4>
      {children}
    </section>
  );
}

export default function Editor() {
  const { id = "" } = useParams();
  const { data, isLoading, isError } = useQuery({ queryKey: ["templates", id], queryFn: () => apiGet<Template>(`/templates/${id}`) });
  if (data) return <EditorInner key={data.id} initial={data} />;
  return (
    <div className="min-h-screen bg-[#0F1115] text-neutral-300">
      <AppHeader />
      <p className="p-10 text-sm text-neutral-500" data-testid="editor-status">
        {isLoading ? "Loading template…" : isError ? "Template not found or unavailable." : ""}
      </p>
    </div>
  );
}

function EditorInner({ initial }: { initial: Template }) {
  const qc = useQueryClient();
  const [tpl, setTpl] = useState<TemplateBase>(() => ({
    name: initial.name, brand: initial.brand, width_mm: initial.width_mm, height_mm: initial.height_mm,
    background: initial.background, elements: initial.elements,
  }));
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(() =>
    Math.max(0.5, Math.min(4, Math.min(640 / (initial.width_mm * MM_TO_PX), 520 / (initial.height_mm * MM_TO_PX)))),
  );
  const [sourceId, setSourceId] = useState<string>("");
  const [rowIdx, setRowIdx] = useState(0);
  const [livePreview, setLivePreview] = useState(false);
  const drag = useRef<{ id: string; mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);

  const selected = tpl.elements.find((e) => e.id === selectedId) ?? null;

  const sources = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const activeSourceId = sourceId || sources.data?.[0]?.id || ""; // newest sheet by default
  const source = sources.data?.find((s) => s.id === activeSourceId);
  const sheet = useQuery({ queryKey: ["sheet", source?.url], queryFn: () => fetchSheet(source!.url), enabled: !!source });
  const rows = sheet.isError ? [] : (sheet.data?.rows ?? []);
  const row = livePreview && rows.length ? rows[Math.min(rowIdx, rows.length - 1)] : null;

  const update = useCallback((patch: Partial<TemplateBase>) => {
    setTpl((t) => ({ ...t, ...patch }));
    setDirty(true);
  }, []);
  const updateEl = useCallback((elId: string, patch: Partial<LabelElement>) => {
    setTpl((t) => ({ ...t, elements: t.elements.map((e) => (e.id === elId ? { ...e, ...patch } : e)) }));
    setDirty(true);
  }, []);
  const removeEl = useCallback((elId: string) => {
    setTpl((t) => ({ ...t, elements: t.elements.filter((e) => e.id !== elId) }));
    setSelectedId(null);
    setDirty(true);
  }, []);

  const save = useMutation({
    mutationFn: () => apiPut<Template>(`/templates/${initial.id}`, tpl),
    onSuccess: (t) => {
      qc.setQueryData(["templates", t.id], t);
      qc.invalidateQueries({ queryKey: ["templates"], exact: true });
      setDirty(false);
      toast.success("Template saved");
    },
    onError: () => toast.error("Save failed"),
  });

  // Keyboard: nudge, delete, save.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save.mutate();
        return;
      }
      const tag = (e.target as HTMLElement).tagName;
      if (!selected || ["INPUT", "TEXTAREA", "SELECT"].includes(tag) || (e.target as HTMLElement).isContentEditable) return;
      const step = e.shiftKey ? 5 : 0.5;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        updateEl(selected.id, { x: round(selected.x + moves[e.key][0]), y: round(selected.y + moves[e.key][1]) });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeEl(selected.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, updateEl, removeEl, save]);

  const add = (type: ElementType) => {
    const el = newElement(type, tpl);
    update({ elements: [...tpl.elements, el] });
    setSelectedId(el.id);
  };

  const reorder = (dir: "front" | "back") => {
    if (!selected) return;
    const rest = tpl.elements.filter((e) => e.id !== selected.id);
    update({ elements: dir === "front" ? [...rest, selected] : [selected, ...rest] });
  };

  const duplicateEl = () => {
    if (!selected) return;
    const copy = { ...selected, id: crypto.randomUUID(), x: selected.x + 2, y: selected.y + 2 };
    update({ elements: [...tpl.elements, copy] });
    setSelectedId(copy.id);
  };

  const insertColumn = (col: string) => {
    const tag = `{{${col}}}`;
    if (!selected) {
      const el = { ...newElement("text", tpl), content: tag };
      update({ elements: [...tpl.elements, el] });
      setSelectedId(el.id);
      return;
    }
    if (selected.type === "image") updateEl(selected.id, { image_url: tag });
    else if (selected.type === "text") updateEl(selected.id, { content: selected.content ? `${selected.content} ${tag}` : tag });
    else if (selected.type === "rect") return toast.info("Shapes cannot hold data");
    else updateEl(selected.id, { content: tag });
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>, el: LabelElement, mode: "move" | "resize") => {
    e.stopPropagation();
    setSelectedId(el.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: el.id, mode, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / (MM_TO_PX * zoom);
    const dy = (e.clientY - d.sy) / (MM_TO_PX * zoom);
    if (d.mode === "move") updateEl(d.id, { x: round(d.ox + dx), y: round(d.oy + dy) });
    else updateEl(d.id, { w: Math.max(1, round(d.ow + dx)), h: Math.max(1, round(d.oh + dy)) });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const onImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    if (file.size > 1_500_000) return toast.error("Image must be under 1.5 MB");
    const reader = new FileReader();
    reader.onload = () => updateEl(selected.id, { image_url: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const columns = useMemo(() => (sheet.isError ? [] : (sheet.data?.columns ?? [])), [sheet.data, sheet.isError]);

  return (
    <div className="flex h-screen flex-col bg-[#0F1115] text-neutral-200">
      <AppHeader>
        <span className="hidden font-mono text-xs text-neutral-500 md:inline" data-testid="save-status">
          {dirty ? "● Unsaved changes" : "All changes saved"}
        </span>
        <Link to={`/print?template=${initial.id}`} data-testid="editor-print-link" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Printer /> Print
        </Link>
        <Button size="sm" data-testid="save-template-button" onClick={() => save.mutate()} disabled={save.isPending}
          className="bg-[#FF5B26] text-[#0F1115] hover:bg-[#FF7143]">
          <Save /> Save
        </Button>
      </AppHeader>

      <div className="flex min-h-0 flex-1">
        {/* Left dock */}
        <aside className={cn("w-72 shrink-0 overflow-y-auto border-r", panel)} data-testid="left-dock">
          <section className="border-b border-[#2A303C] p-3">
            <h4 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">Add elements</h4>
            <div className="grid grid-cols-3 gap-1.5">
              {ADDERS.map((a) => (
                <button key={a.type} data-testid={a.testId} onClick={() => add(a.type)}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-[#2A303C] bg-[#1A1E24] px-1 py-2.5 text-[11px] text-neutral-300 transition-[border-color,background-color] duration-150 hover:border-[#FF5B26] hover:bg-[#1F242C] [&_svg]:size-4 [&_svg]:text-[#FF7143]">
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-3 border-b border-[#2A303C] p-3" data-testid="sheet-variables-panel">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#06B6D4]">Sheet variables</h4>
            <Select value={activeSourceId} onValueChange={(v: string) => { setSourceId(v); setRowIdx(0); setLivePreview(true); }}>
              <SelectTrigger className="w-full" data-testid="editor-source-select">
                <SelectValue placeholder="Choose a sheet">{(v) => sources.data?.find((s) => s.id === v)?.name ?? "Choose a sheet"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(sources.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <SheetImporter sources={sources.data ?? []} templateId={initial.id}
              onImported={(created) => { setSourceId(created[0].id); setRowIdx(0); setLivePreview(true); }} />
            {sheet.isFetching && <p className="text-xs text-neutral-500">Loading sheet…</p>}
            {sheet.isError && <p className="text-xs text-red-400" data-testid="editor-sheet-error">Could not load this sheet.</p>}
            {columns.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] leading-relaxed text-neutral-400">
                  Column headers from <span className="text-white">{source?.name}</span>. Click one to insert it into the selected element — or add it as new text if nothing is selected.
                </p>
                <VariableChips columns={columns} onPick={insertColumn} />
              </div>
            )}
          </section>

          <section className="p-3">
            <h4 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">Layers</h4>
            <ul className="grid gap-1" data-testid="layers-list">
              {[...tpl.elements].reverse().map((el) => (
                <li key={el.id}>
                  <button data-testid={`layer-item-${el.id}`} onClick={() => setSelectedId(el.id)}
                    className={cn("flex w-full items-center gap-2 truncate rounded px-2 py-1.5 text-left text-xs transition-colors duration-150",
                      el.id === selectedId ? "bg-[#FF5B26]/15 text-[#FF7143]" : "text-neutral-400 hover:bg-[#1F242C]")}>
                    <span className="font-mono uppercase text-[9px] text-neutral-500">{el.type}</span>
                    <span className="truncate">{el.content || (el.image_url.startsWith("data:") ? "uploaded image" : el.image_url) || "—"}</span>
                  </button>
                </li>
              ))}
              {tpl.elements.length === 0 && <li className="text-xs text-neutral-500">Add an element to begin.</li>}
            </ul>
          </section>
        </aside>

        {/* Canvas */}
        <main className="relative flex min-w-0 flex-1 flex-col" data-testid="canvas-editor-container">
          <div className="flex-1 overflow-auto bg-[radial-gradient(#232831_1px,transparent_1px)] [background-size:18px_18px]"
            onPointerDown={() => setSelectedId(null)}>
            <div className="flex min-h-full min-w-max items-center justify-center p-16">
              <Scaled widthMm={tpl.width_mm} heightMm={tpl.height_mm} scale={zoom}
                className="shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8),0_0_0_1px_#D8D8D4]">
                <LabelView
                  template={tpl}
                  row={row}
                  testId="canvas-label-stage"
                  renderElement={(el, body) => (
                    <div
                      key={el.id}
                      data-testid={`canvas-element-${el.id}`}
                      style={elementBoxStyle(el)}
                      className={cn("cursor-move touch-none select-none", el.id === selectedId ? "outline outline-[1.5px] outline-[#FF5B26]" : "hover:outline hover:outline-1 hover:outline-[#06B6D4]")}
                      onPointerDown={(e) => onPointerDown(e, el, "move")}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                    >
                      {body}
                      {el.id === selectedId && (
                        <div
                          data-testid="resize-handle"
                          className="absolute -bottom-1 -right-1 size-2.5 cursor-se-resize rounded-[1px] border border-white bg-[#FF5B26]"
                          onPointerDown={(e) => onPointerDown(e, el, "resize")}
                          onPointerMove={onPointerMove}
                          onPointerUp={onPointerUp}
                        />
                      )}
                    </div>
                  )}
                />
              </Scaled>
            </div>
          </div>
          {/* Production strip */}
          <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-t border-[#2A303C] bg-[#16191F] px-4 text-xs text-neutral-400">
            <span className="font-mono" data-testid="label-dimensions">{tpl.width_mm} × {tpl.height_mm} mm</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-xs" data-testid="zoom-out-button" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}><Minus /></Button>
              <span className="w-12 text-center font-mono" data-testid="zoom-level">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon-xs" data-testid="zoom-in-button" onClick={() => setZoom((z) => Math.min(6, z + 0.25))}><Plus /></Button>
            </div>
            <div className="flex items-center gap-2">
              <button data-testid="preview-toggle-raw-vs-data" disabled={!rows.length} onClick={() => setLivePreview((v) => !v)}
                className={cn("rounded border px-2 py-1 font-mono text-[11px] transition-colors duration-150 disabled:opacity-40",
                  livePreview && rows.length ? "border-[#06B6D4] text-[#06B6D4]" : "border-[#2A303C]")}>
                {livePreview && rows.length ? "LIVE DATA" : "{{RAW}}"}
              </button>
              <Button variant="ghost" size="icon-xs" data-testid="row-nav-previous" disabled={!row} onClick={() => setRowIdx((i) => Math.max(0, i - 1))}><ChevronLeft /></Button>
              <span className="font-mono" data-testid="row-nav-indicator">{rows.length ? `Row ${Math.min(rowIdx, rows.length - 1) + 1} / ${rows.length}` : "No sheet"}</span>
              <Button variant="ghost" size="icon-xs" data-testid="row-nav-next" disabled={!row} onClick={() => setRowIdx((i) => Math.min(rows.length - 1, i + 1))}><ChevronRight /></Button>
            </div>
          </div>
        </main>

        {/* Inspector */}
        <aside className={cn("w-80 shrink-0 overflow-y-auto border-l", panel)} data-testid="prop-inspector-panel">
          {!selected ? (
            <>
              <Section title="Template">
                <div className="grid gap-3">
                  <div className="grid gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Name</span>
                    <Input data-testid="template-name-input" className="h-8" value={tpl.name} onChange={(e) => update({ name: e.target.value })} />
                  </div>
                  <div className="grid gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Brand</span>
                    <Input data-testid="template-brand-input" className="h-8" value={tpl.brand} onChange={(e) => update({ brand: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="Width mm" testId="template-width-input" value={tpl.width_mm} onChange={(v) => update({ width_mm: Math.max(5, v) })} />
                    <NumField label="Height mm" testId="template-height-input" value={tpl.height_mm} onChange={(v) => update({ height_mm: Math.max(5, v) })} />
                  </div>
                  <ColorField label="Paper colour" testId="template-background-input" value={tpl.background} onChange={(v) => update({ background: v })} />
                </div>
              </Section>
              <p className="px-4 py-4 text-xs leading-relaxed text-neutral-500">
                Click an element on the label to edit it. Drag to move, use the orange corner to resize, arrow keys to nudge (Shift for 5 mm).
                Use <span className="font-mono text-[#06B6D4]">{"{{column}}"}</span> in any text, barcode or QR value to pull data from your sheet.
              </p>
            </>
          ) : (
            <div data-testid="element-inspector">
              <Section title={`${selected.type} element`}>
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="X mm" testId="prop-x-input" value={selected.x} onChange={(v) => updateEl(selected.id, { x: v })} />
                  <NumField label="Y mm" testId="prop-y-input" value={selected.y} onChange={(v) => updateEl(selected.id, { y: v })} />
                  <NumField label="W mm" testId="prop-width-input" value={selected.w} onChange={(v) => updateEl(selected.id, { w: Math.max(0.2, v) })} />
                  <NumField label="H mm" testId="prop-height-input" value={selected.h} onChange={(v) => updateEl(selected.id, { h: Math.max(0.2, v) })} />
                </div>
                <div className="mt-2 grid gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Rotation</span>
                  <Select value={String(selected.rotation)} onValueChange={(v: string) => updateEl(selected.id, { rotation: Number(v) })}>
                    <SelectTrigger className="h-8 w-full" data-testid="prop-rotation-select"><SelectValue>{(v) => `${v}°`}</SelectValue></SelectTrigger>
                    <SelectContent>{[0, 90, 180, 270].map((r) => <SelectItem key={r} value={String(r)}>{r}°</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </Section>

              {selected.type !== "rect" && selected.type !== "image" && (
                <Section title="Content / data binding">
                  <Textarea data-testid="prop-content-input" rows={3} className="font-mono text-xs" value={selected.content}
                    onChange={(e) => updateEl(selected.id, { content: e.target.value })}
                    placeholder="Static text or {{column_name}}" />
                  {columns.length > 0 && (
                    <Select value="" onValueChange={(v: string) => insertColumn(v)}>
                      <SelectTrigger className="mt-2 h-8 w-full" data-testid="prop-binding-select"><SelectValue placeholder="Bind sheet column…">{() => "Bind sheet column…"}</SelectValue></SelectTrigger>
                      <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </Section>
              )}

              {selected.type === "text" && (
                <Section title="Typography">
                  <div className="grid gap-2">
                    <Select value={selected.font_family} onValueChange={(v: string) => updateEl(selected.id, { font_family: v })}>
                      <SelectTrigger className="h-8 w-full" data-testid="prop-font-select"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.keys(FONTS).map((f) => <SelectItem key={f} value={f}><span style={{ fontFamily: FONTS[f] }}>{f}</span></SelectItem>)}</SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      <NumField label="Size pt" testId="prop-font-size-input" value={selected.font_size} step={0.5} onChange={(v) => updateEl(selected.id, { font_size: Math.max(2, v) })} />
                      <div className="grid gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Weight</span>
                        <Select value={String(selected.font_weight)} onValueChange={(v: string) => updateEl(selected.id, { font_weight: Number(v) })}>
                          <SelectTrigger className="h-8 w-full" data-testid="prop-font-weight-select"><SelectValue /></SelectTrigger>
                          <SelectContent>{[400, 500, 600, 700].map((w) => <SelectItem key={w} value={String(w)}>{w}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-1" data-testid="prop-align-group">
                      {(["left", "center", "right"] as const).map((a) => (
                        <button key={a} data-testid={`prop-align-${a}`} onClick={() => updateEl(selected.id, { align: a })}
                          className={cn("flex-1 rounded border py-1 text-xs capitalize", selected.align === a ? "border-[#FF5B26] text-[#FF7143]" : "border-[#2A303C] text-neutral-400")}>
                          {a}
                        </button>
                      ))}
                    </div>
                    <ColorField label="Text colour" testId="prop-color-input" value={selected.color} onChange={(v) => updateEl(selected.id, { color: v })} />
                  </div>
                </Section>
              )}

              {selected.type === "barcode" && (
                <Section title="Barcode">
                  <div className="grid gap-3">
                    <Select value={selected.barcode_format} onValueChange={(v: string) => updateEl(selected.id, { barcode_format: v as BarcodeFormat })}>
                      <SelectTrigger className="h-8 w-full" data-testid="prop-barcode-format"><SelectValue /></SelectTrigger>
                      <SelectContent>{BARCODE_FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-xs text-neutral-300">
                      <Checkbox data-testid="prop-show-text-checkbox" checked={selected.show_text} onCheckedChange={(c) => updateEl(selected.id, { show_text: !!c })} />
                      Show human-readable value
                    </label>
                  </div>
                </Section>
              )}

              {selected.type === "qrcode" && (
                <Section title="QR code">
                  <ColorField label="Module colour" testId="prop-qr-color-input" value={selected.color} onChange={(v) => updateEl(selected.id, { color: v })} />
                </Section>
              )}

              {selected.type === "image" && (
                <Section title="Image">
                  <div className="grid gap-2">
                    <Input data-testid="prop-image-url-input" className="h-8 text-xs" placeholder="https://… or {{logo_url}}"
                      value={selected.image_url.startsWith("data:") ? "(uploaded image)" : selected.image_url}
                      onChange={(e) => updateEl(selected.id, { image_url: e.target.value })} />
                    <Input type="file" accept="image/*" data-testid="prop-image-upload-input" className="h-8 text-xs" onChange={onImageUpload} />
                  </div>
                </Section>
              )}

              {(selected.type === "rect" || selected.type === "text") && (
                <Section title="Appearance">
                  <div className="grid grid-cols-2 gap-2">
                    <ColorField label="Fill" testId="prop-fill-input" allowNone value={selected.fill} onChange={(v) => updateEl(selected.id, { fill: v })} />
                    <ColorField label="Stroke" testId="prop-stroke-input" value={selected.stroke} onChange={(v) => updateEl(selected.id, { stroke: v })} />
                    <NumField label="Stroke mm" testId="prop-stroke-width-input" step={0.1} value={selected.stroke_width} onChange={(v) => updateEl(selected.id, { stroke_width: Math.max(0, v) })} />
                    <NumField label="Radius mm" testId="prop-radius-input" value={selected.radius} onChange={(v) => updateEl(selected.id, { radius: Math.max(0, v) })} />
                  </div>
                </Section>
              )}

              <Section title="Arrange">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" data-testid="bring-front-button" onClick={() => reorder("front")}><ArrowUpToLine /> Front</Button>
                  <Button variant="outline" size="sm" data-testid="send-back-button" onClick={() => reorder("back")}><ArrowDownToLine /> Back</Button>
                  <Button variant="outline" size="sm" data-testid="duplicate-element-button" onClick={duplicateEl}><CopyPlus /> Duplicate</Button>
                  <Button variant="destructive" size="sm" data-testid="delete-element-button" onClick={() => removeEl(selected.id)}><Trash2 /> Delete</Button>
                </div>
              </Section>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
