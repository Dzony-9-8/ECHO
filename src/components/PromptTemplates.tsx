import { useState } from "react";
import { BookTemplate, Code2, Search, FileText, Bug, Lightbulb } from "lucide-react";

interface Props {
  onSelect: (prompt: string) => void;
}

const templates = [
  { icon: Code2, label: "Code Review", prompt: "Review this code for bugs, performance issues, and best practices:\n\n```\n\n```", color: "text-terminal-cyan" },
  { icon: Search, label: "Deep Research", prompt: "Research this topic in depth with multiple perspectives, citing reasoning chains:\n\n", color: "text-primary" },
  { icon: Bug, label: "Debug", prompt: "Help me debug this issue. Here's the error and relevant code:\n\nError:\n```\n\n```\n\nCode:\n```\n\n```", color: "text-terminal-red" },
  { icon: FileText, label: "Summarize", prompt: "Summarize the following content, extracting key points and actionable insights:\n\n", color: "text-terminal-amber" },
  { icon: Lightbulb, label: "Brainstorm", prompt: "Brainstorm creative solutions for this challenge. Think outside the box:\n\n", color: "text-terminal-magenta" },
];

const PromptTemplates = ({ onSelect }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2.5 rounded border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        title="Prompt Templates"
      >
        <BookTemplate className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 w-48 border border-border bg-card rounded shadow-lg z-50 overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-mono">Templates</span>
          </div>
          {templates.map((t) => (
            <button
              key={t.label}
              onClick={() => { onSelect(t.prompt); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/50 transition-colors"
            >
              <t.icon className={`w-3.5 h-3.5 ${t.color} flex-shrink-0`} />
              <span className="text-[11px] font-mono text-foreground">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PromptTemplates;
