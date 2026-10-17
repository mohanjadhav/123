import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Copy, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Label as LabelView, Scaled } from "@/components/label/Label";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiDelete, apiPost } from "@/lib/api";
import { fetchTemplates, MM_TO_PX, SIZE_PRESETS } from "@/lib/label";
import type { Template, TemplateBase } from "@/lib/types";
import { cn } from "@/lib/utils";

function previewScale(t: Template) {
  const maxW = 240, maxH = 170;
  return Math.min(maxW / (t.width_mm * MM_TO_PX), maxH / (t.height_mm * MM_TO_PX), 1.4);
}

export default function Templates() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: templates = [], isLoading, isError } = useQuery({ queryKey: ["templates"], queryFn: fetchTemplates });
  const [brand, setBrand] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", brand: "", preset: "0", w: "76.2", h: "50.8" });

  const brands = useMemo(() => [...new Set(templates.map((t) => t.brand))].sort(), [templates]);
  const shown = isError ? [] : templates.filter((t) => brand === "all" || t.brand === brand);

  const create = useMutation({
    mutationFn: (body: TemplateBase) => apiPost<Template>("/templates", body),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setOpen(false);
      nav(`/editor/${t.id}`);
    },
    onError: () => toast.error("Could not create template"),
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => apiPost<Template>(`/templates/${id}/duplicate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template duplicated");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template deleted");
    },
  });

  const submit = () => {
    const w = parseFloat(form.w), h = parseFloat(form.h);
    if (!form.name.trim() || !(w > 0) || !(h > 0)) return toast.error("Name and a valid size are required");
    create.mutate({ name: form.name.trim(), brand: form.brand.trim() || "General", width_mm: w, height_mm: h, background: "#FDFDFC", elements: [] });
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-neutral-200">
      <AppHeader>
        <Button data-testid="new-template-button" onClick={() => setOpen(true)} className="bg-[#FF5B26] text-[#0F1115] hover:bg-[#FF7143]">
          <Plus /> New template
        </Button>
      </AppHeader>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-[#FF5B26]">TEMPLATE LIBRARY</p>
            <h1 className="mt-2 font-heading text-3xl font-semibold text-white md:text-4xl">Label masters by brand</h1>
            <p className="mt-2 max-w-xl text-sm text-neutral-400">
              Design one template per brand or product line, then feed it rows from any public Google Sheet in the Print Studio.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" data-testid="brand-filter">
            {["all", ...brands].map((b) => (
              <button
                key={b}
                data-testid={`brand-filter-${b.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => setBrand(b)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors duration-150",
                  brand === b ? "border-[#FF5B26] bg-[#FF5B26]/15 text-[#FF7143]" : "border-[#2A303C] text-neutral-400 hover:border-[#3F4858] hover:text-white",
                )}
              >
                {b === "all" ? "All brands" : b}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <p className="text-sm text-neutral-500">Loading templates…</p>}
        {isError && <p className="text-sm text-neutral-500" data-testid="templates-error">Templates are unavailable right now.</p>}
        {!isLoading && !isError && shown.length === 0 && (
          <p className="text-sm text-neutral-500" data-testid="templates-empty">No templates yet — create your first one.</p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="templates-grid">
          {shown.map((t, i) => (
            <motion.article
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              data-testid={`template-card-${t.id}`}
              className="group overflow-hidden rounded-xl border border-[#2A303C] bg-[#16191F] transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[#3F4858]"
            >
              <Link to={`/editor/${t.id}`} className="grid h-52 place-items-center bg-[radial-gradient(circle_at_30%_20%,#232831,#12151A)]">
                <Scaled widthMm={t.width_mm} heightMm={t.height_mm} scale={previewScale(t)} className="shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]">
                  <LabelView template={t} />
                </Scaled>
              </Link>
              <div className="flex items-start justify-between gap-3 border-t border-[#2A303C] p-4">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FF7143]" data-testid={`template-brand-${t.id}`}>{t.brand}</p>
                  <h3 className="truncate font-heading font-medium text-white" data-testid={`template-name-${t.id}`}>{t.name}</h3>
                  <p className="font-mono text-xs text-neutral-500">{t.width_mm} × {t.height_mm} mm · {t.elements.length} elements</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Link to={`/editor/${t.id}`} data-testid={`edit-template-${t.id}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} title="Edit">
                    <Pencil />
                  </Link>
                  <Link to={`/print?template=${t.id}`} data-testid={`print-template-${t.id}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} title="Print">
                    <Printer />
                  </Link>
                  <Button variant="ghost" size="icon-sm" title="Duplicate" data-testid={`duplicate-template-${t.id}`} onClick={() => duplicate.mutate(t.id)}>
                    <Copy />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Delete"
                    data-testid={`delete-template-${t.id}`}
                    onClick={() => confirm(`Delete "${t.name}"?`) && remove.mutate(t.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="new-template-dialog">
          <DialogHeader>
            <DialogTitle>New label template</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-name">Template name</Label>
              <Input id="tpl-name" data-testid="new-template-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Retail price tag" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-brand">Brand</Label>
              <Input id="tpl-brand" data-testid="new-template-brand-input" list="brand-options" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="e.g. AURA Studio" />
              <datalist id="brand-options">{brands.map((b) => <option key={b} value={b} />)}</datalist>
            </div>
            <div className="grid gap-1.5">
              <Label>Size preset</Label>
              <Select
                value={form.preset}
                onValueChange={(v: string) => {
                  const p = SIZE_PRESETS[Number(v)];
                  setForm({ ...form, preset: v, ...(p ? { w: String(p.w), h: String(p.h) } : {}) });
                }}
              >
                <SelectTrigger data-testid="new-template-preset-select" className="w-full">
                  <SelectValue>{(v) => (v === "custom" ? "Custom size" : SIZE_PRESETS[Number(v)]?.label)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SIZE_PRESETS.map((p, i) => (
                    <SelectItem key={p.label} value={String(i)}>{p.label}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom size</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tpl-w">Width (mm)</Label>
                <Input id="tpl-w" type="number" data-testid="new-template-width-input" value={form.w} onChange={(e) => setForm({ ...form, w: e.target.value, preset: "custom" })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tpl-h">Height (mm)</Label>
                <Input id="tpl-h" type="number" data-testid="new-template-height-input" value={form.h} onChange={(e) => setForm({ ...form, h: e.target.value, preset: "custom" })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="new-template-submit-button" onClick={submit} disabled={create.isPending} className="bg-[#FF5B26] text-[#0F1115] hover:bg-[#FF7143]">
              Create & open editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
