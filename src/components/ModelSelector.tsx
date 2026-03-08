import { useState } from "react";
import { ChevronDown, Zap, Brain, Sparkles } from "lucide-react";

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  speed: "fast" | "balanced" | "quality";
  icon: typeof Zap;
  color: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "Google", speed: "fast", icon: Zap, color: "text-terminal-cyan" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google", speed: "balanced", icon: Sparkles, color: "text-terminal-amber" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google", speed: "quality", icon: Brain, color: "text-terminal-magenta" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", provider: "OpenAI", speed: "balanced", icon: Sparkles, color: "text-terminal-amber" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano", provider: "OpenAI", speed: "fast", icon: Zap, color: "text-primary" },
];

const speedBadge: Record<string, { label: string; cls: string }> = {
  fast: { label: "⚡ Fast", cls: "text-primary border-primary/30" },
  balanced: { label: "⚖ Balanced", cls: "text-terminal-amber border-terminal-amber/30" },
  quality: { label: "🧠 Quality", cls: "text-terminal-magenta border-terminal-magenta/30" },
};

interface Props {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

const ModelSelector = ({ selectedModel, onModelChange }: Props) => {
  const [open, setOpen] = useState(false);
  const current = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-border bg-muted/50 hover:bg-muted transition-colors text-[10px] font-mono"
      >
        <current.icon className={`w-3 h-3 ${current.color}`} />
        <span className="text-foreground">{current.label}</span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 w-56 border border-border bg-card rounded shadow-lg z-50 overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-mono">Select Model</span>
          </div>
          {AVAILABLE_MODELS.map((model) => {
            const badge = speedBadge[model.speed];
            const isActive = model.id === selectedModel;
            return (
              <button
                key={model.id}
                onClick={() => { onModelChange(model.id); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors ${
                  isActive ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <model.icon className={`w-3.5 h-3.5 ${model.color} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono text-foreground">{model.label}</div>
                  <div className="text-[9px] text-muted-foreground">{model.provider}</div>
                </div>
                <span className={`text-[8px] font-mono border rounded px-1 py-0.5 ${badge.cls}`}>
                  {badge.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
