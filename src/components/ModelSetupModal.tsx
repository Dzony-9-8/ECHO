import { useEffect, useState } from "react";
import { Check, X, Loader2 } from "lucide-react";

interface ModelInfo {
  name: string;
  label: string;
  installed: boolean;
  size: string;
  required: boolean;
}

interface SystemModelsResponse {
  ollama_running: boolean;
  all_required_ok: boolean;
  models: ModelInfo[];
}

interface Props {
  onDismiss: () => void;
}

const ModelSetupModal = ({ onDismiss }: Props) => {
  const [data, setData] = useState<SystemModelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const [installTriggered, setInstallTriggered] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8000/api/system/models")
      .then((res) => res.json())
      .then((json: SystemModelsResponse) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        setUnreachable(true);
        setLoading(false);
      });
  }, []);

  // Don't show modal if everything is OK or backend is unreachable
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-background border border-border rounded-lg p-6 w-full max-w-lg font-mono shadow-2xl flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm">Checking system...</span>
        </div>
      </div>
    );
  }

  if (unreachable || (data && data.all_required_ok)) {
    return null;
  }

  if (!data) return null;

  const ollamaRow: ModelInfo = {
    name: "ollama",
    label: "Ollama Runtime",
    installed: data.ollama_running,
    size: "Required",
    required: true,
  };

  const allRows = [ollamaRow, ...data.models];
  const someMissing = data.models.some((m) => !m.installed);

  const triggerInstall = async (payload: object) => {
    setInstalling(true);
    try {
      await fetch("http://localhost:8000/api/system/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // ignore — terminal window handles output
    } finally {
      setInstalling(false);
      setInstallTriggered(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-lg font-mono shadow-2xl">
        {/* Header */}
        <div className="mb-5">
          <h2 className="text-primary glow-green text-base font-bold tracking-widest uppercase">
            ⚡ ECHO SYSTEM CHECK
          </h2>
          <p className="text-muted-foreground text-xs mt-1">
            Required components for ECHO to function
          </p>
        </div>

        {/* Model rows */}
        <div className="mb-4">
          {allRows.map((row) => (
            <div
              key={row.name}
              className="flex items-center justify-between py-2 border-b border-border/50"
            >
              {/* Left */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">{row.label}</span>
                <span className="text-[10px] text-muted-foreground border border-border px-1 rounded ml-2">
                  {row.size}
                </span>
              </div>

              {/* Right */}
              <div className="flex items-center gap-1.5">
                {row.installed ? (
                  <>
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-xs text-primary">Installed</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4 text-terminal-red" />
                    <span className="text-xs text-terminal-red">Missing</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Ollama not running warning */}
        {!data.ollama_running && (
          <div className="mb-4 p-3 rounded-md bg-terminal-amber/10 border border-terminal-amber/30">
            <p className="text-terminal-amber text-xs leading-relaxed">
              Ollama is not running. Install it from ollama.ai then restart ECHO.
            </p>
            <a
              href="https://ollama.ai"
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-2 text-xs text-terminal-amber underline hover:text-terminal-amber/80 transition-colors"
            >
              → Open ollama.ai
            </a>
          </div>
        )}

        {/* Install buttons (only when ollama IS running and some models are missing) */}
        {data.ollama_running && someMissing && (
          <div className="mb-4 space-y-2">
            {installTriggered ? (
              <div className="text-xs text-primary py-2">
                ✓ Terminal opened — check the install window.
              </div>
            ) : (
              <>
                <button
                  onClick={() => triggerInstall({ install_all: true })}
                  disabled={installing}
                  className="w-full px-4 py-2 text-xs font-bold tracking-widest uppercase rounded-md bg-primary/10 border border-primary/50 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {installing && <Loader2 className="w-3 h-3 animate-spin" />}
                  INSTALL ALL MODELS
                </button>
                <button
                  onClick={() => triggerInstall({ models: ["llama3.2:3b"] })}
                  disabled={installing}
                  className="w-full px-4 py-2 text-xs font-bold tracking-widest uppercase rounded-md bg-muted/40 border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  INSTALL MAIN ONLY (LLaMA 3.2)
                </button>
              </>
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              A terminal window will open to run the installation.
            </p>
          </div>
        )}

        {/* Dismiss */}
        <div className="pt-2 border-t border-border/30">
          <button
            onClick={onDismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase"
          >
            CONTINUE WITH AVAILABLE MODELS
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelSetupModal;
