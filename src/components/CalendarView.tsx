import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Check, X, Clock, ListChecks, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import {
  type CalEvent, type EventColor,
  loadEvents, upsertEvent, deleteEvent, buildMonthGrid, toKey, newId,
  MONTH_NAMES, WEEKDAYS,
} from "@/lib/calendar";
import { type Task, loadTasks, upsertTask } from "@/lib/notes";

const EVENT_COLORS: Record<EventColor, string> = {
  cyan:    "bg-terminal-cyan/20 text-terminal-cyan border-terminal-cyan/40",
  green:   "bg-primary/20 text-primary border-primary/40",
  amber:   "bg-terminal-amber/20 text-terminal-amber border-terminal-amber/40",
  magenta: "bg-terminal-magenta/20 text-terminal-magenta border-terminal-magenta/40",
  red:     "bg-terminal-red/20 text-terminal-red border-terminal-red/40",
};
const DOT_COLORS: Record<EventColor, string> = {
  cyan: "bg-terminal-cyan", green: "bg-primary", amber: "bg-terminal-amber",
  magenta: "bg-terminal-magenta", red: "bg-terminal-red",
};

const CalendarView = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>(toKey(now));
  const [editing, setEditing] = useState<CalEvent | null>(null);

  useEffect(() => {
    setEvents(loadEvents());
    setTasks(loadTasks());
  }, []);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  // Index events + task due-dates by day key.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    for (const [, arr] of map) arr.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    return map;
  }, [events]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due) continue;
      const arr = map.get(t.due) ?? [];
      arr.push(t);
      map.set(t.due, arr);
    }
    return map;
  }, [tasks]);

  const prevMonth = () => { if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1); };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); setSelectedKey(toKey(now)); };

  const startNewEvent = () =>
    setEditing({ id: newId(), title: "", date: selectedKey, time: "", color: "cyan" });

  const saveEvent = () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast.error("Enter an event title"); return; }
    setEvents(upsertEvent({ ...editing, title: editing.title.trim() }));
    setEditing(null);
    toast.success("Event saved");
  };
  const removeEvent = (id: string) => { setEvents(deleteEvent(id)); toast.success("Event deleted"); };
  const toggleTask = (t: Task) => setTasks(upsertTask({ ...t, done: !t.done }));

  const selDate = new Date(selectedKey + "T00:00:00");
  const selEvents = eventsByDay.get(selectedKey) ?? [];
  const selTasks = tasksByDay.get(selectedKey) ?? [];

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Calendar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card p-3 flex items-center gap-3">
          <CalendarDays className="w-4 h-4 text-terminal-cyan" />
          <span className="text-xs font-mono text-terminal-cyan uppercase tracking-wider">Calendar</span>
          <div className="flex-1" />
          <button onClick={goToday} className="px-2.5 py-1 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground transition-all">Today</button>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} aria-label="Previous month" className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-[11px] font-mono text-foreground w-32 text-center">{MONTH_NAMES[month]} {year}</span>
            <button onClick={nextMonth} aria-label="Next month" className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider py-1.5">{w}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 grid grid-cols-7 grid-rows-6">
          {grid.map((d) => {
            const dayEvents = eventsByDay.get(d.key) ?? [];
            const dayTasks = tasksByDay.get(d.key) ?? [];
            const isSelected = d.key === selectedKey;
            return (
              <button
                key={d.key}
                onClick={() => setSelectedKey(d.key)}
                className={`border-b border-r border-border/50 p-1 text-left flex flex-col gap-0.5 overflow-hidden transition-colors ${
                  isSelected ? "bg-terminal-cyan/5 ring-1 ring-inset ring-terminal-cyan/40" : "hover:bg-muted/20"
                } ${d.inMonth ? "" : "opacity-35"}`}
              >
                <span className={`text-[10px] font-mono self-start w-5 h-5 flex items-center justify-center rounded-full ${
                  d.isToday ? "bg-terminal-cyan text-background font-bold" : "text-foreground/80"}`}>
                  {d.date.getDate()}
                </span>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {dayEvents.slice(0, 2).map((e) => (
                    <span key={e.id} className={`text-[8px] font-mono px-1 py-0.5 rounded border truncate ${EVENT_COLORS[e.color]}`}>
                      {e.time ? `${e.time} ` : ""}{e.title}
                    </span>
                  ))}
                  {dayTasks.slice(0, 2).map((t) => (
                    <span key={t.id} className={`flex items-center gap-0.5 text-[8px] font-mono text-muted-foreground/70 truncate ${t.done ? "line-through opacity-50" : ""}`}>
                      <ListChecks className="w-2 h-2 flex-shrink-0" /> {t.text}
                    </span>
                  ))}
                  {(dayEvents.length + dayTasks.length) > 4 && (
                    <span className="text-[7px] font-mono text-muted-foreground/40">+{dayEvents.length + dayTasks.length - 4} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day detail */}
      <div className="w-64 border-l border-border bg-sidebar/30 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-border">
          <div className="text-[11px] font-mono text-foreground">
            {selDate.toLocaleDateString(undefined, { weekday: "long" })}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground/60">
            {selDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Add / edit event */}
          {editing && editing.date === selectedKey ? (
            <div className="border border-terminal-cyan/40 rounded bg-terminal-cyan/5 p-2 space-y-2">
              <input aria-label="Event title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Event title" className="w-full bg-input border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-terminal-cyan" />
              <div className="flex gap-1.5">
                <input aria-label="Event time" type="time" value={editing.time || ""} onChange={(e) => setEditing({ ...editing, time: e.target.value })}
                  className="flex-1 bg-input border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none" />
                <div className="flex items-center gap-1">
                  {(Object.keys(DOT_COLORS) as EventColor[]).map((c) => (
                    <button key={c} aria-label={`Color ${c}`} onClick={() => setEditing({ ...editing, color: c })}
                      className={`w-4 h-4 rounded-full ${DOT_COLORS[c]} ${editing.color === c ? "ring-2 ring-foreground/60" : "opacity-70"}`} />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-1.5">
                <button onClick={() => setEditing(null)} className="flex items-center gap-1 px-2 py-1 rounded border border-border text-[9px] font-mono text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                <button onClick={saveEvent} className="flex items-center gap-1 px-2 py-1 rounded border border-terminal-cyan bg-terminal-cyan/15 text-terminal-cyan text-[9px] font-mono"><Check className="w-3 h-3" /> Save</button>
              </div>
            </div>
          ) : (
            <button onClick={startNewEvent}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-terminal-cyan/50 bg-terminal-cyan/10 text-terminal-cyan text-[10px] font-mono hover:bg-terminal-cyan/20 transition-all">
              <Plus className="w-3.5 h-3.5" /> Add event
            </button>
          )}

          {/* Events for the day */}
          {selEvents.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground/40">Events</div>
              <AnimatePresence>
                {selEvents.map((e) => (
                  <motion.div key={e.id} layout initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className={`flex items-center gap-2 p-2 rounded border ${EVENT_COLORS[e.color]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_COLORS[e.color]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono truncate">{e.title}</div>
                      {e.time && <div className="flex items-center gap-1 text-[8px] font-mono opacity-70"><Clock className="w-2 h-2" /> {e.time}</div>}
                    </div>
                    <button onClick={() => setEditing(e)} aria-label="Edit event" className="opacity-60 hover:opacity-100"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => removeEvent(e.id)} aria-label="Delete event" className="opacity-60 hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Tasks due this day */}
          {selTasks.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground/40">Tasks due</div>
              {selTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded border border-border bg-card">
                  <button onClick={() => toggleTask(t)} aria-label={t.done ? "Mark undone" : "Mark done"}
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${t.done ? "bg-primary/20 border-primary text-primary" : "border-muted-foreground/40"}`}>
                    {t.done && <Check className="w-2.5 h-2.5" />}
                  </button>
                  <span className={`flex-1 text-[10px] font-mono ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.text}</span>
                </div>
              ))}
            </div>
          )}

          {selEvents.length === 0 && selTasks.length === 0 && !editing && (
            <div className="text-center text-[10px] font-mono text-muted-foreground/40 py-6">Nothing scheduled.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
