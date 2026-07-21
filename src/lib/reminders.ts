// Reminders — local, time-based alerts with optional recurrence.
// Persisted in localStorage (echo_reminders). Fires a browser Notification
// when due; degrades honestly to in-app highlighting if permission is absent.

export type Repeat = "none" | "daily" | "weekly";

export interface Reminder {
  id: string;
  text: string;
  remindAt: string;   // ISO datetime of the next fire
  repeat: Repeat;
  createdAt: number;
  firedAt?: number;   // set when a "none" reminder has fired (i.e. done)
}

const KEY = "echo_reminders";
export const REMINDERS_EVENT = "echo:reminders-changed";

export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const loadReminders = (): Reminder[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
};

export const saveReminders = (list: Reminder[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  // Let any mounted view refresh immediately (same tab; storage event only fires cross-tab).
  window.dispatchEvent(new CustomEvent(REMINDERS_EVENT));
};

export const upsertReminder = (r: Reminder): Reminder[] => {
  const list = loadReminders();
  const idx = list.findIndex((x) => x.id === r.id);
  if (idx >= 0) list[idx] = r;
  else list.unshift(r);
  saveReminders(list);
  return list;
};

export const deleteReminder = (id: string): Reminder[] => {
  const list = loadReminders().filter((r) => r.id !== id);
  saveReminders(list);
  return list;
};

// ── Recurrence ───────────────────────────────────────────────────────────────
const STEP_MS: Record<Exclude<Repeat, "none">, number> = {
  daily: 86400_000,
  weekly: 7 * 86400_000,
};

/** Advance a recurring reminder's remindAt to the next occurrence strictly after `now`. */
const nextOccurrence = (fromISO: string, repeat: Exclude<Repeat, "none">, now: number): string => {
  const step = STEP_MS[repeat];
  let t = new Date(fromISO).getTime();
  if (Number.isNaN(t)) return fromISO;
  // Skip any missed occurrences in one go (avoids a burst of catch-up notifications).
  while (t <= now) t += step;
  return new Date(t).toISOString();
};

// ── Notifications ────────────────────────────────────────────────────────────
export const notificationsSupported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export const notificationPermission = (): PermissionState => {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission as PermissionState;
};

export const requestNotificationPermission = async (): Promise<PermissionState> => {
  if (!notificationsSupported()) return "unsupported";
  try {
    const res = await Notification.requestPermission();
    return res as PermissionState;
  } catch {
    return notificationPermission();
  }
};

const fireNotification = (r: Reminder) => {
  if (notificationPermission() !== "granted") return;   // honest no-op when not permitted
  try {
    const n = new Notification("⏰ ECHO Reminder", { body: r.text, tag: r.id });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {
    // Some browsers require a ServiceWorker for Notification in certain contexts — ignore.
  }
};

// ── Engine tick ──────────────────────────────────────────────────────────────
/**
 * Process all due reminders once:
 *  - recurring → fire + roll remindAt forward to the next occurrence,
 *  - one-off   → fire + mark firedAt (moves it to "done").
 * Returns the number that fired (0 means nothing changed / no write).
 */
export const tickReminders = (now: number = Date.now()): number => {
  const list = loadReminders();
  let fired = 0;
  for (const r of list) {
    if (r.firedAt) continue;                       // already done
    const due = new Date(r.remindAt).getTime();
    if (Number.isNaN(due) || due > now) continue;  // not due yet
    fireNotification(r);
    fired++;
    if (r.repeat === "none") r.firedAt = now;
    else r.remindAt = nextOccurrence(r.remindAt, r.repeat, now);
  }
  if (fired > 0) saveReminders(list);
  return fired;
};

// ── View helpers ─────────────────────────────────────────────────────────────
export const isOverdue = (r: Reminder, now: number = Date.now()): boolean =>
  !r.firedAt && new Date(r.remindAt).getTime() <= now;

/** Pending (not done) first, soonest remindAt first; done reminders last, newest done first. */
export const sortReminders = (list: Reminder[]): Reminder[] =>
  [...list].sort((a, b) => {
    const aDone = a.firedAt ? 1 : 0;
    const bDone = b.firedAt ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (aDone) return (b.firedAt ?? 0) - (a.firedAt ?? 0);
    return new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime();
  });

/** Value for an <input type="datetime-local">, defaulting +1h from now, in LOCAL time. */
export const defaultRemindLocal = (): string => {
  const d = new Date(Date.now() + 3600_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Convert a datetime-local value (local wall-clock, no tz) to an ISO string. */
export const localToISO = (local: string): string => {
  const d = new Date(local);   // interpreted as local time
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
};
