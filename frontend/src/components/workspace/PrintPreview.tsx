import { createPortal } from "react-dom";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Settings2, TriangleAlert } from "lucide-react";
import { Label as LabelView, Scaled } from "@/components/label/Label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MM_TO_PX } from "@/lib/label";
import type { LabelShape, Mapping, PageSetup, Row } from "@/lib/types";

export const PAPER_LABEL: Record<PageSetup["paper"], string> = {
  label: "Label printer / roll",
  a4: "A4 sheet",
  letter: "US Letter sheet",
  custom: "Custom paper",
};

export interface PageSpec {
  w: number;
  h: number;
  cols: number;
  rows: number;
  perPage: number;
  overflow: boolean;
}

/** Page size and label grid derived from the page setup. */
export function pageSpec(t: Pick<LabelShape, "width_mm" | "height_mm">, ps: PageSetup): PageSpec {
  const { margin_left: ml, margin_right: mr, margin_top: mt, margin_bottom: mb, gap_x: gx, gap_y: gy } = ps;
  if (ps.paper === "label") {
    const cols = Math.max(1, ps.cols || 1);
    return { w: ml + cols * t.width_mm + (cols - 1) * gx + mr, h: mt + t.height_mm + mb, cols, rows: 1, perPage: cols, overflow: false };
  }
  let W = ps.paper === "a4" ? 210 : ps.paper === "letter" ? 215.9 : ps.paper_w;
  let H = ps.paper === "a4" ? 297 : ps.paper === "letter" ? 279.4 : ps.paper_h;
  if (ps.orientation === "landscape") [W, H] = [H, W];
  const cols = ps.cols || Math.max(1, Math.floor((W - ml - mr + gx) / (t.width_mm + gx)));
  const rows = ps.rows || Math.max(1, Math.floor((H - mt - mb + gy) / (t.height_mm + gy)));
  const overflow = ml + cols * t.width_mm + (cols - 1) * gx > W + 0.01 || mt + rows * t.height_mm + (rows - 1) * gy > H + 0.01;
  return { w: W, h: H, cols, rows, perPage: cols * rows, overflow };
}

/** Split labels into pages; leading empty slots honour the start position on the first page. */
export function paginate(rows: Row[], spec: PageSpec, ps: PageSetup): (Row | null)[][] {
  const skip = Math.min(Math.max(0, ps.start_position - 1), spec.perPage - 1);
  const slots: (Row | null)[] = [...Array<null>(skip).fill(null), ...rows];
  const pages: (Row | null)[][] = [];
  for (let i = 0; i < slots.length; i += spec.perPage) pages.push(slots.slice(i, i + spec.perPage));
  return rows.length ? pages : [];
}

export function SheetPage({ spec, ps, template, slots, mapping, outlineEmpty, pageName }: {
  pageName?: string; // CSS named page, so mixed label sizes print in one batch
  spec: PageSpec;
  ps: PageSetup;
  template: LabelShape;
  slots: (Row | null)[];
  mapping: Mapping;
  outlineEmpty?: boolean;
}) {
  const cells = outlineEmpty ? [...slots, ...Array<null>(Math.max(0, spec.perPage - slots.length)).fill(null)] : slots;
  return (
    <div className="print-page relative overflow-hidden bg-white" style={{ width: `${spec.w}mm`, height: `${spec.h}mm`, page: pageName }}>
      <div
        className="absolute"
        style={{
          left: `${ps.margin_left + ps.offset_x}mm`,
          top: `${ps.margin_top + ps.offset_y}mm`,
          display: "grid",
          gridTemplateColumns: `repeat(${spec.cols}, ${template.width_mm}mm)`,
          gridTemplateRows: `repeat(${spec.rows}, ${template.height_mm}mm)`,
          gridAutoFlow: ps.order === "down" ? "column" : "row",
          columnGap: `${ps.gap_x}mm`,
          rowGap: `${ps.gap_y}mm`,
        }}
      >
        {cells.map((r, i) =>
          r ? (
            <LabelView key={i} template={template} row={r} mapping={mapping} dpi={ps.dpi ?? 0} />
          ) : (
            <div key={i} className={outlineEmpty ? "border border-dashed border-[#C7CCD3]" : undefined} />
          ),
        )}
      </div>
    </div>
  );
}

/** Off-screen print output; the only thing visible under @media print. */
export function PrintPortal({ template, ps, rows, mapping }: { template: LabelShape; ps: PageSetup; rows: Row[]; mapping: Mapping }) {
  const spec = pageSpec(template, ps);
  return createPortal(
    <div className="print-root" data-testid="print-root">
      <style>{`@page { size: ${spec.w}mm ${spec.h}mm; margin: 0; } @media print { html, body { width: ${spec.w}mm; } }`}</style>
      {paginate(rows, spec, ps).map((pg, i) => (
        <SheetPage key={i} spec={spec} ps={ps} template={template} slots={pg} mapping={mapping} />
      ))}
    </div>,
    document.body,
  );
}

export function BrowserPrintTips({ spec, ps }: { spec: PageSpec; ps: PageSetup }) {
  const paper = ps.paper === "a4" ? "A4" : ps.paper === "letter" ? "Letter" : `${+spec.w.toFixed(1)} × ${+spec.h.toFixed(1)} mm`;
  return (
    <div className="rounded-lg border border-(--app-accent-ring) bg-(--app-accent-soft) p-3 text-[11px] leading-relaxed text-[#1F2937]" data-testid="browser-print-tips">
      <p className="mb-1 font-semibold text-(--app-accent)">In the browser print window (More settings):</p>
      <ul className="list-disc pl-4">
        <li>Paper size: <b>{paper}</b>{ps.paper === "label" && " (or set this label size in your printer driver)"}</li>
        <li>Margins: <b>None</b> · Scale: <b>Default / 100%</b></li>
        <li>Headers and footers: <b>Off</b> · Background graphics: <b>On</b></li>
      </ul>
    </div>
  );
}

