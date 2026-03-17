import { useMemo } from "react";
import { motion } from "framer-motion";
import { GitBranch, MessageSquare } from "lucide-react";
import { getParentBranch, getBranchesForConversation } from "@/lib/branches";
import type { Conversation } from "@/hooks/useConversations";

interface TreeNode {
  conv: Conversation;
  children: TreeNode[];
  depth: number;
  x: number;
  y: number;
}

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

const NODE_W = 160;
const NODE_H = 52;
const H_GAP = 24;
const V_GAP = 72;

function buildForest(conversations: Conversation[]): TreeNode[] {
  const byId = new Map(conversations.map((c) => [c.id, c]));
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const conv of conversations) {
    const parent = getParentBranch(conv.id);
    if (parent && byId.has(parent.parentConversationId)) {
      hasParent.add(conv.id);
      const list = children.get(parent.parentConversationId) ?? [];
      list.push(conv.id);
      children.set(parent.parentConversationId, list);
    }
  }

  const roots = conversations.filter((c) => !hasParent.has(c.id));

  function buildNode(id: string, depth: number): TreeNode {
    const conv = byId.get(id)!;
    const childIds = children.get(id) ?? [];
    return {
      conv,
      depth,
      x: 0,
      y: 0,
      children: childIds.map((cid) => buildNode(cid, depth + 1)),
    };
  }

  return roots.map((r) => buildNode(r.id, 0));
}

let _counter = 0;
function assignPositions(nodes: TreeNode[], startX: number, startY: number): number {
  let x = startX;
  for (const node of nodes) {
    if (node.children.length === 0) {
      node.x = x;
      node.y = startY + node.depth * V_GAP;
      x += NODE_W + H_GAP;
    } else {
      const before = x;
      x = assignPositions(node.children, x, startY);
      const after = x - H_GAP;
      node.x = Math.round((before + after - NODE_W) / 2);
      node.y = startY + node.depth * V_GAP;
    }
  }
  return x;
}

function flatten(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

function collectEdges(nodes: TreeNode[]): { x1: number; y1: number; x2: number; y2: number }[] {
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const node of nodes) {
    for (const child of node.children) {
      edges.push({
        x1: node.x + NODE_W / 2,
        y1: node.y + NODE_H,
        x2: child.x + NODE_W / 2,
        y2: child.y,
      });
      edges.push(...collectEdges(node.children));
    }
  }
  return edges;
}

const ConversationTree = ({ conversations, activeId, onSelect }: Props) => {
  const { allNodes, edges, svgW, svgH } = useMemo(() => {
    if (!conversations.length) return { allNodes: [], edges: [], svgW: 0, svgH: 0 };
    const forest = buildForest(conversations);
    assignPositions(forest, 0, 16);
    const flat = flatten(forest);
    const svgW = Math.max(...flat.map((n) => n.x + NODE_W)) + H_GAP;
    const svgH = Math.max(...flat.map((n) => n.y + NODE_H)) + V_GAP;
    const edges = collectEdges(forest);
    return { allNodes: flat, edges, svgW, svgH };
  }, [conversations]);

  if (!conversations.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[10px] text-muted-foreground font-mono">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-3">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-2 flex items-center gap-1.5">
        <GitBranch className="w-3 h-3" /> Conversation Tree
      </div>
      <div style={{ position: "relative", width: svgW, height: svgH, minWidth: "100%" }}>
        {/* Edges */}
        <svg
          style={{ position: "absolute", top: 0, left: 0, width: svgW, height: svgH, overflow: "visible" }}
        >
          {edges.map((e, i) => (
            <path
              key={i}
              d={`M${e.x1},${e.y1} C${e.x1},${(e.y1 + e.y2) / 2} ${e.x2},${(e.y1 + e.y2) / 2} ${e.x2},${e.y2}`}
              fill="none"
              stroke="hsl(142 40% 18%)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.6}
            />
          ))}
        </svg>

        {/* Nodes */}
        {allNodes.map((node) => {
          const isActive = node.conv.id === activeId;
          const branchCount = node.children.length;
          return (
            <motion.button
              key={node.conv.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => onSelect(node.conv.id)}
              style={{
                position: "absolute",
                left: node.x,
                top: node.y,
                width: NODE_W,
                height: NODE_H,
              }}
              className={`rounded border text-left px-2.5 py-1.5 transition-all ${
                isActive
                  ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(74,222,128,0.2)]"
                  : "border-border bg-card hover:border-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {branchCount > 0 ? (
                  <GitBranch className={`w-2.5 h-2.5 flex-shrink-0 ${isActive ? "text-primary" : "text-terminal-amber"}`} />
                ) : (
                  <MessageSquare className={`w-2.5 h-2.5 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                )}
                <span
                  className={`text-[10px] font-mono font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}
                >
                  {node.conv.title || "Untitled"}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-4">
                <span className="text-[8px] text-muted-foreground font-mono">
                  {new Date(node.conv.updated_at || node.conv.created_at).toLocaleDateString()}
                </span>
                {branchCount > 0 && (
                  <span className="text-[8px] text-terminal-amber font-mono">{branchCount} branch{branchCount > 1 ? "es" : ""}</span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationTree;
