# Sub-team Pre-passes (Architect + Critic Committee) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Developer agent an Architect pre-pass and the Critic agent a Reviewer+Auditor committee pre-pass, replacing the generic `thinking_loop` for those two agents.

**Architecture:** Two module-level async functions in `backend/main.py`, placed beside the existing pre-passes (`thinking_loop`, `thought_graph`), each returning a brief string or `""`. A small routing helper decides which pre-pass an agent gets, and the per-agent loop in the chat SSE generator dispatches on it and injects the brief as a system message before the agent's own LLM call.

**Tech Stack:** Python 3.13, FastAPI, httpx, Ollama HTTP API. Tests are plain `python backend/test_*.py` scripts with a `__main__` runner — this repo does not use pytest.

**Spec:** `docs/superpowers/specs/2026-07-21-subteam-prepass-design.md`

## Global Constraints

- Tests are standalone scripts run as `python backend/test_<name>.py`, ending with the `__main__` runner block used by every existing suite. **No pytest.**
- Micro-agents use the **parent agent's model** — never load a different model.
- `SUBTEAM_OLLAMA_OPTIONS` = `{"num_ctx": 1024, "repeat_penalty": 1.1, "top_k": 10, "top_p": 0.9, "num_keep": 0}`. **Never add `num_gpu`** — `ac10f5f` removed forced GPU offload and it must not come back.
- Budgets: Architect 200, Reviewer 120, Auditor 120. No `Scout`/`Analyst`/`Verifier` entries.
- **The two new pre-passes only** (`architect_brief`, `committee_brief`): time-bounded at 25s, return `""` on failure, log failures via `_logger.warning` rather than `except: pass`, and never raise into the pipeline.
- **The two existing pre-passes are moved into the new branch structure unchanged.** `thought_graph` keeps its 90s cap, `thinking_loop` its 40s, and both keep their current `except Exception: pass`. This is deliberate: rewriting merged, working code is out of scope for this port, so the constraint above does not bind them.
- `thought_graph` itself and the Researcher routing are **not** modified.

## File Structure

| File | Responsibility |
|---|---|
| `backend/main.py` | Constants (~line 1792), the two pre-pass functions + routing helper (~line 2130, after `thought_graph`, before `run_pipeline`), and the dispatch in the SSE per-agent loop (~line 4055) |
| `backend/test_subteam.py` | New. Covers both pre-pass functions and the routing helper |

---

### Task 1: Constants and `architect_brief`

**Files:**
- Modify: `backend/main.py` (constants after the `AGENT_OLLAMA_OPTIONS` block, ~line 1792; function after `thought_graph`, ~line 2130)
- Test: `backend/test_subteam.py` (create)

**Interfaces:**
- Consumes: `main.ollama_chat_text(messages, model=..., temperature=..., max_tokens=..., extra_options=...) -> str`, `main._logger`
- Produces: `main.SUBTEAM_MAX_TOKENS: dict[str, int]`, `main.SUBTEAM_OLLAMA_OPTIONS: dict`, `async main.architect_brief(task: str, model: str) -> str`

- [ ] **Step 1: Write the failing test**

Create `backend/test_subteam.py`:

