import { useState, useMemo, useCallback } from "react";
import { MessageSquare, Plus, Trash2, Search, Pin, PinOff, Settings2, Calendar, GitBranch, Tag, Network } from "lucide-react";
import ConversationTree from "@/components/ConversationTree";
import type { Conversation } from "@/hooks/useConversations";
import { getParentBranch, getBranchesForConversation } from "@/lib/branches";
import {
  getTags,
  getTagsForConversation,
  toggleTagForConversation,
  type ConversationTag,
} from "@/lib/conversationTags";

interface SearchResult {
  conversationId: string;
  conversationTitle: string;
  messageContent: string;
  messageRole: string;
  messageAgent?: string;
  createdAt: string;
}

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
  onSearchMessages?: (query: string) => Promise<SearchResult[]>;
  // Per-conversation system prompt
  activeConvSystemPrompt?: string;
  onActiveConvSystemPromptChange?: (prompt: string) => void;
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
  onSearchMessages,
  activeConvSystemPrompt = "",
  onActiveConvSystemPromptChange,
}: Props) => {
  const [search, setSearch] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [deepSearch, setDeepSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [tagMenuConvId, setTagMenuConvId] = useState<string | null>(null);
  const [, forceUpdate] = useState(0); // to re-render on tag toggle

  const allTags = useMemo(() => getTags(), []);

  const handleToggleTag = useCallback((convId: string, tagId: string) => {
    toggleTagForConversation(convId, tagId);
    forceUpdate((n) => n + 1);
  }, []);

  const filtered = useMemo(() => {
    let result = conversations;

    // Tag filter
    if (activeTagFilter) {
      result = result.filter((c) => getTagsForConversation(c.id).includes(activeTagFilter));
    }

    // Text / regex filter
    if (search) {
      if (useRegex) {
        try {
          const re = new RegExp(search, "i");
          result = result.filter((c) => re.test(c.title));
        } catch {
          result = result.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
        }
      } else {
        result = result.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
      }
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((c) => new Date(c.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59");
      result = result.filter((c) => new Date(c.created_at) <= to);
    }

    return result;
  }, [conversations, search, useRegex, dateFrom, dateTo, activeTagFilter]);

  const [viewMode, setViewMode] = useState<"list" | "timeline" | "tree">("list");

  // Sort: pinned first, then by date
  const sorted = [...filtered].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id);
    const bPinned = pinnedIds.has(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Group by date for timeline view
  const grouped = useMemo(() => {
    if (viewMode !== "timeline") return {};
    const groups: Record<string, typeof sorted> = {};
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();

    for (const conv of sorted) {
      const d = new Date(conv.created_at);
      const ds = d.toDateString();
      let label: string;
      if (ds === today) label = "Today";
      else if (ds === yesterday) label = "Yesterday";
      else {
        const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
        if (diffDays < 7) label = "This Week";
        else if (diffDays < 30) label = "This Month";
        else label = d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      }
      if (!groups[label]) groups[label] = [];
      groups[label].push(conv);
    }
    return groups;
  }, [sorted, viewMode]);

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
            onClick={() => setViewMode(viewMode === "timeline" ? "list" : "timeline")}
            className={`p-2 rounded border transition-colors ${
              viewMode === "timeline"
                ? "border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            title="Timeline view"
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode(viewMode === "tree" ? "list" : "tree")}
            className={`p-2 rounded border transition-colors ${
              viewMode === "tree"
                ? "border-terminal-amber text-terminal-amber bg-terminal-amber/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            title="Branch tree view"
          >
            <Network className="w-3.5 h-3.5" />
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
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest text-terminal-amber font-mono">
                Global System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                placeholder="Custom instructions for all conversations..."
                className="w-full bg-input border border-border rounded px-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-terminal-amber font-mono resize-none"
                rows={2}
              />
            </div>
            {/* Per-conversation system prompt */}
            {activeId && onActiveConvSystemPromptChange && (
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-terminal-cyan font-mono">
                  This Conversation Only
                </label>
                <textarea
                  value={activeConvSystemPrompt}
                  onChange={(e) => onActiveConvSystemPromptChange(e.target.value)}
                  placeholder="Override for this chat only..."
                  className="w-full bg-input border border-border rounded px-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-terminal-cyan font-mono resize-none"
                  rows={2}
                />
                <p className="text-[8px] text-muted-foreground font-mono">
                  {activeConvSystemPrompt ? "Overrides global prompt for this conversation" : "Empty = uses global prompt"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tag filter chips */}
        <div className="flex gap-1 flex-wrap">
          {allTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setActiveTagFilter(activeTagFilter === tag.id ? null : tag.id)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono border transition-colors ${
                activeTagFilter === tag.id
                  ? "border-foreground bg-foreground/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              style={{
                borderColor: activeTagFilter === tag.id ? `hsl(${tag.color})` : undefined,
                color: `hsl(${tag.color})`,
              }}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* Search bar with regex toggle */}
        <div className="relative flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (deepSearch && onSearchMessages && e.target.value.trim().length >= 2) {
                  setSearching(true);
                  onSearchMessages(e.target.value.trim()).then((r) => {
                    setSearchResults(r);
                    setSearching(false);
                  });
                } else {
                  setSearchResults([]);
                }
              }}
              placeholder={deepSearch ? "Search all messages..." : useRegex ? "Regex pattern..." : "Search chats..."}
              className="w-full bg-input border border-border rounded pl-7 pr-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
            />
          </div>
          <button
            onClick={() => setUseRegex(!useRegex)}
            className={`px-1.5 rounded border text-[9px] font-mono transition-colors ${
              useRegex
                ? "border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            title="Toggle regex search"
          >
            .*
          </button>
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`p-1.5 rounded border transition-colors ${
              showDateFilter || dateFrom || dateTo
                ? "border-terminal-amber text-terminal-amber bg-terminal-amber/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            title="Date filter"
          >
            <Calendar className="w-3 h-3" />
          </button>
          {onSearchMessages && (
            <button
              onClick={() => { setDeepSearch(!deepSearch); setSearchResults([]); }}
              className={`px-1.5 rounded border text-[9px] font-mono transition-colors ${
                deepSearch
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              title="Search inside all messages"
            >
              ⋯
            </button>
          )}
        </div>

        {/* Deep search results */}
        {deepSearch && searchResults.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            <label className="text-[9px] uppercase tracking-widest text-primary font-mono">
              {searching ? "Searching..." : `${searchResults.length} result${searchResults.length > 1 ? "s" : ""}`}
            </label>
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => { onSelect(r.conversationId); setDeepSearch(false); setSearch(""); setSearchResults([]); }}
                className="w-full text-left px-2 py-1.5 rounded border border-border hover:border-primary bg-muted/30 transition-colors"
              >
                <span className="text-[9px] font-mono text-primary truncate block">{r.conversationTitle}</span>
                <span className="text-[8px] font-mono text-muted-foreground line-clamp-2">{r.messageContent.slice(0, 120)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Date range filter */}
        {showDateFilter && (
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-widest text-terminal-amber font-mono">Date Range</label>
            <div className="flex gap-1">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 bg-input border border-border rounded px-1.5 py-1 text-[9px] font-mono text-foreground focus:outline-none focus:border-terminal-amber"
              />
              <span className="text-[9px] text-muted-foreground self-center">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 bg-input border border-border rounded px-1.5 py-1 text-[9px] font-mono text-foreground focus:outline-none focus:border-terminal-amber"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="text-[8px] font-mono text-terminal-red hover:underline"
              >
                Clear dates
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {/* Tree mode: branch hierarchy */}
        {viewMode === "tree" && (
          <ConversationTree
            conversations={conversations}
            activeId={activeId}
            onSelect={onSelect}
          />
        )}

        {/* Timeline mode: grouped by date */}
        {viewMode === "timeline" && Object.entries(grouped).map(([label, convs]) => (
          <div key={label}>
            <div className="px-3 py-1.5 text-[8px] uppercase tracking-widest text-terminal-cyan font-mono sticky top-0 bg-background/90 backdrop-blur-sm border-b border-border/30">
              {label} ({convs.length})
            </div>
            {convs.map((conv) => {
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
                  {isPinned ? <Pin className="w-3 h-3 flex-shrink-0 text-terminal-amber" /> : <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span className="flex-1 truncate">{conv.title}</span>
                  <span className="text-[8px] text-muted-foreground/50">
                    {new Date(conv.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        ))}

        {/* List mode: flat */}
        {viewMode === "list" && sorted.map((conv) => {
          const isPinned = pinnedIds.has(conv.id);
          const parentBranch = getParentBranch(conv.id);
          const childBranches = getBranchesForConversation(conv.id);
          const convTags = getTagsForConversation(conv.id);
          return (
            <div key={conv.id} className="relative">
              <div
                onClick={() => onSelect(conv.id)}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-mono transition-all ${
                  activeId === conv.id
                    ? "text-primary bg-muted border-r-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {isPinned ? (
                  <Pin className="w-3 h-3 flex-shrink-0 text-terminal-amber" />
                ) : parentBranch ? (
                  <GitBranch className="w-3 h-3 flex-shrink-0 text-accent" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{conv.title}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {convTags.map((tagId) => {
                      const tag = allTags.find((t) => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <span
                          key={tagId}
                          className="text-[7px] px-1 py-px rounded font-mono"
                          style={{
                            color: `hsl(${tag.color})`,
                            backgroundColor: `hsl(${tag.color} / 0.15)`,
                          }}
                        >
                          {tag.label}
                        </span>
                      );
                    })}
                    {childBranches.length > 0 && (
                      <span className="text-[8px] text-accent">
                        {childBranches.length} branch{childBranches.length > 1 ? "es" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Tag button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTagMenuConvId(tagMenuConvId === conv.id ? null : conv.id);
                    }}
                    className="text-muted-foreground hover:text-terminal-cyan transition-colors"
                    title="Tags"
                  >
                    <Tag className="w-3 h-3" />
                  </button>
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
              {/* Tag menu popup */}
              {tagMenuConvId === conv.id && (
                <div className="absolute right-2 top-full z-40 bg-card border border-border rounded shadow-lg p-1.5 space-y-0.5 min-w-24">
                  {allTags.map((tag) => {
                    const active = convTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTag(conv.id, tag.id);
                        }}
                        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono transition-colors ${
                          active ? "bg-muted" : "hover:bg-muted/50"
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `hsl(${tag.color})` }}
                        />
                        <span style={{ color: active ? `hsl(${tag.color})` : undefined }}>
                          {tag.label}
                        </span>
                        {active && <span className="ml-auto text-primary">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {viewMode === "list" && sorted.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4 font-mono">
            {search || dateFrom || dateTo || activeTagFilter ? "No matches" : "No conversations yet"}
          </p>
        )}
        {viewMode === "timeline" && Object.keys(grouped).length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4 font-mono">
            {search || dateFrom || dateTo || activeTagFilter ? "No matches" : "No conversations yet"}
          </p>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
