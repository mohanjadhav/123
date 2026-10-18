import { useLayoutEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import type { BarcodeFormat } from "@/lib/types";

/**
 * Vector barcode. With a printer `dpi` (203/300/600) each bar module is snapped to a whole number of
 * printer dots, so thermal printers render perfectly sharp, scannable bars (no blurred / uneven bars).
 */
export function BarcodeSvg({ value, format, showText, widthMm = 0, dpi = 0 }: { value: string; format: BarcodeFormat; showText: boolean; widthMm?: number; dpi?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [error, setError] = useState(false);
  const [modules, setModules] = useState(0);

  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg || !value) return;
    try {
      JsBarcode(svg, value, { format, displayValue: false, margin: 0, height: 100, width: 1, background: "transparent" });
      const w = svg.getAttribute("width") ?? "100";
      const h = svg.getAttribute("height") ?? "100";
      svg.setAttribute("viewBox", `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("shape-rendering", "crispEdges");
      setModules(parseFloat(w));
      setError(false);
    } catch {
      setError(true);
    }
  }, [value, format]);

  if (!value || error) {
    return (
      <div className="flex h-full w-full items-center justify-center border border-dashed border-red-400 text-[6pt] text-red-500">
        {value ? `Invalid ${format}` : "No value"}
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex min-h-0 flex-1 justify-center">
        <svg ref={ref} className="block h-full" style={{ width: snapWidth(widthMm, modules, dpi) ?? "100%" }} />
      </div>
      {showText && (
        <div className="text-center leading-none" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "6.5pt", paddingTop: "0.6mm" }}>
          {value}
        </div>
      )}
    </div>
  );
}

/** Barcode width (mm) rounded down to whole printer dots per module; null = fill the box. */
function snapWidth(widthMm: number, modules: number, dpi: number): string | null {
  if (!dpi || !widthMm || !modules) return null;
  const dot = 25.4 / dpi;
  const dotsPerModule = Math.max(1, Math.floor(widthMm / modules / dot));
  return `${dotsPerModule * dot * modules}mm`;
}

export function QrSvg({ value, color }: { value: string; color: string }) {
  const path = useMemo(() => {
    if (!value) return null;
    try {
      const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
      const size = qr.modules.size;
      let d = "";
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) if (qr.modules.data[y * size + x]) d += `M${x} ${y}h1v1h-1z`;
      return { d, size };
    } catch {
      return null;
    }
  }, [value]);
  if (!path) {
    return (
      <div className="flex h-full w-full items-center justify-center border border-dashed border-red-400 text-[6pt] text-red-500">
        No QR value
      </div>
    );
  }
  return (
    <svg viewBox={`0 0 ${path.size} ${path.size}`} className="block h-full w-full" shapeRendering="crispEdges">
      <path d={path.d} fill={color} />
    </svg>
  );
}
