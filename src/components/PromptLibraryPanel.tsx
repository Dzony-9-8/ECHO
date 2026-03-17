import { useState } from "react";
import {
  Plus, Star, Trash2, Search, BookOpen, Code2, PenTool, Lightbulb,
  FileText, Sparkles, Edit3, Copy, X, Check, Wand2, Loader2, ArrowRight,
} from "lucide-react";
import { usePromptLibrary, CATEGORIES, type PromptTemplate } from "@/hooks/usePromptLibrary";
import { getBackendUrl } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  onSelect: (prompt: string) => void;
}

const CATEGORY_ICONS: Record<string, typeof Code2> = {
  general: BookOpen,
  coding: Code2,
  research: Search,
  writing: PenTool,
  analysis: Lightbulb,
  creative: Sparkles,
};

const CATEGORY_COLORS: Record<string, string> = {
  general: "text-foreground",
  coding: "text-terminal-cyan",
  research: "text-primary",
  writing: "text-terminal-magenta",
  analysis: "text-terminal-amber",
  creative: "text-accent",
};

// Variable substitution dialog — shown when a template has {{vars}}
const VarSubDialog = ({
  template,
  onConfirm,
  onCancel,
}: {
  template: PromptTemplate;
  onConfirm: (filled: string) => void;
  onCancel: () => void;
}) => {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(template.variables.map((v) => [v, ""]))
  );

  const handleConfirm = () => {
    let result = template.content;
    for (const [key, val] of Object.entries(values)) {
      result = result.replaceAll(`{{${key}}}`, val || `[${key}]`);
    }
    onConfirm(result);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-80 border border-border bg-card rounded p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-primary uppercase tracking-wider">Fill Variables</span>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono">{template.title}</p>
        <div className="space-y-2">
          {template.variables.map((v) => (
            <div key={v}>
              <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono block mb-0.5">
                {`{{${v}}}`}
              </label>
              <input
                value={values[v]}
                onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                placeholder={`Enter ${v}...`}
                className="w-full bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-1.5 rounded border border-border text-muted-foreground text-[10px] font-mono hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-1.5 rounded border border-primary text-primary text-[10px] font-mono hover:bg-primary/10 flex items-center justify-center gap-1"
          >
            <Check className="w-3 h-3" /> Insert
          </button>
        </div>
      </div>
    </div>
  );
};

// Optimize dialog
interface OptimizeResult {
  original: string;
  optimized: string;
  analysis: string;
  changes: string[];
  score_before: number;
  score_after: number;
}

const OptimizeDialog = ({
  template,
  onApply,
  onCancel,
}: {
  template: PromptTemplate;
  onApply: (newContent: string) => void;
  onCancel: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [goal, setGoal] = useState("");

  const runOptimize = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/prompts/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: template.content, goal }),
      });
      if (!resp.ok) throw new Error("Failed to optimize");
      const data = await resp.json();
      setResult(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg border border-border bg-card rounded p-4 space-y-3 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-terminal-magenta" />
            <span className="text-xs font-mono text-terminal-magenta uppercase tracking-wider">AI Prompt Optimizer</span>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-[9px] text-muted-foreground font-mono">{template.title}</p>

        {!result && (
          <>
            <div>
              <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">
                Goal / Use-case (optional)
              </label>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. for generating clean code, for customer support..."
                className="w-full bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-terminal-magenta"
              />
            </div>
            <div className="p-2 rounded bg-muted/40 border border-border">
              <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest mb-1">Original</p>
              <p className="text-[10px] font-mono text-foreground line-clamp-4">{template.content}</p>
            </div>
            <button
              onClick={runOptimize}
              disabled={loading}
              className="w-full py-2 rounded border border-terminal-magenta bg-terminal-magenta/10 text-terminal-magenta text-[10px] font-mono hover:bg-terminal-magenta/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {loading ? "Analyzing & Optimizing..." : "Optimize Prompt"}
            </button>
          </>
        )}

        {result && (
          <>
            {result.analysis && (
              <div className="p-2 rounded bg-muted/30 border border-border">
                <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest mb-1">Analysis</p>
                <p className="text-[10px] font-mono text-muted-foreground">{result.analysis}</p>
              </div>
            )}

            {result.changes.length > 0 && (
              <div>
                <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest mb-1">Improvements</p>
                <ul className="space-y-0.5">
                  {result.changes.map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[9px] font-mono text-foreground">
                      <Check className="w-2.5 h-2.5 text-primary mt-0.5 flex-shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] text-muted-foreground font-mono">Before</p>
                  <span className="text-[9px] font-mono text-terminal-red">{result.score_before}/10</span>
                </div>
                <p className="text-[9px] font-mono text-muted-foreground line-clamp-4">{result.original}</p>
              </div>
              <div className="p-2 rounded bg-primary/5 border border-primary/30">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] text-primary font-mono">After</p>
                  <span className="text-[9px] font-mono text-primary">{result.score_after}/10</span>
                </div>
                <p className="text-[9px] font-mono text-foreground line-clamp-4">{result.optimized}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onCancel} className="flex-1 py-1.5 rounded border border-border text-muted-foreground text-[10px] font-mono hover:text-foreground">
                Discard
              </button>
              <button
                onClick={() => onApply(result.optimized)}
                className="flex-1 py-1.5 rounded border border-primary text-primary text-[10px] font-mono hover:bg-primary/10 flex items-center justify-center gap-1"
              >
                <ArrowRight className="w-3 h-3" /> Apply Optimized
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const PromptLibraryPanel = ({ onSelect }: Props) => {
  const { templates, loading, create, update, remove, toggleFavorite } = usePromptLibrary();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [varTemplate, setVarTemplate] = useState<PromptTemplate | null>(null);
  const [optimizeTemplate, setOptimizeTemplate] = useState<PromptTemplate | null>(null);

  // Form state (shared for create + edit)
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("general");

  const openCreate = () => {
    setEditingId(null);
    setFormTitle("");
    setFormContent("");
    setFormCategory("general");
    setShowCreate(true);
  };

  const openEdit = (t: PromptTemplate) => {
    setEditingId(t.id);
    setFormTitle(t.title);
    setFormContent(t.content);
    setFormCategory(t.category);
    setShowCreate(true);
  };

  const closeForm = () => {
    setShowCreate(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Title and content required");
      return;
    }
    const vars = [...formContent.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    if (editingId) {
      await update(editingId, { title: formTitle.trim(), content: formContent.trim(), category: formCategory, variables: vars });
      toast.success("Template updated");
    } else {
      await create({ title: formTitle.trim(), content: formContent.trim(), category: formCategory, is_favorite: false, variables: vars });
      toast.success("Template created");
    }
    closeForm();
  };

  const handleUse = (t: PromptTemplate) => {
    if (t.variables.length > 0) {
      setVarTemplate(t);
    } else {
      onSelect(t.content);
    }
  };

  const filtered = templates.filter((t) => {
    if (showFavOnly && !t.is_favorite) return false;
    if (activeCategory !== "all" && t.category !== activeCategory) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {varTemplate && (
        <VarSubDialog
          template={varTemplate}
          onConfirm={(filled) => { setVarTemplate(null); onSelect(filled); }}
          onCancel={() => setVarTemplate(null)}
        />
      )}

      {optimizeTemplate && (
        <OptimizeDialog
          template={optimizeTemplate}
          onApply={async (newContent) => {
            const vars = [...newContent.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
            await update(optimizeTemplate.id, { content: newContent, variables: vars });
            setOptimizeTemplate(null);
            toast.success("Prompt optimized and saved");
          }}
          onCancel={() => setOptimizeTemplate(null)}
        />
      )}

      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-mono text-primary uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Prompt Library
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowFavOnly(!showFavOnly)}
              className={`p-1.5 rounded border transition-colors ${showFavOnly ? "border-terminal-amber text-terminal-amber bg-terminal-amber/10" : "border-border text-muted-foreground hover:text-foreground"}`}
              title="Favorites only"
            >
              <Star className="w-3 h-3" />
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-1 px-2 py-1 rounded border border-primary text-primary text-[10px] font-mono hover:bg-primary/10 transition-colors"
            >
              <Plus className="w-3 h-3" /> New
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="space-y-2 p-2 border border-border rounded bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-widest font-mono text-muted-foreground">
                {editingId ? "Edit Template" : "New Template"}
              </span>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
            </div>
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Template title..."
              className="w-full bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Content... Use {{variable}} for fill-in placeholders"
              className="w-full bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              rows={4}
            />
            {(() => {
              const vars = [...formContent.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
              return vars.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {vars.map((v) => (
                    <span key={v} className="text-[8px] font-mono px-1 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">{`{{${v}}}`}</span>
                  ))}
                </div>
              ) : null;
            })()}
            <div className="flex items-center gap-2">
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="bg-input border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex-1" />
              <button onClick={closeForm} className="text-[10px] font-mono text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={handleSave} className="px-2 py-1 rounded border border-primary text-primary text-[10px] font-mono hover:bg-primary/10 flex items-center gap-1">
                <Check className="w-3 h-3" /> {editingId ? "Update" : "Save"}
              </button>
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full bg-input border border-border rounded pl-7 pr-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setActiveCategory("all")} className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${activeCategory === "all" ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}>All</button>
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c] || BookOpen;
            return (
              <button key={c} onClick={() => setActiveCategory(c)} className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors flex items-center gap-1 ${activeCategory === c ? `border-current ${CATEGORY_COLORS[c]} bg-current/10` : "border-border text-muted-foreground"}`}>
                <Icon className="w-2.5 h-2.5" />{c}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <p className="text-[10px] text-muted-foreground text-center py-4 font-mono animate-pulse">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <FileText className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-[10px] text-muted-foreground font-mono">{search ? "No matching templates" : "No templates yet — create one!"}</p>
          </div>
        ) : (
          filtered.map((t) => {
            const Icon = CATEGORY_ICONS[t.category] || BookOpen;
            return (
              <div key={t.id} className="group px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/50">
                <div className="flex items-start gap-2">
                  <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${CATEGORY_COLORS[t.category]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-mono text-foreground font-medium truncate">{t.title}</span>
                      {t.is_favorite && <Star className="w-2.5 h-2.5 text-terminal-amber fill-terminal-amber flex-shrink-0" />}
                    </div>
                    <p className="text-[9px] text-muted-foreground font-mono line-clamp-2 mt-0.5">{t.content}</p>
                    {t.variables.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {t.variables.map((v) => (
                          <span key={v} className="text-[8px] font-mono px-1 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">{`{{${v}}}`}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => handleUse(t)} className="p-1 rounded text-primary hover:bg-primary/10" title="Use">
                      <Copy className="w-3 h-3" />
                    </button>
                    <button onClick={() => openEdit(t)} className="p-1 rounded text-muted-foreground hover:text-terminal-cyan" title="Edit">
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button onClick={() => setOptimizeTemplate(t)} className="p-1 rounded text-muted-foreground hover:text-terminal-magenta" title="AI Optimize">
                      <Wand2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => toggleFavorite(t.id)} className="p-1 rounded text-muted-foreground hover:text-terminal-amber" title="Favorite">
                      <Star className={`w-3 h-3 ${t.is_favorite ? "text-terminal-amber fill-terminal-amber" : ""}`} />
                    </button>
                    <button onClick={async () => { await remove(t.id); toast.success("Deleted"); }} className="p-1 rounded text-muted-foreground hover:text-terminal-red" title="Delete">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PromptLibraryPanel;
