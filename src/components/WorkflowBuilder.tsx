import { useState } from "react";
import { motion } from "framer-motion";
import {
  Crown, Code2, Search, Shield, Brain,
  GripVertical, Play, Save, Trash2, Plus, ChevronDown, ChevronUp,
} from "lucide-react";
import { sendMessage, getBackendMode } from "@/lib/api";
import type { ChatMessage } from "@/lib/api";
import { toast } from "sonner";

// ── Agent definitions ──────────────────────────────────────────────────────

interface AgentDef {
  name: string;
  color: string;
  Icon: typeof Crown;
  description: string;
  defaultPrompt: string;
}

const AGENTS: AgentDef[] = [
  {
    name: "Planner",
    color: "#a855f7",
    Icon: Brain,
    description: "Decomposes tasks into subtask plans",
    defaultPrompt: "You are a strategic planner. Break the user request into clear subtasks.",
  },
  {
    name: "Supervisor",
    color: "#d4a44a",
    Icon: Crown,
    description: "Orchestrates and delegates to sub-agents",
    defaultPrompt: "You are the supervisor. Coordinate the team and synthesize results.",
  },
  {
    name: "Researcher",
    color: "#4ade80",
    Icon: Search,
    description: "Searches knowledge and the web",
    defaultPrompt: "You are a researcher. Find relevant information and cite sources.",
  },
  {
    name: "Developer",
    color: "#22d3ee",
    Icon: Code2,
    description: "Writes and reviews code",
    defaultPrompt: "You are a developer. Write clean, well-commented code.",
  },
  {
    name: "Critic",
    color: "#ef4444",
    Icon: Shield,
    description: "Reviews and quality-checks outputs",
    defaultPrompt: "You are a critic. Review all outputs for quality, accuracy, and completeness.",
  },
];

// ── Saved workflow type ────────────────────────────────────────────────────

interface WorkflowAgent {
  name: string;
  enabled: boolean;
  systemPrompt: string;
  order: number;
}

interface SavedWorkflow {
  id: string;
  name: string;
  agents: WorkflowAgent[];
  depth: number;
  enablePlanning: boolean;
  createdAt: string;
}

const STORAGE_KEY = "echo_workflows";

