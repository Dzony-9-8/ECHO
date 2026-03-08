import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Search, Database, Clock, Tag, ChevronRight, Trash2 } from "lucide-react";

interface MemoryEntry {
  id: string;
  type: "conversation" | "document" | "knowledge";
  content: string;
  summary: string;
  tags: string[];
  similarity?: number;
  timestamp: Date;
  source: string;
}

// Mock data — in production, fetched from /api/memory
const mockMemories: MemoryEntry[] = [
  {
    id: "1",
    type: "conversation",
    content: "User asked about implementing a web scraper in Python using BeautifulSoup and requests. The system provided a working solution with error handling and rate limiting.",
    summary: "Python web scraper with BeautifulSoup",
    tags: ["python", "scraping", "beautifulsoup"],
    similarity: 0.95,
    timestamp: new Date(Date.now() - 3600000),
    source: "Chat Session #42",
  },
  {
    id: "2",
    type: "knowledge",
    content: "DeepSeek R1 performs best with structured chain-of-thought prompts. Avoid ambiguous instructions. Temperature 0.3 optimal for reasoning tasks.",
    summary: "DeepSeek R1 optimization notes",
    tags: ["deepseek", "optimization", "prompting"],
    similarity: 0.87,
    timestamp: new Date(Date.now() - 86400000),
    source: "System Analysis",
  },
  {
    id: "3",
    type: "document",
    content: "FastAPI performance optimization guide: Use async endpoints, connection pooling with databases, response streaming for large payloads, and proper middleware ordering.",
    summary: "FastAPI performance guide",
    tags: ["fastapi", "performance", "async"],
    similarity: 0.82,
    timestamp: new Date(Date.now() - 172800000),
    source: "Uploaded: fastapi_guide.pdf",
  },
  {
    id: "4",
    type: "conversation",
    content: "Discussed CUDA memory management for running multiple models. Solution: Use model offloading with llama.cpp, load models on-demand, and implement a FIFO cache.",
    summary: "CUDA memory management for multi-model",
    tags: ["cuda", "gpu", "memory", "llama.cpp"],
    similarity: 0.78,
    timestamp: new Date(Date.now() - 259200000),
    source: "Chat Session #38",
  },
  {
    id: "5",
    type: "knowledge",
    content: "CriticAgent hallucination detection: Check for unsupported claims, verify code syntax, cross-reference with memory. Confidence threshold: 0.7.",
    summary: "Critic hallucination detection patterns",
    tags: ["critic", "hallucination", "validation"],
    similarity: 0.71,
    timestamp: new Date(Date.now() - 345600000),
    source: "Self-Improvement Loop",
  },
];

const typeColors: Record<string, string> = {
  conversation: "text-primary border-primary",
  document: "text-terminal-cyan border-terminal-cyan",
  knowledge: "text-terminal-amber border-terminal-amber",
};

const typeIcons: Record<string, typeof Brain> = {
  conversation: Clock,
  document: Database,
  knowledge: Brain,
};

const MemoryView = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<MemoryEntry | null>(null);

  const filtered = mockMemories.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tags.some((t) => t.includes(searchQuery.toLowerCase()));
    const matchesType = !selectedType || m.type === selectedType;
    return matchesSearch && matchesType;
  });

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
          </div>
          <div className="flex gap-2">
            {["conversation", "document", "knowledge"].map((type) => {
              const Icon = typeIcons[type];
              return (
                <button
                  key={type}
                  onClick={() =>
                    setSelectedType(selectedType === type ? null : type)
                  }
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
          {filtered.map((entry, i) => {
            const Icon = typeIcons[entry.type];
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedEntry(entry)}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  selectedEntry?.id === entry.id
                    ? "border-primary bg-muted"
                    : "border-border bg-card hover:border-muted-foreground"
                }`}
              >
                <div className="flex items-start gap-2">
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      typeColors[entry.type].split(" ")[0]
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono text-foreground">
                      {entry.summary}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {entry.source} •{" "}
                      {entry.timestamp.toLocaleDateString()}
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground font-mono"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  {entry.similarity && (
                    <div className="text-[10px] font-mono text-primary flex-shrink-0">
                      {(entry.similarity * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      <div className="w-80 border-l border-border bg-sidebar flex flex-col">
        {selectedEntry ? (
          <>
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-primary font-display">
                Memory Detail
              </span>
              <button className="text-muted-foreground hover:text-terminal-red transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <label className="text-[9px] uppercase tracking-widest text-muted-foreground block mb-1">
                  Type
                </label>
                <span
                  className={`text-xs font-mono ${
                    typeColors[selectedEntry.type].split(" ")[0]
                  }`}
                >
                  {selectedEntry.type}
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
              <div>
                <label className="text-[9px] uppercase tracking-widest text-muted-foreground block mb-1">
                  Source
                </label>
                <span className="text-xs font-mono text-foreground">
                  {selectedEntry.source}
                </span>
              </div>
              {selectedEntry.similarity && (
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoryView;
