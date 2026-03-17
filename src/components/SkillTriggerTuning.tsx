import { useState } from "react";
import { getAllSkills, updateSkill } from "@/lib/agentSkills";
import { callSkillTools } from "@/lib/skillToolsApi";
import { Target, Plus, Trash2, Zap, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onSkillsChanged: () => void;
}

const SkillTriggerTuning = ({ onSkillsChanged }: Props) => {
  const skills = getAllSkills();
  const [selectedSkillId, setSelectedSkillId] = useState<string>(skills[0]?.id || "");
  const [shouldTrigger, setShouldTrigger] = useState<string[]>([]);
  const [shouldNotTrigger, setShouldNotTrigger] = useState<string[]>([]);
  const [newPositive, setNewPositive] = useState("");
  const [newNegative, setNewNegative] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    analysis: string;
    suggestedDescription: string;
    predictedAccuracy: number;
  } | null>(null);

  const selectedSkill = skills.find((s) => s.id === selectedSkillId);

  const handleAnalyze = async () => {
    if (!selectedSkill) return;
    if (shouldTrigger.length === 0 && shouldNotTrigger.length === 0) {
      toast.error("Add at least one sample prompt");
      return;
    }
    setIsAnalyzing(true);
    setResult(null);

    try {
      const resp = await callSkillTools({
        mode: "tune-trigger",
        skillName: selectedSkill.name,
        currentDescription: selectedSkill.triggerDescription || selectedSkill.content.slice(0, 300),
        shouldTrigger,
        shouldNotTrigger,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Analysis failed");
        setIsAnalyzing(false);
        return;
      }
      const data = await resp.json();
      setResult(data);
    } catch {
      toast.error("Request failed");
    }
    setIsAnalyzing(false);
  };

  const applyDescription = () => {
    if (!result || !selectedSkillId) return;
    updateSkill(selectedSkillId, { triggerDescription: result.suggestedDescription });
    toast.success("Trigger description updated");
    onSkillsChanged();
    setResult(null);
  };

  const addPositive = () => {
    if (!newPositive.trim()) return;
    setShouldTrigger([...shouldTrigger, newPositive.trim()]);
    setNewPositive("");
  };

  const addNegative = () => {
    if (!newNegative.trim()) return;
    setShouldNotTrigger([...shouldNotTrigger, newNegative.trim()]);
    setNewNegative("");
  };

  return (
    <div className="p-3 space-y-3">
      <select
        value={selectedSkillId}
        onChange={(e) => { setSelectedSkillId(e.target.value); setResult(null); }}
        className="w-full bg-muted border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none"
      >
        {skills.length === 0 && <option value="">No skills</option>}
        {skills.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      {selectedSkill && (
        <div className="text-[9px] font-mono text-muted-foreground bg-muted rounded p-2">
          <span className="text-foreground">Current trigger: </span>
          {selectedSkill.triggerDescription || selectedSkill.content.slice(0, 150) + "..."}
        </div>
      )}

      {/* Should trigger */}
      <div className="space-y-1">
        <span className="text-[10px] font-mono text-green-500 uppercase tracking-widest">Should Trigger</span>
        {shouldTrigger.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono text-foreground">
            <span className="flex-1 truncate bg-muted rounded px-1.5 py-0.5">{p}</span>
            <button onClick={() => setShouldTrigger(shouldTrigger.filter((_, j) => j !== i))} className="text-destructive/60 hover:text-destructive">
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-1">
          <input
            value={newPositive}
            onChange={(e) => setNewPositive(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPositive()}
            placeholder="Add prompt that should trigger..."
            className="flex-1 bg-muted border border-border rounded px-2 py-0.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button onClick={addPositive} className="p-1 text-muted-foreground hover:text-foreground">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Should NOT trigger */}
      <div className="space-y-1">
        <span className="text-[10px] font-mono text-destructive uppercase tracking-widest">Should Not Trigger</span>
        {shouldNotTrigger.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono text-foreground">
            <span className="flex-1 truncate bg-muted rounded px-1.5 py-0.5">{p}</span>
            <button onClick={() => setShouldNotTrigger(shouldNotTrigger.filter((_, j) => j !== i))} className="text-destructive/60 hover:text-destructive">
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-1">
          <input
            value={newNegative}
            onChange={(e) => setNewNegative(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNegative()}
            placeholder="Add prompt that should NOT trigger..."
            className="flex-1 bg-muted border border-border rounded px-2 py-0.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button onClick={addNegative} className="p-1 text-muted-foreground hover:text-foreground">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || !selectedSkillId || (shouldTrigger.length === 0 && shouldNotTrigger.length === 0)}
        className="w-full px-3 py-1.5 text-[10px] font-mono bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        <Target className="w-3 h-3" /> {isAnalyzing ? "Analyzing..." : "Analyze & Tune"}
      </button>

      {result && (
        <div className="border border-primary/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Analysis</span>
            <span className="text-[10px] font-mono text-primary">
              {result.predictedAccuracy}% predicted accuracy
            </span>
          </div>
          <p className="text-[10px] font-mono text-foreground">{result.analysis}</p>
          <div className="bg-muted rounded p-2">
            <span className="text-[9px] font-mono text-muted-foreground">Suggested trigger:</span>
            <p className="text-[10px] font-mono text-foreground mt-1">{result.suggestedDescription}</p>
          </div>
          <button
            onClick={applyDescription}
            className="px-3 py-1 text-[10px] font-mono bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> Apply
          </button>
        </div>
      )}
    </div>
  );
};

export default SkillTriggerTuning;
