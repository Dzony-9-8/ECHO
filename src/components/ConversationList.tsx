import { useState } from "react";
import { MessageSquare, Plus, Trash2, Search, Pin, PinOff, Settings2 } from "lucide-react";
import type { Conversation } from "@/hooks/useConversations";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  pinnedIds?: Set<string>;
  onTogglePin?: (id: string) => void;
  systemPrompt?: string;
  onSystemPromptChange?: (prompt: string) => void;
}

const ConversationList = ({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  pinnedIds = new Set(),
  onTogglePin,
  systemPrompt = "",
  onSystemPromptChange,
}: Props) => {
  const [search, setSearch] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  const filtered = search
    ? conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  // Sort: pinned first, then by date
  const sorted = [...filtered].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id);
    const bPinned = pinnedIds.has(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-border space-y-2">
        <div className="flex gap-1">
          <button
            onClick={onNew}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded text-[10px] font-mono border border-primary text-primary bg-primary/10 hover:bg-primary/20 transition-colors uppercase tracking-wider"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
          <button
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            className={`p-2 rounded border transition-colors ${
              showSystemPrompt
                ? "border-terminal-amber text-terminal-amber bg-terminal-amber/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            title="System prompt"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* System prompt editor */}
        {showSystemPrompt && onSystemPromptChange && (
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-widest text-terminal-amber font-mono">
              System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => onSystemPromptChange(e.target.value)}
              placeholder="Custom instructions for the AI..."
              className="w-full bg-input border border-border rounded px-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-terminal-amber font-mono resize-none"
              rows={3}
            />
            <p className="text-[8px] text-muted-foreground font-mono">
              Applied to all new messages
            </p>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-input border border-border rounded pl-7 pr-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {sorted.map((conv) => {
          const isPinned = pinnedIds.has(conv.id);
          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-mono transition-all ${
                activeId === conv.id
                  ? "text-primary bg-muted border-r-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {isPinned ? (
                <Pin className="w-3 h-3 flex-shrink-0 text-terminal-amber" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="flex-1 truncate">{conv.title}</span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {onTogglePin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(conv.id);
                    }}
                    className="text-muted-foreground hover:text-terminal-amber transition-colors"
                    title={isPinned ? "Unpin" : "Pin"}
                  >
                    {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="text-terminal-red hover:text-terminal-red/80 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4 font-mono">
            {search ? "No matches" : "No conversations yet"}
          </p>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
