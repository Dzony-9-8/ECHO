import { Terminal, Wifi, WifiOff, Sun, Moon, Zap } from "lucide-react";
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
    <div
      className="h-10 border-b border-border flex items-center px-4 gap-3 relative"
      style={{
        background:
          "linear-gradient(180deg, hsl(220 20% 6% / 0.97) 0%, hsl(220 20% 4% / 1) 100%)",
      }}
    >
      {/* Gradient accent line at bottom — scoped overflow-hidden so it doesn't clip dropdowns */}
      <div className="absolute bottom-0 left-0 right-0 h-px overflow-hidden pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, hsl(142 70% 45% / 0.5) 25%, hsl(185 60% 50% / 0.4) 75%, transparent 100%)",
          }}
        />
      </div>

      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Terminal className="w-4 h-4 text-primary glow-green" />
        <span className="font-display text-sm text-primary glow-green tracking-wider">ECHO</span>
        <Zap className="w-2.5 h-2.5 text-terminal-amber opacity-60" />
      </div>

      <div className="w-px h-4 bg-border flex-shrink-0" />

      <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-mono hidden sm:inline truncate">
        {viewLabel || "Local AI Orchestration System"}
      </span>

      <div className="flex-1" />

      <div className="flex items-center gap-3 flex-shrink-0">
        <SystemMetrics />
        <div className="w-px h-4 bg-border" />

        <button
          onClick={toggleTheme}
          className="p-1.5 rounded transition-all text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-95"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        <div
          className={`flex items-center gap-1.5 text-[10px] font-mono ${
            online ? "text-primary" : "text-terminal-red"
          }`}
        >
          {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {/* Animated status dot */}
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              online ? "bg-primary" : "bg-terminal-red"
            }`}
            style={online ? { animation: "pulse-glow 2s ease-in-out infinite" } : {}}
          />
          <span className="hidden sm:inline">{online ? "ONLINE" : "OFFLINE"}</span>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
