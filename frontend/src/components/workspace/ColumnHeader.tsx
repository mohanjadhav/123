import type { PointerEvent as ReactPointerEvent } from "react";

export function ColumnHeader({ col, onResizeStart, onAutoFit }: {
  col: string;
  onResizeStart: (e: ReactPointerEvent<HTMLElement>, col: string) => void;
  onAutoFit: (col: string) => void;
}) {
  return (
    <th data-testid={`grid-col-header-${col}`} title={col} className="relative truncate border-b border-r border-[#E5E7EB] px-2 py-1.5 font-semibold">
      {col}
      <span
        data-testid={`grid-col-resize-${col}`}
        title="Drag to resize · double-click to auto-fit"
        onPointerDown={(e) => onResizeStart(e, col)}
        onDoubleClick={() => onAutoFit(col)}
        className="absolute right-0 top-0 z-10 h-full w-2.5 cursor-col-resize touch-none after:absolute after:right-0.5 after:top-1/4 after:h-1/2 after:w-0.5 after:rounded after:bg-[#C7CCD3] after:transition-colors after:duration-150 hover:after:bg-(--app-accent)"
      />
    </th>
  );
}
