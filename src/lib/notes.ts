// Notes & Tasks — Keep-style notes and a lightweight todo list, persisted locally.

export type NoteColor = "default" | "green" | "cyan" | "amber" | "magenta" | "red";
export type Priority = "low" | "med" | "high";

export interface Note {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  pinned: boolean;
  updatedAt: number;
}

export interface Task {
  id: string;
  text: string;
  done: boolean;
  priority: Priority;
  due?: string;       // ISO date (yyyy-mm-dd)
  createdAt: number;
}

const NOTES_KEY = "echo_notes";
const TASKS_KEY = "echo_tasks";

export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ── Notes ────────────────────────────────────────────────────────────────────
export const loadNotes = (): Note[] => {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "[]"); }
  catch { return []; }
};
export const saveNotes = (notes: Note[]) => localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

export const upsertNote = (note: Note): Note[] => {
  const notes = loadNotes();
  const idx = notes.findIndex((n) => n.id === note.id);
  if (idx >= 0) notes[idx] = note;
  else notes.unshift(note);
  saveNotes(notes);
  return notes;
};
export const deleteNote = (id: string): Note[] => {
  const notes = loadNotes().filter((n) => n.id !== id);
  saveNotes(notes);
  return notes;
};

/** Pinned first, then most-recently-updated. */
export const sortNotes = (notes: Note[]): Note[] =>
  [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);

// ── Tasks ────────────────────────────────────────────────────────────────────
export const loadTasks = (): Task[] => {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY) || "[]"); }
  catch { return []; }
};
export const saveTasks = (tasks: Task[]) => localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));

export const upsertTask = (task: Task): Task[] => {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) tasks[idx] = task;
  else tasks.unshift(task);
  saveTasks(tasks);
  return tasks;
};
export const deleteTask = (id: string): Task[] => {
  const tasks = loadTasks().filter((t) => t.id !== id);
  saveTasks(tasks);
  return tasks;
};

const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };

/** Undone first, then by priority, then newest. */
export const sortTasks = (tasks: Task[]): Task[] =>
  [...tasks].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      b.createdAt - a.createdAt
  );
