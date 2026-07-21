import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Clock, Cpu } from "lucide-react";

export interface Step {
  id: string;
  agent: string;
  text: string;          // Short label (task title)
  thoughtText?: string;  // Live-streamed LLM tokens from this agent
  status: "running" | "done" | "error";
  startTime: number;
  endTime?: number;
  phase?: string;        // THINKING | ANALYZING | PLANNING | EXECUTING | VERIFYING | FINALIZING
  detail?: string;       // Summary line shown after completion
}

interface Props {
  steps: Step[];
  isStreaming: boolean;
}

// ── Phase catalogue ──────────────────────────────────────────────────────────
const PHASE_META: Record<string, {
  icon: string;
  label: string;
  color: string;
  badgeClass: string;
}> = {
  THINKING:   { icon: "💭", label: "Reasoning",  color: "hsl(185 60% 50%)",  badgeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"      },
  ANALYZING:  { icon: "🔍", label: "Analysis",   color: "hsl(38 90% 55%)",   badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30"    },
  PLANNING:   { icon: "📋", label: "Planning",   color: "hsl(280 60% 55%)",  badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30"  },
  EXECUTING:  { icon: "🔧", label: "Execution",  color: "hsl(142 70% 45%)",  badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  VERIFYING:  { icon: "✅", label: "Reflection", color: "hsl(120 55% 55%)",  badgeClass: "bg-green-500/15 text-green-400 border-green-500/30"     },
  FINALIZING: { icon: "📤", label: "Synthesis",  color: "hsl(220 70% 65%)",  badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30"       },
  ERROR:      { icon: "❌", label: "Error",      color: "hsl(0 75% 55%)",    badgeClass: "bg-red-500/15 text-red-400 border-red-500/30"           },
};

const AGENT_PHASE_MAP: Record<string, string> = {
  Planner:    "PLANNING",
  Researcher: "ANALYZING",
  Developer:  "EXECUTING",
  Critic:     "VERIFYING",
  Supervisor: "THINKING",
};

function getPhase(step: Step) {
  return step.phase || AGENT_PHASE_MAP[step.agent] || "EXECUTING";
}

function getMeta(phase: string) {
  return PHASE_META[phase] ?? PHASE_META.EXECUTING;
}

// ── Live elapsed timer (ticks every 100 ms while running) ────────────────────
function useElapsed(startTime: number, running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((Date.now() - startTime) / 1000), 100);
    return () => clearInterval(id);
  }, [running, startTime]);
  return running ? elapsed : undefined;
}

// ── Node dot on timeline ─────────────────────────────────────────────────────
function NodeDot({ color, running, error }: { color: string; running: boolean; error?: boolean }) {
  if (error) {
    return <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-red-500/20 border border-red-500/60 text-[8px]">❌</div>;
  }
  if (running) {
    return (
      <div className="w-4 h-4 rounded-full flex-shrink-0 relative" style={{ border: `2px solid ${color}`, boxShadow: `0 0 8px ${color}60` }}>
        <span className="absolute inset-0.5 rounded-full" style={{ background: color, animation: "pulse 1.2s ease-in-out infinite" }} />
      </div>
    );
  }
  return (
    <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border: `1.5px solid ${color}60`, background: `${color}18` }}>
      <span className="text-[7px]" style={{ color }}>✓</span>
    </div>
  );
}

