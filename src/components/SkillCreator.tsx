import { useState } from "react";
import { getAllSkills, saveSkill, updateSkill, AGENT_NAMES, type AgentSkill } from "@/lib/agentSkills";
import { Sparkles, Save, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onSkillsChanged: () => void;
}

const SkillCreator = ({ onSkillsChanged }: Props) => {
  const [description, setDescription] = useState("");
  const [targetAgent, setTargetAgent] = useState("Developer");
  const [existingSkillId, setExistingSkillId] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const skills = getAllSkills();

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error("Describe the skill you want to create");
      return;
    }
    setIsGenerating(true);
    setGeneratedContent("");

    const existingSkill = existingSkillId
      ? skills.find((s) => s.id === existingSkillId)?.content
      : undefined;

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
            mode: "create",
            description: description.trim(),
            existingSkill,
            agent: targetAgent,
          }),
        }
      );

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Generation failed");
        setIsGenerating(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              content += delta;
              setGeneratedContent(content);
            }
          } catch {}
        }
      }
    } catch (e) {
      toast.error("Failed to generate skill");
    }
    setIsGenerating(false);
  };

  const handleSaveNew = () => {
    if (!generatedContent.trim()) return;
    const nameMatch = generatedContent.match(/^#\s*(?:Skill:\s*)?(.+)/m);
    const name = nameMatch ? nameMatch[1].trim() : "Untitled Skill";
    saveSkill({
      name,
      content: generatedContent,
      agent: targetAgent,
      enabled: true,
      source: "skill-creator",
    });
    toast.success(`Saved "${name}" to ${targetAgent}`);
    setGeneratedContent("");
    setDescription("");
    onSkillsChanged();
  };

  const handleReplace = () => {
    if (!existingSkillId || !generatedContent.trim()) return;
    updateSkill(existingSkillId, { content: generatedContent });
    toast.success("Skill updated");
    setGeneratedContent("");
    setDescription("");
    onSkillsChanged();
  };

  return (
    <div className="p-3 space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={targetAgent}
            onChange={(e) => setTargetAgent(e.target.value)}
            className="bg-muted border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none"
          >
            {AGENT_NAMES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
            <option value="global">Global</option>
          </select>
          <select
            value={existingSkillId || ""}
            onChange={(e) => setExistingSkillId(e.target.value || null)}
            className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none"
          >
            <option value="">New skill</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>↻ {s.name}</option>
            ))}
          </select>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={existingSkillId ? "Describe improvements..." : "Describe the skill you want to create..."}
          rows={4}
          className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:border-primary"
        />

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !description.trim()}
          className="w-full px-3 py-1.5 text-[10px] font-mono bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isGenerating ? (
            <><RefreshCw className="w-3 h-3 animate-spin" /> Generating...</>
          ) : (
            <><Sparkles className="w-3 h-3" /> {existingSkillId ? "Tune Skill" : "Generate Skill"}</>
          )}
        </button>
      </div>

      {generatedContent && (
        <div className="border border-primary/30 rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-1.5 border-b border-border flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Generated Output</span>
          </div>
          <pre className="p-3 text-[11px] font-mono text-foreground whitespace-pre-wrap max-h-[300px] overflow-y-auto">
            {generatedContent}
          </pre>
          <div className="border-t border-border px-3 py-2 flex items-center gap-1.5 justify-end">
            <button
              onClick={() => setGeneratedContent("")}
              className="px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Discard
            </button>
            {existingSkillId && (
              <button
                onClick={handleReplace}
                className="px-2 py-1 text-[10px] font-mono border border-border text-foreground rounded hover:bg-muted flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Replace Existing
              </button>
            )}
            <button
              onClick={handleSaveNew}
              className="px-3 py-1 text-[10px] font-mono bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-1"
            >
              <Save className="w-3 h-3" /> Save as Skill
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillCreator;
