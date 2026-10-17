import { useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, Eye, FileSpreadsheet, Import, Printer, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Row, SheetSource } from "@/lib/types";
import { cn } from "@/lib/utils";

const NONE = "__none__";
const MIN_W = 56;

const MAX_AUTO_W = 360;
let measureCtx: CanvasRenderingContext2D | null = null;

/** Real rendered width of the header + every value in the column (grid font), so columns size to their content. */
function measureWidths(columns: string[], rows: Row[]): Record<string, number> {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  const ctx = measureCtx;
  const out: Record<string, number> = {};
  for (const c of columns) {
    let w: number;
    if (!ctx) {
      w = Math.max(c.length * 8.5, ...rows.slice(0, 500).map((r) => (r[c] ?? "").length * 7));
    } else {
      ctx.font = "600 12px 'IBM Plex Sans', sans-serif";
      w = ctx.measureText(c).width + 8; // room for resize grip
      ctx.font = "400 12px 'IBM Plex Sans', sans-serif";
      const seen = new Set<string>();
      for (const r of rows.slice(0, 5000)) {
        const v = r[c] ?? "";
        if (!v || seen.has(v)) continue;
        seen.add(v);
        w = Math.max(w, ctx.measureText(v).width);
      }
    }
    out[c] = Math.max(MIN_W, Math.min(MAX_AUTO_W, Math.ceil(w + 18))); // + cell padding & border
  }
  return out;
}

export interface GridSelection {
  key: string; // sheet url the selection belongs to
  excluded: Set<number>;
  qty: Record<number, number>;
}

