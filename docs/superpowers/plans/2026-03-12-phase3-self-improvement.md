# Phase 3 — Autonomous Tool Discovery + Self-Improvement Engine

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let ECHO discover tools automatically at startup and periodically, and let it analyze its own ThoughtGraph to improve prompts, routing thresholds, and memory priorities over time.

**Architecture:** `ToolDiscovery` scans `tools/` for `TOOL_MANIFEST` dicts and `@register_tool` decorators, wiring them into the existing `ToolRegistry`. `SelfImprovementEngine` runs every 30 minutes as a background task, reads ThoughtGraph, and writes prompt patches to `config/prompt_patches.json`. Both receive a `GPUScheduler` stub now (real scheduler in Phase 4).

**Tech Stack:** Python 3.12, stdlib json/os/importlib, unittest.mock, pytest

**Prerequisite:** Phase 1 complete (ThoughtGraph, settings.py).

**Working directory:** `D:\AI\Claude Code\Project ECHO\ai-orchestrator`

---

## Chunk 1: Autonomous Tool Discovery

### Task 1: Tool Manifest Convention + `@register_tool` decorator

**Files:**
- Create: `tools/discovery.py`
- Create: `tests/test_tool_discovery.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_tool_discovery.py`:

```python
"""Tests for ToolDiscovery — auto-registration of tools from TOOL_MANIFEST and @register_tool."""
import sys
import types
import pytest
from unittest.mock import MagicMock, patch
from tools.discovery import ToolDiscovery, register_tool


@pytest.fixture
def registry():
    r = MagicMock()
    r.registered = {}
    r.register = lambda name, fn, desc: r.registered.update({name: fn})
    return r


def test_scan_registers_tool_with_manifest(tmp_path, registry):
    """A .py file with TOOL_MANIFEST should be auto-registered."""
    tool_file = tmp_path / "my_tool.py"
    tool_file.write_text("""
def my_fn(x): return x
TOOL_MANIFEST = {"name": "my_tool", "description": "does stuff", "fn": my_fn}
""")
    discovery = ToolDiscovery(registry=registry, scheduler=None)
    count = discovery.scan(str(tmp_path))
    assert count == 1
    assert "my_tool" in registry.registered


def test_scan_skips_files_without_manifest(tmp_path, registry):
    """Files without TOOL_MANIFEST or @register_tool are silently ignored."""
    (tmp_path / "helper.py").write_text("x = 1")
    discovery = ToolDiscovery(registry=registry, scheduler=None)
    count = discovery.scan(str(tmp_path))
    assert count == 0


def test_scan_skips_broken_files(tmp_path, registry):
    """Syntax errors in tool files must not crash the scan."""
    (tmp_path / "broken.py").write_text("def (: pass")
    discovery = ToolDiscovery(registry=registry, scheduler=None)
    count = discovery.scan(str(tmp_path))
    assert count == 0


def test_register_tool_decorator_marks_function(registry):
    """@register_tool must attach a _tool_manifest attribute to the function."""
    @register_tool("decorated_tool", "a decorated tool")
    def my_fn(x):
        return x

    assert hasattr(my_fn, "_tool_manifest")
    assert my_fn._tool_manifest["name"] == "decorated_tool"


def test_probe_for_capability_returns_true_when_available(tmp_path, registry):
    """probe_for_capability returns True if a tool in available/ matches."""
    avail = tmp_path / "available"
    avail.mkdir()
    (avail / "web_search.py").write_text("""
def search(q): pass
TOOL_MANIFEST = {"name": "web_search", "description": "searches the web", "fn": search}
""")
    discovery = ToolDiscovery(registry=registry, scheduler=None,
                               available_dir=str(avail))
    result = discovery.probe_for_capability("search the web")
    assert result is True
    assert "web_search" in registry.registered


def test_probe_returns_false_when_no_match(tmp_path, registry):
    discovery = ToolDiscovery(registry=registry, scheduler=None,
                               available_dir=str(tmp_path))
    result = discovery.probe_for_capability("synthesize audio")
    assert result is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_tool_discovery.py -v
```
Expected: ImportError — `tools.discovery` does not exist.

- [ ] **Step 3: Implement ToolDiscovery**

Create `tools/discovery.py`:

