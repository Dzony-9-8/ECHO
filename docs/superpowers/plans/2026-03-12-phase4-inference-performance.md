# Phase 4 — Inference Performance Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local model inference faster and VRAM-smarter on the GTX 1080Ti via KV cache reuse, quantization-based model selection, and cooperative GPU scheduling for background tasks.

**Architecture:** `KVCacheManager` tracks system-prompt hashes per model instance to avoid redundant prefix re-encoding. `QuantController` picks the right GGUF quant file based on task complexity. `GPUScheduler` uses an `asyncio.Event` to cooperatively pause background tasks when foreground needs VRAM.

**Tech Stack:** Python 3.12, llama-cpp-python, asyncio, unittest.mock, pytest

**Prerequisite:** Phase 1 complete. Phase 3 ToolDiscovery and SelfImprovementEngine exist (GPUScheduler needs to inject itself into them).

**Working directory:** `D:\AI\Claude Code\Project ECHO\ai-orchestrator`

---

## Chunk 1: KV Cache Reuse + Quantization Switching

### Task 1: KVCacheManager

**Files:**
- Create: `core/kv_cache.py`
- Create: `tests/test_kv_cache.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_kv_cache.py`:

```python
"""Tests for KVCacheManager — system prompt hash tracking to reuse KV state."""
from unittest.mock import MagicMock
from core.kv_cache import KVCacheManager


def test_same_prompt_hash_detected_as_match():
    mgr = KVCacheManager()
    model = MagicMock()
    mgr.record(model, "You are ECHO.")
    assert mgr.is_cached(model, "You are ECHO.") is True


def test_different_prompt_detected_as_miss():
    mgr = KVCacheManager()
    model = MagicMock()
    mgr.record(model, "You are ECHO.")
    assert mgr.is_cached(model, "You are a different assistant.") is False


def test_different_model_instances_tracked_separately():
    mgr = KVCacheManager()
    model_a, model_b = MagicMock(), MagicMock()
    mgr.record(model_a, "prompt A")
    assert mgr.is_cached(model_a, "prompt A") is True
    assert mgr.is_cached(model_b, "prompt A") is False


def test_record_overwrites_previous_hash():
    mgr = KVCacheManager()
    model = MagicMock()
    mgr.record(model, "first prompt")
    mgr.record(model, "second prompt")
    assert mgr.is_cached(model, "second prompt") is True
    assert mgr.is_cached(model, "first prompt") is False


def test_invalidate_clears_model_cache():
    mgr = KVCacheManager()
    model = MagicMock()
    mgr.record(model, "prompt")
    mgr.invalidate(model)
    assert mgr.is_cached(model, "prompt") is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_kv_cache.py -v
```
Expected: ImportError.

- [ ] **Step 3: Implement KVCacheManager**

Create `core/kv_cache.py`:

```python
"""KVCacheManager — tracks system prompt hashes to avoid redundant KV re-encoding."""
import hashlib


class KVCacheManager:
    """Tracks the last system prompt hash per model instance.

    llama-cpp-python reuses KV state automatically when the same Llama instance
    is called with an overlapping token prefix. This manager prevents unnecessary
    model reloads and tracks whether the prefix has changed.
    """

    def __init__(self):
        self._hashes: dict[int, str] = {}  # id(model) -> prompt_hash

    def _hash(self, prompt: str) -> str:
        return hashlib.sha256(prompt.encode()).hexdigest()

    def record(self, model, system_prompt: str):
        """Record the current system prompt hash for a model instance."""
        self._hashes[id(model)] = self._hash(system_prompt)

    def is_cached(self, model, system_prompt: str) -> bool:
        """Returns True if model's KV state already has this system prompt encoded."""
        return self._hashes.get(id(model)) == self._hash(system_prompt)

    def invalidate(self, model):
        """Clear the cached hash for a model (e.g. after reload)."""
        self._hashes.pop(id(model), None)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_kv_cache.py -v
```
Expected: 5 passed.

- [ ] **Step 5: Wire into Orchestrator**

In `core/orchestrator.py` `__init__()`, after existing model setup:

