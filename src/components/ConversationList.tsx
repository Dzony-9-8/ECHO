import { useState } from "react";
import { MessageSquare, Plus, Trash2, Search, Download, FileJson, FileText } from "lucide-react";
import type { Conversation } from "@/hooks/useConversations";
import type { ChatMessage } from "@/lib/api";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onExport?: (id: string, format: "json" | "md") => void;
}

const ConversationList = ({ conversations, activeId, onSelect, onNew, onDelete, onExport }: Props) => {
  const [search, setSearch] = useState("");
  const [exportingId, setExportingId] = useState<string | null>(null);

  const filtered = search.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-border space-y-2">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded text-[10px] font-mono border border-primary text-primary bg-primary/10 hover:bg-primary/20 transition-colors uppercase tracking-wider"
        >
          <Plus className="w-3.5 h-3.5" />
          New Chat
        </button>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-input border border-border rounded pl-7 pr-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`group flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-mono transition-all ${
              activeId === conv.id
                ? "text-primary bg-muted border-r-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 truncate">{conv.title}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {onExport && (
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setExportingId(exportingId === conv.id ? null : conv.id); }}
                    className="text-terminal-cyan hover:text-terminal-cyan/80 transition-colors p-0.5"
                    title="Export"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  {exportingId === conv.id && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded shadow-lg w-24">
                      <button onClick={(e) => { e.stopPropagation(); onExport(conv.id, "json"); setExportingId(null); }} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-mono hover:bg-muted/50 text-foreground">
                        <FileJson className="w-3 h-3 text-terminal-cyan" /> JSON
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onExport(conv.id, "md"); setExportingId(null); }} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-mono hover:bg-muted/50 text-foreground">
                        <FileText className="w-3 h-3 text-terminal-amber" /> Markdown
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                className="text-terminal-red hover:text-terminal-red/80 transition-opacity p-0.5"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4 font-mono">
            {search ? "No matches" : "No conversations yet"}
          </p>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
