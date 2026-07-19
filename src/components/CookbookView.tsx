import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChefHat, RefreshCw, Cpu, HardDrive, Copy, Check, Zap, Server, AlertTriangle,
  Download, Loader2, CheckCircle2, X,
} from "lucide-react";
import { getBackendUrl, getBackendMode } from "@/lib/api";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  pull: string;
  size: string | null;
  params_b: number | null;
  est_vram_gb: number | null;
  fit: "gpu" | "cpu" | "too_large" | "unknown";
  downloads: number;
  family: string | null;
  version: number | null;
  sizes: string[];
}

interface RecommendResponse {
  hardware: { vram_gb: number; ram_gb: number };
  source: string;
  recommendations: Recommendation[];
  error: string | null;
}

interface SystemInfo {
  cpu?: { name?: string; cores?: number };
  ram?: { total_gb?: number };
  gpu?: { name?: string; vram_total_mb?: number } | null;
}

const FIT_META: Record<Recommendation["fit"], { label: string; cls: string }> = {
  gpu:       { label: "Fits GPU",   cls: "text-primary border-primary/40 bg-primary/10" },
  cpu:       { label: "CPU / RAM",  cls: "text-terminal-amber border-terminal-amber/40 bg-terminal-amber/10" },
  too_large: { label: "Too large",  cls: "text-terminal-red border-terminal-red/40 bg-terminal-red/10" },
  unknown:   { label: "Unknown",    cls: "text-muted-foreground border-border bg-muted/20" },
};

// Base name without the size tag: "llama3.2:3b" -> "llama3.2".
const baseName = (n: string) => n.split(":")[0];

interface PullState { status: string; percent: number | null; }