```python
"""Tests for the sub-team pre-passes (Architect, Critic Committee).

These check wiring, not answer quality: that briefs are built from the right
prompts under the right budgets, that failures degrade to "" instead of raising
into the pipeline, and that routing sends each agent to exactly one pre-pass.

Run: python backend/test_subteam.py
"""

from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import main  # noqa: E402


def fake_chat(reply="brief text", delay=0.0, fail=False, record=None):
    """Stand-in for ollama_chat_text. Records how it was called."""
    async def _chat(messages, model=None, temperature=0.7, max_tokens=2048,
                    extra_options=None):
        if record is not None:
            record.append({
                "messages": messages, "model": model,
                "max_tokens": max_tokens, "extra_options": extra_options,
            })
        if delay:
            await asyncio.sleep(delay)
        if fail:
            raise RuntimeError("ollama is down")
        return reply
    return _chat


def with_chat(chat, coro_factory):
    """Run coro_factory() with ollama_chat_text swapped out."""
    saved = main.ollama_chat_text
    main.ollama_chat_text = chat
    try:
        return asyncio.run(coro_factory())
    finally:
        main.ollama_chat_text = saved


# ── budgets and options ──────────────────────────────────────────────────────

def test_subteam_budgets_are_defined_for_the_ported_roles_only():
    assert main.SUBTEAM_MAX_TOKENS["Architect"] == 200
    assert main.SUBTEAM_MAX_TOKENS["Reviewer"] == 120
    assert main.SUBTEAM_MAX_TOKENS["Auditor"] == 120
    for dropped in ["Scout", "Analyst", "Verifier"]:
        assert dropped not in main.SUBTEAM_MAX_TOKENS, \
            f"{dropped} is unused -- the Research Team was not ported"


def test_subteam_options_never_force_gpu_layers():
    """ac10f5f removed forced full-GPU offload; it must not return here."""
    assert "num_gpu" not in main.SUBTEAM_OLLAMA_OPTIONS
    assert main.SUBTEAM_OLLAMA_OPTIONS["num_ctx"] == 1024


# ── architect_brief ──────────────────────────────────────────────────────────

def test_architect_brief_returns_the_model_text():
    got = with_chat(fake_chat("- component A\n- decision B"),
                    lambda: main.architect_brief("build a parser", "llama3.2:3b"))
    assert got == "- component A\n- decision B"


def test_architect_brief_uses_the_architect_budget_and_subteam_options():
    calls = []
    with_chat(fake_chat(record=calls),
              lambda: main.architect_brief("build a parser", "qwen2.5-coder:latest"))
    assert len(calls) == 1
    assert calls[0]["max_tokens"] == main.SUBTEAM_MAX_TOKENS["Architect"]
    assert calls[0]["extra_options"] == main.SUBTEAM_OLLAMA_OPTIONS
    assert calls[0]["model"] == "qwen2.5-coder:latest"


def test_architect_brief_asks_for_no_code():
    calls = []
    with_chat(fake_chat(record=calls),
              lambda: main.architect_brief("build a parser", "llama3.2:3b"))
    system = calls[0]["messages"][0]["content"].lower()
    assert "no code" in system
    assert "build a parser" in calls[0]["messages"][1]["content"]


def test_architect_brief_returns_empty_on_failure():
    got = with_chat(fake_chat(fail=True),
                    lambda: main.architect_brief("build a parser", "llama3.2:3b"))
    assert got == ""


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items())
             if n.startswith("test_") and callable(f)]
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  PASS  {name}")
        except Exception as e:
            failed += 1
            print(f"  FAIL  {name}: {type(e).__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python backend/test_subteam.py`
Expected: FAIL on all six — `AttributeError: module 'main' has no attribute 'SUBTEAM_MAX_TOKENS'` and `... 'architect_brief'`.

- [ ] **Step 3: Add the constants**

In `backend/main.py`, immediately after the closing `}` of the `AGENT_OLLAMA_OPTIONS` block (~line 1791) and before `class Subtask(BaseModel):`:

```python


# Sub-team micro-agents: short focused pre-passes that brief a main agent before
# it runs. Tight budgets on purpose -- a brief is advisory context, not output.
# Only the roles actually used are listed; the April version also carried
# Scout/Analyst/Verifier entries for a Research Team that thought_graph already
# covers, and unused constants are how that set went stale.
SUBTEAM_MAX_TOKENS: dict[str, int] = {
    "Architect": 200,   # 3 bullets of design, no code
    "Reviewer":  120,   # correctness pass
    "Auditor":   120,   # quality pass
}

# No num_gpu: ac10f5f removed the forced full-GPU offload that caused
# pathological first-token latency. Layer placement stays Ollama's decision.
SUBTEAM_OLLAMA_OPTIONS: dict = {
    "num_ctx":        1024,   # micro-agents see one task, not a conversation
    "repeat_penalty": 1.1,
    "top_k":          10,
    "top_p":          0.9,
    "num_keep":       0,
}
```

