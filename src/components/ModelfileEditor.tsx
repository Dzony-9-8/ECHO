import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getBackendUrl, getBackendMode } from "@/lib/api";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, ServerOff } from "lucide-react";

const DEFAULT_MODELFILE = `FROM llama3.2:3b

# Set the system prompt for this persona
SYSTEM """You are a helpful assistant."""

# Model parameters
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_predict 2048
`;

export default function ModelfileEditor() {
  const [modelName, setModelName] = useState("");
  const [modelfile, setModelfile] = useState(DEFAULT_MODELFILE);
  const [log, setLog] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const mode = getBackendMode();

  // Probe backend connectivity on mount
  useEffect(() => {
    if (mode !== "local") {
      setBackendReachable(false);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const url = getBackendUrl();
        const resp = await fetch(`${url}/api/health`, {
          signal: AbortSignal.timeout(4000),
        });
        if (!cancelled) setBackendReachable(resp.ok);
      } catch {
        if (!cancelled) setBackendReachable(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [mode]);

  const handleCreate = async () => {
    const name = modelName.trim();
    if (!name) {
      toast.error("Enter a model name (e.g. my-assistant:latest)");
      return;
    }
    if (!modelfile.trim()) {
      toast.error("Modelfile cannot be empty");
      return;
    }
    if (mode !== "local") {
      toast.error("Modelfile Editor requires Local Mode. Switch to Local in settings.");
      return;
    }

    setCreating(true);
    setLog([]);

    try {
      const url = getBackendUrl();
      const res = await fetch(`${url}/api/models/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, modelfile }),
        signal: AbortSignal.timeout(300000), // 5min timeout for model creation
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(text);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (raw === "[DONE]") {
            setCreating(false);
            return;
          }
          try {
            const chunk = JSON.parse(raw);
            if (chunk.error) {
              toast.error(chunk.error);
              setLog((prev) => [...prev, `ERROR: ${chunk.error}`]);
              setCreating(false);
              return;
            }
            if (chunk.status) {
              setLog((prev) => [...prev, chunk.status]);
              if (chunk.done) {
                toast.success(`Model "${name}" created successfully`);
                setCreating(false);
                return;
              }
            }
          } catch {
            // skip malformed SSE chunk
          }
        }
      }
    } catch (e: unknown) {
      const message =
        e instanceof TypeError && (e as TypeError).message.includes("fetch")
          ? "Cannot connect to backend. Is it running?"
          : (e as Error)?.message || "Failed to create model";
      toast.error(message);
      setLog((prev) => [...prev, `ERROR: ${message}`]);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      <div>
        <h2 className="text-lg font-semibold mb-1">Modelfile Editor</h2>
        <p className="text-xs text-muted-foreground font-mono">
          Create a custom Ollama model persona from a Modelfile. Uses{" "}
          <code className="bg-muted px-1 rounded">POST /api/create</code> internally.
        </p>
      </div>

      {/* Backend status indicator */}
      {mode !== "local" && (
        <div className="flex items-center gap-2 p-2.5 rounded-md border border-terminal-amber/40 bg-terminal-amber/5 text-terminal-amber text-xs font-mono">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Modelfile Editor requires <strong>Local Mode</strong>. Switch from Cloud Mode in the top-bar settings.</span>
        </div>
      )}

      {mode === "local" && backendReachable === false && (
        <div className="flex items-center gap-2 p-2.5 rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-xs font-mono">
          <ServerOff className="w-4 h-4 flex-shrink-0" />
          <span>Cannot reach backend at <code>{getBackendUrl()}</code>. Start the backend first: <code>cd backend && uvicorn main:app --port 8000</code></span>
        </div>
      )}

      {mode === "local" && backendReachable === null && (
        <div className="flex items-center gap-2 p-2.5 rounded-md border border-border bg-muted/30 text-muted-foreground text-xs font-mono">
          <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
          <span>Checking backend connection…</span>
        </div>
      )}

      {mode === "local" && backendReachable === true && (
        <div className="flex items-center gap-2 p-2.5 rounded-md border border-primary/30 bg-primary/5 text-primary text-xs font-mono">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>Backend connected at <code>{getBackendUrl()}</code></span>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Input
          placeholder="Model name (e.g. my-coder:latest)"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          className="max-w-72 font-mono text-sm"
        />
        <Button
          onClick={handleCreate}
          disabled={creating || !modelName.trim() || mode !== "local" || !backendReachable}
          className="shrink-0"
        >
          {creating ? "Creating…" : "Create Model"}
        </Button>
      </div>

      <Textarea
        value={modelfile}
        onChange={(e) => setModelfile(e.target.value)}
        rows={14}
        spellCheck={false}
        className="font-mono text-sm resize-none flex-1 min-h-[280px]"
        placeholder="Paste or write your Modelfile here…"
      />

      {log.length > 0 && (
        <div className="border rounded p-3 bg-muted/30 max-h-48 overflow-y-auto">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
            Build log
          </p>
          {log.map((line, i) => (
            <p
              key={i}
              className={`text-xs font-mono ${
                line.startsWith("ERROR") ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

