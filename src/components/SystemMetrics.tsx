import { useState, useEffect } from "react";
import { Cpu, HardDrive, Activity, MonitorSpeaker } from "lucide-react";

interface SystemInfo {
  cpuCores: number;
  memoryGB: number | null;
  gpu: string | null;
  platform: string;
  cpuUsage: number;
  memUsage: number;
}

const getSystemInfo = (): SystemInfo => {
  const nav = navigator as any;
  const cpuCores = nav.hardwareConcurrency || 0;
  const memoryGB = nav.deviceMemory || null;
  const platform = nav.platform || "Unknown";

  // Detect GPU via WebGL
  let gpu: string | null = null;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        gpu = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL);
      }
    }
  } catch {
    /* WebGL not available */
  }

  return {
    cpuCores,
    memoryGB,
    gpu,
    platform,
    cpuUsage: 0,
    memUsage: 0,
  };
};

const SystemMetrics = () => {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [cpuSim, setCpuSim] = useState(12);
  const [memSim, setMemSim] = useState(45);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setInfo(getSystemInfo());
  }, []);

  // Simulate fluctuating usage (real per-process usage isn't available in browsers)
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuSim((prev) => Math.max(5, Math.min(95, prev + (Math.random() - 0.5) * 8)));
      setMemSim((prev) => Math.max(20, Math.min(85, prev + (Math.random() - 0.5) * 4)));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!info) return null;

  const gpuShort = info.gpu
    ? info.gpu.replace(/ANGLE \(/, "").replace(/\)$/, "").split(",")[0].trim()
    : "N/A";

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-terminal-cyan" />
          <span className="text-terminal-cyan">{Math.round(cpuSim)}%</span>
        </span>
        <span className="flex items-center gap-1">
          <HardDrive className="w-3 h-3 text-terminal-amber" />
          <span className="text-terminal-amber">
            {info.memoryGB ? `${(info.memoryGB * memSim / 100).toFixed(1)}/${info.memoryGB}GB` : `${Math.round(memSim)}%`}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <MonitorSpeaker className="w-3 h-3 text-terminal-magenta" />
          <span className="text-terminal-magenta truncate max-w-[100px]">{gpuShort}</span>
        </span>
      </button>

      {expanded && (
        <div className="absolute top-8 right-0 w-72 border border-border bg-card rounded p-3 z-50 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-primary font-mono">
              System Info
            </span>
          </div>

          <div className="space-y-3">
            {/* CPU */}
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-terminal-cyan">CPU</span>
                <span className="text-muted-foreground">{info.cpuCores} cores · {Math.round(cpuSim)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${cpuSim}%`,
                    backgroundColor: `hsl(var(--terminal-cyan))`,
                  }}
                />
              </div>
            </div>

            {/* RAM */}
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-terminal-amber">RAM</span>
                <span className="text-muted-foreground">
                  {info.memoryGB ? `${info.memoryGB}GB · ` : ""}{Math.round(memSim)}%
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${memSim}%`,
                    backgroundColor: `hsl(var(--terminal-amber))`,
                  }}
                />
              </div>
            </div>

            {/* GPU */}
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-terminal-magenta">GPU</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono break-words">
                {info.gpu || "Not detected"}
              </p>
            </div>

            {/* Platform */}
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Platform</span>
                <span className="text-foreground">{info.platform}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono mt-1">
                <span className="text-muted-foreground">User Agent</span>
                <span className="text-foreground truncate max-w-[160px]">
                  {navigator.userAgent.split(" ").pop()?.split("/")[0] || "Unknown"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemMetrics;
