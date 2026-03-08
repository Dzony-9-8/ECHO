import ReactMarkdown from "react-markdown";
import { ChatMessage as ChatMessageType } from "@/lib/api";
import { Bot, User, Cpu, Image, FileText } from "lucide-react";

interface Props {
  message: ChatMessageType;
}

const ChatMessage = ({ message }: Props) => {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 px-4 py-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
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
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? "text-right" : ""}`}>
        {/* Agent/Model badge */}
        {message.agent && (
          <div className="flex items-center gap-1.5 mb-1">
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
            <div className="prose prose-sm prose-invert max-w-none [&_code]:text-terminal-amber [&_code]:bg-muted [&_pre]:bg-background [&_pre]:border [&_pre]:border-border">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        <div className="text-[10px] text-muted-foreground mt-1 font-mono">
          {message.timestamp.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
