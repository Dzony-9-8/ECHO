import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Brain, Search, Database, Clock, Tag, ChevronRight, Trash2, Plus, RefreshCw, Zap } from "lucide-react";
import { listMemories, recallMemories, storeMemory, deleteMemory, type MemoryEntry, getBackendMode } from "@/lib/api";
import { toast } from "sonner";

const typeColors: Record<string, string> = {
  episodic: "text-primary border-primary",
  semantic: "text-terminal-cyan border-terminal-cyan",
  procedural: "text-terminal-amber border-terminal-amber",
};

const typeIcons: Record<string, typeof Brain> = {
  episodic: Clock,
  semantic: Database,
  procedural: Zap,
};

const typeLabels: Record<string, string> = {
  episodic: "Past Conversations",
  semantic: "Learned Facts",
  procedural: "Strategies",
};

const MemoryView = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<MemoryEntry | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemory, setNewMemory] = useState({ type: "semantic" as const, content: "", tags: "" });
  const isLocal = getBackendMode() === "local";

  const loadMemories = useCallback(async () => {
    if (!isLocal) return;
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const results = await recallMemories(searchQuery, 20, selectedType || undefined);
        setMemories(results);
      } else {
        const all = await listMemories(selectedType || "all");
        setMemories(all);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedType, isLocal]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleDelete = async (id: string) => {
    const ok = await deleteMemory(id);
    if (ok) {
      setMemories((prev) => prev.filter((m) => m.id !== id));
      if (selectedEntry?.id === id) setSelectedEntry(null);
      toast.success("Memory deleted");
    } else {
      toast.error("Failed to delete memory");
    }
  };

  const handleAdd = async () => {
    if (!newMemory.content.trim()) return;
    const tags = newMemory.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const result = await storeMemory(newMemory.type as any, newMemory.content, undefined, tags);
    if (result) {
      toast.success(`${newMemory.type} memory stored`);
      setNewMemory({ type: "semantic", content: "", tags: "" });
      setShowAddForm(false);
      loadMemories();
    } else {
      toast.error("Failed to store memory");
    }
  };

  const filtered = memories;

  if (!isLocal) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground p-8">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm font-mono mb-2">Agent Memory requires Local Mode</p>
          <p className="text-[10px] font-mono">Switch to local backend to access memories</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Memory list */}
      <div className="flex-1 flex flex-col">
        {/* Search & filters */}
        <div className="border-b border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Semantic search across memory..."
              className="flex-1 bg-input border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
            />
            <button onClick={loadMemories} className="text-muted-foreground hover:text-foreground" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => setShowAddForm(!showAddForm)} className="text-muted-foreground hover:text-primary" title="Add memory">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className="p-2 rounded border border-border bg-muted/30 space-y-2">
              <div className="flex gap-2">
                {(["episodic", "semantic", "procedural"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewMemory({ ...newMemory, type: t })}
                    className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                      newMemory.type === t ? typeColors[t] + " bg-current/10" : "border-border text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <textarea
                value={newMemory.content}
                onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                placeholder="Memory content..."
                className="w-full bg-input border border-border rounded px-2 py-1 text-xs text-foreground font-mono resize-none h-16 focus:outline-none focus:border-primary"
              />
              <input
                value={newMemory.tags}
                onChange={(e) => setNewMemory({ ...newMemory, tags: e.target.value })}
                placeholder="Tags (comma separated)"
                className="w-full bg-input border border-border rounded px-2 py-1 text-xs text-foreground font-mono focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleAdd}
                className="w-full py-1 rounded border border-primary bg-primary/10 text-primary text-[10px] font-mono uppercase"
              >
                Store Memory
              </button>
            </div>
          )}

          <div className="flex gap-2">
            {(["episodic", "semantic", "procedural"] as const).map((type) => {
              const Icon = typeIcons[type];
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(selectedType === type ? null : type)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-widest border transition-all ${
                    selectedType === type
                      ? typeColors[type] + " bg-current/10"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {type}
                </button>
              );
            })}
            <div className="flex-1" />
            <span className="text-[10px] text-muted-foreground font-mono self-center">
              {filtered.length} entries
            </span>
          </div>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-30" />
              <p className="text-[11px] font-mono">Loading memories...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-[11px] font-mono">No memories yet</p>
              <p className="text-[9px] font-mono mt-1">Memories are auto-extracted from conversations</p>
            </div>
          ) : (
            filtered.map((entry, i) => {
              const Icon = typeIcons[entry.type] || Brain;
              const colors = typeColors[entry.type] || "text-muted-foreground border-border";
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedEntry(entry)}
                  className={`p-3 rounded border cursor-pointer transition-all ${
                    selectedEntry?.id === entry.id
                      ? "border-primary bg-muted"
                      : "border-border bg-card hover:border-muted-foreground"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${colors.split(" ")[0]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono text-foreground line-clamp-2">
                        {entry.summary || entry.content?.slice(0, 100)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {typeLabels[entry.type] || entry.type}
                        {entry.timestamp ? ` • ${new Date(entry.timestamp).toLocaleDateString()}` : ""}
                      </div>
                      {entry.tags && entry.tags.length > 0 && entry.tags[0] !== "" && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {entry.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground font-mono"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {entry.similarity !== undefined && entry.similarity > 0 && (
                      <div className="text-[10px] font-mono text-primary flex-shrink-0">
                        {(entry.similarity * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="w-80 border-l border-border bg-sidebar flex flex-col hidden lg:flex">
        {selectedEntry ? (
          <>
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-primary font-display">
                Memory Detail
              </span>
              <button
                onClick={() => handleDelete(selectedEntry.id)}
                className="text-muted-foreground hover:text-terminal-red transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <label className="text-[9px] uppercase tracking-widest text-muted-foreground block mb-1">
                  Type
                </label>
                <span className={`text-xs font-mono ${(typeColors[selectedEntry.type] || "").split(" ")[0]}`}>
                  {typeLabels[selectedEntry.type] || selectedEntry.type}
                </span>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-widest text-muted-foreground block mb-1">
                  Summary
                </label>
                <p className="text-sm font-mono text-foreground">
                  {selectedEntry.summary}
                </p>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-widest text-muted-foreground block mb-1">
                  Full Content
                </label>
                <p className="text-xs font-mono text-foreground leading-relaxed bg-muted p-2 rounded border border-border">
                  {selectedEntry.content}
                </p>
              </div>
              {selectedEntry.tags && selectedEntry.tags.length > 0 && selectedEntry.tags[0] !== "" && (
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-muted-foreground block mb-1">
                    Tags
                  </label>
                  <div className="flex gap-1 flex-wrap">
                    {selectedEntry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary font-mono"
                      >
                        <Tag className="w-2.5 h-2.5 inline mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedEntry.similarity !== undefined && selectedEntry.similarity > 0 && (
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-muted-foreground block mb-1">
                    Similarity Score
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${selectedEntry.similarity * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-primary">
                      {(selectedEntry.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-[11px] font-mono">Select a memory entry</p>
              <p className="text-[9px] font-mono mt-1 opacity-60">
                3 types: episodic · semantic · procedural
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoryView;
