import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Link2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorDetail, apiPost, apiUpload } from "@/lib/api";
import { fetchSheet } from "@/lib/label";
import type { SheetSource } from "@/lib/types";

/** Paste a Google Sheets/CSV link or upload a CSV/XLSX — every import is saved as a sheet source. */
export function SheetImporter({ sources, onImported }: {
  sources: SheetSource[];
  onImported: (created: SheetSource[]) => void;
}) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadLink = useMutation({
    mutationFn: async (link: string) => {
      const data = await fetchSheet(link);
      qc.setQueryData(["sheet", link], data);
      const existing = sources.find((s) => s.url === link);
      if (existing) return [existing];
      const src = await apiPost<SheetSource>("/sources", {
        name: data.name || `Google Sheet ${sources.length + 1}`,
        brand: "General",
        url: link,
        template_id: null,
      });
      // Pick up every brand tab of the spreadsheet as its own saved sheet.
      const tabs = await apiPost<SheetSource[]>(`/sources/${src.id}/sync-tabs`).catch(() => [src]);
      return [tabs.find((t) => t.id === src.id) ?? src, ...tabs.filter((t) => t.id !== src.id)];
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      setUrl("");
      toast.success(created.length > 1 ? `Connected — ${created.length} tabs found` : `Sheet "${created[0].name}" connected`);
      onImported(created);
    },
    onError: (err) => toast.error(apiErrorDetail(err, "Could not load that sheet")),
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiUpload<SheetSource[]>("/sheets/upload", form);
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      toast.success(created.length > 1 ? `${created.length} tabs imported as separate sheets` : `"${created[0].name}" imported`);
      onImported(created);
    },
    onError: (err) => toast.error(apiErrorDetail(err, "Upload failed")),
  });

  const submit = () => {
    if (!url.trim()) return toast.error("Paste a Google Sheets or CSV link");
    loadLink.mutate(url.trim());
  };
  const busy = loadLink.isPending || upload.isPending;

  return (
    <div className="grid gap-4" data-testid="sheet-importer">
      <div className="grid gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-[#1F2937]">
          <FileSpreadsheet className="size-4 text-[#188038]" /> Google Sheet link
        </p>
        <div className="flex gap-2">
          <Input data-testid="google-sheets-input-url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…" className="h-9 bg-white text-xs"
            onKeyDown={(e) => e.key === "Enter" && submit()} />
          <Button data-testid="google-sheets-fetch-button" onClick={submit} disabled={busy} className="h-9 bg-(--app-accent) text-white hover:bg-(--app-accent-hover)">
            <Link2 /> {loadLink.isPending ? "Connecting…" : "Connect"}
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-[#6B7280]">
          In Google Sheets click <b>Share → Anyone with the link → Viewer</b>, then copy the link of the tab you want. The sheet is remembered — use <b>Refresh</b> to pull new rows.
        </p>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-[#9CA3AF]">
        <span className="h-px flex-1 bg-[#E5E7EB]" /> or <span className="h-px flex-1 bg-[#E5E7EB]" />
      </div>
      <div className="grid gap-1.5">
        <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xlsm" className="hidden" data-testid="sheet-upload-input"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
        <Button variant="outline" data-testid="sheet-upload-button" disabled={busy} onClick={() => fileRef.current?.click()} className="h-9 bg-white">
          <Upload /> {upload.isPending ? "Uploading…" : "Upload CSV / Excel file"}
        </Button>
        <p className="text-[11px] text-[#6B7280]">Excel files with several tabs become one sheet per tab (great for multiple brands).</p>
      </div>
    </div>
  );
}
