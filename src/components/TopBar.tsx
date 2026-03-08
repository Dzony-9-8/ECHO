import { Terminal, Zap } from "lucide-react";

const TopBar = () => {
  return (
    <div className="h-10 border-b border-border bg-card flex items-center px-4 gap-3">
      <Terminal className="w-4 h-4 text-primary glow-green" />
      <span className="font-display text-sm text-primary glow-green tracking-wider">
        ECHO
      </span>
      <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
        Local AI Orchestration System
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-1.5 text-[10px] text-terminal-amber">
        <Zap className="w-3 h-3" />
        <span className="font-mono">GTX 1080 Ti</span>
      </div>
    </div>
  );
};

export default TopBar;
