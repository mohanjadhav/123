import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import type { KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Barcode, CopyPlus, Eye, ListOrdered, ListPlus, FileSpreadsheet, Info, Plus, Printer, RefreshCw, RotateCcw, Search, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ThemePicker } from "@/components/ThemePicker";
import { ColumnHeader } from "@/components/workspace/ColumnHeader";
import { RefreshDialog } from "@/components/workspace/RefreshDialog";
import { SheetTabs } from "@/components/workspace/SheetTabs";
import { PrintPortal, PrintPreviewDialog } from "@/components/workspace/PrintPreview";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiErrorDetail } from "@/lib/api";
import { expandRows, rowQty, tickByQty, useColumnWidths, withQty, withTick } from "@/lib/grid";
import { QtyStepper } from "@/components/workspace/QtyStepper";
import { QtyColumnSelect } from "@/components/workspace/QtyColumnSelect";
import { autoMapping, fetchSources, fetchTemplates, placeholdersOf } from "@/lib/label";
import type { CopyRow, Row } from "@/lib/types";
import { useSheetCopy } from "@/lib/useSheetCopy";
import { queueItemsFrom, useAddToQueue, useQueueCount } from "@/lib/queue";
import { cn } from "@/lib/utils";

const SAVE_LABEL = { idle: "All changes saved", pending: "Saving…", saving: "Saving…", error: "Save failed — retrying on next edit" } as const;

