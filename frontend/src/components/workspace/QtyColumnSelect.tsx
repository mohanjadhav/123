import { Hash } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { suggestQtyColumn } from "@/lib/grid";
import { cn } from "@/lib/utils";

const MANUAL = "__manual__";

/** Choose where each row's print quantity comes from: typed manually, or a sheet column (e.g. "PRINT QTY"). */
export function QtyColumnSelect({ columns, value, onChange, testId = "qty-column-select", className }: {
  columns: string[];
  value: string | null;
  onChange: (col: string | null) => void;
  testId?: string;
  className?: string;
}) {
  const suggested = suggestQtyColumn(columns);
  const missing = !!value && !columns.includes(value);
  return (
    <Select value={value ?? MANUAL} onValueChange={(v: string) => onChange(v === MANUAL ? null : v)}>
      <SelectTrigger size="sm" data-testid={testId} title="Where each row's number of labels comes from"
        className={cn("h-7 w-52 bg-white text-xs", value && !missing && "border-(--app-accent) text-(--app-accent)", missing && "border-[#D93025] text-[#D93025]", className)}>
        <Hash className="size-3.5" />
        <SelectValue>{(v) => (v === MANUAL ? "Qty: typed manually" : `Qty from: ${v as string}${missing ? " (missing)" : ""}`)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={MANUAL}>Qty: typed manually</SelectItem>
        {columns.map((c) => (
          <SelectItem key={c} value={c}>
            Qty from column: {c}{c === suggested ? "  ★ suggested" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
