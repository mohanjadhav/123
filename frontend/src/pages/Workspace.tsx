import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Barcode, Copy, Eye, FilePlus2, FolderOpen, Printer, Redo2, Save, SlidersHorizontal, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { SheetImporter } from "@/components/SheetImporter";
import { Canvas } from "@/components/workspace/Canvas";
import { DataGrid } from "@/components/workspace/DataGrid";
import { Inspector } from "@/components/workspace/Inspector";
import { NewLabelDialog, OpenLabelDialog } from "@/components/workspace/LabelDialogs";
import { LeftPanel } from "@/components/workspace/LeftPanel";
import type { Tool } from "@/components/workspace/LeftPanel";
import { PrintPortal, PrintPreviewDialog } from "@/components/workspace/PrintPreview";
import { RefreshDialog } from "@/components/workspace/RefreshDialog";
import { useSheetCopy } from "@/lib/useSheetCopy";
import type { PrintLayout } from "@/components/workspace/PrintPreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiDelete, apiErrorDetail, apiPost, apiPut } from "@/lib/api";
import { autoMapping, fetchSources, fetchTemplates, MM_TO_PX, newElement, placeholdersOf } from "@/lib/label";
import type { LabelElement, Row, SheetSource, Template, TemplateBase } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Draft {
  tpl: Template;
  past: Template[];
  future: Template[];
  dirty: boolean;
}

const load = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const round = (n: number) => Math.round(n * 2) / 2;
const fitZoomFor = (t: TemplateBase) => Math.max(0.3, Math.min(5, Math.min(560 / (t.width_mm * MM_TO_PX), 300 / (t.height_mm * MM_TO_PX))));
const toBase = (t: Template): TemplateBase => ({
  name: t.name, brand: t.brand, width_mm: t.width_mm, height_mm: t.height_mm, background: t.background, elements: t.elements, source_id: t.source_id,
});

