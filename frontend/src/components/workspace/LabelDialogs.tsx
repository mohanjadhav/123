import { useMemo, useState } from "react";
import { Check, Copy, FolderOpen, Pencil, Search, Trash2, X } from "lucide-react";
import { Label as LabelView, Scaled } from "@/components/label/Label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DEFAULT_PAGE_SETUP, MM_TO_PX } from "@/lib/label";
import { STARTERS } from "@/lib/starters";
import type { Starter } from "@/lib/starters";
import type { Template, TemplateBase } from "@/lib/types";
import { cn } from "@/lib/utils";

const fit = (t: { width_mm: number; height_mm: number }, w: number, h: number) =>
  Math.min(w / (t.width_mm * MM_TO_PX), h / (t.height_mm * MM_TO_PX), 1.5);

/** Build a new label from a ready-made starter (fresh element ids). */
export function starterToTemplate(starter: Starter, opts: { name?: string; brand?: string; w?: number; h?: number } = {}): TemplateBase {
  return {
    ...starter.tpl,
    width_mm: opts.w ?? starter.tpl.width_mm,
    height_mm: opts.h ?? starter.tpl.height_mm,
    elements: starter.tpl.elements.map((e) => ({ ...e, id: crypto.randomUUID() })),
    name: opts.name?.trim() || starter.title,
    brand: opts.brand?.trim() || "General",
    source_id: null,
    page_setup: DEFAULT_PAGE_SETUP,
    background_image: "",
    background_fit: "cover",
    background_opacity: 1,
  };
}

