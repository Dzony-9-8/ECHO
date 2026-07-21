import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  NotebookPen, StickyNote, ListChecks, Plus, Trash2, Pin, PinOff, Check, X, Bot, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import {
  type Note, type Task, type NoteColor, type Priority,
  loadNotes, upsertNote, deleteNote, sortNotes,
  loadTasks, upsertTask, deleteTask, sortTasks, newId,
} from "@/lib/notes";

interface Props {
  onSendToChat: (prompt: string) => void;
}

type Tab = "notes" | "tasks";

const NOTE_COLORS: Record<NoteColor, string> = {
  default: "border-border bg-card",
  green:   "border-primary/40 bg-primary/5",
  cyan:    "border-terminal-cyan/40 bg-terminal-cyan/5",
  amber:   "border-terminal-amber/40 bg-terminal-amber/5",
  magenta: "border-terminal-magenta/40 bg-terminal-magenta/5",
  red:     "border-terminal-red/40 bg-terminal-red/5",
};
const COLOR_SWATCH: Record<NoteColor, string> = {
  default: "bg-muted-foreground/40",
  green:   "bg-primary",
  cyan:    "bg-terminal-cyan",
  amber:   "bg-terminal-amber",
  magenta: "bg-terminal-magenta",
  red:     "bg-terminal-red",
};
const PRIORITY_META: Record<Priority, { label: string; cls: string }> = {
  high: { label: "High", cls: "text-terminal-red border-terminal-red/40 bg-terminal-red/10" },
  med:  { label: "Med",  cls: "text-terminal-amber border-terminal-amber/40 bg-terminal-amber/10" },
  low:  { label: "Low",  cls: "text-muted-foreground border-border bg-muted/20" },
};

