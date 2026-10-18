import { useCallback, useEffect, useMemo, useState } from "react";
import { useHistorySummary, useRecordPrint } from "@/lib/history";
import { barcodeColumns, duplicateCells, findDuplicates, useDuplicateGuard } from "@/components/workspace/DuplicateGuard";
import { BarcodeGenerator } from "@/components/workspace/BarcodeGenerator";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Barcode, Cog, Copy, ListOrdered, Table2, Eye, FilePlus2, FolderOpen, Printer, Redo2, Save, Settings2, SlidersHorizontal, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { SheetImporter } from "@/components/SheetImporter";
import { ThemePicker } from "@/components/ThemePicker";
import { Canvas } from "@/components/workspace/Canvas";
import { DataGrid } from "@/components/workspace/DataGrid";
import { Inspector } from "@/components/workspace/Inspector";
import { NewLabelDialog, OpenLabelDialog } from "@/components/workspace/LabelDialogs";
import { LeftPanel } from "@/components/workspace/LeftPanel";
import type { Library, Tool } from "@/components/workspace/LeftPanel";
import { ImageLibrary } from "@/components/workspace/ImageLibrary";
import { SettingsDialog, UpdateBanner } from "@/components/SettingsDialog";
import { alignEls, distributeEls } from "@/lib/align";
import type { AlignKind } from "@/lib/align";
import { PrintPortal, PrintPreviewDialog } from "@/components/workspace/PrintPreview";
import { RefreshDialog } from "@/components/workspace/RefreshDialog";
import { useSheetCopy } from "@/lib/useSheetCopy";
import { queueItemsFrom, useAddToQueue, useQueueCount } from "@/lib/queue";
import { expandRows, rowQty, tickByQty, withQty, withTick } from "@/lib/grid";
import { PageSetupDialog } from "@/components/workspace/PageSetupDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiDelete, apiErrorDetail, apiPatch, apiPost, apiPut } from "@/lib/api";
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
  name: t.name, brand: t.brand, width_mm: t.width_mm, height_mm: t.height_mm, background: t.background, elements: t.elements, source_id: t.source_id, page_setup: t.page_setup,
  background_image: t.background_image ?? "", background_fit: t.background_fit ?? "cover", background_opacity: t.background_opacity ?? 1, pinned: t.pinned ?? false,
});

function ToolButton({ icon, label, onClick, disabled, testId, primary }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; testId: string; primary?: boolean }) {
  return (
    <button data-testid={testId} onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded px-2 text-[13px] whitespace-nowrap transition-colors duration-150 disabled:opacity-40 [&_svg]:size-4",
        primary ? "text-(--app-accent) hover:bg-(--app-accent-soft)" : "text-[#1F2937] hover:bg-[#EEF0F3]")}>
      {icon}
      {/* key actions keep their text on normal screens; the rest show text only on very wide screens */}
      <span className={primary ? "hidden xl:inline" : "hidden min-[1760px]:inline"}>{label}</span>
    </button>
  );
}

