import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { searchEmoji, type Emoji } from "@/lib/emoji";

interface Props {
  query: string;            // shortcode text after the colon (no colon)
  visible: boolean;
  onSelect: (emoji: Emoji) => void;
  onClose: () => void;
}

/** ":shortcode" autocomplete for the composer — mirrors SlashCommandMenu behaviour. */
const EmojiAutocomplete = ({ query, visible, onSelect, onClose }: Props) => {
  const [selected, setSelected] = useState(0);
  const matches = searchEmoji(query, 8);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    if (!visible || matches.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((i) => Math.min(i + 1, matches.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); if (matches[selected]) onSelect(matches[selected]); }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [visible, selected, matches, onSelect, onClose]);

  if (!visible || matches.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="absolute bottom-full left-10 mb-1 w-56 max-h-56 overflow-y-auto rounded border border-border bg-card shadow-xl z-50"
      >
        {matches.map((e, i) => (
          <button
            key={e.char + e.code}
            onMouseEnter={() => setSelected(i)}
            onClick={() => onSelect(e)}
            className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-left transition-colors ${
              i === selected ? "bg-muted" : "hover:bg-muted/50"
            }`}
          >
            <span className="text-lg leading-none">{e.char}</span>
            <span className="text-[11px] font-mono text-foreground">:{e.code}:</span>
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};

export default EmojiAutocomplete;
