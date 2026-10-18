import { useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CopyRow, Row } from "@/lib/types";

export const MIN_COL_W = 56;
const MAX_AUTO_W = 360;
let measureCtx: CanvasRenderingContext2D | null = null;

/** Real rendered width of the header + every value in each column (grid font), so columns size to content. */
export function measureWidths(columns: string[], rows: Row[]): Record<string, number> {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  const ctx = measureCtx;
  const out: Record<string, number> = {};
  for (const c of columns) {
    let w: number;
    if (!ctx) {
      w = Math.max(c.length * 8.5, ...rows.slice(0, 500).map((r) => (r[c] ?? "").length * 7));
    } else {
      ctx.font = "600 12px 'IBM Plex Sans', sans-serif";
      w = ctx.measureText(c).width + 8; // room for the resize grip
      ctx.font = "400 12px 'IBM Plex Sans', sans-serif";
      const seen = new Set<string>();
      for (const r of rows.slice(0, 5000)) {
        const v = r[c] ?? "";
        if (!v || seen.has(v)) continue;
        seen.add(v);
        w = Math.max(w, ctx.measureText(v).width);
      }
    }
    out[c] = Math.max(MIN_COL_W, Math.min(MAX_AUTO_W, Math.ceil(w + 18)));
  }
  return out;
}

/** Auto (content-measured) widths + user drag overrides. */
export function useColumnWidths(columns: string[], rows: Row[]) {
  const [manual, setManual] = useState<Record<string, number>>({});
  const auto = useMemo(() => measureWidths(columns, rows), [columns, rows]);
  const widthOf = (c: string) => manual[c] ?? auto[c] ?? 120;
  const startResize = (e: ReactPointerEvent<HTMLElement>, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widthOf(col);
    const onMove = (ev: PointerEvent) => setManual((w) => ({ ...w, [col]: Math.max(MIN_COL_W, Math.round(startW + ev.clientX - startX)) }));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const autoFit = (col: string) => setManual(({ [col]: _drop, ...rest }) => rest);
  return { widthOf, startResize, autoFit };
}

/** Labels to print for a row: from the quantity column when set ("2", "2.0", "1,000"), else the manual qty. Blank/0 = none. */
export function rowQty(r: CopyRow, qtyColumn: string | null | undefined): number {
  if (!qtyColumn) return r.qty;
  const n = Math.floor(parseFloat((r.cells[qtyColumn] ?? "").replace(/,/g, "").trim()));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 9999) : 0;
}

/** Labels for every ticked row, repeated by its quantity. */
export function expandRows(rows: CopyRow[], qtyColumn: string | null | undefined): Row[] {
  return rows.flatMap((r) => (r.selected ? Array.from({ length: rowQty(r, qtyColumn) }, () => r.cells) : []));
}

const QTY_HINT = /(qty|quantity|copies|print|labels?|nos|count|pcs)/i;
export const suggestQtyColumn = (columns: string[]) => columns.find((c) => QTY_HINT.test(c)) ?? null;

// ---- Tick rules: a row is ticked only when it has a quantity > 0.
/** Re-tick every row from its quantity (used when the quantity source changes). */
export const tickByQty = (rows: CopyRow[], qtyColumn: string | null): CopyRow[] =>
  rows.map((r) => ({ ...r, selected: rowQty(r, qtyColumn) > 0 }));
/** Manual quantity typed: > 0 ticks, 0 unticks. */
export const withManualQty = (r: CopyRow, qty: number): CopyRow => ({ ...r, qty, selected: qty > 0 });
/** Tick/untick by hand; ticking a row with qty 0 makes it 1 (manual or quantity column) so it prints. */
export const withTick = (r: CopyRow, on: boolean, qtyColumn: string | null): CopyRow =>
  on && rowQty(r, qtyColumn) < 1 ? withQty(r, 1, qtyColumn) : { ...r, selected: on };

/** Set a row's print quantity by hand. With a quantity column, the number is written into that column's cell
 *  (in the app's copy only — the Google Sheet is untouched); otherwise into the manual qty. Re-ticks the row. */
export function withQty(r: CopyRow, qty: number, qtyColumn: string | null): CopyRow {
  const n = Math.max(0, Math.min(9999, Math.floor(qty) || 0));
  if (!qtyColumn) return withManualQty(r, n);
  return { ...r, cells: { ...r.cells, [qtyColumn]: String(n) }, selected: n > 0 };
}
