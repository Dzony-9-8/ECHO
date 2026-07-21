import { motion } from "framer-motion";
import {
  MessageSquare, Wind, Droplets, Sunrise, Sunset, Sun, Thermometer,
} from "lucide-react";
import { type WeatherData, type WeatherDailyEntry } from "@/lib/api";

// ── Weather utilities ──────────────────────────────────────────────────────────

const WX_CODES: Record<number, { label: string; emoji: string; bg: string }> = {
  0:  { label: "Clear skies",    emoji: "☀️",  bg: "from-amber-950/40 to-card" },
  1:  { label: "Mainly clear",   emoji: "🌤️",  bg: "from-sky-950/40 to-card"  },
  2:  { label: "Partly cloudy",  emoji: "⛅",  bg: "from-slate-800/40 to-card" },
  3:  { label: "Overcast",       emoji: "☁️",  bg: "from-slate-900/40 to-card" },
  45: { label: "Foggy",          emoji: "🌫️",  bg: "from-slate-800/40 to-card" },
  48: { label: "Icy fog",        emoji: "🌫️",  bg: "from-slate-800/40 to-card" },
  51: { label: "Light drizzle",  emoji: "🌦️",  bg: "from-blue-950/40 to-card"  },
  61: { label: "Rain",           emoji: "🌧️",  bg: "from-blue-950/50 to-card"  },
  65: { label: "Heavy rain",     emoji: "🌧️",  bg: "from-blue-950/60 to-card"  },
  71: { label: "Light snow",     emoji: "🌨️",  bg: "from-slate-700/40 to-card" },
  75: { label: "Heavy snow",     emoji: "❄️",  bg: "from-slate-600/40 to-card"  },
  80: { label: "Rain showers",   emoji: "🌦️",  bg: "from-blue-950/50 to-card"  },
  95: { label: "Thunderstorm",   emoji: "⛈️",  bg: "from-purple-950/50 to-card" },
  99: { label: "Severe storm",   emoji: "🌩️",  bg: "from-purple-950/60 to-card" },
};

export const getWx = (code: number) => {
  const exact = WX_CODES[code];
  if (exact) return exact;
  const keys = Object.keys(WX_CODES).map(Number).sort((a, b) => a - b);
  for (let i = keys.length - 1; i >= 0; i--) {
    if (code >= keys[i]) return WX_CODES[keys[i]];
  }
  return { label: "Variable", emoji: "🌡️", bg: "from-card to-card" };
};

const dayLabel = (dateStr: string, i: number): string =>
  i === 0
    ? "Today"
    : new Date(dateStr + "T12:00:00").toLocaleDateString("en", { weekday: "short" });

// Wind direction compass
export const windDir = (deg?: number): string => {
  if (deg === undefined || deg === null) return "";
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
};

// UV index label
export const uvLabel = (uv?: number): string => {
  if (!uv) return "Low";
  if (uv < 3)  return "Low";
  if (uv < 6)  return "Moderate";
  if (uv < 8)  return "High";
  if (uv < 11) return "Very High";
  return "Extreme";
};

const uvColor = (uv?: number): string => {
  if (!uv || uv < 3)  return "text-primary";
  if (uv < 6)  return "text-terminal-amber";
  if (uv < 8)  return "text-orange-400";
  return "text-terminal-red";
};

