import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Globe, FileText, ExternalLink, Loader2,
  MessageSquare, ChevronRight, BookOpen, ChevronDown, ChevronUp,
  CloudSun, Shield, Activity,
} from "lucide-react";
import {
  getBackendMode,
  webSearch, type WebSearchResult,
  deepResearch, type DeepResearchLog,
  fetchWeather, type WeatherData,
} from "@/lib/api";
import { toast } from "sonner";
import WeatherCard from "@/components/WeatherCard";

// ── Credibility badge ─────────────────────────────────────────────────────────

const CredBadge = ({ score }: { score?: number }) => {
  if (score === undefined || score === null) return null;
  const pct = Math.round(score * 100);
  const color =
    pct >= 85 ? "text-primary border-primary/40 bg-primary/10" :
    pct >= 60 ? "text-terminal-amber border-terminal-amber/40 bg-terminal-amber/10" :
                "text-muted-foreground border-border bg-muted/30";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[8px] font-mono border rounded px-1 py-0.5 ${color}`}>
      <Shield className="w-2 h-2" />
      {pct}%
    </span>
  );
};

// ── Domain extraction ─────────────────────────────────────────────────────────

const getDomain = (url: string): string => {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return url; }
};

// ── Types ─────────────────────────────────────────────────────────────────────

type ResearchTab = "web" | "deep" | "weather";

// ── Main component ────────────────────────────────────────────────────────────

const ResearchView = () => {
  const mode = getBackendMode();

  const [query, setQuery]               = useState("");
  const [tab, setTab]                   = useState<ResearchTab>("web");

  // Web search
  const [loading, setLoading]           = useState(false);
  const [results, setResults]           = useState<WebSearchResult[]>([]);
  const [summary, setSummary]           = useState("");
  const [selectedResult, setSelectedResult] = useState<WebSearchResult | null>(null);
  const [scrape, setScrape]             = useState(true);

  // Deep research
  const [deepLoading, setDeepLoading]   = useState(false);
  const [deepReport, setDeepReport]     = useState("");
  const [deepLog, setDeepLog]           = useState<DeepResearchLog[]>([]);
  const [deepSources, setDeepSources]   = useState<string[]>([]);
  const [depth, setDepth]               = useState(2);
  const [breadth, setBreadth]           = useState(3);
  const [logExpanded, setLogExpanded]   = useState(false);

  // Weather
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherData, setWeatherData]   = useState<WeatherData | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (mode !== "local") { toast.error("Local mode required"); return; }
    setLoading(true); setResults([]); setSummary(""); setSelectedResult(null);
    try {
      const resp = await webSearch(query.trim(), scrape, 6);
      setResults(resp.results);
      setSummary(resp.summary);
    } catch { toast.error("Web search failed"); }
    finally { setLoading(false); }
  };

  const handleInsertToChat = (text: string, label: string) => {
    sessionStorage.setItem("echo_pending_prompt", `[${label}: ${query}]\n\n${text}`);
    toast.success("Inserted — open Chat to continue");
  };

  const handleDeepResearch = async () => {
    if (!query.trim()) return;
    if (mode !== "local") { toast.error("Local mode required"); return; }
    setDeepLoading(true); setDeepReport(""); setDeepLog([]); setDeepSources([]);
    try {
      const resp = await deepResearch(query.trim(), depth, breadth);
      if (!resp) { toast.error("Deep research failed"); return; }
      setDeepReport(resp.report);
      setDeepLog(resp.log);
      setDeepSources(resp.sources);
      toast.success(`Found ${resp.findings_count} sources across ${depth} research levels`);
    } catch { toast.error("Deep research error"); }
    finally { setDeepLoading(false); }
  };

  const handleWeather = async () => {
    if (!query.trim()) return;
    if (mode !== "local") { toast.error("Local mode required"); return; }
    setWeatherLoading(true); setWeatherData(null);
    try {
      const resp = await fetchWeather(query.trim());
      setWeatherData(resp);
    } catch { toast.error("Weather lookup failed"); }
    finally { setWeatherLoading(false); }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if (tab === "web")     handleSearch();
    else if (tab === "deep")    handleDeepResearch();
    else if (tab === "weather") handleWeather();
  };

  // ── Tab config ───────────────────────────────────────────────────────────────

  const tabConfig = {
    web:     { label: "Web Search",    Icon: Globe,    color: "text-terminal-amber", action: handleSearch,       loading,         placeholder: "Search the web…" },
    deep:    { label: "Deep Research", Icon: BookOpen, color: "text-primary",        action: handleDeepResearch, loading: deepLoading, placeholder: "Research topic in depth…" },
    weather: { label: "Weather",       Icon: CloudSun, color: "text-terminal-cyan",  action: handleWeather,      loading: weatherLoading, placeholder: "City name (e.g. Belgrade)…" },
  };
  const active = tabConfig[tab];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ── Left main panel ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Tab bar */}
        <div className="border-b border-border bg-card flex flex-shrink-0">
          {(Object.entries(tabConfig) as [ResearchTab, typeof active][]).map(([id, cfg]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider transition-all border-b-2 relative ${
                tab === id
                  ? `border-primary ${cfg.color}`
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <cfg.Icon className="w-3 h-3" />
              {cfg.label}
              {tab === id && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-px"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(142 70% 45% / 0.8), transparent)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="border-b border-border bg-card p-3 space-y-2 flex-shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder={active.placeholder}
                className="w-full bg-input border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 transition-all"
              />
            </div>

            {tab === "web" && (
              <label className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={scrape} onChange={(e) => setScrape(e.target.checked)} className="w-3 h-3 accent-primary" />
                Scrape
              </label>
            )}

            {tab === "deep" && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-muted-foreground">Depth</span>
                <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="bg-input border border-border rounded px-1 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary">
                  {[1, 2, 3].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span className="text-[9px] font-mono text-muted-foreground">Width</span>
                <select value={breadth} onChange={(e) => setBreadth(Number(e.target.value))} className="bg-input border border-border rounded px-1 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary">
                  {[2, 3, 4, 5].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}

            <button
              onClick={active.action}
              disabled={active.loading || mode !== "local"}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono uppercase disabled:opacity-40 flex items-center gap-1.5 transition-all active:scale-95 ${
                tab === "deep"    ? "border-primary text-primary bg-primary/10 hover:bg-primary/20" :
                tab === "weather" ? "border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10 hover:bg-terminal-cyan/20" :
                                    "border-terminal-amber text-terminal-amber bg-terminal-amber/10 hover:bg-terminal-amber/20"
              }`}
            >
              {active.loading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <active.Icon className="w-3 h-3" />
              }
              {active.loading ? "Running…" : active.label.split(" ")[0]}
            </button>
          </div>

          {mode !== "local" && (
            <p className="text-[9px] font-mono text-muted-foreground">Switch to Local Mode to enable research tools.</p>
          )}
        </div>

        {/* ── Content area ── */}
        <div className="flex-1 overflow-y-auto p-3">

          {/* Web search results */}
          {tab === "web" && (
            <div className="space-y-2">
              {!loading && results.length === 0 && (
                <div className="text-center py-14">
                  <Globe className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-[11px] font-mono text-muted-foreground">Search the web and get AI-summarized results.</p>
                </div>
              )}
              {results.map((r, i) => {
                const domain = getDomain(r.url);
                const cred   = (r as any).credibility as number | undefined;
                return (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelectedResult(r)}
                    className={`w-full text-left p-3 rounded-xl border transition-all group ${
                      selectedResult === r
                        ? "border-primary bg-primary/5"
                        : "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/3"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Favicon placeholder */}
                      <div className="flex-shrink-0 w-5 h-5 rounded bg-muted border border-border/50 flex items-center justify-center mt-0.5">
                        {r.scraped_text
                          ? <FileText className="w-3 h-3 text-terminal-cyan" />
                          : <Globe className="w-3 h-3 text-muted-foreground" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-mono text-foreground font-medium line-clamp-1 flex-1">
                            {r.title}
                          </span>
                          <CredBadge score={cred} />
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-[9px] text-terminal-cyan font-mono">{domain}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50" />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono line-clamp-2 leading-relaxed">
                          {r.snippet}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Deep research */}
          {tab === "deep" && (
            <div className="space-y-3">
              {!deepLoading && !deepReport && (
                <div className="text-center py-14">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Recursive multi-level research with LLM synthesis.<br />
                    Depth 1 = fast · Depth 3 = thorough
                  </p>
                </div>
              )}
              {deepLoading && (
                <div className="text-center py-14">
                  <div className="relative w-10 h-10 mx-auto mb-3">
                    <BookOpen className="w-10 h-10 text-muted-foreground/20" />
                    <div
                      className="absolute inset-0 rounded-full border border-primary"
                      style={{ animation: "spin-slow 2s linear infinite" }}
                    />
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Running deep research — this may take 1–3 minutes…
                  </p>
                </div>
              )}
              {deepReport && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  {deepLog.length > 0 && (
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <button
                        onClick={() => setLogExpanded(!logExpanded)}
                        className="w-full p-2.5 flex items-center gap-2 text-[9px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                      >
                        <Activity className="w-3 h-3" />
                        Research Log ({deepLog.length} steps)
                        {logExpanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                      </button>
                      <AnimatePresence>
                        {logExpanded && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="px-3 pb-3 space-y-1 max-h-48 overflow-y-auto">
                              {deepLog.map((entry, i) => (
                                <div key={i} className={`text-[9px] font-mono flex gap-2 ${
                                  entry.step === "level"     ? "text-primary" :
                                  entry.step === "found"     ? "text-terminal-cyan" :
                                  entry.step === "synthesize"? "text-terminal-amber" :
                                  "text-muted-foreground"
                                }`}>
                                  <span className="opacity-40">[{entry.step}]</span>
                                  <span>{entry.message}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono text-primary uppercase tracking-wider">Research Report</span>
                      <button
                        onClick={() => handleInsertToChat(deepReport, "Deep Research")}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary text-primary text-[9px] font-mono hover:bg-primary/10 transition-all active:scale-95"
                      >
                        <MessageSquare className="w-2.5 h-2.5" /> Insert
                      </button>
                    </div>
                    <p className="text-[10px] font-mono text-foreground leading-relaxed whitespace-pre-wrap">{deepReport}</p>
                  </div>

                  {deepSources.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-3">
                      <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                        Sources ({deepSources.length})
                      </span>
                      <div className="mt-2 space-y-1">
                        {deepSources.map((src, i) => (
                          <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[9px] text-terminal-cyan font-mono hover:underline truncate group">
                            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                            {src}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}

          {/* Weather */}
          {tab === "weather" && (
            <div>
              {!weatherLoading && !weatherData && (
                <div className="text-center py-14">
                  <CloudSun className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20 float-anim" />
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Real-time weather via Open-Meteo API.<br />No API key required.
                  </p>
                </div>
              )}
              {weatherLoading && (
                <div className="text-center py-14">
                  <CloudSun className="w-10 h-10 mx-auto mb-3 text-terminal-cyan spin-slow" />
                  <p className="text-[11px] font-mono text-muted-foreground">Fetching weather data…</p>
                </div>
              )}
              {weatherData && !weatherLoading && (
                <WeatherCard
                  data={weatherData}
                  onInsert={(text) => handleInsertToChat(text, "Weather")}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-80 border-l border-border bg-sidebar flex flex-col">
        {tab === "web" && (
          <>
            {summary ? (
              <>
                <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
                  <span className="text-[10px] uppercase tracking-widest text-primary font-display">AI Summary</span>
                  <button
                    onClick={() => handleInsertToChat(summary, "Web Research")}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-primary text-primary text-[9px] font-mono hover:bg-primary/10 transition-all active:scale-95"
                  >
                    <MessageSquare className="w-2.5 h-2.5" /> Insert
                  </button>
                </div>
                <div className="p-3 border-b border-border max-h-48 overflow-y-auto flex-shrink-0">
                  <p className="text-[10px] font-mono text-foreground leading-relaxed">{summary}</p>
                </div>
              </>
            ) : (
              <div className="p-3 border-b border-border flex-shrink-0">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-display">
                  {loading ? "Researching…" : "Summary"}
                </span>
              </div>
            )}
            {selectedResult ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="text-[10px] font-mono text-foreground font-medium leading-snug">{selectedResult.title}</div>
                <a href={selectedResult.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] text-terminal-cyan font-mono hover:underline">
                  <ExternalLink className="w-2.5 h-2.5" />
                  {getDomain(selectedResult.url)}
                </a>
                <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
                  {selectedResult.scraped_text || selectedResult.snippet}
                </p>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[10px] font-mono text-muted-foreground text-center px-4">
                  {results.length > 0 ? "Select a result to view details" : "Search results will appear here"}
                </p>
              </div>
            )}
          </>
        )}

        {tab === "deep" && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/20" />
              <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                Deep research runs recursively:<br />
                <span className="text-primary">1.</span> Plan sub-questions<br />
                <span className="text-terminal-cyan">2.</span> Search + scrape each<br />
                <span className="text-terminal-amber">3.</span> Analyze gaps → follow-up<br />
                <span className="text-terminal-magenta">4.</span> Synthesize final report
              </p>
            </div>
          </div>
        )}

        {tab === "weather" && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center space-y-2">
              <CloudSun className="w-8 h-8 mx-auto text-muted-foreground/20 float-anim" />
              <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                Powered by Open-Meteo<br />
                <span className="text-primary">Free · No API key · Accurate</span><br /><br />
                Enter any city name<br />
                to get real-time weather,<br />
                7-day forecast, and more.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchView;
