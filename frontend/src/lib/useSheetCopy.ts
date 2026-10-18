import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorDetail, apiGet, apiPost, apiPut } from "@/lib/api";
import type { CopyRefreshResult, SheetCopy } from "@/lib/types";

export type SaveState = "idle" | "pending" | "saving" | "error";

/**
 * The app-side editable copy of a sheet, shared by the designer and the Sheet Data page
 * (same query key). Changes apply instantly and auto-save (debounced) to the backend.
 */
export function useSheetCopy(sourceId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["copy", sourceId],
    queryFn: () => apiGet<SheetCopy>(`/sheets/copy/${sourceId}`),
    enabled: !!sourceId,
    retry: false,
    staleTime: Infinity, // never let a background refetch overwrite unsaved edits
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<number | undefined>(undefined);

  const update = useCallback((fn: (c: SheetCopy) => SheetCopy) => {
    if (!sourceId) return;
    const key = ["copy", sourceId];
    const cur = qc.getQueryData<SheetCopy>(key);
    if (!cur) return;
    qc.setQueryData(key, fn(cur));
    setSaveState("pending");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const latest = qc.getQueryData<SheetCopy>(key);
      if (!latest) return;
      setSaveState("saving");
      try {
        const saved = await apiPut<SheetCopy>(`/sheets/copy/${sourceId}`, { columns: latest.columns, rows: latest.rows, qty_column: latest.qty_column ?? null });
        qc.setQueryData<SheetCopy>(key, (c) => (c ? { ...c, edited: saved.edited, updated_at: saved.updated_at } : saved));
        setSaveState("idle");
      } catch {
        setSaveState("error");
        toast.error("Could not save sheet changes");
      }
    }, 500);
  }, [qc, sourceId]);

  const refresh = useMutation({
    mutationFn: (mode: "replace" | "merge") => apiPost<CopyRefreshResult>(`/sheets/copy/${sourceId}/refresh`, { mode }),
    onSuccess: (res, mode) => {
      window.clearTimeout(timer.current);
      setSaveState("idle");
      qc.setQueryData(["copy", sourceId], res.sheet);
      // also re-read the spreadsheet's tab names (renamed / new / deleted tabs in Google)
      void apiPost(`/sources/${sourceId}/sync-tabs`).catch(() => null).finally(() => {
        qc.invalidateQueries({ queryKey: ["sources"] });
        qc.invalidateQueries({ queryKey: ["templates"] });
      });
      toast.success(mode === "replace" ? `Loaded ${res.sheet.rows.length} rows from the original sheet` : `${res.added} new row${res.added === 1 ? "" : "s"} added, your edits kept`);
    },
    onError: (err) => toast.error(apiErrorDetail(err, "Could not refresh sheet")),
  });

  return { query, copy: query.isError ? undefined : query.data, update, refresh, saveState };
}
