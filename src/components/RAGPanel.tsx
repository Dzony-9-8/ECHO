import { useState } from "react";
import { Search, Upload, Trash2, FileText, Plus, X } from "lucide-react";
import { useDocuments, type Document } from "@/hooks/useDocuments";
import { toast } from "sonner";

const RAGPanel = () => {
  const { documents, loading, addDocument, removeDocument, searchDocuments } = useDocuments();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Document[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const handleSearch = async () => {
    if (!search.trim()) { setResults(null); return; }
    const r = await searchDocuments(search);
    setResults(r);
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || !newContent.trim()) { toast.error("Title and content required"); return; }
    await addDocument({ title: newTitle, content: newContent });
    setNewTitle("");
    setNewContent("");
    setShowAdd(false);
    toast.success("Document added to knowledge base");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }

    const text = await file.text();
    await addDocument({
      title: file.name,
      content: text,
      fileName: file.name,
      fileType: file.type,
    });
    toast.success(`Indexed: ${file.name}`);
    e.target.value = "";
  };

  const displayDocs = results !== null ? results : documents;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-mono text-primary uppercase tracking-wider flex items-center gap-2">
            <Search className="w-4 h-4" /> Knowledge Base
          </h2>
          <div className="flex gap-1">
            <label className="flex items-center gap-1 px-2 py-1 rounded border border-terminal-cyan text-terminal-cyan text-[10px] font-mono hover:bg-terminal-cyan/10 transition-colors cursor-pointer">
              <Upload className="w-3 h-3" /> Upload
              <input type="file" accept=".txt,.md,.csv,.json,.py,.js,.ts,.html,.css" onChange={handleFileUpload} className="hidden" />
            </label>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 px-2 py-1 rounded border border-primary text-primary text-[10px] font-mono hover:bg-primary/10 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="space-y-2 p-2 border border-border rounded bg-muted/50">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Document title..."
              className="w-full bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Document content..."
              className="w-full bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              rows={5}
            />
            <div className="flex justify-end gap-1">
              <button onClick={() => setShowAdd(false)} className="text-[10px] font-mono text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={handleAdd} className="px-2 py-1 rounded border border-primary text-primary text-[10px] font-mono hover:bg-primary/10">Save</button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search documents..."
              className="w-full bg-input border border-border rounded pl-7 pr-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <button onClick={handleSearch} className="px-2 py-1 rounded border border-primary text-primary text-[10px] font-mono hover:bg-primary/10">Search</button>
          {results !== null && (
            <button onClick={() => { setResults(null); setSearch(""); }} className="p-1 rounded text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {results !== null && (
          <p className="text-[9px] font-mono text-terminal-cyan">{results.length} result{results.length !== 1 ? "s" : ""} found</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <p className="text-[10px] text-muted-foreground text-center py-4 font-mono animate-pulse">Loading...</p>
        ) : displayDocs.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <FileText className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-[10px] text-muted-foreground font-mono">
              {results !== null ? "No matches" : "No documents — upload or add text to build your knowledge base"}
            </p>
          </div>
        ) : (
          displayDocs.map((doc) => (
            <div key={doc.id} className="group px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/50">
              <div className="flex items-start gap-2">
                <FileText className="w-3.5 h-3.5 mt-0.5 text-terminal-cyan flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-mono text-foreground font-medium block truncate">{doc.title}</span>
                  <p className="text-[9px] text-muted-foreground font-mono line-clamp-2 mt-0.5">{doc.content.slice(0, 200)}</p>
                  <span className="text-[8px] text-muted-foreground/60 font-mono">{doc.content.length} chars · {new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
                <button
                  onClick={() => removeDocument(doc.id)}
                  className="p-1 rounded text-muted-foreground hover:text-terminal-red opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-2 border-t border-border">
        <p className="text-[8px] font-mono text-muted-foreground text-center">
          {documents.length} document{documents.length !== 1 ? "s" : ""} indexed · Full-text search enabled
        </p>
      </div>
    </div>
  );
};

export default RAGPanel;
