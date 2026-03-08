import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { ChatMessage as ChatMessageType } from "@/lib/api";
import { Bot, User, Cpu, Image, FileText, RotateCcw, Pencil, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useCallback } from "react";

interface Props {
  message: ChatMessageType;
  onEdit?: (id: string, newContent: string) => void;
  onRegenerate?: (id: string) => void;
}

const ChatMessage = ({ message, onEdit, onRegenerate }: Props) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  const handleSaveEdit = () => {
    if (editContent.trim() && onEdit) {
      onEdit(message.id, editContent.trim());
    }
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`group flex gap-3 px-4 py-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, duration: 0.2 }}
        className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center border ${
          isUser
            ? "border-terminal-cyan bg-terminal-cyan/10"
            : "border-primary bg-primary/10"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-terminal-cyan" />
        ) : (
          <Bot className="w-4 h-4 text-primary" />
        )}
      </motion.div>

      {/* Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? "text-right" : ""}`}>
        {/* Agent/Model badge */}
        {message.agent && (
          <div className={`flex items-center gap-1.5 mb-1 ${isUser ? "justify-end" : ""}`}>
            <Cpu className="w-3 h-3 text-terminal-amber" />
            <span className="text-[10px] uppercase tracking-widest text-terminal-amber">
              {message.agent}
            </span>
            {message.model && (
              <span className="text-[10px] text-muted-foreground">
                → {message.model}
              </span>
            )}
          </div>
        )}

        {/* File attachments */}
        {message.files && message.files.length > 0 && (
          <div className={`flex gap-2 mb-2 flex-wrap ${isUser ? "justify-end" : ""}`}>
            {message.files.map((file, i) => (
              <div
                key={i}
                className="rounded border border-border bg-muted/50 p-1.5 flex-shrink-0"
              >
                {file.type === "image" && file.preview ? (
                  <div className="relative">
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-24 h-24 object-cover rounded"
                    />
                    <div className="absolute top-1 left-1 flex items-center gap-0.5 bg-background/80 rounded px-1 py-0.5">
                      <Image className="w-2.5 h-2.5 text-terminal-magenta" />
                      <span className="text-[8px] text-terminal-magenta font-mono">
                        Vision
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-24 h-16 flex flex-col items-center justify-center gap-1">
                    <FileText className="w-5 h-5 text-terminal-cyan" />
                    <span className="text-[8px] text-terminal-cyan font-mono">
                      RAG
                    </span>
                  </div>
                )}
                <p className="text-[8px] text-muted-foreground font-mono mt-1 truncate max-w-[96px]">
                  {file.name}
                </p>
              </div>
            ))}
          </div>
        )}

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-input border border-primary rounded px-3 py-2 text-sm text-foreground font-mono resize-none focus:outline-none focus:glow-border min-h-[80px]"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded">
                Cancel
              </button>
              <button onClick={handleSaveEdit} className="px-2 py-1 text-[10px] font-mono text-primary border border-primary bg-primary/10 rounded hover:bg-primary/20">
                Save & Resend
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`inline-block text-left rounded px-3 py-2 text-sm leading-relaxed ${
              isUser
                ? "bg-terminal-cyan/10 border border-terminal-cyan/30 text-terminal-cyan"
                : "bg-muted border border-border text-foreground"
            }`}
          >
            {message.status === "streaming" && !message.content ? (
              <span className="cursor-blink text-primary">▊</span>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none [&_code]:text-terminal-amber [&_code]:bg-muted [&_pre]:bg-background [&_pre]:border [&_pre]:border-border [&_pre]:rounded [&_pre_code]:text-foreground [&_pre_code]:bg-transparent">
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {message.status !== "streaming" && !editing && (
          <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? "justify-end" : ""}`}>
            <button onClick={handleCopy} className="p-1 rounded hover:bg-muted transition-colors" title="Copy">
              {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>
            {isUser && onEdit && (
              <button onClick={() => { setEditContent(message.content); setEditing(true); }} className="p-1 rounded hover:bg-muted transition-colors" title="Edit">
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
            {!isUser && onRegenerate && (
              <button onClick={() => onRegenerate(message.id)} className="p-1 rounded hover:bg-muted transition-colors" title="Regenerate">
                <RotateCcw className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
            <span className="text-[10px] text-muted-foreground font-mono ml-1">
              {message.timestamp.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChatMessage;