- [ ] **Step 4: Add `architect_brief`**

In `backend/main.py`, after `thought_graph` ends and before `async def run_pipeline(` (~line 2130):

```python


# ── Sub-team pre-passes ───────────────────────────────────────────────────────
# Same shape as thinking_loop/thought_graph above: run a cheap focused call,
# return text the caller injects as a system brief, never raise.

async def architect_brief(task: str, model: str) -> str:
    """Design pre-pass for the Developer agent.

    Returns a short technical approach, or "" if it could not be produced --
    the brief is an enhancement, so the agent still runs without it.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are a Software Architect. Design a concise technical approach: "
                "key components and decisions in 3 bullet points max. No code. "
                "Never repeat yourself."
            ),
        },
        {"role": "user", "content": f"Design the approach for: {task}"},
    ]
    try:
        brief = await asyncio.wait_for(
            ollama_chat_text(
                messages,
                model=model,
                max_tokens=SUBTEAM_MAX_TOKENS["Architect"],
                extra_options=SUBTEAM_OLLAMA_OPTIONS,
            ),
            timeout=25,
        )
        return brief or ""
    except Exception as e:
        _logger.warning(f"[architect_brief] Failed, continuing without it: {e}")
        return ""
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python backend/test_subteam.py`
Expected: `6/6 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/test_subteam.py
git commit -m "feat: Architect pre-pass for the Developer agent"
```

---

### Task 2: `committee_brief`

**Files:**
- Modify: `backend/main.py` (append after `architect_brief`)
- Test: `backend/test_subteam.py` (append tests before the `__main__` block)

**Interfaces:**
- Consumes: `main.SUBTEAM_MAX_TOKENS`, `main.SUBTEAM_OLLAMA_OPTIONS`, `main.ollama_chat_text`, `main._logger`
- Produces: `async main.committee_brief(prior_output: str, model: str) -> str`

- [ ] **Step 1: Write the failing test**

In `backend/test_subteam.py`, insert before the `if __name__ == "__main__":` block:

```python
# ── committee_brief ──────────────────────────────────────────────────────────

def test_committee_brief_combines_both_roles():
    got = with_chat(fake_chat("finding"),
                    lambda: main.committee_brief("def f(): pass", "llama3.2:3b"))
    assert "[Reviewer]" in got
    assert "[Auditor]" in got
    assert got.count("finding") == 2


def test_committee_brief_runs_its_two_roles_in_parallel():
    """Serial execution would take ~0.4s; parallel should be ~0.2s."""
    started = time.monotonic()
    with_chat(fake_chat("finding", delay=0.2),
              lambda: main.committee_brief("def f(): pass", "llama3.2:3b"))
    elapsed = time.monotonic() - started
    assert elapsed < 0.35, f"took {elapsed:.2f}s -- roles ran serially"


def test_committee_brief_uses_the_reviewer_and_auditor_budgets():
    calls = []
    with_chat(fake_chat(record=calls),
              lambda: main.committee_brief("def f(): pass", "llama3.2:3b"))
    assert len(calls) == 2
    assert {c["max_tokens"] for c in calls} == {main.SUBTEAM_MAX_TOKENS["Reviewer"],
                                                main.SUBTEAM_MAX_TOKENS["Auditor"]}
    for c in calls:
        assert c["extra_options"] == main.SUBTEAM_OLLAMA_OPTIONS


def test_committee_brief_skips_entirely_without_prior_output():
    """The April version reviewed the empty string, spending two calls to
    produce a brief about nothing."""
    calls = []
    got = with_chat(fake_chat(record=calls),
                    lambda: main.committee_brief("", "llama3.2:3b"))
    assert got == ""
    assert calls == [], "no prior output means no committee calls"


def test_committee_brief_truncates_long_prior_output():
    calls = []
    with_chat(fake_chat(record=calls),
              lambda: main.committee_brief("x" * 5000, "llama3.2:3b"))
    for c in calls:
        assert len(c["messages"][1]["content"]) < 1000


def test_committee_brief_returns_empty_on_failure():
    got = with_chat(fake_chat(fail=True),
                    lambda: main.committee_brief("def f(): pass", "llama3.2:3b"))
    assert got == ""
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python backend/test_subteam.py`
Expected: the six new tests FAIL with `AttributeError: module 'main' has no attribute 'committee_brief'`; the six from Task 1 still pass.

