import { useState, useEffect } from "react";
import { Cpu, Activity, MonitorSpeaker, MemoryStick, Settings, Save, RotateCcw, Thermometer } from "lucide-react";
import { fetchSystemMetrics, getBackendMode, type RealSystemMetrics } from "@/lib/api";

/* ─── Types ─── */
interface BrowserInfo {
  cpuCores: number;
  deviceMemoryGB: number | null;
  gpu: string | null;
  gpuVendor: string | null;
  vramMB: number | null;
  platform: string;
  browser: string;
}

interface ManualOverrides {
  cpuName?: string;
  ramTotalGB?: number;
  gpuName?: string;
  vramMB?: number;
}

type MetricSource = "local" | "override" | "browser";

/* ─── Helpers ─── */

/** Returns a color based on usage percentage: green < 60%, amber 60-85%, red > 85% */
const usageColor = (percent: number): string => {
  if (percent >= 85) return "hsl(var(--terminal-red))";
  if (percent >= 60) return "hsl(var(--terminal-amber))";
  return "hsl(var(--primary))";
};

const usageTextClass = (percent: number): string => {
  if (percent >= 85) return "text-terminal-red";
  if (percent >= 60) return "text-terminal-amber";
  return "text-primary";
};

/** Returns a color for GPU temperature: green < 65°C, amber 65-80°C, red > 80°C */
const tempColor = (tempC: number): string => {
  if (tempC >= 80) return "hsl(var(--terminal-red))";
  if (tempC >= 65) return "hsl(var(--terminal-amber))";
  return "hsl(var(--primary))";
};

const tempTextClass = (tempC: number): string => {
  if (tempC >= 80) return "text-terminal-red";
  if (tempC >= 65) return "text-terminal-amber";
  return "text-primary";
};

/* ─── Browser detection (fallback) ─── */
const detectGPU = () => {
  let gpu: string | null = null;
  let gpuVendor: string | null = null;
  let vramMB: number | null = null;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        gpuVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
      }
      if (gpu) {
        const gpuLower = gpu.toLowerCase();
        const vramMap: Record<string, number> = {
          "rtx 4090": 24576, "rtx 4080": 16384, "rtx 4070 ti": 12288, "rtx 4070": 12288, "rtx 4060 ti": 8192, "rtx 4060": 8192,
          "rtx 3090": 24576, "rtx 3080 ti": 12288, "rtx 3080": 10240, "rtx 3070 ti": 8192, "rtx 3070": 8192, "rtx 3060 ti": 8192, "rtx 3060": 12288,
          "rtx 2080 ti": 11264, "rtx 2080": 8192, "rtx 2070": 8192, "rtx 2060": 6144,
          "gtx 1080 ti": 11264, "gtx 1080": 8192, "gtx 1070 ti": 8192, "gtx 1070": 8192, "gtx 1060": 6144, "gtx 1050 ti": 4096, "gtx 1050": 2048,
          "gtx 1660 ti": 6144, "gtx 1660": 6144, "gtx 1650": 4096,
          "rx 7900 xtx": 24576, "rx 7900 xt": 20480, "rx 7800 xt": 16384, "rx 7700 xt": 12288, "rx 7600": 8192,
          "rx 6900 xt": 16384, "rx 6800 xt": 16384, "rx 6700 xt": 12288, "rx 6600 xt": 8192,
          "apple m1": 8192, "apple m1 pro": 16384, "apple m1 max": 32768, "apple m2": 8192, "apple m2 pro": 16384, "apple m2 max": 38912,
          "apple m3": 8192, "apple m3 pro": 18432, "apple m3 max": 40960, "apple m4": 16384, "apple m4 pro": 24576, "apple m4 max": 49152,
          "intel iris xe": 4096, "intel uhd": 2048, "intel hd": 1024,
        };
        for (const [key, vram] of Object.entries(vramMap)) {
          if (gpuLower.includes(key)) { vramMB = vram; break; }
        }
      }
    }
  } catch { /* ignore */ }
  return { gpu, gpuVendor, vramMB };
};

const getBrowserInfo = (): BrowserInfo => {
  const nav = navigator as any;
  const { gpu, gpuVendor, vramMB } = detectGPU();
  const ua = navigator.userAgent;
  const browser = ua.includes("Firefox") ? "Firefox" : ua.includes("Edg/") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Safari") ? "Safari" : "Unknown";
  return { cpuCores: nav.hardwareConcurrency || 0, deviceMemoryGB: nav.deviceMemory || null, gpu, gpuVendor, vramMB, platform: nav.platform || "Unknown", browser };
};

