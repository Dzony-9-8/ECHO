import { useState, useRef, useEffect } from "react";
import {
  Terminal, Code2, GitBranch, Play, Loader2, Copy, Check,
  ChevronRight, FolderOpen, Globe, Brain, Search, ExternalLink,
} from "lucide-react";
import { getBackendUrl } from "@/lib/api";
import { toast } from "sonner";

type Tab = "python" | "shell" | "git" | "memory" | "http" | "knowledge";

// ── Shared output box ─────────────────────────────────────────────────────────

const OutputBox = ({ output, error }: { output: string; error?: string }) => {
  const [copied, setCopied] = useState(false);
  const content = error ? `ERROR:\n${error}` : output;
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  if (!content) return null;
  return (
    <div className="relative group mt-2 rounded border border-border bg-muted/40 p-2.5 font-mono text-[11px] text-foreground max-h-64 overflow-y-auto">
      <button
        onClick={handleCopy}
        className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
      </button>
      <pre className="whitespace-pre-wrap break-words">
        {error ? <span className="text-terminal-red">{content}</span> : content}
      </pre>
    </div>
  );
};

// ── Python tab ────────────────────────────────────────────────────────────────

const PYTHON_EXAMPLES = [
  "print('Hello from ECHO!')",
  "import math\nprint(math.pi)",
  "[x**2 for x in range(10)]",
  "import datetime\nprint(datetime.datetime.now())",
];

