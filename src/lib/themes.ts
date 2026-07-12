// Themes — full color palettes applied by remapping the core CSS custom properties.
// Each theme provides ~15 HSL triples ("H S% L%") that expand to the full variable set.
// Applying a theme overrides index.css; "System default" clears the overrides so the
// built-in light/dark stylesheet takes over again.

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  bg: string; fg: string;
  card: string; cardFg: string;
  primary: string; primaryFg: string;
  secondary: string;
  muted: string; mutedFg: string;
  border: string; input: string;
  cyan: string; amber: string; magenta: string; red: string;
}

const STORAGE_KEY = "echo_theme";

// CSS variables to set, derived from a theme's palette.
const varsFor = (t: Theme): Record<string, string> => ({
  "--background": t.bg,
  "--foreground": t.fg,
  "--card": t.card,
  "--card-foreground": t.cardFg,
  "--popover": t.card,
  "--popover-foreground": t.cardFg,
  "--primary": t.primary,
  "--primary-foreground": t.primaryFg,
  "--secondary": t.secondary,
  "--secondary-foreground": t.primaryFg,
  "--muted": t.muted,
  "--muted-foreground": t.mutedFg,
  "--accent": t.magenta,
  "--accent-foreground": t.primaryFg,
  "--border": t.border,
  "--input": t.input,
  "--ring": t.primary,
  "--terminal-glow": t.primary,
  "--terminal-cyan": t.cyan,
  "--terminal-amber": t.amber,
  "--terminal-magenta": t.magenta,
  "--terminal-red": t.red,
  "--sidebar-background": t.card,
  "--sidebar-foreground": t.fg,
  "--sidebar-primary": t.primary,
  "--sidebar-primary-foreground": t.primaryFg,
  "--sidebar-accent": t.muted,
  "--sidebar-accent-foreground": t.fg,
  "--sidebar-border": t.border,
  "--sidebar-ring": t.primary,
});