// ── Individual step row — NO AnimatePresence inside ──────────────────────────
// Framer-motion v12 AnimatePresence throws when parent is abruptly unmounted.
// We use plain CSS transitions for the thought text / detail expand instead.
function StepRow({ step, isLast }: { step: Step; isLast: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const thoughtRef = useRef<HTMLDivElement>(null);
  const phase      = getPhase(step);
  const meta       = getMeta(phase);
  const running    = step.status === "running";
  const error      = step.status === "error";
  const liveElapsed  = useElapsed(step.startTime, running);
  const finalElapsed = step.endTime ? ((step.endTime - step.startTime) / 1000).toFixed(1) : null;

  // Auto-scroll thought area while streaming
  useEffect(() => {
    if (running && expanded && thoughtRef.current) {
      thoughtRef.current.scrollTop = thoughtRef.current.scrollHeight;
    }
  }, [step.thoughtText, running, expanded]);

  // Collapse if there's nothing to show
  useEffect(() => {
    if (!running && !step.thoughtText && !step.detail) setExpanded(false);
  }, [running, step.thoughtText, step.detail]);

  const hasExpandable = !!(step.thoughtText || step.detail);
  const canToggle     = !running && hasExpandable;

  return (
    <div className="flex gap-2.5 relative">
      {/* Timeline line */}
      <div className="flex flex-col items-center flex-shrink-0 w-4">
        <NodeDot color={meta.color} running={running} error={error} />
        {!isLast && (
          <div
            className="w-px flex-1 mt-1 min-h-[12px]"
            style={{
              background: running
                ? `linear-gradient(to bottom, ${meta.color}80, ${meta.color}20)`
                : `${meta.color}25`,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        {/* Header row */}
        <div
          className={`flex items-center gap-1.5 flex-wrap ${canToggle ? "cursor-pointer select-none" : ""}`}
          onClick={canToggle ? () => setExpanded(v => !v) : undefined}
        >
          {/* Phase badge */}
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold border tracking-wide uppercase ${meta.badgeClass}`}>
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </span>

          {/* Agent name */}
          <span className="text-[10px] font-mono text-foreground/70">{step.agent}</span>

          {/* Step description */}
          <span className="text-[10px] font-mono text-muted-foreground/60 flex-1 min-w-0 truncate">· {step.text}</span>

          {/* Timer */}
          <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/40 flex-shrink-0 ml-auto">
            <Clock className="w-2.5 h-2.5" />
            {running && liveElapsed !== undefined ? `${liveElapsed.toFixed(1)}s` : finalElapsed ? `${finalElapsed}s` : null}
          </span>

          {canToggle && (
            <span className="text-muted-foreground/30 ml-0.5 flex-shrink-0">
              {expanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
            </span>
          )}
        </div>

        {/* Live thought stream (CSS transition, no AnimatePresence) */}
        {running && step.thoughtText && (
          <div
            ref={thoughtRef}
            className="mt-1.5 pl-2 border-l-2 text-[9px] font-mono text-muted-foreground/65 whitespace-pre-wrap break-words max-h-28 overflow-y-auto leading-relaxed scroll-smooth"
            style={{ borderColor: `${meta.color}40` }}
          >
            {step.thoughtText}
            <span
              className="inline-block w-[5px] h-[11px] ml-0.5 align-middle rounded-[1px]"
              style={{ background: meta.color, opacity: 0.8, animation: "cot-blink 0.85s step-end infinite" }}
            />
          </div>
        )}

        {/* Done: expandable thought + detail */}
        {!running && expanded && hasExpandable && (
          <div>
            {step.thoughtText && (
              <div
                className="mt-1.5 pl-2 border-l-2 text-[9px] font-mono text-muted-foreground/45 whitespace-pre-wrap break-words max-h-28 overflow-y-auto leading-relaxed scroll-smooth"
                style={{ borderColor: `${meta.color}25` }}
              >
                {step.thoughtText}
              </div>
            )}
            {step.detail && (
              <div className="mt-1 flex items-start gap-1 text-[9px] font-mono text-muted-foreground/40">
                <span className="flex-shrink-0" style={{ color: `${meta.color}60` }}>└─</span>
                <span className="break-words">{step.detail}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
const ThinkingSteps = ({ steps, isStreaming }: Props) => {
  const [collapsed, setCollapsed]     = useState(false);
  const [manualToggle, setManualToggle] = useState(false);
  const autoCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-expand while streaming, auto-collapse 2s after done
  useEffect(() => {
    if (isStreaming) {
      if (!manualToggle) setCollapsed(false);
      if (autoCollapseTimer.current) { clearTimeout(autoCollapseTimer.current); autoCollapseTimer.current = null; }
    } else {
      if (!manualToggle) {
        autoCollapseTimer.current = setTimeout(() => setCollapsed(true), 2000);
      }
    }
    return () => { if (autoCollapseTimer.current) clearTimeout(autoCollapseTimer.current); };
  }, [isStreaming, manualToggle]);

  const handleToggle = useCallback(() => {
    setManualToggle(true);
    if (autoCollapseTimer.current) { clearTimeout(autoCollapseTimer.current); autoCollapseTimer.current = null; }
    setCollapsed(v => !v);
  }, []);

  if (!steps || steps.length === 0) return null;

  const firstStart   = steps[0].startTime;
  const lastEnd      = steps[steps.length - 1].endTime ?? Date.now();
  const totalElapsed = ((lastEnd - firstStart) / 1000).toFixed(1);
  const activeStep   = steps.find(s => s.status === "running");
  const activeMeta   = activeStep ? getMeta(getPhase(activeStep)) : null;
  const doneCount    = steps.filter(s => s.status === "done").length;

  return (
    <div className="rounded-lg border border-border/30 overflow-hidden mb-3 text-[11px] font-mono bg-muted/8 w-full max-w-[88%]">
      {/* ── Header ── */}
      <button
        className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-muted/15 transition-colors select-none group"
        onClick={handleToggle}
      >
        <span className="text-muted-foreground/40 flex-shrink-0 group-hover:text-muted-foreground/70">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>

        {isStreaming && activeMeta ? (
          <span className="flex items-center gap-1.5 flex-1">
            <span className="inline-flex w-2 h-2 rounded-full flex-shrink-0" style={{ background: activeMeta.color, boxShadow: `0 0 6px ${activeMeta.color}`, animation: "pulse 1.2s ease-in-out infinite" }} />
            <span style={{ color: activeMeta.color }} className="tracking-wide font-semibold">{activeMeta.icon} {activeMeta.label}</span>
            <span className="text-muted-foreground/45">·</span>
            <span className="text-muted-foreground/55">{activeStep?.agent}</span>
            {doneCount > 0 && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-muted-foreground/35">{doneCount}/{steps.length} done</span>
              </>
            )}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 flex-1 text-muted-foreground/60">
            <Cpu className="w-3 h-3 text-primary/50 flex-shrink-0" />
            <span className="text-primary/70 font-semibold">Thought</span>
            <span>for {totalElapsed}s</span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-muted-foreground/40">{steps.length} agent{steps.length !== 1 ? "s" : ""}</span>
          </span>
        )}

        {/* Mini progress dots */}
        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          {steps.map((s) => {
            const m = getMeta(getPhase(s));
            return (
              <span
                key={s.id}
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background: s.status === "running" ? m.color : s.status === "done" ? `${m.color}70` : "hsl(0 0% 30%)",
                  boxShadow:  s.status === "running" ? `0 0 5px ${m.color}` : undefined,
                  animation:  s.status === "running" ? "pulse 1.2s ease-in-out infinite" : undefined,
                }}
                title={`${s.agent}: ${s.status}`}
              />
            );
          })}
        </div>
      </button>

      {/* ── Body — single AnimatePresence only for collapse/expand ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t border-border/20 px-3 pt-3 pb-2 overflow-y-auto max-h-[360px] scroll-smooth">
              {/* Steps rendered directly — NO AnimatePresence around rows */}
              {steps.map((step, idx) => (
                <StepRow key={step.id} step={step} isLast={idx === steps.length - 1} />
              ))}

              {isStreaming && (
                <div className="flex items-center gap-1.5 pl-6 mt-0.5 text-muted-foreground/30">
                  <span className="text-[10px]" style={{ animation: "cot-blink 0.85s step-end infinite", color: "hsl(185 60% 50%)" }}>▊</span>
                  <span className="text-[9px] text-muted-foreground/25">processing</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ThinkingSteps;
