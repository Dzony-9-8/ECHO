import { MessageSquare, Plus, Trash2 } from "lucide-react";
import type { Conversation } from "@/hooks/useConversations";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

const ConversationList = ({ conversations, activeId, onSelect, onNew, onDelete }: Props) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-border">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded text-[10px] font-mono border border-primary text-primary bg-primary/10 hover:bg-primary/20 transition-colors uppercase tracking-wider"
        >
          <Plus className="w-3.5 h-3.5" />
          New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {conversations.map((conv) => (
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-terminal-red hover:text-terminal-red/80 transition-opacity"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4 font-mono">
            No conversations yet
          </p>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