export function PrintPreviewDialog({ open, onOpenChange, template, ps, rows, mapping, missing, onPrint, onPageSetup }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: LabelShape & { name: string };
  ps: PageSetup;
  rows: Row[];
  mapping: Mapping;
  missing: string[];
  onPrint: () => void;
  onPageSetup: () => void;
}) {
  const [page, setPage] = useState(0);
  const spec = pageSpec(template, ps);
  const pages = paginate(rows, spec, ps);
  const current = Math.min(page, Math.max(0, pages.length - 1));
  const scale = Math.min(2, 560 / (spec.w * MM_TO_PX), 520 / (spec.h * MM_TO_PX));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1100px,95vw)] gap-0 overflow-hidden p-0 sm:max-w-[min(1100px,95vw)]" data-testid="print-modal-container">
        <DialogHeader className="border-b border-[#E5E7EB] px-5 py-3">
          <DialogTitle className="text-base">Print preview — {template.name}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="grid min-w-0 content-start gap-4 border-r border-[#E5E7EB] bg-[#F8F9FB] p-5">
            <dl className="grid grid-cols-2 gap-y-1.5 rounded-lg border border-[#E5E7EB] bg-white p-3 text-xs" data-testid="print-summary">
              <dt className="text-[#6B7280]">Paper</dt><dd className="text-right font-semibold" data-testid="print-summary-paper">{PAPER_LABEL[ps.paper]}</dd>
              <dt className="text-[#6B7280]">Page size</dt><dd className="text-right">{+spec.w.toFixed(1)} × {+spec.h.toFixed(1)} mm</dd>
              <dt className="text-[#6B7280]">Layout</dt><dd className="text-right">{spec.cols} across × {spec.rows} down</dd>
              <dt className="text-[#6B7280]">Labels</dt><dd className="text-right font-semibold" data-testid="print-summary-labels">{rows.length}</dd>
              <dt className="text-[#6B7280]">Pages</dt><dd className="text-right font-semibold" data-testid="print-summary-pages">{pages.length}</dd>
            </dl>
            <Button variant="outline" className="bg-white" data-testid="preview-page-setup-button" onClick={onPageSetup}><Settings2 /> Page setup…</Button>
            {spec.overflow && (
              <p className="flex gap-2 rounded-lg border border-[#F5C2C0] bg-[#FDECEA] p-2.5 text-[11px] text-[#A50E0E]" data-testid="print-overflow-warning">
                <TriangleAlert className="size-4 shrink-0" /> Labels don't fit on the paper — reduce labels across/down, gaps or margins in Page setup.
              </p>
            )}
            {missing.length > 0 && (
              <p className="flex gap-2 rounded-lg border border-[#FBD38D] bg-[#FFF8E6] p-2.5 text-[11px] text-[#8A5A00]" data-testid="print-missing-fields">
                <TriangleAlert className="size-4 shrink-0" />
                Not found in sheet (prints blank): {missing.map((m) => `{{${m}}}`).join(", ")}
              </p>
            )}
            <Button data-testid="print-trigger-button" disabled={!rows.length} onClick={onPrint} className="h-10 bg-(--app-accent) text-white hover:bg-(--app-accent-hover)">
              <Printer /> Print {rows.length} label{rows.length === 1 ? "" : "s"}
            </Button>
            <BrowserPrintTips spec={spec} ps={ps} />
          </div>
          <div className="flex min-h-[560px] flex-col bg-[#E8EAED]">
            <div className="grid flex-1 place-items-center overflow-auto p-6" data-testid="print-preview-container">
              {pages.length === 0 ? (
                <p className="text-sm text-[#6B7280]">No rows ticked — tick rows in the print data grid.</p>
              ) : (
                <Scaled widthMm={spec.w} heightMm={spec.h} scale={scale} className="shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
                  <SheetPage spec={spec} ps={ps} template={template} slots={pages[current]} mapping={mapping} outlineEmpty />
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

export interface BatchPart {
  key: string;
  template: LabelShape & { id: string };
  ps: PageSetup;
  rows: Row[];
  mapping: Mapping;
}

/** Pages for several jobs (each with its own label + page setup), in order. */
export function batchPages(parts: BatchPart[]) {
  return parts.flatMap((p) => {
    const spec = pageSpec(p.template, p.ps);
    return paginate(p.rows, spec, p.ps).map((slots, i) => ({ part: p, spec, slots, key: `${p.key}-${i}` }));
  });
}

/** Print output for a batch: one named @page per label so every label keeps its own paper size. */
export function BatchPrintPortal({ parts }: { parts: BatchPart[] }) {
  const pages = batchPages(parts);
  const sizes = new Map(pages.map((pg) => [`lbl-${pg.part.template.id}`, pg.spec]));
  const first = pages[0]?.spec;
  const css = [
    first ? `@page { size: ${first.w}mm ${first.h}mm; margin: 0; }` : "",
    ...[...sizes].map(([name, sp]) => `@page ${name} { size: ${sp.w}mm ${sp.h}mm; margin: 0; }`),
  ].join("\n");
  return createPortal(
    <div className="print-root" data-testid="print-root">
      <style>{css}</style>
      {pages.map((pg) => (
        <SheetPage key={pg.key} spec={pg.spec} ps={pg.part.ps} template={pg.part.template} slots={pg.slots} mapping={pg.part.mapping} pageName={`lbl-${pg.part.template.id}`} />
      ))}
    </div>,
    document.body,
  );
}
