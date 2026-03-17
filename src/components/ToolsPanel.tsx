import { useState, useRef } from "react";
import { Terminal, Code2, GitBranch, Play, Loader2, Copy, Check, ChevronRight, FolderOpen } from "lucide-react";
import { getBackendUrl } from "@/lib/api";
import { toast } from "sonner";

type Tab = "python" | "shell" | "git";

const PYTHON_EXAMPLES = [
  "print('Hello from ECHO!')",
  "import math\nprint(math.pi)",
  "[x**2 for x in range(10)]",
  "import datetime\nprint(datetime.datetime.now())",
];

const SHELL_EXAMPLES = [
  "dir",
  "echo Hello World",
  "python --version",
  "git --version",
];

const GIT_EXAMPLES = [
  { cmd: "log --oneline -10", label: "Recent commits" },
  { cmd: "status", label: "Working tree status" },
  { cmd: "branch -a", label: "All branches" },
  { cmd: "diff HEAD~1 HEAD --stat", label: "Last commit diff" },
];

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
        {error ? (
          <span className="text-terminal-red">{content}</span>
        ) : (
          content
        )}
      </pre>
    </div>
  );
};

const PythonTab = () => {
  const [code, setCode] = useState('print("Hello from ECHO!")');
  const [timeout, setTimeout_] = useState(10);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ stdout: string; stderr: string; error?: string } | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/run-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, timeout: timeout }),
      });
      const data = await resp.json();
      setResult(data);
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
          <select
            value={timeout}
            onChange={(e) => setTimeout_(Number(e.target.value))}
            className="bg-input border border-border rounded px-1 py-0.5 text-[9px] font-mono text-foreground focus:outline-none"
          >
            {[5, 10, 20, 30].map((t) => <option key={t} value={t}>{t}s</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {PYTHON_EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => setCode(ex)}
            className="px-1.5 py-0.5 rounded border border-border text-[8px] font-mono text-muted-foreground hover:text-terminal-cyan hover:border-terminal-cyan/40 transition-colors"
          >
            {ex.split("\n")[0].slice(0, 24)}
          </button>
        ))}
      </div>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={8}
        className="w-full bg-input border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
        placeholder="Enter Python code..."
        spellCheck={false}
      />

      <button
        onClick={run}
        disabled={running || !code.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary bg-primary/10 text-primary text-xs font-mono hover:bg-primary/20 transition-colors disabled:opacity-40"
      >
        {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        {running ? "Running..." : "Run Code"}
      </button>

      {result && (
        <OutputBox
          output={result.stdout + (result.stderr ? `\nSTDERR:\n${result.stderr}` : "")}
          error={result.error}
        />
      )}
    </div>
  );
};

const ShellTab = () => {
  const [command, setCommand] = useState("dir");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ stdout: string; stderr: string; returncode: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    if (!command.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/tools/shell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || "Failed");
      }
      const data = await resp.json();
      setResult(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">
        Whitelisted shell commands only
      </span>

      <div className="flex gap-1.5 flex-wrap">
        {SHELL_EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => { setCommand(ex); inputRef.current?.focus(); }}
            className="px-1.5 py-0.5 rounded border border-border text-[8px] font-mono text-muted-foreground hover:text-terminal-cyan hover:border-terminal-cyan/40 transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-1.5 bg-input border border-border rounded px-2 py-1.5 focus-within:border-primary transition-colors">
          <ChevronRight className="w-3 h-3 text-primary flex-shrink-0" />
          <input
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="Enter command..."
          />
        </div>
        <button
          onClick={run}
          disabled={running || !command.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-primary bg-primary/10 text-primary text-xs font-mono hover:bg-primary/20 transition-colors disabled:opacity-40"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>

      {result && (
        <OutputBox
          output={[
            result.stdout,
            result.stderr ? `[stderr]\n${result.stderr}` : "",
            `[exit ${result.returncode}]`,
          ].filter(Boolean).join("\n")}
          error={result.returncode !== 0 && !result.stdout ? result.stderr : undefined}
        />
      )}
    </div>
  );
};

const GitTab = () => {
  const [repoPath, setRepoPath] = useState(".");
  const [gitCmd, setGitCmd] = useState("log --oneline -10");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ stdout: string; stderr: string; returncode: number } | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/tools/git`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_path: repoPath, command: gitCmd }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || "Failed");
      }
      const data = await resp.json();
      setResult(data);
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
        <input
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          placeholder="Repo path (e.g. . or D:/my-project)"
          className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {GIT_EXAMPLES.map((ex) => (
          <button
            key={ex.cmd}
            onClick={() => setGitCmd(ex.cmd)}
            className="px-1.5 py-0.5 rounded border border-border text-[8px] font-mono text-muted-foreground hover:text-terminal-cyan hover:border-terminal-cyan/40 transition-colors"
            title={ex.label}
          >
            git {ex.cmd.split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-1.5 bg-input border border-border rounded px-2 py-1.5 focus-within:border-terminal-cyan transition-colors">
          <GitBranch className="w-3 h-3 text-terminal-cyan flex-shrink-0" />
          <input
            value={gitCmd}
            onChange={(e) => setGitCmd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="git subcommand..."
          />
        </div>
        <button
          onClick={run}
          disabled={running || !gitCmd.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-terminal-cyan bg-terminal-cyan/10 text-terminal-cyan text-xs font-mono hover:bg-terminal-cyan/20 transition-colors disabled:opacity-40"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>

      {result && (
        <OutputBox
          output={result.stdout}
          error={result.returncode !== 0 ? result.stderr || "Non-zero exit" : undefined}
        />
      )}
    </div>
  );
};

const ToolsPanel = () => {
  const [tab, setTab] = useState<Tab>("python");

  const tabs: { id: Tab; label: string; icon: typeof Code2; color: string }[] = [
    { id: "python", label: "Python", icon: Code2, color: "text-terminal-cyan" },
    { id: "shell",  label: "Shell",  icon: Terminal, color: "text-primary" },
    { id: "git",    label: "Git",    icon: GitBranch, color: "text-terminal-amber" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Terminal className="w-4 h-4 text-primary glow-green" />
        <h2 className="text-sm font-mono text-primary uppercase tracking-wider">Tool Execution</h2>
        <span className="ml-auto text-[9px] font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded">Sandbox</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-3 gap-0">
        {tabs.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono uppercase tracking-wider border-b-2 transition-all ${
              tab === id
                ? `border-current ${color}`
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "python" && <PythonTab />}
        {tab === "shell"  && <ShellTab />}
        {tab === "git"    && <GitTab />}
      </div>
    </div>
  );
};

export default ToolsPanel;
