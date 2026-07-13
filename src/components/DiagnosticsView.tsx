import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  RefreshCw,
  Cpu,
  MemoryStick,
  HardDrive,
  Server,
  ShieldCheck,
  Zap,
  Database,
  CircleCheck,
  CircleX,
  CircleAlert,
} from "lucide-react";
import { getBackendUrl } from "@/lib/api";

// ── Types (subset of the real backend payloads we surface) ───────────────────
interface HealthPayload {
  backend: string;
  version: string;
  gpu: { name: string; vram_used: number; vram_total: number } | null;
  models_loaded: string[];
  uptime: number;
  features: Record<string, boolean>;
}
interface SystemPayload {
  cpu: { name: string; cores: number; threads: number; usage_percent: number; temperature_c: number | null };
  ram: { total_gb: number; used_gb: number; usage_percent: number };
  gpu: { name: string; vram_used_mb: number; vram_total_mb: number } | null;
  disk: { total_gb: number; used_gb: number; usage_percent: number } | null;
  platform: string;
  hostname: string;
}
interface TelemetryPayload {
  uptime: number;
  vram: { used_mb: number; total_mb: number; percent: number };
  cache: { hits?: number; misses?: number; hit_rate?: number; entries?: number } & Record<string, unknown>;
  models_loaded: string[];
  memory_stats: { entries: number; last_compaction: string };
}
interface SecurityPayload {
  recent_scans: unknown[];
  total_flagged: number;
}

type ProbeState = "ok" | "degraded" | "down" | "loading";

interface Probe<T> {
  state: ProbeState;
  data: T | null;
  error: string | null;
}

const emptyProbe = <T,>(): Probe<T> => ({ state: "loading", data: null, error: null });

// ── Small helpers ────────────────────────────────────────────────────────────
const fmtUptime = (s: number): string => {
  if (!s || s < 0) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m ${sec}s`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const barColor = (pct: number): string =>
  pct >= 90 ? "hsl(0 70% 55%)" : pct >= 70 ? "hsl(38 90% 55%)" : "hsl(142 70% 45%)";

// ── Status pill ──────────────────────────────────────────────────────────────
const StatusPill = ({ state }: { state: ProbeState }) => {
  const map: Record<ProbeState, { label: string; color: string; Icon: typeof CircleCheck }> = {
    ok: { label: "OK", color: "hsl(142 70% 45%)", Icon: CircleCheck },
    degraded: { label: "DEGRADED", color: "hsl(38 90% 55%)", Icon: CircleAlert },
    down: { label: "DOWN", color: "hsl(0 70% 55%)", Icon: CircleX },
    loading: { label: "···", color: "hsl(185 60% 50%)", Icon: RefreshCw },
  };
  const { label, color, Icon } = map[state];
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border"
      style={{ color, borderColor: `${color}55`, background: `${color}12` }}
    >
      <Icon className={`w-3 h-3 ${state === "loading" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
};

// ── Meter row ────────────────────────────────────────────────────────────────
const Meter = ({ label, pct, sub }: { label: string; pct: number; sub?: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-[10px] font-mono">
      <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-foreground">{sub ?? `${pct.toFixed(0)}%`}</span>
    </div>
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: barColor(pct) }}
      />
    </div>
  </div>
);

// ── Card shell ───────────────────────────────────────────────────────────────
const Card = ({
  icon: Icon,
  title,
  state,
  glow,
  children,
}: {
  icon: typeof Server;
  title: string;
  state: ProbeState;
  glow: string;
  children: React.ReactNode;
}) => (
  <div className="border border-border rounded-lg bg-card/40 overflow-hidden flex flex-col">
    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color: glow, filter: `drop-shadow(0 0 4px ${glow}80)` }} />
        <span className="text-xs font-mono uppercase tracking-widest text-foreground">{title}</span>
      </div>
      <StatusPill state={state} />
    </div>
    <div className="p-3 space-y-2.5 flex-1">{children}</div>
  </div>
);

const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-center justify-between text-[10px] font-mono">
    <span className="text-muted-foreground uppercase tracking-wider">{k}</span>
    <span className="text-foreground text-right truncate max-w-[60%]">{v}</span>
  </div>
);