- [ ] **Step 3: Write the implementation**

In `backend/main.py`, immediately after `architect_brief`:

```python


async def committee_brief(prior_output: str, model: str) -> str:
    """Review pre-pass for the Critic agent: correctness and quality, in parallel.

    Returns "" when there is nothing to review -- the April version defaulted a
    missing dependency result to "" and reviewed that, spending two calls to
    produce a brief about nothing.
    """
    if not prior_output.strip():
        return ""

    excerpt = prior_output[:800]
    reviewer_msgs = [
        {
            "role": "system",
            "content": (
                "You are a Code Reviewer. Check for correctness, logic errors, "
                "missing cases. Be concise. Never repeat yourself."
            ),
        },
        {"role": "user", "content": f"Review this output for correctness:\n{excerpt}"},
    ]
    auditor_msgs = [
        {
            "role": "system",
            "content": (
                "You are a Quality Auditor. Check for clarity, completeness, "
                "best practices. Be concise. Never repeat yourself."
            ),
        },
        {"role": "user", "content": f"Audit this output for quality:\n{excerpt}"},
    ]
    try:
        reviewer, auditor = await asyncio.wait_for(
            asyncio.gather(
                ollama_chat_text(
                    reviewer_msgs, model=model,
                    max_tokens=SUBTEAM_MAX_TOKENS["Reviewer"],
                    extra_options=SUBTEAM_OLLAMA_OPTIONS,
                ),
                ollama_chat_text(
                    auditor_msgs, model=model,
                    max_tokens=SUBTEAM_MAX_TOKENS["Auditor"],
                    extra_options=SUBTEAM_OLLAMA_OPTIONS,
                ),
            ),
            timeout=25,   # the April version had no timeout on this gather
        )
        return f"[Reviewer]\n{reviewer}\n\n[Auditor]\n{auditor}"
    except Exception as e:
        _logger.warning(f"[committee_brief] Failed, continuing without it: {e}")
        return ""
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python backend/test_subteam.py`
Expected: `12/12 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/test_subteam.py
git commit -m "feat: Reviewer+Auditor committee pre-pass for the Critic agent"
```

---

### Task 3: Route agents to their pre-pass

**Files:**
- Modify: `backend/main.py` (routing helper after `committee_brief`; dispatch in the SSE per-agent loop, currently ~lines 4055-4083)
- Test: `backend/test_subteam.py` (append tests before the `__main__` block)

**Interfaces:**
- Consumes: `main._needs_thinking(text) -> bool`, `main.architect_brief`, `main.committee_brief`
- Produces: `main._prepass_kind(agent: str, task: str, has_prior: bool = False) -> str | None` returning one of `"thought_graph"`, `"architect"`, `"committee"`, `"thinking_loop"`, or `None`

**Note on the helper:** the spec describes the routing as an `elif` chain inline. Extracting the decision into `_prepass_kind` keeps behaviour identical while making the spec's routing tests possible without running the SSE generator, which is otherwise reachable only through a live HTTP request. `has_prior` is threaded in so a Critic with no dependency result falls back to `thinking_loop` rather than losing its pre-pass entirely.

- [ ] **Step 1: Write the failing test**

In `backend/test_subteam.py`, insert before the `if __name__ == "__main__":` block:

