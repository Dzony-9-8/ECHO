import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Columns2, Play, Trophy, Eye, Plus, X, RotateCcw, Crown, Trash2, Minus,
} from "lucide-react";
import { sendMessage, fetchLocalModels, getBackendMode, type ChatMessage } from "@/lib/api";
import { toast } from "sonner";

// ── Persistent scoreboard (localStorage — mirrors Odysseus' vote history) ──────
const VOTES_KEY = "echo_compare_votes";
const VOTES_MAX = 200;

interface VoteRecord {
  models: string[];
  winner: string; // real model name, or "tie"
  prompt: string;
  blind: boolean;
  ts: number;
}

const loadVotes = (): VoteRecord[] => {
  try { return JSON.parse(localStorage.getItem(VOTES_KEY) || "[]"); }
  catch { return []; }
};
const saveVote = (rec: VoteRecord) => {
  const votes = loadVotes();
  votes.push(rec);
  if (votes.length > VOTES_MAX) votes.splice(0, votes.length - VOTES_MAX);
  localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
};

interface Tally { model: string; games: number; wins: number; ties: number; losses: number; }

const computeTally = (votes: VoteRecord[]): Tally[] => {
  const map = new Map<string, Tally>();
  for (const v of votes) {
    for (const m of v.models) {
      const t = map.get(m) ?? { model: m, games: 0, wins: 0, ties: 0, losses: 0 };
      t.games += 1;
      if (v.winner === "tie") t.ties += 1;
      else if (v.winner === m) t.wins += 1;
      else t.losses += 1;
      map.set(m, t);
    }
  }
  return [...map.values()].sort((a, b) => (b.wins / Math.max(b.games, 1)) - (a.wins / Math.max(a.games, 1)) || b.games - a.games);
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const slotLabel = (i: number) => `Model ${String.fromCharCode(65 + i)}`;

const MIN_PANES = 2;
const MAX_PANES = 4;

export default function ModelCompareView() {
  const [models, setModels] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [blind, setBlind] = useState(true);

  const [assignment, setAssignment] = useState<number[]>([]); // displayIdx -> selected idx
  const [responses, setResponses] = useState<string[]>([]);   // by displayIdx
  const [phase, setPhase] = useState<"idle" | "streaming" | "done">("idle");
  const [revealed, setRevealed] = useState(false);
  const [voted, setVoted] = useState<string | null>(null);    // winner model or "tie"
  const [showScore, setShowScore] = useState(false);
  const [scoreTick, setScoreTick] = useState(0); // bump to recompute after a vote

  const runRef = useRef(0);
  const mode = getBackendMode();

  useEffect(() => {
    fetchLocalModels().then((m) => {
      const names = m.filter((x) => x.type !== "embedding").map((x) => x.name);
      setModels(names);
      setSelected((prev) => {
        if (prev.length >= MIN_PANES) return prev;
        return names.slice(0, Math.max(MIN_PANES, prev.length)).length >= MIN_PANES
          ? names.slice(0, 2)
          : names.slice(0, names.length);
      });
    }).catch(() => {});
  }, []);

  const votes = useMemo(() => loadVotes(), [scoreTick, showScore]);
  const tally = useMemo(() => computeTally(votes), [votes]);

  const setPaneModel = (idx: number, model: string) =>
    setSelected((prev) => prev.map((m, i) => (i === idx ? model : m)));

  const addPane = () => {
    if (selected.length >= MAX_PANES) return;
    const next = models.find((m) => !selected.includes(m)) || models[0] || "";
    setSelected((prev) => [...prev, next]);
  };
  const removePane = (idx: number) => {
    if (selected.length <= MIN_PANES) return;
    setSelected((prev) => prev.filter((_, i) => i !== idx));
  };

  const run = useCallback(async () => {
    if (!prompt.trim()) { toast.error("Enter a prompt to compare"); return; }
    if (selected.length < MIN_PANES || selected.some((m) => !m)) { toast.error("Pick at least two models"); return; }

    const runId = ++runRef.current;
    const n = selected.length;
    const order = blind ? shuffle([...Array(n).keys()]) : [...Array(n).keys()];

    setAssignment(order);
    setResponses(Array(n).fill(""));
    setPhase("streaming");
    setRevealed(!blind);
    setVoted(null);

    const msgs: ChatMessage[] = [{ id: "u1", role: "user", content: prompt, timestamp: new Date() }];

    await Promise.all(
      order.map((selIdx, dispIdx) =>
        sendMessage(msgs, (t) => {
          if (runRef.current !== runId) return;
          setResponses((prev) => { const c = [...prev]; c[dispIdx] = t; return c; });
        }, 1, selected[selIdx]).catch((e) => {
          if (runRef.current !== runId) return;
          setResponses((prev) => { const c = [...prev]; c[dispIdx] = `⚠ ${e?.message || "failed"}`; return c; });
        })
      )
    );

    if (runRef.current === runId) setPhase("done");
  }, [prompt, selected, blind]);

  const vote = (dispIdx: number | "tie") => {
    if (voted || phase === "idle") return;
    const winner = dispIdx === "tie" ? "tie" : selected[assignment[dispIdx]];
    saveVote({ models: selected, winner, prompt, blind, ts: Date.now() });
    setVoted(winner);
    setRevealed(true);
    setScoreTick((t) => t + 1);
    toast.success(winner === "tie" ? "Recorded a tie" : `Recorded win for ${winner}`);
  };

  const reset = () => {
    runRef.current += 1;
    setResponses([]);
    setAssignment([]);
    setPhase("idle");
    setRevealed(false);
    setVoted(null);
  };

  const clearScoreboard = () => {
    localStorage.removeItem(VOTES_KEY);
    setScoreTick((t) => t + 1);
    toast.success("Scoreboard cleared");
  };

  const realName = (dispIdx: number) => selected[assignment[dispIdx]] ?? "";
  const paneTitle = (dispIdx: number) =>
    revealed ? realName(dispIdx).split(":")[0] : slotLabel(dispIdx);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header / controls */}
      <div className="border-b border-border bg-card p-3 flex items-center gap-3 flex-wrap">
        <Columns2 className="w-4 h-4 text-terminal-cyan" />
        <span className="text-xs font-mono text-terminal-cyan uppercase tracking-wider">Compare</span>
        <div className="flex-1" />

        <label className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)}
            className="w-3 h-3 accent-terminal-cyan" aria-label="Blind mode" />
          Blind mode
        </label>

        <button
          onClick={() => setShowScore(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-terminal-amber/50 bg-terminal-amber/10 text-terminal-amber text-[10px] font-mono hover:bg-terminal-amber/20 transition-all"
        >
          <Trophy className="w-3.5 h-3.5" />
          Scoreboard
        </button>
        <button
          onClick={addPane}
          disabled={selected.length >= MAX_PANES || models.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
          Add model
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {mode !== "local" && (
          <div className="text-[10px] font-mono text-terminal-amber/80 border border-terminal-amber/30 bg-terminal-amber/5 rounded px-3 py-2">
            Compare uses local Ollama models. Switch to <strong>Local Mode</strong> to pit installed models against each other.
          </div>
        )}

        {/* Model selectors */}
        <div className="flex flex-wrap gap-2">
          {selected.map((m, i) => (
            <div key={i} className="flex items-center gap-1 bg-input border border-border rounded px-1.5 py-1">
              <span className="text-[9px] font-mono text-muted-foreground/60 px-1">{slotLabel(i)}</span>
              <select
                aria-label={`${slotLabel(i)} model`}
                value={m}
                onChange={(e) => setPaneModel(i, e.target.value)}
                className="bg-transparent text-[10px] font-mono text-foreground focus:outline-none max-w-[160px]"
              >
                {models.length === 0 && <option value="">No local models</option>}
                {models.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              {selected.length > MIN_PANES && (
                <button aria-label="Remove model" onClick={() => removePane(i)}
                  className="text-muted-foreground/50 hover:text-terminal-red">
                  <Minus className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Prompt + run */}
        <div className="flex gap-2">
          <textarea
            aria-label="Compare prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } }}
            placeholder="Enter a prompt to send to every model… (Ctrl+Enter to run)"
            rows={2}
            className="flex-1 bg-input border border-border rounded px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-terminal-cyan resize-none"
          />
          <div className="flex flex-col gap-2">
            <button
              onClick={run}
              disabled={phase === "streaming" || !prompt.trim() || selected.length < MIN_PANES}
              className="flex items-center gap-1.5 px-4 py-2 rounded border border-terminal-cyan bg-terminal-cyan/10 text-terminal-cyan text-[11px] font-mono hover:bg-terminal-cyan/20 transition-all disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5" />
              {phase === "streaming" ? "Running…" : "Run"}
            </button>
            {phase !== "idle" && (
              <button onClick={reset}
                className="flex items-center gap-1.5 px-4 py-2 rounded border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground transition-all">
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Panes */}
        {assignment.length > 0 && (
          <div className="grid grid-cols-2 gap-3 flex-1">
            {assignment.map((_, dispIdx) => {
              const isWinner = voted && voted !== "tie" && realName(dispIdx) === voted;
              const isLoser = voted && voted !== "tie" && realName(dispIdx) !== voted;
              return (
                <motion.div
                  key={dispIdx}
                  layout
                  className={`flex flex-col border rounded bg-card overflow-hidden transition-all ${
                    isWinner ? "border-primary shadow-[0_0_12px_rgba(34,197,94,0.25)]"
                    : isLoser ? "border-border/40 opacity-60"
                    : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
                    {isWinner && <Crown className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                    <span className={`text-[11px] font-mono font-medium ${isWinner ? "text-primary" : "text-foreground"}`}>
                      {paneTitle(dispIdx)}
                    </span>
                    {isWinner && <span className="text-[8px] font-mono uppercase tracking-widest text-primary">Winner</span>}
                    <div className="flex-1" />
                    {phase !== "idle" && !voted && (
                      <button
                        onClick={() => vote(dispIdx)}
                        disabled={phase === "streaming"}
                        className="text-[9px] font-mono px-2 py-0.5 rounded border border-terminal-cyan/40 text-terminal-cyan hover:bg-terminal-cyan/10 transition-all disabled:opacity-30"
                      >
                        Vote {blind && !revealed ? String.fromCharCode(65 + dispIdx) : "this"}
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 min-h-[180px] max-h-[52vh]">
                    <pre className="text-[11px] font-mono text-foreground/85 whitespace-pre-wrap break-words leading-relaxed">
                      {responses[dispIdx] || (phase === "streaming" ? "▍" : "—")}
                    </pre>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Vote bar */}
        {phase !== "idle" && (
          <div className="flex items-center gap-2 flex-wrap">
            {!voted && (
              <>
                <button
                  onClick={() => vote("tie")}
                  disabled={phase === "streaming"}
                  className="text-[10px] font-mono px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-all disabled:opacity-30"
                >
                  Tie
                </button>
                {blind && !revealed && (
                  <button
                    onClick={() => setRevealed(true)}
                    disabled={phase === "streaming"}
                    className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-all disabled:opacity-30"
                  >
                    <Eye className="w-3 h-3" /> Reveal
                  </button>
                )}
              </>
            )}
            {voted && (
              <span className="text-[10px] font-mono text-primary">
                {voted === "tie" ? "Recorded a tie." : `${voted} won this round.`} Scoreboard updated.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Scoreboard modal */}
      <AnimatePresence>
        {showScore && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowScore(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col bg-card border border-border rounded-lg"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <Trophy className="w-4 h-4 text-terminal-amber" />
                <span className="text-xs font-mono uppercase tracking-wider text-terminal-amber">Scoreboard</span>
                <div className="flex-1" />
                <button onClick={clearScoreboard}
                  className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground hover:text-terminal-red transition-colors">
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
                <button aria-label="Close scoreboard" onClick={() => setShowScore(false)}
                  className="text-muted-foreground hover:text-foreground ml-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {tally.length === 0 ? (
                  <div className="text-center text-[11px] font-mono text-muted-foreground/50 py-10">
                    No votes yet. Run a comparison and vote to build the scoreboard.
                  </div>
                ) : (
                  <table className="w-full text-[10px] font-mono">
                    <thead>
                      <tr className="text-muted-foreground/50 text-left border-b border-border">
                        <th className="py-1.5 font-normal">Model</th>
                        <th className="py-1.5 font-normal text-right">W</th>
                        <th className="py-1.5 font-normal text-right">L</th>
                        <th className="py-1.5 font-normal text-right">T</th>
                        <th className="py-1.5 font-normal text-right">Win %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tally.map((t, i) => (
                        <tr key={t.model} className="border-b border-border/40">
                          <td className="py-1.5 text-foreground flex items-center gap-1.5">
                            {i === 0 && <Crown className="w-3 h-3 text-terminal-amber" />}
                            {t.model.split(":")[0]}
                          </td>
                          <td className="py-1.5 text-right text-primary">{t.wins}</td>
                          <td className="py-1.5 text-right text-terminal-red/70">{t.losses}</td>
                          <td className="py-1.5 text-right text-muted-foreground">{t.ties}</td>
                          <td className="py-1.5 text-right text-foreground">
                            {Math.round((t.wins / Math.max(t.games, 1)) * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {votes.length > 0 && (
                  <div className="mt-3 text-[9px] font-mono text-muted-foreground/40">
                    {votes.length} recorded round{votes.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
