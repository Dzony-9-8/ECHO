import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, Trash2, Download, Sparkles, SpellCheck, ListTree, ArrowRightToLine,
  Wand2, Loader2, Check, X, Replace, CornerDownRight,
} from "lucide-react";
import { sendMessage, getBackendMode, type ChatMessage } from "@/lib/api";
import { getSelectedModel } from "@/components/ModelSelector";
import { toast } from "sonner";
import {
  type Doc, type AiAction, type StorageMode,
  loadDocs, upsertDoc, deleteDoc, sortDocs, wordCount, exportDoc, buildAiPrompt, newId,
  remoteListDocs, remoteUpsertDoc, remoteDeleteDoc,
} from "@/lib/documents";

const AI_ACTIONS: { id: AiAction; label: string; icon: typeof Sparkles }[] = [
  { id: "improve",   label: "Improve",   icon: Sparkles },
  { id: "grammar",   label: "Fix grammar", icon: SpellCheck },
  { id: "summarize", label: "Summarize", icon: ListTree },
  { id: "continue",  label: "Continue",  icon: ArrowRightToLine },
];

const DocumentsView = () => {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [aiRunning, setAiRunning] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<AiAction | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [showExport, setShowExport] = useState(false);

  // Where drafts actually live. null = still probing the backend.
  const [storage, setStorage] = useState<StorageMode | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiRunId = useRef(0);
  const mode = getBackendMode();

  // Server drafts survive a browser clear; fall back to local (and say so).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const remote = sortDocs(await remoteListDocs());
        if (!alive) return;
        setStorage("server");
        setDocs(remote);
        if (remote.length > 0) selectDoc(remote[0]);
      } catch {
        if (!alive) return;
        const local = sortDocs(loadDocs());
        setStorage("local");
        setDocs(local);
        if (local.length > 0) selectDoc(local[0]);
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectDoc = (d: Doc) => {
    setActiveId(d.id);
    setTitle(d.title);
    setContent(d.content);
    setAiResult(null);
    setAiAction(null);
  };

  const createDoc = async () => {
    const d: Doc = { id: newId(), title: "Untitled", content: "", updatedAt: Date.now() };
    if (storage === "server") {
      setDocs((prev) => sortDocs([d, ...prev]));
      try { await remoteUpsertDoc(d); }
      catch (e) { toast.error(`Couldn't save to server: ${e instanceof Error ? e.message : "error"}`); }
    } else {
      setDocs(sortDocs(upsertDoc(d)));
    }
    selectDoc(d);
  };

  const removeDoc = async (id: string) => {
    let remaining: Doc[];
    if (storage === "server") {
      remaining = sortDocs(docs.filter((d) => d.id !== id));
      setDocs(remaining);
      try { await remoteDeleteDoc(id); }
      catch (e) { toast.error(`Couldn't delete on server: ${e instanceof Error ? e.message : "error"}`); }
    } else {
      remaining = sortDocs(deleteDoc(id));
      setDocs(remaining);
    }
    if (activeId === id) {
      if (remaining.length > 0) selectDoc(remaining[0]);
      else { setActiveId(null); setTitle(""); setContent(""); }
    }
    toast.success("Document deleted");
  };

  // Debounced autosave whenever title/content change for the active doc.
  const persist = useCallback((nextTitle: string, nextContent: string) => {
    if (!activeId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const next: Doc = { id: activeId, title: nextTitle, content: nextContent, updatedAt: Date.now() };
      if (storage === "server") {
        setDocs((prev) => sortDocs(prev.map((d) => (d.id === activeId ? next : d))));
        try { await remoteUpsertDoc(next); }
        catch (e) { toast.error(`Autosave failed: ${e instanceof Error ? e.message : "server error"}`); }
      } else {
        setDocs(sortDocs(upsertDoc(next)));
      }
    }, 500);
  }, [activeId, storage]);

  const onTitle = (v: string) => { setTitle(v); persist(v, content); };
  const onContent = (v: string) => { setContent(v); persist(title, v); };

  // ── AI actions ─────────────────────────────────────────────────────────────
  const runAi = async (action: AiAction) => {
    if (!content.trim() && action !== "custom") { toast.error("Write something first"); return; }
    if (action === "custom" && !customInstruction.trim()) { toast.error("Enter an instruction"); return; }

    const runId = ++aiRunId.current;
    setAiRunning(true);
    setAiAction(action);
    setAiResult("");

    const prompt = buildAiPrompt(action, content, customInstruction);
    const msgs: ChatMessage[] = [{ id: "u1", role: "user", content: prompt, timestamp: new Date() }];
    try {
      await sendMessage(msgs, (t) => { if (aiRunId.current === runId) setAiResult(t); }, 1, getSelectedModel());
    } catch (e) {
      if (aiRunId.current === runId) toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      if (aiRunId.current === runId) setAiRunning(false);
    }
  };

  const applyReplace = () => {
    if (aiResult == null) return;
    onContent(aiResult.trim());
    setAiResult(null); setAiAction(null);
    toast.success("Document replaced");
  };
  const applyAppend = () => {
    if (aiResult == null) return;
    const joined = content.trim() ? `${content.trim()}\n\n${aiResult.trim()}` : aiResult.trim();
    onContent(joined);
    setAiResult(null); setAiAction(null);
    toast.success("Appended to document");
  };
  const dismissAi = () => { aiRunId.current += 1; setAiResult(null); setAiAction(null); setAiRunning(false); };

  const words = wordCount(content);
  const chars = content.length;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Library */}
      <div className="w-52 border-r border-border bg-sidebar/40 flex flex-col flex-shrink-0">
        <div className="p-2 border-b border-border">
          <button onClick={createDoc}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-terminal-cyan/50 bg-terminal-cyan/10 text-terminal-cyan text-[10px] font-mono hover:bg-terminal-cyan/20 transition-all">
            <Plus className="w-3.5 h-3.5" /> New document
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {docs.length === 0 && (
            <div className="text-center text-[10px] font-mono text-muted-foreground/50 py-6">No documents</div>
          )}
          {docs.map((d) => (
            <button key={d.id} onClick={() => selectDoc(d)}
              className={`w-full text-left px-2 py-1.5 rounded border transition-all group ${
                activeId === d.id ? "border-terminal-cyan/40 bg-terminal-cyan/5" : "border-transparent hover:bg-muted/30"}`}>
              <div className="flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
                <span className="flex-1 text-[10px] font-mono text-foreground truncate">{d.title || "Untitled"}</span>
                <span onClick={(e) => { e.stopPropagation(); removeDoc(d.id); }}
                  className="text-muted-foreground/0 group-hover:text-muted-foreground/50 hover:!text-terminal-red">
                  <Trash2 className="w-3 h-3" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center text-[11px] font-mono text-muted-foreground/50">
            Create a document to start writing.
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="border-b border-border bg-card p-2 flex items-center gap-2 flex-wrap">
              {AI_ACTIONS.map((a) => (
                <button key={a.id} onClick={() => runAi(a.id)} disabled={aiRunning}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-terminal-magenta/40 bg-terminal-magenta/10 text-terminal-magenta text-[10px] font-mono hover:bg-terminal-magenta/20 transition-all disabled:opacity-40">
                  <a.icon className="w-3 h-3" /> {a.label}
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input
                  aria-label="Custom AI instruction"
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") runAi("custom"); }}
                  placeholder="Custom instruction…"
                  className="w-40 bg-input border border-border rounded px-2 py-1.5 text-[10px] font-mono text-foreground focus:outline-none focus:border-terminal-magenta"
                />
                <button onClick={() => runAi("custom")} disabled={aiRunning} aria-label="Run custom instruction"
                  className="px-2 py-1.5 rounded border border-terminal-magenta/40 bg-terminal-magenta/10 text-terminal-magenta hover:bg-terminal-magenta/20 transition-all disabled:opacity-40">
                  <Wand2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1" />
              <div className="relative">
                <button onClick={() => setShowExport((s) => !s)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground transition-all">
                  <Download className="w-3 h-3" /> Export
                </button>
                <AnimatePresence>
                  {showExport && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="absolute right-0 mt-1 z-20 bg-card border border-border rounded shadow-xl overflow-hidden">
                      {(["md", "txt", "html"] as const).map((f) => (
                        <button key={f}
                          onClick={() => { const d = docs.find((x) => x.id === activeId); if (d) exportDoc({ ...d, title, content }, f); setShowExport(false); }}
                          className="block w-full text-left px-3 py-1.5 text-[10px] font-mono text-foreground hover:bg-muted/40">
                          .{f}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Title + body */}
            <input
              aria-label="Document title"
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              placeholder="Untitled"
              className="px-4 pt-3 pb-2 bg-transparent text-lg font-mono font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none border-b border-border/50"
            />
            <div className="flex-1 flex overflow-hidden">
              <textarea
                aria-label="Document content"
                value={content}
                onChange={(e) => onContent(e.target.value)}
                placeholder="Start writing…"
                className="flex-1 px-4 py-3 bg-transparent text-[13px] font-mono text-foreground/90 leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none resize-none"
              />

              {/* AI result panel */}
              <AnimatePresence>
                {(aiResult !== null || aiRunning) && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }} animate={{ width: 340, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                    className="border-l border-border bg-muted/10 flex flex-col overflow-hidden flex-shrink-0"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                      {aiRunning ? <Loader2 className="w-3.5 h-3.5 text-terminal-magenta animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-terminal-magenta" />}
                      <span className="text-[10px] font-mono uppercase tracking-wider text-terminal-magenta">
                        {aiAction === "custom" ? "AI edit" : aiAction}
                      </span>
                      <div className="flex-1" />
                      <button onClick={dismissAi} aria-label="Dismiss AI result" className="text-muted-foreground/50 hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                      <pre className="text-[11px] font-mono text-foreground/85 whitespace-pre-wrap break-words leading-relaxed">
                        {aiResult || (aiRunning ? "▍" : "")}
                      </pre>
                    </div>
                    {!aiRunning && aiResult && (
                      <div className="flex gap-1.5 p-2 border-t border-border">
                        <button onClick={applyReplace}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-primary/40 bg-primary/10 text-primary text-[9px] font-mono hover:bg-primary/20">
                          <Replace className="w-3 h-3" /> Replace
                        </button>
                        <button onClick={applyAppend}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-terminal-cyan/40 bg-terminal-cyan/10 text-terminal-cyan text-[9px] font-mono hover:bg-terminal-cyan/20">
                          <CornerDownRight className="w-3 h-3" /> Append
                        </button>
                        <button onClick={dismissAi}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-border text-[9px] font-mono text-muted-foreground hover:text-foreground">
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Status bar */}
            <div className="border-t border-border px-4 py-1.5 flex items-center gap-3 text-[9px] font-mono text-muted-foreground/50">
              <span>{words} words</span>
              <span>{chars} chars</span>
              <div className="flex-1" />
              {/* Say plainly where the draft actually lives. */}
              {storage === "server" ? (
                <span className="text-primary" title="Drafts are saved on the backend and survive a browser clear">
                  ● autosaved to server
                </span>
              ) : storage === "local" ? (
                <span className="text-terminal-amber" title="Backend unreachable — drafts are only in this browser">
                  ● backend offline · saved in this browser only
                </span>
              ) : (
                <span>checking storage…</span>
              )}
              <span>AI edits use the selected chat model{mode === "cloud" ? " (Cloud)" : " (Local)"}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentsView;
