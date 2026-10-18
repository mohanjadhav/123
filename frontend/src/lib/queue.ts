import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorDetail, apiGet, apiPost } from "@/lib/api";
import { rowQty } from "@/lib/grid";
import type { CopyRow, QueueItem, QueueJob, QueueJobCreate } from "@/lib/types";

export const fetchQueue = () => apiGet<QueueJob[]>("/queue");

export function useQueueCount() {
  const q = useQuery({ queryKey: ["queue"], queryFn: fetchQueue });
  return q.isError ? 0 : (q.data ?? []).length;
}

/** Ticked rows with quantity > 0 become queue items (a snapshot of the data right now). */
export function queueItemsFrom(rows: CopyRow[], qtyColumn: string | null): QueueItem[] {
  return rows.flatMap((r) => {
    const qty = r.selected ? rowQty(r, qtyColumn) : 0;
    return qty > 0 ? [{ cells: r.cells, qty, selected: true }] : [];
  });
}

export function useAddToQueue(onOpenQueue: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: QueueJobCreate) => apiPost<QueueJob>("/queue", body),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["queue"] });
      const labels = job.items.reduce((n, i) => n + i.qty, 0);
      toast.success(`${labels} label${labels === 1 ? "" : "s"} added to the print queue`, {
        description: `${job.template_brand} — ${job.template_name}${job.source_name ? ` · ${job.source_name}` : ""}`,
        action: { label: "Open queue", onClick: onOpenQueue },
      });
    },
    onError: (err) => toast.error(apiErrorDetail(err, "Could not add to queue")),
  });
}
