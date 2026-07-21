"""Tests for per-agent Ollama sampling options.

Checks the wiring, not the tuning: that each pipeline agent's options reach the
Ollama payload, that a caller can override defaults, and that num_gpu never
reappears -- ac10f5f removed the forced full-GPU offload because it was the
main cause of pathological first-token latency, and the WIP this was ported
from still carried it.

Run: python backend/test_agent_sampling.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import main  # noqa: E402

PIPELINE_AGENTS = ["Planner", "Researcher", "Developer", "Critic", "Supervisor"]


class FakeResponse:
    status_code = 200

    @staticmethod
    def json():
        return {"message": {"content": "ok"}}


class FakeClient:
    """Captures the payload instead of talking to Ollama."""

    def __init__(self):
        self.payload = None

    async def post(self, url, json=None, timeout=None):
        self.payload = json
        return FakeResponse()


def capture(**kwargs) -> dict:
    """Call ollama_chat_text with a stubbed client, return the options sent."""
    client = FakeClient()

    async def fake_get_client():
        return client

    saved = main.get_ollama_client
    main.get_ollama_client = fake_get_client
    try:
        asyncio.run(main.ollama_chat_text([{"role": "user", "content": "hi"}], **kwargs))
    finally:
        main.get_ollama_client = saved
    return client.payload["options"]


# ── the options table ────────────────────────────────────────────────────────

def test_every_pipeline_agent_has_options():
    for agent in PIPELINE_AGENTS:
        assert agent in main.AGENT_OLLAMA_OPTIONS, f"{agent} missing"
    assert "default" in main.AGENT_OLLAMA_OPTIONS


def test_every_agent_carries_a_repeat_penalty():
    """The point of the table: no role should be able to ramble."""
    for agent, opts in main.AGENT_OLLAMA_OPTIONS.items():
        assert "repeat_penalty" in opts, f"{agent} has no repeat_penalty"
        assert 1.0 <= opts["repeat_penalty"] <= 1.3, f"{agent}: {opts['repeat_penalty']}"


def test_no_agent_forces_gpu_layers():
    """ac10f5f removed forced full-GPU offload; the WIP this came from kept it."""
    for agent, opts in main.AGENT_OLLAMA_OPTIONS.items():
        assert "num_gpu" not in opts, f"{agent} reintroduces num_gpu"


def test_planner_context_is_smaller_than_developer():
    """Planner only emits JSON; a small ctx is what makes its TTFT fast."""
    planner = main.AGENT_OLLAMA_OPTIONS["Planner"]["num_ctx"]
    developer = main.AGENT_OLLAMA_OPTIONS["Developer"]["num_ctx"]
    assert planner < developer, f"planner {planner} !< developer {developer}"


# ── the wiring ───────────────────────────────────────────────────────────────

def test_options_reach_the_payload():
    opts = capture(extra_options=main.AGENT_OLLAMA_OPTIONS["Planner"])
    for key, value in main.AGENT_OLLAMA_OPTIONS["Planner"].items():
        assert opts[key] == value, f"{key}: {opts.get(key)} != {value}"


def test_defaults_survive_when_no_options_given():
    opts = capture(max_tokens=123, temperature=0.4)
    assert opts["num_predict"] == 123
    assert opts["temperature"] == 0.4
    assert opts["num_keep"] == 256          # v3.5 KV cache reuse
    assert "num_gpu" not in opts


def test_extra_options_override_defaults():
    opts = capture(max_tokens=123, extra_options={"num_predict": 999})
    assert opts["num_predict"] == 999, "extra_options must be applied last"


def test_payload_never_contains_num_gpu():
    for agent in PIPELINE_AGENTS:
        opts = capture(extra_options=main.AGENT_OLLAMA_OPTIONS[agent])
        assert "num_gpu" not in opts, f"{agent} payload forces GPU layers"


def test_unknown_agent_falls_back_to_default():
    """The call site uses .get(agent, default); an unrecognized agent must not
    KeyError its way out of a subtask."""
    chosen = main.AGENT_OLLAMA_OPTIONS.get("Nonexistent", main.AGENT_OLLAMA_OPTIONS["default"])
    assert chosen is main.AGENT_OLLAMA_OPTIONS["default"]


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
