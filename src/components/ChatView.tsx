import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import SystemPanel from "@/components/SystemPanel";
import { type ChatMessage as ChatMessageType, sendMessage, getBackendMode } from "@/lib/api";
import { type FileAttachment } from "@/lib/files";
import { useConversations } from "@/hooks/useConversations";
import ConversationList from "@/components/ConversationList";
import { AVAILABLE_MODELS } from "@/components/ModelSelector";
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
  const [selectedModel, setSelectedModel] = useState("google/gemini-3-flash-preview");
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

  const getModelLabel = () => {
    const model = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
    return model?.label || "Gemini 3 Flash";
  };

  const doSend = async (content: string, attachments?: FileAttachment[], depth?: number, editFromId?: string) => {
    const filesMeta = attachments?.map((f) => ({
      name: f.name,
      type: f.type,
      preview: f.preview,
    }));

    // If editing, truncate messages up to the edited message
    let baseMessages = messages;
    if (editFromId) {
      const idx = messages.findIndex((m) => m.id === editFromId);
      if (idx !== -1) baseMessages = messages.slice(0, idx);
    }

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
      model: mode === "cloud" ? getModelLabel() : "LLaMA 3.1",
    };

    const newMessages = [...baseMessages, userMsg, assistantMsg];
    setMessages(newMessages);
    setIsStreaming(true);

    let convId = activeConversationId;
    if (!convId) {
      convId = await createConversation(content.slice(0, 80) || "New Conversation");
    }

    if (convId) {
      saveMessage(convId, { role: "user", content: userMsg.content });
    }

    try {
      const allMessages = [...baseMessages, userMsg];
      const response = await sendMessage(
        allMessages,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: chunk } : m
            )
          );
        },
        depth ?? 1,
        selectedModel
      );

      const finalContent = response || assistantMsg.content;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: finalContent, status: "complete" }
            : m
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
      const errorMsg = err?.message || "Connection failed";
      
      if (errorMsg.includes("Rate limit") || errorMsg.includes("429")) {
        toast.error("Rate limit exceeded. Please wait a moment before trying again.");
      } else if (errorMsg.includes("credits") || errorMsg.includes("402")) {
        toast.error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: `⚠ **Error:** ${errorMsg}`, status: "error" }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSend = async (content: string, attachments?: FileAttachment[], depth?: number) => {
    await doSend(content, attachments, depth);
  };

  const handleEdit = async (msgId: string, newContent: string) => {
    await doSend(newContent, undefined, 1, msgId);
  };

  const handleRegenerate = async (msgId: string) => {
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx <= 0) return;
    // Find the user message before this assistant message
    const userMsg = messages.slice(0, idx).reverse().find((m) => m.role === "user");
    if (!userMsg) return;
    await doSend(userMsg.content, undefined, 1, userMsg.id);
  };

  const handleExport = async (convId: string, format: "json" | "md") => {
    const msgs = await loadMessages(convId);
    const conv = conversations.find((c) => c.id === convId);
    const title = conv?.title || "conversation";

    let content: string;
    let mimeType: string;
    let ext: string;

    if (format === "json") {
      content = JSON.stringify(msgs.map((m) => ({ role: m.role, content: m.content, timestamp: m.timestamp, agent: m.agent, model: m.model })), null, 2);
      mimeType = "application/json";
      ext = "json";
    } else {
      content = `# ${title}\n\n` + msgs.map((m) => `## ${m.role === "user" ? "User" : m.agent || "Assistant"}\n\n${m.content}\n`).join("\n---\n\n");
      mimeType = "text/markdown";
      ext = "md";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_").slice(0, 50)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${ext.toUpperCase()}`);
  };

  const agentColors: Record<string, string> = {
    Supervisor: "border-terminal-amber text-terminal-amber",
    Developer: "border-terminal-cyan text-terminal-cyan",
    Researcher: "border-primary text-primary",
    Critic: "border-terminal-red text-terminal-red",
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {showHistory && (
        <div className="w-56 border-r border-border bg-sidebar flex-shrink-0 hidden md:block">
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            onDelete={deleteConversation}
            onExport={handleExport}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col relative">
        {/* Agent filter bar */}
        <div className="border-b border-border bg-card px-4 py-2 flex items-center gap-2 z-20">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest font-mono mr-2"
          >
            {showHistory ? "◀ History" : "▶ History"}
          </button>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-display mr-2 hidden sm:inline">
            Filter:
          </span>
          {Object.keys(agentColors).map((agent) => (
            <button
              key={agent}
              onClick={() => toggleAgent(agent)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all hidden sm:block ${
                activeAgents.has(agent)
                  ? agentColors[agent] + " bg-current/10"
                  : "border-muted text-muted-foreground opacity-40"
              }`}
            >
              {agent}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest font-mono"
          >
            {showPanel ? "Hide Panel" : "Show Panel"}
          </button>
        </div>

        <div className="absolute inset-0 scanline z-10 pointer-events-none" />

        <div className="flex-1 overflow-y-auto relative z-0">
          <div className="max-w-4xl mx-auto py-4">
            {filteredMessages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onEdit={msg.role === "user" ? handleEdit : undefined}
                onRegenerate={msg.role === "assistant" && msg.id !== "welcome" ? handleRegenerate : undefined}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="relative z-20">
          <ChatInput
            onSend={handleSend}
            disabled={isStreaming}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        </div>
      </div>

      {showPanel && <div className="hidden lg:block"><SystemPanel /></div>}
    </div>
  );
};

export default ChatView;
