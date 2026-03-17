import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Layers, ChevronLeft, ChevronRight, Maximize2, Minimize2,
  Copy, Check, ExternalLink, RefreshCw, X, Terminal,
} from "lucide-react";
import { type ChatMessage } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Artifact {
  id: string;
  lang: string;
  code: string;
  title: string;
  timestamp: Date;
  messageId: string;
}

interface ArtifactsPanelProps {
  messages: ChatMessage[];
  isOpen: boolean;
  onClose: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PREVIEWABLE_LANGS = new Set([
  "html", "css", "javascript", "js", "jsx", "tsx", "svg",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Simple hash to deduplicate identical code blocks */
function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

/** Derive a human-readable title from the code */
function deriveTitle(code: string, lang: string): string {
  // Look for a comment on the first 3 lines
  const lines = code.split("\n").slice(0, 3);
  for (const line of lines) {
    const m =
      line.match(/^\/\/\s*(.+)/) ||
      line.match(/^#\s*(.+)/) ||
      line.match(/^<!--\s*(.+?)\s*-->/) ||
      line.match(/^\/\*\*?\s*(.+?)\s*\*?\//);
    if (m) {
      const title = m[1].trim().replace(/\*\/$/, "").trim();
      if (title.length > 2 && title.length < 80) return title;
    }
  }
  // Fallback: lang + short snippet
  return `${lang.toUpperCase()} snippet`;
}

/** Build srcdoc for iframe */
function buildSrcDoc(lang: string, code: string): string {
  const l = lang.toLowerCase();

  if (l === "svg") {
    return `<!DOCTYPE html><html><head><style>
body{margin:0;background:#0d1117;display:flex;align-items:center;justify-content:center;min-height:100vh}
svg{max-width:100%;max-height:100vh}
</style></head><body>${code}</body></html>`;
  }

  if (l === "html") {
    // Inject console capture script before </body>
    const consoleCapture = `
<script>
(function(){
  var _log=console.log.bind(console),_warn=console.warn.bind(console),_err=console.error.bind(console);
  function send(level,args){
    var msg=args.map(function(x){return typeof x==='object'?JSON.stringify(x,null,2):String(x);}).join(' ');
    window.parent.postMessage({type:'console',level:level,msg:msg},'*');
  }
  console.log=function(){_log.apply(console,arguments);send('log',Array.from(arguments));};
  console.warn=function(){_warn.apply(console,arguments);send('warn',Array.from(arguments));};
  console.error=function(){_err.apply(console,arguments);send('error',Array.from(arguments));};
  window.addEventListener('error',function(e){send('error',[e.message||String(e)]);});
})();
<\/script>`;
    return code.replace(/<\/body>/i, consoleCapture + "</body>");
  }

  if (l === "css") {
    return `<!DOCTYPE html><html><head>
<style>
body{background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;margin:16px}
</style>
<style>${code}</style>
</head><body>
<p style="font-size:11px;color:#666;margin-bottom:12px">CSS preview — add HTML elements to see styles</p>
<script>
(function(){
  var _log=console.log.bind(console);
  console.log=function(){_log.apply(console,arguments);window.parent.postMessage({type:'console',level:'log',msg:Array.from(arguments).map(String).join(' ')},'*');};
  window.addEventListener('error',function(e){window.parent.postMessage({type:'console',level:'error',msg:e.message},'*');});
})();
<\/script>
</body></html>`;
  }

  // JS / TS / JSX / TSX
  return `<!DOCTYPE html><html><head>
<style>
body{background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;margin:16px;font-size:13px}
#output{white-space:pre-wrap;background:#161b22;padding:12px;border-radius:6px;border:1px solid #30363d;min-height:40px}
.err{color:#f85149}.warn{color:#e3b341}.ts-note{font-size:10px;color:#484f58;margin-bottom:8px}
</style>
</head><body>
<div class="ts-note">▸ console output</div>
<div id="output"></div>
<script>
var _out=document.getElementById('output');
function _append(text,cls){
  var s=document.createElement('span');
  if(cls)s.className=cls;
  s.textContent=text+'\n';
  _out.appendChild(s);
}
var _log=console.log.bind(console),_warn=console.warn.bind(console),_err=console.error.bind(console);
console.log=function(){var msg=Array.from(arguments).map(function(x){return typeof x==='object'?JSON.stringify(x,null,2):String(x);}).join(' ');_log.apply(console,arguments);_append(msg,'');window.parent.postMessage({type:'console',level:'log',msg:msg},'*');};
console.warn=function(){var msg=Array.from(arguments).join(' ');_warn.apply(console,arguments);_append(msg,'warn');window.parent.postMessage({type:'console',level:'warn',msg:msg},'*');};
console.error=function(){var msg=Array.from(arguments).join(' ');_err.apply(console,arguments);_append(msg,'err');window.parent.postMessage({type:'console',level:'error',msg:msg},'*');};
window.addEventListener('error',function(e){console.error('Error: '+e.message);});
try{${code.replace(/<\/script>/gi, "<\\/script>")}}catch(e){console.error('Error: '+e.message);}
<\/script>
</body></html>`;
}

/** Extract artifacts from messages */
function extractArtifacts(messages: ChatMessage[]): Artifact[] {
  const seen = new Set<string>();
  const artifacts: Artifact[] = [];

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    // Match fenced code blocks: ```lang\n...\n```
    const pattern = /```(\w+)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(msg.content)) !== null) {
      const lang = match[1].toLowerCase();
      const code = match[2].trimEnd();
      if (!PREVIEWABLE_LANGS.has(lang)) continue;
      if (!code.trim()) continue;

      const hash = simpleHash(code);
      if (seen.has(hash)) continue;
      seen.add(hash);

      artifacts.push({
        id: `${msg.id}-${hash}`,
        lang,
        code,
        title: deriveTitle(code, lang),
        timestamp: msg.timestamp,
        messageId: msg.id,
      });
    }
  }

  return artifacts;
}

// ─── Console log type ────────────────────────────────────────────────────────

interface ConsoleEntry {
  level: "log" | "warn" | "error";
  msg: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const ArtifactsPanel = ({ messages, isOpen, onClose }: ArtifactsPanelProps) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "console">("preview");
  const [copied, setCopied] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [iframeKey, setIframeKey] = useState(0); // force re-render
  const [newArtifact, setNewArtifact] = useState(false);
  const prevArtifactCount = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const artifacts = useMemo(() => extractArtifacts(messages), [messages]);

  // Clamp selectedIdx when artifacts list changes
  useEffect(() => {
    if (artifacts.length === 0) return;
    // If new artifacts arrived, jump to latest and pulse
    if (artifacts.length > prevArtifactCount.current) {
      setSelectedIdx(artifacts.length - 1);
      setConsoleLogs([]);
      setIframeKey((k) => k + 1);
      setNewArtifact(true);
      const t = setTimeout(() => setNewArtifact(false), 2500);
      prevArtifactCount.current = artifacts.length;
      return () => clearTimeout(t);
    }
    prevArtifactCount.current = artifacts.length;
  }, [artifacts.length]);

  // Keep selectedIdx in bounds
  useEffect(() => {
    if (artifacts.length > 0 && selectedIdx >= artifacts.length) {
      setSelectedIdx(artifacts.length - 1);
    }
  }, [artifacts.length, selectedIdx]);

  // Reset console logs and iframe when switching artifacts
  const goTo = useCallback((idx: number) => {
    setSelectedIdx(idx);
    setConsoleLogs([]);
    setIframeKey((k) => k + 1);
  }, []);

  const goPrev = () => goTo(Math.max(0, selectedIdx - 1));
  const goNext = () => goTo(Math.min(artifacts.length - 1, selectedIdx + 1));

  // Listen for console messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "console") {
        setConsoleLogs((prev) => [
          ...prev,
          { level: e.data.level, msg: e.data.msg },
        ]);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const current = artifacts[selectedIdx] ?? null;

  const handleCopy = () => {
    if (!current) return;
    navigator.clipboard.writeText(current.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInTab = () => {
    if (!current) return;
    const html = buildSrcDoc(current.lang, current.code);
    const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleRefresh = () => {
    setConsoleLogs([]);
    setIframeKey((k) => k + 1);
  };

  if (!isOpen) return null;

  const panelClass = isFullscreen
    ? "fixed inset-0 z-50 flex flex-col bg-background border-l border-border"
    : "w-[380px] flex-shrink-0 flex flex-col bg-background border-l border-border";

  const levelColor = (level: ConsoleEntry["level"]) => {
    if (level === "error") return "text-red-400";
    if (level === "warn") return "text-terminal-amber";
    return "text-foreground/80";
  };

  return (
    <div className={panelClass}>
      {/* ── Header ── */}
      <div className="bg-card border-b border-border px-3 py-2 flex items-center gap-2 flex-shrink-0">
        <Layers className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary flex-1">
          Artifacts
        </span>

        {/* New artifact pulse dot */}
        {newArtifact && (
          <span
            className="w-2 h-2 rounded-full bg-primary flex-shrink-0"
            style={{ animation: "pulse-glow 1s ease-in-out 3" }}
            title="New artifact"
          />
        )}

        {/* Navigation */}
        {artifacts.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={goPrev}
              disabled={selectedIdx === 0}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-25 transition-colors"
              title="Previous artifact"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-muted-foreground w-10 text-center">
              {artifacts.length > 0 ? `${selectedIdx + 1}/${artifacts.length}` : "0/0"}
            </span>
            <button
              onClick={goNext}
              disabled={selectedIdx >= artifacts.length - 1}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-25 transition-colors"
              title="Next artifact"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Fullscreen */}
        <button
          onClick={() => setIsFullscreen((v) => !v)}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Close canvas"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Title ── */}
      {current && (
        <div className="px-3 py-1.5 border-b border-border bg-muted/20 flex-shrink-0">
          <p className="text-[11px] font-mono text-foreground/70 truncate" title={current.title}>
            {current.title}
          </p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center border-b border-border bg-card flex-shrink-0">
        {(["preview", "code", "console"] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-[10px] font-mono uppercase tracking-wider transition-all border-b-2 ${
                isActive
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
              style={
                isActive
                  ? { textShadow: "0 0 8px hsl(142 70% 45%)" }
                  : {}
              }
            >
              {tab}
              {tab === "console" && consoleLogs.length > 0 && (
                <span className="ml-1 text-[8px] text-terminal-amber">
                  ({consoleLogs.length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-hidden relative">
        {!current ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <Layers className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider">
              No artifacts yet
            </p>
            <p className="text-[10px] text-muted-foreground/40 font-mono leading-relaxed">
              Ask ECHO to write HTML, CSS, JavaScript, or SVG code and it will appear here for live preview.
            </p>
          </div>
        ) : (
          <>
            {/* PREVIEW tab */}
            {activeTab === "preview" && (
              <iframe
                key={iframeKey}
                ref={iframeRef}
                srcDoc={buildSrcDoc(current.lang, current.code)}
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-full border-0"
                style={{ background: "#0d1117" }}
                title={`Preview: ${current.title}`}
              />
            )}

            {/* CODE tab */}
            {activeTab === "code" && (
              <div className="h-full overflow-auto">
                <SyntaxHighlighter
                  language={current.lang === "code" ? "text" : current.lang}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    padding: "14px 16px",
                    fontSize: "11px",
                    lineHeight: 1.65,
                    background: "hsl(220 20% 4%)",
                    border: "none",
                    borderRadius: 0,
                    height: "100%",
                  }}
                  wrapLongLines
                  showLineNumbers
                  lineNumberStyle={{
                    fontSize: "9px",
                    color: "hsl(142 40% 18%)",
                    paddingRight: "12px",
                    userSelect: "none",
                    minWidth: "2.5em",
                  }}
                >
                  {current.code}
                </SyntaxHighlighter>
              </div>
            )}

            {/* CONSOLE tab */}
            {activeTab === "console" && (
              <div className="h-full overflow-auto bg-[#0d1117] p-3 font-mono text-[11px]">
                {consoleLogs.length === 0 ? (
                  <div className="flex items-center gap-2 text-muted-foreground/50">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>No console output yet — switch to Preview to run the code.</span>
                  </div>
                ) : (
                  consoleLogs.map((entry, i) => (
                    <div key={i} className={`flex gap-2 py-0.5 border-b border-border/20 ${levelColor(entry.level)}`}>
                      <span className="text-muted-foreground/40 flex-shrink-0 select-none">
                        {entry.level === "error" ? "✖" : entry.level === "warn" ? "⚠" : "›"}
                      </span>
                      <span className="break-all whitespace-pre-wrap">{entry.msg}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      {current && (
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 bg-muted/40 border-t border-border">
          {/* Meta */}
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground overflow-hidden">
            <span className="text-terminal-amber">{current.lang}</span>
            <span className="text-border">·</span>
            <span>{current.code.split("\n").length} lines</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              title="Copy code"
            >
              {copied ? (
                <><Check className="w-3 h-3 text-primary" /><span className="text-primary">Copied!</span></>
              ) : (
                <><Copy className="w-3 h-3" /><span>Copy</span></>
              )}
            </button>
            <button
              onClick={handleOpenInTab}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              title="Open in new tab"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open</span>
            </button>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              title="Refresh preview"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtifactsPanel;
export { extractArtifacts };
export type { ArtifactsPanelProps };
