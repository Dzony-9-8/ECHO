"""Tests for agent model selection and availability.

The bug these guard: AGENT_MODEL_MAP pointed Developer at qwen2.5-coder:3b,
which was not installed. select_model returned the preferred model unchecked,
Ollama answered 404, ollama_chat_text returns "" on any non-200 -- so the code
writing agent contributed nothing to every request, and startup printed
"[OK] Pre-warmed model: qwen2.5-coder:3b" because httpx does not raise on 404.

Run: python backend/test_model_selection.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import main  # noqa: E402

# What `ollama list` actually has on this machine, embedding model included.
INSTALLED = [
    "nomic-embed-text:latest",
    "qwen2.5-coder:14b",
    "qwen2.5-coder:latest",
    "llama3.2:3b",
    "llama3.2:1b",
    "dolphin3:latest",
]


def with_available(models: list[str], task: str = "write a function", preferred=None) -> str:
    """Run select_model against a fixed installed-model list."""
    async def fake_get_loaded_models():
        return list(models)

    saved = main.get_loaded_models
    main.get_loaded_models = fake_get_loaded_models
    try:
        return asyncio.run(main.select_model(task, preferred))
    finally:
        main.get_loaded_models = saved


# ── the configuration itself ─────────────────────────────────────────────────

def test_every_agent_model_is_installed():
    """The original bug, stated directly."""
    for agent, model in main.AGENT_MODEL_MAP.items():
        assert main._is_installed(model, INSTALLED), \
            f"{agent} -> {model} is not installed; its subtasks would 404"


def test_no_agent_is_pointed_at_an_embedding_model():
    for agent, model in main.AGENT_MODEL_MAP.items():
        assert main._is_chat_model(model), f"{agent} -> {model} cannot chat"


# ── select_model ─────────────────────────────────────────────────────────────

def test_installed_preferred_model_is_used():
    assert with_available(INSTALLED, preferred="qwen2.5-coder:latest") == "qwen2.5-coder:latest"


def test_uninstalled_preferred_model_falls_back():
    """Previously returned qwen2.5-coder:3b unchecked, guaranteeing a 404."""
    got = with_available(INSTALLED, preferred="qwen2.5-coder:3b")
    assert got != "qwen2.5-coder:3b"
    assert main._is_installed(got, INSTALLED), got
    assert got == main.AGENT_MODEL_MAP["default"]


def test_preferred_model_is_trusted_when_availability_is_unknown():
    """An empty list means the tags query failed; a transient Ollama blip must
    not silently repoint every agent."""
    assert with_available([], preferred="qwen2.5-coder:latest") == "qwen2.5-coder:latest"


def test_fallback_never_returns_an_embedding_model():
    """available[0] used to be returned outright, and on this machine that is
    nomic-embed-text -- which answers /api/tags but cannot chat."""
    for preferred in [None, "does-not-exist:9b"]:
        got = with_available(["nomic-embed-text:latest", "llama3.2:3b"], preferred=preferred)
        assert main._is_chat_model(got), f"picked embedding model {got}"


def test_falls_back_to_a_chat_model_when_default_is_missing():
    got = with_available(["nomic-embed-text:latest", "dolphin3:latest"],
                         preferred="does-not-exist:9b")
    assert got == "dolphin3:latest", got


def test_bare_name_matches_a_tagged_model():
    assert main._is_installed("llama3.2", ["llama3.2:3b"])
    assert main._is_installed("llama3.2:3b", ["llama3.2:3b"])
    assert not main._is_installed("llama3.3", ["llama3.2:3b"])


def test_substring_names_do_not_false_match():
    """"qwen2.5-coder" must not be satisfied by an unrelated longer name."""
    assert not main._is_installed("qwen2.5-coder:3b", ["qwen2.5-coder:14b", "qwen2.5-coder:latest"])


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
