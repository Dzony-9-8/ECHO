// Calendar — local events, plus a month-grid helper. Task due-dates are overlaid
// from the Notes/Tasks store so the calendar shows both events and deadlines.

export type EventColor = "cyan" | "green" | "amber" | "magenta" | "red";

export interface CalEvent {
  id: string;
  title: string;
  date: string;   // yyyy-mm-dd
  time?: string;  // HH:mm (optional)
  color: EventColor;
  notes?: string;
}

const KEY = "echo_events";

export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const loadEvents = (): CalEvent[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
};
export const saveEvents = (events: CalEvent[]) => localStorage.setItem(KEY, JSON.stringify(events));

export const upsertEvent = (ev: CalEvent): CalEvent[] => {
  const events = loadEvents();
  const idx = events.findIndex((e) => e.id === ev.id);
  if (idx >= 0) events[idx] = ev;
  else events.push(ev);
  saveEvents(events);
  return events;
};
export const deleteEvent = (id: string): CalEvent[] => {
  const events = loadEvents().filter((e) => e.id !== id);
  saveEvents(events);
  return events;
};

// ── Date helpers ────────────────────────────────────────────────────────────────
/** Local yyyy-mm-dd for a Date (avoids UTC off-by-one from toISOString). */
export const toKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export interface GridDay {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
}

/**
 * Builds a 6-row (42-cell) Sunday-start month grid covering `year`/`month`
 * (month is 0-indexed), including leading/trailing days from adjacent months.
 */
export const buildMonthGrid = (year: number, month: number): GridDay[] => {
  const todayKey = toKey(new Date());
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // back up to the Sunday on//before the 1st

  const days: GridDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = toKey(d);
    days.push({ date: d, key, inMonth: d.getMonth() === month, isToday: key === todayKey });
  }
  return days;
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
