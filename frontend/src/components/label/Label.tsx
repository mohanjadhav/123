import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { FONTS, interpolate, MM_TO_PX } from "@/lib/label";
import type { BarcodeFormat, LabelElement, LabelShape, Mapping, Row } from "@/lib/types";
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
}

function ElementBody({ el, row, mapping }: ElementProps) {
  let value = interpolate(el.content, row, mapping);
  if (el.type === "barcode" && value.includes("{{")) value = SAMPLE_BARCODE[el.barcode_format]; // raw/template preview
  switch (el.type) {
    case "text":
      return (
        <div
          className="h-full w-full overflow-hidden whitespace-pre-wrap break-words leading-[1.15]"
          style={{
            fontFamily: FONTS[el.font_family] ?? el.font_family,
            fontSize: `${el.font_size}pt`,
            fontWeight: el.font_weight,
            fontStyle: el.italic ? "italic" : undefined,
            textDecoration: [el.underline && "underline", el.strike && "line-through"].filter(Boolean).join(" ") || undefined,
            textAlign: el.align,
            color: el.color,
          }}
        >
          {value}
        </div>
      );
    case "barcode":
      return <BarcodeSvg value={value} format={el.barcode_format} showText={el.show_text} />;
    case "qrcode":
      return <QrSvg value={value} color={el.color} />;
    case "rect":
      return null;
    case "image": {
      const src = interpolate(el.image_url, row, mapping);
      return src ? (
        <img src={src} alt="" className="h-full w-full object-contain" draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center border border-dashed border-neutral-400 text-[6pt] text-neutral-500">
          Image
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
  };
  if (el.type === "rect" || el.type === "text") {
    style.background = el.fill;
    style.border = el.stroke_width > 0 ? `${el.stroke_width}mm solid ${el.stroke}` : undefined;
    style.borderRadius = `${el.radius}mm`;
  }
  return style;
}

interface LabelProps {
  template: LabelShape;
  row?: Row | null;
  mapping?: Mapping;
  renderElement?: (el: LabelElement, body: ReactNode) => ReactNode;
  onBackgroundPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  testId?: string;
}

/** Renders a label at true physical size (mm units). Wrap in <Scaled> for on-screen zoom. */
export function Label({ template, row = null, mapping = {}, renderElement, onBackgroundPointerDown, testId }: LabelProps) {
  return (
    <div
      data-testid={testId}
      onPointerDown={onBackgroundPointerDown}
      className="true-color relative overflow-hidden"
      style={{ width: `${template.width_mm}mm`, height: `${template.height_mm}mm`, background: template.background, color: "#0F0F10" }}
    >
      {template.elements.map((el) => {
        const body = <ElementBody el={el} row={row} mapping={mapping} />;
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