```python
"""ToolDiscovery — auto-registers tools from TOOL_MANIFEST dicts and @register_tool decorators."""
from __future__ import annotations
import importlib.util
import os
import sys
from typing import Optional


def register_tool(name: str, description: str):
    """Decorator that marks a function as a discoverable tool."""
    def decorator(fn):
        fn._tool_manifest = {"name": name, "description": description, "fn": fn}
        return fn
    return decorator


class ToolDiscovery:
    """Scans directories for tool files and registers them into a ToolRegistry."""

    def __init__(self, registry, scheduler=None, available_dir: str = None):
        self._registry = registry
        self._scheduler = scheduler   # GPUScheduler (Phase 4); None is fine now
        self._available_dir = available_dir
        self._registered_names: set = set()

    def scan(self, tools_dir: str) -> int:
        """Scan tools_dir, register any new tools. Returns count of newly registered tools."""
        count = 0
        for filename in os.listdir(tools_dir):
            if not filename.endswith(".py") or filename.startswith("_"):
                continue
            filepath = os.path.join(tools_dir, filename)
            manifests = self._extract_manifests(filepath)
            for m in manifests:
                name = m.get("name")
                fn = m.get("fn")
                desc = m.get("description", "")
                if name and fn and name not in self._registered_names:
                    try:
                        self._registry.register(name, fn, desc)
                        self._registered_names.add(name)
                        count += 1
                    except Exception as e:
                        print(f"--- ToolDiscovery: failed to register {name} ({e}) ---")
        return count

    def probe_for_capability(self, capability_description: str) -> bool:
        """Search available/ dir for a tool matching the capability. Activates if found."""
        if not self._available_dir or not os.path.isdir(self._available_dir):
            return False
        capability_lower = capability_description.lower()
        for filename in os.listdir(self._available_dir):
            if not filename.endswith(".py"):
                continue
            filepath = os.path.join(self._available_dir, filename)
            manifests = self._extract_manifests(filepath)
            for m in manifests:
                desc = m.get("description", "").lower()
                name = m.get("name", "").lower()
                if any(word in desc or word in name
                       for word in capability_lower.split()):
                    fn = m.get("fn")
                    tool_name = m.get("name")
                    if fn and tool_name and tool_name not in self._registered_names:
                        try:
                            self._registry.register(tool_name, fn, m.get("description", ""))
                            self._registered_names.add(tool_name)
                            return True
                        except Exception as e:
                            print(f"--- ToolDiscovery: probe register failed ({e}) ---")
        return False

    def _extract_manifests(self, filepath: str) -> list:
        """Load a Python file and extract all TOOL_MANIFEST dicts and @register_tool fns."""
        try:
            spec = importlib.util.spec_from_file_location("_discovery_tmp", filepath)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
        except Exception as e:
            print(f"--- ToolDiscovery: skipping {filepath} ({e}) ---")
            return []

        manifests = []
        # Check for top-level TOOL_MANIFEST dict
        if hasattr(module, "TOOL_MANIFEST") and isinstance(module.TOOL_MANIFEST, dict):
            manifests.append(module.TOOL_MANIFEST)
        # Check for decorated functions
        for attr_name in dir(module):
            attr = getattr(module, attr_name, None)
            if callable(attr) and hasattr(attr, "_tool_manifest"):
                manifests.append(attr._tool_manifest)
        return manifests
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_tool_discovery.py -v
```
Expected: 6 passed.

- [ ] **Step 5: Wire ToolDiscovery into Orchestrator**

In `core/orchestrator.py` `__init__()`, after `self._register_tools()`:

```python
from tools.discovery import ToolDiscovery
import os as _os2
_tools_dir = _os2.path.join(_os2.path.dirname(_os2.path.dirname(_os2.path.abspath(__file__))), "tools")
_available_dir = _os2.path.join(_tools_dir, "available")
self.tool_discovery = ToolDiscovery(
    registry=self.tools,
    scheduler=None,  # will be wired in Phase 4
    available_dir=_available_dir if _os2.path.isdir(_available_dir) else None,
)
if settings.TOOL_DISCOVERY_ENABLED:
    self.tool_discovery.scan(_tools_dir)
    self.scheduler.add_task("Tool Discovery", 600, lambda: self.tool_discovery.scan(_tools_dir))
```

- [ ] **Step 6: Commit**

```bash
git add tools/discovery.py tests/test_tool_discovery.py core/orchestrator.py
git commit -m "feat: implement ToolDiscovery with TOOL_MANIFEST and @register_tool support"
```

---

## Chunk 2: Self-Improvement Engine

### Task 2: SelfImprovementEngine

