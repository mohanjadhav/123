import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpCircle, CheckCircle2, DatabaseBackup, Download, Github, RefreshCw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiGet, apiPut, apiUpload } from "@/lib/api";
import type { AppInfo, AppSettings, RestoreResult, UpdateCheck } from "@/lib/types";

export const APP_INFO_KEY = ["app-info"];
export const UPDATE_KEY = ["update-check"];
const LABEL: Record<string, string> = { templates: "labels", sheet_sources: "sheets", sheet_copies: "sheet edits", sheet_uploads: "uploaded files", print_queue: "queue jobs", images: "images" };

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-lg border border-[#E5E7EB] p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-[#1F2937] [&_svg]:size-4 [&_svg]:text-(--app-accent)">{icon}{title}</h4>
      {children}
    </section>
  );
}

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const info = useQuery({ queryKey: APP_INFO_KEY, queryFn: () => apiGet<AppInfo>("/app/info"), enabled: open });
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: () => apiGet<AppSettings>("/app/settings"), enabled: open });
  const [repo, setRepo] = useState<string | null>(null);
  const repoValue = repo ?? settings.data?.update_repo ?? "";
  const [check, setCheck] = useState<UpdateCheck | null>(null);
  const [lastRestore, setLastRestore] = useState<RestoreResult | null>(null);

  const restore = useMutation({
    mutationFn: (f: File) => { const form = new FormData(); form.append("file", f); return apiUpload<RestoreResult>("/backup/restore", form); },
    onSuccess: (r) => { setLastRestore(r); qc.invalidateQueries(); toast.success(`Backup loaded — ${r.total} items merged`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveRepo = useMutation({
    mutationFn: () => apiPut<AppSettings>("/app/settings", { update_repo: repoValue }),
    onSuccess: (s) => { setRepo(s.update_repo); qc.invalidateQueries({ queryKey: APP_INFO_KEY }); qc.invalidateQueries({ queryKey: UPDATE_KEY }); qc.invalidateQueries({ queryKey: ["app-settings"] }); toast.success(s.update_repo ? "Update address saved" : "Update address cleared"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const runCheck = useMutation({
    mutationFn: () => apiGet<UpdateCheck>("/app/update-check"),
    onSuccess: (c) => { setCheck(c); qc.setQueryData(UPDATE_KEY, c); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f && confirm(`Load "${f.name}"?\n\nEverything in the backup is added. Labels/sheets with the same ID here are replaced by the backup copy. Nothing else is deleted.`)) restore.mutate(f);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            RAPID LABELS by MOHAN · version <b data-testid="settings-app-version">{info.data ? (info.data.desktop ? `v${info.data.version}` : "web preview") : "…"}</b>
          </DialogDescription>
        </DialogHeader>

        <Section icon={<DatabaseBackup />} title="Backup & restore">
          <p className="-mt-1 text-xs leading-relaxed text-[#4B5563]">One file with <b>all</b> labels, sheets (with your in-app edits, ticks and quantities), print queue and library images. Load it on another laptop to continue there.</p>
          <div className="flex flex-wrap gap-2">
            <a href="/api/backup" download data-testid="backup-download-button"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-(--app-accent) px-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-(--app-accent-hover) [&_svg]:size-4"
              onClick={() => toast.success("Backup is downloading (check your Downloads folder)")}>
              <Download /> Download backup file
            </a>
            <input ref={fileRef} type="file" accept=".rlbackup,.json,application/json" className="hidden" onChange={onFile} data-testid="backup-restore-input" />
            <Button variant="outline" data-testid="backup-restore-button" disabled={restore.isPending} onClick={() => fileRef.current?.click()}>
              <Upload /> {restore.isPending ? "Loading…" : "Load backup file"}
            </Button>
          </div>
          {lastRestore && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded bg-[#E6F4EA] px-2.5 py-1.5 text-xs text-[#137333]" data-testid="backup-restore-result">
              <CheckCircle2 className="size-3.5" /> Merged:
              {Object.entries(lastRestore.restored).filter(([, n]) => n).map(([k, n]) => <span key={k}><b>{n}</b> {LABEL[k] ?? k}</span>)}
              {!lastRestore.total && <span>nothing (empty backup)</span>}
            </p>
          )}
        </Section>

        <Section icon={<ArrowUpCircle />} title="Updates">
          <p className="-mt-1 text-xs leading-relaxed text-[#4B5563]">
            The Windows app checks your GitHub repository for a newer installer and shows a notice. Installers built by GitHub fill this in automatically — paste it here only if needed.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Github className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
              <Input value={repoValue} onChange={(e) => setRepo(e.target.value)} placeholder={info.data?.update_repo || "owner/repo or https://github.com/owner/repo"}
                className="pl-8" data-testid="update-repo-input" />
            </div>
            <Button variant="outline" data-testid="update-repo-save" disabled={saveRepo.isPending} onClick={() => saveRepo.mutate()}>Save</Button>
          </div>
          {info.data?.update_repo && !settings.data?.update_repo && <p className="-mt-1 text-[11px] text-[#6B7280]">Using <b>{info.data.update_repo}</b> (from the installer).</p>}
          <div className="flex items-center gap-2">
            <Button variant="outline" data-testid="update-check-button" disabled={runCheck.isPending} onClick={() => runCheck.mutate()}>
              <RefreshCw className={runCheck.isPending ? "animate-spin" : undefined} /> Check for updates now
            </Button>
          </div>
          {check && (
            <div className="rounded border border-[#E5E7EB] bg-[#F8F9FB] p-2.5 text-xs text-[#374151]" data-testid="update-check-result">
              {check.error ? <span className="text-[#B06000]">{check.error}</span>
                : check.update_available ? (
                  <span>New version <b>v{check.latest}</b> is available (you have v{check.current}).{" "}
                    <a className="font-medium text-(--app-accent) underline" href={check.download_url ?? check.release_url ?? "#"} target="_blank" rel="noreferrer" data-testid="update-download-link">Download installer</a>
                  </span>)
                : <span>You're up to date{check.latest ? ` — latest is v${check.latest}` : ""}{info.data?.desktop ? "" : " (update notices appear in the Windows app)"}.</span>}
            </div>
          )}
        </Section>
      </DialogContent>
    </Dialog>
  );
}

/** Slim notice under the toolbar when the Windows app finds a newer installer on GitHub. */
export function UpdateBanner() {
  const info = useQuery({ queryKey: APP_INFO_KEY, queryFn: () => apiGet<AppInfo>("/app/info"), staleTime: 3_600_000 });
  const check = useQuery({
    queryKey: UPDATE_KEY, queryFn: () => apiGet<UpdateCheck>("/app/update-check"),
    enabled: !!info.data?.desktop && !!info.data.update_repo, staleTime: 6 * 3_600_000, retry: false,
  });
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("rl.updateDismissed") ?? "");
  const c = check.data;
  if (!c?.update_available || !c.latest || dismissed === c.latest) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[#FBD38D] bg-[#FFF8E6] px-3 py-1.5 text-xs text-[#7A4B00]" data-testid="update-banner">
      <ArrowUpCircle className="size-4 text-[#E09A00]" />
      <span>A new version <b>v{c.latest}</b> of RAPID LABELS is available (you have v{c.current}).</span>
      <a href={c.download_url ?? c.release_url ?? "#"} target="_blank" rel="noreferrer" data-testid="update-banner-download"
        className="rounded bg-[#E09A00] px-2 py-0.5 font-medium text-white transition-colors duration-150 hover:bg-[#B87F00]">Download installer</a>
      {c.release_url && <a href={c.release_url} target="_blank" rel="noreferrer" className="underline" data-testid="update-banner-notes">What's new</a>}
      <button className="ml-auto grid size-5 place-items-center rounded hover:bg-[#FBD38D]/50" title="Hide until the next version" data-testid="update-banner-dismiss"
        onClick={() => { localStorage.setItem("rl.updateDismissed", c.latest ?? ""); setDismissed(c.latest ?? ""); }}><X className="size-3.5" /></button>
    </div>
  );
}