```python
from core.kv_cache import KVCacheManager
self.kv_cache = KVCacheManager()
```

In `_get_model_instance()`, after `self.model_instances[name] = self._load_model(...)`:

```python
self.kv_cache.invalidate(self.model_instances[name])
```

- [ ] **Step 6: Commit**

```bash
git add core/kv_cache.py tests/test_kv_cache.py core/orchestrator.py
git commit -m "feat: add KVCacheManager for system prompt hash tracking"
```

---

### Task 2: QuantController

**Files:**
- Create: `core/quant_controller.py`
- Create: `tests/test_quant_controller.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_quant_controller.py`:

```python
"""Tests for QuantController — complexity-based GGUF quantization selection."""
import os
import pytest
import tempfile
from core.quant_controller import QuantController


@pytest.fixture
def models_dir(tmp_path):
    """Create fake GGUF files for testing."""
    for name in ["deepseek-r1-q4.gguf", "deepseek-r1-q6.gguf", "deepseek-r1-q8.gguf"]:
        (tmp_path / name).touch()
    return str(tmp_path)


def test_low_complexity_selects_q4(models_dir):
    ctrl = QuantController(models_dir=models_dir)
    path = ctrl.select("deepseek-r1", complexity_score=0.2)
    assert "q4" in path


def test_mid_complexity_selects_q6(models_dir):
    ctrl = QuantController(models_dir=models_dir)
    path = ctrl.select("deepseek-r1", complexity_score=0.55)
    assert "q6" in path


def test_high_complexity_selects_q8(models_dir):
    ctrl = QuantController(models_dir=models_dir)
    path = ctrl.select("deepseek-r1", complexity_score=0.85)
    assert "q8" in path


def test_missing_quant_falls_back_to_available(tmp_path):
    """If requested quant is missing, fall back to any available variant."""
    (tmp_path / "deepseek-r1-q4.gguf").touch()
    ctrl = QuantController(models_dir=str(tmp_path))
    # High complexity wants q8 but only q4 exists
    path = ctrl.select("deepseek-r1", complexity_score=0.9)
    assert path is not None
    assert "deepseek-r1" in path


def test_no_model_files_returns_none(tmp_path):
    ctrl = QuantController(models_dir=str(tmp_path))
    path = ctrl.select("deepseek-r1", complexity_score=0.5)
    assert path is None


def test_returns_absolute_path(models_dir):
    ctrl = QuantController(models_dir=models_dir)
    path = ctrl.select("deepseek-r1", complexity_score=0.3)
    assert os.path.isabs(path)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_quant_controller.py -v
```
Expected: ImportError.

- [ ] **Step 3: Implement QuantController**

Create `core/quant_controller.py`:

```python
"""QuantController — selects GGUF quantization based on task complexity score."""
import os


# Complexity score thresholds → preferred quant suffix
_QUANT_MAP = [
    (0.4, "q4"),   # score < 0.4  → Q4_K_M
    (0.7, "q6"),   # score < 0.7  → Q6_K
    (1.1, "q8"),   # score >= 0.7 → Q8_0
]


class QuantController:
    """Selects the right GGUF quantization variant based on task complexity."""

    def __init__(self, models_dir: str = None):
        if models_dir is None:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            models_dir = os.path.join(base, "models")
        self._models_dir = models_dir

    def select(self, model_name: str, complexity_score: float) -> str | None:
        """Return absolute path to the best matching GGUF file, or None if unavailable."""
        preferred_quant = self._quant_for(complexity_score)
        preferred_path = os.path.join(
            self._models_dir, f"{model_name}-{preferred_quant}.gguf"
        )
        if os.path.isfile(preferred_path):
            return os.path.abspath(preferred_path)

        # Fallback: any file matching model_name-*.gguf
        try:
            candidates = [
                f for f in os.listdir(self._models_dir)
                if f.startswith(model_name) and f.endswith(".gguf")
            ]
        except Exception:
            return None

        if not candidates:
            return None

        # Prefer highest quant available
        for quant in ("q8", "q6", "q4"):
            for c in candidates:
                if quant in c:
                    print(f"--- QuantController: {preferred_quant} missing, using {c} ---")
                    return os.path.abspath(os.path.join(self._models_dir, c))

        return os.path.abspath(os.path.join(self._models_dir, candidates[0]))

    @staticmethod
    def _quant_for(score: float) -> str:
        for threshold, quant in _QUANT_MAP:
            if score < threshold:
                return quant
        return "q8"
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_quant_controller.py -v
```
Expected: 6 passed.

