import { useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Row } from "@/lib/types";

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
