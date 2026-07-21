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


def test_subteam_options_never_force_gpu_layers_or_reload_the_runner():
    """ac10f5f removed forced full-GPU offload; it must not return here.
    num_ctx must also stay absent: setting it forces an Ollama model
    runner reload (~7s) for the pre-pass and again for the agent call
    that follows it, so the pre-pass should inherit the caller's context."""
    assert "num_gpu" not in main.SUBTEAM_OLLAMA_OPTIONS
    assert "num_ctx" not in main.SUBTEAM_OLLAMA_OPTIONS


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


# ── committee input selection ────────────────────────────────────────────────

def test_pick_prior_prefers_the_developers_output():
    """Researcher + Developer -> Critic is a shape the planner produces; the
    committee must review the code, not the prose."""
    got = main._pick_prior(
        ["t1", "t2"],
        {"t1": "research prose", "t2": "def f(): pass"},
        {"t1": "Researcher", "t2": "Developer"},
    )
    assert got == "def f(): pass"


def test_pick_prior_finds_the_developer_in_any_position():
    got = main._pick_prior(
        ["t1", "t2"],
        {"t1": "def f(): pass", "t2": "research prose"},
        {"t1": "Developer", "t2": "Researcher"},
    )
    assert got == "def f(): pass"


def test_pick_prior_falls_back_to_the_most_recent_dependency():
    got = main._pick_prior(
        ["t1", "t2"],
        {"t1": "first", "t2": "second"},
        {"t1": "Researcher", "t2": "Planner"},
    )
    assert got == "second"


def test_pick_prior_ignores_unsatisfied_dependencies():
    got = main._pick_prior(
        ["t1", "t2", "t3"],
        {"t2": "only this one ran"},
        {"t1": "Developer", "t2": "Researcher", "t3": "Developer"},
    )
    assert got == "only this one ran"


def test_pick_prior_returns_empty_when_nothing_is_satisfied():
    assert main._pick_prior(["t1"], {}, {"t1": "Developer"}) == ""


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
