# Sub-team pre-passes: Architect and Critic Committee

**Date:** 2026-07-21
**Status:** Approved, ready for implementation plan

## Problem

`AGENT_SPECIFIC_PROMPTS` gives each pipeline agent a role, but only the Researcher gets a
specialized reasoning pre-pass (`thought_graph`). Developer and Critic fall through to the
generic `thinking_loop` (OBSERVE → ANALYZE → PLAN → VERIFY), which is not shaped for
"design before you code" or "review from two angles".

A sub-team pipeline was written for this in April (commit `10c7789`, preserved at
`refs/pull/6/head` after PR #6 was closed) but never merged: it was based on code ~60
commits behind and conflicted. This is a re-port of the parts that are still additive.

## Scope

**In:**
- Architect pre-pass for Developer
- Reviewer + Auditor committee pre-pass for Critic

**Out — and why:**
- **The Research Team (Scout / Analyst / Verifier) is not ported.** `thought_graph` already
  occupies that slot and does the same thing: three parallel LLM calls with different
  framings, injected as a brief before the Researcher runs. Its third perspective
  ("assumptions, counter-arguments, and edge cases") is nearly the Verifier's brief. The
  only real difference is that `thought_graph` selects the best path while the Research
  Team concatenates all three — not worth running two overlapping mechanisms for.
- `SUBTEAM_MAX_TOKENS` entries for Scout / Analyst / Verifier. Unused constants are how the
  original set went stale.
- No UI work. SSE events reuse the existing `step` shape, which `ThinkingSteps` renders.
- No toggle. The existing pre-passes are unconditional; adding a switch for only this one
  would be inconsistent.

## Design

### Control flow

In the per-agent loop of the chat SSE generator (`backend/main.py`, currently ~line 4055):

```python
if   st.agent == "Researcher":  thought_graph      → [THOUGHT GRAPH]   # unchanged
elif st.agent == "Developer":   architect_brief    → [ARCHITECT BRIEF] # new
elif st.agent == "Critic":      committee_brief    → [COMMITTEE BRIEF] # new
elif _needs_thinking(st.task):  thinking_loop      → [REASONING]       # Planner/Supervisor
```

The two new branches sit **before** the `_needs_thinking` branch, so for Developer and
Critic the specialized pre-pass *replaces* the generic one rather than stacking. Each agent
carries exactly one brief. `_needs_thinking` fires on any task over 80 characters, so
stacking would have added a sequential pre-pass to nearly every request.

### Components

Two module-level async functions in `backend/main.py`, beside `thinking_loop` and
`thought_graph` — the established pattern for pre-passes, keeping the family discoverable in
one place. Both return a brief string, or `""` when unavailable.

**`architect_brief(task: str, model: str) -> str`**
One call. System prompt: a Software Architect producing key components and decisions in at
most 3 bullets, no code. Budget `SUBTEAM_MAX_TOKENS["Architect"]` = 200, 25s timeout.

**`committee_brief(prior_output: str, model: str) -> str`**
Two calls via `asyncio.gather`:
- Reviewer — correctness, logic errors, missing cases
- Auditor — clarity, completeness, best practices

Each `SUBTEAM_MAX_TOKENS` 120, over `prior_output[:800]`, 25s timeout on the pair. Returns
`[Reviewer]\n...\n\n[Auditor]\n...`.

Both use the parent agent's model (already warm from startup pre-warming, no extra VRAM on
an 11 GB card) and `SUBTEAM_OLLAMA_OPTIONS`: `num_ctx` 1024, `repeat_penalty` 1.1,
`top_k` 10, `top_p` 0.9, `num_keep` 0.

### Data flow

The caller injects the brief the same way the existing pre-passes do:

```python
_agent_msgs.insert(-1, {"role": "system", "content": f"[ARCHITECT BRIEF]\n{brief}"})
```

— after the conversation history, before the task message. SSE `step` events (`status:
"start"` then `"done"`, `phase: "THINKING"`) bracket each pre-pass, matching the existing
events exactly. The user-visible strings, carried over from the original:

| Agent | start `text` | start `detail` | done `text` |
|---|---|---|---|
| Developer | Architect designing solution | High-level design before implementation | Architecture ready |
| Critic | Critic committee reviewing | Reviewer · Auditor | Committee brief ready |

The Critic's `prior_output` is resolved from `st.depends_on` against `subtask_results`, as
the original did.

### Error handling

- **No prior output means no committee.** The original defaulted `prior` to `""` and
  reviewed the empty string — two calls producing a brief about nothing. If no dependency
  result is available, skip the pre-pass.
- **Both pre-passes are time-bounded.** The original capped only the Architect; the
  committee's `gather` had no timeout, so a stalled micro-agent could hang the pipeline.
- **Failures log and degrade.** The original used `except Exception: pass`. A brief is an
  enhancement, not a dependency, so failing without it is correct — but it must be visible.
  Catch, log a warning, continue with no brief. The `done` SSE event fires either way so the
  UI never waits on an event that will not arrive.

### Testing

`backend/test_subteam.py`, monkeypatching `ollama_chat_text` so nothing contacts Ollama —
the pattern used by `test_agent_sampling.py`.

- `architect_brief` returns the model's text; its prompt forbids code
- `committee_brief` issues both roles concurrently and combines them under `[Reviewer]` /
  `[Auditor]` headings
- committee is skipped entirely when there is no prior output
- a failing or timing-out micro-agent yields `""` and logs, never raises
- token budgets and sampling options are the values specified above
- routing: Developer and Critic no longer reach `thinking_loop`; Researcher still routes to
  `thought_graph`; Planner and Supervisor still reach `thinking_loop`

### Performance

Measured on this machine today (GTX 1080 Ti, 11 GB): `qwen2.5-coder:latest` ~34 tok/s,
`llama3.2:3b` ~69 tok/s, both fully on GPU.

- Developer: 1 pre-pass call → 1 pre-pass call, tighter cap (200 tokens ≈ 6s)
- Critic: 1 pre-pass call → 2 parallel calls (120 tokens each ≈ 2s wall)

Roughly flat, worst case ~+2s on the Critic step.

## Risks

- **Quality is unverified.** Whether an Architect brief improves Developer output is a
  judgement call that these tests cannot make. The mechanism is testable; the benefit is
  not. Worth a subjective comparison after merge.
- **Small models may ignore tight budgets.** A 120-token Auditor on a 3B model can produce a
  truncated sentence. Acceptable — the brief is advisory context, not parsed output.