const getJSHeapUsage = (): { usedMB: number; totalMB: number } | null => {
  const perf = performance as any;
  return perf.memory ? { usedMB: Math.round(perf.memory.usedJSHeapSize / (1024 * 1024)), totalMB: Math.round(perf.memory.totalJSHeapSize / (1024 * 1024)) } : null;
};

const OVERRIDES_KEY = "echo_system_overrides";
const loadOverrides = (): ManualOverrides => { try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || "{}"); } catch { return {}; } };
const saveOverrides = (o: ManualOverrides) => localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));

/* ─── Usage Bar Component ─── */
const UsageBar = ({ percent, label, detail, showTemp, tempC }: { percent: number; label: string; detail: string; showTemp?: boolean; tempC?: number | null }) => {
  const barColor = usageColor(percent);
  const pctClass = usageTextClass(percent);

  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono mb-1">
        <span className={pctClass}>{label}</span>
        <span className="text-muted-foreground">{detail}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: barColor }}
        />
      </div>
      <div className="flex justify-between items-center mt-0.5">
        <span className={`text-[9px] font-mono ${pctClass}`}>{Math.round(percent)}%</span>
        {showTemp && tempC !== null && tempC !== undefined && (
          <span className={`text-[9px] font-mono flex items-center gap-0.5 ${tempTextClass(tempC)}`}>
            <Thermometer className="w-2.5 h-2.5" />
            {tempC}°C
          </span>
        )}
      </div>
    </div>
  );
};

