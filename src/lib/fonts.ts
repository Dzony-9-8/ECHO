// UI font selection — swaps the --font-mono / --font-display CSS variables that
// Tailwind's `mono`/`display` families and the body font resolve through.

export interface FontPreset {
  id: string;
  name: string;
  stack: string;       // CSS font-family value
  loaded?: boolean;    // true = webfont already imported (index.css), else system stack
}

const KEY = "echo_font";

export const FONTS: FontPreset[] = [
  { id: "jetbrains", name: "JetBrains Mono", stack: "'JetBrains Mono'", loaded: true },
  { id: "share-tech", name: "Share Tech Mono", stack: "'Share Tech Mono'", loaded: true },
  { id: "system-mono", name: "System Mono", stack: "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, Menlo, monospace" },
  { id: "courier", name: "Courier", stack: "'Courier New', Courier, monospace" },
  { id: "system-sans", name: "System Sans", stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: "serif", name: "Serif", stack: "Georgia, 'Times New Roman', serif" },
];

export const DEFAULT_FONT_ID = "jetbrains";

/** Applies a font preset by id (sets both --font-mono and --font-display for a full switch). */
export const applyFont = (id: string): void => {
  const font = FONTS.find((f) => f.id === id) ?? FONTS[0];
  const root = document.documentElement;
  root.style.setProperty("--font-mono", font.stack);
  root.style.setProperty("--font-display", font.stack);
};

export const getSavedFontId = (): string => localStorage.getItem(KEY) || DEFAULT_FONT_ID;

export const setFont = (id: string): void => {
  localStorage.setItem(KEY, id);
  applyFont(id);
};

/** Called from main.tsx before render so the saved font applies without a flash. */
export const initFont = (): void => {
  const id = localStorage.getItem(KEY);
  if (id && id !== DEFAULT_FONT_ID) applyFont(id);
};
