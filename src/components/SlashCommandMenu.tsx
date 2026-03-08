import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, FileText, Languages, Code2, ListChecks, Lightbulb, Repeat, Shield,
} from "lucide-react";

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  prompt: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { id: "summarize", label: "/summarize", description: "Summarize the conversation so far", icon: <FileText className="w-3.5 h-3.5" />, prompt: "Please summarize our conversation so far in a few concise bullet points." },
  { id: "translate", label: "/translate", description: "Translate text to another language", icon: <Languages className="w-3.5 h-3.5" />, prompt: "Translate the following into " },
  { id: "code-review", label: "/code-review", description: "Review code for issues & improvements", icon: <Code2 className="w-3.5 h-3.5" />, prompt: "Please review the following code for bugs, performance issues, and improvements:\n\n```\n" },
  { id: "explain", label: "/explain", description: "Explain a concept simply", icon: <Lightbulb className="w-3.5 h-3.5" />, prompt: "Explain the following concept in simple terms: " },
  { id: "todos", label: "/todos", description: "Extract action items from conversation", icon: <ListChecks className="w-3.5 h-3.5" />, prompt: "Extract all action items and todos from our conversation. Format as a checklist." },
  { id: "rewrite", label: "/rewrite", description: "Rewrite text in a different style", icon: <Repeat className="w-3.5 h-3.5" />, prompt: "Rewrite the following text to be more " },
  { id: "brainstorm", label: "/brainstorm", description: "Generate creative ideas", icon: <Sparkles className="w-3.5 h-3.5" />, prompt: "Brainstorm 5 creative ideas for: " },
  { id: "security", label: "/security", description: "Analyze for security vulnerabilities", icon: <Shield className="w-3.5 h-3.5" />, prompt: "Analyze the following for security vulnerabilities and suggest fixes:\n\n" },
];

interface Props {
  input: string;
  visible: boolean;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

const SlashCommandMenu = ({ input, visible, onSelect, onClose }: Props) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const query = input.startsWith("/") ? input.slice(1).toLowerCase() : "";
  const filtered = query
    ? SLASH_COMMANDS.filter(
        (c) => c.label.toLowerCase().includes(query) || c.description.toLowerCase().includes(query)
      )
    : SLASH_COMMANDS;

  useEffect(() => {
    setSelectedIndex(0);
  }, [input]);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (filtered[selectedIndex]) {
          e.preventDefault();
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [visible, selectedIndex, filtered, onSelect, onClose]);

  if (!visible || filtered.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="absolute bottom-full left-10 mb-1 w-72 max-h-64 overflow-y-auto rounded border border-border bg-card shadow-xl z-50"
      >
        <div className="px-2 py-1.5 border-b border-border">
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
            Slash Commands
          </span>
        </div>
        {filtered.map((cmd, i) => (
          <button
            key={cmd.id}
            onClick={() => onSelect(cmd)}
            onMouseEnter={() => setSelectedIndex(i)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
              i === selectedIndex
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <span className={i === selectedIndex ? "text-primary" : "text-muted-foreground"}>
              {cmd.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-mono font-medium">{cmd.label}</div>
              <div className="text-[9px] opacity-70 truncate">{cmd.description}</div>
            </div>
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};

export { SLASH_COMMANDS };
export default SlashCommandMenu;