/* ─── Component ─── */
const SystemMetrics = () => {
  const [browserInfo] = useState<BrowserInfo>(getBrowserInfo);
  const [realMetrics, setRealMetrics] = useState<RealSystemMetrics | null>(null);
  const [overrides, setOverrides] = useState<ManualOverrides>(loadOverrides);
  const [heapUsage, setHeapUsage] = useState(getJSHeapUsage);
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editOverrides, setEditOverrides] = useState<ManualOverrides>({});
  const [source, setSource] = useState<MetricSource>("browser");

  // Poll local backend for real metrics
  useEffect(() => {
    let active = true;
    const poll = async () => {
      const data = await fetchSystemMetrics();
      if (!active) return;
      setRealMetrics(data);
      if (data) setSource("local");
      else if (Object.keys(overrides).length > 0) setSource("override");
      else setSource("browser");
    };
    poll();
    const interval = setInterval(() => { poll(); setHeapUsage(getJSHeapUsage()); }, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [overrides]);

  const handleSaveOverrides = () => {
    const cleaned: ManualOverrides = {};
    if (editOverrides.cpuName?.trim()) cleaned.cpuName = editOverrides.cpuName.trim();
    if (editOverrides.ramTotalGB && editOverrides.ramTotalGB > 0) cleaned.ramTotalGB = editOverrides.ramTotalGB;
    if (editOverrides.gpuName?.trim()) cleaned.gpuName = editOverrides.gpuName.trim();
    if (editOverrides.vramMB && editOverrides.vramMB > 0) cleaned.vramMB = editOverrides.vramMB;
    setOverrides(cleaned);
    saveOverrides(cleaned);
    setShowSettings(false);
  };

  const handleClearOverrides = () => { setOverrides({}); setEditOverrides({}); saveOverrides({}); };

  // Resolved values: local > override > browser
  const cpuName = realMetrics?.cpu.name || overrides.cpuName || null;
  const cpuCores = realMetrics?.cpu.threads || browserInfo.cpuCores;
  const cpuUsage = realMetrics?.cpu.usage_percent ?? null;
  const cpuTemp = realMetrics?.cpu.temperature_c ?? null;

  const ramTotalGB = realMetrics?.ram.total_gb || overrides.ramTotalGB || browserInfo.deviceMemoryGB;
  const ramUsedGB = realMetrics?.ram.used_gb ?? null;
  const ramPercent = realMetrics?.ram.usage_percent ?? (ramUsedGB !== null && ramTotalGB ? (ramUsedGB / ramTotalGB) * 100 : null);

  const gpuName = realMetrics?.gpu?.name || overrides.gpuName || browserInfo.gpu;
  const vramTotalMB = realMetrics?.gpu?.vram_total_mb || overrides.vramMB || browserInfo.vramMB;
  const vramUsedMB = realMetrics?.gpu?.vram_used_mb ?? null;
  const gpuUsage = realMetrics?.gpu?.gpu_usage_percent ?? null;
  const gpuTemp = realMetrics?.gpu?.temperature_c ?? null;

  const gpuShort = gpuName ? gpuName.replace(/ANGLE \(/, "").replace(/\)$/, "").split(",")[0].trim() : "N/A";

  const isLive = source === "local";
  const sourceLabel = isLive ? "⚡ Live" : source === "override" ? "✏ Override" : "🌐 Browser";
  const sourceColor = isLive ? "text-primary" : source === "override" ? "text-terminal-amber" : "text-muted-foreground";

  // Top-bar compact usage indicators
  const cpuPctDisplay = cpuUsage !== null ? Math.round(cpuUsage) : null;
  const ramPctDisplay = ramPercent !== null ? Math.round(ramPercent) : null;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        {/* CPU */}
        <span className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-terminal-cyan" />
          <span className={cpuPctDisplay !== null ? usageTextClass(cpuPctDisplay) : "text-terminal-cyan"}>
            {cpuPctDisplay !== null ? `${cpuPctDisplay}%` : `${cpuCores}C`}
          </span>
        </span>
        {/* RAM */}
        <span className="flex items-center gap-1">
          <MemoryStick className="w-3 h-3 text-terminal-amber" />
          <span className={ramPctDisplay !== null ? usageTextClass(ramPctDisplay) : "text-terminal-amber"}>
            {ramUsedGB !== null && ramTotalGB ? `${ramUsedGB.toFixed(1)}/${ramTotalGB}GB` : ramTotalGB ? `${ramTotalGB}GB` : "N/A"}
          </span>
        </span>
        {/* VRAM */}
        {vramTotalMB && (
          <span className="flex items-center gap-1">
            <MonitorSpeaker className="w-3 h-3 text-terminal-magenta" />
            <span className="text-terminal-magenta">
              {vramUsedMB !== null ? `${(vramUsedMB / 1024).toFixed(1)}/${(vramTotalMB / 1024).toFixed(0)}GB` : `${(vramTotalMB / 1024).toFixed(0)}GB`}
            </span>
          </span>
        )}
        {/* GPU Temp in top bar when live */}
        {gpuTemp !== null && (
          <span className={`flex items-center gap-0.5 ${tempTextClass(gpuTemp)}`}>
            <Thermometer className="w-3 h-3" />
            {gpuTemp}°C
          </span>
        )}
      </button>

      {expanded && (
        <div className="absolute top-8 right-0 w-80 border border-border bg-card rounded p-3 z-30 shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] uppercase tracking-widest text-primary font-mono">System</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-mono ${sourceColor}`}>{sourceLabel}</span>
              <button onClick={() => { setEditOverrides(overrides); setShowSettings(!showSettings); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <Settings className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="mb-3 p-2.5 border border-border rounded bg-muted/30 space-y-2">
              <div className="text-[9px] uppercase tracking-widest text-terminal-amber font-mono mb-1">Manual Overrides</div>
              <div>
                <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-0.5">CPU Name</label>
                <input value={editOverrides.cpuName || ""} onChange={(e) => setEditOverrides({ ...editOverrides, cpuName: e.target.value })} placeholder="e.g. Intel i7-12700K" className="w-full bg-input border border-border rounded px-2 py-1 text-[10px] text-foreground font-mono focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-0.5">Total RAM (GB)</label>
                <input type="number" value={editOverrides.ramTotalGB || ""} onChange={(e) => setEditOverrides({ ...editOverrides, ramTotalGB: parseFloat(e.target.value) || undefined })} placeholder="e.g. 32" className="w-full bg-input border border-border rounded px-2 py-1 text-[10px] text-foreground font-mono focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-0.5">GPU Name</label>
                <input value={editOverrides.gpuName || ""} onChange={(e) => setEditOverrides({ ...editOverrides, gpuName: e.target.value })} placeholder="e.g. NVIDIA RTX 4070" className="w-full bg-input border border-border rounded px-2 py-1 text-[10px] text-foreground font-mono focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-0.5">VRAM (MB)</label>
                <input type="number" value={editOverrides.vramMB || ""} onChange={(e) => setEditOverrides({ ...editOverrides, vramMB: parseFloat(e.target.value) || undefined })} placeholder="e.g. 12288" className="w-full bg-input border border-border rounded px-2 py-1 text-[10px] text-foreground font-mono focus:outline-none focus:border-primary" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleClearOverrides} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground text-[9px] font-mono uppercase">
                  <RotateCcw className="w-2.5 h-2.5" /> Reset
                </button>
                <button onClick={handleSaveOverrides} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-primary bg-primary/10 text-primary text-[9px] font-mono uppercase">
                  <Save className="w-2.5 h-2.5" /> Save
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* CPU */}
            {cpuUsage !== null ? (
              <div>
                <UsageBar
                  percent={cpuUsage}
                  label={`CPU${cpuName ? ` · ${cpuName}` : ""}`}
                  detail={`${cpuCores} threads`}
                  showTemp={cpuTemp !== null}
                  tempC={cpuTemp}
                />
              </div>
            ) : (
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-terminal-cyan">CPU</span>
                  <span className="text-muted-foreground">{cpuName || `${cpuCores} threads`}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-muted-foreground/20" style={{ width: "0%" }} />
                </div>
                <span className="text-[9px] text-muted-foreground font-mono">No live data</span>
              </div>
            )}

            {/* RAM */}
            {ramPercent !== null && ramTotalGB ? (
              <div>
                <UsageBar
                  percent={ramPercent}
                  label="RAM"
                  detail={ramUsedGB !== null ? `${ramUsedGB.toFixed(1)} / ${ramTotalGB} GB` : `${ramTotalGB} GB total`}
                />
                {heapUsage && (
                  <div className="text-[9px] text-muted-foreground mt-1 font-mono">JS Heap: {heapUsage.usedMB}MB / {heapUsage.totalMB}MB</div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-terminal-amber">RAM</span>
                  <span className="text-muted-foreground">{ramTotalGB ? `${ramTotalGB} GB total` : "Unknown"}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-muted-foreground/20" style={{ width: "0%" }} />
                </div>
                <span className="text-[9px] text-muted-foreground font-mono">No live data</span>
                {heapUsage && (
                  <div className="text-[9px] text-muted-foreground mt-1 font-mono">JS Heap: {heapUsage.usedMB}MB / {heapUsage.totalMB}MB</div>
                )}
              </div>
            )}

            {/* GPU + VRAM */}
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-terminal-magenta">GPU</span>
                <span className="text-muted-foreground">{vramTotalMB ? `VRAM: ${(vramTotalMB / 1024).toFixed(1)} GB` : "VRAM: N/A"}</span>
              </div>
              <p className="text-[10px] text-foreground font-mono break-words mb-1.5">{gpuShort || "Not detected"}</p>

              {/* GPU Usage bar */}
              {gpuUsage !== null && (
                <UsageBar percent={gpuUsage} label="GPU Load" detail={`${Math.round(gpuUsage)}%`} />
              )}

              {/* VRAM Usage bar */}
              {vramUsedMB !== null && vramTotalMB && (
                <div className="mt-2">
                  <UsageBar
                    percent={(vramUsedMB / vramTotalMB) * 100}
                    label="VRAM"
                    detail={`${vramUsedMB}MB / ${vramTotalMB}MB`}
                  />
                </div>
              )}

              {/* GPU Temperature */}
              {gpuTemp !== null && (
                <div className="mt-2 flex items-center gap-2 p-1.5 rounded border border-border bg-muted/30">
                  <Thermometer className={`w-3.5 h-3.5 ${tempTextClass(gpuTemp)}`} />
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] font-mono mb-0.5">
                      <span className={tempTextClass(gpuTemp)}>Temperature</span>
                      <span className={`font-bold ${tempTextClass(gpuTemp)}`}>{gpuTemp}°C</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${Math.min((gpuTemp / 100) * 100, 100)}%`, backgroundColor: tempColor(gpuTemp) }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Fallback when no live GPU data */}
              {gpuUsage === null && vramUsedMB === null && gpuTemp === null && (
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-muted-foreground/20" style={{ width: "0%" }} />
                </div>
              )}
            </div>

            {/* System Details */}
            <div className="pt-2 border-t border-border space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Platform</span>
                <span className="text-foreground">{realMetrics?.platform || browserInfo.platform}</span>
              </div>
              {realMetrics?.hostname && (
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">Hostname</span>
                  <span className="text-foreground">{realMetrics.hostname}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Browser</span>
                <span className="text-foreground">{browserInfo.browser}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Cores / Threads</span>
                <span className="text-foreground">{cpuCores}</span>
              </div>
            </div>

            <div className="pt-1 text-[8px] text-muted-foreground/60 font-mono text-center">
              {source === "local" ? "Live data from local backend" : source === "override" ? "Using manual overrides · ⚙ to edit" : "Browser-limited · ⚙ to set real specs"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemMetrics;
