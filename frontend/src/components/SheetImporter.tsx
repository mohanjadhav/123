import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorDetail, apiPost, apiUpload } from "@/lib/api";
import { fetchSheet } from "@/lib/label";
import type { SheetSource } from "@/lib/types";

/** Paste a Google Sheets/CSV link or upload a CSV/XLSX — every import is saved as a sheet source. */
export function SheetImporter({ sources, templateId, onImported }: {
  sources: SheetSource[];
  templateId?: string | null;
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
        template_id: templateId || null,
      });
      return [src];
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      setUrl("");
      toast.success(`Sheet "${created[0].name}" saved`);
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
    <div className="grid gap-2" data-testid="sheet-importer">
      <div className="flex gap-1.5">
        <Input data-testid="google-sheets-input-url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste Google Sheet link" className="h-9 text-xs" onKeyDown={(e) => e.key === "Enter" && submit()} />
        <Button size="icon" variant="outline" data-testid="google-sheets-fetch-button" onClick={submit} disabled={busy} title="Load & save sheet">
          <Download />
        </Button>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xlsm" className="hidden" data-testid="sheet-upload-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
      <Button variant="outline" size="sm" data-testid="sheet-upload-button" disabled={busy} onClick={() => fileRef.current?.click()}>
        <Upload /> {upload.isPending ? "Uploading…" : "Upload CSV / Excel file"}
      </Button>
      {busy && <p className="text-xs text-neutral-400" data-testid="sheet-import-status">Importing sheet…</p>}
    </div>
  );
}

/** Column headers rendered as {{variables}}. */
export function VariableChips({ columns, onPick }: { columns: string[]; onPick: (col: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="column-chips">
      {columns.map((c) => (
        <button key={c} data-testid={`column-chip-${c}`} onClick={() => onPick(c)} title={`Insert {{${c}}}`}
          className="rounded border border-[#3F4858] bg-[#1F242C] px-2 py-1 font-mono text-[11px] text-[#06B6D4] transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-[#06B6D4]">
          {`{{${c}}}`}
        </button>
      ))}
    </div>
  );
}