const DiagnosticsView = () => {
  const [health, setHealth] = useState<Probe<HealthPayload>>(emptyProbe);
  const [system, setSystem] = useState<Probe<SystemPayload>>(emptyProbe);
  const [telemetry, setTelemetry] = useState<Probe<TelemetryPayload>>(emptyProbe);
  const [security, setSecurity] = useState<Probe<SecurityPayload>>(emptyProbe);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [auto, setAuto] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards against setState after unmount — 4 probes + a 5s interval can resolve
  // after the view is switched away.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const probe = useCallback(
    async <T,>(
      path: string,
      set: React.Dispatch<React.SetStateAction<Probe<T>>>,
      evaluate: (d: T) => ProbeState = () => "ok",
    ) => {
      const base = getBackendUrl();
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(`${base}${path}`, { signal: ctrl.signal });
        clearTimeout(to);
        if (!alive.current) return;
        if (!res.ok) {
          set({ state: "down", data: null, error: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as T;
        if (!alive.current) return;
        set({ state: evaluate(data), data, error: null });
      } catch (e) {
        if (!alive.current) return;
        set({
          state: "down",
          data: null,
          error: e instanceof Error ? (e.name === "AbortError" ? "timeout" : e.message) : "unreachable",
        });
      }
    },
    [],
  );

  const runAll = useCallback(() => {
    setHealth((p) => ({ ...p, state: "loading" }));
    setSystem((p) => ({ ...p, state: "loading" }));
    setTelemetry((p) => ({ ...p, state: "loading" }));
    setSecurity((p) => ({ ...p, state: "loading" }));
    void probe<HealthPayload>("/api/health", setHealth, (d) =>
      d.backend === "online" ? "ok" : "degraded",
    );
    void probe<SystemPayload>("/api/system", setSystem, (d) => {
      const worst = Math.max(d.cpu?.usage_percent ?? 0, d.ram?.usage_percent ?? 0, d.disk?.usage_percent ?? 0);
      return worst >= 92 ? "degraded" : "ok";
    });
    void probe<TelemetryPayload>("/api/telemetry", setTelemetry, (d) =>
      (d.vram?.percent ?? 0) >= 95 ? "degraded" : "ok",
    );
    void probe<SecurityPayload>("/api/security/status", setSecurity, (d) =>
      (d.total_flagged ?? 0) > 0 ? "degraded" : "ok",
    );
    setLastRun(new Date());
  }, [probe]);

  useEffect(() => {
    runAll();
  }, [runAll]);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (auto) timer.current = setInterval(runAll, 5000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [auto, runAll]);

  // Overall banner
  const states = [health.state, system.state, telemetry.state, security.state];
  const overall: ProbeState = states.includes("down")
    ? "down"
    : states.includes("degraded")
      ? "degraded"
      : states.includes("loading")
        ? "loading"
        : "ok";
  const backendReachable = !(health.state === "down" && system.state === "down" && telemetry.state === "down");

  const overallText: Record<ProbeState, string> = {
    ok: "All services operational",
    degraded: "One or more services degraded",
    down: backendReachable ? "One or more services unreachable" : "Backend unreachable",
    loading: "Running diagnostics…",
  };
  const overallColor: Record<ProbeState, string> = {
    ok: "hsl(142 70% 45%)",
    degraded: "hsl(38 90% 55%)",
    down: "hsl(0 70% 55%)",
    loading: "hsl(185 60% 50%)",
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-terminal-cyan" style={{ filter: "drop-shadow(0 0 6px hsl(185 60% 50% / 0.6))" }} />
          <div>
            <h1 className="text-lg font-display tracking-wider text-foreground">Diagnostics</h1>
            <p className="text-[10px] font-mono text-muted-foreground">
              Live service health · {getBackendUrl()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAuto((a) => !a)}
            className={`text-[10px] font-mono uppercase tracking-widest px-2.5 py-1.5 rounded border transition-all ${
              auto
                ? "text-primary border-primary/50 bg-primary/10"
                : "text-muted-foreground border-border hover:text-foreground"
            }`}
            title="Toggle 5s auto-refresh"
          >
            Auto {auto ? "ON" : "OFF"}
          </button>
          <button
            onClick={runAll}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2.5 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-terminal-cyan/50 transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${overall === "loading" ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall banner */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-5 px-4 py-3 rounded-lg border"
        style={{
          borderColor: `${overallColor[overall]}55`,
          background: `${overallColor[overall]}10`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: overallColor[overall], boxShadow: `0 0 8px ${overallColor[overall]}` }}
          />
          <span className="text-sm font-mono" style={{ color: overallColor[overall] }}>
            {overallText[overall]}
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          {lastRun ? `checked ${lastRun.toLocaleTimeString()}` : "—"}
        </span>
      </motion.div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backend / health */}
        <Card icon={Server} title="Backend" state={health.state} glow="hsl(142 70% 45%)">
          {health.data ? (
            <>
              <KV k="Status" v={health.data.backend} />
              <KV k="Version" v={health.data.version} />
              <KV k="Uptime" v={fmtUptime(health.data.uptime)} />
              <KV k="Models loaded" v={health.data.models_loaded.length} />
              <div className="pt-1 flex flex-wrap gap-1">
                {Object.entries(health.data.features).map(([k, on]) => (
                  <span
                    key={k}
                    className="text-[8px] font-mono px-1.5 py-0.5 rounded border"
                    style={{
                      color: on ? "hsl(142 70% 45%)" : "hsl(0 0% 50%)",
                      borderColor: on ? "hsl(142 70% 45% / 0.4)" : "hsl(0 0% 50% / 0.3)",
                    }}
                  >
                    {k}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[10px] font-mono text-terminal-red">
              {health.error ? `Unreachable — ${health.error}` : "…"}
            </p>
          )}
        </Card>

        {/* System resources */}
        <Card icon={Cpu} title="System" state={system.state} glow="hsl(185 60% 50%)">
          {system.data ? (
            <>
              <Meter
                label="CPU"
                pct={system.data.cpu.usage_percent}
                sub={`${system.data.cpu.usage_percent.toFixed(0)}% · ${system.data.cpu.cores}c/${system.data.cpu.threads}t${
                  system.data.cpu.temperature_c != null ? ` · ${system.data.cpu.temperature_c}°C` : ""
                }`}
              />
              <Meter
                label="RAM"
                pct={system.data.ram.usage_percent}
                sub={`${system.data.ram.used_gb} / ${system.data.ram.total_gb} GB`}
              />
              {system.data.disk && (
                <Meter
                  label="Disk"
                  pct={system.data.disk.usage_percent}
                  sub={`${system.data.disk.used_gb} / ${system.data.disk.total_gb} GB`}
                />
              )}
              <KV k="Host" v={system.data.hostname} />
              <KV k="Platform" v={system.data.platform} />
            </>
          ) : (
            <p className="text-[10px] font-mono text-terminal-red">
              {system.error ? `Unreachable — ${system.error}` : "…"}
            </p>
          )}
        </Card>

        {/* GPU / VRAM + throughput */}
        <Card icon={Zap} title="GPU / VRAM" state={telemetry.state} glow="hsl(38 90% 55%)">
          {telemetry.data ? (
            telemetry.data.vram.total_mb > 0 ? (
              <>
                <Meter
                  label="VRAM"
                  pct={telemetry.data.vram.percent}
                  sub={`${(telemetry.data.vram.used_mb / 1024).toFixed(1)} / ${(
                    telemetry.data.vram.total_mb / 1024
                  ).toFixed(1)} GB`}
                />
                <KV k="Models resident" v={telemetry.data.models_loaded.length} />
                {telemetry.data.models_loaded.slice(0, 4).map((m) => (
                  <div key={m} className="text-[9px] font-mono text-terminal-cyan truncate">
                    › {m}
                  </div>
                ))}
              </>
            ) : (
              <p className="text-[10px] font-mono text-muted-foreground">
                No GPU detected — running on CPU. VRAM metrics unavailable.
              </p>
            )
          ) : (
            <p className="text-[10px] font-mono text-terminal-red">
              {telemetry.error ? `Unreachable — ${telemetry.error}` : "…"}
            </p>
          )}
        </Card>

        {/* Cache + memory */}
        <Card icon={Database} title="Cache & Memory" state={telemetry.state} glow="hsl(280 60% 55%)">
          {telemetry.data ? (
            <>
              <KV
                k="Cache hits"
                v={typeof telemetry.data.cache.hits === "number" ? telemetry.data.cache.hits : "—"}
              />
              <KV
                k="Cache misses"
                v={typeof telemetry.data.cache.misses === "number" ? telemetry.data.cache.misses : "—"}
              />
              <KV
                k="Hit rate"
                v={
                  typeof telemetry.data.cache.hit_rate === "number"
                    ? `${(telemetry.data.cache.hit_rate * 100).toFixed(0)}%`
                    : "—"
                }
              />
              <div className="border-t border-border my-1" />
              <KV k="Memory entries" v={telemetry.data.memory_stats.entries} />
              <KV k="Last compaction" v={telemetry.data.memory_stats.last_compaction} />
            </>
          ) : (
            <p className="text-[10px] font-mono text-terminal-red">
              {telemetry.error ? `Unreachable — ${telemetry.error}` : "…"}
            </p>
          )}
        </Card>

        {/* Security */}
        <Card icon={security.state === "ok" ? ShieldCheck : CircleAlert} title="Security" state={security.state} glow="hsl(0 70% 55%)">
          {security.data ? (
            <>
              <KV k="Injection scans flagged" v={security.data.total_flagged} />
              <KV k="Recent findings" v={security.data.recent_scans.length} />
              {security.data.total_flagged === 0 ? (
                <p className="text-[10px] font-mono text-primary pt-1">
                  No prompt-injection findings recorded.
                </p>
              ) : (
                <p className="text-[10px] font-mono text-terminal-amber pt-1">
                  {security.data.total_flagged} flagged input(s) — review in Security log.
                </p>
              )}
            </>
          ) : (
            <p className="text-[10px] font-mono text-terminal-red">
              {security.error ? `Unreachable — ${security.error}` : "…"}
            </p>
          )}
        </Card>
      </div>

      <p className="text-[9px] font-mono text-muted-foreground mt-4 text-center">
        Diagnostics read live data from the local backend. Unreachable panels mean the service is offline — nothing is simulated.
      </p>
    </div>
  );
};

export default DiagnosticsView;