// Temp sparkline — enhanced
const TempSparkline = ({ daily }: { daily: WeatherDailyEntry[] }) => {
  if (daily.length < 2) return null;
  const W = 320, H = 56, px = 14, py = 10;
  const maxT = Math.max(...daily.map(d => d.max));
  const minT = Math.min(...daily.map(d => d.min));
  const rng  = maxT - minT || 1;
  const cx   = (i: number) => px + (i / (daily.length - 1)) * (W - 2 * px);
  const cy   = (t: number) => H - py - ((t - minT) / rng) * (H - 2 * py);

  const maxPts = daily.map((d, i) => `${cx(i).toFixed(1)},${cy(d.max).toFixed(1)}`).join(" L ");
  const minPts = daily.map((d, i) => `${cx(i).toFixed(1)},${cy(d.min).toFixed(1)}`).join(" L ");
  const maxPath = `M ${maxPts}`;
  const minPath = `M ${minPts}`;
  const areaPath = `${maxPath} L ${cx(daily.length-1).toFixed(1)},${cy(daily[daily.length-1].min).toFixed(1)} L ${minPts.split(" L ").reverse().join(" L ")} L ${cx(0).toFixed(1)},${cy(daily[0].max).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="tempAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(142 70% 45%)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="hsl(142 70% 45%)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tempLineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="hsl(142 70% 45%)" />
          <stop offset="50%"  stopColor="hsl(185 60% 50%)" />
          <stop offset="100%" stopColor="hsl(142 70% 45%)" />
        </linearGradient>
      </defs>
      {/* Area fill between max and min */}
      <path d={areaPath} fill="url(#tempAreaGrad)" />
      {/* Max line */}
      <path d={maxPath} fill="none" stroke="url(#tempLineGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Min line */}
      <path d={minPath} fill="none" stroke="hsl(185 60% 50% / 0.4)" strokeWidth="1" strokeDasharray="3 2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Max dots + temp labels */}
      {daily.map((d, i) => (
        <g key={i}>
          <circle cx={cx(i)} cy={cy(d.max)} r="3" fill="hsl(142 70% 45%)" />
          <text x={cx(i)} y={cy(d.max) - 6} textAnchor="middle" fontSize="8" fill="hsl(142 70% 60%)" fontFamily="JetBrains Mono, monospace">
            {d.max}°
          </text>
          <text x={cx(i)} y={cy(d.min) + 13} textAnchor="middle" fontSize="7" fill="hsl(185 60% 50% / 0.6)" fontFamily="JetBrains Mono, monospace">
            {d.min}°
          </text>
        </g>
      ))}
    </svg>
  );
};

// ── Rich Weather Card ─────────────────────────────────────────────────────────

interface WeatherCardProps {
  data: WeatherData;
  onInsert?: (text: string) => void;
}

const WeatherCard = ({ data, onInsert }: WeatherCardProps) => {
  if (data.error) {
    return (
      <div className="p-4 rounded-xl border border-terminal-red/30 bg-terminal-red/5 text-[12px] font-mono text-terminal-red">
        ⚠ {data.error}
      </div>
    );
  }

  const today  = data.daily?.[0];
  const code   = today?.code ?? 0;
  const wx     = getWx(code);
  const temp   = data.temperature != null ? Math.round(data.temperature) : null;
  const feels  = data.feels_like  != null ? Math.round(data.feels_like)  : null;
  const unit   = data.units?.temp ?? "°C";

  const stats = [
    { icon: Droplets,    label: "Humidity",   value: data.humidity   != null ? `${Math.round(data.humidity)}%`    : "—", color: "text-terminal-cyan"    },
    { icon: Wind,        label: "Wind",        value: data.wind_speed != null ? `${Math.round(data.wind_speed)} km/h ${windDir(data.wind_dir)}` : "—", color: "text-primary" },
    { icon: Sun,         label: "UV Index",    value: data.uv_index   != null ? `${data.uv_index} (${uvLabel(data.uv_index)})` : "—", color: uvColor(data.uv_index) },
    { icon: Thermometer, label: "Feels like",  value: feels           != null ? `${feels}${unit}` : "—", color: "text-terminal-amber" },
    { icon: Sunrise,     label: "Sunrise",     value: today?.sunrise  ?? "—",   color: "text-terminal-amber" },
    { icon: Sunset,      label: "Sunset",      value: today?.sunset   ?? "—",   color: "text-terminal-magenta" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">

      {/* ── Hero card ── */}
      <div
        className={`relative rounded-xl border border-terminal-cyan/20 overflow-hidden bg-gradient-to-br ${wx.bg}`}
        style={{ boxShadow: "0 4px 24px hsl(185 60% 50% / 0.1), inset 0 0 40px hsl(185 60% 50% / 0.03)" }}
      >
        {/* Scanline overlay */}
        <div className="absolute inset-0 scanline pointer-events-none opacity-40" />

        <div className="relative p-5 pb-4">
          {/* Location */}
          <div className="flex items-center gap-1.5 mb-4">
            <span className="text-[9px] font-mono text-terminal-cyan uppercase tracking-widest">📍</span>
            <span className="text-[11px] font-mono text-terminal-cyan">{data.location}</span>
          </div>

          {/* Big temp + icon */}
          <div className="flex items-start gap-5 mb-5">
            <span className="text-6xl leading-none float-anim select-none">{wx.emoji}</span>
            <div>
              <div
                className="font-mono font-bold leading-none"
                style={{
                  fontSize: "clamp(2.5rem, 6vw, 4rem)",
                  color: "hsl(var(--foreground))",
                  textShadow: "0 0 20px hsl(142 70% 45% / 0.3)",
                }}
              >
                {temp != null ? `${temp}${unit}` : "—"}
              </div>
              <div className="text-sm font-mono text-terminal-cyan mt-1">{wx.label}</div>
              {feels != null && (
                <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  Feels like {feels}{unit}
                </div>
              )}
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-lg bg-background/40 border border-border/30 backdrop-blur-sm"
              >
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                <span className={`text-[11px] font-mono font-semibold ${s.color}`}>{s.value}</span>
                <span className="text-[8px] font-mono text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 7-day forecast ── */}
      {data.daily && data.daily.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-3">
            7-Day Forecast
          </div>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {data.daily.map((day, i) => {
              const dayWx = getWx(day.code);
              return (
                <div
                  key={day.date}
                  className={`flex flex-col items-center gap-1 py-2 px-0.5 rounded-lg text-center transition-all ${
                    i === 0
                      ? "bg-primary/10 border border-primary/25"
                      : "hover:bg-muted/50 border border-transparent hover:border-border/40"
                  }`}
                >
                  <span className={`text-[8px] font-mono leading-tight ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {dayLabel(day.date, i)}
                  </span>
                  <span className="text-sm leading-tight">{dayWx.emoji}</span>
                  <span className="text-[10px] font-mono text-foreground font-semibold">{day.max}°</span>
                  <span className="text-[9px] font-mono text-muted-foreground">{day.min}°</span>
                  {day.precip_prob > 0 && (
                    <span className="text-[7px] font-mono text-terminal-cyan">{day.precip_prob}%</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sparkline */}
          <div className="border-t border-border/40 pt-3">
            <div className="text-[8px] font-mono text-muted-foreground mb-1.5">Temperature trend — high / low</div>
            <TempSparkline daily={data.daily} />
          </div>
        </div>
      )}

      {/* ── Insert button (only when callback provided) ── */}
      {onInsert && (
        <button
          onClick={() => onInsert(
            data.formatted ??
            `Weather in ${data.location}: ${temp}${unit}, ${wx.label}` +
            (feels != null ? `, feels like ${feels}${unit}` : "") +
            (data.humidity != null ? `, ${Math.round(data.humidity)}% humidity` : "") +
            (data.wind_speed != null ? `, wind ${Math.round(data.wind_speed)} km/h` : "")
          )}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-terminal-cyan/40 text-terminal-cyan text-[10px] font-mono hover:bg-terminal-cyan/10 transition-all active:scale-98 group"
        >
          <MessageSquare className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          Insert to Chat
        </button>
      )}
    </motion.div>
  );
};

export default WeatherCard;
