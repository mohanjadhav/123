import { Fragment, useMemo, useState } from "react";
import { useRecordPrint } from "@/lib/history";
import { findQueueDuplicates, useDuplicateGuard } from "@/components/workspace/DuplicateGuard";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Barcode, ChevronDown, ChevronLeft, ChevronRight, Eye, ListOrdered, Printer, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { ThemePicker } from "@/components/ThemePicker";
import { Scaled } from "@/components/label/Label";
import { batchPages, BatchPrintPortal, SheetPage } from "@/components/workspace/PrintPreview";
import type { BatchPart } from "@/components/workspace/PrintPreview";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { autoMapping, fetchTemplates, MM_TO_PX, placeholdersOf } from "@/lib/label";
import { fetchQueue } from "@/lib/queue";
import type { QueueItem, QueueJob, QueueJobUpdate, Template } from "@/lib/types";
import { cn } from "@/lib/utils";

const jobLabels = (j: QueueJob) => j.items.reduce((n, i) => n + (i.selected ? i.qty : 0), 0);

function toPart(job: QueueJob, tpl: Template): BatchPart {
  const items = job.items.filter((i) => i.selected);
  const columns = [...new Set(items.flatMap((i) => Object.keys(i.cells)))];
  return {
    key: job.id,
    template: tpl,
    ps: tpl.page_setup,
    rows: items.flatMap((i) => Array.from({ length: i.qty }, () => i.cells)),
    mapping: autoMapping(placeholdersOf(tpl), columns),
  };
}

