import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Barcode, CalendarDays, Layers, Printer, Tag, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { ThemePicker } from "@/components/ThemePicker";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiDelete } from "@/lib/api";
import { HISTORY_KEY, useHistorySummary } from "@/lib/history";
import type { NameCount } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANGES = [{ d: 1, label: "Today" }, { d: 7, label: "7 days" }, { d: 30, label: "30 days" }, { d: 0, label: "All time" }];
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
const ORIGIN: Record<string, string> = { designer: "Designer", sheet: "Sheet data", queue: "Print queue" };

function Stat({ icon, label, value, testId, accent }: { icon: React.ReactNode; label: string; value: number; testId: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", accent ? "border-transparent bg-(--app-accent) text-white" : "border-[#E5E7EB] bg-white")}>
      <p className={cn("flex items-center gap-1.5 text-xs [&_svg]:size-3.5", accent ? "text-white/80" : "text-[#6B7280]")}>{icon}{label}</p>
      <p className="mt-1 font-mono text-3xl font-semibold tabular-nums" data-testid={testId}>{value.toLocaleString()}</p>
    </div>
  );
}

function Breakdown({ title, icon, rows, testId }: { title: string; icon: React.ReactNode; rows: NameCount[]; testId: string }) {
  const max = Math.max(1, ...rows.map((r) => r.labels));
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4" data-testid={testId}>
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-(--app-accent)">{icon}{title}</h3>
      {rows.length === 0 ? <p className="text-xs text-[#9CA3AF]">Nothing printed in this period.</p> : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.name} className="grid gap-1">
              <div className="flex justify-between gap-2 text-xs"><span className="truncate text-[#1F2937]" title={r.name}>{r.name}</span><span className="shrink-0 font-mono"><b>{r.labels.toLocaleString()}</b> <span className="text-[#9CA3AF]">· {r.prints}×</span></span></div>
              <div className="h-1.5 rounded-full bg-[#F3F4F6]"><div className="h-full rounded-full bg-(--app-accent) transition-[width] duration-300" style={{ width: `${(r.labels / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function History() {
  const qc = useQueryClient();
  const [range, setRange] = useState(7);
  const { data, isLoading } = useHistorySummary(range);
  const del = useMutation({
    mutationFn: (path: string) => apiDelete<void>(path),
    onSuccess: () => { qc.invalidateQueries({ queryKey: HISTORY_KEY }); toast.success("Print count removed"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const maxDay = Math.max(1, ...(data?.by_day ?? []).map((d) => d.labels));

  return (
    <div className="app-screen flex flex-col bg-[#EEF0F3] text-[#1F2937]">
      <header className="no-scrollbar flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-[#D9DDE3] bg-white px-3 [&>*]:shrink-0" data-testid="history-header">
        <Link to="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-(--app-accent)")} data-testid="history-back-link"><ArrowLeft /> <span className="hidden lg:inline">Back to designer</span></Link>
        <span className="h-6 w-px bg-[#E5E7EB]" />
        <span className="grid size-7 place-items-center rounded-md bg-(--app-accent) text-white"><Barcode className="size-4" /></span>
        <h1 className="whitespace-nowrap text-sm font-semibold">RAPID LABELS <span className="font-normal text-[#6B7280]">by MOHAN</span> <span className="font-normal text-[#9CA3AF]">· Print history</span></h1>
        <span className="ml-auto" />
        <Button size="sm" variant="outline" data-testid="history-undo-last" disabled={!data?.recent.length || del.isPending}
          onClick={() => confirm("Remove the most recent print count?") && del.mutate("/history/last")}><Undo2 /> Undo last count</Button>
        <ThemePicker />
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl gap-4 p-5">
          {isLoading || !data ? <p className="text-sm text-[#6B7280]">Loading…</p> : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat accent icon={<Printer />} label={`Today (${new Date(`${data.today}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })})`} value={data.today_labels} testId="history-today" />
                <Stat icon={<CalendarDays />} label="Last 7 days" value={data.week_labels} testId="history-week" />
                <Stat icon={<Layers />} label="All time" value={data.total_labels} testId="history-total" />
              </div>

              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4" data-testid="history-daily-chart">
                <h3 className="mb-3 text-sm font-semibold">Labels printed per day <span className="font-normal text-[#9CA3AF]">· last 14 days</span></h3>
                <div className="flex h-40 items-end gap-1.5">
                  {data.by_day.map((d) => (
                    <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.labels} labels`}>
                      <span className="font-mono text-[10px] text-[#4B5563] opacity-0 transition-opacity duration-150 group-hover:opacity-100">{d.labels}</span>
                      <div className={cn("w-full rounded-t transition-[height] duration-300", d.day === data.today ? "bg-(--app-accent)" : "bg-(--app-accent)/35")} style={{ height: `${Math.max(d.labels ? 4 : 1, (d.labels / maxDay) * 100)}%` }} />
                      <span className={cn("text-[9px] whitespace-nowrap", d.day === data.today ? "font-semibold text-(--app-accent)" : "text-[#9CA3AF]")}>{dayLabel(d.day)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex items-center gap-1" data-testid="history-range">
                <span className="mr-1 text-xs text-[#6B7280]">Breakdown for:</span>
                {RANGES.map((r) => (
                  <button key={r.d} data-testid={`history-range-${r.d}`} onClick={() => setRange(r.d)}
                    className={cn("rounded-full px-3 py-1 text-xs transition-colors duration-150", range === r.d ? "bg-(--app-accent) text-white" : "bg-white text-[#374151] hover:bg-[#F3F4F6]")}>{r.label}</button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Breakdown title="Per sheet / brand" icon={<Layers />} rows={data.by_sheet} testId="history-by-sheet" />
                <Breakdown title="Per label design" icon={<Tag />} rows={data.by_label} testId="history-by-label" />
              </div>

              <section className="rounded-xl border border-[#E5E7EB] bg-white" data-testid="history-recent">
                <h3 className="border-b border-[#F3F4F6] px-4 py-3 text-sm font-semibold">Recent prints</h3>
                {data.recent.length === 0 ? <p className="px-4 py-6 text-center text-xs text-[#9CA3AF]">No prints yet — every time you click Print, the labels are counted here.</p> : (
                  <ul className="divide-y divide-[#F3F4F6]">
                    {data.recent.map((log) => (
                      <li key={log.id} className="flex items-center gap-3 px-4 py-2 text-xs" data-testid={`history-log-${log.id}`}>
                        <span className="w-32 shrink-0 font-mono text-[#6B7280]">{new Date(log.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="w-20 shrink-0 rounded bg-[#F3F4F6] px-1.5 py-0.5 text-center text-[10px] text-[#4B5563]">{ORIGIN[log.origin] ?? log.origin}</span>
                        <span className="min-w-0 flex-1 truncate text-[#374151]" title={log.parts.map((p) => `${p.template_name} · ${p.source_name || "no sheet"}: ${p.labels}`).join("\n")}>
                          {log.parts.map((p) => `${p.source_name || p.template_name}`).join(", ")}
                        </span>
                        <b className="shrink-0 font-mono">{log.labels}</b>
                        <button title="Remove this count (print was cancelled)" data-testid={`history-delete-${log.id}`} onClick={() => del.mutate(`/history/${log.id}`)}
                          className="grid size-6 shrink-0 place-items-center rounded text-[#9CA3AF] transition-colors duration-150 hover:bg-[#FDECEA] hover:text-[#D93025]"><Trash2 className="size-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
