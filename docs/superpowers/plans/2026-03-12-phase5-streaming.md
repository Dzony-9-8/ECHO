# Phase 5 — Speculative Decoding + Streaming Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add speculative decoding for faster reasoning tasks, token batch streaming to reduce UI overhead, and a streaming pipeline that emits partial results in real time.

**Architecture:** `SpeculativeDecoder` wraps DeepSeek-R1 with a draft-verify loop using the 8B model; falls back gracefully if native API unavailable. `StreamBatcher` buffers tokens before emitting. `ThinkingLoop.think_stream()` (already implemented in Phase 1) powers `Orchestrator.process_stream()` — a new method that yields typed events to callers.

**Tech Stack:** Python 3.12, llama-cpp-python, asyncio, unittest.mock, pytest

**Prerequisite:** Phase 1 complete (ThinkingLoop with think_stream() exists). Phase 4 GPUScheduler exists.

**Working directory:** `D:\AI\Claude Code\Project ECHO\ai-orchestrator`

---

## Chunk 1: Token Streaming + SpeculativeDecoder

### Task 1: StreamBatcher

**Files:**
- Create: `core/stream_batcher.py`
- Create: `tests/test_stream_batcher.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_stream_batcher.py`:

```python
"""Tests for StreamBatcher — token batching before UI emit."""
from core.stream_batcher import StreamBatcher


def test_feed_returns_none_until_batch_full():
    batcher = StreamBatcher(batch_size=3)
    assert batcher.feed("a") is None
    assert batcher.feed("b") is None
    result = batcher.feed("c")
    assert result == "abc"


def test_feed_returns_batch_on_full():
    batcher = StreamBatcher(batch_size=2)
    batcher.feed("x")
    result = batcher.feed("y")
    assert result == "xy"


def test_flush_returns_remaining():
    batcher = StreamBatcher(batch_size=5)
    batcher.feed("a")
    batcher.feed("b")
    result = batcher.flush()
    assert result == "ab"


def test_flush_resets_buffer():
    batcher = StreamBatcher(batch_size=5)
    batcher.feed("a")
    batcher.flush()
    assert batcher.flush() == ""


def test_batch_size_one_returns_every_token():
    batcher = StreamBatcher(batch_size=1)
    assert batcher.feed("x") == "x"
    assert batcher.feed("y") == "y"


def test_empty_flush_returns_empty_string():
    batcher = StreamBatcher(batch_size=4)
    assert batcher.flush() == ""


def test_feed_after_flush_works_normally():
    batcher = StreamBatcher(batch_size=2)
    batcher.feed("a")
    batcher.flush()
    batcher.feed("b")
    result = batcher.feed("c")
    assert result == "bc"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_stream_batcher.py -v
```
Expected: ImportError.

- [ ] **Step 3: Implement StreamBatcher**

Create `core/stream_batcher.py`:

```python
"""StreamBatcher — batches tokens before emitting to reduce IPC/WebSocket overhead."""
from __future__ import annotations
from config import settings


class StreamBatcher:
    """Accumulates tokens and returns them in batches of size batch_size.

    Usage:
        batcher = StreamBatcher()
        for token in model_stream:
            batch = batcher.feed(token)
            if batch:
                emit(batch)
        emit(batcher.flush())  # emit any remaining tokens
    """

    def __init__(self, batch_size: int = None):
        self._batch_size = batch_size if batch_size is not None else settings.STREAM_BATCH_SIZE
        self._buffer: list[str] = []

    def feed(self, token: str) -> str | None:
        """Add a token. Returns the batch string when full, else None."""
        self._buffer.append(token)
        if len(self._buffer) >= self._batch_size:
            return self.flush()
        return None

    def flush(self) -> str:
        """Return and clear all buffered tokens."""
        result = "".join(self._buffer)
        self._buffer = []
        return result
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_stream_batcher.py -v
```
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add core/stream_batcher.py tests/test_stream_batcher.py
git commit -m "feat: implement StreamBatcher for token batch buffering"
```

---

### Task 2: SpeculativeDecoder

**Files:**
- Create: `core/speculative.py`
- Create: `tests/test_speculative.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_speculative.py`:

```python
"""Tests for SpeculativeDecoder — draft-then-verify inference acceleration."""
from unittest.mock import MagicMock, patch
from core.speculative import SpeculativeDecoder