export default function SheetData() {
  const { sourceId = "" } = useParams();
  const nav = useNavigate();
  const sourcesQ = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const sources = sourcesQ.isError ? [] : (sourcesQ.data ?? []);
  const source = sources.find((s) => s.id === sourceId) ?? null;
  const { query, copy, update, refresh, saveState } = useSheetCopy(sourceId || null);

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: string; col: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [printJob, setPrintJob] = useState<Row[] | null>(null);
  const [pickedTpl, setPickedTpl] = useState("");
  const templatesQ = useQuery({ queryKey: ["templates"], queryFn: fetchTemplates });
  const templates = templatesQ.isError ? [] : (templatesQ.data ?? []);
  // Label to print with: user's pick, else the label linked to this sheet, else the newest label.
  const tpl = templates.find((t) => t.id === pickedTpl) ?? templates.find((t) => t.source_id === sourceId) ?? templates[0] ?? null;

  const columns = useMemo(() => copy?.columns ?? [], [copy]);
  const rows = useMemo(() => copy?.rows ?? [], [copy]);
  const cellRows = useMemo(() => rows.map((r) => r.cells), [rows]);
  const originals = useMemo(() => {
    const m: Record<string, Record<string, string> | null> = {};
    rows.forEach((r) => {
      try { m[r.id] = r.origin ? (JSON.parse(r.origin) as Record<string, string>) : null; } catch { m[r.id] = null; }
    });
    return m;
  }, [rows]);
  const { widthOf, startResize, autoFit } = useColumnWidths(columns, cellRows);

  const visible = rows.map((r, i) => ({ r, i })).filter(({ r }) => !q || Object.values(r.cells).some((v) => v.toLowerCase().includes(q.toLowerCase())));
  const allOn = visible.length > 0 && visible.every(({ r }) => r.selected);
  const qtyColumn = copy?.qty_column ?? null;
  const labels = rows.reduce((n, r) => n + (r.selected ? rowQty(r, qtyColumn) : 0), 0);
  const canRefresh = !!source && !source.url.startsWith("upload:") && source.url !== "sample";
  const placeholders = useMemo(() => (tpl ? placeholdersOf(tpl) : []), [tpl]);
  const mapping = useMemo(() => autoMapping(placeholders, columns), [placeholders, columns]);
  const missing = columns.length ? placeholders.filter((p) => !mapping[p]) : [];
  const printRows = expandRows(rows, qtyColumn);
  const queueCount = useQueueCount();
  const addToQueue = useAddToQueue(() => nav("/queue"));
  const queueTicked = () => {
    if (!tpl) return toast.error("Choose a label first");
    const items = queueItemsFrom(rows, qtyColumn);
    if (!items.length) return toast.error("Tick rows with a quantity first");
    addToQueue.mutate({ template_id: tpl.id, source_id: sourceId || null, items });
  };
  const runPrint = () => {
    if (!tpl) return toast.error("Create a label in the designer first");
    if (!printRows.length) return toast.error("Tick at least one row to print");
    flushSync(() => setPrintJob(printRows));
    window.print();
    setPrintJob(null);
  };

  const setRows = (fn: (rows: CopyRow[]) => CopyRow[]) => update((c) => ({ ...c, rows: fn(c.rows) }));
  const patchRow = (id: string, patch: Partial<CopyRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const startEdit = (r: CopyRow, col: string) => { setEditing({ id: r.id, col }); setDraft(r.cells[col] ?? ""); };
  const commit = () => {
    if (!editing) return;
    const row = rows.find((r) => r.id === editing.id);
    if (row && (row.cells[editing.col] ?? "") !== draft) {
      const next = { ...row, cells: { ...row.cells, [editing.col]: draft } };
      // Editing the quantity column re-ticks the row from its new quantity.
      patchRow(row.id, editing.col === qtyColumn ? { cells: next.cells, selected: rowQty(next, qtyColumn) > 0 } : { cells: next.cells });
    }
    setEditing(null);
  };
  const onCellKey = (e: KeyboardEvent<HTMLInputElement>, r: CopyRow, col: string) => {
    if (e.key === "Escape") { setEditing(null); return; }
    if (e.key !== "Enter" && e.key !== "Tab") return;
    e.preventDefault();
    commit();
    const vi = visible.findIndex((v) => v.r.id === r.id);
    const ci = columns.indexOf(col);
    if (e.key === "Tab") {
      const nextCol = columns[ci + (e.shiftKey ? -1 : 1)];
      if (nextCol) startEdit(r, nextCol);
    } else {
      const next = visible[vi + (e.shiftKey ? -1 : 1)]?.r;
      if (next) startEdit(next, col);
    }
  };

  const addRow = () => {
    const row: CopyRow = { id: crypto.randomUUID(), cells: Object.fromEntries(columns.map((c) => [c, ""])), qty: 0, selected: false, origin: null };
    setRows((rs) => [...rs, row]);
    setQ("");
    if (columns[0]) { setEditing({ id: row.id, col: columns[0] }); setDraft(""); }
  };
  const duplicateRow = (r: CopyRow) => setRows((rs) => {
    const i = rs.findIndex((x) => x.id === r.id);
    return [...rs.slice(0, i + 1), { ...r, id: crypto.randomUUID(), origin: null }, ...rs.slice(i + 1)];
  });
  const deleteRow = (r: CopyRow) => { setRows((rs) => rs.filter((x) => x.id !== r.id)); toast.success("Row deleted (only in the app)"); };

  return (
    <div className="flex h-screen flex-col bg-[#EEF0F3] text-[#1F2937]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[#D9DDE3] bg-white px-3" data-testid="sheet-data-header">
        <Link to="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-(--app-accent)")} data-testid="back-to-designer-link">
          <ArrowLeft /> Back to designer
        </Link>
        <span className="h-6 w-px bg-[#E5E7EB]" />
        <span className="grid size-7 place-items-center rounded-md bg-(--app-accent) text-white"><Barcode className="size-4" /></span>
        <h1 className="text-sm font-semibold">EASY LABELS <span className="font-normal text-[#6B7280]">by HC</span> <span className="font-normal text-[#9CA3AF]">· Sheet data</span></h1>
        <Select value={sourceId} onValueChange={(v: string) => { setEditing(null); nav(`/data/${v}`); }}>
          <SelectTrigger size="sm" className="h-8 w-64 bg-white" data-testid="sheet-data-source-select">
            <FileSpreadsheet className="size-3.5 text-[#188038]" />
            <SelectValue placeholder="Choose a sheet">{(v) => sources.find((s) => s.id === v)?.name ?? "Choose a sheet"}</SelectValue>
          </SelectTrigger>
          <SelectContent>{sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        {copy?.edited && <span className="rounded bg-[#FEF7E0] px-2 py-0.5 text-[11px] font-medium text-[#B06000]" data-testid="sheet-edited-badge">Edited in app</span>}
        <span className={cn("ml-auto text-xs", saveState === "error" ? "text-[#D93025]" : "text-[#6B7280]")} data-testid="sheet-save-status">{copy ? SAVE_LABEL[saveState] : ""}</span>
        <Link to="/queue" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-white text-(--app-accent)")} data-testid="data-queue-link">
          <ListOrdered /> Print queue{queueCount ? ` (${queueCount})` : ""}
        </Link>
        <ThemePicker />
      </header>

      <SheetTabs sources={sources} active={source} onSelect={(s) => { setEditing(null); setQ(""); nav(`/data/${s.id}`); }} testId="data-sheet-tabs" />

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#D9DDE3] bg-[#F8F9FB] px-3 py-2">
        <Button size="sm" data-testid="add-row-button" disabled={!copy} onClick={addRow} className="bg-(--app-accent) text-white hover:bg-(--app-accent-hover)"><Plus /> Add row</Button>
        <Button size="sm" variant="outline" className="bg-white" data-testid="refresh-from-google-button" disabled={!canRefresh || refresh.isPending}
          title={canRefresh ? "Get the latest rows from Google Sheets" : "Only Google Sheet links can refresh"}
          onClick={() => (copy?.edited ? setRefreshOpen(true) : refresh.mutate("replace"))}>
          <RefreshCw className={cn(refresh.isPending && "animate-spin")} /> Refresh from Google
        </Button>
        <Button size="sm" variant="outline" className="bg-white text-[#D93025] hover:text-[#D93025]" data-testid="reset-original-button" disabled={!copy || refresh.isPending}
          onClick={() => confirm("Discard all edits, quantities and ticks and reload the original sheet data?") && refresh.mutate("replace")}>
          <RotateCcw /> Reset to original
        </Button>
        <QtyColumnSelect columns={columns} value={qtyColumn} onChange={(col) => update((c) => ({ ...c, qty_column: col, rows: tickByQty(c.rows, col) }))} testId="data-qty-column-select" className="h-8" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rows" data-testid="sheet-data-search" className="h-8 w-52 bg-white pl-7 text-xs" />
        </div>
        <span className="ml-auto text-xs text-[#4B5563]" data-testid="sheet-data-stats">
          {rows.length} rows · {rows.filter((r) => r.selected).length} ticked · <b>{labels}</b> labels to print
        </span>
        <span className="h-6 w-px bg-[#D9DDE3]" />
        <Select value={tpl?.id ?? ""} onValueChange={(v: string) => setPickedTpl(v)}>
          <SelectTrigger size="sm" className="h-8 w-60 bg-white" data-testid="data-label-select">
            <Tag className="size-3.5 text-(--app-accent)" />
            <SelectValue placeholder="Choose label">{(v) => { const t = templates.find((x) => x.id === v); return t ? `${t.brand} — ${t.name}` : "Choose label"; }}</SelectValue>
          </SelectTrigger>
          <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.brand} — {t.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="bg-white" data-testid="data-preview-button" disabled={!tpl || !copy} onClick={() => setPreviewOpen(true)}><Eye /> Preview</Button>
        <Button size="sm" variant="outline" className="bg-white text-(--app-accent)" data-testid="data-add-to-queue-button" disabled={!tpl || !labels} onClick={queueTicked}><ListPlus /> Add to queue</Button>
        <Button size="sm" className="bg-[#188038] text-white hover:bg-[#146C2E]" data-testid="data-print-button" disabled={!tpl || !copy} onClick={runPrint}><Printer /> Print</Button>
      </div>

      <p className="flex shrink-0 items-center gap-2 border-b border-(--app-accent-ring) bg-(--app-accent-soft) px-3 py-1.5 text-xs text-(--app-accent-hover)" data-testid="sheet-data-notice">
        <Info className="size-3.5" /> Changes here are saved in EASY LABELS only — your original Google Sheet / file is never changed. Click a cell to edit · Enter / Tab to move · Esc to cancel.
      </p>

      <main className="min-h-0 flex-1 overflow-auto bg-white">
        {!sourceId || (sourcesQ.isSuccess && !source) ? (
          <p className="p-6 text-sm text-[#6B7280]" data-testid="sheet-data-missing">Choose a sheet above, or import one from the designer.</p>
        ) : query.isLoading ? (
          <p className="p-6 text-sm text-[#6B7280]" data-testid="sheet-data-loading">Loading sheet…</p>
        ) : query.isError ? (
          <p className="p-6 text-sm text-[#D93025]" data-testid="sheet-data-error">{apiErrorDetail(query.error, "Could not load this sheet")}</p>
        ) : (
          <table className="table-fixed border-collapse text-xs" style={{ width: 44 + 40 + 92 + 72 + columns.reduce((n, c) => n + widthOf(c), 0), minWidth: "100%" }} data-testid="sheet-data-table">
            <colgroup>
              <col style={{ width: 44 }} />
              <col style={{ width: 40 }} />
              <col style={{ width: 92 }} />
              {columns.map((c) => <col key={c} style={{ width: widthOf(c) }} />)}
              <col style={{ width: 72 }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#F3F4F6] text-left text-[#374151]">
              <tr>
                <th className="border-b border-r border-[#E5E7EB] px-2 py-1.5 text-center font-medium text-[#9CA3AF]">#</th>
                <th className="border-b border-r border-[#E5E7EB] px-2 py-1.5 text-center">
                  <Checkbox data-testid="sheet-data-select-all" checked={allOn} onCheckedChange={() => { const ids = new Set(visible.map((v) => v.r.id)); setRows((rs) => rs.map((r) => (ids.has(r.id) ? withTick(r, !allOn, qtyColumn) : r))); }} />
                </th>
                <th className="border-b border-r border-[#E5E7EB] px-2 py-1.5 font-semibold" title={qtyColumn ? `Read from column "${qtyColumn}"` : "Type the number of labels"}>
                  Qty{qtyColumn && <span className="ml-1 text-[9px] font-normal text-(--app-accent)">auto</span>}
                </th>
                {columns.map((c) => <ColumnHeader key={c} col={c} onResizeStart={startResize} onAutoFit={autoFit} />)}
                <th className="border-b border-[#E5E7EB]" />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ r, i }) => {
                const orig = originals[r.id];
                return (
                  <tr key={r.id} data-testid={`data-row-${i}`} className={cn("group", (!r.selected || rowQty(r, qtyColumn) === 0) && "text-[#9CA3AF]")}>
                    <td className={cn("border-b border-r border-[#EEF0F2] bg-[#F9FAFB] px-2 py-1 text-center font-mono text-[10px] text-[#9CA3AF]", !orig && "border-l-[3px] border-l-[#188038]")}
                      title={orig ? undefined : "Added in app"}>{i + 1}</td>
                    <td className="border-b border-r border-[#EEF0F2] px-2 py-1 text-center">
                      <Checkbox data-testid={`data-row-checkbox-${i}`} checked={r.selected} onCheckedChange={() => setRows((rs) => rs.map((x) => (x.id === r.id ? withTick(x, !r.selected, qtyColumn) : x)))} />
                    </td>
                    <td className="border-b border-r border-[#EEF0F2] px-1 py-0.5">
                      <QtyStepper value={rowQty(r, qtyColumn)} auto={!!qtyColumn} testId={`data-row-qty-${i}`}
                        onChange={(n) => setRows((rs) => rs.map((x) => (x.id === r.id ? withQty(x, n, qtyColumn) : x)))} />
                    </td>
                    {columns.map((c) => {
                      const isEditing = editing?.id === r.id && editing.col === c;
                      const changed = !!orig && (orig[c] ?? "") !== (r.cells[c] ?? "");
                      return (
                        <td key={c} data-testid={`data-cell-${i}-${c}`} title={changed ? `Original: ${orig?.[c] || "(empty)"}` : r.cells[c]}
                          onClick={() => !isEditing && startEdit(r, c)}
                          className={cn("h-7 cursor-text truncate border-b border-r border-[#EEF0F2] px-2 py-0", c === qtyColumn && "bg-(--app-accent-soft) font-semibold", changed && "bg-[#FEF7E0]", isEditing && "p-0 outline outline-2 -outline-offset-2 outline-(--app-accent)")}>
                          {isEditing ? (
                            <input autoFocus data-testid="data-cell-editor" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => onCellKey(e, r, c)}
                              className="h-7 w-full bg-white px-2 text-xs text-[#1F2937] outline-none" />
                          ) : (r.cells[c] ?? "")}
                        </td>
                      );
                    })}
                    <td className="border-b border-[#EEF0F2] px-1 text-center">
                      <span className="flex justify-center gap-0.5 opacity-60 transition-opacity duration-150 group-hover:opacity-100">
                        <Button variant="ghost" size="icon-xs" title="Duplicate row" data-testid={`data-row-duplicate-${i}`} onClick={() => duplicateRow(r)}><CopyPlus /></Button>
                        <Button variant="ghost" size="icon-xs" title="Delete row" data-testid={`data-row-delete-${i}`} onClick={() => deleteRow(r)}><Trash2 /></Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </main>
      {tpl && (
        <PrintPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} template={tpl} ps={tpl.page_setup} rows={printRows} mapping={mapping} missing={missing}
          onPrint={runPrint} onPageSetup={() => toast.info("Open Page setup in the designer to change paper & layout")} />
      )}
      {tpl && printJob && <PrintPortal template={tpl} ps={tpl.page_setup} rows={printJob} mapping={mapping} />}
      <RefreshDialog open={refreshOpen} onOpenChange={setRefreshOpen} pending={refresh.isPending}
        onChoose={(mode) => refresh.mutate(mode, { onSuccess: () => setRefreshOpen(false) })} />
    </div>
  );
}
