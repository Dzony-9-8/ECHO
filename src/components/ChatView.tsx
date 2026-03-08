import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import SystemPanel from "@/components/SystemPanel";
import { type ChatMessage as ChatMessageType, sendMessage, getBackendMode } from "@/lib/api";
import { type FileAttachment } from "@/lib/files";
import { useConversations } from "@/hooks/useConversations";
import ConversationList from "@/components/ConversationList";
import { Download } from "lucide-react";
import { toast } from "sonner";

const WELCOME_MSG: ChatMessageType = {
  id: "welcome",
  role: "assistant",
  content:
    "**ECHO System initialized.**\n\nMulti-model orchestration ready. Agents standing by.\n\n```\nSupervisor .. LLaMA 3.1\nResearcher .. DeepSeek R1\nDeveloper ... DeepSeek Coder V2\nCritic ...... DeepSeek R1\n```\n\nHow can ECHO help you today?",
  timestamp: new Date(),
  agent: "System",
};

const ChatView = () => {
  const [messages, setMessages] = useState<ChatMessageType[]>([WELCOME_MSG]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  const [activeAgents, setActiveAgents] = useState<Set<string>>(
    new Set(["Supervisor", "Developer", "Researcher", "Critic"])
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    createConversation,
    deleteConversation,
    loadMessages,
    saveMessage,
  } = useConversations();

  const handleSelectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    const msgs = await loadMessages(id);
    setMessages(msgs.length > 0 ? msgs : [WELCOME_MSG]);
  }, [loadMessages, setActiveConversationId]);

  const handleNewConversation = useCallback(async () => {
    setActiveConversationId(null);
    setMessages([WELCOME_MSG]);
  }, [setActiveConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleAgent = (agent: string) => {
    setActiveAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agent)) next.delete(agent);
      else next.add(agent);
      return next;
    });
  };

  const filteredMessages = messages.filter(
    (m) => !m.agent || m.agent === "System" || activeAgents.has(m.agent)
  );

  // Export conversation
  const handleExport = (format: "md" | "json") => {
    const exportMessages = messages.filter((m) => m.id !== "welcome");
    if (exportMessages.length === 0) {
      toast.info("No messages to export");
      return;
    }

    let content: string;
    let filename: string;
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      content = JSON.stringify(
        exportMessages.map((m) => ({
          role: m.role,
          content: m.content,
          agent: m.agent,
          model: m.model,
          timestamp: m.timestamp.toISOString(),
        })),
        null,
        2
      );
      filename = `echo-chat-${timestamp}.json`;
    } else {
      content = exportMessages
        .map((m) => {
          const role = m.role === "user" ? "**You**" : `**${m.agent || "Assistant"}**`;
          return `### ${role}\n_${m.timestamp.toLocaleString()}_\n\n${m.content}`;
        })
        .join("\n\n---\n\n");
      content = `# ECHO Chat Export — ${timestamp}\n\n${content}`;
      filename = `echo-chat-${timestamp}.md`;
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${filename}`);
  };

  // Edit message & resend from that point
  const handleEditMessage = async (id: string, newContent: string) => {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const edited = { ...messages[idx], content: newContent };
    const trimmed = [...messages.slice(0, idx), edited];
    setMessages(trimmed);
    // Re-send from this point
    await doSend(newContent, trimmed.slice(0, -1), undefined, undefined);
  };

  // Regenerate last assistant message
  const handleRegenerate = async (id: string) => {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1) return;
    // Find the preceding user message
    const userMsgs = messages.slice(0, idx);
    const lastUserMsg = [...userMsgs].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    // Remove the assistant message being regenerated
    const trimmed = messages.slice(0, idx);
    setMessages(trimmed);
    await doSend(lastUserMsg.content, trimmed.slice(0, -1), undefined, undefined);
  };

  const doSend = async (
    content: string,
    prevMessages: ChatMessageType[],
    attachments?: FileAttachment[],
    depth?: number,
    model?: string
  ) => {
    const filesMeta = attachments?.map((f) => ({
      name: f.name,
      type: f.type,
      preview: f.preview,
    }));

    const userMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      content: content || (attachments ? `[Attached ${attachments.length} file(s)]` : ""),
      timestamp: new Date(),
      status: "complete",
      files: filesMeta,
    };

    const mode = getBackendMode();
    const assistantMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      status: "streaming",
      agent: mode === "cloud" ? "ECHO Cloud" : "Supervisor",
      model: mode === "cloud" ? (model?.split("/").pop() || "Gemini 3 Flash") : "LLaMA 3.1",
    };

    const allBefore = [...prevMessages, userMsg];
    setMessages([...allBefore, assistantMsg]);
    setIsStreaming(true);

    let convId = activeConversationId;
    if (!convId) {
      convId = await createConversation(content.slice(0, 80) || "New Conversation");
    }
    if (convId) {
      saveMessage(convId, { role: "user", content: userMsg.content });
    }

    try {
      const response = await sendMessage(
        allBefore,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: chunk } : m))
          );
        },
        depth ?? 1,
        model
      );

      const finalContent = response || assistantMsg.content;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: finalContent, status: "complete" } : m
        )
      );

      if (convId) {
        saveMessage(convId, {
          role: "assistant",
          content: finalContent,
          agent: assistantMsg.agent,
          model: assistantMsg.model,
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || "Connection failed";

      // Handle rate limits and payment errors
      if (errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit")) {
        toast.error("Rate limit exceeded — please wait a moment and try again.");
      } else if (errMsg.includes("402") || errMsg.toLowerCase().includes("credit")) {
        toast.error("AI credits exhausted — add credits in workspace settings.");
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: `⚠ **${errMsg}**\n\nCheck your connection and try again.`,
                status: "error",
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSend = async (content: string, attachments?: FileAttachment[], depth?: number, model?: string) => {
    await doSend(content, messages, attachments, depth, model);
  };

  const agentColors: Record<string, string> = {
    Supervisor: "border-terminal-amber text-terminal-amber",
    Developer: "border-terminal-cyan text-terminal-cyan",
    Researcher: "border-primary text-primary",
    Critic: "border-terminal-red text-terminal-red",
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Conversation history sidebar */}
      {showHistory && (
        <div className="w-56 border-r border-border bg-sidebar flex-shrink-0 hidden md:block">
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            onDelete={deleteConversation}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col relative">
        {/* Agent filter bar */}
        <div className="border-b border-border bg-card px-4 py-2 flex items-center gap-2 z-20 overflow-x-auto">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest font-mono mr-2 flex-shrink-0"
          >
            {showHistory ? "◀ History" : "▶ History"}
          </button>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-display mr-2 flex-shrink-0 hidden sm:inline">
            Filter:
          </span>
          {Object.keys(agentColors).map((agent) => (
            <button
              key={agent}
              onClick={() => toggleAgent(agent)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all flex-shrink-0 ${
                activeAgents.has(agent)
                  ? agentColors[agent] + " bg-current/10"
                  : "border-muted text-muted-foreground opacity-40"
              }`}
            >
              {agent}
            </button>
          ))}
          <div className="flex-1" />
          {/* Export */}
          <div className="relative group flex-shrink-0">
            <button className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest font-mono flex items-center gap-1">
              <Download className="w-3 h-3" />
              Export
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-card border border-border rounded shadow-lg z-50 py-1 w-32">
              <button onClick={() => handleExport("md")} className="w-full px-3 py-1.5 text-left text-[10px] font-mono hover:bg-muted/50 text-foreground">
                Markdown (.md)
              </button>
              <button onClick={() => handleExport("json")} className="w-full px-3 py-1.5 text-left text-[10px] font-mono hover:bg-muted/50 text-foreground">
                JSON (.json)
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest font-mono flex-shrink-0"
          >
            {showPanel ? "Hide Panel" : "Show Panel"}
          </button>
        </div>

        {/* Scanline overlay */}
        <div className="absolute inset-0 scanline z-10 pointer-events-none" />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto relative z-0">
          <div className="max-w-4xl mx-auto py-4">
            {filteredMessages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onEdit={msg.id !== "welcome" ? handleEditMessage : undefined}
                onRegenerate={msg.id !== "welcome" ? handleRegenerate : undefined}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="relative z-20">
          <ChatInput onSend={handleSend} disabled={isStreaming} />
        </div>
      </div>

      {showPanel && <div className="hidden lg:block"><SystemPanel /></div>}
    </div>
  );
};

export default ChatView;
