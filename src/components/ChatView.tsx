import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import SystemPanel from "@/components/SystemPanel";
import StreamingIndicator from "@/components/StreamingIndicator";
import { type ChatMessage as ChatMessageType, sendMessage, getBackendMode } from "@/lib/api";
import { type FileAttachment } from "@/lib/files";
import { useConversations } from "@/hooks/useConversations";
import { useUsageAnalytics } from "@/hooks/useUsageAnalytics";
import ConversationList from "@/components/ConversationList";
import ChatSettingsModal from "@/components/ChatSettingsModal";
import ExportDialog from "@/components/ExportDialog";
import ShareDialog from "@/components/ShareDialog";
import { Menu, X, MessageSquareText, Settings, Download, ArrowLeft, GitBranch, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { estimateTokens, formatTokenCount } from "@/lib/tokens";
import { saveBranch, getParentBranch } from "@/lib/branches";
import { getConversationSystemPrompt, setConversationSystemPrompt } from "@/lib/conversationSystemPrompts";
import { buildSkillsPrompt } from "@/lib/agentSkills";

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
  const [streamStartTime, setStreamStartTime] = useState(0);
  const [showPanel, setShowPanel] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    localStorage.getItem("echo_system_prompt") || ""
  );
  const [activeConvSystemPrompt, setActiveConvSystemPrompt] = useState("");
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
    pinnedIds,
    togglePin,
    searchMessages,
  } = useConversations();

  const { logUsage } = useUsageAnalytics();
  const totalTokens = useMemo(
    () => messages.filter(m => m.id !== "welcome").reduce((sum, m) => sum + estimateTokens(m.content), 0),
    [messages]
  );

  // Check if current conversation is a branch
  const parentBranch = useMemo(
    () => activeConversationId ? getParentBranch(activeConversationId) : undefined,
    [activeConversationId]
  );

  // Load per-conversation system prompt when switching
  useEffect(() => {
    if (activeConversationId) {
      setActiveConvSystemPrompt(getConversationSystemPrompt(activeConversationId));
    } else {
      setActiveConvSystemPrompt("");
    }
  }, [activeConversationId]);

  const handleConvSystemPromptChange = useCallback((prompt: string) => {
    setActiveConvSystemPrompt(prompt);
    if (activeConversationId) {
      setConversationSystemPrompt(activeConversationId, prompt);
    }
  }, [activeConversationId]);

  const handleSelectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    const msgs = await loadMessages(id);
    setMessages(msgs.length > 0 ? msgs : [WELCOME_MSG]);
    setShowMobileHistory(false);
  }, [loadMessages, setActiveConversationId]);

  const handleNewConversation = useCallback(async () => {
    setActiveConversationId(null);
    setMessages([WELCOME_MSG]);
    setShowMobileHistory(false);
  }, [setActiveConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check for pending prompt from prompt library
  useEffect(() => {
    const pending = sessionStorage.getItem("echo_pending_prompt");
    if (pending) {
      sessionStorage.removeItem("echo_pending_prompt");
      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Enter command"]');
      if (textarea) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        nativeInputValueSetter?.call(textarea, pending);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
      }
    }
  });

  // Save system prompt
  useEffect(() => {
    localStorage.setItem("echo_system_prompt", systemPrompt);
  }, [systemPrompt]);

  const toggleAgent = (agent: string) => {
    setActiveAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agent)) next.delete(agent);
      else next.add(agent);
      return next;
    });
  };

  const filteredMessages = messages.filter(
    (m) => !m.agent || m.agent === "System" || m.agent === "ECHO Cloud" || activeAgents.has(m.agent)
  );

  // Edit message & resend
  const handleEditMessage = async (id: string, newContent: string) => {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const edited = { ...messages[idx], content: newContent };
    const trimmed = [...messages.slice(0, idx), edited];
    setMessages(trimmed);
    await doSend(newContent, trimmed.slice(0, -1), undefined, undefined);
  };

  // Regenerate
  const handleRegenerate = async (id: string) => {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const userMsgs = messages.slice(0, idx);
    const lastUserMsg = [...userMsgs].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    const trimmed = messages.slice(0, idx);
    setMessages(trimmed);
    await doSend(lastUserMsg.content, trimmed.slice(0, -1), undefined, undefined);
  };

  // Branch from a message
  const handleBranch = async (messageId: string) => {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    const branchMessages = messages.slice(0, idx + 1);
    const branchTitle = `Branch: ${branchMessages[branchMessages.length - 1].content.slice(0, 40)}...`;

    const newConvId = await createConversation(branchTitle);
    if (!newConvId) return;

    saveBranch({
      conversationId: newConvId,
      parentConversationId: activeConversationId || "",
      branchMessageId: messageId,
      title: branchTitle,
      createdAt: new Date().toISOString(),
    });

    for (const msg of branchMessages.filter(m => m.id !== "welcome")) {
      await saveMessage(newConvId, {
        role: msg.role,
        content: msg.content,
        agent: msg.agent,
        model: msg.model,
      });
    }

    setActiveConversationId(newConvId);
    setMessages(branchMessages);
    toast.success("Branch created — continue the conversation from here");
  };

  const handleSelectBranch = (conversationId: string) => {
    handleSelectConversation(conversationId);
  };

  const handleGoToParent = () => {
    if (parentBranch) {
      handleSelectConversation(parentBranch.parentConversationId);
    }
  };

  // Determine the effective system prompt for the current conversation
  const getEffectiveSystemPrompt = useCallback((): string => {
    if (activeConversationId) {
      const perConv = getConversationSystemPrompt(activeConversationId);
      if (perConv) return perConv;
    }
    return systemPrompt;
  }, [activeConversationId, systemPrompt]);

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

    // Prepend system prompt if set
    const effectivePrompt = getEffectiveSystemPrompt();
    let allBefore = [...prevMessages, userMsg];
    if (effectivePrompt) {
      const sysMsg: ChatMessageType = {
        id: "system-prompt",
        role: "system",
        content: effectivePrompt,
        timestamp: new Date(),
      };
      allBefore = [sysMsg, ...allBefore.filter(m => m.id !== "system-prompt")];
    }

    setMessages([...allBefore.filter(m => m.id !== "system-prompt"), assistantMsg]);
    setIsStreaming(true);
    setStreamStartTime(Date.now());

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

      const totalMsgTokens = estimateTokens(userMsg.content) + estimateTokens(finalContent);
      const latency = Date.now() - assistantMsg.timestamp.getTime();
      logUsage(assistantMsg.model || "unknown", totalMsgTokens, latency, convId || undefined);
    } catch (err: any) {
      const errMsg = err?.message || "Connection failed";

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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onExport: () => setShowExport((v) => !v),
    onTogglePanel: () => setShowPanel((v) => !v),
    onToggleHistory: () => setShowHistory((v) => !v),
    onEscape: () => {
      setShowExport(false);
      setShowSettings(false);
      setShowShare(false);
      setShowMobileHistory(false);
      setShowMobilePanel(false);
    },
  });

  const agentColors: Record<string, string> = {
    Supervisor: "border-terminal-amber text-terminal-amber",
    Developer: "border-terminal-cyan text-terminal-cyan",
    Researcher: "border-primary text-primary",
    Critic: "border-terminal-red text-terminal-red",
  };

  // Get streaming message content for the indicator
  const streamingMsg = isStreaming ? messages.find(m => m.status === "streaming") : null;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Desktop history sidebar */}
      {showHistory && (
        <div className="w-56 border-r border-border bg-sidebar flex-shrink-0 hidden md:block">
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            onDelete={deleteConversation}
            pinnedIds={pinnedIds}
            onTogglePin={togglePin}
            systemPrompt={systemPrompt}
            onSystemPromptChange={setSystemPrompt}
            onSearchMessages={searchMessages}
            activeConvSystemPrompt={activeConvSystemPrompt}
            onActiveConvSystemPromptChange={handleConvSystemPromptChange}
          />
        </div>
      )}

      {/* Mobile history overlay */}
      {showMobileHistory && (
        <>
          <div className="fixed inset-0 bg-background/80 z-40 md:hidden" onClick={() => setShowMobileHistory(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-border z-50 md:hidden">
            <div className="flex items-center justify-between p-2 border-b border-border">
              <span className="text-xs font-mono text-primary uppercase tracking-wider">History</span>
              <button onClick={() => setShowMobileHistory(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ConversationList
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={handleSelectConversation}
              onNew={handleNewConversation}
              onDelete={deleteConversation}
              pinnedIds={pinnedIds}
              onTogglePin={togglePin}
              systemPrompt={systemPrompt}
              onSystemPromptChange={setSystemPrompt}
              onSearchMessages={searchMessages}
              activeConvSystemPrompt={activeConvSystemPrompt}
              onActiveConvSystemPromptChange={handleConvSystemPromptChange}
            />
          </div>
        </>
      )}

      {/* Mobile panel overlay */}
      {showMobilePanel && (
        <>
          <div className="fixed inset-0 bg-background/80 z-40 lg:hidden" onClick={() => setShowMobilePanel(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-72 z-50 lg:hidden">
            <SystemPanel />
          </div>
        </>
      )}

      {/* Modals */}
      <ChatSettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <ExportDialog open={showExport} onClose={() => setShowExport(false)} messages={messages} />
      <ShareDialog conversationId={activeConversationId} open={showShare} onClose={() => setShowShare(false)} />

      <div className="flex-1 flex flex-col relative">
        {/* Compact filter bar */}
        <div className="border-b border-border bg-card px-3 py-1.5 flex items-center gap-1.5 z-20 overflow-visible">
          {/* Mobile menu */}
          <button
            onClick={() => setShowMobileHistory(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground md:hidden"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Desktop history toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest font-mono flex-shrink-0 hidden md:inline"
          >
            {showHistory ? "◀" : "▶"}
          </button>

          {/* Branch indicator */}
          {parentBranch && (
            <button
              onClick={handleGoToParent}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border border-accent text-accent bg-accent/10 hover:bg-accent/20 transition-colors"
              title="Go to parent conversation"
            >
              <ArrowLeft className="w-3 h-3" />
              <GitBranch className="w-3 h-3" />
              <span className="hidden sm:inline">Branch</span>
            </button>
          )}

          <span className="text-border hidden sm:inline">|</span>

          {/* Agent filters — compact */}
          {Object.keys(agentColors).map((agent) => (
            <button
              key={agent}
              onClick={() => toggleAgent(agent)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all flex-shrink-0 ${
                activeAgents.has(agent)
                  ? agentColors[agent] + " bg-current/10"
                  : "border-muted text-muted-foreground opacity-40"
              }`}
              title={agent}
            >
              <span className="hidden sm:inline">{agent}</span>
              <span className="sm:hidden">{agent[0]}</span>
            </button>
          ))}

          <div className="flex-1 min-w-[4px]" />

          {/* Per-conv system prompt indicator */}
          {activeConvSystemPrompt && (
            <span className="text-[8px] font-mono text-terminal-cyan flex-shrink-0 hidden sm:inline" title="Per-conversation prompt active">
              📌 Custom prompt
            </span>
          )}

          {/* Token counter */}
          {totalTokens > 0 && (
            <span className="text-[9px] font-mono text-muted-foreground flex-shrink-0 hidden sm:inline" title={`~${totalTokens} tokens total`}>
              ~{formatTokenCount(totalTokens)} tok
            </span>
          )}

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Chat Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          {/* Share */}
          {activeConversationId && (
            <button
              onClick={() => setShowShare(true)}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Share conversation"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Export */}
          <button
            onClick={() => setShowExport(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Export (Ctrl+E)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Panel toggle */}
          <button
            onClick={() => {
              if (window.innerWidth >= 1024) {
                setShowPanel(!showPanel);
              } else {
                setShowMobilePanel(!showMobilePanel);
              }
            }}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Toggle Panel (Ctrl+B)"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
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
                onBranch={msg.id !== "welcome" ? handleBranch : undefined}
                onSelectBranch={handleSelectBranch}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Streaming indicator */}
        {streamingMsg && (
          <StreamingIndicator
            content={streamingMsg.content}
            startTime={streamStartTime}
            isStreaming={isStreaming}
          />
        )}

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
