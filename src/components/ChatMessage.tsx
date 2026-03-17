import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { motion } from "framer-motion";
import { ChatMessage as ChatMessageType } from "@/lib/api";
import {
  Bot, User, Cpu, Image, FileText, Edit3, RefreshCw,
  Copy, Check, Hash, GitBranch, ThumbsUp, ThumbsDown, Volume2, Eye,
} from "lucide-react";
import { useState, useMemo, lazy, Suspense, memo, useEffect } from "react";
import { getBackendMode, submitFeedback, getBackendUrl, checkVisionStatus, analyzeImage } from "@/lib/api";
import CodeBlock from "./CodeBlock";
import BranchIndicator, { type BranchInfo } from "./BranchIndicator";
import ThinkingSteps, { type Step } from "./ThinkingSteps";
import { estimateTokens, formatTokenCount } from "@/lib/tokens";
import { getBranchesForMessage } from "@/lib/branches";

const MermaidDiagram = lazy(() => import("./MermaidDiagram"));

interface Props {
  message: ChatMessageType;
  onEdit?: (id: string, newContent: string) => void;
  onRegenerate?: (id: string) => void;
  onBranch?: (messageId: string) => void;
  onSelectBranch?: (conversationId: string) => void;
  onOpenInCanvas?: (lang: string, code: string) => void;
  steps?: Step[];
  isStreaming?: boolean;
}

/** Animated gradient bar shown while the model is thinking */
const StreamingBar = () => (
  <div className="flex items-center gap-2.5 py-0.5">
    <div
      className="h-0.5 rounded-full w-28"
      style={{
        background:
          "linear-gradient(90deg, hsl(142 70% 45% / 0.1), hsl(142 70% 45% / 1), hsl(185 60% 50% / 0.7), hsl(142 70% 45% / 0.1))",
        backgroundSize: "200% auto",
        animation: "shimmer 1.4s linear infinite",
      }}
    />
    <span className="text-[10px] text-muted-foreground font-mono tracking-wide">thinking…</span>
  </div>
);