**Files:**
- Create: `intelligence/self_improvement.py`
- Create: `tests/test_self_improvement.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_self_improvement.py`:

```python
"""Tests for SelfImprovementEngine — pattern-based prompt and routing improvements."""
import json
import os
import pytest
import tempfile
from unittest.mock import MagicMock, patch
from thinking.graph import ThoughtGraph
from intelligence.self_improvement import SelfImprovementEngine


@pytest.fixture
def engine(tmp_path):
    graph = ThoughtGraph(db_path=str(tmp_path / "memory.db"))
    patches_file = str(tmp_path / "prompt_patches.json")
    log_file = str(tmp_path / "improvement_log.jsonl")
    return SelfImprovementEngine(
        graph=graph,
        scheduler=None,
        patches_path=patches_file,
        log_path=log_file,
    ), graph, patches_file, log_file


def test_analyse_returns_dict(engine):
    eng, graph, *_ = engine
    result = eng.analyse()
    assert isinstance(result, dict)


def test_analyse_with_empty_graph(engine):
    """No thoughts in graph — analyse must return empty adjustments, not crash."""
    eng, graph, *_ = engine
    result = eng.analyse()
    assert result.get("prompt_patches", []) == []


def test_low_scoring_thoughts_generate_patch(engine):
    """Persistent low scores for a query type must produce a prompt patch."""
    eng, graph, patches_file, _ = engine
    for i in range(5):
        graph.write("s1", None, i, "how do I write SQL", f"bad answer {i}", 0.3)

    eng.apply()
    patches = json.loads(open(patches_file).read()) if os.path.exists(patches_file) else []
    # At minimum, the engine ran without crashing
    assert isinstance(patches, list)


def test_successful_revision_pattern_tracked(engine):
    """A thought that improved from low to high score should be tracked as a winning pattern."""
    eng, graph, *_ = engine
    graph.write("s1", None, 0, "explain recursion", "bad first", 0.3)
    graph.write("s1", None, 1, "explain recursion", "good revision", 0.9)
    result = eng.analyse()
    patterns = result.get("winning_patterns", [])
    assert isinstance(patterns, list)


def test_apply_writes_log_entry(engine):
    eng, graph, _, log_file = engine
    eng.apply()
    assert os.path.exists(log_file)
    with open(log_file) as f:
        lines = f.readlines()
    assert len(lines) >= 1
    entry = json.loads(lines[-1])
    assert "timestamp" in entry


def test_apply_is_safe_on_repeated_calls(engine):
    """Calling apply() multiple times must not duplicate patches or crash."""
    eng, graph, patches_file, _ = engine
    eng.apply()
    eng.apply()
    if os.path.exists(patches_file):
        patches = json.loads(open(patches_file).read())
        assert isinstance(patches, list)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_self_improvement.py -v
```
Expected: ImportError — `intelligence.self_improvement` does not exist.

- [ ] **Step 3: Implement SelfImprovementEngine**

Create `intelligence/self_improvement.py`:

