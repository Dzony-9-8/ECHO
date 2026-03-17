import { useState, useEffect, useRef } from "react";
import { ChevronDown, Zap, Brain, Sparkles, Loader2 } from "lucide-react";
import { getBackendMode, fetchLocalModels, type LocalModel } from "@/lib/api";

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  icon: "fast" | "balanced" | "powerful";
}

const CLOUD_MODELS: ModelOption[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", description: "Fast & capable", icon: "fast" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Balanced speed/quality", icon: "balanced" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Complex reasoning", icon: "powerful" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", description: "Strong & efficient", icon: "balanced" },
  { id: "openai/gpt-5", label: "GPT-5", description: "Most capable", icon: "powerful" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini Flash Lite", description: "Fastest & cheapest", icon: "fast" },
];

const STORAGE_KEY = "echo_selected_model";

// Block NSFW/jailbreak/abliterated models from the model selector
const BLOCKED_MODEL_PATTERNS = /abliterated|uncensored|stheno|mythomax|dolphin|fluffy|hammer|l2|mistral-7b-instruct-v0\.1|llama2-uncensored/i;

const iconMap = {
  fast: Zap,
  balanced: Brain,
  powerful: Sparkles,
};

const colorMap = {
  fast: "text-primary",
  balanced: "text-terminal-cyan",
  powerful: "text-terminal-magenta",
};

function localModelToOption(m: LocalModel): ModelOption {
  const iconType: "fast" | "balanced" | "powerful" =
    m.type === "code" ? "powerful" : m.type === "reasoning" ? "balanced" : "fast";
  const shortName = m.name.split(":")[0];
  return {
    id: m.name,
    label: shortName.charAt(0).toUpperCase() + shortName.slice(1),
    description: `${m.type} - ${m.estimated_vram_mb}MB VRAM`,
    icon: iconType,
  };
}

export const getSelectedModel = (): string => {
  return localStorage.getItem(STORAGE_KEY) || "google/gemini-3-flash-preview";
};

interface Props {
  value: string;
  onChange: (modelId: string) => void;
}

const ModelSelector = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [localModels, setLocalModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mode = getBackendMode();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch local models when in local mode
  useEffect(() => {
    if (mode !== "local") return;
    let cancelled = false;
    setLoading(true);
    fetchLocalModels().then((models) => {
      if (cancelled) return;
      const filtered = models.filter(
        (m) => m.type !== "embedding" && !BLOCKED_MODEL_PATTERNS.test(m.name)
      );
      setLocalModels(filtered.map(localModelToOption));
      setLoading(false);
      // Auto-select first local model if current selection is a cloud model
      if (filtered.length > 0 && value.includes("/")) {
        const first = filtered[0].name;
        onChange(first);
        localStorage.setItem(STORAGE_KEY, first);
      }
    });
    return () => { cancelled = true; };
  }, [mode]);

  const MODELS = mode === "local" ? localModels : CLOUD_MODELS;
  const selected = MODELS.find((m) => m.id === value) || MODELS[0];
  if (!selected) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-mono text-muted-foreground">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "No models"}
      </div>
    );
  }
  const Icon = iconMap[selected.icon];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-border bg-muted/50 text-[10px] font-mono hover:border-primary transition-colors"
        title="Select AI model"
      >
        <Icon className={`w-3 h-3 ${colorMap[selected.icon]}`} />
        <span className="text-foreground max-w-[80px] truncate">{selected.label}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 w-56 border border-border bg-card rounded shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
          <div className="px-2 py-1 text-[9px] uppercase tracking-widest text-muted-foreground font-mono">
            {mode === "local" ? "Local Models" : "Cloud Models"}
          </div>
          {MODELS.map((model) => {
            const MIcon = iconMap[model.icon];
            const isActive = model.id === value;
            return (
              <button
                key={model.id}
                onClick={() => {
                  onChange(model.id);
                  localStorage.setItem(STORAGE_KEY, model.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/50 transition-colors ${
                  isActive ? "bg-muted" : ""
                }`}
              >
                <MIcon className={`w-3.5 h-3.5 ${colorMap[model.icon]}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] font-mono ${isActive ? "text-primary" : "text-foreground"}`}>
                    {model.label}
                  </div>
                  <div className="text-[9px] text-muted-foreground">{model.description}</div>
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
