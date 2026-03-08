import { GitBranch, ChevronRight } from "lucide-react";

export interface BranchInfo {
  conversationId: string;
  parentConversationId: string;
  branchMessageId: string;
  title: string;
  createdAt: string;
}

interface Props {
  branches: BranchInfo[];
  onSelectBranch: (conversationId: string) => void;
}

const BranchIndicator = ({ branches, onSelectBranch }: Props) => {
  if (branches.length === 0) return null;

  return (
    <div className="ml-11 mb-1">
      <div className="flex items-center gap-1 text-[9px] font-mono text-accent uppercase tracking-wider mb-1">
        <GitBranch className="w-3 h-3" />
        <span>{branches.length} branch{branches.length > 1 ? "es" : ""}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {branches.map((b) => (
          <button
            key={b.conversationId}
            onClick={() => onSelectBranch(b.conversationId)}
            className="flex items-center gap-1 px-2 py-1 rounded border border-accent/30 text-accent bg-accent/5 hover:bg-accent/10 transition-colors text-[9px] font-mono"
          >
            <ChevronRight className="w-2.5 h-2.5" />
            <span className="max-w-[120px] truncate">{b.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BranchIndicator;
