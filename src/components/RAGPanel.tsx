import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, FileText, Upload, Database, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { getBackendMode, getBackendUrl, fetchKnowledgeStatus, type KnowledgeFileStatus } from "@/lib/api";
import { toast } from "sonner";

interface SearchResult {
  id: string;
  title: string;
  content: string;
  similarity: number;
  vector_score?: number;
  bm25_score?: number;
  hybrid?: boolean;
}

const statusIcon = (s: KnowledgeFileStatus) => {
  if (s.status === "ok") return <CheckCircle2 className="w-3 h-3 text-primary" />;
  if (s.status === "processing") return <Loader2 className="w-3 h-3 text-terminal-amber animate-spin" />;
  if (s.status === "error") return <AlertCircle className="w-3 h-3 text-terminal-red" />;
  return <FileText className="w-3 h-3 text-muted-foreground" />;
};

const RAGPanel = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFileStatus[]>([]);
  const [uploadText, setUploadText] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [hybrid, setHybrid] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const mode = getBackendMode();

  useEffect(() => {
    if (mode !== "local") return;
    const poll = async () => {
      const s = await fetchKnowledgeStatus();
      if (s) setKnowledgeFiles(s.files);
    };
    poll();
    const id = setInterval(poll, 8000); // Knowledge files rarely change; 8s is plenty
    return () => clearInterval(id);
  }, [mode]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const url = getBackendUrl();
      const resp = await fetch(`${url}/api/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), limit: 8, hybrid }),
      });
      const data = await resp.json();
      setResults(data.results || []);
    } catch {
      toast.error("Search failed — is backend running?");
    } finally {
      setSearching(false);
    }
  };

  const handleFileRead = async (file: File) => {
    const text = await file.text();
    setUploadTitle(file.name.replace(/\.[^.]+$/, ""));
    setUploadText(text.slice(0, 50000));
  };

  const handleIngest = async () => {
    if (!uploadText.trim()) { toast.error("No content to ingest"); return; }
    setUploading(true);
    try {
      const url = getBackendUrl();
      const resp = await fetch(`${url}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: uploadTitle || "Untitled", content: uploadText }),
      });
      if (resp.ok) {
        toast.success("Document ingested");
        setUploadText("");
        setUploadTitle("");
      } else {
        toast.error("Ingest failed");
      }
    } catch {
      toast.error("Backend offline");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: search + results */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-terminal-cyan" />
            <span className="text-xs font-mono text-terminal-cyan uppercase tracking-wider">Knowledge Base Search</span>
            <div className="flex-1" />
            <label className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={hybrid} onChange={(e) => setHybrid(e.target.checked)} className="w-3 h-3 accent-primary" />
              Hybrid BM25+Vector
            </label>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search knowledge base..."
                className="w-full bg-input border border-border rounded pl-8 pr-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || mode !== "local"}
              className="px-3 py-1.5 rounded border border-primary text-primary bg-primary/10 hover:bg-primary/20 text-[10px] font-mono uppercase disabled:opacity-40 flex items-center gap-1"
            >
              {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              Search
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {mode !== "local" ? (
            <p className="text-[11px] text-muted-foreground font-mono text-center py-8">Switch to Local Mode to use knowledge search.</p>
          ) : results.length === 0 && !searching ? (
            <p className="text-[11px] text-muted-foreground font-mono text-center py-8">Search your knowledge base above, or ingest documents on the right.</p>
          ) : (
            results.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="p-3 rounded border border-border bg-card hover:border-muted-foreground transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-terminal-cyan flex-shrink-0" />
                    <span className="text-[11px] font-mono text-foreground font-medium">{r.title}</span>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {(r.similarity * 100).toFixed(0)}%
                    </span>
                    {r.hybrid && (
                      <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-terminal-cyan/10 text-terminal-cyan border border-terminal-cyan/20">hybrid</span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono line-clamp-3 leading-relaxed">{r.content}</p>
                {r.hybrid && (
                  <div className="flex gap-3 mt-1.5">
                    <span className="text-[8px] font-mono text-muted-foreground">vec {(r.vector_score! * 100).toFixed(0)}%</span>
                    <span className="text-[8px] font-mono text-muted-foreground">bm25 {(r.bm25_score! * 100).toFixed(0)}%</span>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Right: ingest + auto-watch status */}
      <div className="w-72 border-l border-border bg-sidebar flex flex-col">
        <div className="p-3 border-b border-border">
          <span className="text-[10px] uppercase tracking-widest text-terminal-amber font-display">Ingest Document</span>
        </div>

        <div className="p-3 border-b border-border space-y-2">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileRead(f); }}
            onClick={() => fileRef.current?.click()}
            className="border border-dashed border-border rounded p-3 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
          >
            <Upload className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-[9px] font-mono text-muted-foreground">Drop file or click to upload</p>
            <p className="text-[8px] font-mono text-muted-foreground/60">.txt .md .pdf .docx</p>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.md,.pdf,.docx" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileRead(f); }} />
          <input
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            placeholder="Document title..."
            className="w-full bg-input border border-border rounded px-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <textarea
            value={uploadText}
            onChange={(e) => setUploadText(e.target.value)}
            placeholder="Or paste text content here..."
            rows={4}
            className="w-full bg-input border border-border rounded px-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
          />
          <button
            onClick={handleIngest}
            disabled={uploading || !uploadText.trim() || mode !== "local"}
            className="w-full py-1.5 rounded border border-terminal-cyan text-terminal-cyan text-[10px] font-mono hover:bg-terminal-cyan/10 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-colors"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
            Ingest to Knowledge Base
          </button>
        </div>

        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Auto-Watch: /knowledge</span>
          <RefreshCw className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {knowledgeFiles.length === 0 ? (
            <p className="text-[9px] font-mono text-muted-foreground leading-relaxed">
              {mode === "local"
                ? "Drop files into backend/knowledge/ to auto-ingest them."
                : "Local mode required."}
            </p>
          ) : (
            knowledgeFiles.map((f) => (
              <div key={f.file} className="flex items-start gap-2 py-0.5">
                {statusIcon(f)}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono text-foreground truncate block">{f.file}</span>
                  <span className="text-[8px] font-mono text-muted-foreground">
                    {f.status === "ok" ? `${f.chunks} chunks` : f.error || f.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RAGPanel;
