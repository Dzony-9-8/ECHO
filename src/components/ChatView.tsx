import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import SystemPanel from "@/components/SystemPanel";
import { type ChatMessage as ChatMessageType, sendMessage, getBackendMode } from "@/lib/api";
import { type FileAttachment } from "@/lib/files";
import { useConversations } from "@/hooks/useConversations";
import ConversationList from "@/components/ConversationList";

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

  // Load messages when switching conversations
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

  const handleSend = async (content: string, attachments?: FileAttachment[], depth?: number) => {
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
      model: mode === "cloud" ? "Gemini 3 Flash" : "LLaMA 3.1",
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    // Ensure we have a conversation
    let convId = activeConversationId;
    if (!convId) {
      convId = await createConversation(content.slice(0, 80) || "New Conversation");
    }

    // Save user message
    if (convId) {
      saveMessage(convId, { role: "user", content: userMsg.content });
    }

    try {
      const allMessages = [...messages, userMsg];
      const response = await sendMessage(
        allMessages,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: chunk } : m
            )
          );
        },
        depth ?? 1
      );

      const finalContent = response || assistantMsg.content;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: finalContent, status: "complete" }
            : m
        )
      );

      // Save assistant message
      if (convId) {
        saveMessage(convId, {
          role: "assistant",
          content: finalContent,
          agent: assistantMsg.agent,
          model: assistantMsg.model,
        });
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content:
                  "⚠ **Connection failed.** Backend is offline.\n\nStart your FastAPI server at `http://localhost:8000` to enable AI responses.",
                status: "error",
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
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
        <div className="w-56 border-r border-border bg-sidebar flex-shrink-0">
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
        <div className="border-b border-border bg-card px-4 py-2 flex items-center gap-2 z-20">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest font-mono mr-2"
          >
            {showHistory ? "◀ History" : "▶ History"}
          </button>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-display mr-2">
            Filter Swarm:
          </span>
          {Object.keys(agentColors).map((agent) => (
            <button
              key={agent}
              onClick={() => toggleAgent(agent)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all ${
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

        {/* Scanline overlay */}
        <div className="absolute inset-0 scanline z-10 pointer-events-none" />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto relative z-0">
          <div className="max-w-4xl mx-auto py-4">
            {filteredMessages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="relative z-20">
          <ChatInput onSend={handleSend} disabled={isStreaming} />
        </div>
      </div>

      {showPanel && <SystemPanel />}
    </div>
  );
};

export default ChatView;
