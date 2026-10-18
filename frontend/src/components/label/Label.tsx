import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { FONTS, interpolate, MM_TO_PX } from "@/lib/label";
import { iconByKey } from "@/lib/icons";
import type { BarcodeFormat, LabelElement, LabelShape, Mapping, Row, StrokeStyle } from "@/lib/types";
import { BarcodeSvg, QrSvg } from "@/components/label/Codes";

const SAMPLE_BARCODE: Record<BarcodeFormat, string> = {
  CODE128: "SAMPLE-0001",
  CODE39: "SAMPLE01",
  EAN13: "5901234123457",
  UPC: "123456789999",
  ITF14: "15400141288763",
};

interface ElementProps {
  el: LabelElement;
  row: Row | null;
  mapping: Mapping;
  dpi: number;
}

/** CSS background for a solid or gradient fill. */
export const paint = (fill: string, fill2?: string, angle = 90) =>
  fill2 ? `linear-gradient(${angle}deg, ${fill === "transparent" ? "#FFFFFF" : fill}, ${fill2})` : fill;

/** SVG dash pattern (mm units) for a stroke width. */
const dash = (style: StrokeStyle | undefined, sw: number) =>
  style === "dashed" ? `${sw * 3} ${sw * 2}` : style === "dotted" ? `0 ${sw * 2}` : undefined;

function shapeGeometry(kind: LabelElement["shape"], w: number, h: number, s: number): ReactNode {
  const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(" ");
  switch (kind) {
    case "ellipse":
      return <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - s)} ry={Math.max(0, h / 2 - s)} />;
    case "triangle":
      return <polygon points={pts([[w / 2, s], [w - s, h - s], [s, h - s]])} />;
    case "diamond":
      return <polygon points={pts([[w / 2, s], [w - s, h / 2], [w / 2, h - s], [s, h / 2]])} />;
    case "hexagon":
      return <polygon points={pts([[w * 0.25, s], [w * 0.75, s], [w - s, h / 2], [w * 0.75, h - s], [w * 0.25, h - s], [s, h / 2]])} />;
    case "arrow":
      return <polygon points={pts([[s, h * 0.3], [w * 0.6, h * 0.3], [w * 0.6, s], [w - s, h / 2], [w * 0.6, h - s], [w * 0.6, h * 0.7], [s, h * 0.7]])} />;
    case "star": {
      const p: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = (-90 + i * 36) * (Math.PI / 180);
        const k = i % 2 ? 0.45 : 1;
        p.push([w / 2 + Math.cos(a) * (w / 2 - s) * k, h / 2 + Math.sin(a) * (h / 2 - s) * k]);
      }
      return <polygon points={pts(p)} />;
    }
    default:
      return null;
  }
}

/** Vector shape drawn in mm units so strokes print exactly at their mm thickness. */
function ShapeSvg({ el }: { el: LabelElement }) {
  const sw = el.stroke_width;
  const gid = `g-${el.id}`;
  const a = ((el.gradient_angle ?? 90) - 90) * (Math.PI / 180);
  return (
    <svg viewBox={`0 0 ${el.w} ${el.h}`} width="100%" height="100%" className="block overflow-visible">
      {el.fill2 && (
        <defs>
          <linearGradient id={gid} x1={0.5 - Math.cos(a) / 2} y1={0.5 - Math.sin(a) / 2} x2={0.5 + Math.cos(a) / 2} y2={0.5 + Math.sin(a) / 2}>
            <stop offset="0" stopColor={el.fill === "transparent" ? "#FFFFFF" : el.fill} /><stop offset="1" stopColor={el.fill2} />
          </linearGradient>
        </defs>
      )}
      <g fill={el.fill2 ? `url(#${gid})` : el.fill === "transparent" ? "none" : el.fill} stroke={sw > 0 ? el.stroke : "none"} strokeWidth={sw}
        strokeDasharray={dash(el.stroke_style, sw)} strokeLinecap={el.stroke_style === "dotted" ? "round" : "butt"} strokeLinejoin="round">
        {shapeGeometry(el.shape, el.w, el.h, sw / 2)}
      </g>
    </svg>
  );
}

/** Straight line across the box centre (rotate the element for any direction), optional arrowheads. */
function LineSvg({ el }: { el: LabelElement }) {
  const sw = Math.max(0.05, el.stroke_width);
  const head = Math.min(el.w / 3, Math.max(sw * 4, 1.2));
  const y = el.h / 2;
  const x0 = el.arrows === "both" ? head : 0;
  const x1 = el.arrows === "none" ? el.w : el.w - head;
  const tri = (tip: number, dir: 1 | -1) => `${tip},${y} ${tip - dir * head},${y - head * 0.6} ${tip - dir * head},${y + head * 0.6}`;
  return (
    <svg viewBox={`0 0 ${el.w} ${el.h}`} width="100%" height="100%" className="block overflow-visible">
      <line x1={x0} y1={y} x2={x1} y2={y} stroke={el.stroke} strokeWidth={sw} strokeDasharray={dash(el.stroke_style, sw)}
        strokeLinecap={el.stroke_style === "dotted" ? "round" : "butt"} />
      {el.arrows !== "none" && <polygon points={tri(el.w, 1)} fill={el.stroke} />}
      {el.arrows === "both" && <polygon points={tri(0, -1)} fill={el.stroke} />}
    </svg>
  );
}

