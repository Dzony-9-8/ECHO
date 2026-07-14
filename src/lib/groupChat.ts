// Group chat — a multi-participant "roundtable" where several AI personas,
// each with its own model + system prompt, respond in one thread. Real backend
// via sendMessage; roster + transcript persisted locally.

import type { ChatMessage } from "@/lib/api";

export type ParticipantColor = "green" | "cyan" | "magenta" | "amber" | "red";

export interface Participant {
  id: string;
  name: string;
  persona: string;      // system-prompt style description
  model?: string;       // optional model id; empty → backend default
  color: ParticipantColor;
  active: boolean;      // whether it replies in the round
}

export interface GroupMessage {
  id: string;
  speakerId: string;    // participant id, or "user"
  speaker: string;      // display name
  color: ParticipantColor | "user";
  content: string;
  ts: number;
}

const ROSTER_KEY = "echo_group_roster";
const MSGS_KEY = "echo_group_msgs";

export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const COLOR_HSL: Record<ParticipantColor | "user", string> = {
  green: "142 70% 45%",
  cyan: "185 60% 50%",
  magenta: "280 60% 55%",
  amber: "38 90% 55%",
  red: "0 70% 55%",
  user: "0 0% 70%",
};

const DEFAULT_ROSTER: Participant[] = [
  { id: "p-optimist", name: "Nova", persona: "You are an optimistic visionary who focuses on possibilities and upside. You get excited about ideas.", color: "green", active: true },
  { id: "p-skeptic", name: "Vex", persona: "You are a sharp skeptic who probes for flaws, risks, and hidden assumptions. You are blunt but fair.", color: "magenta", active: true },
  { id: "p-pragmatist", name: "Ivo", persona: "You are a grounded pragmatist who cares about concrete next steps, cost, and feasibility.", color: "cyan", active: true },
];

// ── Roster ───────────────────────────────────────────────────────────────────
export const loadRoster = (): Participant[] => {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return DEFAULT_ROSTER;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ROSTER;
  } catch {
    return DEFAULT_ROSTER;
  }
};
export const saveRoster = (list: Participant[]) => localStorage.setItem(ROSTER_KEY, JSON.stringify(list));

export const upsertParticipant = (p: Participant): Participant[] => {
  const list = loadRoster();
  const idx = list.findIndex((x) => x.id === p.id);
  if (idx >= 0) list[idx] = p;
  else list.push(p);
  saveRoster(list);
  return list;
};
export const deleteParticipant = (id: string): Participant[] => {
  const list = loadRoster().filter((p) => p.id !== id);
  saveRoster(list);
  return list;
};

// ── Transcript ───────────────────────────────────────────────────────────────
export const loadGroupMessages = (): GroupMessage[] => {
  try { return JSON.parse(localStorage.getItem(MSGS_KEY) || "[]"); }
  catch { return []; }
};
export const saveGroupMessages = (msgs: GroupMessage[]) => localStorage.setItem(MSGS_KEY, JSON.stringify(msgs));
export const clearGroupMessages = () => localStorage.removeItem(MSGS_KEY);

// ── Prompt building ──────────────────────────────────────────────────────────
/** Render the running transcript as plain labelled dialogue for context. */
const renderTranscript = (msgs: GroupMessage[]): string =>
  msgs.map((m) => `${m.speaker}: ${m.content}`).join("\n");

/**
 * Build the message array for one participant's turn. The whole prior transcript
 * is compressed into a single user turn (avoids strict role-alternation issues
 * across providers) alongside the persona system prompt.
 */
export const buildTurn = (p: Participant, transcript: GroupMessage[], others: Participant[]): ChatMessage[] => {
  const roster = others.filter((o) => o.id !== p.id).map((o) => o.name).join(", ");
  const system =
    `${p.persona}\n\n` +
    `You are "${p.name}" in a live group chat with a human and other AI participants` +
    (roster ? ` (${roster})` : "") +
    `. Stay in character as ${p.name}. Be concise — 1–3 sentences. ` +
    `Reply only as yourself; never write other speakers' lines or prefix your name.`;

  const convo = renderTranscript(transcript);
  const user =
    (convo ? `Conversation so far:\n${convo}\n\n` : "") +
    `Respond now as ${p.name}.`;

  return [
    { id: "sys", role: "system", content: system, timestamp: new Date() },
    { id: "usr", role: "user", content: user, timestamp: new Date() },
  ];
};
