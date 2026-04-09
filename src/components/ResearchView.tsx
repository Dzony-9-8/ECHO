import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Globe, FileText, ExternalLink, Loader2,
  MessageSquare, ChevronRight, BookOpen, ChevronDown, ChevronUp,
  CloudSun, Shield, Activity, Link, BookMarked,
} from "lucide-react";
import {
  getBackendMode, getBackendUrl,
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
      <Shield className="w-2 h-2" />{pct}%
    </span>
  );
};

const getDomain = (url: string): string => {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return url; }
};

type ResearchTab = "web" | "deep" | "url" | "wikipedia" | "weather";

// ── Wikipedia result type ─────────────────────────────────────────────────────

interface WikiResult {
  title: string;
  snippet: string;
  extract: string;
  url: string;
}

// ── Main component ────────────────────────────────────────────────────────────

const ResearchView = () => {
  const mode = getBackendMode();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ResearchTab>("web");

  // Web search
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<WebSearchResult[]>([]);
  const [summary, setSummary] = useState("");
  const [selectedResult, setSelectedResult] = useState<WebSearchResult | null>(null);
  const [scrape, setScrape] = useState(true);

  // Deep research
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepReport, setDeepReport] = useState("");
  const [deepLog, setDeepLog] = useState<DeepResearchLog[]>([]);
  const [deepSources, setDeepSources] = useState<string[]>([]);
  const [depth, setDepth] = useState(2);
  const [breadth, setBreadth] = useState(3);
  const [logExpanded, setLogExpanded] = useState(false);

  // URL reader
  const [urlInput, setUrlInput] = useState("https://");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlResult, setUrlResult] = useState<{ text: string; chars: number; truncated: boolean } | null>(null);

  // Wikipedia
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiResults, setWikiResults] = useState<WikiResult[]>([]);
  const [selectedWiki, setSelectedWiki] = useState<WikiResult | null>(null);

  // Weather
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (mode !== "local") { toast.error("Local mode required"); return; }
    setLoading(true); setResults([]); setSummary(""); setSelectedResult(null);
    try {
      const resp = await webSearch(query.trim(), scrape, 6);
      setResults(resp.results); setSummary(resp.summary);
    } catch { toast.error("Web search failed"); }
    finally { setLoading(false); }
  };

  const handleDeepResearch = async () => {
    if (!query.trim()) return;
    if (mode !== "local") { toast.error("Local mode required"); return; }
    setDeepLoading(true); setDeepReport(""); setDeepLog([]); setDeepSources([]);
    try {
      const resp = await deepResearch(query.trim(), depth, breadth);
      if (!resp) { toast.error("Deep research failed"); return; }
      setDeepReport(resp.report); setDeepLog(resp.log); setDeepSources(resp.sources);
      toast.success(`Found ${resp.findings_count} sources across ${depth} research levels`);
    } catch { toast.error("Deep research error"); }
    finally { setDeepLoading(false); }
  };

  const handleUrlFetch = async () => {
    const target = tab === "url" ? urlInput : query;
    if (!target.trim() || target === "https://") return;
    if (mode !== "local") { toast.error("Local mode required"); return; }
    setUrlLoading(true); setUrlResult(null);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/tools/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      if (!resp.ok) { const e = await resp.json(); throw new Error(e.detail || "Failed"); }
      setUrlResult(await resp.json());
    } catch (e: any) { toast.error(e.message); }
    finally { setUrlLoading(false); }
  };

  const handleWikipedia = async () => {
    if (!query.trim()) return;
    if (mode !== "local") { toast.error("Local mode required"); return; }
    setWikiLoading(true); setWikiResults([]); setSelectedWiki(null);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/tools/wikipedia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), sentences: 6 }),
      });
      if (!resp.ok) throw new Error("Wikipedia search failed");
      const data = await resp.json();
      setWikiResults(data.results || []);
      if (data.results?.length > 0) setSelectedWiki(data.results[0]);
    } catch (e: any) { toast.error(e.message); }
    finally { setWikiLoading(false); }
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

  const handleInsertToChat = (text: string, label: string) => {
    sessionStorage.setItem("echo_pending_prompt", `[${label}: ${query || urlInput}]\n\n${text}`);
    toast.success("Inserted — open Chat to continue");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if (tab === "web")       handleSearch();
    else if (tab === "deep") handleDeepResearch();
    else if (tab === "url")  handleUrlFetch();
    else if (tab === "wikipedia") handleWikipedia();
    else if (tab === "weather")   handleWeather();
  };

  // ── Tab config ──────────────────────────────────────────────────────────────

  type TabCfg = {
    label: string;
    Icon: typeof Globe;
    color: string;
    action: () => void;
    loading: boolean;
    placeholder: string;
    usesUrlInput?: boolean;
  };

  const tabConfig: Record<ResearchTab, TabCfg> = {
    web: {
      label: "Web Search", Icon: Globe, color: "text-terminal-amber",
      action: handleSearch, loading, placeholder: "Search the web…",
    },
    deep: {
      label: "Deep Research", Icon: BookOpen, color: "text-primary",
      action: handleDeepResearch, loading: deepLoading, placeholder: "Research topic in depth…",
    },
    url: {
      label: "URL Reader", Icon: Link, color: "text-terminal-cyan",
      action: handleUrlFetch, loading: urlLoading, placeholder: "Paste any URL to extract content…",
      usesUrlInput: true,
    },
    wikipedia: {
      label: "Wikipedia", Icon: BookMarked, color: "text-terminal-magenta",
      action: handleWikipedia, loading: wikiLoading, placeholder: "Search Wikipedia…",
    },
    weather: {
      label: "Weather", Icon: CloudSun, color: "text-terminal-cyan",
      action: handleWeather, loading: weatherLoading, placeholder: "City name (e.g. Belgrade)…",
    },
  };

  const active = tabConfig[tab];
  const isUrlTab = tab === "url";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ── Left main panel ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Tab bar */}
        <div className="border-b border-border bg-card flex flex-shrink-0 overflow-x-auto">
          {(Object.entries(tabConfig) as [ResearchTab, TabCfg][]).map(([id, cfg]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider transition-all border-b-2 relative whitespace-nowrap flex-shrink-0 ${
                tab === id ? `border-primary ${cfg.color}` : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <cfg.Icon className="w-3 h-3" />
              {cfg.label}
              {tab === id && (
                <div className="absolute bottom-0 left-0 right-0 h-px"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(142 70% 45% / 0.8), transparent)" }} />
              )}
            </button>
          ))}
        </div>

        {/* Search / URL bar */}
        <div className="border-b border-border bg-card p-3 space-y-2 flex-shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              {isUrlTab ? (
                <div className="flex items-center gap-1.5 bg-input border border-border rounded-lg px-2.5 py-1.5 focus-within:border-primary transition-all">
                  <Link className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={handleKey} placeholder="https://example.com/article"
                    className="flex-1 bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none" />
                </div>
              ) : (
                <>
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKey}
                    placeholder={active.placeholder}
                    className="w-full bg-input border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 transition-all" />
                </>
              )}
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
                <select value={depth} onChange={(e) => setDepth(Number(e.target.value))}
                  className="bg-input border border-border rounded px-1 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary">
                  {[1, 2, 3].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span className="text-[9px] font-mono text-muted-foreground">Width</span>
                <select value={breadth} onChange={(e) => setBreadth(Number(e.target.value))}
                  className="bg-input border border-border rounded px-1 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary">
                  {[2, 3, 4, 5].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}

            <button onClick={active.action}
              disabled={active.loading || mode !== "local" || (isUrlTab && (!urlInput || urlInput === "https://"))}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono uppercase disabled:opacity-40 flex items-center gap-1.5 transition-all active:scale-95 ${
                tab === "deep"      ? "border-primary text-primary bg-primary/10 hover:bg-primary/20" :
                tab === "wikipedia" ? "border-terminal-magenta text-terminal-magenta bg-terminal-magenta/10 hover:bg-terminal-magenta/20" :
                tab === "url"       ? "border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10 hover:bg-terminal-cyan/20" :
                tab === "weather"   ? "border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10 hover:bg-terminal-cyan/20" :
                                      "border-terminal-amber text-terminal-amber bg-terminal-amber/10 hover:bg-terminal-amber/20"
              }`}>
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
                const cred = (r as any).credibility as number | undefined;
                return (
                  <motion.button key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }} onClick={() => setSelectedResult(r)}
                    className={`w-full text-left p-3 rounded-xl border transition-all group ${
                      selectedResult === r ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/40"
                    }`}>
                    <div className="flex items-start gap-2.5">
                      <div className="flex-shrink-0 w-5 h-5 rounded bg-muted border border-border/50 flex items-center justify-center mt-0.5">
                        {r.scraped_text ? <FileText className="w-3 h-3 text-terminal-cyan" /> : <Globe className="w-3 h-3 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-mono text-foreground font-medium line-clamp-1 flex-1">{r.title}</span>
                          <CredBadge score={cred} />
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-[9px] text-terminal-cyan font-mono">{domain}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50" />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono line-clamp-2 leading-relaxed">{r.snippet}</p>
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
                    Recursive multi-level research with LLM synthesis.<br />Depth 1 = fast · Depth 3 = thorough
                  </p>
                </div>
              )}
              {deepLoading && (
                <div className="text-center py-14">
                  <div className="relative w-10 h-10 mx-auto mb-3">
                    <BookOpen className="w-10 h-10 text-muted-foreground/20" />
                    <div className="absolute inset-0 rounded-full border border-primary" style={{ animation: "spin-slow 2s linear infinite" }} />
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground">Running deep research — this may take 1–3 minutes…</p>
                </div>
              )}
              {deepReport && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  {deepLog.length > 0 && (
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <button onClick={() => setLogExpanded(!logExpanded)}
                        className="w-full p-2.5 flex items-center gap-2 text-[9px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
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
                                  entry.step === "level" ? "text-primary" : entry.step === "found" ? "text-terminal-cyan" :
                                  entry.step === "synthesize" ? "text-terminal-amber" : "text-muted-foreground"
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
                      <button onClick={() => handleInsertToChat(deepReport, "Deep Research")}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary text-primary text-[9px] font-mono hover:bg-primary/10 transition-all active:scale-95">
                        <MessageSquare className="w-2.5 h-2.5" /> Insert
                      </button>
                    </div>
                    <p className="text-[10px] font-mono text-foreground leading-relaxed whitespace-pre-wrap">{deepReport}</p>
                  </div>
                  {deepSources.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-3">
                      <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Sources ({deepSources.length})</span>
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

          {/* URL Reader */}
          {tab === "url" && (
            <div className="space-y-3">
              {!urlLoading && !urlResult && (
                <div className="text-center py-14">
                  <Link className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Fetch any URL and extract readable text.<br />Works with articles, docs, GitHub, Wikipedia pages.
                  </p>
                </div>
              )}
              {urlLoading && (
                <div className="text-center py-14">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-terminal-cyan" />
                  <p className="text-[11px] font-mono text-muted-foreground">Fetching and extracting content…</p>
                </div>
              )}
              {urlResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {urlResult.chars.toLocaleString()} chars extracted{urlResult.truncated ? " (truncated to 8k)" : ""}
                    </span>
                    <button onClick={() => handleInsertToChat(urlResult.text, "URL Content")}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary text-primary text-[9px] font-mono hover:bg-primary/10 transition-all active:scale-95">
                      <MessageSquare className="w-2.5 h-2.5" /> Insert to Chat
                    </button>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4 max-h-96 overflow-y-auto">
                    <p className="text-[10px] font-mono text-foreground leading-relaxed whitespace-pre-wrap">{urlResult.text}</p>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Wikipedia */}
          {tab === "wikipedia" && (
            <div className="space-y-2">
              {!wikiLoading && wikiResults.length === 0 && (
                <div className="text-center py-14">
                  <BookMarked className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Search Wikipedia for structured encyclopedia articles.<br />Returns summaries and full intro extracts.
                  </p>
                </div>
              )}
              {wikiLoading && (
                <div className="text-center py-14">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-terminal-magenta" />
                  <p className="text-[11px] font-mono text-muted-foreground">Searching Wikipedia…</p>
                </div>
              )}
              {wikiResults.map((r, i) => (
                <motion.button key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }} onClick={() => setSelectedWiki(r)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedWiki === r ? "border-terminal-magenta bg-terminal-magenta/5" : "border-border/60 bg-card hover:border-terminal-magenta/40"
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-mono font-medium text-foreground mb-0.5">{r.title}</div>
                      <p className="text-[9px] font-mono text-muted-foreground line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: r.snippet + "…" }} />
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </motion.button>
              ))}
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
                <WeatherCard data={weatherData} onInsert={(text) => handleInsertToChat(text, "Weather")} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-80 border-l border-border bg-sidebar flex flex-col">

        {/* Web — AI summary + selected result */}
        {tab === "web" && (
          <>
            {summary ? (
              <>
                <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
                  <span className="text-[10px] uppercase tracking-widest text-primary font-display">AI Summary</span>
                  <button onClick={() => handleInsertToChat(summary, "Web Research")}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-primary text-primary text-[9px] font-mono hover:bg-primary/10 transition-all active:scale-95">
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
                  <ExternalLink className="w-2.5 h-2.5" />{getDomain(selectedResult.url)}
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

        {/* Deep research info */}
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

        {/* URL reader — stats */}
        {tab === "url" && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center space-y-2">
              <Link className="w-8 h-8 mx-auto text-muted-foreground/20" />
              <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                Uses trafilatura to extract<br />clean article text from any URL.<br /><br />
                <span className="text-terminal-cyan">Max 8,000 chars</span><br />
                Insert to Chat → ask ECHO<br />to summarize or analyze it.
              </p>
            </div>
          </div>
        )}

        {/* Wikipedia — selected article extract */}
        {tab === "wikipedia" && (
          selectedWiki ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
                <span className="text-[10px] font-mono text-terminal-magenta font-medium truncate">{selectedWiki.title}</span>
                <button onClick={() => handleInsertToChat(selectedWiki.extract || selectedWiki.snippet, `Wikipedia: ${selectedWiki.title}`)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-terminal-magenta text-terminal-magenta text-[9px] font-mono hover:bg-terminal-magenta/10 transition-all flex-shrink-0 ml-2 active:scale-95">
                  <MessageSquare className="w-2.5 h-2.5" /> Insert
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <p className="text-[10px] font-mono text-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedWiki.extract || selectedWiki.snippet}
                </p>
                <a href={selectedWiki.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] text-terminal-cyan font-mono hover:underline">
                  <ExternalLink className="w-2.5 h-2.5" /> Read full article
                </a>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center space-y-2">
                <BookMarked className="w-8 h-8 mx-auto text-muted-foreground/20" />
                <p className="text-[10px] font-mono text-muted-foreground">Select an article to read its intro extract</p>
              </div>
            </div>
          )
        )}

        {/* Weather info */}
        {tab === "weather" && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center space-y-2">
              <CloudSun className="w-8 h-8 mx-auto text-muted-foreground/20 float-anim" />
              <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                Powered by Open-Meteo<br />
                <span className="text-primary">Free · No API key · Accurate</span><br /><br />
                Enter any city name<br />to get real-time weather,<br />7-day forecast, and more.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchView;
