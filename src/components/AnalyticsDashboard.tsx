import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useUsageAnalytics } from "@/hooks/useUsageAnalytics";
import { Activity, Hash, Clock, Zap } from "lucide-react";

const COLORS = [
  "hsl(142, 70%, 45%)",
  "hsl(185, 60%, 50%)",
  "hsl(38, 90%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 70%, 50%)",
  "hsl(210, 60%, 50%)",
];

const AnalyticsDashboard = () => {
  const { stats, loading } = useUsageAnalytics();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm font-mono text-muted-foreground animate-pulse">Loading analytics...</span>
      </div>
    );
  }

  if (!stats || stats.totalRequests === 0) {
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

  const modelData = Object.entries(stats.modelBreakdown).map(([model, v]) => ({
    name: model.split("/").pop() || model,
    requests: v.count,
    tokens: v.tokens,
  }));

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <h2 className="text-sm font-mono text-primary uppercase tracking-wider">Usage Analytics</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Hash} label="Total Tokens" value={stats.totalTokens.toLocaleString()} color="text-terminal-cyan" />
        <StatCard icon={Zap} label="Requests" value={stats.totalRequests.toString()} color="text-primary" />
        <StatCard icon={Clock} label="Avg Latency" value={`${stats.avgLatency}ms`} color="text-terminal-amber" />
        <StatCard icon={Activity} label="Models Used" value={Object.keys(stats.modelBreakdown).length.toString()} color="text-accent" />
      </div>

      {/* Daily usage chart */}
      {stats.dailyUsage.length > 0 && (
        <div className="border border-border rounded bg-card p-4">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Daily Token Usage</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.dailyUsage}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(142, 20%, 50%)" }} />
              <YAxis tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(142, 20%, 50%)" }} />
              <Tooltip
                contentStyle={{ background: "hsl(220, 18%, 7%)", border: "1px solid hsl(142, 40%, 18%)", borderRadius: 4, fontSize: 10, fontFamily: "monospace" }}
                labelStyle={{ color: "hsl(142, 70%, 80%)" }}
              />
              <Bar dataKey="tokens" fill="hsl(142, 70%, 45%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Model breakdown */}
      {modelData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-border rounded bg-card p-4">
            <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Model Usage</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={modelData} dataKey="requests" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {modelData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(220, 18%, 7%)", border: "1px solid hsl(142, 40%, 18%)", borderRadius: 4, fontSize: 10, fontFamily: "monospace" }} />
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

const StatCard = ({ icon: Icon, label, value, color }: { icon: typeof Hash; label: string; value: string; color: string }) => (
  <div className="border border-border rounded bg-card p-3">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
    <p className={`text-lg font-mono font-bold ${color}`}>{value}</p>
  </div>
);

export default AnalyticsDashboard;