const loadWorkflows = (): SavedWorkflow[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveWorkflows = (workflows: SavedWorkflow[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
};

// ── Component ──────────────────────────────────────────────────────────────

const WorkflowBuilder = () => {
  const mode = getBackendMode();

  // workflow agent state
  const [agents, setAgents] = useState<WorkflowAgent[]>(
    AGENTS.map((a, i) => ({
      name: a.name,
      enabled: true,
      systemPrompt: a.defaultPrompt,
      order: i,
    }))
  );

  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("Custom Workflow");
  const [depth, setDepth] = useState(1);
  const [enablePlanning, setEnablePlanning] = useState(true);
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>(loadWorkflows);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const sortedAgents = [...agents].sort((a, b) => a.order - b.order);

  const toggle = (name: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.name === name ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const updatePrompt = (name: string, systemPrompt: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.name === name ? { ...a, systemPrompt } : a))
    );
  };

  // Drag-to-reorder
  const handleDragStart = (name: string) => setDragging(name);
  const handleDragOver = (e: React.DragEvent, name: string) => {
    e.preventDefault();
    setDragOver(name);
  };
  const handleDrop = (targetName: string) => {
    if (!dragging || dragging === targetName) { setDragging(null); setDragOver(null); return; }
    const fromOrder = agents.find((a) => a.name === dragging)!.order;
    const toOrder = agents.find((a) => a.name === targetName)!.order;
    setAgents((prev) =>
      prev.map((a) => {
        if (a.name === dragging) return { ...a, order: toOrder };
        if (fromOrder < toOrder && a.order > fromOrder && a.order <= toOrder)
          return { ...a, order: a.order - 1 };
        if (fromOrder > toOrder && a.order >= toOrder && a.order < fromOrder)
          return { ...a, order: a.order + 1 };
        return a;
      })
    );
    setDragging(null);
    setDragOver(null);
  };

  // ── Save / load ──────────────────────────────────────────────────────────

  const handleSave = () => {
    const wf: SavedWorkflow = {
      id: Date.now().toString(),
      name: workflowName,
      agents,
      depth,
      enablePlanning,
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedWorkflows, wf];
    setSavedWorkflows(updated);
    saveWorkflows(updated);
    toast.success("Workflow saved");
  };

  const handleLoad = (wf: SavedWorkflow) => {
    setWorkflowName(wf.name);
    setAgents(wf.agents);
    setDepth(wf.depth);
    setEnablePlanning(wf.enablePlanning);
    toast.success(`Loaded: ${wf.name}`);
  };

  const handleDelete = (id: string) => {
    const updated = savedWorkflows.filter((w) => w.id !== id);
    setSavedWorkflows(updated);
    saveWorkflows(updated);
  };

  // ── Run workflow ─────────────────────────────────────────────────────────

  const handleRun = async () => {
    if (!prompt.trim()) { toast.error("Enter a prompt to run"); return; }
    if (mode !== "local") { toast.error("Local mode required to run workflows"); return; }
    const enabledAgents = sortedAgents
      .filter((a) => a.enabled)
      .map((a) => ({ name: a.name, system_prompt: a.systemPrompt }));
    if (enabledAgents.length === 0) { toast.error("Enable at least one agent"); return; }

    setRunning(true);
    setResult("");
    try {
      const messages: ChatMessage[] = [
        { id: "1", role: "user", content: prompt, timestamp: new Date() },
      ];
      const workflowDef = { agents: enabledAgents, depth, enable_planning: enablePlanning };
      const response = await sendMessage(
        messages,
        (chunk) => setResult(chunk),
        depth,
        undefined
      );
      // sendMessage doesn't pass workflow yet — build the fetch directly
      const url = localStorage.getItem("echo_backend_url") || "http://localhost:8000";
      const resp = await fetch(`${url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          enable_planning: enablePlanning,
          enable_reflection: false,
          workflow: workflowDef,
        }),
      });
      if (!resp.ok) throw new Error(`Backend error: ${resp.status}`);
      // Handle SSE or JSON
      if (resp.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = resp.body!.getReader();
        const dec = new TextDecoder();
        let buf = "", full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const j = line.slice(6).trim();
            if (j === "[DONE]") break;
            try {
              const p = JSON.parse(j);
              const c = p.choices?.[0]?.delta?.content as string | undefined;
              if (c) { full += c; setResult(full); }
            } catch { /* ignore */ }
          }
        }
      } else {
        const data = await resp.json();
        setResult(data.response || data.content || "");
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || "Workflow failed");
    } finally {
      setRunning(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: builder canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card p-3 flex items-center gap-3">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono text-primary uppercase tracking-wider">Workflow Builder</span>
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={enablePlanning}
              onChange={(e) => setEnablePlanning(e.target.checked)}
              className="w-3 h-3 accent-primary"
            />
            Planning
          </label>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-muted-foreground">Depth</span>
            <select
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="bg-input border border-border rounded px-1 py-0.5 text-[10px] font-mono text-foreground"
            >
              {[1, 2, 3].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Agent order list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sortedAgents.map((agent) => {
            const def = AGENTS.find((a) => a.name === agent.name)!;
            const Icon = def.Icon;
            const isExpanded = expandedAgent === agent.name;
            const isOver = dragOver === agent.name;

            return (
              <motion.div
                key={agent.name}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                draggable
                onDragStart={() => handleDragStart(agent.name)}
                onDragOver={(e) => handleDragOver(e, agent.name)}
                onDrop={() => handleDrop(agent.name)}
                onDragLeave={() => setDragOver(null)}
                className={`rounded border transition-all ${
                  isOver ? "border-primary bg-primary/5" :
                  agent.enabled ? "border-border bg-card" : "border-border/40 bg-card/40 opacity-50"
                }`}
              >
                <div className="flex items-center gap-2 p-2.5">
                  {/* Drag handle */}
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 cursor-grab flex-shrink-0" />

                  {/* Toggle */}
                  <input
                    type="checkbox"
                    checked={agent.enabled}
                    onChange={() => toggle(agent.name)}
                    className="w-3 h-3 accent-primary flex-shrink-0"
                  />

                  {/* Icon + name */}
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: def.color }} />
                  <span className="text-[11px] font-mono font-medium text-foreground flex-1">{agent.name}</span>
                  <span className="text-[9px] font-mono text-muted-foreground hidden sm:block">{def.description}</span>

                  {/* Expand */}
                  <button
                    onClick={() => setExpandedAgent(isExpanded ? null : agent.name)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-2.5 pb-2.5">
                    <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">System Prompt Override</label>
                    <textarea
                      value={agent.systemPrompt}
                      onChange={(e) => updatePrompt(agent.name, e.target.value)}
                      rows={3}
                      className="w-full mt-1 bg-input border border-border rounded px-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Prompt + run */}
        <div className="border-t border-border p-3 space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter workflow prompt..."
            rows={2}
            className="w-full bg-input border border-border rounded px-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-2">
            <input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Workflow name..."
              className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-terminal-amber text-terminal-amber text-[10px] font-mono hover:bg-terminal-amber/10 transition-colors"
            >
              <Save className="w-3 h-3" /> Save
            </button>
            <button
              onClick={handleRun}
              disabled={running || mode !== "local"}
              className="flex items-center gap-1 px-3 py-1.5 rounded border border-primary text-primary bg-primary/10 hover:bg-primary/20 text-[10px] font-mono uppercase disabled:opacity-40 transition-colors"
            >
              <Play className="w-3 h-3" />
              {running ? "Running..." : "Run"}
            </button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="border-t border-border p-3 max-h-48 overflow-y-auto">
            <span className="text-[9px] uppercase tracking-widest text-primary font-mono">Output</span>
            <p className="mt-1 text-[10px] font-mono text-foreground leading-relaxed whitespace-pre-wrap">{result}</p>
          </div>
        )}
      </div>

      {/* Right: saved workflows */}
      <div className="w-64 border-l border-border bg-sidebar flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-terminal-amber font-display">Saved Workflows</span>
          <Plus className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {savedWorkflows.length === 0 ? (
            <p className="text-[9px] font-mono text-muted-foreground">
              No saved workflows yet. Configure agents above and click Save.
            </p>
          ) : (
            savedWorkflows.map((wf) => (
              <div
                key={wf.id}
                className="p-2 rounded border border-border bg-card hover:border-muted-foreground transition-all"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-mono text-foreground font-medium truncate">{wf.name}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">
                      {wf.agents.filter((a) => a.enabled).map((a) => a.name).join(" → ")}
                    </div>
                    <div className="text-[8px] font-mono text-muted-foreground/60">
                      {new Date(wf.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleLoad(wf)}
                      className="text-[8px] font-mono text-primary hover:text-primary/80 transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(wf.id)}
                      className="text-muted-foreground hover:text-terminal-red transition-colors"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;
