import { useState } from "react";
import { Plus, Star, Trash2, Search, BookOpen, Code2, PenTool, Lightbulb, FileText, Sparkles, X, Edit3, Copy } from "lucide-react";
import { usePromptLibrary, CATEGORIES, type PromptTemplate } from "@/hooks/usePromptLibrary";
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

const PromptLibraryPanel = ({ onSelect }: Props) => {
  const { templates, loading, create, remove, toggleFavorite } = usePromptLibrary();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("general");

  const filtered = templates.filter((t) => {
    if (activeCategory !== "all" && t.category !== activeCategory) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) { toast.error("Title and content required"); return; }
    // Extract variables like {{variable_name}}
    const vars = [...newContent.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    await create({
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      is_favorite: false,
      variables: vars,
    });
    setNewTitle("");
    setNewContent("");
    setShowCreate(false);
    toast.success("Template created");
  };

  const handleUse = (template: PromptTemplate) => {
    let prompt = template.content;
    // Replace variables with placeholders
    for (const v of template.variables) {
      prompt = prompt.replace(`{{${v}}}`, `[${v}]`);
    }
    onSelect(prompt);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-mono text-primary uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Prompt Library
          </h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1 px-2 py-1 rounded border border-primary text-primary text-[10px] font-mono hover:bg-primary/10 transition-colors"
          >
            <Plus className="w-3 h-3" /> New
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="space-y-2 p-2 border border-border rounded bg-muted/50">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Template title..."
              className="w-full bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Template content... Use {{variable}} for placeholders"
              className="w-full bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              rows={3}
            />
            <div className="flex items-center gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="bg-input border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="flex-1" />
              <button onClick={() => setShowCreate(false)} className="text-[10px] font-mono text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={handleCreate} className="px-2 py-1 rounded border border-primary text-primary text-[10px] font-mono hover:bg-primary/10">Save</button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full bg-input border border-border rounded pl-7 pr-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${
              activeCategory === "all" ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"
            }`}
          >All</button>
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c] || BookOpen;
            return (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors flex items-center gap-1 ${
                  activeCategory === c ? `border-current ${CATEGORY_COLORS[c]} bg-current/10` : "border-border text-muted-foreground"
                }`}
              >
                <Icon className="w-2.5 h-2.5" />
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <p className="text-[10px] text-muted-foreground text-center py-4 font-mono animate-pulse">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <FileText className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-[10px] text-muted-foreground font-mono">
              {search ? "No matching templates" : "No templates yet — create one!"}
            </p>
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
                      {t.is_favorite && <Star className="w-2.5 h-2.5 text-terminal-amber fill-terminal-amber" />}
                    </div>
                    <p className="text-[9px] text-muted-foreground font-mono line-clamp-2 mt-0.5">{t.content}</p>
                    {t.variables.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {t.variables.map((v) => (
                          <span key={v} className="text-[8px] font-mono px-1 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleUse(t)} className="p-1 rounded text-primary hover:bg-primary/10" title="Use template">
                      <Copy className="w-3 h-3" />
                    </button>
                    <button onClick={() => toggleFavorite(t.id)} className="p-1 rounded text-muted-foreground hover:text-terminal-amber" title="Favorite">
                      <Star className={`w-3 h-3 ${t.is_favorite ? "text-terminal-amber fill-terminal-amber" : ""}`} />
                    </button>
                    <button onClick={() => remove(t.id)} className="p-1 rounded text-muted-foreground hover:text-terminal-red" title="Delete">
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