```python
# ── routing ──────────────────────────────────────────────────────────────────

LONG_TASK = "explain how to implement a resilient retry policy for flaky HTTP calls"


def test_researcher_still_routes_to_thought_graph():
    assert main._prepass_kind("Researcher", LONG_TASK) == "thought_graph"


def test_developer_routes_to_architect_not_thinking_loop():
    assert main._prepass_kind("Developer", LONG_TASK) == "architect"


def test_critic_with_prior_output_routes_to_committee():
    assert main._prepass_kind("Critic", LONG_TASK, has_prior=True) == "committee"


def test_critic_without_prior_output_falls_back_to_thinking_loop():
    """No dependency result means nothing to review, but the agent should not
    lose its pre-pass altogether."""
    assert main._prepass_kind("Critic", LONG_TASK, has_prior=False) == "thinking_loop"


def test_planner_and_supervisor_still_use_thinking_loop():
    for agent in ["Planner", "Supervisor"]:
        assert main._prepass_kind(agent, LONG_TASK) == "thinking_loop"


def test_short_simple_task_gets_no_prepass_for_generic_agents():
    assert main._prepass_kind("Supervisor", "hi") is None


def test_specialised_agents_get_their_prepass_even_for_short_tasks():
    """Developer and Critic are routed by role, not by _needs_thinking."""
    assert main._prepass_kind("Developer", "hi") == "architect"
    assert main._prepass_kind("Critic", "hi", has_prior=True) == "committee"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python backend/test_subteam.py`
Expected: the seven new tests FAIL with `AttributeError: module 'main' has no attribute '_prepass_kind'`; the 12 earlier tests still pass.

- [ ] **Step 3: Write the routing helper**

In `backend/main.py`, immediately after `committee_brief`:

```python


def _prepass_kind(agent: str, task: str, has_prior: bool = False) -> str | None:
    """Which reasoning pre-pass runs before this agent, if any.

    Developer and Critic are routed by role: their specialised briefs replace
    the generic thinking_loop rather than stacking on it, so each agent carries
    exactly one brief. A Critic with no dependency result has nothing to review
    and falls back to the generic pre-pass.
    """
    if agent == "Researcher":
        return "thought_graph"
    if agent == "Developer":
        return "architect"
    if agent == "Critic" and has_prior:
        return "committee"
    if _needs_thinking(task):
        return "thinking_loop"
    return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python backend/test_subteam.py`
Expected: `19/19 passed`

- [ ] **Step 5: Wire the dispatch into the SSE loop**

In `backend/main.py`, replace the block that currently begins with the comment
`# ── CoT: inject structured reasoning before LLM call ──────────` and ends with the
`think_done` yield of the `_needs_thinking` branch (currently ~lines 4054-4083, immediately
above `token_queue: asyncio.Queue = asyncio.Queue()`) with:

