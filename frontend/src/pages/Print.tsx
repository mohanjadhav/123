import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Label as LabelView, Scaled } from "@/components/label/Label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, apiDelete, apiPost } from "@/lib/api";
import { autoMapping, fetchSheet, fetchSources, fetchTemplates, MM_TO_PX, placeholdersOf } from "@/lib/label";
import type { Mapping, Row, SheetSource, SheetSourceCreate, Template } from "@/lib/types";
import { cn } from "@/lib/utils";

type LayoutMode = "roll" | "a4" | "letter";
const LAYOUTS: Record<LayoutMode, { label: string; w?: number; h?: number }> = {
  roll: { label: "Roll / thermal — 1 label per page" },
  a4: { label: "A4 sheet (210 × 297 mm)", w: 210, h: 297 },
  letter: { label: "US Letter (8.5 × 11 in)", w: 215.9, h: 279.4 },
};
const NONE = "__none__";

interface PageSpec {
  w: number;
  h: number;
  cols: number;
  perPage: number;
}

function pageSpec(t: Template, mode: LayoutMode, margin: number, gap: number): PageSpec {
  const L = LAYOUTS[mode];
  if (!L.w || !L.h) return { w: t.width_mm, h: t.height_mm, cols: 1, perPage: 1 };
  const cols = Math.max(1, Math.floor((L.w - 2 * margin + gap) / (t.width_mm + gap)));
  const rows = Math.max(1, Math.floor((L.h - 2 * margin + gap) / (t.height_mm + gap)));
  return { w: L.w, h: L.h, cols, perPage: cols * rows };
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function SheetPage({ spec, template, rows, mapping, margin, gap, roll }: {
  spec: PageSpec; template: Template; rows: Row[]; mapping: Mapping; margin: number; gap: number; roll: boolean;
}) {
  return (
    <div
      className="print-page bg-white"
      style={{
        width: `${spec.w}mm`,
        height: `${spec.h}mm`,
        padding: roll ? 0 : `${margin}mm`,
        display: "grid",
        gridTemplateColumns: `repeat(${spec.cols}, ${template.width_mm}mm)`,
        gridAutoRows: `${template.height_mm}mm`,
        gap: roll ? 0 : `${gap}mm`,
        overflow: "hidden",
      }}
    >
      {rows.map((r, i) => (
        <LabelView key={i} template={template} row={r} mapping={mapping} />
      ))}
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#2A303C] bg-[#16191F] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Print() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const templates = useQuery({ queryKey: ["templates"], queryFn: fetchTemplates });
  const sources = useQuery({ queryKey: ["sources"], queryFn: fetchSources });

  const [templateId, setTemplateId] = useState(params.get("template") ?? "");
  const [sourceId, setSourceId] = useState("");
  const [activeUrl, setActiveUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [overrides, setOverrides] = useState<Mapping>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filterCol, setFilterCol] = useState("");
  const [filterVal, setFilterVal] = useState("all");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<LayoutMode>("roll");
  const [margin, setMargin] = useState(8);
  const [gap, setGap] = useState(3);
  const [copies, setCopies] = useState(1);
  const [single, setSingle] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SheetSourceCreate>({ name: "", brand: "", url: "", template_id: null });

  const template = templates.data?.find((t) => t.id === templateId) ?? null;
  const sheet = useQuery({ queryKey: ["sheet", activeUrl], queryFn: () => fetchSheet(activeUrl), enabled: !!activeUrl, retry: false });
  const columns = sheet.isError ? [] : (sheet.data?.columns ?? []);
  const rows = useMemo(() => (sheet.isError ? [] : (sheet.data?.rows ?? [])), [sheet.data, sheet.isError]);
  const sheetError = sheet.error instanceof ApiError ? (sheet.error.body as { detail?: string } | null)?.detail : null;

  const placeholders = useMemo(() => (template ? placeholdersOf(template) : []), [template]);
  const mapping = useMemo(() => ({ ...autoMapping(placeholders, columns), ...overrides }), [placeholders, columns, overrides]);
  const unmapped = placeholders.filter((p) => !mapping[p] || !columns.includes(mapping[p]));

  const effectiveFilterCol = filterCol || columns.find((c) => /brand/i.test(c)) || "";
  const filterValues = useMemo(
    () => (effectiveFilterCol ? [...new Set(rows.map((r) => r[effectiveFilterCol]).filter(Boolean))].sort() : []),
    [rows, effectiveFilterCol],
  );
  const visible = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => filterVal === "all" || !effectiveFilterCol || r[effectiveFilterCol] === filterVal)
    .filter(({ r }) => !search || Object.values(r).some((v) => v.toLowerCase().includes(search.toLowerCase())));

  const chosenRows = rows.filter((_, i) => selected.has(i)).flatMap((r) => Array.from({ length: Math.max(1, copies) }, () => r));
  const printRows = single ? [single] : chosenRows;
  const printMode: LayoutMode = single ? "roll" : mode;
  const spec = template ? pageSpec(template, printMode, margin, gap) : null;
  const pages = spec ? chunk(printRows, spec.perPage) : [];
  const previewSpec = template ? pageSpec(template, mode, margin, gap) : null;
  const previewPages = previewSpec ? chunk(chosenRows, previewSpec.perPage) : [];
  const previewScale = previewSpec ? Math.min(1, 420 / (previewSpec.w * MM_TO_PX), 360 / (previewSpec.h * MM_TO_PX)) : 1;

  const resetData = () => {
    setSelected(new Set());
    setFilterCol("");
    setFilterVal("all");
    setSearch("");
    setOverrides({});
  };
  const chooseSource = (s: SheetSource) => {
    setSourceId(s.id);
    setActiveUrl(s.url);
    setUrlInput(s.url === "sample" ? "" : s.url);
    if (s.template_id && templates.data?.some((t) => t.id === s.template_id)) setTemplateId(s.template_id);
    resetData();
  };
  const loadUrl = () => {
    if (!urlInput.trim()) return toast.error("Paste a Google Sheets or CSV URL");
    setSourceId("");
    setActiveUrl(urlInput.trim());
    resetData();
  };

  const createSource = useMutation({
    mutationFn: (body: SheetSourceCreate) => apiPost<SheetSource>("/sources", body),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      setDialogOpen(false);
      chooseSource(s);
      toast.success(`Saved "${s.name}"`);
    },
    onError: () => toast.error("Could not save sheet"),
  });
  const deleteSource = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/sources/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources"] }),
  });

  const runPrint = (row: Row | null) => {
    if (!template) return toast.error("Choose a template first");
    if (!row && chosenRows.length === 0) return toast.error("Select at least one row to print");
    flushSync(() => setSingle(row));
    window.print();
    setSingle(null);
  };

  const toggle = (i: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const allVisibleSelected = visible.length > 0 && visible.every(({ i }) => selected.has(i));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      visible.forEach(({ i }) => (allVisibleSelected ? n.delete(i) : n.add(i)));
      return n;
    });
  const tableCols = columns.slice(0, 4);

  return (
    <div className="min-h-screen bg-[#0F1115] text-neutral-200">
      <AppHeader>
        <span className="hidden font-mono text-xs text-neutral-500 md:inline" data-testid="print-batch-status">
          {chosenRows.length} labels · {previewPages.length} page{previewPages.length === 1 ? "" : "s"}
        </span>
        <Button data-testid="print-trigger-button" onClick={() => runPrint(null)} className="bg-[#FF5B26] text-[#0F1115] hover:bg-[#FF7143]">
          <Printer /> Print selected
        </Button>
      </AppHeader>

      <main className="grid gap-5 px-5 py-6 xl:grid-cols-[340px_minmax(0,1fr)_460px]">
        {/* Left: sources + template + mapping */}
        <div className="grid content-start gap-5">
          <Panel
            title="1 · Google Sheets"
            action={
              <Button size="xs" variant="ghost" data-testid="add-source-button"
                onClick={() => { setForm({ name: "", brand: "", url: urlInput, template_id: templateId || null }); setDialogOpen(true); }}>
                <Plus /> Save sheet
              </Button>
            }
          >
            <ul className="mb-3 grid gap-1.5" data-testid="sources-list">
              {(sources.isError ? [] : (sources.data ?? [])).map((s) => (
                <li key={s.id} className="group flex items-center gap-1">
                  <button data-testid={`source-item-${s.id}`} onClick={() => chooseSource(s)}
                    className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors duration-150",
                      sourceId === s.id ? "border-[#FF5B26] bg-[#FF5B26]/10" : "border-[#2A303C] hover:border-[#3F4858]")}>
                    <FileSpreadsheet className="size-4 shrink-0 text-[#10B981]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">{s.name}</span>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-neutral-500">{s.brand}</span>
                    </span>
                  </button>
                  <Button variant="ghost" size="icon-xs" data-testid={`delete-source-${s.id}`} className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    onClick={() => confirm(`Remove "${s.name}"?`) && deleteSource.mutate(s.id)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex gap-1.5">
              <Input data-testid="google-sheets-input-url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste public Google Sheet URL" className="h-9 text-xs" onKeyDown={(e) => e.key === "Enter" && loadUrl()} />
              <Button size="icon" variant="outline" data-testid="google-sheets-fetch-button" onClick={loadUrl} title="Load"><Download /></Button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
              Sheet must be shared as “Anyone with the link can view”. Each brand tab has its own link — open the tab, copy the URL (it includes <span className="font-mono">gid=</span>) and save it.
            </p>
            {sheet.isFetching && <p className="mt-2 text-xs text-neutral-400">Loading sheet…</p>}
            {sheet.isError && <p className="mt-2 text-xs text-red-400" data-testid="sheet-error">{sheetError ?? "Could not load sheet."}</p>}
            {sheet.data && !sheet.isError && (
              <div className="mt-2 flex items-center justify-between text-xs text-[#10B981]" data-testid="sheet-status">
                <span>● {rows.length} rows · {columns.length} columns</span>
                <Button size="icon-xs" variant="ghost" data-testid="sheet-refresh-button" onClick={() => sheet.refetch()} title="Refresh"><RefreshCw /></Button>
              </div>
            )}
          </Panel>

          <Panel title="2 · Template">
            <Select value={templateId} onValueChange={(v: string) => { setTemplateId(v); setOverrides({}); }}>
              <SelectTrigger className="w-full" data-testid="template-select">
                <SelectValue placeholder="Choose a template">
                  {(v) => { const t = templates.data?.find((x) => x.id === v); return t ? `${t.brand} — ${t.name}` : "Choose a template"; }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(templates.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.brand} — {t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {template && (
              <Link to={`/editor/${template.id}`} data-testid="edit-selected-template-link" className="mt-2 inline-block text-xs text-[#FF7143] underline">
                Edit this template
              </Link>
            )}
          </Panel>

          {template && placeholders.length > 0 && (
            <Panel title="3 · Field mapping">
              <div className="grid gap-2" data-testid="field-mapping-panel">
                {placeholders.map((p) => (
                  <div key={p} className="grid grid-cols-[1fr_1fr] items-center gap-2">
                    <span className="truncate font-mono text-xs text-[#06B6D4]">{`{{${p}}}`}</span>
                    <Select value={mapping[p] ?? NONE} onValueChange={(v: string) => setOverrides((o) => ({ ...o, [p]: v === NONE ? "" : v }))}>
                      <SelectTrigger size="sm" className="w-full" data-testid={`mapping-select-${p}`}>
                        <SelectValue>{(v) => (v === NONE || !v ? "— not mapped —" : (v as string))}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— not mapped —</SelectItem>
                        {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {columns.length > 0 && unmapped.length > 0 && (
                  <p className="text-[11px] text-[#F59E0B]" data-testid="mapping-warning">{unmapped.length} field(s) not mapped — they will print blank.</p>
                )}
              </div>
            </Panel>
          )}
        </div>

        {/* Center: rows */}
        <Panel
          title="Rows to print"
          action={<span className="font-mono text-xs text-neutral-500" data-testid="selected-count">{selected.size} selected</span>}
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <Input data-testid="rows-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rows…" className="h-8 w-48 text-xs" />
            {columns.length > 0 && (
              <>
                <Select value={effectiveFilterCol || NONE} onValueChange={(v: string) => { setFilterCol(v === NONE ? "" : v); setFilterVal("all"); }}>
                  <SelectTrigger size="sm" data-testid="filter-column-select">
                    <SelectValue>{(v) => (v === NONE ? "Filter by column" : `By ${v as string}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No filter</SelectItem>
                    {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {effectiveFilterCol && (
                  <Select value={filterVal} onValueChange={(v: string) => setFilterVal(v)}>
                    <SelectTrigger size="sm" data-testid="sheets-brand-filter">
                      <SelectValue>{(v) => (v === "all" ? "All values" : (v as string))}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All values</SelectItem>
                      {filterValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </>
            )}
          </div>
          {rows.length === 0 ? (
            <div className="grid h-64 place-items-center rounded-lg border border-dashed border-[#2A303C] text-center text-sm text-neutral-500" data-testid="rows-empty">
              <div>
                <FileSpreadsheet className="mx-auto mb-2 size-6 text-neutral-600" />
                Choose a saved sheet or paste a Google Sheets link to load rows.
              </div>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-15rem)] overflow-auto rounded-lg border border-[#2A303C]">
              <Table data-testid="sheets-data-table">
                <TableHeader className="sticky top-0 z-10 bg-[#1A1E24]">
                  <TableRow>
                    <TableHead className="w-8"><Checkbox data-testid="select-all-rows-checkbox" checked={allVisibleSelected} onCheckedChange={toggleAll} /></TableHead>
                    <TableHead className="w-8 font-mono text-[10px]">#</TableHead>
                    {tableCols.map((c) => <TableHead key={c} className="font-mono text-[10px] uppercase">{c}</TableHead>)}
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map(({ r, i }) => (
                    <TableRow key={i} data-testid={`sheet-row-${i}`} className={cn(selected.has(i) && "bg-[#FF5B26]/5")}>
                      <TableCell><Checkbox data-testid={`row-checkbox-${i}`} checked={selected.has(i)} onCheckedChange={() => toggle(i)} /></TableCell>
                      <TableCell className="font-mono text-[10px] text-neutral-500">{i + 1}</TableCell>
                      {tableCols.map((c) => <TableCell key={c} className="max-w-32 truncate text-xs">{r[c]}</TableCell>)}
                      <TableCell>
                        <Button variant="ghost" size="icon-xs" title="Print this label" data-testid={`print-row-${i}`} onClick={() => runPrint(r)}><Printer /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>

        {/* Right: layout + preview */}
        <div className="grid content-start gap-5">
          <Panel title="Print layout">
            <div className="grid gap-3">
              <Select value={mode} onValueChange={(v: string) => setMode(v as LayoutMode)}>
                <SelectTrigger className="w-full" data-testid="print-sheet-layout-select"><SelectValue>{(v) => LAYOUTS[v as LayoutMode].label}</SelectValue></SelectTrigger>
                <SelectContent>{(Object.keys(LAYOUTS) as LayoutMode[]).map((k) => <SelectItem key={k} value={k}>{LAYOUTS[k].label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1">
                  <span className="font-mono text-[10px] uppercase text-neutral-500">Copies</span>
                  <Input type="number" min={1} data-testid="print-copies-input" className="h-8 font-mono text-xs" value={copies} onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div className="grid gap-1">
                  <span className="font-mono text-[10px] uppercase text-neutral-500">Margin mm</span>
                  <Input type="number" disabled={mode === "roll"} data-testid="print-margin-input" className="h-8 font-mono text-xs" value={margin} onChange={(e) => setMargin(Math.max(0, parseFloat(e.target.value) || 0))} />
                </div>
                <div className="grid gap-1">
                  <span className="font-mono text-[10px] uppercase text-neutral-500">Gap mm</span>
                  <Input type="number" disabled={mode === "roll"} data-testid="print-gap-input" className="h-8 font-mono text-xs" value={gap} onChange={(e) => setGap(Math.max(0, parseFloat(e.target.value) || 0))} />
                </div>
              </div>
              {previewSpec && (
                <p className="font-mono text-[11px] text-neutral-500" data-testid="print-layout-summary">
                  {previewSpec.perPage} label{previewSpec.perPage === 1 ? "" : "s"} per page · {previewSpec.w} × {previewSpec.h} mm page
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Print preview">
            <div className="grid max-h-[calc(100vh-22rem)] justify-items-center gap-4 overflow-auto rounded-lg bg-[#0B0D10] p-4" data-testid="print-preview-container">
              {!template && <p className="py-10 text-sm text-neutral-500">Choose a template.</p>}
              {template && chosenRows.length === 0 && (
                <div className="grid justify-items-center gap-3 py-4">
                  <Scaled widthMm={template.width_mm} heightMm={template.height_mm} scale={Math.min(1.5, 360 / (template.width_mm * MM_TO_PX), 260 / (template.height_mm * MM_TO_PX))}
                    className="shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)]">
                    <LabelView template={template} row={rows[0] ?? null} mapping={mapping} testId="template-preview-label" />
                  </Scaled>
                  <p className="text-xs text-neutral-500">Select rows to build the print sheet.</p>
                </div>
              )}
              {template && previewSpec && previewPages.slice(0, 4).map((pg, pi) => (
                <Scaled key={pi} widthMm={previewSpec.w} heightMm={previewSpec.h} scale={previewScale} className="shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)]">
                  <SheetPage spec={previewSpec} template={template} rows={pg} mapping={mapping} margin={margin} gap={gap} roll={mode === "roll"} />
                </Scaled>
              ))}
              {previewPages.length > 4 && <p className="text-xs text-neutral-500">+ {previewPages.length - 4} more pages</p>}
            </div>
          </Panel>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="add-source-dialog">
          <DialogHeader><DialogTitle>Save a Google Sheet</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="src-name">Name</Label>
              <Input id="src-name" data-testid="source-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. AURA spring stock" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="src-brand">Brand</Label>
              <Input id="src-brand" data-testid="source-brand-input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="e.g. AURA Studio" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="src-url">Google Sheet / CSV URL</Label>
              <Input id="src-url" data-testid="source-url-input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0" />
            </div>
            <div className="grid gap-1.5">
              <Label>Default template</Label>
              <Select value={form.template_id ?? NONE} onValueChange={(v: string) => setForm({ ...form, template_id: v === NONE ? null : v })}>
                <SelectTrigger className="w-full" data-testid="source-template-select">
                  <SelectValue>{(v) => templates.data?.find((t) => t.id === v)?.name ?? "None"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(templates.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.brand} — {t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="source-save-button" disabled={createSource.isPending} className="bg-[#FF5B26] text-[#0F1115] hover:bg-[#FF7143]"
              onClick={() => {
                if (!form.name.trim() || !form.url.trim()) return toast.error("Name and URL are required");
                createSource.mutate({ ...form, name: form.name.trim(), brand: form.brand.trim() || "General", url: form.url.trim() });
              }}>
              Save sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {template && spec &&
        createPortal(
          <div className="print-root" data-testid="print-root">
            <style>{`@page { size: ${spec.w}mm ${spec.h}mm; margin: 0; }`}</style>
            {pages.map((pg, pi) => (
              <SheetPage key={pi} spec={spec} template={template} rows={pg} mapping={mapping} margin={margin} gap={gap} roll={printMode === "roll"} />
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
