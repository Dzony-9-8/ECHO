import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Activity, HardDrive, Clock, Zap, BarChart3, Database,
  AlertCircle, Cpu, MemoryStick, Brain, Network,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  BarChart, Bar, Tooltip,
} from "recharts";
import { getBackendMode, fetchTelemetry, type TelemetryData } from "@/lib/api";

interface VramPoint { time: string; vram: number }
interface CpuPoint  { time: string; cpu: number }

const tooltipStyle = {
  contentStyle: {
    background: "hsl(220 18% 7%)",
    border: "1px solid hsl(142 40% 18%)",
    borderRadius: "4px",
    fontSize: "11px",
    fontFamily: "JetBrains Mono",
  },
};

// ── Stat card ─────────────────────────────────────────────────────────────────

const StatCard = ({
  icon: Icon, label, value, sub, color, warn,
}: { icon: typeof HardDrive; label: string; value: string; sub?: string; color: string; warn?: boolean }) => (
  <motion.div
    className={`p-4 rounded border bg-card ${warn ? "border-terminal-red/50" : "border-border"}`}
    whileHover={{ borderColor: "hsl(142 40% 30%)" }}
  >
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`w-4 h-4 ${warn ? "text-terminal-red" : color}`} />
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
    <div className={`text-2xl font-display ${warn ? "text-terminal-red" : color}`}>{value}</div>
    {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
  </motion.div>
);

// ── Usage bar ─────────────────────────────────────────────────────────────────

