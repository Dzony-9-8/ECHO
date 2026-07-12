import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import {
  SlidersHorizontal, TerminalSquare, Database, Plus, Trash2, Play, Pencil,
  Check, X, Download, Upload,
} from "lucide-react";
import { fetchLocalModels } from "@/lib/api";
import { toast } from "sonner";
import {
  type Preset, loadPresets, upsertPreset, deletePreset, applyPreset,
} from "@/lib/presets";
import {
  type CustomSlashCommand, loadCustomSlash, upsertCustomSlash, deleteCustomSlash, normalizeSlashName,
} from "@/lib/slashCommands";

type Tab = "presets" | "slash" | "sessions";

const BUILTIN_SLASH = ["summarize", "translate", "code-review", "explain", "todos", "rewrite", "brainstorm", "security"];

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ── Conversation export/import (Sessions tab) ───────────────────────────────────
const CONVS_KEY = "echo_local_conversations";
const PINNED_KEY = "echo_pinned_conversations";
const MSG_PREFIX = "echo_local_msgs_";

interface SessionBackup {
  version: 1;
  exportedAt: string;
  conversations: unknown;
  pinned: unknown;
  messages: Record<string, unknown>;
}

const buildBackup = (): SessionBackup => {
  const messages: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(MSG_PREFIX)) {
      try { messages[k] = JSON.parse(localStorage.getItem(k) || "null"); } catch { /* skip */ }
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    conversations: JSON.parse(localStorage.getItem(CONVS_KEY) || "[]"),
    pinned: JSON.parse(localStorage.getItem(PINNED_KEY) || "[]"),
    messages,
  };
};

const conversationCount = (): number => {
  try { return (JSON.parse(localStorage.getItem(CONVS_KEY) || "[]") as unknown[]).length; }
  catch { return 0; }
};

