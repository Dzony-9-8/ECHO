import { useState, useEffect } from "react";
import { X, Thermometer, Hash, FileText, Brain } from "lucide-react";
import {
  getChatSettings,
  saveChatSettings,
  type ChatSettings,
  TEMPERATURE_PRESETS,
  RESPONSE_FORMATS,
  BEHAVIOR_PRESETS,
} from "@/lib/chatSettings";

interface Props {
  open: boolean;
  onClose: () => void;
  onChange?: (settings: ChatSettings) => void;
}

const ChatSettingsModal = ({ open, onClose, onChange }: Props) => {
  const [settings, setSettings] = useState<ChatSettings>(getChatSettings);

  useEffect(() => {
    if (open) setSettings(getChatSettings());
  }, [open]);

  const update = (patch: Partial<ChatSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveChatSettings(next);
    onChange?.(next);
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-background/80 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md bg-card border border-border rounded-lg shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-mono text-primary uppercase tracking-wider">
              Chat Settings
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Thermometer className="w-3.5 h-3.5 text-terminal-amber" />
                <label className="text-[11px] font-mono text-foreground uppercase tracking-wider">
                  Temperature
                </label>
                <span className="ml-auto text-[11px] font-mono text-terminal-amber">
                  {settings.temperature.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={settings.temperature}
                onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
                className="w-full h-1.5 accent-terminal-amber cursor-pointer"
              />
              <div className="flex gap-1.5 flex-wrap">
                {TEMPERATURE_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => update({ temperature: p.value })}
                    className={`px-2 py-1 rounded text-[9px] font-mono border transition-colors ${
                      Math.abs(settings.temperature - p.value) < 0.05
                        ? "border-terminal-amber text-terminal-amber bg-terminal-amber/10"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    title={p.desc}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-terminal-cyan" />
                <label className="text-[11px] font-mono text-foreground uppercase tracking-wider">
                  Max Response Length
                </label>
                <span className="ml-auto text-[11px] font-mono text-terminal-cyan">
                  {settings.maxTokens}
                </span>
              </div>
              <input
                type="range"
                min={256}
                max={8192}
                step={256}
                value={settings.maxTokens}
                onChange={(e) => update({ maxTokens: parseInt(e.target.value) })}
                className="w-full h-1.5 accent-terminal-cyan cursor-pointer"
              />
              <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                <span>256 (Short)</span>
                <span>8192 (Long)</span>
              </div>
            </div>

            {/* Response Format */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <label className="text-[11px] font-mono text-foreground uppercase tracking-wider">
                  Response Format
                </label>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {RESPONSE_FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => update({ responseFormat: f.value as ChatSettings["responseFormat"] })}
                    className={`px-3 py-2 rounded text-left border transition-colors ${
                      settings.responseFormat === f.value
                        ? "border-primary text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="text-[10px] font-mono font-medium">{f.label}</div>
                    <div className="text-[8px] opacity-70">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Behavior */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-accent" />
                <label className="text-[11px] font-mono text-foreground uppercase tracking-wider">
                  Response Style
                </label>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {BEHAVIOR_PRESETS.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => update({ systemBehavior: b.value })}
                    className={`px-3 py-2 rounded text-left border transition-colors ${
                      settings.systemBehavior === b.value
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="text-[10px] font-mono font-medium">{b.label}</div>
                    <div className="text-[8px] opacity-70">{b.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border flex justify-between items-center">
            <button
              onClick={() => {
                const defaults = { temperature: 0.7, maxTokens: 2048, responseFormat: "auto" as const, systemBehavior: "balanced" };
                setSettings(defaults);
                saveChatSettings(defaults);
                onChange?.(defaults);
              }}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              Reset Defaults
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-primary text-primary text-[10px] font-mono hover:bg-primary/10 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatSettingsModal;
