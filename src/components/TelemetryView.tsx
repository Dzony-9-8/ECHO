import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Zap,
  BarChart3,
  TrendingUp,
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

// Generate mock time-series data
const generateData = (points: number) =>
  Array.from({ length: points }, (_, i) => ({
    time: `${i}s`,
    vram: 4.2 + Math.random() * 3,
    tokens: Math.floor(15 + Math.random() * 25),
    latency: Math.floor(80 + Math.random() * 200),
  }));

const agentPerformance = [
  { name: "Supervisor", tasks: 45, avgTime: 1.2, success: 98 },
  { name: "Researcher", tasks: 32, avgTime: 4.8, success: 89 },
  { name: "Developer", tasks: 28, avgTime: 3.2, success: 94 },
  { name: "Critic", tasks: 40, avgTime: 2.1, success: 96 },
];

const agentBarData = agentPerformance.map((a) => ({
  name: a.name,
  tasks: a.tasks,
  success: a.success,
}));

const TelemetryView = () => {
  const [data, setData] = useState(generateData(20));

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const next = [...prev.slice(1)];
        next.push({
          time: `${parseInt(prev[prev.length - 1].time) + 1}s`,
          vram: 4.2 + Math.random() * 3,
          tokens: Math.floor(15 + Math.random() * 25),
          latency: Math.floor(80 + Math.random() * 200),
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const latest = data[data.length - 1];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary glow-green" />
          <h2 className="text-xs uppercase tracking-widest text-primary font-display glow-green">
            System Telemetry
          </h2>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              icon: HardDrive,
              label: "VRAM Usage",
              value: `${latest.vram.toFixed(1)} GB`,
              sub: "/ 11 GB",
              color: "text-terminal-amber",
            },
            {
              icon: Zap,
              label: "Tokens/sec",
              value: `${latest.tokens}`,
              sub: "avg throughput",
              color: "text-primary",
            },
            {
              icon: Clock,
              label: "Latency",
              value: `${latest.latency} ms`,
              sub: "last request",
              color: "text-terminal-cyan",
            },
            {
              icon: BarChart3,
              label: "Tasks Completed",
              value: "145",
              sub: "this session",
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
              GPU VRAM (GB) — Real-time
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data}>
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
                  domain={[0, 11]}
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

          {/* Token/sec chart */}
          <div className="p-4 rounded border border-border bg-card">
            <div className="text-[10px] uppercase tracking-widest text-primary mb-3 font-display">
              Tokens/sec — Real-time
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "#666" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#666" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke="#4ade80"
                  fill="url(#tokenGrad)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent performance */}
        <div className="grid grid-cols-2 gap-4">
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

          {/* Agent stats table */}
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
                  <th className="text-right py-1.5">Success</th>
                </tr>
              </thead>
              <tbody>
                {agentPerformance.map((a) => (
                  <tr key={a.name} className="border-b border-border/50">
                    <td className="py-2 text-foreground">{a.name}</td>
                    <td className="py-2 text-right text-terminal-cyan">
                      {a.tasks}
                    </td>
                    <td className="py-2 text-right text-terminal-amber">
                      {a.avgTime}s
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={
                          a.success >= 95
                            ? "text-primary"
                            : a.success >= 90
                            ? "text-terminal-amber"
                            : "text-terminal-red"
                        }
                      >
                        {a.success}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelemetryView;
