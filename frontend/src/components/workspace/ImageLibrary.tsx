import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Link2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiDelete, apiGet, apiUpload } from "@/lib/api";
import type { ImageAsset } from "@/lib/types";

export const IMAGES_KEY = ["images"];
const kb = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

/** Reusable logo / background / picture library. Files are stored at original resolution for sharp printing. */
export function ImageLibrary({ open, onOpenChange, title, onPick }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  onPick: (url: string) => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const { data: images = [], isLoading } = useQuery({ queryKey: IMAGES_KEY, queryFn: () => apiGet<ImageAsset[]>("/images"), enabled: open });

  const upload = useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      return apiUpload<ImageAsset[]>("/images", form);
    },
    onSuccess: (added) => {
      qc.invalidateQueries({ queryKey: IMAGES_KEY });
      toast.success(added.length === 1 ? "Image added to library" : `${added.length} images added to library`);
      if (added.length === 1) pick(added[0].url);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/images/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: IMAGES_KEY }); toast.success("Image removed from library"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pick = (url: string) => { onPick(url); onOpenChange(false); };
  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.some((f) => f.size > 10 * 1024 * 1024)) return toast.error("Each image must be under 10 MB");
    if (files.length) upload.mutate(files);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" data-testid="image-library-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Upload logos, backgrounds or product pictures once and reuse them on any label. Images are kept at full resolution (PNG, JPG, SVG, WebP up to 10 MB) for sharp HD printing.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} data-testid="image-library-file-input" />
          <Button data-testid="image-library-upload-button" disabled={upload.isPending} onClick={() => fileRef.current?.click()}
            className="bg-(--app-accent) text-white hover:bg-(--app-accent-hover)">
            <Upload /> {upload.isPending ? "Uploading…" : "Upload from computer"}
          </Button>
          <div className="relative min-w-60 flex-1">
            <Link2 className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or paste an image link (https://…)" className="pl-8" data-testid="image-library-link-input"
              onKeyDown={(e) => e.key === "Enter" && link.trim() && pick(link.trim())} />
          </div>
          <Button variant="outline" disabled={!link.trim()} onClick={() => pick(link.trim())} data-testid="image-library-use-link-button">Use link</Button>
        </div>

        <div className="grid max-h-[52vh] grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3 overflow-y-auto p-0.5" data-testid="image-library-grid">
          {isLoading && <p className="col-span-full py-8 text-center text-sm text-[#6B7280]">Loading…</p>}
          {!isLoading && images.length === 0 && (
            <button onClick={() => fileRef.current?.click()} data-testid="image-library-empty"
              className="col-span-full grid place-items-center gap-2 rounded-lg border-2 border-dashed border-[#C7CCD3] py-10 text-sm text-[#6B7280] transition-colors duration-150 hover:border-(--app-accent) hover:text-(--app-accent)">
              <ImagePlus className="size-8" /> Your library is empty — upload your logo or background
            </button>
          )}
          {images.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-lg border border-[#E5E7EB] bg-white transition-shadow duration-150 hover:shadow-md" data-testid={`image-library-item-${img.id}`}>
              <button onClick={() => pick(img.url)} className="block w-full" title={`Use ${img.name}`} data-testid={`image-library-pick-${img.id}`}>
                <div className="true-color grid aspect-[4/3] place-items-center bg-[repeating-conic-gradient(#F3F4F6_0_25%,#fff_0_50%)] bg-[length:14px_14px] p-2">
                  <img src={img.url} alt={img.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                </div>
                <div className="truncate border-t border-[#F3F4F6] px-2 py-1 text-left text-[11px] text-[#374151]">{img.name}<span className="ml-1 text-[#9CA3AF]">· {kb(img.size)}</span></div>
              </button>
              <button title="Remove from library" data-testid={`image-library-delete-${img.id}`}
                onClick={() => confirm(`Remove "${img.name}" from the library? Labels using it will show an empty image.`) && remove.mutate(img.id)}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded bg-white/90 text-[#D93025] opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100 focus:opacity-100">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