const CookbookView = () => {
  const [data, setData] = useState<RecommendResponse | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // Installed model tags reported by Ollama, plus live pull progress per model.
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [ollamaUp, setOllamaUp] = useState(false);
  const [pulls, setPulls] = useState<Record<string, PullState>>({});
  const abortRefs = useRef<Record<string, AbortController>>({});
  const mode = getBackendMode();

  const loadInstalled = useCallback(async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/models/installed`);
      if (!res.ok) throw new Error();
      const d: { installed: string[]; ollama: boolean } = await res.json();
      setOllamaUp(d.ollama);
      const set = new Set<string>();
      d.installed.forEach((n) => { set.add(n); set.add(baseName(n)); });
      setInstalled(set);
    } catch {
      setOllamaUp(false);
      setInstalled(new Set());
    }
  }, []);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const [sysRes, recRes] = await Promise.allSettled([
        fetch(`${getBackendUrl()}/api/system`),
        fetch(`${getBackendUrl()}/api/models/recommend`),
      ]);
      if (sysRes.status === "fulfilled" && sysRes.value.ok) setSystem(await sysRes.value.json());
      if (recRes.status === "fulfilled" && recRes.value.ok) {
        const rec: RecommendResponse = await recRes.value.json();
        setData(rec);
        if (rec.error) toast.error(rec.error);
      } else {
        throw new Error("recommend failed");
      }
      await loadInstalled();
    } catch {
      toast.error("Could not reach the backend for recommendations");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [loadInstalled]);

  useEffect(() => { scan(); }, [scan]);
  // Abort any in-flight pulls if the view unmounts.
  useEffect(() => () => { Object.values(abortRefs.current).forEach((a) => a.abort()); }, []);

  const isInstalled = (rec: Recommendation) =>
    installed.has(rec.pull) || installed.has(baseName(rec.pull));

  // Stream a real Ollama pull (existing SSE endpoint) and show live progress.
  const download = async (rec: Recommendation) => {
    const model = rec.pull;
    if (pulls[model]) return;
    const ctrl = new AbortController();
    abortRefs.current[model] = ctrl;
    setPulls((p) => ({ ...p, [model]: { status: "starting…", percent: null } }));
    try {
      const res = await fetch(`${getBackendUrl()}/api/models/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`pull failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let sawError = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.error) { sawError = ev.error; continue; }
            const percent = ev.total ? Math.round((ev.completed / ev.total) * 100) : null;
            setPulls((p) => ({ ...p, [model]: { status: ev.status || "downloading…", percent } }));
          } catch { /* ignore partial line */ }
        }
      }
      if (sawError) throw new Error(sawError);
      toast.success(`Installed ${model}`);
      await loadInstalled();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        toast.error(`Download failed: ${e instanceof Error ? e.message : "error"}`);
      }
    } finally {
      delete abortRefs.current[model];
      setPulls((p) => { const n = { ...p }; delete n[model]; return n; });
    }
  };

  const cancelDownload = (model: string) => abortRefs.current[model]?.abort();

  const copyPull = async (rec: Recommendation) => {
    const cmd = `ollama pull ${rec.pull}`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(rec.pull);
      toast.success("Copied — paste into a terminal to install");
      setTimeout(() => setCopied((c) => (c === rec.pull ? null : c)), 1500);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const gpuName = system?.gpu?.name;
  const vram = data?.hardware.vram_gb ?? (system?.gpu?.vram_total_mb ? system.gpu.vram_total_mb / 1024 : 0);
  const ram = data?.hardware.ram_gb ?? system?.ram?.total_gb ?? 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card p-3 flex items-center gap-3 flex-wrap">
        <ChefHat className="w-4 h-4 text-primary" />
        <span className="text-xs font-mono text-primary uppercase tracking-wider">Cookbook</span>
        <span className="text-[10px] font-mono text-muted-foreground/60">Hardware-aware model recommendations</span>
        <div className="flex-1" />
        <button
          onClick={scan}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/50 bg-primary/10 text-primary text-[10px] font-mono hover:bg-primary/20 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Scanning…" : "Rescan"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {mode !== "local" && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-terminal-amber/80 border border-terminal-amber/30 bg-terminal-amber/5 rounded px-3 py-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Recommendations are tailored to this machine's hardware and Ollama. Switch to <strong>Local Mode</strong> to install and run them.
          </div>
        )}

        {/* Hardware summary */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 border border-border rounded bg-card px-3 py-2">
            <Zap className="w-4 h-4 text-primary" />
            <div className="text-[10px] font-mono">
              <div className="text-muted-foreground/60">GPU / VRAM</div>
              <div className="text-foreground">{gpuName ? `${gpuName} · ` : ""}{vram > 0 ? `${vram.toFixed(1)} GB` : "no GPU detected"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 border border-border rounded bg-card px-3 py-2">
            <HardDrive className="w-4 h-4 text-terminal-cyan" />
            <div className="text-[10px] font-mono">
              <div className="text-muted-foreground/60">System RAM</div>
              <div className="text-foreground">{ram > 0 ? `${ram.toFixed(1)} GB` : "—"}</div>
            </div>
          </div>
          {system?.cpu?.name && (
            <div className="flex items-center gap-2 border border-border rounded bg-card px-3 py-2">
              <Cpu className="w-4 h-4 text-terminal-magenta" />
              <div className="text-[10px] font-mono">
                <div className="text-muted-foreground/60">CPU</div>
                <div className="text-foreground">{system.cpu.name}{system.cpu.cores ? ` · ${system.cpu.cores} cores` : ""}</div>
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] font-mono text-muted-foreground/50">
          Ranked from the live Ollama library by hardware fit, architecture recency, and popularity. VRAM is a Q4 estimate.
          {mode === "local" && ollamaUp
            ? " Download runs a real Ollama pull with live progress."
            : mode === "local"
              ? " Ollama isn't reachable — install/start it to enable one-click downloads."
              : " Switch to Local Mode to download."}
        </p>

        {/* Recommendations */}
        {data && data.recommendations.length > 0 && (
          <div className="space-y-1.5">
            {data.recommendations.map((rec, i) => {
              const meta = FIT_META[rec.fit];
              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(i * 0.02, 0.3) }}
                  className="flex items-center gap-3 p-2.5 rounded border border-border bg-card hover:border-primary/30 transition-all"
                >
                  <Server className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-mono text-foreground">{rec.pull}</span>
                      <span className={`text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground/50 mt-0.5 flex items-center gap-2 flex-wrap">
                      {rec.est_vram_gb != null && <span>~{rec.est_vram_gb} GB VRAM</span>}
                      {rec.downloads > 0 && <span>· {rec.downloads.toLocaleString()} pulls</span>}
                      {rec.sizes.length > 1 && <span>· sizes: {rec.sizes.join(", ")}</span>}
                    </div>
                  </div>
                  {/* Install state / actions */}
                  {(() => {
                    const pull = pulls[rec.pull];
                    if (pull) {
                      return (
                        <div className="flex items-center gap-2 flex-shrink-0 w-40">
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground mb-0.5">
                              <span className="truncate">{pull.status}</span>
                              {pull.percent != null && <span>{pull.percent}%</span>}
                            </div>
                            <div className="h-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pull.percent ?? 8}%` }} />
                            </div>
                          </div>
                          <button onClick={() => cancelDownload(rec.pull)} title="Cancel" className="p-1 text-muted-foreground hover:text-terminal-red flex-shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    }
                    if (isInstalled(rec)) {
                      return (
                        <span className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded border border-primary/40 bg-primary/10 text-primary flex-shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> Installed
                        </span>
                      );
                    }
                    return (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {mode === "local" && ollamaUp && (
                          <button
                            onClick={() => download(rec)}
                            title={`Download ${rec.pull} via Ollama`}
                            className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                          >
                            <Download className="w-3 h-3" /> Download
                          </button>
                        )}
                        <button
                          onClick={() => copyPull(rec)}
                          title={`Copy: ollama pull ${rec.pull}`}
                          className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                        >
                          {copied === rec.pull ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                          {copied === rec.pull ? "Copied" : "Copy"}
                        </button>
                      </div>
                    );
                  })()}
                </motion.div>
              );
            })}
          </div>
        )}

        {data && data.recommendations.length === 0 && !loading && (
          <div className="text-center text-[11px] font-mono text-muted-foreground/50 py-12">
            {data.error || "No recommendations available."}
          </div>
        )}

        {!data && !loading && (
          <div className="text-center text-[11px] font-mono text-muted-foreground/50 py-12">
            Click "Rescan" to fetch recommendations for your hardware.
          </div>
        )}
      </div>
    </div>
  );
};

export default CookbookView;
