import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Eye, FileSpreadsheet, Import, PencilLine, Printer, RefreshCw, Search, Trash2 } from "lucide-react";
import { ColumnHeader } from "@/components/workspace/ColumnHeader";
import { SheetTabs } from "@/components/workspace/SheetTabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QtyColumnSelect } from "@/components/workspace/QtyColumnSelect";
import { rowQty, useColumnWidths } from "@/lib/grid";
import type { CopyRow, Row, SheetSource } from "@/lib/types";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export function DataGrid({ sources, activeSourceId, onChooseSource, onDeleteSource, columns, rows, edited, loading, error, canRefresh, refreshing, onRefresh, onOpenImport,
  onToggle, onQty, qtyColumn, onQtyColumn, onPrintRow, onPreview, onPrint, collapsed, onCollapse, onEditData }: {
  sources: SheetSource[];
  activeSourceId: string | null;
  onChooseSource: (id: string | null) => void;
  onDeleteSource: (id: string) => void;
  columns: string[];
  rows: CopyRow[];
  edited: boolean;
  loading: boolean;
  error: string | null;
  canRefresh: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenImport: () => void;
  onToggle: (ids: string[], on: boolean) => void;
  onQty: (id: string, qty: number) => void;
  qtyColumn: string | null;
  onQtyColumn: (col: string | null) => void;
  onPrintRow: (r: Row) => void;
  onPreview: () => void;
  onPrint: () => void;
  collapsed: boolean;
  onCollapse: () => void;
  onEditData: () => void;
}) {
  const [q, setQ] = useState("");
  const cellRows = useMemo(() => rows.map((r) => r.cells), [rows]);
  const { widthOf, startResize, autoFit } = useColumnWidths(columns, cellRows);
  const visible = rows.map((r, i) => ({ r, i })).filter(({ r }) => !q || Object.values(r.cells).some((v) => v.toLowerCase().includes(q.toLowerCase())));
  const allOn = visible.length > 0 && visible.every(({ r }) => r.selected);
  const total = rows.reduce((n, r) => n + (r.selected ? rowQty(r, qtyColumn) : 0), 0);
  const ticked = rows.filter((r) => r.selected).length;
  const active = sources.find((s) => s.id === activeSourceId);

  return (
    <section className={cn("flex shrink-0 flex-col border-t border-[#C7CCD3] bg-white", collapsed ? "h-10" : "h-[clamp(240px,38vh,450px)]")} data-testid="print-data-panel">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[#E5E7EB] bg-[#F8F9FB] px-3">
        <button onClick={onCollapse} data-testid="print-data-toggle" className="flex items-center gap-1.5 text-sm font-semibold text-[#1F2937]">
          {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />} Label print data
        </button>
        <Button size="sm" data-testid="import-data-button" onClick={onOpenImport} className="ml-2 h-7 bg-(--app-accent) text-white hover:bg-(--app-accent-hover)">
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
            <Link to={`/data/${active.id}`} onClick={onEditData} data-testid="edit-sheet-data-button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 bg-white text-(--app-accent)")}>
              <PencilLine /> Open data page
            </Link>
            <Button size="sm" variant="outline" className="h-7 bg-white" data-testid="sheet-refresh-button" disabled={!canRefresh || refreshing} onClick={onRefresh}
              title={canRefresh ? "Pull the latest rows from Google Sheets" : "Uploaded files can't refresh — upload again to update"}>
              <RefreshCw className={cn(refreshing && "animate-spin")} /> Refresh
            </Button>
            <Button size="icon-sm" variant="ghost" className="size-7" data-testid="sheet-delete-button" title="Remove this sheet"
              onClick={() => confirm(`Remove "${active.name}" from saved sheets?`) && onDeleteSource(active.id)}>
              <Trash2 />
            </Button>
            {edited && <span className="rounded bg-[#FEF7E0] px-1.5 py-0.5 text-[10px] font-medium text-[#B06000]" data-testid="sheet-edited-badge">Edited in app</span>}
          </>
        )}
        {!collapsed && rows.length > 0 && (
          <div className="relative ml-1">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rows" data-testid="rows-search-input" className="h-7 w-40 bg-white pl-7 text-xs" />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {columns.length > 0 && <QtyColumnSelect columns={columns} value={qtyColumn} onChange={onQtyColumn} testId="grid-qty-column-select" />}
          <span className="text-xs text-[#4B5563]" data-testid="print-batch-status">
            {rows.length ? <><b>{total}</b> label{total === 1 ? "" : "s"} · {ticked}/{rows.length} rows</> : null}
          </span>
          <Button size="sm" variant="outline" className="h-7 bg-white" data-testid="open-print-modal-button" onClick={onPreview}><Eye /> Preview</Button>
          <Button size="sm" className="h-7 bg-[#188038] text-white hover:bg-[#146C2E]" data-testid="grid-print-button" onClick={onPrint}><Printer /> Print</Button>
        </div>
      </div>

      {!collapsed && <SheetTabs sources={sources} active={active ?? null} onSelect={(s) => onChooseSource(s.id)} testId="grid-sheet-tabs" />}
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
                <p>{active ? "This sheet has no rows." : "Connect a Google Sheet or upload a CSV / Excel file to print labels from it."}</p>
                <Button size="sm" data-testid="rows-empty-import-button" onClick={onOpenImport} className="mt-3 bg-(--app-accent) text-white hover:bg-(--app-accent-hover)"><Import /> Import data</Button>
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
                    <Checkbox data-testid="select-all-rows-checkbox" checked={allOn} onCheckedChange={() => onToggle(visible.map((v) => v.r.id), !allOn)} />
                  </th>
                  <th className="border-b border-r border-[#E5E7EB] px-2 py-1.5 font-semibold" title={qtyColumn ? `Read from column "${qtyColumn}"` : "Type the number of labels"}>
                    Qty{qtyColumn && <span className="ml-1 text-[9px] font-normal text-(--app-accent)">auto</span>}
                  </th>
                  {columns.map((c) => <ColumnHeader key={c} col={c} onResizeStart={startResize} onAutoFit={autoFit} />)}
                  <th className="border-b border-[#E5E7EB]" />
                </tr>
              </thead>
              <tbody>
                {visible.map(({ r, i }) => (
                  <tr key={r.id} data-testid={`sheet-row-${i}`} className={cn("transition-colors duration-100 hover:bg-[#F8FAFF]", (!r.selected || rowQty(r, qtyColumn) === 0) && "text-[#9CA3AF]")}>
                    <td className="border-b border-r border-[#EEF0F2] bg-[#F9FAFB] px-2 py-1 text-center font-mono text-[10px] text-[#9CA3AF]">{i + 1}</td>
                    <td className="border-b border-r border-[#EEF0F2] px-2 py-1 text-center">
                      <Checkbox data-testid={`row-checkbox-${i}`} checked={r.selected} onCheckedChange={() => onToggle([r.id], !r.selected)} />
                    </td>
                    <td className="border-b border-r border-[#EEF0F2] px-1 py-0.5">
                      {qtyColumn ? (
                        <span data-testid={`row-qty-auto-${i}`} title={`From "${qtyColumn}"`} className="block px-1.5 font-mono text-xs font-semibold text-(--app-accent)">
                          {rowQty(r, qtyColumn) || "—"}
                        </span>
                      ) : (
                        <input type="number" min={1} data-testid={`row-qty-input-${i}`} value={r.qty}
                          onChange={(e) => onQty(r.id, Math.max(1, Math.min(9999, parseInt(e.target.value) || 1)))}
                          className="h-6 w-full rounded border border-transparent bg-transparent px-1.5 font-mono text-xs outline-none focus:border-(--app-accent) focus:bg-white" />
                      )}
                    </td>
                    {columns.map((c) => <td key={c} title={r.cells[c]} className="truncate border-b border-r border-[#EEF0F2] px-2 py-1">{r.cells[c]}</td>)}
                    <td className="border-b border-[#EEF0F2] px-1 text-center">
                      <Button variant="ghost" size="icon-xs" title="Print just this label" data-testid={`print-row-${i}`} onClick={() => onPrintRow(r.cells)}><Printer /></Button>
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