const UsageBar = ({ pct, color }: { pct: number; color: string }) => (
  <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden mt-1">
    <div className="h-full rounded-full transition-all duration-500"
      style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const TelemetryView = () => {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [vramHistory, setVramHistory] = useState<VramPoint[]>([]);
  const [cpuHistory, setCpuHistory]   = useState<CpuPoint[]>([]);
  const [offline, setOffline]         = useState(false);
  const tickRef = useRef(0);

  useEffect(() => {
    const mode = getBackendMode();
    if (mode !== "local") return;

    const poll = async () => {
      const data = await fetchTelemetry();
      if (data) {
        setTelemetry(data);
        setOffline(false);
        tickRef.current += 1;
        const label = `${tickRef.current * 3}s`;

        setVramHistory((prev) => {
          const next = [...prev, { time: label, vram: data.vram.used_mb / 1024 }];
          return next.length > 20 ? next.slice(-20) : next;
        });
        setCpuHistory((prev) => {
          const next = [...prev, { time: label, cpu: data.cpu?.percent ?? 0 }];
          return next.length > 20 ? next.slice(-20) : next;
        });
      } else {
        setOffline(true);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  const mode = getBackendMode();

  if (mode !== "local") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground font-mono">Telemetry requires Local Mode</p>
          <p className="text-[10px] text-muted-foreground/60 font-mono">Switch to local backend in settings</p>
        </div>
      </div>
    );
  }

  if (offline || !telemetry) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Activity className="w-8 h-8 text-muted-foreground mx-auto animate-pulse" />
          <p className="text-sm text-muted-foreground font-mono">
            {offline ? "Backend offline" : "Loading telemetry..."}
          </p>
        </div>
      </div>
    );
  }

  const totalTasks  = telemetry.agents.reduce((s, a) => s + a.tasks, 0);
  const totalTokens = telemetry.agents.reduce((s, a) => s + a.tokensProcessed, 0);
  const avgLatency  = totalTasks > 0
    ? Math.round(telemetry.agents.reduce((s, a) => s + a.avgTimeMs * a.tasks, 0) / totalTasks)
    : 0;
  const vramTotalGb = telemetry.vram.total_mb / 1024;
  const ramTotalGb  = telemetry.ram ? telemetry.ram.total_mb / 1024 : 0;

  const agentBarData = telemetry.agents.map((a) => ({
    name: a.name,
    tasks: a.tasks,
    tokens: Math.round(a.tokensProcessed / 1000),
  }));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary glow-green" />
          <h2 className="text-xs uppercase tracking-widest text-primary font-display glow-green">System Telemetry</h2>
          <span className="text-[9px] text-muted-foreground font-mono ml-auto">
            uptime: {Math.floor(telemetry.uptime / 60)}m {telemetry.uptime % 60}s
          </span>
        </div>

        {/* ── Hardware stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={HardDrive} label="VRAM Usage"
            value={`${(telemetry.vram.used_mb / 1024).toFixed(1)} GB`}
            sub={`/ ${vramTotalGb.toFixed(0)} GB (${telemetry.vram.percent}%)`}
            color="text-terminal-amber"
            warn={telemetry.vram.percent > 90} />
          {telemetry.ram && (
            <StatCard icon={MemoryStick} label="RAM Usage"
              value={`${(telemetry.ram.used_mb / 1024).toFixed(1)} GB`}
              sub={`/ ${ramTotalGb.toFixed(0)} GB (${telemetry.ram.percent}%)`}
              color="text-terminal-cyan"
              warn={telemetry.ram.percent > 90} />
          )}
          {telemetry.cpu && (
            <StatCard icon={Cpu} label="CPU"
              value={`${telemetry.cpu.percent.toFixed(0)}%`}
              sub="overall utilization"
              color="text-primary"
              warn={telemetry.cpu.percent > 90} />
          )}
          <StatCard icon={Zap} label="Total Tokens"
            value={totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : `${totalTokens}`}
            sub="processed this session"
            color="text-primary" />
          <StatCard icon={Clock} label="Avg Latency"
            value={avgLatency > 1000 ? `${(avgLatency / 1000).toFixed(1)}s` : `${avgLatency}ms`}
            sub="per agent task"
            color="text-terminal-cyan" />
          <StatCard icon={Database} label="Cache"
            value={`${telemetry.cache.hit_rate}%`}
            sub={`${telemetry.cache.hits} hits / ${telemetry.cache.entries} entries`}
            color="text-terminal-magenta" />
        </div>

        {/* ── Real-time charts ── */}
        <div className="grid grid-cols-2 gap-4">
          {/* VRAM chart */}
          <div className="p-4 rounded border border-border bg-card">
            <div className="text-[10px] uppercase tracking-widest text-terminal-amber mb-3 font-display">
              GPU VRAM (GB) — Real-time
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={vramHistory}>
                <defs>
                  <linearGradient id="vramGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d4a44a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#d4a44a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#666" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, Math.ceil(vramTotalGb)]} tick={{ fontSize: 9, fill: "#666" }} axisLine={false} tickLine={false} />
                <Area type="monotone" dataKey="vram" stroke="#d4a44a" fill="url(#vramGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* CPU chart */}
          <div className="p-4 rounded border border-border bg-card">
            <div className="text-[10px] uppercase tracking-widest text-primary mb-3 font-display">
              CPU Utilization (%) — Real-time
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={cpuHistory}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142 70% 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142 70% 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#666" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#666" }} axisLine={false} tickLine={false} />
                <Area type="monotone" dataKey="cpu" stroke="hsl(142 70% 45%)" fill="url(#cpuGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Agent perf table + models loaded ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded border border-border bg-card">
            <div className="text-[10px] uppercase tracking-widest text-terminal-magenta mb-3 font-display">
              Agent Performance Metrics
            </div>
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5">Agent</th>
                  <th className="text-right py-1.5">Tasks</th>
                  <th className="text-right py-1.5">Avg Time</th>
                  <th className="text-right py-1.5">Tokens</th>
                  <th className="text-right py-1.5">●</th>
                </tr>
              </thead>
              <tbody>
                {telemetry.agents.map((a) => (
                  <tr key={a.name} className="border-b border-border/50">
                    <td className="py-2 text-foreground">{a.name}</td>
                    <td className="py-2 text-right text-terminal-cyan">{a.tasks}</td>
                    <td className="py-2 text-right text-terminal-amber">
                      {a.avgTimeMs > 1000 ? `${(a.avgTimeMs / 1000).toFixed(1)}s` : `${a.avgTimeMs}ms`}
                    </td>
                    <td className="py-2 text-right text-foreground">
                      {a.tokensProcessed > 1000 ? `${(a.tokensProcessed / 1000).toFixed(1)}k` : a.tokensProcessed}
                    </td>
                    <td className="py-2 text-right">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                        a.status === "active" ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
                      }`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded border border-border bg-card">
            <div className="text-[10px] uppercase tracking-widest text-primary mb-3 font-display flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Agent Task Distribution
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={agentBarData}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#666" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#666" }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="tasks" fill="#22d3ee" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Loaded models + throughput ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded border border-border bg-card">
            <div className="text-[10px] uppercase tracking-widest text-primary mb-3 font-display">
              Loaded Models ({telemetry.models_loaded.length})
            </div>
            <div className="space-y-2">
              {telemetry.models_loaded.map((m) => (
                <div key={m} className="flex items-center gap-2 px-2 py-1.5 rounded border border-border/50 bg-muted/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-[11px] font-mono text-foreground flex-1 truncate">{m}</span>
                </div>
              ))}
              {telemetry.models_loaded.length === 0 && (
                <p className="text-[10px] text-muted-foreground font-mono">No models loaded</p>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[10px] font-mono">
              <span className="text-muted-foreground uppercase tracking-wider">Pipeline Queue</span>
              <span className={telemetry.pipeline_queue > 0 ? "text-terminal-amber" : "text-muted-foreground"}>
                {telemetry.pipeline_queue} active
              </span>
            </div>
          </div>

          {/* Per-model Ollama throughput */}
          <div className="p-4 rounded border border-border bg-card">
            <div className="text-[10px] uppercase tracking-widest text-terminal-amber mb-3 font-display">
              Model VRAM Allocation
            </div>
            {(telemetry.model_throughput ?? []).length > 0 ? (
              <div className="space-y-3">
                {(telemetry.model_throughput ?? []).map((m) => {
                  const vramPct = telemetry.vram.total_mb > 0
                    ? Math.round((m.vram_mb / telemetry.vram.total_mb) * 100)
                    : 0;
                  return (
                    <div key={m.name} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-foreground truncate flex-1 mr-2">{m.name.split(":")[0]}</span>
                        <span className="text-terminal-amber flex-shrink-0">{m.vram_mb}MB VRAM</span>
                      </div>
                      <UsageBar pct={vramPct} color="hsl(38 90% 55%)" />
                      <div className="text-[8px] font-mono text-muted-foreground">
                        {m.size_mb}MB total · {vramPct}% of GPU
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground font-mono">No active models in Ollama /api/ps</p>
            )}
          </div>
        </div>

        {/* ── Memory system stats ── */}
        {telemetry.memory_stats && (
          <div className="p-4 rounded border border-border bg-card">
            <div className="text-[10px] uppercase tracking-widest text-accent mb-3 font-display flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" />
              Memory System (HindsightMemory + ReMe + AlfredGraph)
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-display text-accent">{telemetry.memory_stats.entries}</div>
                <div className="text-[9px] text-muted-foreground font-mono">stored memories</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-display text-terminal-magenta">
                  {telemetry.memory_stats.last_compaction === "never"
                    ? "—"
                    : new Date(telemetry.memory_stats.last_compaction).toLocaleTimeString()}
                </div>
                <div className="text-[9px] text-muted-foreground font-mono">last ReMe compaction</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-display text-primary">{telemetry.pipeline_queue}</div>
                <div className="text-[9px] text-muted-foreground font-mono">active pipeline tasks</div>
              </div>
            </div>
          </div>
        )}

        {/* ── RAM usage bar (if available) ── */}
        {telemetry.ram && (
          <div className="p-4 rounded border border-border bg-card">
            <div className="text-[10px] uppercase tracking-widest text-terminal-cyan mb-3 font-display flex items-center gap-1.5">
              <MemoryStick className="w-3.5 h-3.5" />
              System Memory
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Used</span>
                <span className="text-terminal-cyan">
                  {(telemetry.ram.used_mb / 1024).toFixed(1)} GB / {(telemetry.ram.total_mb / 1024).toFixed(1)} GB
                </span>
              </div>
              <UsageBar pct={telemetry.ram.percent} color="hsl(185 60% 50%)" />
              <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                <span>{telemetry.ram.percent}% utilized</span>
                <span>{((telemetry.ram.total_mb - telemetry.ram.used_mb) / 1024).toFixed(1)} GB free</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TelemetryView;