export function DataGrid({ sources, activeSourceId, onChooseSource, onDeleteSource, columns, rows, loading, error, canRefresh, onRefresh, onOpenImport,
  selection, onSelection, onPrintRow, onPreview, onPrint, collapsed, onToggle }: {
  sources: SheetSource[];
  activeSourceId: string | null;
  onChooseSource: (id: string | null) => void;
  onDeleteSource: (id: string) => void;
  columns: string[];
  rows: Row[];
  loading: boolean;
  error: string | null;
  canRefresh: boolean;
  onRefresh: () => void;
  onOpenImport: () => void;
  selection: GridSelection;
  onSelection: (s: GridSelection) => void;
  onPrintRow: (r: Row) => void;
  onPreview: () => void;
  onPrint: () => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [q, setQ] = useState("");
  const [widths, setWidths] = useState<Record<string, number>>({});
  const auto = useMemo(() => measureWidths(columns, rows), [columns, rows]); // recalculates on refresh / new sheet
  const widthOf = (c: string) => widths[c] ?? auto[c] ?? 120;
  const startResize = (e: ReactPointerEvent<HTMLSpanElement>, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widthOf(col);
    const onMove = (ev: PointerEvent) => setWidths((w) => ({ ...w, [col]: Math.max(MIN_W, Math.round(startW + ev.clientX - startX)) }));
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); document.body.style.cursor = ""; };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const visible = rows.map((r, i) => ({ r, i })).filter(({ r }) => !q || Object.values(r).some((v) => v.toLowerCase().includes(q.toLowerCase())));
  const isOn = (i: number) => !selection.excluded.has(i);
  const allOn = visible.length > 0 && visible.every(({ i }) => isOn(i));
  const total = rows.reduce((n, _, i) => n + (isOn(i) ? (selection.qty[i] ?? 1) : 0), 0);
  const active = sources.find((s) => s.id === activeSourceId);

  const setOn = (idx: number[], on: boolean) => {
    const ex = new Set(selection.excluded);
    idx.forEach((i) => (on ? ex.delete(i) : ex.add(i)));
    onSelection({ ...selection, excluded: ex });
  };

  return (
    <section className={cn("flex shrink-0 flex-col border-t border-[#C7CCD3] bg-white", collapsed ? "h-10" : "h-[clamp(220px,36vh,420px)]")} data-testid="print-data-panel">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[#E5E7EB] bg-[#F8F9FB] px-3">
        <button onClick={onToggle} data-testid="print-data-toggle" className="flex items-center gap-1.5 text-sm font-semibold text-[#1F2937]">
          {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />} Label print data
        </button>
        <Button size="sm" data-testid="import-data-button" onClick={onOpenImport} className="ml-2 h-7 bg-[#1A73E8] text-white hover:bg-[#1765CC]">
          <Import /> Import
        </Button>
        <Select value={activeSourceId ?? NONE} onValueChange={(v: string) => onChooseSource(v === NONE ? null : v)}>
          <SelectTrigger size="sm" className="h-7 w-56 bg-white" data-testid="sheet-source-select">
            <FileSpreadsheet className="size-3.5 text-[#188038]" />
            <SelectValue>{(v) => sources.find((s) => s.id === v)?.name ?? "No sheet connected"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No sheet connected</SelectItem>
            {sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {active && (
          <>
            <Button size="sm" variant="outline" className="h-7 bg-white" data-testid="sheet-refresh-button" disabled={!canRefresh || loading} onClick={onRefresh}
              title={canRefresh ? "Pull the latest rows from Google Sheets" : "Uploaded files can't refresh — upload again to update"}>
              <RefreshCw className={cn(loading && "animate-spin")} /> Refresh
            </Button>
            <Button size="icon-sm" variant="ghost" className="size-7" data-testid="sheet-delete-button" title="Remove this sheet"
              onClick={() => confirm(`Remove "${active.name}" from saved sheets?`) && onDeleteSource(active.id)}>
              <Trash2 />
            </Button>
          </>
        )}
        {!collapsed && rows.length > 0 && (
          <div className="relative ml-2">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rows" data-testid="rows-search-input" className="h-7 w-44 bg-white pl-7 text-xs" />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[#4B5563]" data-testid="print-batch-status">
            {rows.length ? <><b>{total}</b> label{total === 1 ? "" : "s"} · {rows.length - selection.excluded.size}/{rows.length} rows</> : null}
          </span>
          <Button size="sm" variant="outline" className="h-7 bg-white" data-testid="open-print-modal-button" onClick={onPreview}><Eye /> Preview</Button>
          <Button size="sm" className="h-7 bg-[#188038] text-white hover:bg-[#146C2E]" data-testid="grid-print-button" onClick={onPrint}><Printer /> Print</Button>
        </div>
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-auto">
          {loading && rows.length === 0 ? (
            <p className="p-4 text-sm text-[#6B7280]" data-testid="sheet-loading">Loading sheet…</p>
          ) : error ? (
            <p className="p-4 text-sm text-[#D93025]" data-testid="sheet-error">{error}</p>
          ) : rows.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-sm text-[#6B7280]" data-testid="rows-empty">
              <div>
                <FileSpreadsheet className="mx-auto mb-2 size-7 text-[#188038]" />
                <p>Connect a Google Sheet or upload a CSV / Excel file to print labels from it.</p>
                <Button size="sm" data-testid="rows-empty-import-button" onClick={onOpenImport} className="mt-3 bg-[#1A73E8] text-white hover:bg-[#1765CC]"><Import /> Import data</Button>
              </div>
            </div>
          ) : (
            <table className="table-fixed border-collapse text-xs" style={{ width: 40 + 40 + 64 + 40 + columns.reduce((n, c) => n + widthOf(c), 0), minWidth: "100%" }} data-testid="sheets-data-table">
              <colgroup>
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 64 }} />
                {columns.map((c) => <col key={c} style={{ width: widthOf(c) }} />)}
                <col style={{ width: 40 }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[#F3F4F6] text-left text-[#374151]">
                <tr>
                  <th className="border-b border-r border-[#E5E7EB] px-2 py-1.5 text-center font-medium text-[#9CA3AF]">#</th>
                  <th className="border-b border-r border-[#E5E7EB] px-2 py-1.5 text-center">
                    <Checkbox data-testid="select-all-rows-checkbox" checked={allOn} onCheckedChange={() => setOn(visible.map((v) => v.i), !allOn)} />
                  </th>
                  <th className="border-b border-r border-[#E5E7EB] px-2 py-1.5 font-semibold">Qty</th>
                  {columns.map((c) => (
                    <th key={c} data-testid={`grid-col-header-${c}`} title={c} className="relative truncate border-b border-r border-[#E5E7EB] px-2 py-1.5 font-semibold">
                      {c}
                      <span
                        data-testid={`grid-col-resize-${c}`}
                        title="Drag to resize · double-click to auto-fit"
                        onPointerDown={(e) => startResize(e, c)}
                        onDoubleClick={() => setWidths(({ [c]: _drop, ...rest }) => rest)}
                        className="absolute right-0 top-0 z-10 h-full w-2.5 cursor-col-resize touch-none after:absolute after:right-0.5 after:top-1/4 after:h-1/2 after:w-0.5 after:rounded after:bg-[#C7CCD3] after:transition-colors after:duration-150 hover:after:bg-[#1A73E8]"
                      />
                    </th>
                  ))}
                  <th className="border-b border-[#E5E7EB]" />
                </tr>
              </thead>
              <tbody>
                {visible.map(({ r, i }) => (
                  <tr key={i} data-testid={`sheet-row-${i}`} className={cn("transition-colors duration-100 hover:bg-[#F8FAFF]", !isOn(i) && "text-[#9CA3AF]")}>
                    <td className="border-b border-r border-[#EEF0F2] bg-[#F9FAFB] px-2 py-1 text-center font-mono text-[10px] text-[#9CA3AF]">{i + 1}</td>
                    <td className="border-b border-r border-[#EEF0F2] px-2 py-1 text-center">
                      <Checkbox data-testid={`row-checkbox-${i}`} checked={isOn(i)} onCheckedChange={() => setOn([i], !isOn(i))} />
                    </td>
                    <td className="border-b border-r border-[#EEF0F2] px-1 py-0.5">
                      <input type="number" min={1} data-testid={`row-qty-input-${i}`} value={selection.qty[i] ?? 1}
                        onChange={(e) => onSelection({ ...selection, qty: { ...selection.qty, [i]: Math.max(1, Math.min(999, parseInt(e.target.value) || 1)) } })}
                        className="h-6 w-full rounded border border-transparent bg-transparent px-1.5 font-mono text-xs outline-none focus:border-[#1A73E8] focus:bg-white" />
                    </td>
                    {columns.map((c) => <td key={c} title={r[c]} className="truncate border-b border-r border-[#EEF0F2] px-2 py-1">{r[c]}</td>)}
                    <td className="border-b border-[#EEF0F2] px-1 text-center">
                      <Button variant="ghost" size="icon-xs" title="Print just this label" data-testid={`print-row-${i}`} onClick={() => onPrintRow(r)}><Printer /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