function ToolButton({ icon, label, onClick, disabled, testId, primary }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; testId: string; primary?: boolean }) {
  return (
    <button data-testid={testId} onClick={onClick} disabled={disabled}
      className={cn("flex h-8 items-center gap-1.5 rounded px-2.5 text-[13px] transition-colors duration-150 disabled:opacity-40 [&_svg]:size-4",
        primary ? "text-[#1A73E8] hover:bg-[#E8F0FE]" : "text-[#1F2937] hover:bg-[#EEF0F3]")}>
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

export default function Workspace() {
  const qc = useQueryClient();
  const templatesQ = useQuery({ queryKey: ["templates"], queryFn: fetchTemplates });
  const sourcesQ = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const templates = useMemo(() => (templatesQ.isError ? [] : (templatesQ.data ?? [])), [templatesQ.data, templatesQ.isError]);
  const sources = sourcesQ.isError ? [] : (sourcesQ.data ?? []);

  const [openIds, setOpenIds] = useState<string[]>(() => load("bc.openTabs", []));
  const [activeId, setActiveId] = useState<string>(() => load("bc.activeTab", ""));
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zooms, setZooms] = useState<Record<string, number>>({});
  const [layout, setLayout] = useState<PrintLayout>(() => load("bc.layout", { mode: "roll", margin: 8, gap: 3 }));
  const [printJob, setPrintJob] = useState<{ rows: Row[]; single: boolean } | null>(null);
  const [dialog, setDialog] = useState<null | "new" | "open" | "import" | "preview" | "refresh">(null);
  const [gridCollapsed, setGridCollapsed] = useState(false);

  // Tabs: only templates that still exist; default to the newest template.
  const tabIds = useMemo(() => {
    const ids = openIds.filter((id) => templates.some((t) => t.id === id));
    return ids.length || openIds.length || !templates.length ? ids : [templates[0].id]; // fresh start opens newest
  }, [openIds, templates]);
  const currentId = tabIds.includes(activeId) ? activeId : (tabIds[0] ?? "");
  useEffect(() => { localStorage.setItem("bc.openTabs", JSON.stringify(tabIds)); localStorage.setItem("bc.activeTab", JSON.stringify(currentId)); }, [tabIds, currentId]);
  useEffect(() => { localStorage.setItem("bc.layout", JSON.stringify(layout)); }, [layout]);

  const draftOf = useCallback((id: string, d: Record<string, Draft>): Draft | undefined => {
    if (d[id]) return d[id];
    const t = templates.find((x) => x.id === id);
    return t ? { tpl: t, past: [], future: [], dirty: false } : undefined;
  }, [templates]);
  const draft = draftOf(currentId, drafts);
  const tpl = draft?.tpl ?? null;
  const selected = tpl?.elements.find((e) => e.id === selectedId) ?? null;

  const change = useCallback((fn: (t: Template) => Template, record = true) => {
    setDrafts((d) => {
      const cur = draftOf(currentId, d);
      if (!cur) return d;
      return { ...d, [currentId]: { tpl: fn(cur.tpl), past: record ? [...cur.past.slice(-79), cur.tpl] : cur.past, future: record ? [] : cur.future, dirty: true } };
    });
  }, [currentId, draftOf]);
  const snapshot = useCallback(() => {
    setDrafts((d) => {
      const cur = draftOf(currentId, d);
      return cur ? { ...d, [currentId]: { ...cur, past: [...cur.past.slice(-79), cur.tpl], future: [] } } : d;
    });
  }, [currentId, draftOf]);
  const undo = useCallback(() => setDrafts((d) => {
    const cur = draftOf(currentId, d);
    if (!cur?.past.length) return d;
    return { ...d, [currentId]: { tpl: cur.past[cur.past.length - 1], past: cur.past.slice(0, -1), future: [cur.tpl, ...cur.future], dirty: true } };
  }), [currentId, draftOf]);
  const redo = useCallback(() => setDrafts((d) => {
    const cur = draftOf(currentId, d);
    if (!cur?.future.length) return d;
    return { ...d, [currentId]: { tpl: cur.future[0], past: [...cur.past, cur.tpl], future: cur.future.slice(1), dirty: true } };
  }), [currentId, draftOf]);

  const updateEl = useCallback((id: string, patch: Partial<LabelElement>, record = true) =>
    change((t) => ({ ...t, elements: t.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), record), [change]);
  const removeEl = useCallback((id: string) => { change((t) => ({ ...t, elements: t.elements.filter((e) => e.id !== id) })); setSelectedId(null); }, [change]);
  const addEl = (el: LabelElement) => { change((t) => ({ ...t, elements: [...t.elements, el] })); setSelectedId(el.id); };

  const openTab = (id: string) => { setOpenIds([...tabIds.filter((x) => x !== id), id]); setActiveId(id); setSelectedId(null); setDialog(null); };
  const closeTab = (id: string) => {
    if (drafts[id]?.dirty && !confirm("Close without saving changes?")) return;
    setDrafts(({ [id]: _drop, ...rest }) => rest);
    const remaining = tabIds.filter((x) => x !== id);
    setOpenIds(remaining.length ? remaining : ["__closed__"]);
    if (id === currentId) setActiveId(remaining[remaining.length - 1] ?? "");
  };

  // ---- persistence
  const putTemplate = (id: string, body: TemplateBase) => apiPut<Template>(`/templates/${id}`, body);
  const syncSaved = (saved: Template) => {
    qc.setQueryData<Template[]>(["templates"], (list) => list?.map((t) => (t.id === saved.id ? saved : t)));
  };
  const save = useMutation({
    mutationFn: () => {
      if (!tpl) throw new Error("no label");
      return putTemplate(tpl.id, toBase(tpl));
    },
    onSuccess: (saved) => {
      syncSaved(saved);
      setDrafts((d) => (d[saved.id] ? { ...d, [saved.id]: { ...d[saved.id], tpl: saved, dirty: false } } : d));
      toast.success("Label saved");
    },
    onError: () => toast.error("Save failed"),
  });
  const create = useMutation({
    mutationFn: (body: TemplateBase) => apiPost<Template>("/templates", body),
    onSuccess: (t) => {
      qc.setQueryData<Template[]>(["templates"], (list) => [t, ...(list ?? [])]);
      openTab(t.id);
      toast.success(`"${t.name}" created`);
    },
    onError: () => toast.error("Could not create label"),
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => apiPost<Template>(`/templates/${id}/duplicate`),
    onSuccess: (t) => {
      qc.setQueryData<Template[]>(["templates"], (list) => [t, ...(list ?? [])]);
      openTab(t.id);
      toast.success("Copy created");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/templates/${id}`),
    onSuccess: (_, id) => {
      qc.setQueryData<Template[]>(["templates"], (list) => list?.filter((t) => t.id !== id));
      setDrafts(({ [id]: _drop, ...rest }) => rest);
      toast.success("Label deleted");
    },
  });
  const deleteSource = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/sources/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sources"] }); linkSource(null); },
  });

  // ---- print data: the label remembers its sheet (saved immediately)
  const source = sources.find((s) => s.id === tpl?.source_id) ?? null;
  const linkSource = (id: string | null) => {
    if (!tpl) return;
    setDrafts((d) => {
      const cur = draftOf(tpl.id, d);
      return cur ? { ...d, [tpl.id]: { ...cur, tpl: { ...cur.tpl, source_id: id } } } : d;
    });
    const server = templates.find((t) => t.id === tpl.id);
    if (server) putTemplate(server.id, { ...toBase(server), source_id: id }).then(syncSaved).catch(() => toast.error("Could not link sheet"));
  };
  const onImported = (created: SheetSource[]) => { linkSource(created[0].id); setDialog(null); setGridCollapsed(false); };

  // Print data = the app's editable copy of the sheet (shared with the Sheet Data page; never written to Google).
  const { query: copyQ, copy, update: updateCopy, refresh: refreshCopy } = useSheetCopy(source?.id ?? null);
  const columns = useMemo(() => copy?.columns ?? [], [copy]);
  const copyRows = useMemo(() => copy?.rows ?? [], [copy]);
  const rows = useMemo(() => copyRows.map((r) => r.cells), [copyRows]);
  const canRefresh = !!source && !source.url.startsWith("upload:") && source.url !== "sample";
  const onRefresh = () => (copy?.edited ? setDialog("refresh") : refreshCopy.mutate("replace"));
  const placeholders = useMemo(() => (tpl ? placeholdersOf(tpl) : []), [tpl]);
  const mapping = useMemo(() => autoMapping(placeholders, columns), [placeholders, columns]);
  const missing = columns.length ? placeholders.filter((p) => !mapping[p]) : [];
  const printRows = copyRows.flatMap((r) => (r.selected ? Array.from({ length: r.qty }, () => r.cells) : []));
  const previewRow = copyRows.find((r) => r.selected)?.cells ?? rows[0] ?? null;

  const runPrint = (list: Row[], single = false) => {
    if (!tpl) return;
    if (!list.length) return toast.error(rows.length ? "Tick at least one row to print" : "Import data first");
    flushSync(() => setPrintJob({ rows: list, single }));
    window.print();
    setPrintJob(null);
  };

  // ---- editing helpers
  const insertField = (col: string) => {
    if (!tpl) return;
    const tag = `{{${col}}}`;
    if (!selected) return addEl({ ...newElement("text", tpl), content: tag });
    if (selected.type === "image") updateEl(selected.id, { image_url: tag });
    else if (selected.type === "text") updateEl(selected.id, { content: selected.content ? `${selected.content} ${tag}` : tag });
    else if (selected.type === "rect") addEl({ ...newElement("text", tpl), content: tag });
    else updateEl(selected.id, { content: tag });
  };
  const addTool = (t: Tool) => tpl && addEl({ ...newElement(t.type, tpl), ...(t.type === "rect" ? { w: Math.min(30, tpl.width_mm - 6) } : {}), ...t.patch });
  const dropField = (col: string, x: number, y: number) => tpl && addEl({ ...newElement("text", tpl), content: `{{${col}}}`, x, y });
  const arrange = (dir: "front" | "back") => selected && change((t) => {
    const rest = t.elements.filter((e) => e.id !== selected.id);
    return { ...t, elements: dir === "front" ? [...rest, selected] : [selected, ...rest] };
  });
  const duplicateEl = () => selected && addEl({ ...selected, id: crypto.randomUUID(), x: selected.x + 2, y: selected.y + 2 });

  // ---- keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); if (tpl) save.mutate(); return; }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (!selected) return;
      const step = e.shiftKey ? 5 : 0.5;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) { e.preventDefault(); updateEl(selected.id, { x: round(selected.x + moves[e.key][0]), y: round(selected.y + moves[e.key][1]) }); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeEl(selected.id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, tpl, save, undo, redo, updateEl, removeEl]);

  const zoom = tpl ? (zooms[tpl.id] ?? fitZoomFor(tpl)) : 1;
  const brands = [...new Set(templates.map((t) => t.brand))].sort();

  return (
    <div className="flex h-screen flex-col bg-[#EEF0F3] text-[#1F2937]">
      {/* Toolbar */}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-[#D9DDE3] bg-white px-2" data-testid="app-header">
        <div className="mr-2 flex items-center gap-2 pl-1 pr-3">
          <span className="grid size-7 place-items-center rounded-md bg-[#1A73E8] text-white"><Barcode className="size-4" /></span>
          <span className="hidden text-sm font-semibold tracking-tight md:inline">BARCODR <span className="font-normal text-[#6B7280]">Studio</span></span>
        </div>
        <ToolButton testId="toolbar-preview-button" icon={<Eye />} label="Preview" primary onClick={() => setDialog("preview")} disabled={!tpl} />
        <ToolButton testId="toolbar-print-button" icon={<Printer />} label="Print" primary onClick={() => runPrint(printRows)} disabled={!tpl} />
        <span className="mx-1 h-6 w-px bg-[#E5E7EB]" />
        <ToolButton testId="save-template-button" icon={<Save />} label="Save" onClick={() => save.mutate()} disabled={!tpl || !draft?.dirty || save.isPending} />
        <ToolButton testId="undo-button" icon={<Undo2 />} label="Undo" onClick={undo} disabled={!draft?.past.length} />
        <ToolButton testId="redo-button" icon={<Redo2 />} label="Redo" onClick={redo} disabled={!draft?.future.length} />
        <ToolButton testId="label-properties-button" icon={<SlidersHorizontal />} label="Label properties" onClick={() => setSelectedId(null)} disabled={!tpl} />
        <span className="mx-1 h-6 w-px bg-[#E5E7EB]" />
        <ToolButton testId="open-label-button" icon={<FolderOpen />} label="Open label" onClick={() => setDialog("open")} />
        <ToolButton testId="new-template-button" icon={<FilePlus2 />} label="New label" primary onClick={() => setDialog("new")} />
        <ToolButton testId="copy-label-button" icon={<Copy />} label="Create a copy" onClick={() => tpl && duplicate.mutate(tpl.id)} disabled={!tpl} />
        <span className="ml-auto pr-2 text-xs text-[#6B7280]" data-testid="save-status">{tpl ? (draft?.dirty ? "● Unsaved changes" : "Saved") : ""}</span>
      </header>

      {/* Label tabs */}
      <nav className="flex h-9 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-[#D9DDE3] bg-[#F3F4F6] px-2" data-testid="label-tabs">
        {tabIds.map((id) => {
          const t = draftOf(id, drafts)?.tpl;
          if (!t) return null;
          const on = id === currentId;
          return (
            <div key={id} data-testid={`label-tab-${id}`}
              className={cn("group flex h-8 shrink-0 items-center gap-2 rounded-t-md border border-b-0 px-3 text-xs transition-colors duration-150",
                on ? "border-[#D9DDE3] bg-white text-[#1F2937]" : "border-transparent text-[#4B5563] hover:bg-[#E5E7EB]")}>
              <button onClick={() => { setActiveId(id); setSelectedId(null); }} className="flex items-center gap-1.5" data-testid={`label-tab-open-${id}`}>
                {drafts[id]?.dirty && <span className="size-1.5 rounded-full bg-[#F29900]" />}
                <span className="max-w-44 truncate font-medium">{t.name}</span>
                <span className="text-[#9CA3AF]">| {t.width_mm} × {t.height_mm} mm</span>
              </button>
              <button onClick={() => closeTab(id)} data-testid={`label-tab-close-${id}`} title="Close"
                className="grid size-4 place-items-center rounded text-[#9CA3AF] hover:bg-[#E5E7EB] hover:text-[#1F2937]"><X className="size-3" /></button>
            </div>
          );
        })}
      </nav>

      {tpl ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <LeftPanel onTool={addTool} columns={columns} sourceName={source?.name ?? null} onPickField={insertField} onOpenImport={() => setDialog("import")}
              layers={tpl.elements} selectedId={selectedId} onSelect={setSelectedId} />
            <Canvas tpl={tpl} row={previewRow} mapping={mapping} zoom={zoom} fitZoom={fitZoomFor(tpl)} onZoom={(z) => setZooms({ ...zooms, [tpl.id]: z })}
              selectedId={selectedId} onSelect={setSelectedId} onChangeEl={(id, p) => updateEl(id, p, false)} onBeginChange={snapshot} onDropField={dropField} />
            <aside className="w-72 shrink-0 overflow-y-auto border-l border-[#D9DDE3] bg-white">
              <Inspector tpl={tpl} selected={selected} columns={columns}
                onEl={(p) => selected && updateEl(selected.id, p)} onTpl={(p) => change((t) => ({ ...t, ...p }))}
                onArrange={arrange} onDuplicate={duplicateEl} onDelete={() => selected && removeEl(selected.id)} onInsertField={insertField} />
            </aside>
          </div>
          <DataGrid sources={sources} activeSourceId={source?.id ?? null} onChooseSource={linkSource} onDeleteSource={(id) => deleteSource.mutate(id)}
            columns={columns} rows={copyRows} edited={!!copy?.edited} loading={copyQ.isFetching} error={copyQ.isError ? apiErrorDetail(copyQ.error, "Could not load sheet") : null}
            canRefresh={canRefresh} refreshing={refreshCopy.isPending} onRefresh={onRefresh}
            onOpenImport={() => setDialog("import")}
            onToggle={(ids, on) => updateCopy((c) => ({ ...c, rows: c.rows.map((r) => (ids.includes(r.id) ? { ...r, selected: on } : r)) }))}
            onQty={(id, qty) => updateCopy((c) => ({ ...c, rows: c.rows.map((r) => (r.id === id ? { ...r, qty } : r)) }))}
            onEditData={() => { if (draft?.dirty) save.mutate(); }}
            onPrintRow={(r) => runPrint([r], true)} onPreview={() => setDialog("preview")} onPrint={() => runPrint(printRows)}
            collapsed={gridCollapsed} onCollapse={() => setGridCollapsed((c) => !c)} />
        </div>
      ) : (
        <div className="grid flex-1 place-items-center" data-testid="workspace-empty">
          <div className="text-center">
            <Barcode className="mx-auto mb-3 size-10 text-[#1A73E8]" />
            <p className="mb-4 text-sm text-[#4B5563]">{templatesQ.isLoading ? "Loading labels…" : "No label open."}</p>
            <div className="flex justify-center gap-2">
              <button data-testid="empty-new-label-button" onClick={() => setDialog("new")} className="rounded-md bg-[#1A73E8] px-4 py-2 text-sm text-white hover:bg-[#1765CC]">New label</button>
              <button data-testid="empty-open-label-button" onClick={() => setDialog("open")} className="rounded-md border border-[#D1D5DB] bg-white px-4 py-2 text-sm hover:bg-[#F3F4F6]">Open label</button>
            </div>
          </div>
        </div>
      )}

      <NewLabelDialog open={dialog === "new"} onOpenChange={(o) => setDialog(o ? "new" : null)} brands={brands} pending={create.isPending} onCreate={(b) => create.mutate(b)} />
      <OpenLabelDialog open={dialog === "open"} onOpenChange={(o) => setDialog(o ? "open" : null)} templates={templates} onOpen={openTab}
        onDuplicate={(id) => duplicate.mutate(id)} onDelete={(t) => confirm(`Delete "${t.name}"?`) && remove.mutate(t.id)} />
      <Dialog open={dialog === "import"} onOpenChange={(o) => setDialog(o ? "import" : null)}>
        <DialogContent data-testid="import-dialog">
          <DialogHeader><DialogTitle>Import print data</DialogTitle></DialogHeader>
          <SheetImporter sources={sources} onImported={onImported} />
        </DialogContent>
      </Dialog>
      <RefreshDialog open={dialog === "refresh"} onOpenChange={(o) => setDialog(o ? "refresh" : null)} pending={refreshCopy.isPending}
        onChoose={(mode) => refreshCopy.mutate(mode, { onSuccess: () => setDialog(null) })} />
      {tpl && (
        <PrintPreviewDialog open={dialog === "preview"} onOpenChange={(o) => setDialog(o ? "preview" : null)} template={tpl} rows={printRows} mapping={mapping}
          missing={missing} layout={layout} onLayout={setLayout} onPrint={() => runPrint(printRows)} />
      )}
      {tpl && printJob && <PrintPortal template={tpl} rows={printJob.rows} mapping={mapping} layout={printJob.single ? { ...layout, mode: "roll" } : layout} />}
    </div>
  );
}
