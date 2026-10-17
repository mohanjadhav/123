import { useState } from "react";
import type { ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Scaled } from "@/components/label/Label";
import { BrowserPrintTips, pageSpec, PAPER_LABEL } from "@/components/workspace/PrintPreview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_PAGE_SETUP, MM_TO_PX } from "@/lib/label";
import type { LabelShape, PageSetup } from "@/lib/types";
import { cn } from "@/lib/utils";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-[11px] text-[#4B5563]">{label}{children}</label>;
}

function Num({ value, onChange, testId, step = 0.5, min = 0, placeholder }: { value: number; onChange: (v: number) => void; testId: string; step?: number; min?: number; placeholder?: string }) {
  return (
    <Input type="number" step={step} min={min} data-testid={testId} placeholder={placeholder} className="h-8 bg-white font-mono text-xs"
      value={placeholder && value === 0 ? "" : value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
  );
}

function Segment<T extends string>({ value, options, onChange, testId }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; testId: string }) {
  return (
    <div className="flex rounded-md border border-[#D1D5DB] bg-white p-0.5" data-testid={testId}>
      {options.map((o) => (
        <button key={o.v} type="button" data-testid={`${testId}-${o.v}`} onClick={() => onChange(o.v)}
          className={cn("flex-1 rounded px-2 py-1 text-xs transition-colors duration-150", value === o.v ? "bg-(--app-accent) text-white" : "text-[#374151] hover:bg-[#F3F4F6]")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Numbered slot diagram of one page. */
function PageDiagram({ template, ps }: { template: LabelShape; ps: PageSetup }) {
  const spec = pageSpec(template, ps);
  const scale = Math.min(1.6, 380 / (spec.w * MM_TO_PX), 440 / (spec.h * MM_TO_PX));
  const skip = Math.min(ps.start_position - 1, spec.perPage - 1);
  return (
    <Scaled widthMm={spec.w} heightMm={spec.h} scale={scale} className="shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
      <div className="relative overflow-hidden bg-white" style={{ width: `${spec.w}mm`, height: `${spec.h}mm` }} data-testid="page-setup-diagram">
        <div className="absolute border border-dashed border-[#F5A97F]" style={{ left: `${ps.margin_left}mm`, top: `${ps.margin_top}mm`, right: `${ps.margin_right}mm`, bottom: `${ps.margin_bottom}mm` }} />
        <div className="absolute" style={{
          left: `${ps.margin_left + ps.offset_x}mm`, top: `${ps.margin_top + ps.offset_y}mm`, display: "grid",
          gridTemplateColumns: `repeat(${spec.cols}, ${template.width_mm}mm)`, gridTemplateRows: `repeat(${spec.rows}, ${template.height_mm}mm)`,
          gridAutoFlow: ps.order === "down" ? "column" : "row", columnGap: `${ps.gap_x}mm`, rowGap: `${ps.gap_y}mm`,
        }}>
          {Array.from({ length: spec.perPage }, (_, i) => (
            <div key={i} className={cn("grid place-items-center rounded-[1mm] border text-[4mm] font-semibold",
              i < skip ? "border-[#D1D5DB] bg-[#F3F4F6] text-[#9CA3AF]" : i === skip ? "border-(--app-accent) bg-(--app-accent-soft) text-(--app-accent)" : "border-(--app-accent-ring) bg-white text-[#6B7280]")}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    </Scaled>
  );
}

function Inner({ template, initial, onSave, onClose }: { template: LabelShape; initial: PageSetup; onSave: (ps: PageSetup) => void; onClose: () => void }) {
  const [ps, setPs] = useState<PageSetup>(initial);
  const set = (patch: Partial<PageSetup>) => setPs((p) => ({ ...p, ...patch }));
  const spec = pageSpec(template, ps);
  const sheet = ps.paper !== "label";

  const setPaper = (paper: PageSetup["paper"]) => {
    const noSpacing = !ps.margin_top && !ps.margin_left && !ps.gap_x && !ps.gap_y;
    if (paper !== "label" && ps.paper === "label" && noSpacing) set({ paper, margin_top: 8, margin_right: 8, margin_bottom: 8, margin_left: 8, gap_x: 3, gap_y: 3, cols: 0, rows: 0 });
    else if (paper === "label") set({ paper, cols: ps.paper === "label" ? ps.cols : 1, rows: 0, margin_top: 0, margin_right: 0, margin_bottom: 0, margin_left: 0, gap_y: 0, start_position: 1 });
    else set({ paper });
  };

  return (
    <>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid content-start gap-4">
          <section className="grid gap-3">
            <h4 className="text-xs font-semibold text-[#1F2937]">Paper</h4>
            <Field label="Paper type">
              <Select value={ps.paper} onValueChange={(v: string) => setPaper(v as PageSetup["paper"])}>
                <SelectTrigger className="h-8 w-full bg-white" data-testid="page-setup-paper-select"><SelectValue>{(v) => PAPER_LABEL[v as PageSetup["paper"]]}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="label">Label printer / roll — page = label row</SelectItem>
                  <SelectItem value="a4">A4 sheet (210 × 297 mm)</SelectItem>
                  <SelectItem value="letter">US Letter (8.5 × 11 in)</SelectItem>
                  <SelectItem value="custom">Custom paper size</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {ps.paper === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Paper width (mm)"><Num testId="page-setup-paper-w" value={ps.paper_w} onChange={(v) => set({ paper_w: Math.max(10, v) })} /></Field>
                <Field label="Paper height (mm)"><Num testId="page-setup-paper-h" value={ps.paper_h} onChange={(v) => set({ paper_h: Math.max(10, v) })} /></Field>
              </div>
            )}
            {sheet && (
              <Field label="Orientation">
                <Segment testId="page-setup-orientation" value={ps.orientation} onChange={(v) => set({ orientation: v })}
                  options={[{ v: "portrait", label: "Portrait" }, { v: "landscape", label: "Landscape" }]} />
              </Field>
            )}
          </section>

          <section className="grid gap-3">
            <h4 className="text-xs font-semibold text-[#1F2937]">Labels on the page</h4>
            <div className="grid grid-cols-2 gap-2">
              <Field label={sheet ? "Labels across (0 = auto)" : "Labels across the roll"}>
                <Num testId="page-setup-cols" step={1} min={sheet ? 0 : 1} value={ps.cols} placeholder={sheet ? `Auto (${spec.cols})` : undefined}
                  onChange={(v) => set({ cols: Math.max(0, Math.round(v)) })} />
              </Field>
              {sheet && (
                <Field label="Labels down (0 = auto)">
                  <Num testId="page-setup-rows" step={1} value={ps.rows} placeholder={`Auto (${spec.rows})`} onChange={(v) => set({ rows: Math.max(0, Math.round(v)) })} />
                </Field>
              )}
              <Field label="Gap between columns (mm)"><Num testId="page-setup-gap-x" value={ps.gap_x} onChange={(v) => set({ gap_x: Math.max(0, v) })} /></Field>
              {sheet && <Field label="Gap between rows (mm)"><Num testId="page-setup-gap-y" value={ps.gap_y} onChange={(v) => set({ gap_y: Math.max(0, v) })} /></Field>}
            </div>
            {sheet && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Print order">
                  <Segment testId="page-setup-order" value={ps.order} onChange={(v) => set({ order: v })}
                    options={[{ v: "across", label: "Across → down" }, { v: "down", label: "Down → across" }]} />
                </Field>
                <Field label={`Start at label position (1–${spec.perPage})`}>
                  <Num testId="page-setup-start" step={1} min={1} value={ps.start_position} onChange={(v) => set({ start_position: Math.max(1, Math.min(spec.perPage, Math.round(v) || 1)) })} />
                </Field>
              </div>
            )}
          </section>

          <section className="grid gap-3">
            <h4 className="text-xs font-semibold text-[#1F2937]">Margins (mm)</h4>
            <div className="grid grid-cols-4 gap-2">
              <Field label="Top"><Num testId="page-setup-margin-top" value={ps.margin_top} onChange={(v) => set({ margin_top: Math.max(0, v) })} /></Field>
              <Field label="Left"><Num testId="page-setup-margin-left" value={ps.margin_left} onChange={(v) => set({ margin_left: Math.max(0, v) })} /></Field>
              <Field label="Right"><Num testId="page-setup-margin-right" value={ps.margin_right} onChange={(v) => set({ margin_right: Math.max(0, v) })} /></Field>
              <Field label="Bottom"><Num testId="page-setup-margin-bottom" value={ps.margin_bottom} onChange={(v) => set({ margin_bottom: Math.max(0, v) })} /></Field>
            </div>
          </section>

          <section className="grid gap-3">
            <h4 className="text-xs font-semibold text-[#1F2937]">Printer adjustment</h4>
            <p className="-mt-2 text-[11px] text-[#6B7280]">If prints come out shifted, move everything by a few mm (negative = left / up).</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Shift right (mm)"><Num testId="page-setup-offset-x" min={-50} step={0.25} value={ps.offset_x} onChange={(v) => set({ offset_x: Math.max(-50, Math.min(50, v)) })} /></Field>
              <Field label="Shift down (mm)"><Num testId="page-setup-offset-y" min={-50} step={0.25} value={ps.offset_y} onChange={(v) => set({ offset_y: Math.max(-50, Math.min(50, v)) })} /></Field>
            </div>
          </section>
        </div>

        <div className="grid content-start justify-items-center gap-3 rounded-lg bg-[#E8EAED] p-4">
          <PageDiagram template={template} ps={ps} />
          <p className="text-center text-xs text-[#374151]" data-testid="page-setup-summary">
            <b>{spec.cols} × {spec.rows} = {spec.perPage}</b> label{spec.perPage === 1 ? "" : "s"} per page · page {+spec.w.toFixed(1)} × {+spec.h.toFixed(1)} mm · label {template.width_mm} × {template.height_mm} mm
          </p>
          {spec.overflow && (
            <p className="flex gap-2 rounded border border-[#F5C2C0] bg-[#FDECEA] p-2 text-[11px] text-[#A50E0E]" data-testid="page-setup-overflow">
              <TriangleAlert className="size-4 shrink-0" /> Labels run off the paper — reduce labels across/down, gaps or margins.
            </p>
          )}
          <BrowserPrintTips spec={spec} ps={ps} />
        </div>
      </div>
      <DialogFooter className="mt-2">
        <Button variant="ghost" data-testid="page-setup-reset" onClick={() => setPs(DEFAULT_PAGE_SETUP)}><RotateCcw /> Reset</Button>
        <Button variant="outline" data-testid="page-setup-cancel" onClick={onClose}>Cancel</Button>
        <Button data-testid="page-setup-save" onClick={() => onSave(ps)} className="bg-(--app-accent) text-white hover:bg-(--app-accent-hover)">Save page setup</Button>
      </DialogFooter>
    </>
  );
}

export function PageSetupDialog({ open, onOpenChange, template, value, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: LabelShape;
  value: PageSetup;
  onSave: (ps: PageSetup) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(980px,96vw)] overflow-y-auto sm:max-w-[min(980px,96vw)]" data-testid="page-setup-dialog">
        <DialogHeader><DialogTitle>Page setup</DialogTitle></DialogHeader>
        {open && <Inner template={template} initial={value} onSave={onSave} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
