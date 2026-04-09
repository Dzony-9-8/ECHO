import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface Step {
  id: string;
  agent: string;
  text: string;
  status: "running" | "done" | "error";
  startTime: number;
  endTime?: number;
  phase?: string;       // CoT phase: THINKING | ANALYZING | PLANNING | EXECUTING | VERIFYING | FINALIZING
  detail?: string;      // Optional substep/detail text
}

interface Props {
  steps: Step[];
  isStreaming: boolean;
}

const PHASE_META: Record<string, { icon: string; label: string; color: string }> = {
  THINKING:   { icon: "💭", label: "Thinking",   color: "hsl(185 60% 50%)" },
  ANALYZING:  { icon: "🔍", label: "Analyzing",  color: "hsl(38 90% 55%)"  },
  PLANNING:   { icon: "📋", label: "Planning",   color: "hsl(280 60% 55%)" },
  EXECUTING:  { icon: "🔧", label: "Executing",  color: "hsl(142 70% 45%)" },
  VERIFYING:  { icon: "✅", label: "Verifying",  color: "hsl(142 70% 60%)" },
  FINALIZING: { icon: "📤", label: "Finalizing", color: "hsl(142 70% 45%)" },
  ERROR:      { icon: "❌", label: "Error",      color: "hsl(0 75% 55%)"   },
};

const AGENT_PHASE_MAP: Record<string, string> = {
  Planner:    "PLANNING",
  Researcher: "ANALYZING",
  Developer:  "EXECUTING",
  Critic:     "VERIFYING",
  Supervisor: "THINKING",
};

const getPhase = (step: Step) =>
  step.phase || AGENT_PHASE_MAP[step.agent] || "EXECUTING";

const getPhaseMeta = (phase: string) =>
  PHASE_META[phase] ?? { icon: "🔧", label: phase, color: "hsl(142 70% 45%)" };

// Animated dot (like Claude's pulsing dot while thinking)
const PulsingDot = ({ color }: { color: string }) => (
  <span
    className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5"
    style={{
      background: color,
      animation: "pulse 1.2s ease-in-out infinite",
      boxShadow: `0 0 6px ${color}`,
    }}
  />
);

const ThinkingSteps = ({ steps, isStreaming }: Props) => {
  const [collapsed, setCollapsed] = useState(false);
  const [manualToggle, setManualToggle] = useState(false);
  const autoCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-expand while streaming, auto-collapse 1.5s after done
  useEffect(() => {
    if (isStreaming) {
      if (!manualToggle) setCollapsed(false);
      if (autoCollapseTimer.current) {
        clearTimeout(autoCollapseTimer.current);
        autoCollapseTimer.current = null;
      }
    } else {
      if (!manualToggle) {
        autoCollapseTimer.current = setTimeout(() => setCollapsed(true), 1500);
      }
    }
    return () => {
      if (autoCollapseTimer.current) clearTimeout(autoCollapseTimer.current);
    };
  }, [isStreaming, manualToggle]);

  // Auto-scroll to bottom of thinking block while streaming
  useEffect(() => {
    if (isStreaming && !collapsed && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [steps, isStreaming, collapsed]);

  const handleToggle = () => {
    setManualToggle(true);
    if (autoCollapseTimer.current) {
      clearTimeout(autoCollapseTimer.current);
      autoCollapseTimer.current = null;
    }
    setCollapsed((prev) => !prev);
  };

  if (steps.length === 0) return null;

  const firstStart = steps[0].startTime;
  const lastEnd = steps[steps.length - 1].endTime ?? Date.now();
  const totalElapsed = ((lastEnd - firstStart) / 1000).toFixed(1);

  const activeStep = steps.find(s => s.status === "running");
  const activePhase = activeStep ? getPhase(activeStep) : null;
  const activeMeta = activePhase ? getPhaseMeta(activePhase) : null;

  return (
    <div className="rounded-lg border border-border/30 overflow-hidden mb-3 text-[11px] font-mono bg-muted/10 w-full max-w-[85%]">
      {/* ── Header — mirrors Claude Code's "Thinking..." header ── */}
      <button
        className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-muted/20 transition-colors select-none"
        onClick={handleToggle}
      >
        {/* Chevron */}
        <span className="text-muted-foreground/50 flex-shrink-0">
          {collapsed
            ? <ChevronRight className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />
          }
        </span>

        {/* Phase icon + label */}
        {isStreaming && activeMeta ? (
          <span className="flex items-center gap-1.5 flex-1">
            <PulsingDot color={activeMeta.color} />
            <span style={{ color: activeMeta.color }} className="tracking-wide">
              {activeMeta.icon} {activeMeta.label}
            </span>
            <span className="text-muted-foreground/50 ml-1">
              {activeStep?.agent && `· ${activeStep.agent}`}
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 flex-1 text-muted-foreground">
            <span className="text-primary/70">✓</span>
            <span>Thought for {totalElapsed}s</span>
            <span className="text-muted-foreground/40 ml-1">· {steps.length} step{steps.length !== 1 ? "s" : ""}</span>
          </span>
        )}
      </button>

      {/* ── Body — streams steps like Claude Code's inner thought trace ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              ref={containerRef}
              className="border-t border-border/20 px-3 py-2 space-y-1.5 max-h-64 overflow-y-auto"
            >
              <AnimatePresence>
                {steps.map((step) => {
                  const phase = getPhase(step);
                  const meta = getPhaseMeta(phase);
                  const elapsed = step.endTime
                    ? ((step.endTime - step.startTime) / 1000).toFixed(1)
                    : null;

                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.12 }}
                      className="flex flex-col gap-0.5"
                    >
                      {/* Main step row */}
                      <div className="flex items-start gap-2">
                        {/* Running indicator or phase icon */}
                        {step.status === "running" ? (
                          <PulsingDot color={meta.color} />
                        ) : (
                          <span className="flex-shrink-0 mt-0.5 text-[10px] leading-none" style={{ filter: step.status === "error" ? "none" : "none" }}>
                            {step.status === "error" ? "❌" : meta.icon}
                          </span>
                        )}

                        {/* Step content */}
                        <div className="flex-1 min-w-0">
                          <span
                            className="font-semibold mr-1.5"
                            style={{ color: step.status === "error" ? "hsl(0 75% 55%)" : meta.color }}
                          >
                            {meta.label}
                          </span>
                          <span className="text-foreground/80 break-words whitespace-pre-wrap leading-relaxed">{step.text}</span>
                        </div>

                        {/* Elapsed time */}
                        {elapsed && step.status === "done" && (
                          <span className="text-muted-foreground/40 flex-shrink-0 ml-1 text-[9px]">
                            {elapsed}s
                          </span>
                        )}
                      </div>

                      {/* Substep detail line (└─ style) */}
                      {step.detail && (
                        <div className="flex items-start gap-1.5 pl-5 text-muted-foreground/60">
                          <span className="flex-shrink-0 text-muted-foreground/30">└─</span>
                          <span className="break-words">{step.detail}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Streaming cursor at bottom */}
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1.5 pl-5 text-muted-foreground/40"
                >
                  <span className="cursor-blink text-primary text-xs">▊</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ThinkingSteps;
