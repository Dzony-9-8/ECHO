import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Upload,
  GitBranch,
  FileText,
  Globe,
  ChevronRight,
  Plus,
  Layers,
  ExternalLink,
} from "lucide-react";

interface ResearchBranch {
  id: string;
  query: string;
  status: "active" | "complete" | "forked";
  results: { title: string; source: string; snippet: string }[];
  children: ResearchBranch[];
  depth: number;
}

const mockBranches: ResearchBranch[] = [
  {
    id: "1",
    query: "How to optimize GPU inference for multi-model loading?",
    status: "complete",
    depth: 0,
    results: [
      {
        title: "Dynamic Model Offloading with llama.cpp",
        source: "arxiv.org",
        snippet:
          "Implementing a FIFO-based model cache allows efficient switching between models on limited VRAM...",
      },
      {
        title: "CUDA Memory Pools for ML Inference",
        source: "nvidia.com",
        snippet:
          "Using cudaMallocAsync with memory pools reduces allocation overhead by up to 40%...",
      },
    ],
    children: [
      {
        id: "1a",
        query: "FIFO vs LRU model caching strategies",
        status: "complete",
        depth: 1,
        results: [
          {
            title: "LRU outperforms FIFO for varied workloads",
            source: "research.google",
            snippet:
              "In multi-model inference, LRU caching with size-aware eviction provides 23% better hit rates...",
          },
        ],
        children: [],
      },
      {
        id: "1b",
        query: "Model quantization impact on 11GB VRAM",
        status: "active",
        depth: 1,
        results: [
          {
            title: "Q4_K_M quantization benchmarks",
            source: "huggingface.co",
            snippet:
              "4-bit quantization allows loading 7B models in ~4.5GB VRAM with minimal quality loss...",
          },
        ],
        children: [
          {
            id: "1b1",
            query: "GGUF vs GPTQ quantization comparison",
            status: "active",
            depth: 2,
            results: [],
            children: [],
          },
        ],
      },
    ],
  },
];

const statusColors: Record<string, string> = {
  active: "text-primary border-primary",
  complete: "text-terminal-cyan border-terminal-cyan",
  forked: "text-terminal-amber border-terminal-amber",
};

const ResearchNode = ({
  branch,
  onSelect,
  selected,
}: {
  branch: ResearchBranch;
  onSelect: (b: ResearchBranch) => void;
  selected: string | null;
}) => (
  <div className="space-y-1" style={{ paddingLeft: branch.depth * 24 }}>
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onSelect(branch)}
      className={`w-full text-left flex items-start gap-2 p-2.5 rounded border transition-all ${
        selected === branch.id
          ? "border-primary bg-muted"
          : "border-border bg-card hover:border-muted-foreground"
      }`}
    >
      {branch.children.length > 0 ? (
        <GitBranch
          className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
            statusColors[branch.status].split(" ")[0]
          }`}
        />
      ) : (
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-foreground line-clamp-2">
          {branch.query}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-[9px] uppercase tracking-widest font-mono ${
              statusColors[branch.status].split(" ")[0]
            }`}
          >
            {branch.status}
          </span>
          <span className="text-[9px] text-muted-foreground">
            {branch.results.length} results
          </span>
          {branch.children.length > 0 && (
            <span className="text-[9px] text-terminal-amber">
              {branch.children.length} forks
            </span>
          )}
        </div>
      </div>
    </motion.button>
    {branch.children.map((child) => (
      <ResearchNode
        key={child.id}
        branch={child}
        onSelect={onSelect}
        selected={selected}
      />
    ))}
  </div>
);

const ResearchView = () => {
  const [selectedBranch, setSelectedBranch] = useState<ResearchBranch | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");

  const findBranch = (
    branches: ResearchBranch[],
    id: string
  ): ResearchBranch | null => {
    for (const b of branches) {
      if (b.id === id) return b;
      const found = findBranch(b.children, id);
      if (found) return found;
    }
    return null;
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Research tree */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Start a new research query..."
              className="flex-1 bg-input border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
            />
            <button className="p-1.5 rounded border border-primary text-primary bg-primary/10 hover:bg-primary/20 transition-colors">
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono border border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10 hover:bg-terminal-cyan/20 transition-all uppercase tracking-widest">
              <Upload className="w-3 h-3" />
              Upload Docs
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono border border-terminal-amber text-terminal-amber bg-terminal-amber/10 hover:bg-terminal-amber/20 transition-all uppercase tracking-widest">
              <Globe className="w-3 h-3" />
              Web Search
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono border border-terminal-magenta text-terminal-magenta bg-terminal-magenta/10 hover:bg-terminal-magenta/20 transition-all uppercase tracking-widest">
              <Layers className="w-3 h-3" />
              RAG Query
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-display mb-3">
            Research Tree — Forking Enabled
          </div>
          {mockBranches.map((branch) => (
            <ResearchNode
              key={branch.id}
              branch={branch}
              onSelect={(b) => setSelectedBranch(b)}
              selected={selectedBranch?.id || null}
            />
          ))}
        </div>
      </div>

      {/* Results panel */}
      <div className="w-80 border-l border-border bg-sidebar flex flex-col">
        {selectedBranch ? (
          <>
            <div className="p-3 border-b border-border">
              <span className="text-[10px] uppercase tracking-widest text-primary font-display">
                Research Results
              </span>
            </div>
            <div className="p-3 border-b border-border">
              <p className="text-xs font-mono text-foreground leading-relaxed">
                {selectedBranch.query}
              </p>
              <div className="flex gap-2 mt-2">
                <button className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono border border-terminal-amber text-terminal-amber hover:bg-terminal-amber/10 transition-all">
                  <GitBranch className="w-2.5 h-2.5" />
                  Fork
                </button>
                <button className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono border border-primary text-primary hover:bg-primary/10 transition-all">
                  <Plus className="w-2.5 h-2.5" />
                  Deepen
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {selectedBranch.results.length === 0 && (
                <p className="text-[11px] text-muted-foreground font-mono">
                  Research in progress...
                </p>
              )}
              {selectedBranch.results.map((result, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-3 rounded border border-border bg-card hover:border-muted-foreground transition-all"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-3.5 h-3.5 text-terminal-cyan flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-foreground font-medium">
                        {result.title}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                        <span className="text-[9px] text-terminal-cyan font-mono">
                          {result.source}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                        {result.snippet}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-[11px] font-mono">
                Select a research branch
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchView;