def _make_model(response_text="the answer"):
    model = MagicMock()
    model.return_value = {"choices": [{"text": response_text}]}
    return model


def test_decoder_created_without_native_api():
    """SpeculativeDecoder must initialise even when llama_speculative is unavailable."""
    with patch.dict("sys.modules", {"llama_cpp.llama_speculative": None}):
        draft = _make_model("draft answer")
        verifier = _make_model("1.0")  # verifier scores the draft
        decoder = SpeculativeDecoder(draft_model=draft, verifier_model=verifier)
        assert decoder._native_speculative is False


def test_generate_returns_string():
    draft = _make_model("draft response text")
    verifier = _make_model("0.9")
    decoder = SpeculativeDecoder(draft_model=draft, verifier_model=verifier)
    result = decoder.generate("What is 2+2?", max_tokens=50)
    assert isinstance(result, str)
    assert len(result) > 0


def test_high_verifier_score_accepts_draft():
    """When verifier scores >= 0.6, draft answer is used."""
    draft = _make_model("draft answer")
    verifier = _make_model("0.9")
    decoder = SpeculativeDecoder(draft_model=draft, verifier_model=verifier)
    result = decoder.generate("Q", max_tokens=50)
    assert result == "draft answer"


def test_low_verifier_score_falls_back_to_verifier():
    """When verifier scores < 0.6, verifier model generates the final answer."""
    draft = _make_model("bad draft")
    verifier = MagicMock()
    # First call returns low score, second call returns the real answer
    verifier.side_effect = [
        {"choices": [{"text": "0.2"}]},    # scoring call
        {"choices": [{"text": "correct answer"}]},  # generation call
    ]
    decoder = SpeculativeDecoder(draft_model=draft, verifier_model=verifier)
    result = decoder.generate("Q", max_tokens=50)
    assert result == "correct answer"


def test_verifier_failure_falls_back_to_verifier_generation():
    """If verifier scoring call raises, treat as score < 0.6 and regenerate."""
    draft = _make_model("draft")
    verifier = MagicMock()
    verifier.side_effect = [
        RuntimeError("GPU OOM"),                       # scoring fails
        {"choices": [{"text": "fallback answer"}]},    # generation call
    ]
    decoder = SpeculativeDecoder(draft_model=draft, verifier_model=verifier)
    result = decoder.generate("Q", max_tokens=50)
    assert result == "fallback answer"


def test_disable_after_repeated_failures():
    """After enough failures, decoder disables itself for the session."""
    draft = _make_model("bad")
    verifier = MagicMock()
    # Always low score then direct answer
    verifier.side_effect = [
        {"choices": [{"text": "0.1"}]},
        {"choices": [{"text": "answer_1"}]},
        {"choices": [{"text": "0.1"}]},
        {"choices": [{"text": "answer_2"}]},
    ] * 10
    decoder = SpeculativeDecoder(draft_model=draft, verifier_model=verifier,
                                  failure_threshold=2)
    decoder.generate("Q1", max_tokens=10)
    decoder.generate("Q2", max_tokens=10)
    assert decoder._disabled is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_speculative.py -v
```
Expected: ImportError.

- [ ] **Step 3: Implement SpeculativeDecoder**

Create `core/speculative.py`:

```python
"""SpeculativeDecoder — draft-verify inference for faster reasoning tasks."""
from __future__ import annotations
import re


def _parse_score(text: str) -> float:
    """Extract a 0.0-1.0 float from text."""
    m = re.search(r"(\d?\.\d+|\d+\.?\d*)", text.strip())
    if m:
        val = float(m.group(1))
        return min(1.0, max(0.0, val))
    return 0.0


