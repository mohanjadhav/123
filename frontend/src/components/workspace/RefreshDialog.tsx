import { RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Asks how to refresh when the in-app copy has edits. */
export function RefreshDialog({ open, onOpenChange, onChoose, pending }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChoose: (mode: "replace" | "merge") => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="refresh-dialog">
        <DialogHeader>
          <DialogTitle>Refresh from the original sheet?</DialogTitle>
          <DialogDescription>You have edited this data in the app. Your Google Sheet was not changed. What should happen to your edits?</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <button data-testid="refresh-merge-button" disabled={pending} onClick={() => onChoose("merge")}
            className="flex items-start gap-3 rounded-lg border border-[#D9DDE3] p-3 text-left transition-colors duration-150 hover:border-(--app-accent) hover:bg-[#F8FAFF] disabled:opacity-50">
            <RefreshCw className="mt-0.5 size-4 shrink-0 text-(--app-accent)" />
            <span>
              <span className="block text-sm font-medium">Keep my edits, add new rows only</span>
              <span className="block text-xs text-[#6B7280]">Rows added to the Google Sheet since the last load are appended. Your edited rows, quantities and ticks stay.</span>
            </span>
          </button>
          <button data-testid="refresh-replace-button" disabled={pending} onClick={() => onChoose("replace")}
            className="flex items-start gap-3 rounded-lg border border-[#D9DDE3] p-3 text-left transition-colors duration-150 hover:border-[#D93025] hover:bg-[#FEF7F6] disabled:opacity-50">
            <RotateCcw className="mt-0.5 size-4 shrink-0 text-[#D93025]" />
            <span>
              <span className="block text-sm font-medium">Replace my edits with the latest data</span>
              <span className="block text-xs text-[#6B7280]">Discards all in-app edits, quantities and ticks, and loads the sheet fresh.</span>
            </span>
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" data-testid="refresh-cancel-button" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
