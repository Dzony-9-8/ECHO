import { useState, useEffect, useCallback, useRef } from "react";
import { Bot, Target, Play, Square, RotateCcw, Loader2, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { getBackendUrl } from "@/lib/api";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AutonomousTask {
  id: string;
  description: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  result: string;
  started_at: number;
  finished_at: number;
}

interface AutonomousStatusResponse {
  status: "idle" | "planning" | "running" | "paused" | "done" | "failed";
  goal: string | null;
  tasks: AutonomousTask[];
  final_result: string;
  error: string;
}

const STATUS_META: Record<string, { label: string; color: string; pulse?: boolean }> = {
  idle:     { label: "Idle",     color: "text-muted-foreground" },
  planning: { label: "Planning", color: "text-terminal-amber", pulse: true },
  running:  { label: "Running",  color: "text-primary", pulse: true },
  paused:   { label: "Paused",   color: "text-terminal-amber" },
  done:     { label: "Done",     color: "text-primary" },
  failed:   { label: "Failed",   color: "text-terminal-red" },
};

const TASK_STATUS_ICON: Record<string, JSX.Element> = {
  pending: <Clock className="w-3.5 h-3.5 text-muted-foreground" />,
  running: <Loader2 className="w-3.5 h-3.5 text-terminal-amber animate-spin" />,
  done:    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />,
  failed:  <XCircle className="w-3.5 h-3.5 text-terminal-red" />,
  skipped: <Clock className="w-3.5 h-3.5 text-muted-foreground opacity-40" />,
};

const TaskRow = ({ task }: { task: AutonomousTask }) => {
  const [expanded, setExpanded] = useState(false);
  const elapsed = task.finished_at && task.started_at
    ? ((task.finished_at - task.started_at)).toFixed(1) + "s"
    : task.started_at ? "…" : null;

  return (
    <div className={`border rounded transition-all ${
      task.status === "running" ? "border-terminal-amber/50 bg-terminal-amber/3" :
      task.status === "done"    ? "border-border/50 bg-card" :
      task.status === "failed"  ? "border-terminal-red/40 bg-terminal-red/3" :
      "border-border/30 bg-muted/20"
    }`}>
      <div
        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
        onClick={() => task.result && setExpanded(!expanded)}
      >
        {TASK_STATUS_ICON[task.status] ?? TASK_STATUS_ICON.pending}
        <span className="flex-1 text-[11px] font-mono text-foreground truncate">{task.description}</span>
        {elapsed && (
          <span className="text-[9px] text-muted-foreground font-mono">{elapsed}</span>
        )}
        {task.result && (
          expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                   : <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        )}
      </div>
      {expanded && task.result && (
        <div className="px-3 pb-2.5 border-t border-border/40 pt-2">
          <div className="prose prose-sm prose-invert max-w-none text-[10px] font-mono text-muted-foreground leading-relaxed max-h-32 overflow-y-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.result}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

const EXAMPLE_GOALS = [
  "Research the latest trends in AI and summarize the top 5 developments",
  "Write a comprehensive guide to Python async programming with examples",
  "Design a REST API schema for a todo app and document all endpoints",
  "Analyze the pros and cons of microservices vs monolithic architecture",
  "Create a learning plan for mastering TypeScript in 30 days",
];

const AutonomousMode = () => {
  const [goal, setGoal] = useState("");
  const [maxIterations, setMaxIterations] = useState(5);
  const [statusData, setStatusData] = useState<AutonomousStatusResponse | null>(null);
  const [polling, setPolling] = useState(false);
  const [starting, setStar] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch(`${getBackendUrl()}/api/autonomous/status`);
      const data: AutonomousStatusResponse = await resp.json();
      setStatusData(data);
      if (data.status === "done" || data.status === "failed" || data.status === "idle") {
        stopPolling();
        setPolling(false);
        if (data.status === "done") setShowResult(true);
      }
    } catch {
      // silently skip
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setPolling(true);
    pollRef.current = setInterval(fetchStatus, 1500);
  }, [fetchStatus]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    return () => stopPolling();
  }, [fetchStatus, stopPolling]);

  const handleStart = async () => {
    if (!goal.trim()) return;
    setStar(true);
    setShowResult(false);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/autonomous/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), max_iterations: maxIterations }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || "Failed to start");
      }
      await fetchStatus();
      startPolling();
      toast.success("Autonomous session started");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setStar(false);
    }
  };

  const handleStop = async () => {
    try {
      await fetch(`${getBackendUrl()}/api/autonomous/stop`, { method: "POST" });
      stopPolling();
      setPolling(false);
      await fetchStatus();
      toast.info("Session paused");
    } catch {
      toast.error("Failed to stop");
    }
  };

  const handleReset = async () => {
    try {
      await fetch(`${getBackendUrl()}/api/autonomous/reset`, { method: "POST" });
      stopPolling();
      setPolling(false);
      setStatusData(null);
      setShowResult(false);
      toast.success("Session reset");
    } catch {
      toast.error("Failed to reset");
    }
  };

  const isActive = statusData?.status === "planning" || statusData?.status === "running";
  const meta = STATUS_META[statusData?.status ?? "idle"] ?? STATUS_META.idle;

  const completedTasks = statusData?.tasks.filter((t) => t.status === "done").length ?? 0;
  const totalTasks = statusData?.tasks.length ?? 0;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Bot className="w-4 h-4 text-terminal-amber" style={{ filter: "drop-shadow(0 0 5px hsl(38 90% 55% / 0.5))" }} />
        <h2 className="text-sm font-mono text-terminal-amber uppercase tracking-wider">Autonomous Mode</h2>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`text-[9px] font-mono uppercase tracking-widest ${meta.color} ${meta.pulse ? "animate-pulse" : ""}`}>
            {meta.label}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.color.replace("text-", "bg-")}`} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Goal input — only when idle/paused/done */}
        {!isActive && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-terminal-amber flex-shrink-0" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Goal</span>
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {EXAMPLE_GOALS.slice(0, 3).map((eg, i) => (
                <button
                  key={i}
                  onClick={() => setGoal(eg)}
                  className="px-1.5 py-0.5 rounded border border-border text-[8px] font-mono text-muted-foreground hover:text-terminal-amber hover:border-terminal-amber/40 transition-colors text-left"
                >
                  {eg.slice(0, 40)}…
                </button>
              ))}
            </div>

            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Describe what you want ECHO to autonomously accomplish..."
              rows={4}
              className="w-full bg-input border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-terminal-amber resize-none"
            />

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-muted-foreground">Max tasks:</span>
                <select
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(Number(e.target.value))}
                  className="bg-input border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-foreground focus:outline-none focus:border-terminal-amber"
                >
                  {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="flex-1" />

              {(statusData?.status === "done" || statusData?.status === "failed") && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 px-2 py-1.5 rounded border border-border text-muted-foreground text-[10px] font-mono hover:text-foreground hover:border-foreground transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}

              <button
                onClick={handleStart}
                disabled={starting || !goal.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-terminal-amber bg-terminal-amber/10 text-terminal-amber text-xs font-mono hover:bg-terminal-amber/20 transition-colors disabled:opacity-40"
              >
                {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {starting ? "Starting…" : "Start"}
              </button>
            </div>
          </div>
        )}

        {/* Active session controls */}
        {isActive && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2.5 rounded border border-terminal-amber/40 bg-terminal-amber/5">
              <Loader2 className="w-4 h-4 text-terminal-amber animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-terminal-amber uppercase tracking-wider">{meta.label}…</p>
                <p className="text-[9px] text-muted-foreground font-mono truncate mt-0.5">{statusData?.goal}</p>
              </div>
              <button
                onClick={handleStop}
                className="flex items-center gap-1 px-2 py-1 rounded border border-terminal-red/50 text-terminal-red text-[9px] font-mono hover:bg-terminal-red/10 transition-colors"
              >
                <Square className="w-3 h-3" /> Stop
              </button>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-muted-foreground font-mono">Progress</span>
              <span className="text-[9px] text-muted-foreground font-mono">{completedTasks}/{totalTasks} tasks</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Task list */}
        {statusData?.tasks && statusData.tasks.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Tasks</span>
            {statusData.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}

        {/* Error display */}
        {statusData?.status === "failed" && statusData.error && (
          <div className="p-2.5 rounded border border-terminal-red/40 bg-terminal-red/5">
            <p className="text-[10px] text-terminal-red font-mono">{statusData.error}</p>
          </div>
        )}

        {/* Final result */}
        {statusData?.final_result && (
          <div className="space-y-1.5">
            <button
              onClick={() => setShowResult(!showResult)}
              className="flex items-center gap-1.5 w-full"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] uppercase tracking-widest text-primary font-mono flex-1 text-left">Final Result</span>
              {showResult ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
            </button>
            {showResult && (
              <div className="p-3 rounded border border-primary/30 bg-card">
                <div className="prose prose-sm prose-invert max-w-none text-xs">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{statusData.final_result}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Idle empty state */}
        {(!statusData || statusData.status === "idle") && !goal && (
          <div className="text-center py-10 space-y-3">
            <Bot className="w-8 h-8 text-terminal-amber/40 mx-auto" />
            <div>
              <p className="text-[11px] text-muted-foreground font-mono">Give ECHO a goal and let it work autonomously</p>
              <p className="text-[9px] text-muted-foreground/60 font-mono mt-1">Plans tasks, executes them in sequence, synthesizes a final result</p>
            </div>
            <div className="space-y-1">
              {EXAMPLE_GOALS.slice(0, 3).map((eg, i) => (
                <button
                  key={i}
                  onClick={() => setGoal(eg)}
                  className="block w-full text-left px-3 py-1.5 rounded border border-border text-[9px] font-mono text-muted-foreground hover:text-terminal-amber hover:border-terminal-amber/40 transition-colors"
                >
                  {eg}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutonomousMode;