- [ ] **Step 5: Wire into Orchestrator**

In `core/orchestrator.py` `__init__()`:

```python
from core.quant_controller import QuantController
self.quant_ctrl = QuantController()
```

In `get_reasoning()`, replace the hardcoded path:

```python
def get_reasoning(self):
    route = self.model_router.route("", profile=self.mode_name, is_planning=True)
    if route["engine"] == "cloud":
        return DeepSeekR1(api_key=route["api_key"], is_cloud=True)
    # Use QuantController to pick the right variant
    from developer.complexity_analyzer import ComplexityAnalyzer
    complexity = 0.5  # default; SmartRouter will refine this per-request
    model_path = self.quant_ctrl.select("deepseek-r1", complexity) or \
                 os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                              "models", "deepseek-r1.gguf")
    self.reasoning_llm = self._get_model_instance("reasoning", model_path)
    return DeepSeekR1(self.reasoning_llm)
```

- [ ] **Step 6: Commit**

```bash
git add core/quant_controller.py tests/test_quant_controller.py core/orchestrator.py
git commit -m "feat: implement QuantController for complexity-based GGUF quant selection"
```

---

## Chunk 2: GPU Scheduler

### Task 3: GPUScheduler

**Files:**
- Create: `core/gpu_scheduler.py`
- Modify: `agents/background.py`
- Create: `tests/test_gpu_scheduler.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_gpu_scheduler.py`:

```python
"""Tests for GPUScheduler — cooperative VRAM management for foreground/background tasks."""
import asyncio
import pytest
from unittest.mock import MagicMock, patch
from core.gpu_scheduler import GPUScheduler, TaskPriority


@pytest.fixture
def scheduler():
    telemetry = MagicMock()
    telemetry.nvidia_available = False  # simplifies tests
    telemetry.check_vram_threshold = MagicMock(return_value=True)
    return GPUScheduler(telemetry=telemetry)


def test_foreground_clear_event_starts_set(scheduler):
    """_foreground_clear must be set at startup (no foreground task active)."""
    assert scheduler._foreground_clear.is_set()


def test_enter_foreground_clears_event(scheduler):
    scheduler.enter_foreground()
    assert not scheduler._foreground_clear.is_set()


def test_exit_foreground_sets_event(scheduler):
    scheduler.enter_foreground()
    scheduler.exit_foreground()
    assert scheduler._foreground_clear.is_set()


def test_yield_to_foreground_passes_when_clear(scheduler):
    """yield_to_foreground() returns immediately when no foreground task is active."""
    async def run():
        await scheduler.yield_to_foreground()  # should not block
    asyncio.run(run())


def test_yield_to_foreground_blocks_until_exit(scheduler):
    """yield_to_foreground() suspends until exit_foreground() is called."""
    results = []

    async def background_task():
        await scheduler.yield_to_foreground()
        results.append("background_ran")

    async def run():
        scheduler.enter_foreground()
        task = asyncio.create_task(background_task())
        await asyncio.sleep(0)  # let background task start and block
        assert results == []    # background has not run yet
        scheduler.exit_foreground()
        await task
        assert results == ["background_ran"]

    asyncio.run(run())


def test_can_start_background_checks_vram(scheduler):
    """can_start_background() checks VRAM threshold."""
    scheduler._telemetry.check_vram_threshold = MagicMock(return_value=True)
    assert scheduler.can_start_background() is True
    scheduler._telemetry.check_vram_threshold = MagicMock(return_value=False)
    assert scheduler.can_start_background() is False


def test_can_start_background_no_nvidia(scheduler):
    """Without NVIDIA, background tasks can always start."""
    scheduler._telemetry.nvidia_available = False
    assert scheduler.can_start_background() is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_gpu_scheduler.py -v
```
Expected: ImportError.