export default function Workspace() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const templatesQ = useQuery({ queryKey: ["templates"], queryFn: fetchTemplates });
  const sourcesQ = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const templates = useMemo(() => (templatesQ.isError ? [] : (templatesQ.data ?? [])), [templatesQ.data, templatesQ.isError]);
  const sources = sourcesQ.isError ? [] : (sourcesQ.data ?? []);

  const [openIds, setOpenIds] = useState<string[]>(() => load("bc.openTabs", []));
  const [activeId, setActiveId] = useState<string>(() => load("bc.activeTab", ""));
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const setSelectedId = useCallback((id: string | null) => setSelectedIds(id ? [id] : []), []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zooms, setZooms] = useState<Record<string, number>>({});
  const [printJob, setPrintJob] = useState<{ rows: Row[]; single: boolean } | null>(null);
  const [dialog, setDialog] = useState<null | "new" | "open" | "import" | "preview" | "refresh" | "pagesetup">(null);
  const [gridCollapsed, setGridCollapsed] = useState(false);

  // Tabs: reopen the labels (and active label) from last time; if none survive, open the most recently edited one.
  // Wait until labels are loaded — otherwise the remembered tabs would be wiped while the list is still empty.
  const loaded = templatesQ.isSuccess;
  const tabIds = useMemo(() => {
    if (!loaded) return openIds;
    const ids = openIds.filter((id) => templates.some((t) => t.id === id));
    return ids.length || !templates.length ? ids : [templates[0].id]; // list is sorted newest-edited first
  }, [openIds, templates, loaded]);
  const currentId = tabIds.includes(activeId) ? activeId : (tabIds[tabIds.length - 1] ?? "");
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("bc.openTabs", JSON.stringify(tabIds));
    localStorage.setItem("bc.activeTab", JSON.stringify(currentId));
  }, [tabIds, currentId, loaded]);

  const draftOf = useCallback((id: string, d: Record<string, Draft>): Draft | undefined => {
    if (d[id]) return d[id];
    const t = templates.find((x) => x.id === id);
    return t ? { tpl: t, past: [], future: [], dirty: false } : undefined;
  }, [templates]);
  const draft = draftOf(currentId, drafts);
  const tpl = draft?.tpl ?? null;
  const selected = tpl?.elements.find((e) => e.id === selectedId) ?? null;
  const selectedEls = useMemo(() => tpl?.elements.filter((e) => selectedIds.includes(e.id)) ?? [], [tpl, selectedIds]);

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
  const updateEls = useCallback((patches: Record<string, Partial<LabelElement>>, record = true) =>
    change((t) => ({ ...t, elements: t.elements.map((e) => (patches[e.id] ? { ...e, ...patches[e.id] } : e)) }), record), [change]);
  const removeEls = useCallback((ids: string[]) => { change((t) => ({ ...t, elements: t.elements.filter((e) => !ids.includes(e.id)) })); setSelectedIds([]); }, [change]);
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
  // rename / re-brand from the Open label cards: saves only name + brand on top of the stored label
  const rename = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; brand?: string; pinned?: boolean }) => {
      const t = templates.find((x) => x.id === id);
      if (!t) throw new Error("Label not found");
      if (patch.pinned !== undefined && patch.name === undefined) return apiPatch<Template>(`/templates/${id}/pin`, { pinned: patch.pinned });
      return putTemplate(id, { ...toBase(t), ...patch });
    },
    onSuccess: (saved, vars) => {
      syncSaved(saved);
      setDrafts((d) => (d[saved.id] ? { ...d, [saved.id]: { ...d[saved.id], tpl: { ...d[saved.id].tpl, name: saved.name, brand: saved.brand, pinned: saved.pinned } } } : d));
      toast.success(vars.pinned !== undefined ? (saved.pinned ? `Pinned "${saved.name}" to the top` : `Unpinned "${saved.name}"`) : `Renamed to "${saved.name}" · ${saved.brand}`);
    },
    onError: (e) => toast.error("Could not rename label", { description: apiErrorDetail(e, "The server did not answer — try again.") }),
  });
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
    onError: (e) => toast.error("Save failed", { description: apiErrorDetail(e, "The server did not answer — check your connection and try again.") }),
  });
  const create = useMutation({
    mutationFn: (body: TemplateBase) => apiPost<Template>("/templates", body),
    onSuccess: (t) => {
      qc.setQueryData<Template[]>(["templates"], (list) => [t, ...(list ?? [])]);
      openTab(t.id);
      toast.success(`"${t.name}" created`);
    },
    onError: (e) => toast.error("Could not create label", { description: apiErrorDetail(e, "The server did not answer — check your connection and try again.") }),
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
  /** Settings that save instantly (linked sheet, page setup) without touching unsaved design edits. */
  const persist = (patch: Partial<TemplateBase>, errorMsg: string) => {
    if (!tpl) return;
    setDrafts((d) => {
      const cur = draftOf(tpl.id, d);
      return cur ? { ...d, [tpl.id]: { ...cur, tpl: { ...cur.tpl, ...patch } } } : d;
    });
    const server = templates.find((t) => t.id === tpl.id);
    if (server) putTemplate(server.id, { ...toBase(server), ...patch }).then(syncSaved).catch(() => toast.error(errorMsg));
  };
  // new labels keep using the sheet / Excel file you're working with
  const createLinked = (b: TemplateBase) => create.mutate({ ...b, source_id: b.source_id ?? source?.id ?? null });
  const linkSource = (id: string | null) => persist({ source_id: id }, "Could not link sheet");
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
  const qtyColumn = copy?.qty_column ?? null;
  const queueCount = useQueueCount();
  const addToQueue = useAddToQueue(() => nav("/queue"));
  const queueTicked = () => {
    if (!tpl) return;
    const items = queueItemsFrom(copyRows, qtyColumn);
    if (!items.length) return toast.error("Tick rows with a quantity first");
    if (draft?.dirty) save.mutate(); // queue uses the saved label design
    addToQueue.mutate({ template_id: tpl.id, source_id: source?.id ?? null, items });
  };
  const printRows = expandRows(copyRows, qtyColumn);
  const previewRow = copyRows.find((r) => r.selected && rowQty(r, qtyColumn) > 0)?.cells ?? rows[0] ?? null;

  const recordPrint = useRecordPrint();
  const history = useHistorySummary();
  const dupGuard = useDuplicateGuard();
  const dupCells = useMemo(() => duplicateCells(copyRows, tpl ? barcodeColumns(tpl.elements, mapping, columns) : []), [copyRows, tpl, mapping, columns]);
  const [genOpen, setGenOpen] = useState(false);
  const runPrint = (list: Row[], single = false) => {
    if (!tpl) return;
    if (!list.length) return toast.error(rows.length ? "Tick at least one row to print" : "Import data first");
    const dups = findDuplicates(copyRows, barcodeColumns(tpl.elements, mapping, columns), single ? (r) => r.cells === list[0] : (r) => r.selected);
    dupGuard.guard(dups, () => printNow(list, single));
  };
  const printNow = (list: Row[], single: boolean) => {
    if (!tpl) return;
    flushSync(() => setPrintJob({ rows: list, single }));
    window.print();
    setPrintJob(null);
    recordPrint("designer", [{ template_id: tpl.id, template_name: tpl.name, source_id: source?.id ?? null, source_name: source?.name ?? "", labels: list.length }]);
  };

  // ---- editing helpers
  const insertField = (col: string) => {
    if (!tpl) return;
    const tag = `{{${col}}}`;
    if (!selected) return addEl({ ...newElement("text", tpl), content: tag });
    if (selected.type === "image") updateEl(selected.id, { image_url: tag });
    else if (selected.type === "text") updateEl(selected.id, { content: selected.content ? `${selected.content} ${tag}` : tag });
    else if (selected.type === "table") updateEl(selected.id, { content: `${selected.content}|${tag}` });
    else if (["rect", "line", "icon"].includes(selected.type)) addEl({ ...newElement("text", tpl), content: tag });
    else updateEl(selected.id, { content: tag });
  };
  const [library, setLibrary] = useState<null | Library | "replace">(null);
  const addTool = (t: Tool) => {
    if (!tpl) return;
    if (t.library) return setLibrary(t.library);
    if (!t.type) return;
    const el = { ...newElement(t.type, tpl), ...t.patch };
    const w = Math.min(el.w, tpl.width_mm - 4), h = Math.min(el.h, tpl.height_mm - 4);
    const step = (tpl.elements.length % 6) * 2.5; // cascade so new elements don't stack exactly on top of each other
    addEl({ ...el, w, h, x: Math.max(0, Math.min(el.x + step, tpl.width_mm - w)), y: Math.max(0, Math.min(el.y + step, tpl.height_mm - h)) });
  };
  const pickImage = (url: string) => {
    if (!tpl) return;
    if (library === "background") return change((t) => ({ ...t, background_image: url }));
    if (library === "replace" && selected?.type === "image") return updateEl(selected.id, { image_url: url });
    const logo = library === "logo";
    addEl({ ...newElement("image", tpl), image_url: url, ...(logo ? { x: 2, y: 2, w: Math.min(18, tpl.width_mm - 4), h: Math.min(10, tpl.height_mm - 4) } : {}) });
  };
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
      if (mod && e.key.toLowerCase() === "a" && tpl) { e.preventDefault(); setSelectedIds(tpl.elements.map((x) => x.id)); return; }
      if (!selectedEls.length) return;
      const step = e.shiftKey ? 5 : 0.5;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        updateEls(Object.fromEntries(selectedEls.map((x) => [x.id, { x: round(x.x + moves[e.key][0]), y: round(x.y + moves[e.key][1]) }])));
      } else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeEls(selectedEls.map((x) => x.id)); }
      else if (e.key === "Escape") setSelectedIds([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedEls, tpl, save, undo, redo, updateEls, removeEls]);

  const alignSel = (kind: AlignKind) => tpl && updateEls(alignEls(selectedEls, kind, tpl));
  const distributeSel = (axis: "h" | "v") => updateEls(distributeEls(selectedEls, axis));
  const duplicateSel = () => {
    if (!selectedEls.length) return;
    const copies = selectedEls.map((x) => ({ ...x, id: crypto.randomUUID(), x: x.x + 2, y: x.y + 2 }));
    change((t) => ({ ...t, elements: [...t.elements, ...copies] }));
    setSelectedIds(copies.map((c) => c.id));
  };
  const arrangeSel = (dir: "front" | "back") => change((t) => {
    const sel = t.elements.filter((e) => selectedIds.includes(e.id));
    const rest = t.elements.filter((e) => !selectedIds.includes(e.id));
    return { ...t, elements: dir === "front" ? [...rest, ...sel] : [...sel, ...rest] };
  });

  const zoom = tpl ? (zooms[tpl.id] ?? fitZoomFor(tpl)) : 1;
  const brands = [...new Set(templates.map((t) => t.brand))].sort();

  return (
    <div className="app-screen flex flex-col bg-[#EEF0F3] text-[#1F2937]">
      {/* Toolbar */}
      <header className="no-scrollbar flex h-12 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[#D9DDE3] bg-white px-2" data-testid="app-header">
        <div className="mr-2 flex shrink-0 items-center gap-2 pl-1 pr-3">
          <span className="grid size-7 place-items-center rounded-md bg-(--app-accent) text-white"><Barcode className="size-4" /></span>
          <span className="hidden text-sm font-semibold tracking-tight md:inline">RAPID LABELS <span className="font-normal text-[#6B7280]">by MOHAN</span></span>
        </div>
        <ToolButton testId="toolbar-preview-button" icon={<Eye />} label="Preview" primary onClick={() => setDialog("preview")} disabled={!tpl} />
        <ToolButton testId="toolbar-print-button" icon={<Printer />} label="Print" primary onClick={() => runPrint(printRows)} disabled={!tpl} />
        <span className="mx-1 h-6 w-px bg-[#E5E7EB]" />
        <ToolButton testId="save-template-button" icon={<Save />} label="Save" onClick={() => save.mutate()} disabled={!tpl || !draft?.dirty || save.isPending} />
        <ToolButton testId="undo-button" icon={<Undo2 />} label="Undo" onClick={undo} disabled={!draft?.past.length} />
        <ToolButton testId="redo-button" icon={<Redo2 />} label="Redo" onClick={redo} disabled={!draft?.future.length} />
        <ToolButton testId="sheet-data-page-button" icon={<Table2 />} label="Sheet data" primary
          onClick={() => { if (draft?.dirty) save.mutate(); nav(source ? `/data/${source.id}` : "/data"); }} />
        <ToolButton testId="print-queue-button" icon={<ListOrdered />} label={`Print queue${queueCount ? ` (${queueCount})` : ""}`} primary onClick={() => nav("/queue")} />
        <ToolButton testId="page-setup-button" icon={<Settings2 />} label="Page setup" onClick={() => setDialog("pagesetup")} disabled={!tpl} />
        <ToolButton testId="label-properties-button" icon={<SlidersHorizontal />} label="Label properties" onClick={() => setSelectedId(null)} disabled={!tpl} />
        <span className="mx-1 h-6 w-px bg-[#E5E7EB]" />
        <ToolButton testId="open-label-button" icon={<FolderOpen />} label="Open label" onClick={() => setDialog("open")} />
        <ToolButton testId="new-template-button" icon={<FilePlus2 />} label="New label" primary onClick={() => setDialog("new")} />
        <ToolButton testId="copy-label-button" icon={<Copy />} label="Create a copy" onClick={() => tpl && duplicate.mutate(tpl.id)} disabled={!tpl} />
        <span className="ml-auto pr-2 text-xs text-[#6B7280]" data-testid="save-status">{tpl ? (draft?.dirty ? "● Unsaved changes" : "Saved") : ""}</span>
        <button data-testid="today-printed-badge" onClick={() => nav("/history")} title="Labels printed today — open Print history"
          className="mr-1 flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-[#E6F4EA] px-2.5 text-xs text-[#137333] transition-colors duration-150 hover:bg-[#CEEAD6] [&_svg]:size-3.5">
          <Printer /> Today: <b className="font-mono">{(history.data?.today_labels ?? 0).toLocaleString()}</b>
        </button>
        <ToolButton testId="settings-button" icon={<Cog />} label="Settings & backup" onClick={() => setSettingsOpen(true)} />
        <ThemePicker />
      </header>
      <UpdateBanner />

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
              selectedIds={selectedIds} onSelectIds={setSelectedIds} onChangeEls={(p) => updateEls(p, false)} onBeginChange={snapshot} onDropField={dropField} />
            <aside className="w-72 shrink-0 overflow-y-auto border-l border-[#D9DDE3] bg-white">
              <Inspector tpl={tpl} selected={selected} selection={selectedEls} onAlign={alignSel} onDistribute={distributeSel}
                onGroupDuplicate={duplicateSel} onGroupDelete={() => removeEls(selectedIds)} onGroupArrange={arrangeSel} columns={columns}
                onEl={(p) => selected && updateEl(selected.id, p)} onTpl={(p) => change((t) => ({ ...t, ...p }))}
                onArrange={arrange} onDuplicate={duplicateEl} onDelete={() => selected && removeEl(selected.id)} onInsertField={insertField} onOpenLibrary={setLibrary} />
            </aside>
          </div>
          <DataGrid sources={sources} activeSourceId={source?.id ?? null} onChooseSource={linkSource} onDeleteSource={(id) => deleteSource.mutate(id)}
            columns={columns} rows={copyRows} edited={!!copy?.edited} loading={copyQ.isFetching} error={copyQ.isError ? apiErrorDetail(copyQ.error, "Could not load sheet") : null}
            canRefresh={canRefresh} refreshing={refreshCopy.isPending} onRefresh={onRefresh}
            onOpenImport={() => setDialog("import")}
            onToggle={(ids, on) => updateCopy((c) => ({ ...c, rows: c.rows.map((r) => (ids.includes(r.id) ? withTick(r, on, c.qty_column) : r)) }))}
            qtyColumn={qtyColumn} onQtyColumn={(col) => updateCopy((c) => ({ ...c, qty_column: col, rows: tickByQty(c.rows, col) }))}
            onQty={(id, qty) => updateCopy((c) => ({ ...c, rows: c.rows.map((r) => (r.id === id ? withQty(r, qty, c.qty_column) : r)) }))}
            onEditData={() => { if (draft?.dirty) save.mutate(); }}
            onPrintRow={(r) => runPrint([r], true)} onPreview={() => setDialog("preview")} onPrint={() => runPrint(printRows)} onQueue={queueTicked} onGenerate={() => setGenOpen(true)} dupCells={dupCells}
            collapsed={gridCollapsed} onCollapse={() => setGridCollapsed((c) => !c)} />
        </div>
      ) : (
        <div className="grid flex-1 place-items-center" data-testid="workspace-empty">
          <div className="text-center">
            <Barcode className="mx-auto mb-3 size-10 text-(--app-accent)" />
            <p className="mb-4 text-sm text-[#4B5563]">{templatesQ.isLoading ? "Loading labels…" : "No label open."}</p>
            <div className="flex justify-center gap-2">
              <button data-testid="empty-new-label-button" onClick={() => setDialog("new")} className="rounded-md bg-(--app-accent) px-4 py-2 text-sm text-white hover:bg-(--app-accent-hover)">New label</button>
              <button data-testid="empty-open-label-button" onClick={() => setDialog("open")} className="rounded-md border border-[#D1D5DB] bg-white px-4 py-2 text-sm hover:bg-[#F3F4F6]">Open label</button>
            </div>
          </div>
        </div>
      )}

      {dupGuard.dialog}
      <BarcodeGenerator open={genOpen} onOpenChange={setGenOpen} columns={columns} rows={copyRows}
        onApply={(col, isNew, values) => updateCopy((c) => ({
          ...c,
          columns: isNew ? [...c.columns, col] : c.columns,
          rows: c.rows.map((r) => (values[r.id] ? { ...r, cells: { ...r.cells, [col]: values[r.id] } } : isNew ? { ...r, cells: { ...r.cells, [col]: "" } } : r)),
        }))} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ImageLibrary open={library !== null} onOpenChange={(o) => !o && setLibrary(null)} onPick={pickImage}
        title={library === "background" ? "Choose a background picture" : library === "logo" ? "Choose your logo" : "Choose an image"} />
      <NewLabelDialog open={dialog === "new"} onOpenChange={(o) => setDialog(o ? "new" : null)} brands={brands} pending={create.isPending} onCreate={createLinked} />
      <OpenLabelDialog open={dialog === "open"} onOpenChange={(o) => { setDialog(o ? "open" : null); if (o) templatesQ.refetch(); }} templates={templates}
        loading={templatesQ.isFetching && !templates.length} error={templatesQ.isError ? apiErrorDetail(templatesQ.error, "Could not load labels") : null} onRetry={() => templatesQ.refetch()} onOpen={openTab}
        onCreate={createLinked} creating={create.isPending} currentId={currentId} brands={brands}
        onRename={(id, name, brand) => rename.mutateAsync({ id, name, brand })}
        onTogglePin={(id, pinned) => rename.mutate({ id, pinned })}
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
          ps={tpl.page_setup} missing={missing} onPrint={() => runPrint(printRows)} onPageSetup={() => setDialog("pagesetup")} />
      )}
      {tpl && (
        <PageSetupDialog open={dialog === "pagesetup"} onOpenChange={(o) => setDialog(o ? "pagesetup" : null)} template={tpl} value={tpl.page_setup}
          onSave={(ps) => { persist({ page_setup: ps }, "Could not save page setup"); setDialog(null); toast.success("Page setup saved"); }} />
      )}
      {tpl && printJob && <PrintPortal template={tpl} ps={tpl.page_setup} rows={printJob.rows} mapping={mapping} />}
    </div>
  );
}