const ChatMessage = ({
  message,
  onEdit,
  onRegenerate,
  onBranch,
  onSelectBranch,
  onOpenInCanvas,
  steps,
  isStreaming,
}: Props) => {
  const isUser    = message.role === "user";
  const [copied, setCopied]           = useState(false);
  const [editing, setEditing]         = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [feedback, setFeedback]       = useState<"up" | "down" | null>(null);
  const [speaking, setSpeaking]       = useState(false);
  const [visionAvailable, setVisionAvailable] = useState(false);
  const [analyzingImage, setAnalyzingImage]   = useState<string | null>(null);
  const [visionResults, setVisionResults]     = useState<Record<string, string>>({});

  useEffect(() => {
    if (getBackendMode() === "local") {
      checkVisionStatus()
        .then((s) => setVisionAvailable(s.available))
        .catch(() => setVisionAvailable(false));
    }
  }, []);

  const handleVisionAnalyze = async (previewUrl: string) => {
    if (analyzingImage === previewUrl) return;
    // Extract base64 from data URL
    const b64 = previewUrl.includes(",") ? previewUrl.split(",")[1] : previewUrl;
    setAnalyzingImage(previewUrl);
    try {
      const result = await analyzeImage(b64);
      setVisionResults((prev) => ({ ...prev, [previewUrl]: result.description }));
    } catch {
      setVisionResults((prev) => ({ ...prev, [previewUrl]: "Vision analysis failed." }));
    } finally {
      setAnalyzingImage(null);
    }
  };

  const handleSpeak = async () => {
    if (speaking) return;
    setSpeaking(true);
    try {
      await fetch(`${getBackendUrl()}/api/voice/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.content.slice(0, 2000) }),
      });
    } catch {
      // TTS not available — ignore silently
    } finally {
      setTimeout(() => setSpeaking(false), 1500);
    }
  };

  const tokenCount = useMemo(() => estimateTokens(message.content), [message.content]);
  const branches   = useMemo(() => getBranchesForMessage(message.id), [message.id]);
  const msgIsStreaming = message.status === "streaming";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSubmit = () => {
    if (editContent.trim() && onEdit) onEdit(message.id, editContent.trim());
    setEditing(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className={`group flex gap-3 px-4 py-3.5 ${isUser ? "flex-row-reverse" : ""}`}
      >
        {/* ── Avatar ── */}
        <div className="flex-shrink-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
              isUser
                ? "border-terminal-cyan/35 bg-terminal-cyan/8"
                : "border-primary/35 bg-primary/8"
            }`}
            style={
              msgIsStreaming && !isUser
                ? { animation: "pulse-glow 1.6s ease-in-out infinite", boxShadow: "0 0 0 2px hsl(142 70% 45% / 0.25)" }
                : {}
            }
          >
            {isUser
              ? <User className="w-4 h-4 text-terminal-cyan" />
              : <Bot className="w-4 h-4 text-primary" />
            }
          </div>
        </div>

        {/* ── Content ── */}
        <div className={`flex-1 min-w-0 flex flex-col ${isUser ? "items-end" : "items-start"}`}>

          {/* Agent badge */}
          {message.agent && (
            <div className={`flex items-center gap-1.5 mb-1.5 ${isUser ? "justify-end" : ""}`}>
              <Cpu className="w-3 h-3 text-terminal-amber" />
              <span className="text-[10px] uppercase tracking-widest text-terminal-amber font-mono">
                {message.agent}
              </span>
              {message.model && (
                <span className="text-[10px] text-muted-foreground font-mono">› {message.model}</span>
              )}
            </div>
          )}

          {/* File attachments */}
          {message.files && message.files.length > 0 && (
            <div className={`flex gap-2 mb-2 flex-wrap ${isUser ? "justify-end" : ""}`}>
              {message.files.map((file, i) => (
                <div key={i} className="rounded-md border border-border bg-muted/50 p-1.5 flex-shrink-0 hover:border-primary/40 transition-colors max-w-[120px]">
                  {file.type === "image" && file.preview ? (
                    <>
                      <div className="relative">
                        <img src={file.preview} alt={file.name} className="max-w-xs max-h-64 object-contain rounded border border-border" />
                        <div className="absolute top-1 left-1 flex items-center gap-0.5 bg-background/80 rounded px-1 py-0.5">
                          <Image className="w-2.5 h-2.5 text-terminal-magenta" />
                          <span className="text-[8px] text-terminal-magenta font-mono">IMG</span>
                        </div>
                      </div>
                      {visionAvailable && (
                        <button
                          onClick={() => handleVisionAnalyze(file.preview!)}
                          disabled={analyzingImage === file.preview}
                          className="text-[9px] font-mono text-terminal-cyan hover:text-cyan-300 flex items-center gap-1 mt-1 disabled:opacity-50 disabled:cursor-wait"
                        >
                          <Eye className="w-3 h-3" />
                          {analyzingImage === file.preview ? "Analyzing…" : "Analyze image"}
                        </button>
                      )}
                      {visionResults[file.preview] && (
                        <p className="text-[8px] font-mono text-muted-foreground mt-1 max-w-[200px] whitespace-pre-wrap">
                          {visionResults[file.preview]}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="w-24 h-16 flex flex-col items-center justify-center gap-1">
                      <FileText className="w-5 h-5 text-terminal-cyan" />
                      <span className="text-[8px] text-terminal-cyan font-mono">RAG</span>
                    </div>
                  )}
                  <p className="text-[8px] text-muted-foreground font-mono mt-1 truncate max-w-[96px]">
                    {file.name}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Bubble ── */}
          {editing ? (
            <div className="w-full max-w-[85%]">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-input border border-primary/50 rounded-md px-3 py-2.5 text-sm text-foreground font-mono resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 transition-all"
                rows={3}
                autoFocus
              />
              <div className="flex gap-3 mt-1.5">
                <button onClick={handleEditSubmit} className="text-[10px] font-mono text-primary hover:underline">Save & Resend</button>
                <button onClick={() => setEditing(false)} className="text-[10px] font-mono text-muted-foreground hover:underline">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {steps && steps.length > 0 && (
                <ThinkingSteps steps={steps} isStreaming={isStreaming ?? false} />
              )}
            <div
              className={`inline-block text-left rounded-xl px-4 py-3 text-sm leading-relaxed max-w-[85%] transition-all ${
                isUser
                  ? "bg-terminal-cyan/8 border border-terminal-cyan/22 text-foreground"
                  : "bg-card border border-border/50 text-foreground"
              }`}
              style={
                isUser
                  ? { boxShadow: "0 2px 10px hsl(185 60% 50% / 0.07)" }
                  : { boxShadow: "0 2px 10px hsl(0 0% 0% / 0.18)" }
              }
            >
              {msgIsStreaming && !message.content ? (
                <StreamingBar />
              ) : (
                <div className="prose prose-sm prose-invert max-w-none [&_code]:text-terminal-amber [&_code:not(pre_code)]:bg-muted [&_pre]:bg-transparent [&_pre]:border-none [&_pre]:p-0 [&_pre]:m-0">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const codeStr = String(children).replace(/\n$/, "");
                        if (match) {
                          if (match[1] === "mermaid") {
                            return (
                              <Suspense fallback={<div className="text-[10px] font-mono text-muted-foreground p-2">Loading diagram…</div>}>
                                <MermaidDiagram>{codeStr}</MermaidDiagram>
                              </Suspense>
                            );
                          }
                          return (
                            <CodeBlock
                              language={match[1]}
                              onOpenInCanvas={onOpenInCanvas}
                            >
                              {codeStr}
                            </CodeBlock>
                          );
                        }
                        return <code className={className} {...props}>{children}</code>;
                      },
                      table({ children }) {
                        return (
                          <div className="overflow-x-auto my-2 rounded-md border border-border">
                            <table className="w-full text-xs">{children}</table>
                          </div>
                        );
                      },
                      blockquote({ children }) {
                        return (
                          <blockquote className="border-l-2 border-primary/60 pl-3 my-2 text-muted-foreground italic bg-primary/5 py-2 pr-2 rounded-r">
                            {children}
                          </blockquote>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {msgIsStreaming && message.content && (
                    <span className="cursor-blink text-primary ml-0.5">▊</span>
                  )}
                </div>
              )}
            </div>
            </>
          )}

          {/* ── Hover action toolbar ── */}
          {!editing && !msgIsStreaming && (
            <div
              className={`flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 ${
                isUser ? "justify-end" : ""
              }`}
            >
              <button onClick={handleCopy} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-90" title="Copy">
                {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
              </button>

              {isUser && onEdit && (
                <button onClick={() => { setEditContent(message.content); setEditing(true); }} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-90" title="Edit">
                  <Edit3 className="w-3 h-3" />
                </button>
              )}

              {!isUser && onRegenerate && (
                <button onClick={() => onRegenerate(message.id)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-90" title="Regenerate">
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}

              {!isUser && getBackendMode() === "local" && message.id !== "welcome" && (
                <>
                  <button onClick={() => { setFeedback("up"); submitFeedback(message.id, 5); }}
                    className={`p-1.5 rounded transition-all active:scale-90 ${feedback === "up" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-muted/60"}`}
                    title="Good response">
                    <ThumbsUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => { setFeedback("down"); submitFeedback(message.id, 1); }}
                    className={`p-1.5 rounded transition-all active:scale-90 ${feedback === "down" ? "text-terminal-red bg-terminal-red/10" : "text-muted-foreground hover:text-terminal-red hover:bg-muted/60"}`}
                    title="Poor response">
                    <ThumbsDown className="w-3 h-3" />
                  </button>
                </>
              )}

              {!isUser && (
                <button
                  onClick={handleSpeak}
                  className={`p-1.5 rounded transition-all active:scale-90 ${
                    speaking
                      ? "text-terminal-cyan bg-terminal-cyan/10"
                      : "text-muted-foreground hover:text-terminal-cyan hover:bg-muted/60"
                  }`}
                  title="Read aloud"
                >
                  <Volume2 className={`w-3 h-3 ${speaking ? "animate-pulse" : ""}`} />
                </button>
              )}

              {onBranch && message.id !== "welcome" && (
                <button onClick={() => onBranch(message.id)} className="p-1.5 rounded text-muted-foreground hover:text-accent hover:bg-muted/60 transition-all active:scale-90" title="Branch from here">
                  <GitBranch className="w-3 h-3" />
                </button>
              )}

              <div className="w-px h-3 bg-border mx-1" />

              <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground font-mono" title={`~${tokenCount} tokens`}>
                <Hash className="w-2.5 h-2.5" />
                {formatTokenCount(tokenCount)}
              </span>
              <span className="text-[9px] text-muted-foreground font-mono ml-1.5">
                {message.timestamp.toLocaleTimeString("en-US", {
                  hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {branches.length > 0 && onSelectBranch && (
        <BranchIndicator branches={branches} onSelectBranch={onSelectBranch} />
      )}
    </>
  );
};

export default memo(
  ChatMessage,
  (prev, next) =>
    prev.message.id      === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.status  === next.message.status &&
    prev.steps           === next.steps,
);
