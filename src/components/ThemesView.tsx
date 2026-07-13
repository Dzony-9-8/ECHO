import { useState } from "react";
import { motion } from "framer-motion";
import { Palette, Check, RotateCcw, Type, ScanLine, CaseSensitive } from "lucide-react";
import { toast } from "sonner";
import { THEMES, type Theme, getSavedThemeId, setTheme } from "@/lib/themes";
import { FONTS, getSavedFontId, setFont } from "@/lib/fonts";

const hsl = (v: string) => `hsl(${v})`;
const FONT_SIZES = [
  { label: "SM", value: "12px" },
  { label: "MD", value: "14px" },
  { label: "LG", value: "16px" },
];

const ThemeCard = ({ theme, active, onApply }: { theme: Theme; active: boolean; onApply: () => void }) => (
  <motion.button
    layout
    onClick={onApply}
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    className={`text-left rounded-lg border overflow-hidden transition-all ${
      active ? "border-primary ring-1 ring-primary/50" : "border-border hover:border-foreground/30"
    }`}
  >
    {/* Preview swatch — a mini mock of the app chrome */}
    <div className="h-20 p-2 flex flex-col gap-1.5 relative" style={{ background: hsl(theme.bg) }}>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full" style={{ background: hsl(theme.primary) }} />
        <span className="h-1.5 w-10 rounded-full" style={{ background: hsl(theme.fg), opacity: 0.5 }} />
      </div>
      <div className="h-4 rounded" style={{ background: hsl(theme.card), border: `1px solid ${hsl(theme.border)}` }} />
      <div className="flex items-center gap-1 mt-auto">
        {[theme.cyan, theme.amber, theme.magenta, theme.red].map((c, i) => (
          <span key={i} className="w-3 h-3 rounded" style={{ background: hsl(c) }} />
        ))}
        <span className="ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: hsl(theme.primary), color: hsl(theme.primaryFg) }}>Aa</span>
      </div>
      {active && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: hsl(theme.primary), color: hsl(theme.primaryFg) }}>
          <Check className="w-2.5 h-2.5" />
        </span>
      )}
    </div>
    <div className="px-2.5 py-1.5 flex items-center gap-1.5 border-t border-border">
      <span className="text-[10px] font-mono text-foreground">{theme.name}</span>
      {!theme.dark && <span className="text-[8px] font-mono text-muted-foreground/50 uppercase">light</span>}
    </div>
  </motion.button>
);

const ThemesView = () => {
  const [activeId, setActiveId] = useState<string | null>(getSavedThemeId());
  const [fontId, setFontId] = useState(getSavedFontId);
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("echo_fontsize") || "14px");
  const [scanlines, setScanlines] = useState(() => localStorage.getItem("echo_scanlines") !== "false");

  const apply = (id: string) => {
    setTheme(id);
    setActiveId(id);
    toast.success(`Applied "${THEMES.find((t) => t.id === id)?.name}"`);
  };

  const resetDefault = () => {
    setTheme(null);
    setActiveId(null);
    toast.success("Reverted to system default");
  };

  const applyFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem("echo_fontsize", size);
    document.documentElement.style.setProperty("--chat-font-size", size);
  };

  const applyFont = (id: string) => {
    setFontId(id);
    setFont(id);
    toast.success(`Font: ${FONTS.find((f) => f.id === id)?.name}`);
  };

  const toggleScanlines = () => {
    const next = !scanlines;
    setScanlines(next);
    localStorage.setItem("echo_scanlines", String(next));
    document.documentElement.classList.toggle("no-scanlines", !next);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card p-3 flex items-center gap-3 flex-wrap">
        <Palette className="w-4 h-4 text-terminal-magenta" />
        <span className="text-xs font-mono text-terminal-magenta uppercase tracking-wider">Themes</span>
        <div className="flex-1" />
        <button onClick={resetDefault}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground transition-all">
          <RotateCcw className="w-3.5 h-3.5" /> System default
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Theme grid */}
        <div>
          <div className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">Color theme</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {THEMES.map((t) => (
              <ThemeCard key={t.id} theme={t} active={activeId === t.id} onApply={() => apply(t.id)} />
            ))}
          </div>
        </div>

        {/* UI font */}
        <div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">
            <CaseSensitive className="w-3.5 h-3.5" /> UI font
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {FONTS.map((f) => (
              <button
                key={f.id}
                onClick={() => applyFont(f.id)}
                style={{ fontFamily: `${f.stack}, monospace` }}
                className={`px-3 py-2 rounded border text-[12px] transition-all text-left ${
                  fontId === f.id ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-foreground/30"
                }`}
              >
                <div>Aa Bb 123</div>
                <div className="text-[8px] font-mono text-muted-foreground/50 mt-0.5 uppercase tracking-wide" style={{ fontFamily: "var(--font-mono)" }}>{f.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Display options */}
        <div className="flex flex-wrap gap-6">
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">
              <Type className="w-3 h-3" /> Chat font size
            </div>
            <div className="flex gap-1">
              {FONT_SIZES.map((f) => (
                <button key={f.value} onClick={() => applyFontSize(f.value)}
                  className={`px-3 py-1.5 rounded border text-[10px] font-mono transition-all ${
                    fontSize === f.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">
              <ScanLine className="w-3 h-3" /> CRT scanlines
            </div>
            <button onClick={toggleScanlines}
              className={`px-3 py-1.5 rounded border text-[10px] font-mono transition-all ${
                scanlines ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {scanlines ? "On" : "Off"}
            </button>
          </div>
        </div>

        <p className="text-[9px] font-mono text-muted-foreground/40">
          Themes remap the interface colors instantly and persist across sessions. "System default" restores the built-in look.
        </p>
      </div>
    </div>
  );
};

export default ThemesView;
