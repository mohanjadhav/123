import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Barcode, Hash, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/api";
import type { BarcodeBatch, BarcodeCounter, BarcodeReserve, CopyRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const NEW_COL = "__new__";
const pad = (n: number, w: number) => String(n).padStart(w, "0");
const eanCheck = (d12: string) => String((10 - ([...d12].reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0) % 10)) % 10);

/** Fill EMPTY cells of a column (in the app's sheet copy only) with new serial or EAN-13 numbers. */
export function BarcodeGenerator({ open, onOpenChange, columns, rows, onApply }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  columns: string[];
  rows: CopyRow[];
  onApply: (column: string, isNew: boolean, values: Record<string, string>) => void;
}) {
  const guess = columns.find((c) => /barcode|ean|gtin|upc|code/i.test(c)) ?? NEW_COL;
  const [col, setCol] = useState<string | null>(null);
  const column = col ?? guess;
  const [newName, setNewName] = useState("Barcode");
  const [kind, setKind] = useState<BarcodeReserve["kind"]>("serial");
  const [prefix, setPrefix] = useState(kind === "serial" ? "HC-" : "890");
  const [digits, setDigits] = useState(6);
  const [start, setStart] = useState("");
  const [onlyTicked, setOnlyTicked] = useState(false);

  const counters = useQuery({ queryKey: ["barcode-counters"], queryFn: () => apiGet<BarcodeCounter[]>("/barcodes/counters"), enabled: open });
  const remembered = counters.data?.find((c) => c.key === `${kind}:${prefix.trim()}`)?.next ?? 1;
  const targetName = column === NEW_COL ? newName.trim() : column;
  const targets = rows.filter((r) => (!onlyTicked || r.selected) && !(column !== NEW_COL && (r.cells[column] ?? "").trim()));
  const first = start.trim() ? Math.max(0, parseInt(start, 10) || 0) : remembered;
  const eanOk = kind !== "ean13" || (/^\d{3,11}$/.test(prefix.trim()));
  const sample = (n: number) => kind === "ean13"
    ? (eanOk ? `${prefix.trim()}${pad(n, 12 - prefix.trim().length)}` + eanCheck(`${prefix.trim()}${pad(n, 12 - prefix.trim().length)}`) : "—")
    : `${prefix}${pad(n, digits)}`;

  const run = useMutation({
    mutationFn: () => apiPost<BarcodeBatch>("/barcodes/reserve", { kind, prefix: prefix.trim(), count: targets.length, digits, start: start.trim() ? first : null }),
    onSuccess: (b) => {
      const values = Object.fromEntries(targets.map((r, i) => [r.id, b.values[i]]));
      onApply(targetName, column === NEW_COL, values);
      toast.success(`Filled ${b.values.length} empty cell${b.values.length === 1 ? "" : "s"} in "${targetName}" — next number is ${b.next}`);
      setStart("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const blocked = !targets.length || !targetName || !eanOk || (column === NEW_COL && columns.includes(targetName));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="barcode-generator-dialog">
        <DialogHeader>
          <DialogTitle>Generate barcode numbers</DialogTitle>
          <DialogDescription>Fills only <b>empty</b> cells, in the app's copy of this sheet — your Google Sheet / file is never changed. The next number is remembered, so numbers never repeat.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-md border border-[#D1D5DB] p-0.5">
            {([["serial", "Serial number", <Hash key="h" />], ["ean13", "EAN-13 (retail)", <Barcode key="b" />]] as const).map(([k, label, icon]) => (
              <button key={k} data-testid={`barcode-kind-${k}`} onClick={() => { setKind(k); setPrefix(k === "serial" ? "HC-" : "890"); setStart(""); }}
                className={cn("flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors duration-150 [&_svg]:size-3.5", kind === k ? "bg-(--app-accent) text-white" : "text-[#374151] hover:bg-[#F3F4F6]")}>
                {icon}{label}
              </button>
            ))}
          </div>

          <label className="grid gap-1 text-xs text-[#4B5563]">Write into column
            <Select value={column} onValueChange={(v: string) => setCol(v)}>
              <SelectTrigger className="h-9 w-full" data-testid="barcode-column-select"><SelectValue>{(v: string) => (v === NEW_COL ? "+ New column" : v)}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_COL}>+ New column</SelectItem>
                {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          {column === NEW_COL && (
            <label className="grid gap-1 text-xs text-[#4B5563]">New column name
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="barcode-new-column-input" />
              {columns.includes(newName.trim()) && <span className="text-[#D93025]">That column already exists — pick it above instead.</span>}
            </label>
          )}

          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-2 grid gap-1 text-xs text-[#4B5563]">{kind === "ean13" ? "GS1 company prefix (digits)" : "Prefix"}
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} data-testid="barcode-prefix-input" className="font-mono" placeholder={kind === "ean13" ? "e.g. 8901234" : "e.g. HC-"} />
            </label>
            {kind === "serial" ? (
              <label className="grid gap-1 text-xs text-[#4B5563]">Digits
                <Input type="number" min={1} max={12} value={digits} onChange={(e) => setDigits(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)))} data-testid="barcode-digits-input" className="font-mono" />
              </label>
            ) : <div className="self-end pb-2 text-[10px] text-[#6B7280]">{eanOk ? `${12 - prefix.trim().length} item digits + check digit` : "3–11 digits"}</div>}
          </div>
          {kind === "ean13" && <p className="-mt-1 text-[10px] leading-snug text-[#9CA3AF]">India GS1 prefixes start with 890. Use the company prefix GS1 gave you so codes scan as your products.</p>}

          <label className="grid gap-1 text-xs text-[#4B5563]">Start at number
            <Input value={start} onChange={(e) => setStart(e.target.value.replace(/\D/g, ""))} placeholder={`${remembered} (remembered next number)`} data-testid="barcode-start-input" className="font-mono" />
          </label>

          <label className="flex items-center gap-2 text-xs text-[#374151]">
            <Checkbox checked={onlyTicked} onCheckedChange={(c) => setOnlyTicked(!!c)} data-testid="barcode-only-ticked" /> Only ticked rows
          </label>

          <div className="rounded-md border border-[#E5E7EB] bg-[#F8F9FB] p-3 text-xs text-[#374151]" data-testid="barcode-preview">
            {targets.length ? (
              <>Will fill <b>{targets.length}</b> empty cell{targets.length === 1 ? "" : "s"}: <span className="font-mono">{sample(first)}</span>
                {targets.length > 1 && <> … <span className="font-mono">{sample(first + targets.length - 1)}</span></>}</>
            ) : <>No empty cells to fill in “{targetName || "…"}”{onlyTicked ? " among ticked rows" : ""}.</>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="barcode-generate-button" disabled={blocked || run.isPending} onClick={() => run.mutate()} className="bg-(--app-accent) text-white hover:bg-(--app-accent-hover)">
            <Wand2 /> {run.isPending ? "Generating…" : `Generate ${targets.length || ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
