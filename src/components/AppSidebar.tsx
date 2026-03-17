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
  LogOut,
  BarChart3,
  BookOpen,
  FileText,
  Zap,
  Workflow,
  Wrench,
  Puzzle,
  Bot,
  FolderOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

export type ViewType =
  | "chat"
  | "workflow"
  | "builder"
  | "memory"
  | "telemetry"
  | "research"
  | "analytics"
  | "prompts"
  | "rag"
  | "skills"
  | "tools"
  | "plugins"
  | "autonomous"
  | "project";

interface Props {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const navItems: {
  id: ViewType;
  icon: typeof MessageSquare;
  label: string;
  color: string;
  glow: string;
}[] = [
  { id: "chat",      icon: MessageSquare, label: "Chat",      color: "text-primary",          glow: "hsl(142 70% 45%)" },
  { id: "workflow",  icon: GitBranch,     label: "Workflow",  color: "text-terminal-cyan",    glow: "hsl(185 60% 50%)" },
  { id: "builder",   icon: Workflow,      label: "Builder",   color: "text-primary",          glow: "hsl(142 70% 45%)" },
  { id: "memory",    icon: Brain,         label: "Memory",    color: "text-terminal-magenta", glow: "hsl(280 60% 55%)" },
  { id: "telemetry", icon: Activity,      label: "Telemetry", color: "text-terminal-amber",   glow: "hsl(38 90% 55%)"  },
  { id: "research",  icon: Search,        label: "Research",  color: "text-terminal-cyan",    glow: "hsl(185 60% 50%)" },
  { id: "analytics", icon: BarChart3,     label: "Analytics", color: "text-primary",          glow: "hsl(142 70% 45%)" },
  { id: "prompts",   icon: BookOpen,      label: "Prompts",   color: "text-terminal-magenta", glow: "hsl(280 60% 55%)" },
  { id: "rag",       icon: FileText,      label: "RAG",       color: "text-terminal-cyan",    glow: "hsl(185 60% 50%)" },
  { id: "skills",     icon: Zap,      label: "Skills",     color: "text-terminal-amber",   glow: "hsl(38 90% 55%)"  },
  { id: "tools",      icon: Wrench,   label: "Tools",      color: "text-primary",          glow: "hsl(142 70% 45%)" },
  { id: "plugins",    icon: Puzzle,   label: "Plugins",    color: "text-terminal-magenta", glow: "hsl(280 60% 55%)" },
  { id: "autonomous", icon: Bot,        label: "Autonomous", color: "text-terminal-amber",   glow: "hsl(38 90% 55%)"  },
  { id: "project",    icon: FolderOpen, label: "Projects",   color: "text-terminal-cyan",    glow: "hsl(185 60% 50%)" },
];

const AppSidebar = ({ activeView, onViewChange }: Props) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <motion.div
      animate={{ width: collapsed ? 48 : 180 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="h-full border-r border-border bg-sidebar flex flex-col relative overflow-hidden"
    >
      {/* Subtle left-edge accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-px pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, hsl(142 70% 45% / 0.25) 35%, hsl(185 60% 50% / 0.18) 65%, transparent 100%)",
        }}
      />

      {/* Logo */}
      <div className="p-3 border-b border-border flex items-center gap-2 overflow-hidden flex-shrink-0">
        <Terminal className="w-5 h-5 text-primary glow-green flex-shrink-0" />
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <span className="font-display text-sm text-primary glow-green tracking-wider">ECHO v2</span>
              <span className="text-[8px] font-mono text-muted-foreground border border-border px-1 py-0.5 rounded">
                3.5
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-1.5 space-y-px overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-mono transition-all relative group overflow-hidden ${
                isActive
                  ? `${item.color} bg-muted`
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
              style={isActive ? { boxShadow: `inset 3px 0 0 ${item.glow}` } : {}}
            >
              {/* Active gradient wash */}
              {isActive && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, ${item.glow}20 0%, transparent 65%)`,
                  }}
                />
              )}

              <item.icon
                className={`w-4 h-4 flex-shrink-0 transition-all relative z-10 ${
                  isActive ? item.color : "text-muted-foreground group-hover:text-foreground"
                }`}
                style={isActive ? { filter: `drop-shadow(0 0 5px ${item.glow}90)` } : {}}
              />

              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="uppercase tracking-widest whitespace-nowrap relative z-10"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      {/* User info + sign out */}
      {user && (
        <div className="border-t border-border p-2 flex-shrink-0">
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[9px] text-muted-foreground font-mono truncate px-1 mb-1"
              >
                {user.email}
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={signOut}
            title={collapsed ? "Sign out" : undefined}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-terminal-red hover:bg-terminal-red/10 rounded transition-all font-mono group"
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="uppercase tracking-widest"
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 border-t border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all flex-shrink-0 flex items-center justify-center"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </motion.div>
  );
};

export default AppSidebar;
