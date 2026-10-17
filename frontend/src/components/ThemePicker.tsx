import { useState } from "react";
import { Check, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { applyTheme, getTheme, THEMES } from "@/lib/theme";
import type { ThemeKey } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeKey>(getTheme);
  const pick = (k: ThemeKey) => { applyTheme(k); setTheme(k); };
  return (
    <Popover>
      <PopoverTrigger
        data-testid="theme-picker-button"
        title="Colour theme"
        className="flex h-8 items-center gap-1.5 rounded px-2.5 text-[13px] text-[#1F2937] transition-colors duration-150 hover:bg-[#EEF0F3] [&_svg]:size-4"
      >
        <Palette className="text-(--app-accent)" />
        <span className="hidden xl:inline">Theme</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3" data-testid="theme-picker-panel">
        <p className="mb-2 text-xs font-semibold text-[#1F2937]">Colour theme</p>
        <div className="grid grid-cols-4 gap-2">
          {THEMES.map((t) => (
            <button key={t.key} data-testid={`theme-option-${t.key}`} onClick={() => pick(t.key)} title={t.name}
              className="group grid justify-items-center gap-1 text-[10px] text-[#4B5563]">
              <span className={cn("grid size-9 place-items-center rounded-full ring-offset-2 transition-[box-shadow,transform] duration-150 group-hover:scale-105",
                theme === t.key && "ring-2 ring-[#1F2937]")} style={{ background: t.color }}>
                {theme === t.key && <Check className="size-4 text-white" />}
              </span>
              <span className="w-full truncate text-center">{t.name.split(" ").pop()}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
