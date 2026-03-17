import { useState, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Terminal, Play, X, ExternalLink, Layers } from "lucide-react";

// Languages that can be rendered live in an iframe
const PREVIEWABLE_LANGS = new Set(["html", "css", "javascript", "js", "jsx", "tsx", "typescript", "ts"]);

/** Build an srcdoc string for the iframe */
function buildSrcDoc(lang: string, code: string): string {
  const l = lang.toLowerCase();
  if (l === "html") return code;
  if (l === "css") {
    return `<!DOCTYPE html><html><head><style>
body{background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;margin:16px}
${code}
</style></head><body><p class="preview-note" style="font-size:11px;color:#666;margin-bottom:12px">CSS preview — add HTML elements to see styles</p></body></html>`;
  }
  // JS / TS / JSX / TSX
  return `<!DOCTYPE html><html><head>
<style>body{background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;margin:16px;font-size:13px}
#output{white-space:pre-wrap;background:#161b22;padding:12px;border-radius:6px;border:1px solid #30363d;min-height:40px}
.err{color:#f85149}.ts-note{font-size:10px;color:#484f58;margin-bottom:8px}</style>
</head><body>
<div class="ts-note">▸ console output</div>
<div id="output"></div>
<script>
const _out=document.getElementById('output');
const _log=console.log.bind(console);
console.log=(...a)=>{_log(...a);_out.textContent+=(a.map(x=>typeof x==='object'?JSON.stringify(x,null,2):String(x)).join(' ')+'\\n')};
console.error=(...a)=>{_log(...a);const s=document.createElement('span');s.className='err';s.textContent=(a.join(' ')+'\\n');_out.appendChild(s)};
try{${code.replace(/<\/script>/gi, "<\\/script>")}}catch(e){console.error('Error: '+e.message)}
</script></body></html>`;
}

interface Props {
  language?: string;
  children: string;
  onOpenInCanvas?: (lang: string, code: string) => void;
}

// Color-code language badges
const LANG_COLORS: Record<string, string> = {
  python:     "text-terminal-amber  border-terminal-amber/30  bg-terminal-amber/10",
  javascript: "text-terminal-amber  border-terminal-amber/30  bg-terminal-amber/10",
  typescript: "text-terminal-cyan   border-terminal-cyan/30   bg-terminal-cyan/10",
  tsx:        "text-terminal-cyan   border-terminal-cyan/30   bg-terminal-cyan/10",
  jsx:        "text-terminal-amber  border-terminal-amber/30  bg-terminal-amber/10",
  bash:       "text-primary         border-primary/30         bg-primary/10",
  sh:         "text-primary         border-primary/30         bg-primary/10",
  shell:      "text-primary         border-primary/30         bg-primary/10",
  css:        "text-terminal-magenta border-terminal-magenta/30 bg-terminal-magenta/10",
  html:       "text-terminal-red    border-terminal-red/30    bg-terminal-red/10",
  json:       "text-terminal-cyan   border-terminal-cyan/30   bg-terminal-cyan/10",
  sql:        "text-terminal-amber  border-terminal-amber/30  bg-terminal-amber/10",
  rust:       "text-terminal-amber  border-terminal-amber/30  bg-terminal-amber/10",
  go:         "text-terminal-cyan   border-terminal-cyan/30   bg-terminal-cyan/10",
  text:       "text-muted-foreground border-border             bg-muted/30",
  code:       "text-muted-foreground border-border             bg-muted/30",
};

const getLangClass = (lang: string) =>
  LANG_COLORS[lang.toLowerCase()] ?? "text-primary border-primary/30 bg-primary/10";

const CodeBlock = ({ language, children, onOpenInCanvas }: Props) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const lang = (language || "code").toLowerCase();
  const lineCount = children.split("\n").length;
  const canPreview = PREVIEWABLE_LANGS.has(lang);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const srcDoc = useCallback(() => buildSrcDoc(lang, children), [lang, children]);

  return (
    <div
      className="relative group rounded-md overflow-hidden border border-border my-3"
      style={{ boxShadow: "0 2px 12px hsl(142 70% 45% / 0.06)" }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3 text-muted-foreground" />
          <span
            className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${getLangClass(lang)}`}
          >
            {lang}
          </span>
          {lineCount > 1 && (
            <span className="text-[9px] font-mono text-muted-foreground opacity-60">
              {lineCount} lines
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {canPreview && (
            <button
              onClick={() => setShowPreview((p) => !p)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono transition-all active:scale-95 ${
                showPreview
                  ? "text-primary bg-primary/10 border border-primary/30"
                  : "text-muted-foreground hover:text-primary hover:bg-muted"
              }`}
              title={showPreview ? "Hide preview" : "Live preview"}
            >
              {showPreview ? (
                <><X className="w-3 h-3" /><span>Close</span></>
              ) : (
                <><Play className="w-3 h-3" /><span className="hidden group-hover:inline">Preview</span></>
              )}
            </button>
          )}
          {canPreview && onOpenInCanvas && (
            <button
              onClick={() => onOpenInCanvas(lang, children)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono transition-all active:scale-95 text-muted-foreground hover:text-terminal-cyan hover:bg-muted"
              title="Open in Artifacts Canvas"
            >
              <Layers className="w-3 h-3" />
              <span className="hidden group-hover:inline">Canvas</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono transition-all text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-primary" />
                <span className="text-primary">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="hidden group-hover:inline">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code content */}
      <SyntaxHighlighter
        language={lang === "code" ? "text" : lang}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "14px 16px",
          fontSize: "12px",
          lineHeight: 1.65,
          background: "hsl(220 20% 4%)",
          border: "none",
          borderRadius: 0,
        }}
        wrapLongLines
        showLineNumbers={lineCount > 4}
        lineNumberStyle={{
          fontSize: "10px",
          color: "hsl(142 40% 18%)",
          paddingRight: "12px",
          userSelect: "none",
          minWidth: "2.5em",
        }}
      >
        {children}
      </SyntaxHighlighter>

      {/* Live preview panel */}
      {showPreview && canPreview && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-3 py-1 bg-primary/5 border-b border-primary/20">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-primary">Live Preview</span>
            </div>
            <a
              href={`data:text/html;charset=utf-8,${encodeURIComponent(srcDoc())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open</span>
            </a>
          </div>
          <iframe
            srcDoc={srcDoc()}
            sandbox="allow-scripts"
            className="w-full border-0"
            style={{ height: "260px", background: "#0d1117" }}
            title="Code preview"
          />
        </div>
      )}
    </div>
  );
};

export default CodeBlock;
