import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BellRing, Plus, Trash2, Check, Clock, AlarmClock, Repeat as RepeatIcon, BellOff } from "lucide-react";
import {
  type Reminder,
  type Repeat,
  type PermissionState,
  loadReminders,
  upsertReminder,
  deleteReminder,
  sortReminders,
  isOverdue,
  newId,
  defaultRemindLocal,
  localToISO,
  notificationPermission,
  requestNotificationPermission,
  tickReminders,
  REMINDERS_EVENT,
} from "@/lib/reminders";

const REPEAT_LABEL: Record<Repeat, string> = { none: "Once", daily: "Daily", weekly: "Weekly" };

const fmtWhen = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const relative = (iso: string, now: number): string => {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  const h = Math.round(abs / 3600000);
  const d = Math.round(abs / 86400000);
  const unit = m < 60 ? `${m}m` : h < 24 ? `${h}h` : `${d}d`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
};

const RemindersView = () => {
  const [reminders, setReminders] = useState<Reminder[]>(() => sortReminders(loadReminders()));
  const [text, setText] = useState("");
  const [when, setWhen] = useState(defaultRemindLocal);
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [perm, setPerm] = useState<PermissionState>(notificationPermission());
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(() => setReminders(sortReminders(loadReminders())), []);

  // Live-refresh when the store changes (engine tick, other views) + a local clock
  // so relative times and overdue highlighting stay current.
  useEffect(() => {
    window.addEventListener(REMINDERS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    const clock = setInterval(() => {
      setNow(Date.now());
      tickReminders();   // also drive due reminders while this view is open
    }, 15000);
    return () => {
      window.removeEventListener(REMINDERS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      clearInterval(clock);
    };
  }, [refresh]);

  const add = () => {
    const t = text.trim();
    const iso = localToISO(when);
    if (!t || !iso) return;
    upsertReminder({ id: newId(), text: t, remindAt: iso, repeat, createdAt: Date.now() });
    setText("");
    setWhen(defaultRemindLocal());
    setRepeat("none");
    refresh();
  };

  const remove = (id: string) => { deleteReminder(id); refresh(); };

  const markDone = (r: Reminder) => {
    upsertReminder({ ...r, firedAt: Date.now(), repeat: "none" });
    refresh();
  };

  const askPermission = async () => setPerm(await requestNotificationPermission());

  const pending = reminders.filter((r) => !r.firedAt);
  const done = reminders.filter((r) => r.firedAt);
  const overdueCount = pending.filter((r) => isOverdue(r, now)).length;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <BellRing className="w-5 h-5 text-terminal-amber" style={{ filter: "drop-shadow(0 0 6px hsl(38 90% 55% / 0.6))" }} />
        <div>
          <h1 className="text-lg font-display tracking-wider text-foreground">Reminders</h1>
          <p className="text-[10px] font-mono text-muted-foreground">
            {pending.length} pending{overdueCount ? ` · ${overdueCount} due` : ""} · {done.length} done
          </p>
        </div>
      </div>

      {/* Notification permission banner (honest about capability) */}
      {perm !== "granted" && (
        <div className="mb-4 px-3 py-2.5 rounded-lg border border-terminal-amber/40 bg-terminal-amber/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-mono text-terminal-amber">
            <BellOff className="w-4 h-4 flex-shrink-0" />
            {perm === "unsupported"
              ? "This browser doesn't support notifications — reminders will still highlight here when due."
              : perm === "denied"
                ? "Notifications are blocked. Reminders still show here, but no desktop alert will pop. Re-enable in your browser's site settings."
                : "Enable desktop notifications so reminders alert you even when ECHO isn't focused."}
          </div>
          {perm === "default" && (
            <button
              onClick={askPermission}
              className="flex-shrink-0 text-[10px] font-mono uppercase tracking-widest px-2.5 py-1.5 rounded border border-terminal-amber/50 text-terminal-amber hover:bg-terminal-amber/20 transition-colors"
            >
              Enable
            </button>
          )}
        </div>
      )}

      {/* Add form */}
      <div className="mb-5 p-3 rounded-lg border border-border bg-card/40 space-y-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Remind me to…"
          className="w-full bg-input border border-border rounded px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="bg-input border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
          />
          <div className="flex items-center gap-1 px-2 py-1.5 rounded border border-border bg-muted/40" title="Repeat">
            <RepeatIcon className="w-3.5 h-3.5 text-terminal-cyan" />
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as Repeat)}
              className="bg-transparent text-xs font-mono text-foreground focus:outline-none cursor-pointer"
            >
              <option value="none">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <button
            onClick={add}
            disabled={!text.trim()}
            className="ml-auto flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Pending list */}
      {pending.length === 0 && done.length === 0 && (
        <div className="text-center py-12 text-muted-foreground/60 font-mono text-xs">
          <AlarmClock className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No reminders yet. Add one above.
        </div>
      )}

      <div className="space-y-2">
        {pending.map((r) => {
          const over = isOverdue(r, now);
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                over ? "border-terminal-red/50 bg-terminal-red/10" : "border-border bg-card/40"
              }`}
            >
              <button
                onClick={() => markDone(r)}
                title="Mark done"
                className="flex-shrink-0 w-5 h-5 rounded-full border border-border hover:border-primary hover:bg-primary/20 transition-colors flex items-center justify-center group"
              >
                <Check className="w-3 h-3 text-transparent group-hover:text-primary" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-foreground truncate">{r.text}</p>
                <div className="flex items-center gap-2 text-[10px] font-mono mt-0.5">
                  <span className={over ? "text-terminal-red" : "text-muted-foreground"}>
                    <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
                    {fmtWhen(r.remindAt)} · {relative(r.remindAt, now)}
                  </span>
                  {r.repeat !== "none" && (
                    <span className="text-terminal-cyan uppercase tracking-wider">
                      <RepeatIcon className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                      {REPEAT_LABEL[r.repeat]}
                    </span>
                  )}
                  {over && <span className="text-terminal-red uppercase tracking-widest">Due</span>}
                </div>
              </div>
              <button
                onClick={() => remove(r.id)}
                title="Delete"
                className="flex-shrink-0 p-1.5 rounded text-muted-foreground hover:text-terminal-red hover:bg-terminal-red/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Done list */}
      {done.length > 0 && (
        <>
          <div className="mt-6 mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Done</div>
          <div className="space-y-1.5">
            {done.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 px-3 py-2 rounded border border-border/50 bg-muted/20 opacity-70"
              >
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-muted-foreground line-through truncate">{r.text}</p>
                  <p className="text-[9px] font-mono text-muted-foreground/60">fired {fmtWhen(new Date(r.firedAt!).toISOString())}</p>
                </div>
                <button
                  onClick={() => remove(r.id)}
                  title="Delete"
                  className="flex-shrink-0 p-1.5 rounded text-muted-foreground hover:text-terminal-red hover:bg-terminal-red/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-[9px] font-mono text-muted-foreground/60 mt-6 text-center">
        Reminders fire while ECHO is open in a tab. Desktop alerts need notification permission; otherwise they highlight here when due.
      </p>
    </div>
  );
};

export default RemindersView;
