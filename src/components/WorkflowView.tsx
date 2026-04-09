import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Code2, Search, Shield, Brain, Zap, Database, Network } from "lucide-react";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { getBackendMode, getBackendUrl } from "@/lib/api";

const AGENT_ICONS: Record<string, typeof Crown> = {
  Supervisor: Crown,
  Researcher: Search,
  Developer:  Code2,
  Critic:     Shield,
  Planner:    Brain,
};

const AGENT_COLORS: Record<string, string> = {
  Supervisor: "#d4a44a",
  Researcher: "#4ade80",
  Developer:  "#22d3ee",
  Critic:     "#ef4444",
  Planner:    "#a855f7",
};

// CoT phase → short badge label
const COT_PHASE_LABELS: Record<string, string> = {
  THINKING:   "💭",
  ANALYZING:  "🔍",
  PLANNING:   "📋",
  EXECUTING:  "🔧",
  VERIFYING:  "✅",
  FINALIZING: "📤",
};

const POSITIONS: Record<string, { x: number; y: number }> = {
  Planner:    { x: 50, y: 12 },
  Supervisor: { x: 50, y: 32 },
  Researcher: { x: 22, y: 60 },
  Developer:  { x: 78, y: 60 },
  Critic:     { x: 50, y: 82 },
};

const CONNECTIONS = [
  { from: "Planner",    to: "Supervisor" },
  { from: "Supervisor", to: "Researcher" },
  { from: "Supervisor", to: "Developer"  },
  { from: "Researcher", to: "Critic"     },
  { from: "Developer",  to: "Critic"     },
  { from: "Critic",     to: "Supervisor" },
];

const useSparkline = (value: number, len = 20) => {
  const buf = useRef<number[]>([]);
  buf.current = [...buf.current, value].slice(-len);
  return buf.current;
};

// ── Memory & CoT system metrics (polled separately) ──────────────────────────

interface SessionMetrics {
  memory_entries: number;
  graph_nodes: number;
  voice_sessions: number;
}