const NotesTasksView = ({ onSendToChat }: Props) => {
  const [tab, setTab] = useState<Tab>("notes");
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  // Task composer
  const [taskText, setTaskText] = useState("");
  const [taskPriority, setTaskPriority] = useState<Priority>("med");
  const [taskDue, setTaskDue] = useState("");

  useEffect(() => {
    setNotes(loadNotes());
    setTasks(loadTasks());
  }, []);

  // ── Notes ──────────────────────────────────────────────────────────────────
  const startNewNote = () =>
    setEditingNote({ id: newId(), title: "", content: "", color: "default", pinned: false, updatedAt: Date.now() });

  const saveNote = () => {
    if (!editingNote) return;
    if (!editingNote.title.trim() && !editingNote.content.trim()) { setEditingNote(null); return; }
    setNotes(upsertNote({ ...editingNote, updatedAt: Date.now() }));
    setEditingNote(null);
    toast.success("Note saved");
  };
  const removeNote = (id: string) => { setNotes(deleteNote(id)); toast.success("Note deleted"); };
  const togglePin = (n: Note) => setNotes(upsertNote({ ...n, pinned: !n.pinned, updatedAt: Date.now() }));

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const addTask = () => {
    if (!taskText.trim()) return;
    setTasks(upsertTask({
      id: newId(), text: taskText.trim(), done: false,
      priority: taskPriority, due: taskDue || undefined, createdAt: Date.now(),
    }));
    setTaskText(""); setTaskDue(""); setTaskPriority("med");
  };
  const toggleTask = (t: Task) => setTasks(upsertTask({ ...t, done: !t.done }));
  const removeTask = (id: string) => setTasks(deleteTask(id));
  const sendTaskToAgent = (t: Task) => {
    onSendToChat(`Help me complete this task${t.due ? ` (due ${t.due})` : ""}:\n\n${t.text}`);
    toast.success("Sent to chat");
  };

  const sortedNotes = sortNotes(notes);
  const sortedTasks = sortTasks(tasks);
  const openTaskCount = tasks.filter((t) => !t.done).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header + tabs */}
      <div className="border-b border-border bg-card px-3 pt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <NotebookPen className="w-4 h-4 text-terminal-amber" />
          <span className="text-xs font-mono text-terminal-amber uppercase tracking-wider">Notes &amp; Tasks</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTab("notes")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border-b-2 transition-all ${
              tab === "notes" ? "border-terminal-amber text-terminal-amber" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <StickyNote className="w-3.5 h-3.5" /> Notes
          </button>
          <button onClick={() => setTab("tasks")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border-b-2 transition-all ${
              tab === "tasks" ? "border-terminal-amber text-terminal-amber" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <ListChecks className="w-3.5 h-3.5" /> Tasks{openTaskCount > 0 && <span className="text-[8px] opacity-70">({openTaskCount})</span>}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* ── Notes ── */}
        {tab === "notes" && (
          <div className="space-y-3">
            <button onClick={startNewNote}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-terminal-amber/50 bg-terminal-amber/10 text-terminal-amber text-[10px] font-mono hover:bg-terminal-amber/20 transition-all">
              <Plus className="w-3.5 h-3.5" /> New note
            </button>

            {editingNote && (
              <NoteEditor note={editingNote} onChange={setEditingNote} onSave={saveNote} onCancel={() => setEditingNote(null)} />
            )}

            {sortedNotes.length === 0 && !editingNote && (
              <div className="text-center text-[11px] font-mono text-muted-foreground/50 py-10">No notes yet.</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <AnimatePresence>
                {sortedNotes.map((n) => (
                  <motion.div key={n.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                    className={`border rounded p-3 flex flex-col gap-2 ${NOTE_COLORS[n.color]}`}>
                    <div className="flex items-start gap-2">
                      <button onClick={() => setEditingNote(n)} className="flex-1 text-left min-w-0">
                        {n.title && <div className="text-[12px] font-mono font-medium text-foreground break-words">{n.title}</div>}
                        {n.content && <div className="text-[10px] font-mono text-muted-foreground/70 whitespace-pre-wrap break-words mt-1 line-clamp-6">{n.content}</div>}
                      </button>
                      <button onClick={() => togglePin(n)} aria-label={n.pinned ? "Unpin" : "Pin"}
                        className={n.pinned ? "text-terminal-amber" : "text-muted-foreground/40 hover:text-foreground"}>
                        {n.pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1" />
                      <button onClick={() => removeNote(n.id)} aria-label="Delete note" className="text-muted-foreground/40 hover:text-terminal-red">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── Tasks ── */}
        {tab === "tasks" && (
          <div className="space-y-3 max-w-3xl">
            {/* Composer */}
            <div className="flex flex-wrap gap-2 items-center border border-border rounded bg-card p-2">
              <input
                aria-label="New task"
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
                placeholder="Add a task…"
                className="flex-1 min-w-[160px] bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-terminal-amber"
              />
              <select aria-label="Task priority" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as Priority)}
                className="bg-input border border-border rounded px-2 py-1.5 text-[10px] font-mono text-foreground focus:outline-none">
                <option value="high">High</option>
                <option value="med">Med</option>
                <option value="low">Low</option>
              </select>
              <input aria-label="Task due date" type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)}
                className="bg-input border border-border rounded px-2 py-1.5 text-[10px] font-mono text-foreground focus:outline-none" />
              <button onClick={addTask}
                className="flex items-center gap-1 px-3 py-1.5 rounded border border-terminal-amber/50 bg-terminal-amber/10 text-terminal-amber text-[10px] font-mono hover:bg-terminal-amber/20 transition-all">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {sortedTasks.length === 0 && (
              <div className="text-center text-[11px] font-mono text-muted-foreground/50 py-10">No tasks yet.</div>
            )}

            <div className="space-y-1.5">
              <AnimatePresence>
                {sortedTasks.map((t) => {
                  const meta = PRIORITY_META[t.priority];
                  return (
                    <motion.div key={t.id} layout initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -8 }}
                      className={`flex items-center gap-2.5 p-2.5 rounded border border-border bg-card ${t.done ? "opacity-50" : ""}`}>
                      <button onClick={() => toggleTask(t)} aria-label={t.done ? "Mark undone" : "Mark done"}
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          t.done ? "bg-primary/20 border-primary text-primary" : "border-muted-foreground/40 hover:border-primary"}`}>
                        {t.done && <Check className="w-3 h-3" />}
                      </button>
                      <span className={`flex-1 text-[11px] font-mono break-words ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.text}</span>
                      {t.due && (
                        <span className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/50 flex-shrink-0">
                          <Calendar className="w-2.5 h-2.5" /> {t.due}
                        </span>
                      )}
                      <span className={`text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${meta.cls}`}>{meta.label}</span>
                      <button onClick={() => sendTaskToAgent(t)} title="Send to chat agent" aria-label="Send to agent"
                        className="text-muted-foreground/50 hover:text-terminal-cyan flex-shrink-0"><Bot className="w-3.5 h-3.5" /></button>
                      <button onClick={() => removeTask(t.id)} aria-label="Delete task"
                        className="text-muted-foreground/40 hover:text-terminal-red flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Note editor ─────────────────────────────────────────────────────────────
const NoteEditor = ({
  note, onChange, onSave, onCancel,
}: {
  note: Note;
  onChange: (n: Note) => void;
  onSave: () => void;
  onCancel: () => void;
}) => (
  <div className={`border rounded p-3 space-y-2 ${NOTE_COLORS[note.color]}`}>
    <input
      aria-label="Note title"
      value={note.title}
      onChange={(e) => onChange({ ...note, title: e.target.value })}
      placeholder="Title"
      className="w-full bg-transparent text-[12px] font-mono font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
    />
    <textarea
      aria-label="Note content"
      value={note.content}
      onChange={(e) => onChange({ ...note, content: e.target.value })}
      placeholder="Take a note…"
      rows={4}
      className="w-full bg-input/50 border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none"
    />
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        {(Object.keys(COLOR_SWATCH) as NoteColor[]).map((c) => (
          <button key={c} aria-label={`Color ${c}`} onClick={() => onChange({ ...note, color: c })}
            className={`w-4 h-4 rounded-full ${COLOR_SWATCH[c]} ${note.color === c ? "ring-2 ring-foreground/60" : "opacity-70 hover:opacity-100"}`} />
        ))}
      </div>
      <div className="flex-1" />
      <button onClick={onCancel} className="flex items-center gap-1 px-2.5 py-1 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground">
        <X className="w-3 h-3" /> Cancel
      </button>
      <button onClick={onSave} className="flex items-center gap-1 px-2.5 py-1 rounded border border-terminal-amber bg-terminal-amber/15 text-terminal-amber text-[10px] font-mono hover:bg-terminal-amber/25">
        <Check className="w-3 h-3" /> Save
      </button>
    </div>
  </div>
);

export default NotesTasksView;