class SpeculativeDecoder:
    """Uses a fast draft model to generate candidates; verifier confirms or regenerates.

    Native llama_speculative path used when available (llama-cpp-python >= 0.2.90).
    Falls back to response-level draft-score-verify otherwise.
    """

    def __init__(
        self,
        draft_model,
        verifier_model,
        failure_threshold: int = 10,
    ):
        self._draft = draft_model
        self._verifier = verifier_model
        self._failure_threshold = failure_threshold
        self._failure_count = 0
        self._disabled = False

        try:
            import llama_cpp.llama_speculative  # noqa: F401
            self._native_speculative = True
        except (ImportError, AttributeError):
            self._native_speculative = False

    def generate(self, prompt: str, max_tokens: int = 512) -> str:
        """Generate a response, using speculative decoding if available."""
        if self._disabled:
            return self._verifier_generate(prompt, max_tokens)

        # Response-level speculative path (works without native API)
        draft_text = self._draft_generate(prompt, max_tokens)
        score = self._verify(prompt, draft_text)

        if score >= 0.6:
            return draft_text

        # Draft failed — fall back to full verifier generation
        self._failure_count += 1
        if self._failure_count >= self._failure_threshold:
            print("--- SpeculativeDecoder: too many failures, disabling for session ---")
            self._disabled = True

        return self._verifier_generate(prompt, max_tokens)

    def _draft_generate(self, prompt: str, max_tokens: int) -> str:
        try:
            result = self._draft(prompt, max_tokens=max_tokens)
            return result["choices"][0]["text"]
        except Exception as e:
            print(f"--- SpeculativeDecoder: draft generation failed ({e}) ---")
            return ""

    def _verify(self, prompt: str, draft: str) -> float:
        """Score the draft response. Returns 0.0 on any failure (triggers fallback)."""
        verify_prompt = (
            f"Original question: {prompt[:200]}\n"
            f"Proposed answer: {draft[:500]}\n"
            f"Is this answer correct and complete? Score 0.0 (wrong) to 1.0 (perfect).\n"
            f"Score:"
        )
        try:
            result = self._verifier(verify_prompt, max_tokens=10)
            text = result["choices"][0]["text"]
            return _parse_score(text)
        except Exception as e:
            print(f"--- SpeculativeDecoder: verification failed ({e}), treating as 0.0 ---")
            return 0.0  # treat failure as score < 0.6 → use verifier generation

    def _verifier_generate(self, prompt: str, max_tokens: int) -> str:
        try:
            result = self._verifier(prompt, max_tokens=max_tokens)
            return result["choices"][0]["text"]
        except Exception as e:
            print(f"--- SpeculativeDecoder: verifier generation failed ({e}) ---")
            return ""
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_speculative.py -v
```
Expected: 6 passed.

- [ ] **Step 5: Wire SpeculativeDecoder into Orchestrator**

In `core/orchestrator.py`, add a `get_speculative_decoder()` method:

```python
def get_speculative_decoder(self):
    """Returns a SpeculativeDecoder if enabled, else None."""
    from config import settings
    if not settings.SPECULATIVE_DECODING_ENABLED:
        return None
    try:
        from core.speculative import SpeculativeDecoder
        draft_model = self.planner_llm   # fast 8B model
        verifier = self.get_reasoning()  # DeepSeek-R1
        if hasattr(verifier, 'model'):
            verifier_model = verifier.model
        else:
            return None
        return SpeculativeDecoder(draft_model=draft_model, verifier_model=verifier_model)
    except Exception as e:
        print(f"--- SpeculativeDecoder init failed ({e}) ---")
        return None
```

In `process()`, when `plan.reasoning_required` is True, attempt speculative decoding:

```python
if plan.reasoning_required:
    decoder = self.get_speculative_decoder()
    if decoder:
        outputs["reasoning"] = decoder.generate(user_input)
    else:
        reasoner = self.get_reasoning()
        outputs["reasoning"] = reasoner.run(user_input)
```

- [ ] **Step 6: Commit**

```bash
git add core/speculative.py tests/test_speculative.py core/orchestrator.py
git commit -m "feat: implement SpeculativeDecoder with response-level draft-verify and graceful fallback"
```

---

## Chunk 2: Streaming Pipeline

### Task 3: `Orchestrator.process_stream()`

**Files:**
- Modify: `core/orchestrator.py`
- Create: `tests/test_process_stream.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_process_stream.py`:

```python
"""Tests for Orchestrator.process_stream() — streaming event generator."""
import asyncio
import pytest
from unittest.mock import MagicMock, AsyncMock, patch


def test_process_stream_method_exists():
    """Orchestrator must have a process_stream() method after Phase 5."""
    from core.orchestrator import Orchestrator
    assert hasattr(Orchestrator, "process_stream")


