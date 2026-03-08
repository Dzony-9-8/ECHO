import { useState, useRef, useEffect } from "react";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import SystemPanel from "@/components/SystemPanel";
import { type ChatMessage as ChatMessageType, sendMessage } from "@/lib/api";
import { type FileAttachment } from "@/lib/files";

const ChatView = () => {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "**ECHO System initialized.**\n\nMulti-model orchestration ready. Agents standing by.\n\n```\nSupervisor .. LLaMA 3.1\nResearcher .. DeepSeek R1\nDeveloper ... DeepSeek Coder V2\nCritic ...... DeepSeek R1\n```\n\nHow can ECHO help you today?",
      timestamp: new Date(),
      agent: "System",
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [activeAgents, setActiveAgents] = useState<Set<string>>(
    new Set(["Supervisor", "Developer", "Researcher", "Critic"])
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSend = async (content: string, attachments?: FileAttachment[]) => {
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

    const assistantMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      status: "streaming",
      agent: "Supervisor",
      model: "LLaMA 3.1",
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      const allMessages = [...messages, userMsg];
      const response = await sendMessage(allMessages, (chunk) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: chunk } : m
          )
        );
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: response || m.content, status: "complete" }
            : m
        )
      );
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
      <div className="flex-1 flex flex-col relative">
        {/* Agent filter bar */}
        <div className="border-b border-border bg-card px-4 py-2 flex items-center gap-2 z-20">
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
