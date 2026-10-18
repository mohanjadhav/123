import { useState } from "react";
import { Check, Minus, Moon, Palette, Plus, RotateCcw, Sun } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyPrefs, clampZoom, DEFAULT_PREFS, loadPrefs, THEMES, UI_FONTS } from "@/lib/theme";
import type { Prefs } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Appearance: light/dark, accent colour (presets + custom), UI font, and whole-app size. */
export function ThemePicker() {
  const [p, setP] = useState<Prefs>(loadPrefs);
  const set = (patch: Partial<Prefs>) => setP((cur) => { const next = { ...cur, ...patch }; applyPrefs(next); return next; });
  const seg = (on: boolean) => cn("flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors duration-150",
    on ? "bg-(--app-accent) text-white" : "text-[#374151] hover:bg-[#F3F4F6]");

  return (
    <Popover>
      <PopoverTrigger data-testid="theme-picker-button" title="Appearance: theme, dark mode, font, size"
        className="flex h-8 shrink-0 items-center gap-1.5 rounded px-2.5 text-[13px] text-[#1F2937] transition-colors duration-150 hover:bg-[#EEF0F3] [&_svg]:size-4">
        <Palette className="text-(--app-accent)" />
        <span className="hidden 2xl:inline">Appearance</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4" data-testid="theme-picker-panel">
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <p className="text-xs font-semibold text-[#1F2937]">Mode</p>
            <div className="flex gap-1 rounded-md border border-[#D1D5DB] p-0.5">
              <button className={seg(p.mode === "light")} data-testid="theme-mode-light" onClick={() => set({ mode: "light" })}><Sun className="size-3.5" /> Light</button>
              <button className={seg(p.mode === "dark")} data-testid="theme-mode-dark" onClick={() => set({ mode: "dark" })}><Moon className="size-3.5" /> Dark</button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <p className="text-xs font-semibold text-[#1F2937]">Colour theme</p>
            <div className="grid grid-cols-7 gap-1.5">
              {THEMES.map((t) => (
                <button key={t.key} data-testid={`theme-option-${t.key}`} onClick={() => set({ theme: t.key })} title={t.name}
                  className={cn("true-color grid size-8 place-items-center rounded-full ring-offset-2 transition-transform duration-150 hover:scale-110", p.theme === t.key && "ring-2 ring-[#1F2937]")}
                  style={{ background: t.color }}>
                  {p.theme === t.key && <Check className="size-3.5 text-white" />}
                </button>
              ))}
              <label title="Custom colour" data-testid="theme-option-custom"
                className={cn("relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-[#9CA3AF] ring-offset-2", p.theme === "custom" && "ring-2 ring-[#1F2937]")}>
                <span className="true-color absolute inset-1 rounded-full" style={{ background: p.custom }} />
                <Plus className="relative size-3.5 text-white mix-blend-difference" />
                <input type="color" data-testid="theme-custom-color" value={p.custom} onChange={(e) => set({ theme: "custom", custom: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
            </div>
          </div>

          <div className="grid gap-1.5">
            <p className="text-xs font-semibold text-[#1F2937]">Font</p>
            <Select value={p.font} onValueChange={(v: string) => set({ font: v })}>
              <SelectTrigger className="h-8 w-full" data-testid="theme-font-select"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(UI_FONTS).map((f) => <SelectItem key={f} value={f}><span style={{ fontFamily: UI_FONTS[f] }}>{f}</span></SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <p className="text-xs font-semibold text-[#1F2937]">App size (fit more on screen)</p>
            <div className="flex items-center gap-2">
              <button data-testid="theme-zoom-out" onClick={() => set({ zoom: clampZoom(p.zoom - 0.05) })} disabled={p.zoom <= 0.7}
                className="grid size-8 place-items-center rounded border border-[#D1D5DB] hover:bg-[#F3F4F6] disabled:opacity-40"><Minus className="size-3.5" /></button>
              <input type="range" min={0.7} max={1.4} step={0.05} value={p.zoom} data-testid="theme-zoom-slider" onChange={(e) => set({ zoom: clampZoom(parseFloat(e.target.value)) })}
                className="flex-1 accent-(--app-accent)" />
              <button data-testid="theme-zoom-in" onClick={() => set({ zoom: clampZoom(p.zoom + 0.05) })} disabled={p.zoom >= 1.4}
                className="grid size-8 place-items-center rounded border border-[#D1D5DB] hover:bg-[#F3F4F6] disabled:opacity-40"><Plus className="size-3.5" /></button>
              <span className="w-11 text-right font-mono text-xs" data-testid="theme-zoom-value">{Math.round(p.zoom * 100)}%</span>
            </div>
          </div>

          <button data-testid="theme-reset" onClick={() => set(DEFAULT_PREFS)} className="flex items-center gap-1.5 justify-self-start text-xs text-[#6B7280] hover:text-[#1F2937]">
            <RotateCcw className="size-3" /> Reset appearance
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