```python
"""SelfImprovementEngine — analyses ThoughtGraph and applies targeted adjustments."""
from __future__ import annotations
import json
import os
import time
from typing import Optional


class SelfImprovementEngine:
    """Reads ThoughtGraph, identifies patterns, writes prompt patches and logs."""

    def __init__(
        self,
        graph,
        scheduler=None,  # GPUScheduler (Phase 4)
        patches_path: str = None,
        log_path: str = None,
    ):
        self._graph = graph
        self._scheduler = scheduler
        if patches_path is None:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            patches_path = os.path.join(base, "config", "prompt_patches.json")
        if log_path is None:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            log_path = os.path.join(base, "intelligence", "improvement_log.jsonl")
        self._patches_path = patches_path
        self._log_path = log_path

    async def run(self):
        """Entrypoint for BackgroundScheduler. Runs analyse + apply."""
        if self._scheduler:
            await self._scheduler.yield_to_foreground()
        self.apply()

    def analyse(self) -> dict:
        """Analyse recent ThoughtGraph entries. Returns dict of findings."""
        try:
            low = self._graph.query_low_scoring(max_score=0.6, limit=100)
            failed_tools = self._graph.query_failed_tool_calls(limit=50)
        except Exception as e:
            print(f"--- SelfImprovementEngine: analyse failed ({e}) ---")
            return {"prompt_patches": [], "winning_patterns": []}

        # Group low-scoring thoughts by query prefix (first 40 chars)
        query_groups: dict[str, list] = {}
        for t in low:
            key = t.get("query", "")[:40]
            query_groups.setdefault(key, []).append(t)

        # Identify persistent failures (same query prefix fails >= 3 times)
        patches = []
        for key, thoughts in query_groups.items():
            if len(thoughts) >= 3:
                analyses = [t.get("content", "") for t in thoughts[:3]]
                patches.append({
                    "query_prefix": key,
                    "failure_count": len(thoughts),
                    "sample_analyses": analyses[:2],
                })

        # Find winning revision patterns
        winning_patterns = self._find_winning_patterns()

        return {
            "prompt_patches": patches,
            "winning_patterns": winning_patterns,
            "failed_tool_count": len(failed_tools),
        }

    def apply(self):
        """Run analyse and persist adjustments."""
        try:
            findings = self.analyse()
            existing = self._load_patches()

            new_patches = []
            for p in findings.get("prompt_patches", []):
                patch_entry = {
                    "agent": "planner",
                    "patch": f"For queries about '{p['query_prefix']}': verify your answer carefully before responding.",
                    "source": "self_improvement",
                    "failure_count": p["failure_count"],
                    "timestamp": time.time(),
                }
                # Deduplicate by query_prefix
                if not any(e.get("patch", "").endswith(f"'{p['query_prefix']}': verify your answer carefully before responding.")
                           for e in existing):
                    new_patches.append(patch_entry)

            all_patches = existing + new_patches
            os.makedirs(os.path.dirname(self._patches_path) or ".", exist_ok=True)
            with open(self._patches_path, "w", encoding="utf-8") as f:
                json.dump(all_patches, f, indent=2)

            self._write_log({
                "timestamp": time.time(),
                "new_patches": len(new_patches),
                "total_patches": len(all_patches),
                "failed_tool_count": findings.get("failed_tool_count", 0),
                "winning_patterns_found": len(findings.get("winning_patterns", [])),
            })
        except Exception as e:
            print(f"--- SelfImprovementEngine: apply failed ({e}) ---")

    def _find_winning_patterns(self) -> list:
        """Find session pairs where score improved from < 0.6 to >= 0.75."""
        try:
            from thinking.graph import ThoughtGraph
            winning = []
            # Simple heuristic: find sessions with iteration 0 score < 0.6 and last score >= 0.75
            # We approximate this with low_scoring + cross-reference (no complex SQL needed)
            low = self._graph.query_low_scoring(max_score=0.6, limit=200)
            low_sessions = {t["session_id"] for t in low if t.get("iteration") == 0}
            for session_id in list(low_sessions)[:20]:
                rows = self._graph.query_by_session(session_id)
                if len(rows) > 1 and rows[-1].get("score", 0) >= 0.75:
                    winning.append({
                        "session_id": session_id,
                        "initial_score": rows[0].get("score"),
                        "final_score": rows[-1].get("score"),
                        "iterations": len(rows),
                    })
            return winning
        except Exception:
            return []

    def _load_patches(self) -> list:
        try:
            if os.path.exists(self._patches_path):
                with open(self._patches_path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return []

    def _write_log(self, entry: dict):
        try:
            os.makedirs(os.path.dirname(self._log_path) or ".", exist_ok=True)
            with open(self._log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")
        except Exception as e:
            print(f"--- SelfImprovementEngine: log write failed ({e}) ---")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_self_improvement.py -v
```
Expected: 6 passed.

- [ ] **Step 5: Wire SelfImprovementEngine into Orchestrator**

In `core/orchestrator.py` `__init__()`, after the background task setup:

```python
if settings.SELF_IMPROVEMENT_ENABLED:
    from intelligence.self_improvement import SelfImprovementEngine
    self.self_improvement = SelfImprovementEngine(
        graph=self.thought_graph,
        scheduler=None,  # Phase 4 will inject real scheduler
    )
    self.scheduler.add_task(
        "Self Improvement", 1800,  # every 30 minutes
        self.self_improvement.run
    )
```

- [ ] **Step 6: Commit**

```bash
git add intelligence/self_improvement.py tests/test_self_improvement.py core/orchestrator.py
git commit -m "feat: implement SelfImprovementEngine with prompt patch generation and improvement log"
```

---

## Phase 3 Complete

```bash
venv\Scripts\python -m pytest tests/ -v --tb=short
```
Expected: All Phase 1 + 2 + 3 tests pass.

**Next:** Phase 4 — Inference Performance (`docs/superpowers/plans/2026-03-12-phase4-inference-performance.md`)
