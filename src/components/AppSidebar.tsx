import { useState } from "react";
import {
  MessageSquare,
  GitBranch,
  Brain,
  Activity,
  Search,
  Terminal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ViewType = "chat" | "workflow" | "memory" | "telemetry" | "research";

interface Props {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const navItems: { id: ViewType; icon: typeof MessageSquare; label: string; color: string }[] = [
  { id: "chat", icon: MessageSquare, label: "Chat", color: "text-primary" },
  { id: "workflow", icon: GitBranch, label: "Workflow", color: "text-terminal-cyan" },
  { id: "memory", icon: Brain, label: "Memory", color: "text-terminal-magenta" },
  { id: "telemetry", icon: Activity, label: "Telemetry", color: "text-terminal-amber" },
  { id: "research", icon: Search, label: "Research", color: "text-terminal-cyan" },
];

const AppSidebar = ({ activeView, onViewChange }: Props) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      animate={{ width: collapsed ? 48 : 180 }}
      transition={{ duration: 0.2 }}
      className="h-full border-r border-border bg-sidebar flex flex-col"
    >
      {/* Logo */}
      <div className="p-3 border-b border-border flex items-center gap-2 overflow-hidden">
        <Terminal className="w-5 h-5 text-primary glow-green flex-shrink-0" />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-display text-sm text-primary glow-green tracking-wider whitespace-nowrap"
            >
              ECHO v2
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-mono transition-all ${
                isActive
                  ? `${item.color} bg-muted border-r-2 border-current`
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="uppercase tracking-widest whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </motion.div>
  );
};

export default AppSidebar;
