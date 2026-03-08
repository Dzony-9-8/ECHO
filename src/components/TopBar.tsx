import { Terminal, Zap, Wifi, WifiOff } from "lucide-react";
import { useState, useEffect } from "react";
import { checkHealth } from "@/lib/api";
import SystemMetrics from "./SystemMetrics";

interface Props {
  viewLabel?: string;
}

const TopBar = ({ viewLabel }: Props) => {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const check = () =>
      checkHealth().then((s) => setOnline(s.backend === "online"));
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-10 border-b border-border bg-card flex items-center px-4 gap-3">
      <Terminal className="w-4 h-4 text-primary glow-green" />
      <span className="font-display text-sm text-primary glow-green tracking-wider">
        ECHO
      </span>
      <div className="w-px h-4 bg-border" />
      <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-mono">
        {viewLabel || "Local AI Orchestration System"}
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <SystemMetrics />
        <div className="w-px h-4 bg-border" />
        <div className={`flex items-center gap-1 text-[10px] font-mono ${online ? "text-primary" : "text-terminal-red"}`}>
          {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {online ? "ONLINE" : "OFFLINE"}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