const PresetsView = () => {
  const [tab, setTab] = useState<Tab>("presets");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [customCmds, setCustomCmds] = useState<CustomSlashCommand[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [convCount, setConvCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Editors
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [editingCmd, setEditingCmd] = useState<CustomSlashCommand | null>(null);

  useEffect(() => {
    setPresets(loadPresets());
    setCustomCmds(loadCustomSlash());
    setConvCount(conversationCount());
    fetchLocalModels().then((m) => setModels(m.filter((x) => x.type !== "embedding").map((x) => x.name))).catch(() => {});
  }, []);

  // ── Presets ──────────────────────────────────────────────────────────────────
  const startNewPreset = () =>
    setEditingPreset({ id: newId(), name: "", model: "", systemPrompt: "", depth: 1 });

  const savePreset = () => {
    if (!editingPreset) return;
    if (!editingPreset.name.trim()) { toast.error("Give the preset a name"); return; }
    setPresets(upsertPreset({ ...editingPreset, name: editingPreset.name.trim() }));
    setEditingPreset(null);
    toast.success("Preset saved");
  };

  const removePreset = (id: string) => { setPresets(deletePreset(id)); toast.success("Preset deleted"); };

  const apply = (p: Preset) => {
    applyPreset(p);
    toast.success(`Applied "${p.name}" — open Chat to use it`);
  };

  // ── Slash commands ─────────────────────────────────────────────────────────────
  const startNewCmd = () => setEditingCmd({ id: newId(), name: "", prompt: "" });

  const saveCmd = () => {
    if (!editingCmd) return;
    const name = normalizeSlashName(editingCmd.name);
    if (!name) { toast.error("Enter a command name"); return; }
    if (!editingCmd.prompt.trim()) { toast.error("Enter the prompt text"); return; }
    if (BUILTIN_SLASH.includes(name)) { toast.error(`/${name} is a built-in command`); return; }
    setCustomCmds(upsertCustomSlash({ ...editingCmd, name, prompt: editingCmd.prompt }));
    setEditingCmd(null);
    toast.success(`/${name} saved`);
  };

  const removeCmd = (id: string) => { setCustomCmds(deleteCustomSlash(id)); toast.success("Command deleted"); };

  // ── Sessions ───────────────────────────────────────────────────────────────────
  const exportSessions = () => {
    const backup = buildBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echo-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${conversationCount()} conversation(s)`);
  };

  const importSessions = async (file: File) => {
    try {
      const data: SessionBackup = JSON.parse(await file.text());
      if (data.version !== 1 || !Array.isArray(data.conversations)) throw new Error("Unrecognized backup file");

      // Merge conversations by id (imported entries win on conflict).
      const existing: { id: string }[] = JSON.parse(localStorage.getItem(CONVS_KEY) || "[]");
      const incoming = data.conversations as { id: string }[];
      const byId = new Map(existing.map((c) => [c.id, c]));
      for (const c of incoming) byId.set(c.id, c);
      localStorage.setItem(CONVS_KEY, JSON.stringify([...byId.values()]));

      if (Array.isArray(data.pinned)) localStorage.setItem(PINNED_KEY, JSON.stringify(data.pinned));
      for (const [k, v] of Object.entries(data.messages || {})) {
        if (k.startsWith(MSG_PREFIX)) localStorage.setItem(k, JSON.stringify(v));
      }

      setConvCount(conversationCount());
      toast.success(`Imported ${incoming.length} conversation(s) — reload Chat to see them`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof SlidersHorizontal }[] = [
    { id: "presets", label: "Presets", icon: SlidersHorizontal },
    { id: "slash", label: "Slash Commands", icon: TerminalSquare },
    { id: "sessions", label: "Sessions", icon: Database },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header + tabs */}
      <div className="border-b border-border bg-card px-3 pt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-terminal-magenta" />
          <span className="text-xs font-mono text-terminal-magenta uppercase tracking-wider">Presets &amp; Commands</span>
        </div>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border-b-2 transition-all ${
                tab === t.id
                  ? "border-terminal-magenta text-terminal-magenta"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* ── Presets ── */}
        {tab === "presets" && (
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-mono text-muted-foreground">
                Config bundles — model, system prompt, and depth. Apply one, then open Chat.
              </p>
              <button onClick={startNewPreset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-terminal-magenta/50 bg-terminal-magenta/10 text-terminal-magenta text-[10px] font-mono hover:bg-terminal-magenta/20 transition-all">
                <Plus className="w-3.5 h-3.5" /> New preset
              </button>
            </div>

            {editingPreset && (
              <PresetEditor
                preset={editingPreset}
                models={models}
                onChange={setEditingPreset}
                onSave={savePreset}
                onCancel={() => setEditingPreset(null)}
              />
            )}

            {presets.length === 0 && !editingPreset && (
              <div className="text-center text-[11px] font-mono text-muted-foreground/50 py-10">No presets yet.</div>
            )}

            {presets.map((p) => (
              <motion.div key={p.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="border border-border rounded bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-mono font-medium text-foreground">{p.name}</span>
                  <span className="text-[9px] font-mono text-muted-foreground/60 border border-border rounded px-1.5 py-0.5">
                    {p.model ? p.model.split(":")[0] : "current model"}
                  </span>
                  <span className="text-[9px] font-mono text-terminal-amber/70 border border-terminal-amber/30 rounded px-1.5 py-0.5">
                    depth {p.depth}
                  </span>
                  <div className="flex-1" />
                  <button onClick={() => apply(p)} title="Apply preset"
                    className="flex items-center gap-1 text-[10px] font-mono text-primary hover:text-primary/80">
                    <Play className="w-3 h-3" /> Apply
                  </button>
                  <button onClick={() => setEditingPreset(p)} aria-label="Edit preset"
                    className="text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removePreset(p.id)} aria-label="Delete preset"
                    className="text-muted-foreground hover:text-terminal-red"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                {p.systemPrompt && (
                  <p className="mt-2 text-[10px] font-mono text-muted-foreground/70 line-clamp-2 whitespace-pre-wrap">{p.systemPrompt}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Slash commands ── */}
        {tab === "slash" && (
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-mono text-muted-foreground">
                Custom <code>/commands</code> that expand into a prompt in the chat composer.
              </p>
              <button onClick={startNewCmd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-terminal-cyan/50 bg-terminal-cyan/10 text-terminal-cyan text-[10px] font-mono hover:bg-terminal-cyan/20 transition-all">
                <Plus className="w-3.5 h-3.5" /> New command
              </button>
            </div>

            <div className="text-[9px] font-mono text-muted-foreground/50">
              Built-in: {BUILTIN_SLASH.map((s) => `/${s}`).join("  ·  ")}
            </div>

            {editingCmd && (
              <CmdEditor
                cmd={editingCmd}
                onChange={setEditingCmd}
                onSave={saveCmd}
                onCancel={() => setEditingCmd(null)}
              />
            )}

            {customCmds.length === 0 && !editingCmd && (
              <div className="text-center text-[11px] font-mono text-muted-foreground/50 py-10">No custom commands yet.</div>
            )}

            {customCmds.map((c) => (
              <motion.div key={c.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="border border-border rounded bg-card p-3">
                <div className="flex items-center gap-2">
                  <TerminalSquare className="w-3.5 h-3.5 text-terminal-cyan/70" />
                  <span className="text-[12px] font-mono font-medium text-terminal-cyan">/{c.name}</span>
                  <div className="flex-1" />
                  <button onClick={() => setEditingCmd(c)} aria-label="Edit command"
                    className="text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeCmd(c.id)} aria-label="Delete command"
                    className="text-muted-foreground hover:text-terminal-red"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <p className="mt-2 text-[10px] font-mono text-muted-foreground/70 line-clamp-2 whitespace-pre-wrap">{c.prompt}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Sessions ── */}
        {tab === "sessions" && (
          <div className="space-y-4 max-w-2xl">
            <p className="text-[11px] font-mono text-muted-foreground">
              Back up or restore your conversations (stored locally in this browser).
            </p>
            <div className="border border-border rounded bg-card p-4 space-y-3">
              <div className="text-[11px] font-mono text-foreground">
                {convCount} conversation{convCount !== 1 ? "s" : ""} stored locally
              </div>
              <div className="flex gap-2">
                <button onClick={exportSessions}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/50 bg-primary/10 text-primary text-[10px] font-mono hover:bg-primary/20 transition-all">
                  <Download className="w-3.5 h-3.5" /> Export all
                </button>
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-terminal-amber/50 bg-terminal-amber/10 text-terminal-amber text-[10px] font-mono hover:bg-terminal-amber/20 transition-all">
                  <Upload className="w-3.5 h-3.5" /> Import
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importSessions(f); e.target.value = ""; }}
                />
              </div>
              <p className="text-[9px] font-mono text-muted-foreground/50">
                Export downloads a JSON backup. Import merges conversations by id (existing ones with the same id are overwritten).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Preset editor form ──────────────────────────────────────────────────────────
const PresetEditor = ({
  preset, models, onChange, onSave, onCancel,
}: {
  preset: Preset;
  models: string[];
  onChange: (p: Preset) => void;
  onSave: () => void;
  onCancel: () => void;
}) => (
  <div className="border border-terminal-magenta/40 rounded bg-terminal-magenta/5 p-3 space-y-2">
    <div className="flex gap-2">
      <input
        aria-label="Preset name"
        value={preset.name}
        onChange={(e) => onChange({ ...preset, name: e.target.value })}
        placeholder="Preset name"
        className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-terminal-magenta"
      />
      <input
        aria-label="Preset model"
        value={preset.model}
        onChange={(e) => onChange({ ...preset, model: e.target.value })}
        placeholder="Model (blank = keep current)"
        list="preset-models"
        className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-terminal-magenta"
      />
      <datalist id="preset-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
      <select
        aria-label="Preset depth"
        value={preset.depth}
        onChange={(e) => onChange({ ...preset, depth: Number(e.target.value) })}
        className="bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none"
      >
        {[1, 2, 3].map((d) => <option key={d} value={d}>depth {d}</option>)}
      </select>
    </div>
    <textarea
      aria-label="Preset system prompt"
      value={preset.systemPrompt}
      onChange={(e) => onChange({ ...preset, systemPrompt: e.target.value })}
      placeholder="System prompt…"
      rows={4}
      className="w-full bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-terminal-magenta resize-none"
    />
    <div className="flex justify-end gap-2">
      <button onClick={onCancel}
        className="flex items-center gap-1 px-3 py-1.5 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground">
        <X className="w-3 h-3" /> Cancel
      </button>
      <button onClick={onSave}
        className="flex items-center gap-1 px-3 py-1.5 rounded border border-terminal-magenta bg-terminal-magenta/15 text-terminal-magenta text-[10px] font-mono hover:bg-terminal-magenta/25">
        <Check className="w-3 h-3" /> Save
      </button>
    </div>
  </div>
);

// ── Slash command editor form ───────────────────────────────────────────────────
const CmdEditor = ({
  cmd, onChange, onSave, onCancel,
}: {
  cmd: CustomSlashCommand;
  onChange: (c: CustomSlashCommand) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const preview = useMemo(() => normalizeSlashName(cmd.name), [cmd.name]);
  return (
    <div className="border border-terminal-cyan/40 rounded bg-terminal-cyan/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-muted-foreground">/</span>
        <input
          aria-label="Command name"
          value={cmd.name}
          onChange={(e) => onChange({ ...cmd, name: e.target.value })}
          placeholder="command-name"
          className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-terminal-cyan"
        />
        {preview && <span className="text-[9px] font-mono text-terminal-cyan/70">→ /{preview}</span>}
      </div>
      <textarea
        aria-label="Command prompt"
        value={cmd.prompt}
        onChange={(e) => onChange({ ...cmd, prompt: e.target.value })}
        placeholder="Prompt text inserted into the composer…"
        rows={4}
        className="w-full bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-terminal-cyan resize-none"
      />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" /> Cancel
        </button>
        <button onClick={onSave}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-terminal-cyan bg-terminal-cyan/15 text-terminal-cyan text-[10px] font-mono hover:bg-terminal-cyan/25">
          <Check className="w-3 h-3" /> Save
        </button>
      </div>
    </div>
  );
};

export default PresetsView;
