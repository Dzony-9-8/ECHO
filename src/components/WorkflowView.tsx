import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crown, Code2, Search, Shield, ArrowRight, Zap } from "lucide-react";

interface AgentNode {
  id: string;
  name: string;
  icon: typeof Crown;
  model: string;
  color: string;
  x: number;
  y: number;
  status: "idle" | "active" | "processing" | "complete";
}

const initialNodes: AgentNode[] = [
  { id: "supervisor", name: "Supervisor", icon: Crown, model: "LLaMA 3.1", color: "#d4a44a", x: 50, y: 15, status: "idle" },
  { id: "researcher", name: "Researcher", icon: Search, model: "DeepSeek R1", color: "#4ade80", x: 25, y: 45, status: "idle" },
  { id: "developer", name: "Developer", icon: Code2, model: "DeepSeek Coder", color: "#22d3ee", x: 75, y: 45, status: "idle" },
  { id: "critic", name: "Critic", icon: Shield, model: "DeepSeek R1", color: "#ef4444", x: 50, y: 75, status: "idle" },
];

const connections = [
  { from: "supervisor", to: "researcher" },
  { from: "supervisor", to: "developer" },
  { from: "researcher", to: "critic" },
  { from: "developer", to: "critic" },
  { from: "critic", to: "supervisor" },
];

const WorkflowView = () => {
  const [nodes, setNodes] = useState(initialNodes);
  const [activeConnection, setActiveConnection] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [logs, setLogs] = useState<{ agent: string; action: string; time: string }[]>([]);

  const simulate = async () => {
    if (simulating) return;
    setSimulating(true);
    setLogs([]);

    const steps = [
      { nodeId: "supervisor", connId: null, log: "Analyzing user request..." },
      { nodeId: "supervisor", connId: "supervisor-researcher", log: "Delegating to Researcher" },
      { nodeId: "researcher", connId: null, log: "Performing deep research..." },
      { nodeId: "researcher", connId: "supervisor-developer", log: "Research complete" },
      { nodeId: "supervisor", connId: "supervisor-developer", log: "Delegating to Developer" },
      { nodeId: "developer", connId: null, log: "Generating code solution..." },
      { nodeId: "developer", connId: "developer-critic", log: "Sending to Critic" },
      { nodeId: "critic", connId: null, log: "Evaluating output quality..." },
      { nodeId: "critic", connId: "critic-supervisor", log: "Feedback: PASS ✓" },
      { nodeId: "supervisor", connId: null, log: "Final response synthesized" },
    ];

    for (const step of steps) {
      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          status: n.id === step.nodeId ? "active" : n.status === "active" ? "complete" : n.status,
        }))
      );
      setActiveConnection(step.connId);
      setLogs((prev) => [
        ...prev,
        {
          agent: nodes.find((n) => n.id === step.nodeId)?.name || "",
          action: step.log,
          time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        },
      ]);
      await new Promise((r) => setTimeout(r, 1200));
    }

    setNodes(initialNodes);
    setActiveConnection(null);
    setSimulating(false);
  };

  const getNodePos = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    return node ? { x: node.x, y: node.y } : { x: 50, y: 50 };
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Graph area */}
      <div className="flex-1 relative bg-background">
        <div className="absolute inset-0 scanline pointer-events-none z-10" />

        {/* Header */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
          <h2 className="text-xs uppercase tracking-widest text-primary font-display glow-green">
            Agent Workflow Graph
          </h2>
          <button
            onClick={simulate}
            disabled={simulating}
            className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-mono border border-primary text-primary bg-primary/10 hover:bg-primary/20 rounded transition-colors disabled:opacity-40"
          >
            <Zap className="w-3 h-3 inline mr-1" />
            {simulating ? "Running..." : "Simulate Flow"}
          </button>
        </div>

        {/* SVG connections */}
        <svg className="absolute inset-0 w-full h-full z-0">
          {connections.map((conn) => {
            const from = getNodePos(conn.from);
            const to = getNodePos(conn.to);
            const connId = `${conn.from}-${conn.to}`;
            const isActive = activeConnection === connId;
            return (
              <g key={connId}>
                <line
                  x1={`${from.x}%`}
                  y1={`${from.y}%`}
                  x2={`${to.x}%`}
                  y2={`${to.y}%`}
                  stroke={isActive ? "#4ade80" : "hsl(142 40% 18%)"}
                  strokeWidth={isActive ? 2 : 1}
                  strokeDasharray={isActive ? "none" : "4 4"}
                  opacity={isActive ? 1 : 0.4}
                />
                {isActive && (
                  <circle r="4" fill="#4ade80">
                    <animateMotion
                      dur="0.8s"
                      repeatCount="1"
                      path={`M${(from.x / 100) * 800},${(from.y / 100) * 600} L${(to.x / 100) * 800},${(to.y / 100) * 600}`}
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Agent nodes */}
        {nodes.map((node) => (
          <motion.div
            key={node.id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            animate={{
              scale: node.status === "active" ? 1.1 : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            <div
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                node.status === "active"
                  ? "border-current glow-border bg-muted"
                  : node.status === "complete"
                  ? "border-border bg-muted/50 opacity-60"
                  : "border-border bg-card"
              }`}
              style={{
                color: node.color,
                boxShadow:
                  node.status === "active"
                    ? `0 0 20px ${node.color}30, 0 0 40px ${node.color}10`
                    : "none",
              }}
            >
              <node.icon className="w-6 h-6" />
              <div className="text-xs font-mono font-bold">{node.name}</div>
              <div className="text-[9px] text-muted-foreground">{node.model}</div>
              {node.status === "active" && (
                <motion.div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: node.color }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                />
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Activity log */}
      <div className="w-72 border-l border-border bg-sidebar flex flex-col">
        <div className="p-3 border-b border-border">
          <span className="text-[10px] uppercase tracking-widest text-terminal-amber font-display">
            Activity Log
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {logs.length === 0 && (
            <p className="text-[11px] text-muted-foreground font-mono">
              Click "Simulate Flow" to see agents in action...
            </p>
          )}
          {logs.map((log, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-2 text-[11px] font-mono"
            >
              <span className="text-muted-foreground flex-shrink-0">{log.time}</span>
              <span className="text-terminal-amber flex-shrink-0">[{log.agent}]</span>
              <span className="text-foreground">{log.action}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkflowView;
