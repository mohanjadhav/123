import type { LabelElement } from "@/lib/types";

export type AlignKind = "left" | "hcenter" | "right" | "top" | "vmiddle" | "bottom";
type Box = { l: number; t: number; r: number; b: number };
type Patches = Record<string, Partial<LabelElement>>;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function bbox(els: Pick<LabelElement, "x" | "y" | "w" | "h">[]): Box {
  return {
    l: Math.min(...els.map((e) => e.x)), t: Math.min(...els.map((e) => e.y)),
    r: Math.max(...els.map((e) => e.x + e.w)), b: Math.max(...els.map((e) => e.y + e.h)),
  };
}

/** One element aligns to the label; several align to their combined box. */
export function alignEls(els: LabelElement[], kind: AlignKind, label: { width_mm: number; height_mm: number }): Patches {
  if (!els.length) return {};
  const box = els.length === 1 ? { l: 0, t: 0, r: label.width_mm, b: label.height_mm } : bbox(els);
  const out: Patches = {};
  for (const e of els) {
    out[e.id] = {
      left: { x: box.l }, right: { x: box.r - e.w }, hcenter: { x: (box.l + box.r) / 2 - e.w / 2 },
      top: { y: box.t }, bottom: { y: box.b - e.h }, vmiddle: { y: (box.t + box.b) / 2 - e.h / 2 },
    }[kind];
    for (const k of ["x", "y"] as const) if (out[e.id][k] !== undefined) out[e.id][k] = r2(out[e.id][k]!);
  }
  return out;
}

/** Equal gaps between 3+ elements, keeping the first and last in place. */
export function distributeEls(els: LabelElement[], axis: "h" | "v"): Patches {
  if (els.length < 3) return {};
  const pos = axis === "h" ? "x" : "y";
  const size = axis === "h" ? "w" : "h";
  const sorted = [...els].sort((a, b) => a[pos] - b[pos]);
  const first = sorted[0], last = sorted[sorted.length - 1];
  const span = last[pos] + last[size] - first[pos];
  const gap = (span - sorted.reduce((s, e) => s + e[size], 0)) / (sorted.length - 1);
  const out: Patches = {};
  let cur = first[pos];
  for (const e of sorted) {
    out[e.id] = { [pos]: r2(cur) };
    cur += e[size] + gap;
  }
  return out;
}

/**
 * Snap a moving box to the label edges/centre and to other elements' edges/centres.
 * Returns the corrected offset and the guide lines to draw (mm).
 */
export function snapBox(box: Box, others: Box[], label: { width_mm: number; height_mm: number }, threshold: number) {
  const xs = [0, label.width_mm / 2, label.width_mm, ...others.flatMap((o) => [o.l, (o.l + o.r) / 2, o.r])];
  const ys = [0, label.height_mm / 2, label.height_mm, ...others.flatMap((o) => [o.t, (o.t + o.b) / 2, o.b])];
  const best = (edges: number[], lines: number[]) => {
    let hit: { d: number; line: number } | null = null;
    for (const e of edges) for (const l of lines) {
      const d = l - e;
      if (Math.abs(d) <= threshold && (!hit || Math.abs(d) < Math.abs(hit.d))) hit = { d, line: l };
    }
    return hit;
  };
  const hx = best([box.l, (box.l + box.r) / 2, box.r], xs);
  const hy = best([box.t, (box.t + box.b) / 2, box.b], ys);
  return { dx: hx?.d ?? null, dy: hy?.d ?? null, gx: hx ? [hx.line] : [], gy: hy ? [hy.line] : [] };
}

/** Snap a single edge value (resize) to the same guide lines. */
export function snapEdge(value: number, lines: number[], threshold: number) {
  let hit: number | null = null;
  for (const l of lines) if (Math.abs(l - value) <= threshold && (hit === null || Math.abs(l - value) < Math.abs(hit - value))) hit = l;
  return hit;
}

export const intersects = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
