import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";

export interface Step {
  id: string;
  agent: string;
  text: string;
  status: "running" | "done" | "error";
  startTime: number;
  endTime?: number;
}

interface Props {
  steps: Step[];
  isStreaming: boolean;
}

const AGENT_COLORS: Record<string, string> = {
  Planner:    "hsl(185 60% 50%)",
  Researcher: "hsl(38 90% 55%)",
  Developer:  "hsl(142 70% 45%)",
  Critic:     "hsl(280 60% 55%)",
  Supervisor: "hsl(142 70% 45%)",
};

const getAgentColor = (agent: string) => AGENT_COLORS[agent] ?? "hsl(142 70% 45%)";

const ThinkingSteps = ({ steps, isStreaming }: Props) => {
  const [collapsed, setCollapsed] = useState(false);
  const [manualToggle, setManualToggle] = useState(false);
  const autoCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-expand while streaming
  useEffect(() => {
    if (isStreaming) {
      if (!manualToggle) {
        setCollapsed(false);
      }
      // Clear any pending auto-collapse when streaming restarts
      if (autoCollapseTimer.current) {
        clearTimeout(autoCollapseTimer.current);
        autoCollapseTimer.current = null;
      }
    } else {
      // Streaming stopped — auto-collapse after 2s unless user manually toggled
      if (!manualToggle) {
        autoCollapseTimer.current = setTimeout(() => {
          setCollapsed(true);
        }, 2000);
      }
    }
    return () => {
      if (autoCollapseTimer.current) clearTimeout(autoCollapseTimer.current);
    };
  }, [isStreaming, manualToggle]);

  const handleToggle = () => {
    setManualToggle(true);
    // Cancel pending auto-collapse
    if (autoCollapseTimer.current) {
      clearTimeout(autoCollapseTimer.current);
      autoCollapseTimer.current = null;
    }
    setCollapsed((prev) => !prev);
  };

  if (steps.length === 0) return null;

  // Total elapsed: first step start → last done/running step end (or now)
  const firstStart = steps[0].startTime;
  const lastEnd = steps.length > 0
    ? (steps[steps.length - 1].endTime ?? Date.now())
    : Date.now();
  const totalElapsed = ((lastEnd - firstStart) / 1000).toFixed(1);

  return (
    <div className="rounded-md border border-border/40 overflow-hidden mb-2 text-[11px] font-mono">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 cursor-pointer select-none"
        onClick={handleToggle}
      >
        {isStreaming ? (
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
        ) : (
          <Check className="w-3 h-3 text-primary flex-shrink-0" />
        )}
        <span className="text-muted-foreground flex-1">
          {isStreaming ? "Thinking..." : `Thought for ${totalElapsed}s`}
        </span>
        {collapsed ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground/60" />
        ) : (
          <ChevronUp className="w-3 h-3 text-muted-foreground/60" />
        )}
      </div>

      {/* Steps */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <AnimatePresence>
              {steps.map((step) => {
                const color = getAgentColor(step.agent);
                const elapsed = (
                  ((step.endTime ?? Date.now()) - step.startTime) / 1000
                ).toFixed(1);

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-2 px-3 py-1 border-t border-border/20"
                  >
                    {/* Status icon */}
                    {step.status === "running" && (
                      <div
                        className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                        style={{ background: color }}
                      />
                    )}
                    {step.status === "done" && (
                      <Check
                        className="w-3 h-3 flex-shrink-0"
                        style={{ color }}
                      />
                    )}
                    {step.status === "error" && (
                      <X className="w-3 h-3 text-terminal-red flex-shrink-0" />
                    )}

                    {/* Agent badge */}
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider border flex-shrink-0"
                      style={{
                        color,
                        borderColor: color + "40",
                        background: color + "15",
                      }}
                    >
                      {step.agent}
                    </span>

                    {/* Step text */}
                    <span className="text-muted-foreground flex-1 truncate">
                      {step.text}
                    </span>

                    {/* Elapsed (done steps only) */}
                    {step.status === "done" && (
                      <span className="text-muted-foreground/50 ml-auto flex-shrink-0">
                        {elapsed}s
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ThinkingSteps;
