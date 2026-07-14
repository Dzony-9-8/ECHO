import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { SHORTCUT_GROUPS, SHORTCUTS_EVENT } from "@/lib/shortcuts";

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded border border-border bg-muted text-[10px] font-mono text-foreground shadow-sm">
    {children}
  </kbd>
);

const isTypingTarget = (el: EventTarget | null): boolean => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
};

/** Cheat-sheet overlay. Opens via the "?" key (outside inputs) or SHORTCUTS_EVENT. */
const ShortcutsCheatSheet = () => {
  const [open, setOpen] = useState(false);

  // Open on demand (TopBar button / openShortcuts()).
  useEffect(() => {
    const onEvent = () => setOpen(true);
    window.addEventListener(SHORTCUTS_EVENT, onEvent);
    return () => window.removeEventListener(SHORTCUTS_EVENT, onEvent);
  }, []);

  // Global "?" to open (when not typing), Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-background/85 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18 }}
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-3 border-b border-border bg-card z-10">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-terminal-cyan" style={{ filter: "drop-shadow(0 0 5px hsl(185 60% 50% / 0.6))" }} />
            <h2 className="text-sm font-display tracking-wider text-foreground">Keyboard Shortcuts</h2>
          </div>
          <button onClick={() => setOpen(false)} title="Close (Esc)" className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-2 pb-1 border-b border-border/50">
                {group.title}
              </div>
              <div className="space-y-2">
                {group.items.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-muted-foreground leading-snug">{s.label}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {s.keys.map((k, j) => (
                        <Kbd key={j}>{k}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="px-5 pb-4 text-[9px] font-mono text-muted-foreground/50 text-center">
          Press <Kbd>?</Kbd> anytime to toggle this panel.
        </p>
      </motion.div>
    </div>
  );
};

export default ShortcutsCheatSheet;
