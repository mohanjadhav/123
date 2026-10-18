import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLACEHOLDER } from "@/lib/label";
import type { CopyRow, LabelElement, Mapping } from "@/lib/types";

export interface DupGroup {
  column: string;
  value: string;
  rows: number[]; // 1-based row numbers in the sheet
  printing: number; // how many of those rows are being printed now
  where?: string[]; // queue: "Sheet · label · row N" descriptions instead of row numbers
}

/** Per column, the set of values that appear in 2+ rows (for red highlighting). */
export function duplicateCells(rows: { cells: Record<string, string> }[], cols: string[]): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const c of cols) {
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const r of rows) {
      const v = (r.cells[c] ?? "").trim();
      if (!v) continue;
      if (seen.has(v)) dup.add(v);
      seen.add(v);
    }
    if (dup.size) out[c] = dup;
  }
  return out;
}

export const isDupCell = (dups: Record<string, Set<string>>, col: string, value: string | undefined) => !!dups[col]?.has((value ?? "").trim());

/** Across Print Queue jobs (any sheet): same barcode value on 2+ ticked rows. */
export function findQueueDuplicates(jobs: { label: string; elements: LabelElement[]; mapping: Mapping; items: { cells: Record<string, string>; selected: boolean }[] }[]): DupGroup[] {
  const seen = new Map<string, string[]>();
  for (const j of jobs) {
    const items = j.items.filter((i) => i.selected);
    const cols = barcodeColumns(j.elements, j.mapping, [...new Set(items.flatMap((i) => Object.keys(i.cells)))]);
    j.items.forEach((it, idx) => {
      if (!it.selected) return;
      for (const c of cols) {
        const v = (it.cells[c] ?? "").trim();
        if (v) seen.set(v, [...(seen.get(v) ?? []), `${j.label} · row ${idx + 1}`]);
      }
    });
  }
  return [...seen].filter(([, w]) => w.length > 1).map(([value, where]) => ({ column: "", value, rows: [], printing: where.length, where }));
}

/** Columns the label prints as barcode / QR; falls back to columns named like a barcode. */
export function barcodeColumns(elements: LabelElement[], mapping: Mapping, columns: string[]): string[] {
  const set = new Set<string>();
  for (const el of elements) {
    if (el.type !== "barcode" && el.type !== "qrcode") continue;
    for (const m of el.content.matchAll(PLACEHOLDER)) {
      const col = mapping[m[1]] ?? m[1];
      if (columns.includes(col)) set.add(col);
    }
  }
  if (!set.size) for (const c of columns) if (/barcode|ean|gtin|upc/i.test(c)) set.add(c);
  return [...set];
}

/** Same value in 2+ rows of a barcode column, where at least one of those rows is being printed. */
export function findDuplicates(rows: CopyRow[], cols: string[], isPrinting: (r: CopyRow) => boolean): DupGroup[] {
  const out: DupGroup[] = [];
  for (const column of cols) {
    const seen = new Map<string, { rows: number[]; printing: number }>();
    rows.forEach((r, i) => {
      const v = (r.cells[column] ?? "").trim();
      if (!v) return;
      const g = seen.get(v) ?? { rows: [], printing: 0 };
      g.rows.push(i + 1);
      if (isPrinting(r)) g.printing += 1;
      seen.set(v, g);
    });
    for (const [value, g] of seen) if (g.rows.length > 1 && g.printing > 0) out.push({ column, value, ...g });
  }
  return out;
}

/** `guard(groups, print)` prints straight away when there are no duplicates, otherwise asks first. */
export function useDuplicateGuard(): { guard: (groups: DupGroup[], print: () => void) => void; dialog: ReactNode } {
  const [pending, setPending] = useState<{ groups: DupGroup[]; print: () => void } | null>(null);
  const guard = (groups: DupGroup[], print: () => void) => (groups.length ? setPending({ groups, print }) : print());
  const dialog = (
    <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
      <DialogContent className="sm:max-w-lg" data-testid="duplicate-barcode-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-[#E09A00]" /> Duplicate barcode numbers</DialogTitle>
          <DialogDescription>
            {pending?.groups.length === 1 ? "One barcode number is" : `${pending?.groups.length} barcode numbers are`} used by more than one row. Scanners can't tell these products apart.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-64 gap-1.5 overflow-y-auto" data-testid="duplicate-barcode-list">
          {pending?.groups.slice(0, 50).map((g) => (
            <li key={`${g.column}:${g.value}`} className="rounded-md border border-[#FBD38D] bg-[#FFF8E6] px-3 py-2 text-xs text-[#7A4B00]">
              <span className="font-mono font-semibold text-[#1F2937]">{g.value}</span>
              {g.column && <span className="text-[#9CA3AF]"> · {g.column}</span>}
              {g.where ? (
                <div className="mt-0.5">in <b>{g.where.join("  ·  ")}</b></div>
              ) : (
                <div className="mt-0.5">in rows <b>{g.rows.join(", ")}</b>{g.printing < g.rows.length ? ` (${g.printing} being printed now)` : ""}</div>
              )}
            </li>
          ))}
          {(pending?.groups.length ?? 0) > 50 && <li className="text-xs text-[#6B7280]">…and {(pending?.groups.length ?? 0) - 50} more</li>}
        </ul>
        <p className="text-[11px] text-[#6B7280]">Tip: open the data page and use <b>Generate barcodes</b> on empty cells, or fix the numbers, then print again.</p>
        <DialogFooter>
          <Button variant="outline" data-testid="duplicate-cancel-button" onClick={() => setPending(null)}>Cancel — let me fix it</Button>
          <Button data-testid="duplicate-print-anyway-button" className="bg-[#E09A00] text-white hover:bg-[#B87F00]"
            onClick={() => { const p = pending; setPending(null); p?.print(); }}><Printer /> Print anyway</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { guard, dialog };
}
