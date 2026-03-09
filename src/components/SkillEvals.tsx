import { useState } from "react";
import { getAllSkills, updateSkill, type AgentSkill, type SkillEvalCase } from "@/lib/agentSkills";
import { Play, Plus, Trash2, CheckCircle, XCircle, BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onSkillsChanged: () => void;
}

const SkillEvals = ({ onSkillsChanged }: Props) => {
  const skills = getAllSkills();
  const [selectedSkillId, setSelectedSkillId] = useState<string>(skills[0]?.id || "");
  const [newPrompt, setNewPrompt] = useState("");
  const [newExpected, setNewExpected] = useState("");
  const [runningEvalId, setRunningEvalId] = useState<string | null>(null);
  const [runningBenchmark, setRunningBenchmark] = useState(false);

  const selectedSkill = skills.find((s) => s.id === selectedSkillId);
  const evals: SkillEvalCase[] = selectedSkill?.evals || [];

  const addEval = () => {
    if (!newPrompt.trim() || !newExpected.trim() || !selectedSkill) return;
    const newCase: SkillEvalCase = {
      id: crypto.randomUUID(),
      prompt: newPrompt.trim(),
      expectedBehavior: newExpected.trim(),
    };
    updateSkill(selectedSkillId, { evals: [...evals, newCase] });
    setNewPrompt("");
    setNewExpected("");
    onSkillsChanged();
  };

  const deleteEval = (evalId: string) => {
    updateSkill(selectedSkillId, { evals: evals.filter((e) => e.id !== evalId) });
    onSkillsChanged();
  };

  const runSingleEval = async (evalCase: SkillEvalCase) => {
    if (!selectedSkill) return;
    setRunningEvalId(evalCase.id);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/skill-tools`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            mode: "eval",
            skillContent: selectedSkill.content,
            prompt: evalCase.prompt,
            expectedBehavior: evalCase.expectedBehavior,
          }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Eval failed");
        setRunningEvalId(null);
        return;
      }
      const result = await resp.json();
      const updated = evals.map((e) =>
        e.id === evalCase.id
          ? { ...e, lastResult: result.pass ? "pass" as const : "fail" as const, lastScore: result.score, lastNotes: result.notes, lastRunAt: new Date().toISOString() }
          : e
      );
      updateSkill(selectedSkillId, { evals: updated });
      onSkillsChanged();
      toast.success(`Eval ${result.pass ? "passed" : "failed"} (${result.score}/5)`);
    } catch {
      toast.error("Eval request failed");
    }
    setRunningEvalId(null);
  };

  const runBenchmark = async () => {
    if (!selectedSkill || evals.length === 0) return;
    setRunningBenchmark(true);
    for (const evalCase of evals) {
      await runSingleEval(evalCase);
    }
    setRunningBenchmark(false);
    const updatedSkill = getAllSkills().find((s) => s.id === selectedSkillId);
    const updatedEvals = updatedSkill?.evals || [];
    const passed = updatedEvals.filter((e) => e.lastResult === "pass").length;
    const avgScore = updatedEvals.reduce((a, e) => a + (e.lastScore || 0), 0) / updatedEvals.length;
    toast.success(`Benchmark: ${passed}/${updatedEvals.length} passed, avg ${avgScore.toFixed(1)}/5`);
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={selectedSkillId}
          onChange={(e) => setSelectedSkillId(e.target.value)}
          className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none"
        >
          {skills.length === 0 && <option value="">No skills</option>}
          {skills.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.agent})</option>
          ))}
        </select>
        {evals.length > 0 && (
          <button
            onClick={runBenchmark}
            disabled={runningBenchmark}
            className="px-2 py-1 text-[10px] font-mono bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-1 disabled:opacity-50"
          >
            <BarChart3 className="w-3 h-3" /> {runningBenchmark ? "Running..." : "Benchmark"}
          </button>
        )}
      </div>

      {/* Add eval case */}
      <div className="border border-border rounded-lg p-2 space-y-1.5">
        <input
          value={newPrompt}
          onChange={(e) => setNewPrompt(e.target.value)}
          placeholder="Test prompt..."
          className="w-full bg-muted border border-border rounded px-2 py-1 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <input
          value={newExpected}
          onChange={(e) => setNewExpected(e.target.value)}
          placeholder="Expected behavior..."
          className="w-full bg-muted border border-border rounded px-2 py-1 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <button
          onClick={addEval}
          disabled={!newPrompt.trim() || !newExpected.trim() || !selectedSkillId}
          className="px-2 py-1 text-[10px] font-mono border border-border text-foreground rounded hover:bg-muted flex items-center gap-1 disabled:opacity-50"
        >
          <Plus className="w-3 h-3" /> Add Eval Case
        </button>
      </div>

      {/* Eval results */}
      {evals.length === 0 ? (
        <div className="text-center py-6 text-xs font-mono text-muted-foreground">
          No eval cases yet. Add test prompts above.
        </div>
      ) : (
        <div className="space-y-1">
          {evals.map((ev) => (
            <div key={ev.id} className="border border-border rounded px-2 py-1.5 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono text-foreground truncate">{ev.prompt}</p>
                <p className="text-[9px] font-mono text-muted-foreground truncate">Expected: {ev.expectedBehavior}</p>
                {ev.lastResult && (
                  <div className="flex items-center gap-2 mt-1">
                    {ev.lastResult === "pass" ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-destructive" />
                    )}
                    <span className="text-[9px] font-mono text-muted-foreground">
                      Score: {ev.lastScore}/5
                    </span>
                    {ev.lastNotes && (
                      <span className="text-[8px] font-mono text-muted-foreground truncate max-w-[200px]" title={ev.lastNotes}>
                        {ev.lastNotes}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => runSingleEval(ev)}
                disabled={runningEvalId === ev.id}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                title="Run eval"
              >
                <Play className="w-3 h-3" />
              </button>
              <button
                onClick={() => deleteEval(ev.id)}
                className="p-1 text-destructive/60 hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SkillEvals;
