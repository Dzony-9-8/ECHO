import { Terminal, Zap, Wifi, WifiOff, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { checkHealth } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";
import SystemMetrics from "./SystemMetrics";

interface Props {
  viewLabel?: string;
}

const TopBar = ({ viewLabel }: Props) => {
  const [online, setOnline] = useState(false);
  const { theme, toggleTheme } = useTheme();

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
      <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-mono hidden sm:inline">
        {viewLabel || "Local AI Orchestration System"}
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <SystemMetrics />
        <div className="w-px h-4 bg-border" />
        <button
          onClick={toggleTheme}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
        <div className={`flex items-center gap-1 text-[10px] font-mono ${online ? "text-primary" : "text-terminal-red"}`}>
          {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="hidden sm:inline">{online ? "ONLINE" : "OFFLINE"}</span>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