export function NewLabelDialog({ open, onOpenChange, brands, onCreate, pending }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  brands: string[];
  onCreate: (t: TemplateBase) => void;
  pending: boolean;
}) {
  const [key, setKey] = useState("price");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const starter = STARTERS.find((s) => s.key === key) ?? STARTERS[0];
  const [size, setSize] = useState({ w: "60", h: "40" });

  const submit = () => {
    const w = key === "blank" ? parseFloat(size.w) : starter.tpl.width_mm;
    const h = key === "blank" ? parseFloat(size.h) : starter.tpl.height_mm;
    if (!(w > 0) || !(h > 0)) return;
    onCreate(starterToTemplate(starter, { name, brand, w, h }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(860px,95vw)] sm:max-w-[min(860px,95vw)]" data-testid="new-template-dialog">
        <DialogHeader><DialogTitle>New label</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-[#6B7280]">Pick a ready-made starter — its fields (like <span className="font-mono">{"{{price}}"}</span>) link automatically to matching sheet columns.</p>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3" data-testid="starter-gallery">
          {STARTERS.map((s) => (
            <button key={s.key} data-testid={`starter-${s.key}`} onClick={() => setKey(s.key)}
              className={cn("overflow-hidden rounded-lg border text-left transition-[border-color,box-shadow] duration-150",
                key === s.key ? "border-(--app-accent) shadow-[0_0_0_2px_var(--app-accent-ring)]" : "border-[#D9DDE3] hover:border-(--app-accent-ring)")}>
              <div className="grid h-28 place-items-center bg-[#F1F3F4]">
                <Scaled widthMm={s.tpl.width_mm} heightMm={s.tpl.height_mm} scale={fit(s.tpl, 170, 92)} className="shadow-[0_1px_4px_rgba(0,0,0,0.2)]">
                  <LabelView template={s.tpl} />
                </Scaled>
              </div>
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-[#1F2937]">{s.title}</p>
                <p className="text-[11px] text-[#6B7280]">{s.description} · {s.tpl.width_mm}×{s.tpl.height_mm} mm</p>
              </div>
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1 text-xs text-[#4B5563]">Label name
            <Input data-testid="new-template-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={starter.title} />
          </label>
          <label className="grid gap-1 text-xs text-[#4B5563]">Brand
            <Input data-testid="new-template-brand-input" list="brand-options" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. AURA Studio" />
            <datalist id="brand-options">{brands.map((b) => <option key={b} value={b} />)}</datalist>
          </label>
          {key === "blank" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs text-[#4B5563]">W (mm)
                <Input type="number" className="w-20" data-testid="new-template-width-input" value={size.w} onChange={(e) => setSize({ ...size, w: e.target.value })} />
              </label>
              <label className="grid gap-1 text-xs text-[#4B5563]">H (mm)
                <Input type="number" className="w-20" data-testid="new-template-height-input" value={size.h} onChange={(e) => setSize({ ...size, h: e.target.value })} />
              </label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button data-testid="new-template-submit-button" disabled={pending} onClick={submit} className="bg-(--app-accent) text-white hover:bg-(--app-accent-hover)">Create label</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inline name + brand editor on an Open label card. */
function RenameForm({ t, brands, onRename, onDone }: { t: Template; brands: string[]; onRename: (id: string, name: string, brand: string) => Promise<unknown>; onDone: () => void }) {
  const [name, setName] = useState(t.name);
  const [brand, setBrand] = useState(t.brand);
  const [busy, setBusy] = useState(false);
  const ok = name.trim().length > 0 && name.trim().length <= 120;
  const submit = async () => {
    if (!ok || busy) return;
    if (name.trim() === t.name && (brand.trim() || "General") === t.brand) return onDone();
    setBusy(true);
    try { await onRename(t.id, name.trim(), brand.trim() || "General"); onDone(); } catch { /* toast already shown */ } finally { setBusy(false); }
  };
  const key = (e: React.KeyboardEvent) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { e.stopPropagation(); onDone(); } };
  return (
    <div className="grid gap-1 px-2 py-1.5" data-testid={`rename-form-${t.id}`}>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={key} placeholder="Label name" className="h-7 px-2 text-xs" data-testid={`rename-name-input-${t.id}`} />
      <Input value={brand} onChange={(e) => setBrand(e.target.value)} onKeyDown={key} placeholder="Brand" list="label-brand-options" className="h-7 px-2 text-xs" data-testid={`rename-brand-input-${t.id}`} />
      <datalist id="label-brand-options">{brands.map((b) => <option key={b} value={b} />)}</datalist>
      <div className="flex gap-1">
        <Button size="xs" className="h-6 flex-1 bg-(--app-accent) text-[11px] text-white hover:bg-(--app-accent-hover)" disabled={!ok || busy} onClick={submit} data-testid={`rename-save-${t.id}`}><Check /> {busy ? "Saving…" : "Save"}</Button>
        <Button size="icon-xs" variant="ghost" title="Cancel" onClick={onDone} data-testid={`rename-cancel-${t.id}`}><X /></Button>
      </div>
    </div>
  );
}

export function OpenLabelDialog({ open, onOpenChange, templates, loading, error, onRetry, onOpen, onDuplicate, onDelete, onCreate, creating, currentId, brands, onRename }: {
  open: boolean;
  brands: string[];
  onRename: (id: string, name: string, brand: string) => Promise<unknown>;
  onCreate: (t: TemplateBase) => void;
  creating: boolean;
  currentId: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenChange: (o: boolean) => void;
  templates: Template[];
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (t: Template) => void;
}) {
  const [q, setQ] = useState("");
  // all labels in one grid, most recently edited first (the list from the server is already sorted)
  const [editing, setEditing] = useState<string | null>(null);
  const shown = useMemo(() => templates.filter((t) => !q || `${t.name} ${t.brand}`.toLowerCase().includes(q.toLowerCase())), [templates, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(820px,95vw)] sm:max-w-[min(820px,95vw)]" data-testid="open-label-dialog">
        <DialogHeader><DialogTitle>Open label</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by label or brand" className="pl-8" data-testid="open-label-search" />
        </div>
        <div className="max-h-[64vh] overflow-y-auto pr-1">
          <section className="mb-4" data-testid="open-label-starters">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-(--app-accent)">Start new — blank or ready-made template</h4>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              {STARTERS.map((s) => (
                <button key={s.key} disabled={creating} data-testid={`open-starter-${s.key}`} onClick={() => onCreate(starterToTemplate(s))} title={`Create a new label: ${s.title}`}
                  className="group overflow-hidden rounded-lg border border-dashed border-[#C7CCD3] bg-white text-left transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-(--app-accent) disabled:opacity-50">
                  <div className="grid h-16 place-items-center bg-[#F8F9FB]">
                    {s.key === "blank" ? <span className="grid size-9 place-items-center rounded-full bg-(--app-accent-soft) text-xl text-(--app-accent)">+</span> : (
                      <Scaled widthMm={s.tpl.width_mm} heightMm={s.tpl.height_mm} scale={fit(s.tpl, 90, 52)} className="shadow-[0_1px_3px_rgba(0,0,0,0.2)]"><LabelView template={s.tpl} /></Scaled>
                    )}
                  </div>
                  <p className="truncate px-2 py-1 text-[11px] font-medium text-[#1F2937]">{s.key === "blank" ? "New blank label" : s.title}</p>
                </button>
              ))}
            </div>
          </section>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">Your saved labels</h4>
          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-[#F5C2C0] bg-[#FDECEA] px-3 py-2 text-sm text-[#C5221F]" data-testid="open-label-error">
              <span className="flex-1">Couldn't load your labels: {error}</span>
              <Button size="sm" variant="outline" className="bg-white" onClick={onRetry} data-testid="open-label-retry">Retry</Button>
            </div>
          )}
          {loading && <p className="py-6 text-center text-sm text-[#6B7280]" data-testid="open-label-loading">Loading labels…</p>}
          {!loading && !error && shown.length === 0 && <p className="py-6 text-center text-sm text-[#6B7280]">{q ? "No labels match your search." : "No labels yet — create one with New label."}</p>}
          {!loading && <p className="mb-2 text-[11px] text-[#9CA3AF]" data-testid="open-label-count">{templates.length} label{templates.length === 1 ? "" : "s"} saved</p>}
          <div className="grid grid-cols-3 gap-2 md:grid-cols-5" data-testid="open-label-grid">
            {shown.map((t) => (
              <div key={t.id} data-testid={`template-card-${t.id}`} className={cn("group overflow-hidden rounded-lg border bg-white transition-[border-color,box-shadow] duration-150 hover:border-(--app-accent) hover:shadow-md", t.id === currentId ? "border-(--app-accent) ring-1 ring-(--app-accent)" : "border-[#D9DDE3]")}>
                <button className="relative grid h-20 w-full place-items-center bg-[#F1F3F4]" onClick={() => onOpen(t.id)} data-testid={`open-template-${t.id}`} title={`Open ${t.name}`}>
                  <Scaled widthMm={t.width_mm} heightMm={t.height_mm} scale={fit(t, 120, 64)} className="shadow-[0_1px_4px_rgba(0,0,0,0.2)]">
                    <LabelView template={t} />
                  </Scaled>
                  {t.id === currentId && <span className="absolute left-1.5 top-1.5 rounded bg-(--app-accent) px-1.5 py-0.5 text-[9px] font-semibold text-white">IN USE</span>}
                </button>
                {editing === t.id ? <RenameForm t={t} brands={brands} onRename={onRename} onDone={() => setEditing(null)} /> : (<>
                <div className="px-2.5 pt-1.5">
                  <p className="truncate text-[13px] font-medium text-[#1F2937]" title={`${t.name} — double-click to rename`} data-testid={`template-name-${t.id}`} onDoubleClick={() => setEditing(t.id)}>{t.name}</p>
                  <p className="truncate text-[10px] text-[#6B7280]" title={t.brand} data-testid={`template-brand-${t.id}`}>{t.brand} · {t.width_mm}×{t.height_mm} mm</p>
                </div>
                <div className="flex items-center gap-0.5 px-1.5 pb-1">
                  <Button variant="ghost" size="xs" className="h-6 flex-1 justify-start px-1.5 text-[11px] text-(--app-accent)" data-testid={`edit-template-${t.id}`} onClick={() => onOpen(t.id)}><FolderOpen /> Open</Button>
                  <Button variant="ghost" size="icon-xs" title="Rename / change brand" data-testid={`rename-template-${t.id}`} onClick={() => setEditing(t.id)}><Pencil /></Button>
                  <Button variant="ghost" size="icon-xs" title="Duplicate" data-testid={`duplicate-template-${t.id}`} onClick={() => onDuplicate(t.id)}><Copy /></Button>
                  <Button variant="ghost" size="icon-xs" title="Delete" data-testid={`delete-template-${t.id}`} onClick={() => onDelete(t)}><Trash2 /></Button>
                </div>
                </>)}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
