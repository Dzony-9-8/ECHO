import { useState, useRef, useEffect } from "react";
import TopBar from "@/components/TopBar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import SystemPanel from "@/components/SystemPanel";
import { type ChatMessage as ChatMessageType, sendMessage } from "@/lib/api";

const Index = () => {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "**ECHO System initialized.**\n\nMulti-model orchestration ready. Agents standing by.\n\n```\nPlanner .... LLaMA 3.1\nResearch ... DeepSeek R1\nCoding ..... DeepSeek Coder V2\nVision ..... LLaVA 1.6\nVoice ...... Whisper / XTTS\n```\n\nHow can I assist you?",
      timestamp: new Date(),
      agent: "System",
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (content: string) => {
    const userMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
      status: "complete",
    };

    const assistantMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      status: "streaming",
      agent: "Planner",
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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col relative">
          {/* Scanline overlay */}
          <div className="absolute inset-0 scanline z-10" />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto relative z-0">
            <div className="max-w-4xl mx-auto py-4">
              {messages.map((msg) => (
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

        {/* System Panel */}
        <SystemPanel />
      </div>
    </div>
  );
};

export default Index;