export const THEMES: Theme[] = [
  {
    id: "echo-green", name: "ECHO Green", dark: true,
    bg: "220 20% 4%", fg: "142 70% 80%", card: "220 18% 7%", cardFg: "142 70% 80%",
    primary: "142 70% 45%", primaryFg: "220 20% 4%", secondary: "185 60% 40%",
    muted: "220 15% 12%", mutedFg: "142 20% 50%", border: "142 40% 18%", input: "220 15% 14%",
    cyan: "185 60% 50%", amber: "38 90% 55%", magenta: "280 60% 55%", red: "0 70% 50%",
  },
  {
    id: "amber-crt", name: "Amber CRT", dark: true,
    bg: "28 30% 5%", fg: "38 85% 74%", card: "28 28% 8%", cardFg: "38 85% 74%",
    primary: "38 92% 55%", primaryFg: "28 30% 5%", secondary: "45 80% 50%",
    muted: "30 20% 13%", mutedFg: "38 30% 50%", border: "38 40% 20%", input: "30 20% 15%",
    cyan: "48 85% 60%", amber: "45 95% 60%", magenta: "20 90% 62%", red: "6 85% 58%",
  },
  {
    id: "cyber-cyan", name: "Cyber Cyan", dark: true,
    bg: "200 35% 5%", fg: "185 70% 82%", card: "200 32% 8%", cardFg: "185 70% 82%",
    primary: "185 85% 50%", primaryFg: "200 35% 5%", secondary: "210 70% 50%",
    muted: "200 22% 13%", mutedFg: "185 25% 52%", border: "185 45% 22%", input: "200 22% 15%",
    cyan: "185 90% 55%", amber: "40 90% 58%", magenta: "300 80% 62%", red: "350 80% 58%",
  },
  {
    id: "synthwave", name: "Synthwave", dark: true,
    bg: "258 40% 8%", fg: "300 60% 88%", card: "258 38% 12%", cardFg: "300 60% 88%",
    primary: "322 90% 62%", primaryFg: "258 40% 8%", secondary: "265 80% 60%",
    muted: "258 28% 18%", mutedFg: "290 30% 62%", border: "300 45% 28%", input: "258 28% 18%",
    cyan: "190 90% 58%", amber: "40 100% 62%", magenta: "300 95% 66%", red: "348 95% 62%",
  },
  {
    id: "matrix", name: "Matrix", dark: true,
    bg: "120 25% 3%", fg: "120 85% 72%", card: "120 22% 6%", cardFg: "120 85% 72%",
    primary: "125 100% 45%", primaryFg: "120 25% 3%", secondary: "140 70% 40%",
    muted: "120 18% 11%", mutedFg: "120 30% 45%", border: "120 45% 16%", input: "120 18% 13%",
    cyan: "160 80% 48%", amber: "90 80% 52%", magenta: "150 70% 55%", red: "0 75% 52%",
  },
  {
    id: "blood", name: "Blood", dark: true,
    bg: "0 28% 5%", fg: "0 70% 82%", card: "0 26% 8%", cardFg: "0 70% 82%",
    primary: "0 82% 52%", primaryFg: "0 0% 100%", secondary: "18 75% 48%",
    muted: "0 20% 13%", mutedFg: "0 25% 55%", border: "0 45% 22%", input: "0 20% 15%",
    cyan: "18 85% 58%", amber: "38 90% 55%", magenta: "330 80% 58%", red: "0 90% 58%",
  },
  {
    id: "nord", name: "Nord", dark: true,
    bg: "220 17% 16%", fg: "218 27% 88%", card: "220 16% 20%", cardFg: "218 27% 88%",
    primary: "210 34% 63%", primaryFg: "220 17% 16%", secondary: "179 25% 55%",
    muted: "220 14% 26%", mutedFg: "219 20% 65%", border: "220 14% 30%", input: "220 14% 24%",
    cyan: "179 25% 65%", amber: "40 71% 73%", magenta: "311 20% 63%", red: "354 42% 56%",
  },
  {
    id: "dracula", name: "Dracula", dark: true,
    bg: "231 15% 18%", fg: "60 30% 96%", card: "232 14% 22%", cardFg: "60 30% 96%",
    primary: "265 89% 78%", primaryFg: "231 15% 18%", secondary: "191 97% 77%",
    muted: "232 14% 28%", mutedFg: "225 15% 65%", border: "232 14% 32%", input: "232 14% 26%",
    cyan: "191 97% 77%", amber: "65 92% 76%", magenta: "326 100% 74%", red: "0 100% 67%",
  },
  {
    id: "gruvbox", name: "Gruvbox", dark: true,
    bg: "0 0% 16%", fg: "43 59% 81%", card: "20 6% 20%", cardFg: "43 59% 81%",
    primary: "61 56% 44%", primaryFg: "0 0% 16%", secondary: "24 87% 52%",
    muted: "20 6% 26%", mutedFg: "40 20% 62%", border: "20 8% 30%", input: "20 6% 24%",
    cyan: "170 42% 46%", amber: "42 95% 50%", magenta: "333 45% 62%", red: "6 96% 59%",
  },
  {
    id: "mono", name: "Mono", dark: true,
    bg: "0 0% 6%", fg: "0 0% 86%", card: "0 0% 10%", cardFg: "0 0% 86%",
    primary: "0 0% 78%", primaryFg: "0 0% 6%", secondary: "0 0% 55%",
    muted: "0 0% 16%", mutedFg: "0 0% 55%", border: "0 0% 24%", input: "0 0% 16%",
    cyan: "0 0% 70%", amber: "0 0% 82%", magenta: "0 0% 60%", red: "0 60% 55%",
  },
  {
    id: "ice", name: "Ice (light)", dark: false,
    bg: "205 45% 96%", fg: "215 45% 16%", card: "0 0% 100%", cardFg: "215 45% 16%",
    primary: "200 80% 42%", primaryFg: "0 0% 100%", secondary: "190 70% 40%",
    muted: "205 30% 90%", mutedFg: "210 20% 42%", border: "205 35% 82%", input: "205 30% 88%",
    cyan: "190 75% 42%", amber: "35 85% 48%", magenta: "280 60% 52%", red: "0 72% 50%",
  },
];

/** Applies a theme by id. Unknown/"default" clears overrides (reverts to index.css). */
export const applyTheme = (id: string | null): void => {
  const root = document.documentElement;
  const all = varsFor(THEMES[0]); // full key set for clearing
  const theme = THEMES.find((t) => t.id === id);

  if (!theme) {
    for (const key of Object.keys(all)) root.style.removeProperty(key);
    root.classList.remove("light");
    return;
  }
  const vars = varsFor(theme);
  for (const [key, val] of Object.entries(vars)) root.style.setProperty(key, val);
  // Light themes need the .light class for the non-variable tweaks (glow/scanlines).
  root.classList.toggle("light", !theme.dark);
};

export const getSavedThemeId = (): string | null => localStorage.getItem(STORAGE_KEY);

export const setTheme = (id: string | null): void => {
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
  applyTheme(id);
};

/** Called from main.tsx before render so the saved theme is applied without a flash. */
export const initTheme = (): void => {
  const id = getSavedThemeId();
  if (id) applyTheme(id);
};
