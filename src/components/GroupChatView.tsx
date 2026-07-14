import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Users, Send, Plus, Trash2, Pencil, X, Check, Eraser, Loader2 } from "lucide-react";
import { sendMessage } from "@/lib/api";
import {
  type Participant,
  type ParticipantColor,
  type GroupMessage,
  COLOR_HSL,
  loadRoster,
  saveRoster,
  upsertParticipant,
  deleteParticipant,
  loadGroupMessages,
  saveGroupMessages,
  clearGroupMessages,
  buildTurn,
  newId,
} from "@/lib/groupChat";

const COLORS: ParticipantColor[] = ["green", "cyan", "magenta", "amber", "red"];
const hsl = (c: ParticipantColor | "user") => `hsl(${COLOR_HSL[c]})`;

const blankDraft = (): Participant => ({
  id: newId(), name: "", persona: "", model: "", color: "cyan", active: true,
});

const GroupChatView = () => {
  const [roster, setRoster] = useState<Participant[]>(() => loadRoster());
  const [messages, setMessages] = useState<GroupMessage[]>(() => loadGroupMessages());
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [editing, setEditing] = useState<Participant | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveRoster(roster); }, [roster]);
  useEffect(() => { saveGroupMessages(messages); }, [messages]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const toggleActive = (id: string) =>
    setRoster((r) => r.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));

  const saveEditing = () => {
    if (!editing || !editing.name.trim()) return;
    setRoster(upsertParticipant({ ...editing, name: editing.name.trim() }));
    setEditing(null);
  };

  const removeParticipant = (id: string) => setRoster(deleteParticipant(id));

  const clearThread = () => { clearGroupMessages(); setMessages([]); };

  const send = async () => {
    const text = input.trim();
    if (!text || running) return;
    const actives = roster.filter((p) => p.active);
    if (actives.length === 0) return;

    setInput("");
    setRunning(true);

    // Append the human turn.
    const userMsg: GroupMessage = { id: newId(), speakerId: "user", speaker: "You", color: "user", content: text, ts: Date.now() };
    // Local running transcript (state updates are async; keep a synchronous copy).
    let transcript = [...messages, userMsg];
    setMessages(transcript);

    for (const p of actives) {
      setSpeaking(p.name);
      const placeholder: GroupMessage = { id: newId(), speakerId: p.id, speaker: p.name, color: p.color, content: "", ts: Date.now() };
      transcript = [...transcript, placeholder];
      setMessages(transcript);

      try {
        const turn = buildTurn(p, transcript.slice(0, -1), roster);
        let acc = "";
        await sendMessage(
          turn,
          (chunk) => {
            acc = chunk;
            setMessages((cur) => cur.map((m) => (m.id === placeholder.id ? { ...m, content: acc } : m)));
          },
          0,
          p.model || undefined,
        );
        const finalText = (acc || "").trim() || "…";
        // Commit final text into the synchronous transcript for the next speaker's context.
        transcript = transcript.map((m) => (m.id === placeholder.id ? { ...m, content: finalText } : m));
        setMessages(transcript);
      } catch (e) {
        const err = `⚠️ ${p.name} couldn't respond (${e instanceof Error ? e.message : "backend error"}).`;
        transcript = transcript.map((m) => (m.id === placeholder.id ? { ...m, content: err } : m));
        setMessages(transcript);
      }
    }

    setSpeaking(null);
    setRunning(false);
  };

  const activeCount = roster.filter((p) => p.active).length;

  return (
    <div className="h-full flex overflow-hidden">
      {/* Roster panel */}
      <div className="w-60 flex-shrink-0 border-r border-border bg-sidebar/40 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-terminal-magenta" />
            <span className="text-xs font-mono uppercase tracking-widest text-foreground">Participants</span>
          </div>
          <button
            onClick={() => setEditing(blankDraft())}
            title="Add participant"
            className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {roster.map((p) => (
            <div
              key={p.id}
              className={`group rounded-lg border px-2.5 py-2 transition-all ${
                p.active ? "border-border bg-card/50" : "border-border/40 bg-transparent opacity-50"
              }`}
              style={p.active ? { boxShadow: `inset 3px 0 0 ${hsl(p.color)}` } : {}}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(p.id)}
                  title={p.active ? "Mute in round" : "Include in round"}
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: p.active ? hsl(p.color) : "hsl(0 0% 40%)", boxShadow: p.active ? `0 0 6px ${hsl(p.color)}` : "none" }}
                />
                <span className="text-xs font-mono text-foreground truncate flex-1" style={{ color: p.active ? hsl(p.color) : undefined }}>
                  {p.name}
                </span>
                <button onClick={() => setEditing({ ...p })} title="Edit" className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-all">
                  <Pencil className="w-3 h-3" />
                </button>
                <button onClick={() => removeParticipant(p.id)} title="Remove" className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-terminal-red transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground/70 mt-1 line-clamp-2 leading-snug">{p.persona}</p>
              {p.model && <p className="text-[8px] font-mono text-terminal-cyan/70 mt-0.5 truncate">{p.model}</p>}
            </div>
          ))}
          {roster.length === 0 && (
            <p className="text-[10px] font-mono text-muted-foreground/60 text-center py-6">No participants. Add one.</p>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="text-sm font-display tracking-wider text-foreground">Group Chat</h1>
            <p className="text-[10px] font-mono text-muted-foreground">
              {activeCount} active · roundtable replies in order
            </p>
          </div>
          <button
            onClick={clearThread}
            disabled={messages.length === 0 || running}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2.5 py-1.5 rounded border border-border text-muted-foreground hover:text-terminal-red hover:border-terminal-red/50 transition-colors disabled:opacity-30"
          >
            <Eraser className="w-3 h-3" /> Clear
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/50 font-mono text-xs gap-2">
              <Users className="w-8 h-8 opacity-40" />
              <p>Start a discussion — every active participant replies in turn.</p>
            </div>
          )}
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.speakerId === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[75%] ${m.speakerId === "user" ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-1.5 mb-0.5 px-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: hsl(m.color) }}>
                    {m.speaker}
                  </span>
                </div>
                <div
                  className="rounded-lg px-3 py-2 text-sm font-mono whitespace-pre-wrap break-words border"
                  style={{
                    borderColor: `${hsl(m.color)}44`,
                    background: `${hsl(m.color)}0f`,
                    color: "hsl(var(--foreground))",
                  }}
                >
                  {m.content || <span className="text-muted-foreground/50 italic">…thinking</span>}
                </div>
              </div>
            </motion.div>
          ))}
          {speaking && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground px-1">
              <Loader2 className="w-3 h-3 animate-spin" /> {speaking} is typing…
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={activeCount === 0 ? "Activate at least one participant…" : "Pose a question to the group…"}
              disabled={running}
              rows={1}
              className="flex-1 bg-input border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none font-mono disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || running || activeCount === 0}
              className="p-2.5 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Edit / add modal */}
      {editing && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-display tracking-wide text-foreground">
                {roster.some((p) => p.id === editing.id) ? "Edit participant" : "New participant"}
              </h2>
              <button onClick={() => setEditing(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">Name</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Nova"
                  className="w-full mt-1 bg-input border border-border rounded px-2.5 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">Persona (system prompt)</label>
                <textarea
                  value={editing.persona}
                  onChange={(e) => setEditing({ ...editing, persona: e.target.value })}
                  placeholder="You are a…"
                  rows={3}
                  className="w-full mt-1 bg-input border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">Model (optional — blank = backend default)</label>
                <input
                  value={editing.model ?? ""}
                  onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                  placeholder="e.g. llama3.1:8b"
                  className="w-full mt-1 bg-input border border-border rounded px-2.5 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">Color</label>
                <div className="flex gap-2 mt-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditing({ ...editing, color: c })}
                      className="w-6 h-6 rounded-full border-2 transition-all"
                      style={{ background: hsl(c), borderColor: editing.color === c ? "hsl(var(--foreground))" : "transparent" }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={saveEditing}
                disabled={!editing.name.trim()}
                className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest px-4 py-1.5 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30"
              >
                <Check className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupChatView;
