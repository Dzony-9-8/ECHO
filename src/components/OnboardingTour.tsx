import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Terminal, MessageSquare, GitBranch, SlidersHorizontal, ShieldCheck, Rocket,
  X, ArrowLeft, ArrowRight, Lightbulb, type LucideIcon,
} from "lucide-react";
import { TOUR_STEPS, TOUR_EVENT, isOnboarded, completeOnboarding } from "@/lib/onboarding";

const ICONS: Record<string, LucideIcon> = {
  Terminal, MessageSquare, GitBranch, SlidersHorizontal, ShieldCheck, Rocket,
};

/** First-run guided tour. Auto-shows once; replayable via the TOUR_EVENT. */
const OnboardingTour = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-show on first run; also open on demand (Settings → replay).
  useEffect(() => {
    if (!isOnboarded()) {
      const t = setTimeout(() => setOpen(true), 600);   // let the app paint first
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const onStart = () => { setStep(0); setOpen(true); };
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, []);

  // Keyboard nav while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, TOUR_STEPS.length - 1));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const finish = () => {
    completeOnboarding();
    setOpen(false);
  };

  const last = step === TOUR_STEPS.length - 1;
  const s = TOUR_STEPS[step];
  const Icon = s ? ICONS[s.icon] ?? Terminal : Terminal;

  if (!open || !s) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-background/85 backdrop-blur-sm"
        onClick={finish}
      />

      {/* Card */}
      <motion.div
        key="tour-card"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
      >
        {/* Accent top border */}
        <div
          className="h-1 w-full"
          style={{ background: "linear-gradient(90deg, hsl(142 70% 45%), hsl(185 60% 50%), hsl(280 60% 55%))" }}
        />

        <button
          onClick={finish}
          title="Skip tour"
          className="absolute top-3 right-3 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div
            className="w-12 h-12 rounded-lg border border-border flex items-center justify-center mb-4"
            style={{ background: "hsl(142 70% 45% / 0.08)" }}
          >
            <Icon className="w-6 h-6 text-primary" style={{ filter: "drop-shadow(0 0 6px hsl(142 70% 45% / 0.6))" }} />
          </div>

          {/* Animated body per step — keyed re-mount (enter only, no AnimatePresence
              exit path, which can jam under React 18.3). */}
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.16 }}
          >
            <h2 className="text-lg font-display tracking-wide text-foreground mb-2">{s.title}</h2>
            <p className="text-sm font-mono text-muted-foreground leading-relaxed">{s.body}</p>
            {s.tip && (
              <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg border border-terminal-amber/30 bg-terminal-amber/10">
                <Lightbulb className="w-3.5 h-3.5 text-terminal-amber flex-shrink-0 mt-0.5" />
                <p className="text-[11px] font-mono text-terminal-amber leading-relaxed">{s.tip}</p>
              </div>
            )}
          </motion.div>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mt-5">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                title={`Step ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === step ? 20 : 6,
                  background: i === step ? "hsl(142 70% 45%)" : "hsl(0 0% 50% / 0.4)",
                }}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-5">
            <button
              onClick={finish}
              className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep((v) => Math.max(v - 1, 0))}
                  className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              )}
              {last ? (
                <button
                  onClick={finish}
                  className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest px-4 py-1.5 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Rocket className="w-3.5 h-3.5" /> Get started
                </button>
              ) : (
                <button
                  onClick={() => setStep((v) => Math.min(v + 1, TOUR_STEPS.length - 1))}
                  className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest px-4 py-1.5 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingTour;