const useSessionMetrics = () => {
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  useEffect(() => {
    const mode = getBackendMode();
    if (mode !== "local") return;
    const poll = async () => {
      try {
        const resp = await fetch(`${getBackendUrl()}/api/analytics/session`);
        if (resp.ok) {
          const d = await resp.json();
          setMetrics({
            memory_entries: d.memory?.entries ?? 0,
            graph_nodes: d.memory?.graph_nodes ?? 0,
            voice_sessions: d.session?.voice_sessions ?? 0,
          });
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);
  return metrics;
};

// ── Agent card ────────────────────────────────────────────────────────────────

const AgentCard = ({
  name, status, model, currentTask,
  tokensProcessed, requestCount, totalResponseMs,
  currentPhase,
}: {
  name: string; status: string; model: string; currentTask?: string;
  tokensProcessed: number; requestCount: number; totalResponseMs: number;
  currentPhase?: string;
}) => {
  const Icon     = AGENT_ICONS[name] || Crown;
  const color    = AGENT_COLORS[name] || "#4ade80";
  const isActive = status === "active" || status === "processing";
  const avgMs    = requestCount > 0 ? Math.round(totalResponseMs / requestCount) : 0;
  const sparkBuf = useSparkline(isActive ? tokensProcessed % 100 : 0);
  const sparkMax  = Math.max(...sparkBuf, 1);
  const phaseEmoji = currentPhase ? (COT_PHASE_LABELS[currentPhase] ?? "🔧") : null;

  return (
    <motion.div
      animate={{ scale: isActive ? 1.06 : 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
      style={{ left: `${POSITIONS[name]?.x ?? 50}%`, top: `${POSITIONS[name]?.y ?? 50}%` }}
    >
      <div
        className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all min-w-[100px] ${
          isActive ? "border-current bg-muted" : "border-border/60 bg-card"
        }`}
        style={{
          color,
          boxShadow: isActive
            ? `0 0 20px ${color}35, 0 0 50px ${color}10, inset 0 0 20px ${color}08`
            : "0 2px 8px hsl(0 0% 0% / 0.3)",
        }}
      >
        {isActive && (
          <div className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 50% 30%, ${color}15 0%, transparent 70%)` }} />
        )}

        <div className="relative z-10 flex flex-col items-center gap-1">
          <div className="relative">
            <Icon className="w-5 h-5" />
            {isActive && (
              <div className="absolute -inset-2 rounded-full"
                style={{ border: `1px solid ${color}50`, animation: "pulse-glow 1.5s ease-in-out infinite" }} />
            )}
          </div>

          <span className="text-[11px] font-mono font-bold tracking-wide">{name}</span>
          <span className="text-[8px] text-muted-foreground font-mono truncate max-w-[85px]">{model}</span>

          {/* CoT phase badge */}
          {isActive && phaseEmoji && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-current/30 bg-current/10"
              style={{ color }} title={currentPhase}>
              {phaseEmoji} {currentPhase?.toLowerCase()}
            </span>
          )}

          {isActive && currentTask && !phaseEmoji && (
            <span className="text-[8px] font-mono text-center leading-tight opacity-75 max-w-[85px] line-clamp-2 mt-0.5"
              style={{ color }}>
              {currentTask}
            </span>
          )}

          {isActive && sparkBuf.length > 2 && (
            <svg viewBox="0 0 60 16" className="w-14 h-3 mt-1 opacity-70">
              {sparkBuf.map((v, i) => {
                const x = (i / (sparkBuf.length - 1)) * 56 + 2;
                const h = (v / sparkMax) * 12 + 1;
                const y = 15 - h;
                return (
                  <rect key={i} x={x - 1.2} y={y} width={2.4} height={h} rx={1}
                    fill={color} opacity={i === sparkBuf.length - 1 ? 1 : 0.4 + (i / sparkBuf.length) * 0.5} />
                );
              })}
            </svg>
          )}

          {requestCount > 0 && (
            <div className="text-[8px] text-muted-foreground font-mono text-center mt-0.5">
              {requestCount}× · {avgMs}ms
            </div>
          )}

          {isActive && (
            <motion.div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: color }}
              animate={{ opacity: [1, 0.2, 1], scale: [1, 0.8, 1] }}
              transition={{ repeat: Infinity, duration: 0.9 }} />
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const WorkflowView = () => {
  const { agents, activeAgent } = useAgentStatus(2000);
  const sessionMetrics = useSessionMetrics();
  const mode = getBackendMode();

  const getPos = (id: string) => POSITIONS[id] ?? { x: 50, y: 50 };
  const totalTokens = agents.reduce((s, a) => s + a.tokensProcessed, 0);
  const totalReqs   = agents.reduce((s, a) => s + a.requestCount, 0);

  // Derive current CoT phase from active agent's currentTask text
  const activeAgentData = agents.find((a) => a.name === activeAgent);
  const currentPhase = (() => {
    const task = activeAgentData?.currentTask?.toUpperCase() ?? "";
    if (task.includes("OBSERVE") || task.includes("THINKING")) return "THINKING";
    if (task.includes("ANALYZ")) return "ANALYZING";
    if (task.includes("PLAN")) return "PLANNING";
    if (task.includes("VERIF")) return "VERIFYING";
    if (task.includes("FINAL")) return "FINALIZING";
    if (activeAgent) return "EXECUTING";
    return undefined;
  })();

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ── Graph canvas ── */}
      <div className="flex-1 relative bg-background">
        <div className="absolute inset-0 scanline pointer-events-none z-10" />

        {/* Header */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
          <h2 className="text-xs uppercase tracking-widest text-primary font-display glow-green">
            Agent Workflow — Live
          </h2>
          <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
            activeAgent
              ? "border-primary text-primary bg-primary/10"
              : "border-border text-muted-foreground"
          }`} style={activeAgent ? { animation: "pulse-glow 2s ease-in-out infinite" } : {}}>
            {activeAgent ? `⚡ ${activeAgent}` : mode === "local" ? "Idle" : "Cloud Mode"}
          </span>
          {/* CoT phase indicator */}
          {currentPhase && (
            <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded border border-terminal-cyan/40 text-terminal-cyan bg-terminal-cyan/10">
              {currentPhase}
            </span>
          )}
        </div>

        {/* Summary stats */}
        {totalReqs > 0 && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground">
              <Zap className="w-3 h-3 text-terminal-amber" />
              <span className="text-terminal-amber">{totalTokens.toLocaleString()}</span>
              <span>tokens</span>
            </div>
            <div className="text-[9px] font-mono text-muted-foreground">{totalReqs} requests</div>
          </div>
        )}

        {/* Memory / Graph metrics strip at bottom of canvas */}
        {sessionMetrics && mode === "local" && (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-accent/30 bg-accent/5 text-[9px] font-mono text-accent">
              <Database className="w-3 h-3" />
              {sessionMetrics.memory_entries} memories
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-terminal-magenta/30 bg-terminal-magenta/5 text-[9px] font-mono text-terminal-magenta">
              <Network className="w-3 h-3" />
              {sessionMetrics.graph_nodes} graph nodes
            </div>
          </div>
        )}

        {/* SVG connections */}
        <svg className="absolute inset-0 w-full h-full z-0">
          <defs>
            {Object.entries(AGENT_COLORS).map(([name, color]) => (
              <filter key={name} id={`glow-${name}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            ))}
          </defs>

          {CONNECTIONS.map((conn) => {
            const from   = getPos(conn.from);
            const to     = getPos(conn.to);
            const connId = `${conn.from}-${conn.to}`;
            const isActive =
              (activeAgent === conn.from || activeAgent === conn.to) &&
              agents.find((a) => a.name === conn.from)?.status !== "idle";
            const strokeColor = isActive ? AGENT_COLORS[conn.from] || "#4ade80" : "hsl(142 40% 14%)";
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;

            return (
              <g key={connId}>
                <path
                  d={`M ${from.x}% ${from.y}% Q ${mx}% ${(my - 2).toFixed(1)}% ${to.x}% ${to.y}%`}
                  fill="none" stroke={strokeColor}
                  strokeWidth={isActive ? 2 : 1}
                  strokeDasharray={isActive ? "none" : "5 5"}
                  opacity={isActive ? 0.85 : 0.3}
                  filter={isActive ? `url(#glow-${conn.from})` : undefined}
                />
                {isActive && (
                  <circle r="3.5" fill={AGENT_COLORS[conn.from] || "#4ade80"} opacity="0.9">
                    <animateMotion dur="1.2s" repeatCount="indefinite"
                      path={`M ${(from.x / 100) * 800},${(from.y / 100) * 600} Q ${(mx / 100) * 800},${((my - 2) / 100) * 600} ${(to.x / 100) * 800},${(to.y / 100) * 600}`} />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Agent nodes */}
        {agents.map((agent) =>
          POSITIONS[agent.name] ? (
            <AgentCard key={agent.name} {...agent}
              currentPhase={agent.name === activeAgent ? currentPhase : undefined} />
          ) : null
        )}

        {agents.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border border-border rounded-lg flex items-center justify-center mx-auto opacity-30">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {mode === "local" ? "Connecting to backend…" : "Switch to Local Mode to see live agent graph"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Activity log ── */}
      <div className="w-72 border-l border-border bg-sidebar flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-terminal-amber font-display">Live Activity</span>
          <div className="flex items-center gap-1.5">
            {activeAgent && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary"
                style={{ animation: "pulse-glow 1.5s ease-in-out infinite" }} />
            )}
            <span className="text-[9px] font-mono text-muted-foreground">2s poll</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {agents.length === 0 && (
            <p className="text-[11px] text-muted-foreground font-mono">
              {mode === "local" ? "Waiting for agent activity…" : "Local mode required for live data."}
            </p>
          )}

          {agents.map((a) => {
            const color    = AGENT_COLORS[a.name] || "#4ade80";
            const isActive = a.status === "active" || a.status === "processing";
            const avgMs    = a.requestCount > 0 ? Math.round(a.totalResponseMs / a.requestCount) : 0;
            const tps      = a.requestCount > 0 && a.totalResponseMs > 0
              ? ((a.tokensProcessed / a.totalResponseMs) * 1000).toFixed(1)
              : null;

            return (
              <div key={a.name}
                className={`space-y-1.5 p-2 rounded-lg border transition-all ${
                  isActive ? "border-current bg-muted/60" : "border-border/40 bg-card/40"
                }`}
                style={isActive ? { color, boxShadow: `inset 2px 0 0 ${color}` } : {}}>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-current" : "bg-muted-foreground/40"}`}
                    style={isActive ? { animation: "pulse-glow 1.2s ease-in-out infinite" } : {}} />
                  <span className="font-bold flex-shrink-0" style={{ color }}>{a.name}</span>
                  <span className="text-muted-foreground text-[9px] capitalize truncate">{a.status}</span>
                  {/* CoT phase for this agent */}
                  {isActive && a.name === activeAgent && currentPhase && (
                    <span className="ml-auto text-[9px] font-mono" style={{ color }}>
                      {COT_PHASE_LABELS[currentPhase] ?? "🔧"}
                    </span>
                  )}
                </div>

                {a.currentTask && (
                  <div className="text-[9px] font-mono text-foreground/70 pl-3 line-clamp-2 leading-relaxed">
                    {a.currentTask}
                  </div>
                )}

                {a.requestCount > 0 && (
                  <div className="flex items-center gap-2 pl-3 flex-wrap">
                    <span className="text-[8px] font-mono text-muted-foreground">{a.tokensProcessed.toLocaleString()} tok</span>
                    <span className="text-[8px] text-muted-foreground">·</span>
                    <span className="text-[8px] font-mono text-muted-foreground">{a.requestCount}×</span>
                    <span className="text-[8px] text-muted-foreground">·</span>
                    <span className="text-[8px] font-mono text-muted-foreground">{avgMs}ms avg</span>
                    {tps && (
                      <>
                        <span className="text-[8px] text-muted-foreground">·</span>
                        <span className="text-[8px] font-mono text-terminal-cyan">{tps} tok/s</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Memory system summary at bottom of sidebar */}
        {sessionMetrics && mode === "local" && (
          <div className="border-t border-border p-3 space-y-1.5">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Memory System</span>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-1.5 rounded border border-accent/20 bg-accent/5 text-center">
                <div className="text-[11px] font-mono text-accent font-bold">{sessionMetrics.memory_entries}</div>
                <div className="text-[8px] font-mono text-muted-foreground">memories</div>
              </div>
              <div className="p-1.5 rounded border border-terminal-magenta/20 bg-terminal-magenta/5 text-center">
                <div className="text-[11px] font-mono text-terminal-magenta font-bold">{sessionMetrics.graph_nodes}</div>
                <div className="text-[8px] font-mono text-muted-foreground">graph nodes</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowView;