const PythonTab = () => {
  const [code, setCode] = useState('print("Hello from ECHO!")');
  const [timeout, setTimeout_] = useState(10);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ stdout: string; stderr: string; error?: string } | null>(null);

  const run = async () => {
    setRunning(true); setResult(null);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/run-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, timeout }),
      });
      setResult(await resp.json());
    } catch (e: any) {
      setResult({ stdout: "", stderr: "", error: e.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Python Sandbox</span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-muted-foreground font-mono">Timeout:</span>
          <select value={timeout} onChange={(e) => setTimeout_(Number(e.target.value))}
            className="bg-input border border-border rounded px-1 py-0.5 text-[9px] font-mono text-foreground focus:outline-none">
            {[5, 10, 20, 30].map((t) => <option key={t} value={t}>{t}s</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {PYTHON_EXAMPLES.map((ex, i) => (
          <button key={i} onClick={() => setCode(ex)}
            className="px-1.5 py-0.5 rounded border border-border text-[8px] font-mono text-muted-foreground hover:text-terminal-cyan hover:border-terminal-cyan/40 transition-colors">
            {ex.split("\n")[0].slice(0, 24)}
          </button>
        ))}
      </div>
      <textarea value={code} onChange={(e) => setCode(e.target.value)} rows={8} spellCheck={false}
        className="w-full bg-input border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
        placeholder="Enter Python code..." />
      <button onClick={run} disabled={running || !code.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary bg-primary/10 text-primary text-xs font-mono hover:bg-primary/20 transition-colors disabled:opacity-40">
        {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        {running ? "Running..." : "Run Code"}
      </button>
      {result && (
        <OutputBox output={result.stdout + (result.stderr ? `\nSTDERR:\n${result.stderr}` : "")} error={result.error} />
      )}
    </div>
  );
};

// ── Shell tab ─────────────────────────────────────────────────────────────────

const SHELL_EXAMPLES = ["dir", "echo Hello World", "python --version", "git --version"];

const ShellTab = () => {
  const [command, setCommand] = useState("dir");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ stdout: string; stderr: string; returncode: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    if (!command.trim()) return;
    setRunning(true); setResult(null);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/tools/shell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      if (!resp.ok) { const err = await resp.json(); throw new Error(err.detail || "Failed"); }
      setResult(await resp.json());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Whitelisted shell commands only</span>
      <div className="flex gap-1.5 flex-wrap">
        {SHELL_EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => { setCommand(ex); inputRef.current?.focus(); }}
            className="px-1.5 py-0.5 rounded border border-border text-[8px] font-mono text-muted-foreground hover:text-terminal-cyan hover:border-terminal-cyan/40 transition-colors">
            {ex}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-1.5 bg-input border border-border rounded px-2 py-1.5 focus-within:border-primary transition-colors">
          <ChevronRight className="w-3 h-3 text-primary flex-shrink-0" />
          <input ref={inputRef} value={command} onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="Enter command..." />
        </div>
        <button onClick={run} disabled={running || !command.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-primary bg-primary/10 text-primary text-xs font-mono hover:bg-primary/20 transition-colors disabled:opacity-40">
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>
      {result && (
        <OutputBox
          output={[result.stdout, result.stderr ? `[stderr]\n${result.stderr}` : "", `[exit ${result.returncode}]`].filter(Boolean).join("\n")}
          error={result.returncode !== 0 && !result.stdout ? result.stderr : undefined}
        />
      )}
    </div>
  );
};

// ── Git tab ───────────────────────────────────────────────────────────────────

const GIT_EXAMPLES = [
  { cmd: "log --oneline -10", label: "Recent commits" },
  { cmd: "status", label: "Working tree status" },
  { cmd: "branch -a", label: "All branches" },
  { cmd: "diff HEAD~1 HEAD --stat", label: "Last commit diff" },
];

const GitTab = () => {
  const [repoPath, setRepoPath] = useState(".");
  const [gitCmd, setGitCmd] = useState("log --oneline -10");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ stdout: string; stderr: string; returncode: number } | null>(null);

  const run = async () => {
    setRunning(true); setResult(null);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/tools/git`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_path: repoPath, command: gitCmd }),
      });
      if (!resp.ok) { const err = await resp.json(); throw new Error(err.detail || "Failed"); }
      setResult(await resp.json());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Read-only git operations</span>
      <div className="flex items-center gap-1.5 bg-input border border-border rounded px-2 py-1.5 focus-within:border-terminal-cyan transition-colors">
        <FolderOpen className="w-3 h-3 text-terminal-cyan flex-shrink-0" />
        <input value={repoPath} onChange={(e) => setRepoPath(e.target.value)}
          placeholder="Repo path (e.g. . or D:/my-project)"
          className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none" />
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {GIT_EXAMPLES.map((ex) => (
          <button key={ex.cmd} onClick={() => setGitCmd(ex.cmd)} title={ex.label}
            className="px-1.5 py-0.5 rounded border border-border text-[8px] font-mono text-muted-foreground hover:text-terminal-cyan hover:border-terminal-cyan/40 transition-colors">
            git {ex.cmd.split(" ")[0]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-1.5 bg-input border border-border rounded px-2 py-1.5 focus-within:border-terminal-cyan transition-colors">
          <GitBranch className="w-3 h-3 text-terminal-cyan flex-shrink-0" />
          <input value={gitCmd} onChange={(e) => setGitCmd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
            className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="git subcommand..." />
        </div>
        <button onClick={run} disabled={running || !gitCmd.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-terminal-cyan bg-terminal-cyan/10 text-terminal-cyan text-xs font-mono hover:bg-terminal-cyan/20 transition-colors disabled:opacity-40">
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>
      {result && (
        <OutputBox output={result.stdout} error={result.returncode !== 0 ? result.stderr || "Non-zero exit" : undefined} />
      )}
    </div>
  );
};

// ── Memory Query tab ──────────────────────────────────────────────────────────

const MemoryTab = () => {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"recall" | "reflect">("recall");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string>("");

  const run = async () => {
    if (!query.trim()) return;
    setRunning(true); setResult("");
    try {
      if (mode === "recall") {
        const resp = await fetch(`${getBackendUrl()}/api/memory/recall`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, bank_id: "all" }),
        });
        const data = await resp.json();
        const memories: any[] = data.memories || data.results || [];
        if (memories.length === 0) {
          setResult("No memories found for this query.");
        } else {
          setResult(memories.map((m: any, i: number) =>
            `[${i + 1}] ${m.content || m.text || JSON.stringify(m)}`
          ).join("\n\n"));
        }
      } else {
        const resp = await fetch(`${getBackendUrl()}/api/memory/reflect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, type: "all" }),
        });
        const data = await resp.json();
        setResult(data.analysis || data.reflection || JSON.stringify(data, null, 2));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Query long-term memory</span>
        <div className="flex gap-1">
          {(["recall", "reflect"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors capitalize ${
                mode === m ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground hover:text-foreground"
              }`}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[9px] font-mono text-muted-foreground">
        {mode === "recall" ? "Recall finds memories semantically similar to your query." : "Reflect synthesizes patterns across all stored memories."}
      </p>
      <div className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={mode === "recall" ? "What do you remember about..." : "Find patterns in..."}
          className="flex-1 bg-input border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors" />
        <button onClick={run} disabled={running || !query.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-accent bg-accent/10 text-accent text-xs font-mono hover:bg-accent/20 transition-colors disabled:opacity-40">
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
        </button>
      </div>
      {result && <OutputBox output={result} />}
    </div>
  );
};

// ── HTTP Fetcher tab ──────────────────────────────────────────────────────────

const HttpTab = () => {
  const [url, setUrl] = useState("https://");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ text: string; chars: number; truncated: boolean; url: string } | null>(null);

  const run = async () => {
    if (!url.trim() || url === "https://") return;
    setRunning(true); setResult(null);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/tools/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!resp.ok) { const err = await resp.json(); throw new Error(err.detail || "Fetch failed"); }
      setResult(await resp.json());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  const insertToChat = () => {
    if (!result) return;
    sessionStorage.setItem("echo_pending_prompt", `[URL Content: ${result.url}]\n\n${result.text}`);
    toast.success("Inserted — open Chat to continue");
  };

  return (
    <div className="space-y-2">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Fetch & extract any URL</span>
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-1.5 bg-input border border-border rounded px-2 py-1.5 focus-within:border-terminal-amber transition-colors">
          <Globe className="w-3 h-3 text-terminal-amber flex-shrink-0" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
            className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="https://example.com/article" />
        </div>
        <button onClick={run} disabled={running || !url.trim() || url === "https://"}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-terminal-amber bg-terminal-amber/10 text-terminal-amber text-xs font-mono hover:bg-terminal-amber/20 transition-colors disabled:opacity-40">
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
        </button>
      </div>
      {result && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-muted-foreground">
              {result.chars.toLocaleString()} chars{result.truncated ? " (truncated to 8k)" : ""}
            </span>
            <button onClick={insertToChat}
              className="flex items-center gap-1 px-2 py-0.5 rounded border border-primary text-primary text-[9px] font-mono hover:bg-primary/10 transition-colors">
              <ExternalLink className="w-2.5 h-2.5" /> Insert to Chat
            </button>
          </div>
          <OutputBox output={result.text} />
        </div>
      )}
    </div>
  );
};

// ── Knowledge Search tab ──────────────────────────────────────────────────────

const KnowledgeTab = () => {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(5);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const run = async () => {
    if (!query.trim()) return;
    setRunning(true); setResults([]);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit }),
      });
      if (!resp.ok) throw new Error("Search failed");
      const data = await resp.json();
      setResults(data.results || data.matches || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Hybrid RAG search</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-muted-foreground">Limit:</span>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-input border border-border rounded px-1 py-0.5 text-[9px] font-mono text-foreground focus:outline-none">
            {[3, 5, 8, 12].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-1.5 bg-input border border-border rounded px-2 py-1.5 focus-within:border-terminal-magenta transition-colors">
          <Search className="w-3 h-3 text-terminal-magenta flex-shrink-0" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
            className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="Search your knowledge base..." />
        </div>
        <button onClick={run} disabled={running || !query.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-terminal-magenta bg-terminal-magenta/10 text-terminal-magenta text-xs font-mono hover:bg-terminal-magenta/20 transition-colors disabled:opacity-40">
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        </button>
      </div>
      {results.length === 0 && !running && query && (
        <p className="text-[9px] font-mono text-muted-foreground">No results. Add documents to backend/knowledge/ to build your knowledge base.</p>
      )}
      <div className="space-y-1.5">
        {results.map((r: any, i: number) => (
          <div key={i} className="p-2 rounded border border-border bg-card text-[10px] font-mono space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-terminal-magenta font-medium">{r.source || r.filename || `Result ${i + 1}`}</span>
              {r.score !== undefined && (
                <span className="text-[8px] text-muted-foreground">{(r.score * 100).toFixed(0)}%</span>
              )}
            </div>
            <p className="text-foreground/80 leading-relaxed line-clamp-3">{r.text || r.content || JSON.stringify(r)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main panel ────────────────────────────────────────────────────────────────

const ToolsPanel = () => {
  const [tab, setTab] = useState<Tab>("python");
  const [discoveredTools, setDiscoveredTools] = useState<number>(0);

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/tools/discover`)
      .then((r) => r.json())
      .then((d) => setDiscoveredTools(d.tools?.length ?? 0))
      .catch(() => {});
  }, []);

  const tabs: { id: Tab; label: string; icon: typeof Code2; color: string }[] = [
    { id: "python",    label: "Python",    icon: Code2,     color: "text-terminal-cyan"    },
    { id: "shell",     label: "Shell",     icon: Terminal,  color: "text-primary"          },
    { id: "git",       label: "Git",       icon: GitBranch, color: "text-terminal-amber"   },
    { id: "memory",    label: "Memory",    icon: Brain,     color: "text-accent"           },
    { id: "http",      label: "Fetch",     icon: Globe,     color: "text-terminal-amber"   },
    { id: "knowledge", label: "Knowledge", icon: Search,    color: "text-terminal-magenta" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Terminal className="w-4 h-4 text-primary glow-green" />
        <h2 className="text-sm font-mono text-primary uppercase tracking-wider">Tool Execution</h2>
        {discoveredTools > 0 && (
          <span className="text-[9px] font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded ml-auto">
            {discoveredTools} tools available
          </span>
        )}
      </div>

      {/* Tabs — scrollable on narrow widths */}
      <div className="flex border-b border-border px-1 gap-0 overflow-x-auto flex-shrink-0">
        {tabs.map(({ id, label, icon: Icon, color }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-mono uppercase tracking-wider border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
              tab === id ? `border-current ${color}` : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "python"    && <PythonTab />}
        {tab === "shell"     && <ShellTab />}
        {tab === "git"       && <GitTab />}
        {tab === "memory"    && <MemoryTab />}
        {tab === "http"      && <HttpTab />}
        {tab === "knowledge" && <KnowledgeTab />}
      </div>
    </div>
  );
};

export default ToolsPanel;
