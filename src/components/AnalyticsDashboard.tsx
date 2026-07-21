import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { useUsageAnalytics } from "@/hooks/useUsageAnalytics";
import { Activity, Hash, Clock, Zap, Brain, Database, Mic, RefreshCw } from "lucide-react";
import { getBackendMode, getBackendUrl } from "@/lib/api";

const COLORS = [
  "hsl(142, 70%, 45%)",
  "hsl(185, 60%, 50%)",
  "hsl(38, 90%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 70%, 50%)",
  "hsl(210, 60%, 50%)",
];

const AGENT_COLORS: Record<string, string> = {
  Planner:    "hsl(280, 60%, 55%)",
  Supervisor: "hsl(38, 90%, 55%)",
  Researcher: "hsl(142, 70%, 45%)",
  Developer:  "hsl(185, 60%, 50%)",
  Critic:     "hsl(0, 70%, 50%)",
};

interface SessionData {
  agents: { name: string; requests: number; tokens: number; avg_ms: number }[];
  memory: { entries: number; graph_nodes: number };
  session: { total_requests: number; voice_sessions: number; uptime_s: number };
}

const useSessionAnalytics = () => {
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (getBackendMode() !== "local") return;
    setLoading(true);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/analytics/session`);
      if (resp.ok) setData(await resp.json());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  return { data, loading, refresh: load };
};

// ── Stat card ─────────────────────────────────────────────────────────────────

const StatCard = ({
  icon: Icon, label, value, sub, color,
}: { icon: typeof Hash; label: string; value: string; sub?: string; color: string }) => (
  <div className="border border-border rounded bg-card p-3">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
    <p className={`text-lg font-mono font-bold ${color}`}>{value}</p>
    {sub && <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

// ── Tooltip style ─────────────────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: {
    background: "hsl(220, 18%, 7%)",
    border: "1px solid hsl(142, 40%, 18%)",
    borderRadius: 4,
    fontSize: 10,
    fontFamily: "monospace",
  },
  labelStyle: { color: "hsl(142, 70%, 80%)" },
};

// ── Main component ────────────────────────────────────────────────────────────

const AnalyticsDashboard = () => {
  const { stats, loading: cloudLoading } = useUsageAnalytics();
  const { data: session, loading: sessionLoading, refresh } = useSessionAnalytics();
  const isLocal = getBackendMode() === "local";

  if (cloudLoading && sessionLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm font-mono text-muted-foreground animate-pulse">Loading analytics...</span>
      </div>
    );
  }

  const hasCloudData = stats && stats.totalRequests > 0;
  const hasSessionData = session && (session.session.total_requests > 0 || session.memory.entries > 0);

  if (!hasCloudData && !hasSessionData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Activity className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-mono text-muted-foreground">No usage data yet</p>
          <p className="text-[10px] text-muted-foreground">Send some messages to see analytics</p>
        </div>
      </div>
    );
  }

  const modelData = hasCloudData
    ? Object.entries(stats!.modelBreakdown).map(([model, v]) => ({
        name: model.split("/").pop() || model,
        requests: v.count,
        tokens: v.tokens,
      }))
    : [];

  const agentData = session?.agents
    .filter((a) => a.requests > 0)
    .map((a) => ({
      name: a.name,
      requests: a.requests,
      tokens: a.tokens,
      avgMs: a.avg_ms,
    })) ?? [];

  const uptimeMin = session ? Math.floor(session.session.uptime_s / 60) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-mono text-primary uppercase tracking-wider">Usage Analytics</h2>
        {isLocal && (
          <button onClick={refresh} disabled={sessionLoading}
            className="flex items-center gap-1.5 px-2 py-1 rounded border border-border text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3 h-3 ${sessionLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
      </div>

      {/* ── Cloud stats ── */}
      {hasCloudData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Hash}     label="Total Tokens"  value={stats!.totalTokens.toLocaleString()} color="text-terminal-cyan" />
          <StatCard icon={Zap}      label="Requests"      value={stats!.totalRequests.toString()}       color="text-primary" />
          <StatCard icon={Clock}    label="Avg Latency"   value={`${stats!.avgLatency}ms`}              color="text-terminal-amber" />
          <StatCard icon={Activity} label="Models Used"   value={Object.keys(stats!.modelBreakdown).length.toString()} color="text-accent" />
        </div>
      )}

      {/* ── Session stats (local mode) ── */}
      {hasSessionData && session && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Zap}      label="Session Requests" value={session.session.total_requests.toString()} color="text-primary"
            sub={`${uptimeMin}m uptime`} />
          <StatCard icon={Brain}    label="Memory Entries"   value={session.memory.entries.toString()}          color="text-accent"
            sub="HindsightMemory" />
          <StatCard icon={Database} label="Graph Nodes"      value={session.memory.graph_nodes.toString()}      color="text-terminal-magenta"
            sub="AlfredGraph" />
          <StatCard icon={Mic}      label="Voice Calls"      value={session.session.voice_sessions.toString()}  color="text-terminal-cyan"
            sub="PersonaPlex" />
        </div>
      )}

      {/* ── Daily token usage ── */}
      {hasCloudData && stats!.dailyUsage.length > 0 && (
        <div className="border border-border rounded bg-card p-4">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Daily Token Usage</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats!.dailyUsage}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(142, 20%, 50%)" }} />
              <YAxis tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(142, 20%, 50%)" }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="tokens" fill="hsl(142, 70%, 45%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Per-agent usage breakdown ── */}
      {agentData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-border rounded bg-card p-4">
            <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Agent Request Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={agentData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(142, 20%, 50%)" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(142, 20%, 50%)" }} width={70} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="requests" radius={[0, 2, 2, 0]}>
                  {agentData.map((entry) => (
                    <Cell key={entry.name} fill={AGENT_COLORS[entry.name] || "hsl(142, 70%, 45%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border border-border rounded bg-card p-4">
            <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Agent Token Usage</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={agentData} cx="50%" cy="50%" outerRadius={70}>
                <PolarGrid stroke="hsl(142, 40%, 14%)" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(142, 20%, 50%)" }} />
                <Radar dataKey="tokens" stroke="hsl(142, 70%, 45%)" fill="hsl(142, 70%, 45%)" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Agent performance table ── */}
      {agentData.length > 0 && (
        <div className="border border-border rounded bg-card p-4">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Agent Performance</h3>
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-1.5">Agent</th>
                <th className="text-right py-1.5">Requests</th>
                <th className="text-right py-1.5">Tokens</th>
                <th className="text-right py-1.5">Avg Latency</th>
                <th className="text-right py-1.5">Tok/req</th>
              </tr>
            </thead>
            <tbody>
              {agentData.map((a) => (
                <tr key={a.name} className="border-b border-border/50">
                  <td className="py-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: AGENT_COLORS[a.name] || "hsl(142, 70%, 45%)" }} />
                    {a.name}
                  </td>
                  <td className="py-1.5 text-right text-terminal-cyan">{a.requests}</td>
                  <td className="py-1.5 text-right text-foreground">
                    {a.tokens > 1000 ? `${(a.tokens / 1000).toFixed(1)}k` : a.tokens}
                  </td>
                  <td className="py-1.5 text-right text-terminal-amber">
                    {a.avgMs > 1000 ? `${(a.avgMs / 1000).toFixed(1)}s` : `${a.avgMs}ms`}
                  </td>
                  <td className="py-1.5 text-right text-muted-foreground">
                    {a.requests > 0 ? Math.round(a.tokens / a.requests) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Model breakdown ── */}
      {modelData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-border rounded bg-card p-4">
            <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Model Usage</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={modelData} dataKey="requests" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {modelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="border border-border rounded bg-card p-4">
            <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Model Details</h3>
            <div className="space-y-2">
              {modelData.map((m, i) => (
                <div key={m.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-[10px] font-mono text-foreground flex-1">{m.name}</span>
                  <span className="text-[9px] font-mono text-muted-foreground">{m.requests} req</span>
                  <span className="text-[9px] font-mono text-terminal-cyan">{m.tokens.toLocaleString()} tok</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
