import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  HardDrive,
  Clock,
  Zap,
  BarChart3,
  Database,
  AlertCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  Tooltip,
} from "recharts";
import { getBackendMode, fetchTelemetry, type TelemetryData } from "@/lib/api";

interface VramPoint {
  time: string;
  vram: number;
}

const TelemetryView = () => {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [vramHistory, setVramHistory] = useState<VramPoint[]>([]);
  const [offline, setOffline] = useState(false);
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
        setVramHistory((prev) => {
          const next = [...prev, { time: `${tickRef.current * 3}s`, vram: data.vram.used_mb / 1024 }];
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
          <p className="text-sm text-muted-foreground font-mono">
            Telemetry requires Local Mode
          </p>
          <p className="text-[10px] text-muted-foreground/60 font-mono">
            Switch to local backend in settings
          </p>
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

  const totalTasks = telemetry.agents.reduce((s, a) => s + a.tasks, 0);
  const totalTokens = telemetry.agents.reduce((s, a) => s + a.tokensProcessed, 0);
  const avgLatency = totalTasks > 0
    ? Math.round(telemetry.agents.reduce((s, a) => s + a.avgTimeMs * a.tasks, 0) / totalTasks)
    : 0;
  const vramTotalGb = telemetry.vram.total_mb / 1024;

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
          <h2 className="text-xs uppercase tracking-widest text-primary font-display glow-green">
            System Telemetry
          </h2>
          <span className="text-[9px] text-muted-foreground font-mono ml-auto">
            uptime: {Math.floor(telemetry.uptime / 60)}m {telemetry.uptime % 60}s
          </span>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              icon: HardDrive,
              label: "VRAM Usage",
              value: `${(telemetry.vram.used_mb / 1024).toFixed(1)} GB`,
              sub: `/ ${vramTotalGb.toFixed(0)} GB (${telemetry.vram.percent}%)`,
              color: telemetry.vram.percent > 85 ? "text-terminal-red" : "text-terminal-amber",
            },
            {
              icon: Zap,
              label: "Total Tokens",
              value: totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : `${totalTokens}`,
              sub: "processed this session",
              color: "text-primary",
            },
            {
              icon: Clock,
              label: "Avg Latency",
              value: avgLatency > 1000 ? `${(avgLatency / 1000).toFixed(1)}s` : `${avgLatency}ms`,
              sub: "per agent task",
              color: "text-terminal-cyan",
            },
            {
              icon: Database,
              label: "Cache",
              value: `${telemetry.cache.hit_rate}%`,
              sub: `${telemetry.cache.hits} hits / ${telemetry.cache.entries} entries`,
              color: "text-terminal-magenta",
            },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              className="p-4 rounded border border-border bg-card"
              whileHover={{ borderColor: "hsl(142 40% 30%)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </span>
              </div>
              <div className={`text-2xl font-display ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {stat.sub}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-4">
          {/* VRAM chart */}
          <div className="p-4 rounded border border-border bg-card">
            <div className="text-[10px] uppercase tracking-widest text-terminal-amber mb-3 font-display">
              GPU VRAM (GB) - Real-time
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={vramHistory}>
                <defs>
                  <linearGradient id="vramGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d4a44a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#d4a44a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "#666" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, Math.ceil(vramTotalGb)]}
                  tick={{ fontSize: 9, fill: "#666" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Area
                  type="monotone"
                  dataKey="vram"
                  stroke="#d4a44a"
                  fill="url(#vramGrad)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Agent task bar chart */}
          <div className="p-4 rounded border border-border bg-card">
            <div className="text-[10px] uppercase tracking-widest text-terminal-cyan mb-3 font-display">
              Agent Task Distribution
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={agentBarData}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "#666" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#666" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220 18% 7%)",
                    border: "1px solid hsl(142 40% 18%)",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontFamily: "JetBrains Mono",
                  }}
                />
                <Bar dataKey="tasks" fill="#22d3ee" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent performance table + models loaded */}
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
                  <th className="text-right py-1.5">Status</th>
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

          {/* Models loaded */}
          <div className="p-4 rounded border border-border bg-card">
            <div className="text-[10px] uppercase tracking-widest text-primary mb-3 font-display">
              <BarChart3 className="w-3.5 h-3.5 inline mr-1" />
              Loaded Models ({telemetry.models_loaded.length})
            </div>
            <div className="space-y-2">
              {telemetry.models_loaded.map((m) => (
                <div
                  key={m}
                  className="flex items-center gap-2 px-2 py-1.5 rounded border border-border/50 bg-muted/20"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-[11px] font-mono text-foreground flex-1 truncate">
                    {m}
                  </span>
                </div>
              ))}
              {telemetry.models_loaded.length === 0 && (
                <p className="text-[10px] text-muted-foreground font-mono">
                  No models loaded
                </p>
              )}
            </div>

            {/* Pipeline queue */}
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-muted-foreground uppercase tracking-wider">Pipeline Queue</span>
                <span className={telemetry.pipeline_queue > 0 ? "text-terminal-amber" : "text-muted-foreground"}>
                  {telemetry.pipeline_queue} active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelemetryView;
