export const THEMES = [
  { key: "blue", name: "Ocean Blue", color: "#1A73E8" },
  { key: "indigo", name: "Indigo", color: "#3F51B5" },
  { key: "cyan", name: "Cyan", color: "#0097A7" },
  { key: "teal", name: "Teal", color: "#00897B" },
  { key: "emerald", name: "Emerald", color: "#0F9D58" },
  { key: "lime", name: "Olive", color: "#689F38" },
  { key: "amber", name: "Amber", color: "#E09A00" },
  { key: "orange", name: "Sunset Orange", color: "#E8710A" },
  { key: "red", name: "Crimson", color: "#D93025" },
  { key: "pink", name: "Rose Pink", color: "#D81B60" },
  { key: "purple", name: "Royal Purple", color: "#7E57C2" },
  { key: "brown", name: "Coffee", color: "#795548" },
  { key: "graphite", name: "Graphite", color: "#374151" },
] as const;

export const UI_FONTS: Record<string, string> = {
  "IBM Plex Sans": "'IBM Plex Sans', sans-serif",
  Geist: "'Geist Variable', sans-serif",
  "DM Sans": "'DM Sans Variable', sans-serif",
  "Space Grotesk": "'Space Grotesk Variable', sans-serif",
  "IBM Plex Mono": "'IBM Plex Mono', monospace",
  Lora: "'Lora Variable', serif",
};

export interface Prefs {
  theme: string; // a THEMES key or "custom"
  custom: string; // custom accent colour
  mode: "light" | "dark";
  font: string; // UI_FONTS key
  zoom: number; // whole-app size, 0.7 – 1.4
}

export const DEFAULT_PREFS: Prefs = { theme: "blue", custom: "#1A73E8", mode: "light", font: "IBM Plex Sans", zoom: 1 };
const KEY = "el.prefs";

export function loadPrefs(): Prefs {
  try {
    const legacy = localStorage.getItem("el.theme");
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Prefs> | null;
    return { ...DEFAULT_PREFS, ...(legacy ? { theme: legacy } : {}), ...saved };
  } catch {
    return DEFAULT_PREFS;
  }
}

export const accentOf = (p: Prefs) => (p.theme === "custom" ? p.custom : (THEMES.find((t) => t.key === p.theme)?.color ?? DEFAULT_PREFS.custom));
export const clampZoom = (z: number) => Math.round(Math.min(1.4, Math.max(0.7, z)) * 20) / 20;

export function applyPrefs(p: Prefs) {
  const root = document.documentElement;
  root.style.setProperty("--app-accent", accentOf(p));
  root.style.setProperty("--font-sans", UI_FONTS[p.font] ?? UI_FONTS["IBM Plex Sans"]);
  root.style.setProperty("--ui-zoom", String(clampZoom(p.zoom)));
  root.dataset.mode = p.mode;
  localStorage.setItem(KEY, JSON.stringify(p));
}

/** Current whole-app zoom (pointer math on the canvas must divide by it). */
export const uiZoom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-zoom")) || 1;