export default function PrintQueue() {
  const qc = useQueryClient();
  const queueQ = useQuery({ queryKey: ["queue"], queryFn: fetchQueue });
  const templatesQ = useQuery({ queryKey: ["templates"], queryFn: fetchTemplates });
  const jobs = useMemo(() => (queueQ.isError ? [] : (queueQ.data ?? [])), [queueQ.data, queueQ.isError]);
  const templates = templatesQ.data ?? [];
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [printing, setPrinting] = useState<BatchPart[] | null>(null);

  const tplOf = (j: QueueJob) => templates.find((t) => t.id === j.template_id);
  const printable = jobs.filter((j) => j.selected && tplOf(j) && jobLabels(j) > 0);
  const parts = printable.map((j) => toPart(j, tplOf(j)!));
  const totalLabels = printable.reduce((n, j) => n + jobLabels(j), 0);
  const pages = batchPages(parts);
  const allOn = jobs.length > 0 && jobs.every((j) => j.selected);

  // Optimistic local update + PATCH.
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: QueueJobUpdate }) => apiPatch<QueueJob>(`/queue/${id}`, body),
    onMutate: ({ id, body }) => qc.setQueryData<QueueJob[]>(["queue"], (list) => list?.map((j) => (j.id === id ? { ...j, ...body } : j))),
    onError: () => { toast.error("Could not update the queue"); qc.invalidateQueries({ queryKey: ["queue"] }); },
  });
  const remove = useMutation({
    mutationFn: (ids: string[]) => (ids.length === 1 ? apiDelete<void>(`/queue/${ids[0]}`) : apiPost<void>("/queue/remove", ids)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });

  const setItems = (j: QueueJob, items: QueueItem[]) => patch.mutate({ id: j.id, body: { items } });
  const toggleAll = () => jobs.forEach((j) => j.selected === allOn && patch.mutate({ id: j.id, body: { selected: !allOn } }));

  const recordPrint = useRecordPrint();
  const dupGuard = useDuplicateGuard();
  const runPrint = () => {
    if (!parts.length) return toast.error("Tick at least one job with labels to print");
    const dups = findQueueDuplicates(printable.map((j) => {
      const tpl = tplOf(j)!;
      return { label: `${j.source_name || "No sheet"} (${j.template_name})`, elements: tpl.elements, mapping: parts.find((p) => p.key === j.id)!.mapping, items: j.items };
    }));
    dupGuard.guard(dups, printNow);
  };
  const printNow = () => {
    flushSync(() => setPrinting(parts));
    window.print();
    setPrinting(null);
    recordPrint("queue", printable.map((j) => ({ template_id: j.template_id, template_name: j.template_name, source_id: j.source_id ?? null, source_name: j.source_name, labels: jobLabels(j) })));
    const ids = printable.map((j) => j.id);
    if (confirm(`Printed ${totalLabels} labels. Remove the ${ids.length} printed job${ids.length === 1 ? "" : "s"} from the queue?`)) {
      remove.mutate(ids);
      setPreviewOpen(false);
    }
  };

  const current = Math.min(page, Math.max(0, pages.length - 1));
  const pg = pages[current];
  const scale = pg ? Math.min(2, 560 / (pg.spec.w * MM_TO_PX), 520 / (pg.spec.h * MM_TO_PX)) : 1;

  return (
    <div className="app-screen flex flex-col bg-[#EEF0F3] text-[#1F2937]">
      <header className="no-scrollbar flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-[#D9DDE3] bg-white px-3 [&>*]:shrink-0" data-testid="queue-header">
        <Link to="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-(--app-accent)")} data-testid="queue-back-link"><ArrowLeft /> Back to designer</Link>
        <span className="h-6 w-px bg-[#E5E7EB]" />
        <span className="grid size-7 place-items-center rounded-md bg-(--app-accent) text-white"><Barcode className="size-4" /></span>
        <h1 className="text-sm font-semibold">RAPID LABELS <span className="font-normal text-[#6B7280]">by MOHAN</span> <span className="font-normal text-[#9CA3AF]">· Print queue</span></h1>
        <span className="ml-auto" />
        <ThemePicker />
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#D9DDE3] bg-[#F8F9FB] px-4 py-2">
        <label className="flex items-center gap-2 text-xs text-[#374151]">
          <Checkbox data-testid="queue-select-all" checked={allOn} onCheckedChange={toggleAll} disabled={!jobs.length} /> Select all jobs
        </label>
        <Button size="sm" variant="outline" className="bg-white text-[#D93025] hover:text-[#D93025]" data-testid="queue-remove-selected" disabled={!jobs.some((j) => j.selected)}
          onClick={() => { const ids = jobs.filter((j) => j.selected).map((j) => j.id); if (confirm(`Remove ${ids.length} job(s) from the queue?`)) remove.mutate(ids); }}>
          <Trash2 /> Remove selected
        </Button>
        <Button size="sm" variant="ghost" data-testid="queue-clear" disabled={!jobs.length} onClick={() => confirm("Clear the whole print queue?") && remove.mutate([])}>Clear queue</Button>
        <span className="ml-auto text-xs text-[#4B5563]" data-testid="queue-stats">
          {jobs.length} job{jobs.length === 1 ? "" : "s"} in queue · <b>{totalLabels}</b> labels selected to print · {pages.length} page{pages.length === 1 ? "" : "s"}
        </span>
        <Button size="sm" variant="outline" className="bg-white" data-testid="queue-preview-button" disabled={!parts.length} onClick={() => { setPage(0); setPreviewOpen(true); }}><Eye /> Preview</Button>
        <Button size="sm" className="bg-[#188038] text-white hover:bg-[#146C2E]" data-testid="queue-print-button" disabled={!parts.length} onClick={runPrint}>
          <Printer /> Print all selected ({totalLabels})
        </Button>
      </div>

      <main className="min-h-0 flex-1 overflow-auto p-4">
        {queueQ.isLoading ? (
          <p className="text-sm text-[#6B7280]">Loading queue…</p>
        ) : jobs.length === 0 ? (
          <div className="grid h-full place-items-center text-center" data-testid="queue-empty">
            <div>
              <ListOrdered className="mx-auto mb-2 size-9 text-(--app-accent)" />
              <p className="text-sm text-[#4B5563]">The print queue is empty.</p>
              <p className="mt-1 text-xs text-[#6B7280]">Tick rows in any sheet or tab and click <b>Add to queue</b> — then print everything here in one batch.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#D9DDE3] bg-white" data-testid="queue-list">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#F3F4F6] text-left text-xs text-[#374151]">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="w-10 px-2 py-2">#</th>
                  <th className="px-2 py-2">Label</th>
                  <th className="px-2 py-2">Sheet / tab</th>
                  <th className="w-24 px-2 py-2 text-right">Rows</th>
                  <th className="w-24 px-2 py-2 text-right">Labels</th>
                  <th className="w-36 px-2 py-2">Added</th>
                  <th className="w-20 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {jobs.map((j, ji) => {
                  const tpl = tplOf(j);
                  const expanded = open.has(j.id);
                  const cols = [...new Set(j.items.flatMap((i) => Object.keys(i.cells)))].slice(0, 5);
                  return (
                    <Fragment key={j.id}>
                      <tr data-testid={`queue-job-${ji}`} className={cn("border-t border-[#EEF0F2] transition-colors duration-100 hover:bg-[#F8FAFF]", !j.selected && "text-[#9CA3AF]")}>
                        <td className="px-3 py-2"><Checkbox data-testid={`queue-job-checkbox-${ji}`} checked={j.selected} onCheckedChange={() => patch.mutate({ id: j.id, body: { selected: !j.selected } })} /></td>
                        <td className="px-2 py-2 font-mono text-xs text-[#9CA3AF]">{ji + 1}</td>
                        <td className="px-2 py-2">
                          <span className="font-medium">{j.template_brand} — {j.template_name}</span>
                          {tpl ? <span className="ml-2 text-[11px] text-[#9CA3AF]">{tpl.width_mm}×{tpl.height_mm} mm</span>
                            : <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-[#D93025]"><TriangleAlert className="size-3" /> label deleted — can't print</span>}
                        </td>
                        <td className="px-2 py-2 text-xs text-[#4B5563]">{j.source_name || "—"}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs">{j.items.filter((i) => i.selected).length}/{j.items.length}</td>
                        <td className="px-2 py-2 text-right font-mono text-sm font-semibold" data-testid={`queue-job-labels-${ji}`}>{jobLabels(j)}</td>
                        <td className="px-2 py-2 text-xs text-[#6B7280]">{new Date(j.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</td>
                        <td className="px-2 py-2">
                          <span className="flex justify-end gap-0.5">
                            <Button variant="ghost" size="icon-xs" title="Show rows" data-testid={`queue-job-expand-${ji}`}
                              onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(j.id)) n.delete(j.id); else n.add(j.id); return n; })}>
                              <ChevronDown className={cn("transition-transform duration-150", expanded && "rotate-180")} />
                            </Button>
                            <Button variant="ghost" size="icon-xs" title="Remove job" data-testid={`queue-job-delete-${ji}`} onClick={() => remove.mutate([j.id])}><Trash2 /></Button>
                          </span>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-[#FAFBFC]" data-testid={`queue-job-rows-${ji}`}>
                          <td />
                          <td colSpan={7} className="px-2 pb-3">
                            <table className="w-full border-collapse text-xs">
                              <thead className="text-left text-[#6B7280]">
                                <tr>
                                  <th className="w-8 py-1">
                                    <Checkbox data-testid={`queue-job-${ji}-select-all-rows`} checked={j.items.every((i) => i.selected)}
                                      onCheckedChange={() => { const on = !j.items.every((i) => i.selected); setItems(j, j.items.map((i) => ({ ...i, selected: on }))); }} />
                                  </th>
                                  <th className="w-20 py-1">Qty</th>
                                  {cols.map((c) => <th key={c} className="py-1 pr-3 font-medium">{c}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {j.items.map((it, ii) => (
                                  <tr key={ii} className={cn("border-t border-[#EEF0F2]", !it.selected && "text-[#9CA3AF]")}>
                                    <td className="py-1"><Checkbox data-testid={`queue-item-checkbox-${ji}-${ii}`} checked={it.selected}
                                      onCheckedChange={() => setItems(j, j.items.map((x, k) => (k === ii ? { ...x, selected: !x.selected } : x)))} /></td>
                                    <td className="py-1">
                                      <input type="number" min={1} data-testid={`queue-item-qty-${ji}-${ii}`} value={it.qty}
                                        onChange={(e) => setItems(j, j.items.map((x, k) => (k === ii ? { ...x, qty: Math.max(1, Math.min(9999, parseInt(e.target.value) || 1)) } : x)))}
                                        className="h-6 w-16 rounded border border-[#D1D5DB] bg-white px-1.5 font-mono outline-none focus:border-(--app-accent)" />
                                    </td>
                                    {cols.map((c) => <td key={c} className="max-w-48 truncate py-1 pr-3">{it.cells[c]}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[min(900px,95vw)] gap-0 overflow-hidden p-0 sm:max-w-[min(900px,95vw)]" data-testid="queue-preview-dialog">
          <DialogHeader className="border-b border-[#E5E7EB] px-5 py-3">
            <DialogTitle className="text-base">Batch preview — {totalLabels} labels from {printable.length} job{printable.length === 1 ? "" : "s"}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-[560px] flex-col bg-[#E8EAED]">
            <p className="bg-white px-5 py-2 text-xs text-[#4B5563]" data-testid="queue-preview-job">
              {pg ? <>Job: <b>{jobs.find((j) => j.id === pg.part.key)?.template_name}</b> · {jobs.find((j) => j.id === pg.part.key)?.source_name}</> : null}
            </p>
            <div className="grid flex-1 place-items-center overflow-auto p-6">
              {pg && (
                <Scaled widthMm={pg.spec.w} heightMm={pg.spec.h} scale={scale} className="shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
                  <SheetPage spec={pg.spec} ps={pg.part.ps} template={pg.part.template} slots={pg.slots} mapping={pg.part.mapping} outlineEmpty />
                </Scaled>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 border-t border-[#D9DDE3] bg-white py-2">
              <Button variant="ghost" size="icon-sm" data-testid="queue-preview-prev" disabled={current <= 0} onClick={() => setPage(current - 1)}><ChevronLeft /></Button>
              <span className="min-w-28 text-center font-mono text-xs" data-testid="queue-preview-indicator">Page {pages.length ? current + 1 : 0} / {pages.length}</span>
              <Button variant="ghost" size="icon-sm" data-testid="queue-preview-next" disabled={current >= pages.length - 1} onClick={() => setPage(current + 1)}><ChevronRight /></Button>
              <Button size="sm" className="ml-6 bg-[#188038] text-white hover:bg-[#146C2E]" data-testid="queue-preview-print" onClick={runPrint}><Printer /> Print all ({totalLabels})</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {printing && <BatchPrintPortal parts={printing} />}
      {dupGuard.dialog}
    </div>
  );
}
