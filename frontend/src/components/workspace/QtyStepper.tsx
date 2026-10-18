import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** − [qty] + control. `auto` styles it as coming from the sheet's quantity column. */
export function QtyStepper({ value, onChange, testId, auto }: { value: number; onChange: (n: number) => void; testId: string; auto?: boolean }) {
  const btn = "grid size-5 shrink-0 place-items-center rounded text-[#6B7280] transition-colors duration-150 hover:bg-(--app-accent-soft) hover:text-(--app-accent) disabled:opacity-30 [&_svg]:size-3";
  return (
    <div className="flex max-w-24 items-center gap-0.5" data-testid={testId}>
      <button type="button" className={btn} data-testid={`${testId}-minus`} disabled={value <= 0} onClick={() => onChange(value - 1)} title="One less"><Minus /></button>
      <input type="number" min={0} data-testid={`${testId}-input`} value={value || ""} placeholder="0"
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className={cn("h-6 w-full min-w-0 rounded border border-transparent bg-transparent px-1 text-center font-mono text-xs outline-none [appearance:textfield] focus:border-(--app-accent) focus:bg-white [&::-webkit-inner-spin-button]:appearance-none",
          auto && "font-semibold text-(--app-accent)")} />
      <button type="button" className={btn} data-testid={`${testId}-plus`} onClick={() => onChange(value + 1)} title="One more"><Plus /></button>
    </div>
  );
}
