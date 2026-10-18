import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { HistorySummary, PrintLog, PrintLogCreate, PrintPart } from "@/lib/types";

export const HISTORY_KEY = ["history-summary"];
export const userTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const useHistorySummary = (rangeDays = 30) =>
  useQuery({
    queryKey: [...HISTORY_KEY, rangeDays],
    queryFn: () => apiGet<HistorySummary>(`/history/summary?tz=${encodeURIComponent(userTz())}&days=14&range_days=${rangeDays}`),
  });

/** Count labels each time the print window opens; toast offers "Undo count" if the print was cancelled. */
export function useRecordPrint() {
  const qc = useQueryClient();
  const undo = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/history/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: HISTORY_KEY }); toast.success("Print count removed"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const record = useMutation({
    mutationFn: (body: PrintLogCreate) => apiPost<PrintLog>("/history", body),
    onSuccess: (log) => {
      qc.invalidateQueries({ queryKey: HISTORY_KEY });
      toast.success(`Counted ${log.labels} label${log.labels === 1 ? "" : "s"} printed`, {
        description: "Cancelled the print? Undo the count.",
        action: { label: "Undo count", onClick: () => undo.mutate(log.id) },
        duration: 8000,
      });
    },
  });
  return (origin: PrintLogCreate["origin"], parts: PrintPart[]) => {
    const real = parts.filter((p) => p.labels > 0);
    if (real.length) record.mutate({ origin, parts: real, tz: userTz() });
  };
}
