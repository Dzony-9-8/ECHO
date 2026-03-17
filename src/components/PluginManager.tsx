import { useState, useEffect, useCallback } from "react";
import { Puzzle, RefreshCw, ToggleLeft, ToggleRight, Loader2, ChevronDown, ChevronUp, Tag } from "lucide-react";
import { getBackendUrl } from "@/lib/api";
import { toast } from "sonner";

interface Plugin {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  enabled: boolean;
  builtin: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  research: "text-terminal-cyan border-terminal-cyan/30 bg-terminal-cyan/5",
  dev:      "text-primary border-primary/30 bg-primary/5",
  rag:      "text-terminal-magenta border-terminal-magenta/30 bg-terminal-magenta/5",
  io:       "text-terminal-amber border-terminal-amber/30 bg-terminal-amber/5",
  memory:   "text-accent border-accent/30 bg-accent/5",
  quality:  "text-terminal-cyan border-terminal-cyan/30 bg-terminal-cyan/5",
  ops:      "text-primary border-primary/30 bg-primary/5",
  viz:      "text-terminal-magenta border-terminal-magenta/30 bg-terminal-magenta/5",
};

const CATEGORY_ORDER = ["dev", "research", "rag", "memory", "io", "quality", "ops", "viz"];

const PluginCard = ({
  plugin,
  onToggle,
}: {
  plugin: Plugin;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
}) => {
  const [toggling, setToggling] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const colorClass = CATEGORY_COLORS[plugin.category] ?? "text-muted-foreground border-border bg-muted/5";

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggle(plugin.id, !plugin.enabled);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className={`border rounded-md transition-all ${plugin.enabled ? "border-border" : "border-border/40 opacity-60"} bg-card`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="text-xl flex-shrink-0 leading-none">{plugin.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-foreground font-medium">{plugin.name}</span>
            <span className={`text-[7px] uppercase font-mono border px-1 py-0.5 rounded ${colorClass}`}>
              {plugin.category}
            </span>
            {plugin.builtin && (
              <span className="text-[7px] uppercase font-mono border border-border text-muted-foreground px-1 py-0.5 rounded">
                built-in
              </span>
            )}
          </div>
          <p className="text-[9px] text-muted-foreground font-mono mt-0.5 leading-snug truncate">{plugin.description}</p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative transition-all ${toggling ? "opacity-50" : ""}`}
            title={plugin.enabled ? "Disable plugin" : "Enable plugin"}
          >
            {toggling ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : plugin.enabled ? (
              <ToggleRight className="w-6 h-6 text-primary" style={{ filter: "drop-shadow(0 0 4px hsl(142 70% 45% / 0.5))" }} />
            ) : (
              <ToggleLeft className="w-6 h-6 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-2.5 border-t border-border/50 pt-2">
          <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">{plugin.description}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Tag className="w-2.5 h-2.5 text-muted-foreground" />
            <span className={`text-[9px] font-mono ${colorClass.split(" ")[0]}`}>{plugin.category}</span>
            <span className="text-[9px] text-muted-foreground font-mono">• ID: {plugin.id}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded border ${
              plugin.enabled
                ? "text-primary border-primary/30 bg-primary/5"
                : "text-muted-foreground border-border"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${plugin.enabled ? "bg-primary" : "bg-muted-foreground"}`} />
              {plugin.enabled ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const PluginManager = () => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterEnabled, setFilterEnabled] = useState<"all" | "on" | "off">("all");

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${getBackendUrl()}/api/plugins`);
      const data = await resp.json();
      setPlugins(data.plugins ?? []);
    } catch (e: any) {
      toast.error("Failed to load plugins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlugins(); }, [fetchPlugins]);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const resp = await fetch(`${getBackendUrl()}/api/plugins/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plugin_id: id, enabled }),
      });
      if (!resp.ok) throw new Error("Failed");
      setPlugins((prev) =>
        prev.map((p) => p.id === id ? { ...p, enabled } : p)
      );
      toast.success(`${enabled ? "Enabled" : "Disabled"} plugin`);
    } catch {
      toast.error("Failed to toggle plugin");
    }
  };

  const categories = ["all", ...CATEGORY_ORDER.filter((c) => plugins.some((p) => p.category === c))];

  const filtered = plugins.filter((p) => {
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterEnabled === "on" && !p.enabled) return false;
    if (filterEnabled === "off" && p.enabled) return false;
    return true;
  });

  const activeCount = plugins.filter((p) => p.enabled).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Puzzle className="w-4 h-4 text-terminal-magenta" style={{ filter: "drop-shadow(0 0 5px hsl(280 60% 55% / 0.5))" }} />
        <h2 className="text-sm font-mono text-terminal-magenta uppercase tracking-wider">Plugin Manager</h2>
        <span className="ml-2 text-[9px] font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded">
          {activeCount}/{plugins.length} active
        </span>
        <button
          onClick={fetchPlugins}
          disabled={loading}
          className="ml-auto p-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-border space-y-2">
        {/* Category filter */}
        <div className="flex gap-1 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCategory(c)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors capitalize ${
                filterCategory === c
                  ? "border-terminal-magenta text-terminal-magenta bg-terminal-magenta/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Enabled filter */}
        <div className="flex gap-1">
          {(["all", "on", "off"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterEnabled(f)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                filterEnabled === f
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "on" ? "✓ Active" : "○ Inactive"}
            </button>
          ))}
        </div>
      </div>

      {/* Plugin list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-terminal-magenta" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <Puzzle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground font-mono">No plugins match filter</p>
          </div>
        ) : (
          filtered.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} onToggle={handleToggle} />
          ))
        )}
      </div>
    </div>
  );
};

export default PluginManager;