const textStyle = (el: LabelElement): CSSProperties => ({
  fontFamily: FONTS[el.font_family] ?? el.font_family,
  fontSize: `${el.font_size}pt`,
  fontWeight: el.font_weight,
  fontStyle: el.italic ? "italic" : undefined,
  textDecoration: [el.underline && "underline", el.strike && "line-through"].filter(Boolean).join(" ") || undefined,
  textAlign: el.align,
  color: el.color,
});

/** Grid table: rows = lines of `content`, cells split by "|". Supports {{fields}} in any cell. */
function TableBody({ el, row, mapping }: Omit<ElementProps, "dpi">) {
  const lines = el.content.split("\n");
  const border = el.stroke_width > 0 ? `${el.stroke_width}mm ${el.stroke_style ?? "solid"} ${el.stroke}` : undefined;
  const rows = Math.max(1, el.table_rows ?? 3);
  const cols = Math.max(1, el.table_cols ?? 2);
  return (
    <div className="grid h-full w-full overflow-hidden leading-[1.1]" style={{ ...textStyle(el), gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, borderTop: border, borderLeft: border }}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols);
        const cell = (lines[r] ?? "").split("|")[i % cols] ?? "";
        const head = el.table_header && r === 0;
        return (
          <div key={i} className="flex items-center overflow-hidden px-[0.6mm]"
            style={{ borderRight: border, borderBottom: border, justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
              background: head ? paint(el.fill, el.fill2, el.gradient_angle) : undefined, fontWeight: head ? 700 : undefined }}>
            <span className="truncate">{interpolate(cell.trim(), row, mapping)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ElementBody({ el, row, mapping, dpi }: ElementProps) {
  let value = interpolate(el.content, row, mapping);
  if (el.type === "barcode" && value.includes("{{")) value = SAMPLE_BARCODE[el.barcode_format]; // raw/template preview
  switch (el.type) {
    case "text":
      return <div className="h-full w-full overflow-hidden whitespace-pre-wrap break-words leading-[1.15]" style={textStyle(el)}>{value}</div>;
    case "barcode":
      return <BarcodeSvg value={value} format={el.barcode_format} showText={el.show_text} widthMm={el.w} dpi={dpi} />;
    case "qrcode":
      return <QrSvg value={value} color={el.color} />;
    case "rect":
      return el.shape && el.shape !== "rect" ? <ShapeSvg el={el} /> : null;
    case "line":
      return <LineSvg el={el} />;
    case "icon": {
      const icon = iconByKey(el.icon);
      return icon ? <>{icon.render(el.color)}</> : <div className="grid h-full w-full place-items-center border border-dashed border-neutral-400 text-[6pt] text-neutral-500">Icon</div>;
    }
    case "table":
      return <TableBody el={el} row={row} mapping={mapping} />;
    case "image": {
      const src = interpolate(el.image_url, row, mapping);
      return src && !src.includes("{{") ? (
        <img src={src} alt="" className="block h-full w-full" style={{ objectFit: el.image_fit ?? "contain", imageRendering: "auto" }} draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center border border-dashed border-neutral-400 text-[6pt] text-neutral-500">
          {src.includes("{{") ? src : "Image"}
        </div>
      );
    }
  }
}

export function elementBoxStyle(el: LabelElement): CSSProperties {
  const style: CSSProperties = {
    position: "absolute",
    left: `${el.x}mm`,
    top: `${el.y}mm`,
    width: `${el.w}mm`,
    height: `${el.h}mm`,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    opacity: (el.opacity ?? 1) < 1 ? el.opacity : undefined,
  };
  if ((el.type === "rect" && (!el.shape || el.shape === "rect")) || el.type === "text") {
    style.background = paint(el.fill, el.fill2, el.gradient_angle);
    style.border = el.stroke_width > 0 ? `${el.stroke_width}mm ${el.stroke_style ?? "solid"} ${el.stroke}` : undefined;
    style.borderRadius = `${el.radius}mm`;
  }
  return style;
}

interface LabelProps {
  template: LabelShape;
  row?: Row | null;
  mapping?: Mapping;
  dpi?: number;
  renderElement?: (el: LabelElement, body: ReactNode) => ReactNode;
  onBackgroundPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  testId?: string;
}

/** Renders a label at true physical size (mm units). Wrap in <Scaled> for on-screen zoom. */
export function Label({ template, row = null, mapping = {}, dpi = 0, renderElement, onBackgroundPointerDown, testId }: LabelProps) {
  const bg = template.background_image ? interpolate(template.background_image, row, mapping) : "";
  return (
    <div
      data-testid={testId}
      onPointerDown={onBackgroundPointerDown}
      className="true-color relative overflow-hidden"
      style={{ width: `${template.width_mm}mm`, height: `${template.height_mm}mm`, background: template.background, color: "#0F0F10" }}
    >
      {bg && !bg.includes("{{") && (
        <img src={bg} alt="" draggable={false} data-testid="label-background-image" className="pointer-events-none absolute inset-0 block h-full w-full"
          style={{ objectFit: template.background_fit ?? "cover", opacity: template.background_opacity ?? 1 }} />
      )}
      {template.elements.map((el) => {
        const body = <ElementBody el={el} row={row} mapping={mapping} dpi={dpi} />;
        return renderElement ? (
          renderElement(el, body)
        ) : (
          <div key={el.id} style={elementBoxStyle(el)}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Scales physical-mm content for screen; reserves the scaled box in layout. */
export function Scaled({ widthMm, heightMm, scale, children, className }: {
  widthMm: number;
  heightMm: number;
  scale: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className} style={{ width: widthMm * MM_TO_PX * scale, height: heightMm * MM_TO_PX * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: `${widthMm}mm`, height: `${heightMm}mm` }}>
        {children}
      </div>
    </div>
  );
}
