export const THEMES = [
  { key: "blue", name: "Ocean Blue", color: "#1A73E8" },
  { key: "emerald", name: "Emerald", color: "#0F9D58" },
  { key: "teal", name: "Teal", color: "#00897B" },
  { key: "purple", name: "Royal Purple", color: "#7E57C2" },
  { key: "pink", name: "Rose Pink", color: "#D81B60" },
  { key: "red", name: "Crimson", color: "#D93025" },
  { key: "orange", name: "Sunset Orange", color: "#E8710A" },
  { key: "graphite", name: "Graphite", color: "#374151" },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];
const STORAGE_KEY = "el.theme";

export function getTheme(): ThemeKey {
  const v = localStorage.getItem(STORAGE_KEY);
  return THEMES.some((t) => t.key === v) ? (v as ThemeKey) : "blue";
}

export function applyTheme(key: ThemeKey) {
  document.documentElement.dataset.theme = key;
  localStorage.setItem(STORAGE_KEY, key);
}