- [ ] **Step 3: Implement GPUScheduler**

Create `core/gpu_scheduler.py`:

```python
"""GPUScheduler — cooperative VRAM management using asyncio.Event."""
from __future__ import annotations
import asyncio
from enum import Enum


class TaskPriority(Enum):
    FOREGROUND      = 0
    BACKGROUND_HIGH = 1
    BACKGROUND_LOW  = 2


class GPUScheduler:
    """Manages foreground/background VRAM contention via cooperative asyncio.Event.

    Background tasks call await scheduler.yield_to_foreground() at their
    natural await points. When a foreground task is running, they pause there
    until exit_foreground() is called.
    """

    def __init__(self, telemetry=None):
        self._foreground_clear = asyncio.Event()
        self._foreground_clear.set()   # starts in "clear" (no foreground active)
        self._telemetry = telemetry

    def enter_foreground(self):
        """Call before a foreground (user-initiated) task begins."""
        self._foreground_clear.clear()

    def exit_foreground(self):
        """Call after a foreground task completes."""
        self._foreground_clear.set()

    async def yield_to_foreground(self):
        """Background tasks call this at natural await points.
        Suspends until no foreground task is active."""
        if not self._foreground_clear.is_set():
            await self._foreground_clear.wait()

    def can_start_background(self) -> bool:
        """Returns True if VRAM pressure is low enough to start a background task."""
        if self._telemetry is None:
            return True
        if not getattr(self._telemetry, "nvidia_available", False):
            return True
        return self._telemetry.check_vram_threshold(40.0)  # VRAM < 60% used
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_gpu_scheduler.py -v
```
Expected: 7 passed.

- [ ] **Step 5: Add yield_to_foreground to background.py**

Read `agents/background.py` first, then add `await self.scheduler.yield_to_foreground()` before each model/memory call in `consolidate_memory()` and `check_system_health()`.

The pattern to add before any heavy call:

```python
# Yield to foreground if needed
if hasattr(self, 'scheduler') and self.scheduler is not None:
    await self.scheduler.yield_to_foreground()
```

- [ ] **Step 6: Wire GPUScheduler into Orchestrator**

In `core/orchestrator.py` `__init__()`, after `self.telemetry = SystemTelemetry()`:

```python
from core.gpu_scheduler import GPUScheduler
self.gpu_scheduler = GPUScheduler(telemetry=self.telemetry) if settings.GPU_SCHEDULER_ENABLED else None
```

Wrap `process()` to set/clear foreground state:

```python
async def process(self, user_input, use_voice=False, skip_confirmation=False):
    if self.gpu_scheduler:
        self.gpu_scheduler.enter_foreground()
    try:
        result = await self._process_inner(user_input, use_voice, skip_confirmation)
    finally:
        if self.gpu_scheduler:
            self.gpu_scheduler.exit_foreground()
    return result
```

Rename the existing `process()` body to `_process_inner()`.

Inject scheduler into SelfImprovementEngine and ToolDiscovery if they exist:

```python
if hasattr(self, 'self_improvement') and self.gpu_scheduler:
    self.self_improvement._scheduler = self.gpu_scheduler
if hasattr(self, 'tool_discovery') and self.gpu_scheduler:
    self.tool_discovery._scheduler = self.gpu_scheduler
```

- [ ] **Step 7: Run all Phase 4 tests**

```bash
venv\Scripts\python -m pytest tests/test_kv_cache.py tests/test_quant_controller.py tests/test_gpu_scheduler.py -v
```
Expected: 18 passed.

- [ ] **Step 8: Commit**

```bash
git add core/gpu_scheduler.py tests/test_gpu_scheduler.py agents/background.py core/orchestrator.py
git commit -m "feat: implement GPUScheduler with cooperative asyncio.Event suspension"
```

---

## Phase 4 Complete

```bash
venv\Scripts\python -m pytest tests/ -v --tb=short
```
Expected: All Phase 1–4 tests pass.

**Next:** Phase 5 — Speculative Decoding + Streaming (`docs/superpowers/plans/2026-03-12-phase5-streaming.md`)
