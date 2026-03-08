import { useState, useEffect } from "react";
import {
  Cpu,
  HardDrive,
  Activity,
  Wifi,
  WifiOff,
  Settings,
  Brain,
  Eye,
  Code2,
  Mic,
  Search,
  PenTool,
  Shield,
  ChevronRight,
  Cloud,
  Server,
} from "lucide-react";
import {
  getBackendUrl,
  setBackendUrl,
  getBackendMode,
  setBackendMode,
  checkHealth,
  type SystemStatus,
  type BackendMode,
} from "@/lib/api";

const localAgents = [
  { name: "Supervisor", icon: Brain, model: "LLaMA 3.1", color: "text-primary" },
  { name: "Research", icon: Search, model: "DeepSeek R1", color: "text-terminal-cyan" },
  { name: "Coding", icon: Code2, model: "DeepSeek Coder", color: "text-terminal-amber" },
  { name: "Writing", icon: PenTool, model: "LLaMA 3.1", color: "text-primary" },
  { name: "Vision", icon: Eye, model: "LLaVA 1.6", color: "text-terminal-magenta" },
  { name: "Voice", icon: Mic, model: "Whisper / XTTS", color: "text-terminal-cyan" },
  { name: "Critic", icon: Shield, model: "DeepSeek R1", color: "text-terminal-red" },
];

const cloudAgents = [
  { name: "ECHO Cloud", icon: Cloud, model: "Multi-Model", color: "text-terminal-cyan" },
];

const SystemPanel = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [backendUrl, setUrl] = useState(getBackendUrl());
  const [mode, setMode] = useState<BackendMode>(getBackendMode());
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const check = () => checkHealth().then(setStatus);
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [mode]);

  const handleModeChange = (newMode: BackendMode) => {
    setMode(newMode);
    setBackendMode(newMode);
    checkHealth().then(setStatus);
  };

  const isOnline = status?.backend === "online";
  const agents = mode === "cloud" ? cloudAgents : localAgents;

  return (
    <div className="w-72 border-l border-border bg-sidebar flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary glow-green" />
          <span className="text-xs uppercase tracking-widest text-primary font-display glow-green">
            System
          </span>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="p-3 border-b border-border">
        <label className="text-[9px] uppercase tracking-widest text-muted-foreground block mb-2">
          Backend Mode
        </label>
        <div className="flex gap-1">
          <button
            onClick={() => handleModeChange("cloud")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-mono border transition-all ${
              mode === "cloud"
                ? "border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Cloud className="w-3 h-3" />
            Cloud
          </button>
          <button
            onClick={() => handleModeChange("local")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-mono border transition-all ${
              mode === "local"
                ? "border-terminal-amber text-terminal-amber bg-terminal-amber/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Server className="w-3 h-3" />
            Local
          </button>
        </div>
      </div>

      {/* Settings panel (local mode only) */}
      {showSettings && mode === "local" && (
        <div className="p-3 border-b border-border bg-muted/50">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">
            Backend URL
          </label>
          <input
            value={backendUrl}
            onChange={(e) => {
              setUrl(e.target.value);
              setBackendUrl(e.target.value);
            }}
            className="w-full bg-input border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Connection Status */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-primary" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-terminal-red" />
            )}
            <span
              className={`text-xs font-mono ${
                isOnline ? "text-primary" : "text-terminal-red"
              }`}
            >
              {isOnline ? "CONNECTED" : "OFFLINE"}
            </span>
            <span className="text-[9px] text-muted-foreground ml-auto uppercase">
              {mode}
            </span>
          </div>

          {mode === "cloud" && isOnline && (
            <p className="text-[10px] text-muted-foreground">
              Powered by Lovable AI · Gemini 3 Flash
            </p>
          )}

          {status?.gpu && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Cpu className="w-3 h-3" />
                {status.gpu.name}
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: `${(status.gpu.vram_used / status.gpu.vram_total) * 100}%`,
                  }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground">
                VRAM: {status.gpu.vram_used}GB / {status.gpu.vram_total}GB
              </div>
            </div>
          )}

          {!isOnline && mode === "local" && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Start your FastAPI backend at {backendUrl}
            </p>
          )}
        </div>

        {/* Models loaded */}
        {status?.models_loaded && status.models_loaded.length > 0 && (
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <HardDrive className="w-3 h-3 text-terminal-cyan" />
              <span className="text-[10px] uppercase tracking-widest text-terminal-cyan">
                Models Active
              </span>
            </div>
            {status.models_loaded.map((model) => (
              <div
                key={model}
                className="text-xs text-foreground font-mono flex items-center gap-1.5 py-0.5"
              >
                <ChevronRight className="w-2.5 h-2.5 text-primary" />
                {model}
              </div>
            ))}
          </div>
        )}

        {/* Agents */}
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-3">
            <Brain className="w-3 h-3 text-terminal-amber" />
            <span className="text-[10px] uppercase tracking-widest text-terminal-amber">
              {mode === "cloud" ? "Cloud Model" : "Agents"}
            </span>
          </div>
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.name}
                className="flex items-center gap-2 p-2 rounded border border-border bg-muted/30 hover:bg-muted/50 transition-colors group"
              >
                <agent.icon className={`w-3.5 h-3.5 ${agent.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-foreground">
                    {agent.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {agent.model}
                  </div>
                </div>
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? "bg-primary pulse-glow" : "bg-muted-foreground/30"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <div className="text-[9px] text-muted-foreground text-center font-mono uppercase tracking-wider">
          ECHO AI System v2.0 · {mode === "cloud" ? "☁ Cloud" : "⚡ Local"}
        </div>
      </div>
    </div>
  );
};

export default SystemPanel;
