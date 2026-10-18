import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { apiErrorDetail, apiPost } from "@/lib/api";
import type { SheetSource } from "@/lib/types";
import { cn } from "@/lib/utils";

const isGoogle = (s: SheetSource) => s.url.includes("docs.google.com/spreadsheets");
const autoSynced = new Set<string>(); // spreadsheets already re-read since the app was opened

/** Excel-style tab bar for switching between brand tabs of the same spreadsheet / file. */
export function SheetTabs({ sources, active, onSelect, testId = "sheet-tabs" }: {
  sources: SheetSource[];
  active: SheetSource | null;
  onSelect: (s: SheetSource) => void;
  testId?: string;
}) {
  const qc = useQueryClient();
  const sync = useMutation({
    mutationFn: (id: string) => apiPost<SheetSource[]>(`/sources/${id}/sync-tabs`),
    onSuccess: (tabs) => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      toast.success(tabs.length > 1 ? `${tabs.length} tabs in this spreadsheet` : "No other tabs found");
    },
    onError: (err) => toast.error(apiErrorDetail(err, "Could not read the spreadsheet tabs")),
  });
  // Every time the app opens, quietly pick up renamed / new / deleted tabs from Google.
  const silent = useMutation({
    mutationFn: (id: string) => apiPost<SheetSource[]>(`/sources/${id}/sync-tabs`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
  });
  const autoKey = active && isGoogle(active) ? active.workbook ?? active.id : null;
  useEffect(() => {
    if (!active || !autoKey || autoSynced.has(autoKey)) return;
    autoSynced.add(autoKey);
    silent.mutate(active.id);
  }, [autoKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!active) return null;
  const siblings = active.workbook
    ? sources.filter((s) => s.workbook === active.workbook).sort((a, b) => a.tab_index - b.tab_index)
    : [active];
  const google = isGoogle(active);
  if (!google && siblings.length < 2) return null;

  return (
    <div className="flex h-8 shrink-0 items-stretch gap-0.5 overflow-x-auto border-b border-[#E5E7EB] bg-[#F1F3F4] px-2" data-testid={testId}>
      <span className="flex items-center gap-1.5 pr-2 text-[11px] font-medium text-[#4B5563]">
        <FileSpreadsheet className="size-3.5 text-[#188038]" />
        <span className="max-w-40 truncate" title={active.workbook_name ?? active.name}>{active.workbook_name ?? active.name}</span>
      </span>
      {siblings.map((s) => {
        const on = s.id === active.id;
        return (
          <button key={s.id} data-testid={`${testId}-tab-${s.tab_index}`} onClick={() => !on && onSelect(s)} title={s.name}
            className={cn("relative my-1 flex shrink-0 items-center whitespace-nowrap rounded px-3 text-xs transition-colors duration-150",
              on ? "bg-white font-semibold text-(--app-accent) shadow-[0_1px_2px_rgba(0,0,0,0.12)]" : "text-[#374151] hover:bg-white/70")}>
            {s.tab ?? s.name}
            {on && <span className="absolute inset-x-2 -bottom-1 h-0.5 rounded bg-(--app-accent)" />}
          </button>
        );
      })}
      {google && (
        <button data-testid={`${testId}-sync`} disabled={sync.isPending || silent.isPending} onClick={() => sync.mutate(active.id)}
          title={active.workbook ? "Re-read tab names and new / deleted tabs from Google" : "Find the other tabs (brands) in this spreadsheet"}
          className="my-1 ml-1 flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-2 text-[11px] text-(--app-accent) transition-colors duration-150 hover:bg-white disabled:opacity-50">
          {active.workbook ? <RefreshCw className={cn("size-3", (sync.isPending || silent.isPending) && "animate-spin")} /> : <Search className="size-3" />}
          {active.workbook ? "Sync tabs" : "Find tabs"}
        </button>
      )}
    </div>
  );
}