```python
                                    # ── Pre-pass: brief the agent before it runs ──────────────────
                                    _prior_id = next((dep for dep in st.depends_on
                                                      if dep in subtask_results), "")
                                    _prior = subtask_results.get(_prior_id, "")
                                    _kind = _prepass_kind(st.agent, st.task, has_prior=bool(_prior))

                                    if _kind == "thought_graph":
                                        # Thought Graph: parallel reasoning paths for research tasks
                                        think_start = {"type": "step", "agent": st.agent, "text": "Exploring reasoning paths", "status": "start", "phase": "THINKING", "detail": "Generating multi-perspective analysis"}
                                        yield f"data: {json.dumps(think_start)}\n\n"
                                        try:
                                            _thought = await asyncio.wait_for(
                                                thought_graph(st.task, model=agent_model, n_paths=3),
                                                timeout=90,
                                            )
                                            if _thought:
                                                _agent_msgs.insert(-1, {"role": "system", "content": f"[THOUGHT GRAPH — best reasoning path]\n{_thought}"})
                                        except Exception:
                                            pass
                                        think_done = {"type": "step", "agent": st.agent, "text": "Reasoning paths evaluated", "status": "done", "phase": "THINKING"}
                                        yield f"data: {json.dumps(think_done)}\n\n"

                                    elif _kind == "architect":
                                        arch_start = {"type": "step", "agent": st.agent, "text": "Architect designing solution", "status": "start", "phase": "THINKING", "detail": "High-level design before implementation"}
                                        yield f"data: {json.dumps(arch_start)}\n\n"
                                        _arch = await architect_brief(st.task, agent_model)
                                        if _arch:
                                            _agent_msgs.insert(-1, {"role": "system", "content": f"[ARCHITECT BRIEF]\n{_arch}"})
                                        arch_done = {"type": "step", "agent": st.agent, "text": "Architecture ready", "status": "done", "phase": "THINKING"}
                                        yield f"data: {json.dumps(arch_done)}\n\n"

                                    elif _kind == "committee":
                                        crit_start = {"type": "step", "agent": st.agent, "text": "Critic committee reviewing", "status": "start", "phase": "THINKING", "detail": "Reviewer · Auditor"}
                                        yield f"data: {json.dumps(crit_start)}\n\n"
                                        _committee = await committee_brief(_prior, agent_model)
                                        if _committee:
                                            _agent_msgs.insert(-1, {"role": "system", "content": f"[COMMITTEE BRIEF]\n{_committee}"})
                                        crit_done = {"type": "step", "agent": st.agent, "text": "Committee brief ready", "status": "done", "phase": "THINKING"}
                                        yield f"data: {json.dumps(crit_done)}\n\n"

                                    elif _kind == "thinking_loop":
                                        # Structured CoT for complex tasks
                                        think_start = {"type": "step", "agent": st.agent, "text": "Structured reasoning", "status": "start", "phase": "THINKING", "detail": "OBSERVE → ANALYZE → PLAN → VERIFY"}
                                        yield f"data: {json.dumps(think_start)}\n\n"
                                        try:
                                            _thought = await asyncio.wait_for(
                                                thinking_loop(st.task, model=agent_model),
                                                timeout=40,
                                            )
                                            if _thought:
                                                _agent_msgs.insert(-1, {"role": "system", "content": f"[REASONING]\n{_thought}"})
                                        except Exception:
                                            pass
                                        think_done = {"type": "step", "agent": st.agent, "text": "Reasoning complete", "status": "done", "phase": "THINKING"}
                                        yield f"data: {json.dumps(think_done)}\n\n"
```

`architect_brief` and `committee_brief` swallow their own failures and return `""`, so the
`done` event always fires and neither needs a `try` at the call site.

- [ ] **Step 6: Verify nothing else broke**

Run each suite; all must pass:

```bash
python backend/test_subteam.py
python backend/test_model_selection.py
python backend/test_startup_banner.py
python backend/test_agent_sampling.py
python backend/test_tools_shell.py
python backend/test_code_sandbox.py
python backend/test_vault.py
python backend/test_vault_resolution.py
```

Expected: `19/19`, `9/9`, `8/8`, `9/9`, `13/13`, `6/6`, `18/18`, `8/8`.

- [ ] **Step 7: Verify against the running backend**

The dev server reloads on save. Confirm it came back clean and that a Developer subtask now
emits the Architect step:

```bash
curl -s -m 10 http://127.0.0.1:8000/api/health | head -c 60
grep -nE "Traceback|Error" "D:/AI/Project ECHO/backend_err.txt" | tail -5
```

Expected: health returns `{"backend":"online"...}`; no new tracebacks beyond reload-teardown
`CancelledError` (which is normal for `--reload` on Windows and always followed by
`Application startup complete`).

- [ ] **Step 8: Commit**

```bash
git add backend/main.py backend/test_subteam.py
git commit -m "feat: route Developer and Critic to their specialised pre-passes"
```

---

## Done when

- `python backend/test_subteam.py` reports `19/19 passed`, and the seven other suites are unchanged.
- A Developer subtask emits `Architect designing solution` → `Architecture ready`, and a Critic subtask with a dependency result emits `Critic committee reviewing` → `Committee brief ready`.
- Researcher still emits `Exploring reasoning paths`; Planner and Supervisor still emit `Structured reasoning`.

## Deliberately not done

- The Research Team (Scout / Analyst / Verifier) — `thought_graph` already covers it.
- Any frontend change — the SSE `step` shape is unchanged, so `ThinkingSteps` renders these already.
- Any judgement about whether the briefs improve output quality. The tests prove the mechanism, not the benefit; that needs a subjective comparison after merge.