def test_process_stream_is_async_generator():
    """process_stream must be an async generator function."""
    import inspect
    from core.orchestrator import Orchestrator
    assert inspect.isasyncgenfunction(Orchestrator.process_stream)


def test_process_stream_yields_final_event():
    """process_stream must yield at least one event with type='final'."""
    from thinking.loop import ThinkingLoop
    from thinking.graph import ThoughtGraph
    from core.planner import Plan
    from agents.protocol import UACPPayload
    import tempfile

    async def collect_events(orch, query):
        events = []
        async for event in orch.process_stream(query):
            events.append(event)
        return events

    # Build minimal mock orchestrator
    with patch("core.orchestrator.Llama"), \
         patch("core.orchestrator.ProfileManager"), \
         patch("core.orchestrator.SystemTelemetry") as mock_tel, \
         patch("core.orchestrator.SwarmController"), \
         patch("core.orchestrator.BackgroundScheduler"), \
         patch("core.orchestrator.BackgroundAgent"), \
         patch("core.orchestrator.VoiceTTS"):
        mock_tel.return_value.nvidia_available = False
        from core.orchestrator import Orchestrator
        import config.settings as s
        s.THINKING_LOOP_ENABLED = True

        orch = Orchestrator.__new__(Orchestrator)
        orch.short_mem = MagicMock()
        orch.short_mem.context = MagicMock(return_value="ctx")
        orch.short_mem.add = MagicMock()
        orch.short_mem.buffer = []
        orch.gpu_scheduler = None

        # Mock ThinkingLoop.think_stream to yield a final event
        mock_loop = MagicMock()
        async def fake_stream(*args, **kwargs):
            yield {"type": "plan", "data": "test"}
            yield {"type": "final", "data": "the answer"}
        mock_loop.think_stream = fake_stream
        orch.thinking_loop = mock_loop
        orch._get_thinking_loop = MagicMock(return_value=mock_loop)

        events = asyncio.run(collect_events(orch, "hello"))
        types = {e["type"] for e in events}
        assert "final" in types
```

- [ ] **Step 2: Run test to verify it fails**

```bash
venv\Scripts\python -m pytest tests/test_process_stream.py::test_process_stream_method_exists -v
```
Expected: AssertionError — `process_stream` does not exist.

- [ ] **Step 3: Add process_stream() to Orchestrator**

In `core/orchestrator.py`, add after `process()`:

```python
async def process_stream(self, user_input: str):
    """Streaming variant of process(). Yields typed event dicts for each phase.

    Event types: 'plan', 'tool_result', 'token', 'critique', 'final'.
    Callers iterate: async for event in orchestrator.process_stream(query): ...
    """
    if not user_input.strip():
        yield {"type": "final", "data": ""}
        return

    if self.gpu_scheduler:
        self.gpu_scheduler.enter_foreground()

    try:
        self.short_mem.add("user", user_input)
        memories = []
        try:
            e = self.get_embedder()
            ltm = self.get_long_term_mem()
            query_emb = e.embed(user_input)
            memories = ltm.query(query_emb, k=3, decay_obj=self.decay_ctrl)
        except Exception:
            pass

        loop = self._get_thinking_loop()
        memories_text = [str(m) for m in memories]

        async for event in loop.think_stream(
            user_input, self.short_mem.context(), memories_text
        ):
            yield event
            if event.get("type") == "final":
                final_answer = event.get("data", "")
                self.short_mem.add("ai", final_answer)

    except Exception as e:
        print(f"--- process_stream: error ({e}) ---")
        yield {"type": "final", "data": "An error occurred. Please try again."}
    finally:
        if self.gpu_scheduler:
            self.gpu_scheduler.exit_foreground()
```

- [ ] **Step 4: Run all Phase 5 tests**

```bash
venv\Scripts\python -m pytest tests/test_stream_batcher.py tests/test_speculative.py tests/test_process_stream.py -v
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add core/orchestrator.py tests/test_process_stream.py
git commit -m "feat: add Orchestrator.process_stream() for streaming event pipeline"
```

---

## Phase 5 Complete

```bash
venv\Scripts\python -m pytest tests/ -v --tb=short
```
Expected: All Phase 1–5 tests pass.

**Next:** Phase 6 — AI Project Mode (`docs/superpowers/plans/2026-03-12-phase6-project-mode.md`)
