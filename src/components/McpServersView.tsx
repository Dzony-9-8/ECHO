import { useState } from "react";
import { Plug, Plus, Trash2, Pencil, X, Check, Copy, Radio, Loader2, Terminal, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  type McpServer,
  type Transport,
  type ProbeResult,
  loadServers,
  saveServers,
  upsertServer,
  deleteServer,
  blankServer,
  toMcpConfig,
  probeServer,
} from "@/lib/mcpServers";

/** The backend couldn't be asked at all — distinct from a real "unreachable" answer. */
interface CantCheck { cantCheck: true; error: string }

const TRANSPORTS: { id: Transport; label: string; icon: typeof Terminal }[] = [
  { id: "stdio", label: "stdio (command)", icon: Terminal },
  { id: "http", label: "HTTP", icon: Globe },
  { id: "sse", label: "SSE", icon: Radio },
];

const McpServersView = () => {
  const [servers, setServers] = useState<McpServer[]>(() => loadServers());
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [probing, setProbing] = useState<string | null>(null);
  // A probe is either a real result from the backend, or "couldn't even ask"
  // (backend offline) — kept as a distinct case so we never imply a real answer.
  const [probeResults, setProbeResults] = useState<Record<string, ProbeResult | CantCheck>>({});

  const toggleEnabled = (id: string) => {
    const next = servers.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    saveServers(next);
    setServers(next);
  };

  const save = () => {
    if (!editing || !editing.name.trim()) return;
    setServers(upsertServer({ ...editing, name: editing.name.trim() }));
    setEditing(null);
  };

  const remove = (id: string) => setServers(deleteServer(id));

  const probe = async (s: McpServer) => {
    if (!s.url) return;
    setProbing(s.id);
    try {
      const res = await probeServer(s.url);
      setProbeResults((r) => ({ ...r, [s.id]: res }));
    } catch (e) {
      // Backend unreachable — degrade honestly, don't fake a result.
      setProbeResults((r) => ({ ...r, [s.id]: { cantCheck: true, error: e instanceof Error ? e.message : "backend offline" } }));
    } finally {
      setProbing(null);
    }
  };

  const copyConfig = () => {
    const json = JSON.stringify(toMcpConfig(servers), null, 2);
    navigator.clipboard?.writeText(json).then(
      () => toast.success("mcpServers config copied to clipboard."),
      () => toast.error("Clipboard unavailable."),
    );
  };

  const renderProbe = (s: McpServer) => {
    const r = probeResults[s.id];
    if (probing === s.id) return <span className="text-terminal-cyan flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> probing…</span>;
    if (!r) return null;
    if ("cantCheck" in r)
      return <span className="text-terminal-amber">● can't check — {r.error}</span>;
    if (r.reachable)
      return <span className="text-primary">● reachable · {r.status} · {r.latency_ms}ms</span>;
    return <span className="text-terminal-red">● unreachable ({r.error})</span>;
  };

  const enabledCount = servers.filter((s) => s.enabled).length;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Plug className="w-5 h-5 text-terminal-magenta" style={{ filter: "drop-shadow(0 0 6px hsl(280 60% 55% / 0.6))" }} />
          <div>
            <h1 className="text-lg font-display tracking-wider text-foreground">MCP Servers</h1>
            <p className="text-[10px] font-mono text-muted-foreground">
              {servers.length} configured · {enabledCount} enabled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyConfig}
            disabled={servers.length === 0}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2.5 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
          >
            <Copy className="w-3 h-3" /> Copy JSON
          </button>
          <button
            onClick={() => setEditing(blankServer())}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2.5 py-1.5 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add server
          </button>
        </div>
      </div>

      {/* Honesty banner about scope */}
      <div className="mb-4 px-3 py-2 rounded-lg border border-border bg-muted/20 text-[10px] font-mono text-muted-foreground leading-relaxed">
        This is a configuration registry. ECHO stores these definitions and can probe HTTP/SSE endpoints for reachability, but it does <span className="text-terminal-amber">not launch stdio processes</span> — copy the JSON into an MCP-enabled client to run them.
      </div>

      {/* List */}
      {servers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground/60 font-mono text-xs">
          <Plug className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No MCP servers configured. Add one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map((s) => {
            const Icon = TRANSPORTS.find((t) => t.id === s.transport)?.icon ?? Terminal;
            return (
              <div key={s.id} className={`rounded-lg border px-3 py-2.5 transition-all ${s.enabled ? "border-border bg-card/40" : "border-border/40 opacity-50"}`}>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => toggleEnabled(s.id)}
                    title={s.enabled ? "Disable" : "Enable"}
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: s.enabled ? "hsl(142 70% 45%)" : "hsl(0 0% 40%)", boxShadow: s.enabled ? "0 0 6px hsl(142 70% 45%)" : "none" }}
                  />
                  <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-mono text-foreground truncate flex-1">{s.name || <span className="text-muted-foreground/50 italic">unnamed</span>}</span>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 rounded border border-border">{s.transport}</span>
                  {(s.transport === "http" || s.transport === "sse") && (
                    <button onClick={() => probe(s)} disabled={!s.url || probing === s.id} title="Check reachability" className="p-1 rounded text-muted-foreground hover:text-terminal-cyan transition-colors disabled:opacity-30">
                      <Radio className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => setEditing({ ...s })} title="Edit" className="p-1 text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(s.id)} title="Remove" className="p-1 text-muted-foreground hover:text-terminal-red transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <div className="pl-[22px] mt-1 flex items-center gap-3 text-[10px] font-mono text-muted-foreground/70">
                  <span className="truncate">
                    {s.transport === "stdio" ? `${s.command || "—"} ${s.args || ""}`.trim() : (s.url || "—")}
                  </span>
                  <span className="flex-shrink-0">{renderProbe(s)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-display tracking-wide text-foreground">
                {loadServers().some((s) => s.id === editing.id) ? "Edit MCP server" : "New MCP server"}
              </h2>
              <button onClick={() => setEditing(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">Name</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. filesystem"
                  className="w-full mt-1 bg-input border border-border rounded px-2.5 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">Transport</label>
                <div className="flex gap-1.5 mt-1">
                  {TRANSPORTS.map((t) => (
                    <button key={t.id} onClick={() => setEditing({ ...editing, transport: t.id })}
                      className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-mono px-2 py-1.5 rounded border transition-colors ${editing.transport === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      <t.icon className="w-3 h-3" /> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {editing.transport === "stdio" ? (
                <>
                  <div>
                    <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">Command</label>
                    <input value={editing.command ?? ""} onChange={(e) => setEditing({ ...editing, command: e.target.value })} placeholder="e.g. npx"
                      className="w-full mt-1 bg-input border border-border rounded px-2.5 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">Arguments</label>
                    <input value={editing.args ?? ""} onChange={(e) => setEditing({ ...editing, args: e.target.value })} placeholder="-y @modelcontextprotocol/server-filesystem /path"
                      className="w-full mt-1 bg-input border border-border rounded px-2.5 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary" />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">URL</label>
                  <input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://host:port/sse"
                    className="w-full mt-1 bg-input border border-border rounded px-2.5 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary" />
                </div>
              )}
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">Env (KEY=value per line, optional)</label>
                <textarea value={editing.env ?? ""} onChange={(e) => setEditing({ ...editing, env: e.target.value })} placeholder="API_KEY=…" rows={2}
                  className="w-full mt-1 bg-input border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={save} disabled={!editing.name.trim()} className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest px-4 py-1.5 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30">
                <Check className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default McpServersView;
