import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { EMOJIS, EMOJI_GROUPS, searchEmoji, type EmojiGroup } from "@/lib/emoji";

interface Props {
  open: boolean;
  onSelect: (char: string) => void;
  onClose: () => void;
}

/** Popup grid of emoji with category tabs + search. Anchored above the composer.
 *  NOTE: outside-click detection lives in the parent (ChatInput). We render the
 *  popup with a plain conditional (enter animation only) instead of
 *  AnimatePresence — framer-motion's exit path (PopChild) trips a React 18.3
 *  "ref is not a prop" warning AND jams the exit so the popup never unmounts,
 *  leaving it stuck open. Unmounting immediately on `open=false` is correct here. */
const EmojiPicker = ({ open, onSelect, onClose }: Props) => {
  const [group, setGroup] = useState<EmojiGroup>("smileys");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  const shown = useMemo(
    () => (query.trim() ? searchEmoji(query, 64) : EMOJIS.filter((e) => e.group === group)),
    [query, group]
  );

  if (!open) return null;

  return (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14 }}
          className="absolute bottom-full mb-2 left-0 z-50 w-72 rounded-lg border border-border bg-card shadow-xl overflow-hidden"
        >
          {/* Search */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              autoFocus
              aria-label="Search emoji"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search emoji…"
              className="flex-1 bg-transparent text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          </div>

          {/* Grid */}
          <div className="max-h-52 overflow-y-auto p-2 grid grid-cols-8 gap-0.5">
            {shown.map((e) => (
              <button
                key={e.char + e.code}
                onClick={() => onSelect(e.char)}
                title={`:${e.code}:`}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-lg leading-none transition-colors"
              >
                {e.char}
              </button>
            ))}
            {shown.length === 0 && (
              <div className="col-span-8 text-center text-[10px] font-mono text-muted-foreground/50 py-6">No emoji</div>
            )}
          </div>

          {/* Category tabs */}
          {!query.trim() && (
            <div className="flex items-center gap-0.5 px-1.5 py-1 border-t border-border overflow-x-auto">
              {EMOJI_GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGroup(g.id)}
                  title={g.label}
                  className={`px-1.5 py-1 rounded text-base leading-none flex-shrink-0 transition-colors ${
                    group === g.id ? "bg-muted" : "hover:bg-muted/50 opacity-60"
                  }`}
                >
                  {EMOJIS.find((e) => e.group === g.id)?.char}
                </button>
              ))}
            </div>
          )}
        </motion.div>
  );
};

export default EmojiPicker;
