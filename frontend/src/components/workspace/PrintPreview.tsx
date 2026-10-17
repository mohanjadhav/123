import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Printer, TriangleAlert } from "lucide-react";
import { Label as LabelView, Scaled } from "@/components/label/Label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MM_TO_PX } from "@/lib/label";
import type { Mapping, Row, TemplateBase } from "@/lib/types";

export type LayoutMode = "roll" | "a4" | "letter";
export interface PrintLayout {
  mode: LayoutMode;
  margin: number;
  gap: number;
}
export const LAYOUTS: Record<LayoutMode, { label: string; w?: number; h?: number }> = {
  roll: { label: "Label printer (1 per page)" },
  a4: { label: "A4 sheet (210 × 297 mm)", w: 210, h: 297 },
  letter: { label: "US Letter (8.5 × 11 in)", w: 215.9, h: 279.4 },
};

interface PageSpec {
  w: number;
  h: number;
  cols: number;
  perPage: number;
  roll: boolean;
}

export function pageSpec(t: TemplateBase, layout: PrintLayout): PageSpec {
  const L = LAYOUTS[layout.mode];
  if (!L.w || !L.h) return { w: t.width_mm, h: t.height_mm, cols: 1, perPage: 1, roll: true };
  const { margin, gap } = layout;
  const cols = Math.max(1, Math.floor((L.w - 2 * margin + gap) / (t.width_mm + gap)));
  const rows = Math.max(1, Math.floor((L.h - 2 * margin + gap) / (t.height_mm + gap)));
  return { w: L.w, h: L.h, cols, perPage: cols * rows, roll: false };
}

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function SheetPage({ spec, template, rows, mapping, layout }: { spec: PageSpec; template: TemplateBase; rows: Row[]; mapping: Mapping; layout: PrintLayout }) {
  return (
    <div
      className="print-page bg-white"
      style={{
        width: `${spec.w}mm`,
        height: `${spec.h}mm`,
        padding: spec.roll ? 0 : `${layout.margin}mm`,
        display: "grid",
        gridTemplateColumns: `repeat(${spec.cols}, ${template.width_mm}mm)`,
        gridAutoRows: `${template.height_mm}mm`,
        gap: spec.roll ? 0 : `${layout.gap}mm`,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {rows.map((r, i) => (
        <LabelView key={i} template={template} row={r} mapping={mapping} />
      ))}
    </div>
  );
}

/** Off-screen print output; only visible under @media print. */
export function PrintPortal({ template, rows, mapping, layout }: { template: TemplateBase; rows: Row[]; mapping: Mapping; layout: PrintLayout }) {
  const spec = pageSpec(template, layout);
  return createPortal(
    <div className="print-root" data-testid="print-root">
      <style>{`@page { size: ${spec.w}mm ${spec.h}mm; margin: 0; }`}</style>
      {chunk(rows, spec.perPage).map((pg, i) => (
        <SheetPage key={i} spec={spec} template={template} rows={pg} mapping={mapping} layout={layout} />
      ))}
    </div>,
    document.body,
  );
}

export function PrintPreviewDialog({ open, onOpenChange, template, rows, mapping, missing, layout, onLayout, onPrint }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: TemplateBase;
  rows: Row[];
  mapping: Mapping;
  missing: string[];
  layout: PrintLayout;
  onLayout: (l: PrintLayout) => void;
  onPrint: () => void;
}) {
  const [page, setPage] = useState(0);
  const spec = pageSpec(template, layout);
  const pages = chunk(rows, spec.perPage);
  const current = Math.min(page, Math.max(0, pages.length - 1));
  const scale = Math.min(1.6, 560 / (spec.w * MM_TO_PX), 520 / (spec.h * MM_TO_PX));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1100px,95vw)] gap-0 overflow-hidden p-0 sm:max-w-[min(1100px,95vw)]" data-testid="print-modal-container">
        <DialogHeader className="border-b border-[#E5E7EB] px-5 py-3">
          <DialogTitle className="text-base">Print preview — {template.name}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="grid min-w-0 content-start gap-4 border-r border-[#E5E7EB] bg-[#F8F9FB] p-5">
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-[#4B5563]">Paper</span>
              <Select value={layout.mode} onValueChange={(v: string) => { onLayout({ ...layout, mode: v as LayoutMode }); setPage(0); }}>
                <SelectTrigger className="w-full bg-white" data-testid="print-sheet-layout-select"><SelectValue>{(v) => LAYOUTS[v as LayoutMode].label}</SelectValue></SelectTrigger>
                <SelectContent>{(Object.keys(LAYOUTS) as LayoutMode[]).map((k) => <SelectItem key={k} value={k}>{LAYOUTS[k].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {layout.mode !== "roll" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs text-[#4B5563]">Page margin (mm)
                  <Input type="number" className="h-8 bg-white" data-testid="print-margin-input" value={layout.margin} onChange={(e) => onLayout({ ...layout, margin: Math.max(0, parseFloat(e.target.value) || 0) })} />
                </label>
                <label className="grid gap-1 text-xs text-[#4B5563]">Gap (mm)
                  <Input type="number" className="h-8 bg-white" data-testid="print-gap-input" value={layout.gap} onChange={(e) => onLayout({ ...layout, gap: Math.max(0, parseFloat(e.target.value) || 0) })} />
                </label>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-y-1.5 rounded-lg border border-[#E5E7EB] bg-white p-3 text-xs" data-testid="print-summary">
              <dt className="text-[#6B7280]">Labels</dt><dd className="text-right font-semibold" data-testid="print-summary-labels">{rows.length}</dd>
              <dt className="text-[#6B7280]">Per page</dt><dd className="text-right font-semibold">{spec.perPage}</dd>
              <dt className="text-[#6B7280]">Pages</dt><dd className="text-right font-semibold" data-testid="print-summary-pages">{pages.length}</dd>
              <dt className="text-[#6B7280]">Label size</dt><dd className="text-right">{template.width_mm} × {template.height_mm} mm</dd>
            </dl>
            {missing.length > 0 && (
              <p className="flex gap-2 rounded-lg border border-[#FBD38D] bg-[#FFF8E6] p-2.5 text-[11px] text-[#8A5A00]" data-testid="print-missing-fields">
                <TriangleAlert className="size-4 shrink-0" />
                Not found in sheet (prints blank): {missing.map((m) => `{{${m}}}`).join(", ")}
              </p>
            )}
            <Button data-testid="print-trigger-button" disabled={!rows.length} onClick={onPrint} className="h-10 bg-[#1A73E8] text-white hover:bg-[#1765CC]">
              <Printer /> Print {rows.length} label{rows.length === 1 ? "" : "s"}
            </Button>
            <p className="text-[11px] leading-relaxed text-[#6B7280]">In the print window set margins to “None” and scale to 100% for exact sizes.</p>
          </div>
          <div className="flex min-h-[560px] flex-col bg-[#E8EAED]">
            <div className="grid flex-1 place-items-center overflow-auto p-6" data-testid="print-preview-container">
              {pages.length === 0 ? (
                <p className="text-sm text-[#6B7280]">No rows selected — tick rows in the print data grid.</p>
              ) : (
                <Scaled widthMm={spec.w} heightMm={spec.h} scale={scale} className="shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
                  <SheetPage spec={spec} template={template} rows={pages[current]} mapping={mapping} layout={layout} />
                </Scaled>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 border-t border-[#D9DDE3] bg-white py-2 text-sm">
              <Button variant="ghost" size="icon-sm" data-testid="preview-page-prev" disabled={current <= 0} onClick={() => setPage(current - 1)}><ChevronLeft /></Button>
              <span className="min-w-28 text-center font-mono text-xs" data-testid="preview-page-indicator">Page {pages.length ? current + 1 : 0} / {pages.length}</span>
              <Button variant="ghost" size="icon-sm" data-testid="preview-page-next" disabled={current >= pages.length - 1} onClick={() => setPage(current + 1)}><ChevronRight /></Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
