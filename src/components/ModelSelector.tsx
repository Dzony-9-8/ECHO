import { useState, useEffect, useRef } from "react";
import { ChevronDown, Zap, Brain, Sparkles, Loader2 } from "lucide-react";
import { getBackendMode, fetchLocalModels, type LocalModel } from "@/lib/api";
import ModelPullDialog from "@/components/ModelPullDialog";

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

export function localModelToOption(m: LocalModel): ModelOption {
  const iconType: "fast" | "balanced" | "powerful" =
    m.type === "code" ? "powerful" : m.type === "reasoning" ? "balanced" : "fast";
  const baseName = m.name.split(":")[0];
  const label = baseName
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || m.name;
  const vram = m.estimated_vram_mb > 0 ? ` - ${m.estimated_vram_mb}MB VRAM` : "";
  return {
    id: m.name,
    label,
    description: `${m.type}${vram}`,
    icon: iconType,
  };
}

export function getSelectableLocalModels(models: LocalModel[]): ModelOption[] {
  return models
    .filter((m) => m.type !== "embedding")
    .map(localModelToOption);
}

export function resolveLocalModelSelection(value: string, models: ModelOption[]): string | null {
  if (models.length === 0) return null;
  const isInstalled = models.some((model) => model.id === value);
  return isInstalled ? null : models[0].id;
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
  const [pullTarget, setPullTarget] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const mode = getBackendMode();

  // Keep latest value/onChange accessible without re-triggering the fetch effect.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
      const selectable = getSelectableLocalModels(models);
      setLocalModels(selectable);
      setLoading(false);
      const nextModel = resolveLocalModelSelection(valueRef.current, selectable);
      if (nextModel) {
        onChangeRef.current(nextModel);
        localStorage.setItem(STORAGE_KEY, nextModel);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
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
          {mode === "local" && (
            <div className="border-t pt-1 pb-1">
              <button
                className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const name = prompt("Model name to pull (e.g. llama3.2:3b):");
                  if (name?.trim()) setPullTarget(name.trim());
                }}
              >
                + Pull a model from Ollama…
              </button>
            </div>
          )}
        </div>
      )}
      {pullTarget && (
        <ModelPullDialog
          model={pullTarget}
          open={!!pullTarget}
          onClose={() => setPullTarget(null)}
          onSuccess={() => {
            setPullTarget(null);
            if (getBackendMode() === "local") {
              fetchLocalModels().then((models) => {
                const selectable = getSelectableLocalModels(models);
                setLocalModels(selectable);
                const nextModel = resolveLocalModelSelection(value, selectable);
                if (nextModel) {
                  onChange(nextModel);
                  localStorage.setItem(STORAGE_KEY, nextModel);
                }
              });
            }
          }}
        />
      )}
    </div>
  );
};

export default ModelSelector;
