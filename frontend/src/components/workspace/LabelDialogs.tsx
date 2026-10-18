import { useMemo, useState } from "react";
import { Copy, FolderOpen, Search, Trash2 } from "lucide-react";
import { Label as LabelView, Scaled } from "@/components/label/Label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DEFAULT_PAGE_SETUP, MM_TO_PX } from "@/lib/label";
import { STARTERS } from "@/lib/starters";
import type { Template, TemplateBase } from "@/lib/types";
import { cn } from "@/lib/utils";

const fit = (t: { width_mm: number; height_mm: number }, w: number, h: number) =>
  Math.min(w / (t.width_mm * MM_TO_PX), h / (t.height_mm * MM_TO_PX), 1.5);

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
    onCreate({
      ...starter.tpl,
      width_mm: w,
      height_mm: h,
      elements: starter.tpl.elements.map((e) => ({ ...e, id: crypto.randomUUID() })),
      name: name.trim() || starter.title,
      brand: brand.trim() || "General",
      source_id: null,
      page_setup: DEFAULT_PAGE_SETUP,
      background_image: "",
      background_fit: "cover",
      background_opacity: 1,
    });
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

export function OpenLabelDialog({ open, onOpenChange, templates, onOpen, onDuplicate, onDelete }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templates: Template[];
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (t: Template) => void;
}) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const m = new Map<string, Template[]>();
    templates
      .filter((t) => !q || `${t.name} ${t.brand}`.toLowerCase().includes(q.toLowerCase()))
      .forEach((t) => m.set(t.brand, [...(m.get(t.brand) ?? []), t]));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [templates, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(820px,95vw)] sm:max-w-[min(820px,95vw)]" data-testid="open-label-dialog">
        <DialogHeader><DialogTitle>Open label</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by label or brand" className="pl-8" data-testid="open-label-search" />
        </div>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {groups.length === 0 && <p className="py-6 text-center text-sm text-[#6B7280]">No labels found.</p>}
          {groups.map(([brand, list]) => (
            <div key={brand} className="mb-4">
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-(--app-accent)">{brand}</h4>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {list.map((t) => (
                  <div key={t.id} data-testid={`template-card-${t.id}`} className="group overflow-hidden rounded-lg border border-[#D9DDE3] transition-[border-color] duration-150 hover:border-(--app-accent)">
                    <button className="grid h-24 w-full place-items-center bg-[#F1F3F4]" onClick={() => onOpen(t.id)} data-testid={`open-template-${t.id}`}>
                      <Scaled widthMm={t.width_mm} heightMm={t.height_mm} scale={fit(t, 160, 80)} className="shadow-[0_1px_4px_rgba(0,0,0,0.2)]">
                        <LabelView template={t} />
                      </Scaled>
                    </button>
                    <div className="flex items-center gap-1 px-2.5 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#1F2937]" data-testid={`template-name-${t.id}`}>{t.name}</p>
                        <p className="text-[10px] text-[#6B7280]">{t.width_mm} × {t.height_mm} mm</p>
                      </div>
                      <Button variant="ghost" size="icon-xs" title="Open" data-testid={`edit-template-${t.id}`} onClick={() => onOpen(t.id)}><FolderOpen /></Button>
                      <Button variant="ghost" size="icon-xs" title="Duplicate" data-testid={`duplicate-template-${t.id}`} onClick={() => onDuplicate(t.id)}><Copy /></Button>
                      <Button variant="ghost" size="icon-xs" title="Delete" data-testid={`delete-template-${t.id}`} onClick={() => onDelete(t)}><Trash2 /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
