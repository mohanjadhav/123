import { useLayoutEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import type { BarcodeFormat } from "@/lib/types";

export function BarcodeSvg({ value, format, showText }: { value: string; format: BarcodeFormat; showText: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [error, setError] = useState(false);

  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg || !value) return;
    try {
      JsBarcode(svg, value, { format, displayValue: false, margin: 0, height: 100, width: 2, background: "transparent" });
      const w = svg.getAttribute("width") ?? "100";
      const h = svg.getAttribute("height") ?? "100";
      svg.setAttribute("viewBox", `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("preserveAspectRatio", "none");
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
      <div className="min-h-0 flex-1">
        <svg ref={ref} className="block h-full w-full" />
      </div>
      {showText && (
        <div className="text-center leading-none" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "6.5pt", paddingTop: "0.6mm" }}>
          {value}
        </div>
      )}
    </div>
  );
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
