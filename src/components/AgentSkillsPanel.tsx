import { useState, useCallback, useRef } from "react";
import {
  getAllSkills,
  saveSkill,
  updateSkill,
  deleteSkill,
  parseSkillFile,
  AGENT_NAMES,
  type AgentSkill,
  type AgentName,
} from "@/lib/agentSkills";
import {
  Zap,
  Plus,
  Upload,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

const agentColors: Record<string, string> = {
  Supervisor: "text-terminal-amber border-terminal-amber",
  Developer: "text-terminal-cyan border-terminal-cyan",
  Researcher: "text-primary border-primary",
  Critic: "text-terminal-red border-terminal-red",
  global: "text-terminal-magenta border-terminal-magenta",
};

const AgentSkillsPanel = () => {
  const [skills, setSkills] = useState<AgentSkill[]>(getAllSkills);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newAgent, setNewAgent] = useState<string>("Developer");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => setSkills(getAllSkills()), []);

  const handleCreate = () => {
    if (!newName.trim() || !newContent.trim()) {
      toast.error("Name and content are required");
      return;
    }
    saveSkill({
      name: newName.trim(),
      content: newContent.trim(),
      agent: newAgent,
      enabled: true,
      source: "custom",
    });
    setNewName("");
    setNewContent("");
    setShowNew(false);
    refresh();
    toast.success(`Skill "${newName}" added to ${newAgent}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    let count = 0;
    for (const file of Array.from(files)) {
      if (!file.name.match(/\.(md|txt|yaml|yml)$/i)) {
        toast.error(`Skipped ${file.name} — only .md, .txt, .yaml files supported`);
        continue;
      }

      const text = await file.text();
      const parsed = parseSkillFile(text, file.name);

      saveSkill({
        name: parsed.name,
        content: parsed.content,
        agent: newAgent,
        enabled: true,
        source: file.name,
      });
      count++;
    }

    if (count > 0) {
      toast.success(`Imported ${count} skill file(s) → ${newAgent}`);
      refresh();
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleToggle = (id: string, enabled: boolean) => {
    updateSkill(id, { enabled: !enabled });
    refresh();
  };

  const handleDelete = (id: string, name: string) => {
    deleteSkill(id);
    refresh();
    toast.success(`Deleted "${name}"`);
  };

  const handleUpdateContent = (id: string, content: string) => {
    updateSkill(id, { content });
    setEditingId(null);
    refresh();
  };

  const handleReassign = (id: string, agent: string) => {
    updateSkill(id, { agent });
    refresh();
  };

  // Group skills by agent
  const grouped: Record<string, AgentSkill[]> = { global: [] };
  for (const name of AGENT_NAMES) grouped[name] = [];
  for (const skill of skills) {
    if (!grouped[skill.agent]) grouped[skill.agent] = [];
    grouped[skill.agent].push(skill);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-terminal-amber" />
          <span className="font-mono text-xs uppercase tracking-widest text-foreground">
            Agent Skills
          </span>
          <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {skills.filter((s) => s.enabled).length} active
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Import .md skill files"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowNew(!showNew)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Create new skill"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt,.yaml,.yml"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* New skill form */}
        {showNew && (
          <div className="border border-primary/30 rounded-lg p-3 bg-card space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Skill name..."
                className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              <select
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                className="bg-muted border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              >
                {AGENT_NAMES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                <option value="global">Global (all agents)</option>
              </select>
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Paste skill content here... (Markdown supported, e.g. Claude Code skill files)"
              rows={8}
              className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:border-primary"
            />
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => setShowNew(false)}
                className="px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-3 py-1 text-[10px] font-mono bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Add Skill
              </button>
            </div>
          </div>
        )}

        {/* Upload hint */}
        {skills.length === 0 && !showNew && (
          <div className="text-center py-12 space-y-3">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
            <div className="text-xs text-muted-foreground font-mono space-y-1">
              <p>No skills loaded yet</p>
              <p className="text-[10px]">
                Import Claude Code <code>.md</code> skill files or create custom skills
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-[10px] font-mono border border-border text-foreground rounded hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-3 h-3" /> Import Files
              </button>
              <button
                onClick={() => setShowNew(true)}
                className="px-3 py-1.5 text-[10px] font-mono bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" /> Create Skill
              </button>
            </div>
          </div>
        )}

        {/* Agent groups */}
        {[...AGENT_NAMES, "global" as const].map((agent) => {
          const agentSkills = grouped[agent] || [];
          if (agentSkills.length === 0) return null;
          const isExpanded = expandedAgent === agent;

          return (
            <div key={agent} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedAgent(isExpanded ? null : agent)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-mono hover:bg-muted/50 transition-colors ${
                  agentColors[agent] || "text-foreground"
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {agent === "global" ? (
                  <Globe className="w-3 h-3" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                <span className="uppercase tracking-widest">
                  {agent === "global" ? "Global" : agent}
                </span>
                <span className="text-[9px] text-muted-foreground ml-auto">
                  {agentSkills.filter((s) => s.enabled).length}/{agentSkills.length}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {agentSkills.map((skill) => (
                    <SkillRow
                      key={skill.id}
                      skill={skill}
                      isEditing={editingId === skill.id}
                      onToggle={() => handleToggle(skill.id, skill.enabled)}
                      onDelete={() => handleDelete(skill.id, skill.name)}
                      onEdit={() => setEditingId(skill.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSave={(content) => handleUpdateContent(skill.id, content)}
                      onReassign={(agent) => handleReassign(skill.id, agent)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Import target selector */}
        {skills.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <span className="text-[9px] font-mono text-muted-foreground">Import target:</span>
            <select
              value={newAgent}
              onChange={(e) => setNewAgent(e.target.value)}
              className="bg-muted border border-border rounded px-2 py-0.5 text-[10px] font-mono text-foreground focus:outline-none"
            >
              {AGENT_NAMES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
              <option value="global">Global</option>
            </select>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-0.5 text-[10px] font-mono border border-border text-muted-foreground rounded hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1"
            >
              <Upload className="w-3 h-3" /> Import
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Individual skill row
const SkillRow = ({
  skill,
  isEditing,
  onToggle,
  onDelete,
  onEdit,
  onCancelEdit,
  onSave,
  onReassign,
}: {
  skill: AgentSkill;
  isEditing: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (content: string) => void;
  onReassign: (agent: string) => void;
}) => {
  const [editContent, setEditContent] = useState(skill.content);

  return (
    <div className={`px-3 py-2 ${skill.enabled ? "" : "opacity-50"}`}>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title={skill.enabled ? "Disable" : "Enable"}
        >
          {skill.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>
        <span className="text-[11px] font-mono text-foreground flex-1 truncate">
          {skill.name}
        </span>
        {skill.source && (
          <span className="text-[8px] font-mono text-muted-foreground bg-muted px-1 rounded truncate max-w-[80px]">
            {skill.source}
          </span>
        )}
        <select
          value={skill.agent}
          onChange={(e) => onReassign(e.target.value)}
          className="bg-transparent border-none text-[9px] font-mono text-muted-foreground focus:outline-none cursor-pointer"
        >
          {AGENT_NAMES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
          <option value="global">Global</option>
        </select>
        {!isEditing ? (
          <button onClick={onEdit} className="text-muted-foreground hover:text-foreground">
            <Edit3 className="w-3 h-3" />
          </button>
        ) : (
          <>
            <button onClick={() => onSave(editContent)} className="text-primary hover:text-primary/80">
              <Check className="w-3 h-3" />
            </button>
            <button onClick={onCancelEdit} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </>
        )}
        <button onClick={onDelete} className="text-terminal-red/60 hover:text-terminal-red">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {isEditing && (
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={10}
          className="mt-2 w-full bg-muted border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground resize-y focus:outline-none focus:border-primary"
        />
      )}

      {!isEditing && (
        <p className="mt-1 text-[9px] font-mono text-muted-foreground line-clamp-2">
          {skill.content.slice(0, 150)}...
        </p>
      )}
    </div>
  );
};

export default AgentSkillsPanel;
