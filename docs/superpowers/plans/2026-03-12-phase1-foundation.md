# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the ThinkingLoop, ThoughtGraph, and ContextController — the core cognitive loop that all other phases build on.

**Architecture:** A new `thinking/` module wraps the existing Planner → AgentLoop → Synthesizer pipeline in a self-correcting loop driven by CriticAgent scores. ThoughtGraph persists each iteration to SQLite. ContextController trims context before each LLM call. `Orchestrator.process()` delegates to `ThinkingLoop.think()` with a legacy fallback.

**Tech Stack:** Python 3.12, llama-cpp-python, SQLite (stdlib sqlite3), unittest.mock for tests, pytest

**Working directory for all commands:** `D:\AI\Claude Code\Project ECHO\ai-orchestrator`

**Activate venv before running commands:** `venv\Scripts\activate`

---

## Chunk 1: Foundation (Settings, Protocol, Critic, ThoughtGraph)

### Task 1: Centralized Feature Flags

**Files:**
- Create: `config/settings.py`

- [ ] **Step 1: Create settings.py**

```python
# config/settings.py
"""Centralized feature flags and configuration for Project ECHO."""

# --- Thinking Loop ---
THINKING_LOOP_ENABLED   = True
THINKING_LOOP_MAX_ITERS = 8
THINKING_LOOP_THRESHOLD = 0.75

# --- Context Controller ---
CONTEXT_CONTROLLER_ENABLED = True

# --- Streaming ---
STREAM_BATCH_SIZE = 12

# --- Inference ---
SPECULATIVE_DECODING_ENABLED = True
GPU_SCHEDULER_ENABLED        = True

# --- Agent Capabilities ---
SKILL_COMPILER_ENABLED   = True
TOOL_DISCOVERY_ENABLED   = True
SELF_IMPROVEMENT_ENABLED = True

# --- Product ---
PROJECT_MODE_ENABLED = True
```

- [ ] **Step 2: Verify import works**

```bash
venv\Scripts\python -c "from config.settings import THINKING_LOOP_ENABLED; print(THINKING_LOOP_ENABLED)"
```
Expected: `True`

- [ ] **Step 3: Commit**

```bash
git add config/settings.py
git commit -m "feat: add centralized feature flags (config/settings.py)"
```

---

### Task 2: Add `guidance` Field to UACPPayload

**Files:**
- Modify: `agents/protocol.py`
- Create: `tests/test_protocol.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_protocol.py`:

```python
"""Tests for UACPPayload schema."""
from agents.protocol import UACPPayload


def test_uacp_payload_has_guidance_field():
    """UACPPayload must have a guidance field defaulting to empty string."""
    payload = UACPPayload(agent="critic")
    assert hasattr(payload, "guidance")
    assert payload.guidance == ""


def test_uacp_payload_guidance_is_settable():
    payload = UACPPayload(agent="critic", guidance="Revise the response.")
    assert payload.guidance == "Revise the response."


def test_uacp_payload_to_dict_still_works():
    """Existing to_dict() must not crash after adding guidance."""
    payload = UACPPayload(agent="dev", analysis="ok", confidence=0.9)
    d = payload.to_dict()
    assert d["agent"] == "dev"
    assert d["confidence"] == 0.9
```

- [ ] **Step 2: Run test to verify it fails**

```bash
venv\Scripts\python -m pytest tests/test_protocol.py -v
```
Expected: FAIL — `assert hasattr(payload, "guidance")` fails.

- [ ] **Step 3: Add guidance field to UACPPayload**

In `agents/protocol.py`, add `guidance: str = ""` after `execution_time_ms`:

```python
@dataclass
class UACPPayload:
    """Unified Agent Communication Protocol (UACP) Schema."""
    agent: str
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    analysis: str = ""
    output: Any = None
    confidence: float = 0.0
    requires_revision: bool = False
    notes_for_memory: str = ""
    execution_time_ms: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    guidance: str = ""   # actionable revision instruction for ThinkingLoop
```

- [ ] **Step 4: Run test to verify it passes**

```bash
venv\Scripts\python -m pytest tests/test_protocol.py -v
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add agents/protocol.py tests/test_protocol.py
git commit -m "feat: add guidance field to UACPPayload"
```

---

### Task 3: Populate `guidance` in CriticAgent

**Files:**
- Modify: `agents/critic_agent.py`
- Create: `tests/test_critic_guidance.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_critic_guidance.py`:

```python
"""Tests for CriticAgent guidance field population."""
from unittest.mock import MagicMock
from agents.critic_agent import CriticAgent
from agents.protocol import UACPPayload


def _make_critic():
    """CriticAgent with a mock model that always returns heuristic path."""
    model = MagicMock()
    # Make model callable but NOT have create_chat_completion (forces heuristic path)
    del model.create_chat_completion
    model.__call__ = MagicMock(side_effect=AttributeError("no chat completion"))
    return CriticAgent(model)


def test_guidance_populated_on_high_score():
    """Score >= 0.7: guidance equals analysis."""
    critic = CriticAgent.__new__(CriticAgent)
    score, analysis = 0.8, "Output looks solid."
    guidance = _derive_guidance(score, analysis)
    assert guidance == analysis


def test_guidance_populated_on_mid_score():
    """0.4 <= score < 0.7: guidance starts with 'Revise'."""
    score, analysis = 0.55, "Output is too brief."
    guidance = _derive_guidance(score, analysis)
    assert guidance.startswith("Revise the response.")


def test_guidance_populated_on_low_score():
    """score < 0.4: guidance starts with 'Completely redo'."""
    score, analysis = 0.2, "Total hallucination detected."
    guidance = _derive_guidance(score, analysis)
    assert guidance.startswith("Completely redo the response.")


def test_critic_heuristic_evaluate_returns_guidance():
    """_heuristic_evaluate result must lead to a non-empty guidance on evaluate()."""
    mock_model = MagicMock(spec=[])   # no attributes → heuristic path
    critic = CriticAgent(mock_model)
    agent_output = {"output": "x" * 200, "task_id": "t1"}
    payload = critic.evaluate(agent_output)
    assert isinstance(payload, UACPPayload)
    assert payload.guidance != ""


def test_critic_llm_path_returns_guidance():
    """LLM path must also populate guidance."""
    mock_model = MagicMock()
    mock_model.create_chat_completion = MagicMock()
    # Make __call__ return valid JSON fragment
    mock_model.return_value = {
        "choices": [{"text": '"score": 0.9, "analysis": "Looks great."'}]
    }
    critic = CriticAgent(mock_model)
    payload = critic.evaluate({"output": "good output " * 20, "task_id": "t2"})
    assert payload.guidance != ""


def _derive_guidance(score: float, analysis: str) -> str:
    """Mirror of the derivation logic to be implemented in critic_agent.py."""
    if score < 0.4:
        return f"Completely redo the response. Core issue: {analysis}"
    elif score < 0.7:
        return f"Revise the response. Address: {analysis}"
    return analysis
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_critic_guidance.py -v
```
Expected: `test_critic_heuristic_evaluate_returns_guidance` and `test_critic_llm_path_returns_guidance` fail (guidance is empty string).

- [ ] **Step 3: Update CriticAgent to populate guidance**

Replace the body of `agents/critic_agent.py` with:

```python
from agents.protocol import UACPPayload
import time


def _derive_guidance(score: float, analysis: str) -> str:
    """Converts a score+analysis pair into an actionable revision instruction."""
    if score < 0.4:
        return f"Completely redo the response. Core issue: {analysis}"
    elif score < 0.7:
        return f"Revise the response. Address: {analysis}"
    return analysis


class CriticAgent:
    """Quality gatekeeper for agent specialists."""

    def __init__(self, model):
        self.model = model

    def evaluate(self, agent_output: dict) -> UACPPayload:
        """Evaluates specialist work and returns a UACP payload."""
        import json
        start_time = time.time()
        result_text = agent_output.get("output", "")
        task_id = agent_output.get("task_id", "")

        prompt = f"""You are the System Critic.
Analyze the following agent output for hallucinations or logic errors.
CRITICAL INSTRUCTION: If the agent claims to have searched the web or scraped data, verify that the output contains actual concrete data/facts and not placeholders or hallucinations.

Agent Output:
{result_text[:2000]}

Rate the quality of this output from 0.0 (total failure/hallucination) to 1.0 (perfect).
Respond ONLY in valid JSON format:
{{
    "score": 0.8,
    "analysis": "Explanation of your rating."
}}"""

        try:
            if hasattr(self.model, "create_chat_completion"):
                formatted_prompt = (
                    f"Q: {prompt}\n"
                    f"A:\n```json\n{{"
                )
                response = self.model(
                    formatted_prompt,
                    max_tokens=60,
                    stop=["```", "}"]
                )
                raw_json = "{" + response["choices"][0]["text"].strip() + "}"
                result = json.loads(raw_json)
                score = float(result.get("score", 0.5))
                analysis = result.get("analysis", "No analysis provided.")
            else:
                score, analysis = self._heuristic_evaluate(result_text)
        except Exception as e:
            print(f"--- CriticAgent: LLM evaluation failed ({e}), falling back to heuristic ---")
            score, analysis = self._heuristic_evaluate(result_text)

        guidance = _derive_guidance(score, analysis)

        return UACPPayload(
            agent="critic",
            task_id=task_id,
            analysis=analysis,
            output=None,
            confidence=score,
            requires_revision=score < 0.7,
            notes_for_memory=f"Critique score: {score}",
            execution_time_ms=int((time.time() - start_time) * 1000),
            guidance=guidance,
        )

    def _heuristic_evaluate(self, result_text: str):
        score = 0.8
        analysis = "Output looks solid."

        if len(result_text) < 50:
            score = 0.5
            analysis = "Output is too brief. Logic gap detected."

        if "search_tool" in result_text and "No results" in result_text:
            score = 0.6
            analysis = "Search yielded no results, may need to revise query."

        return score, analysis
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_critic_guidance.py tests/test_protocol.py -v
```
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add agents/critic_agent.py tests/test_critic_guidance.py
git commit -m "feat: populate guidance field in CriticAgent (both LLM and heuristic paths)"
```

---

### Task 4: ThoughtGraph

**Files:**
- Create: `thinking/__init__.py`
- Create: `thinking/graph.py`
- Create: `tests/test_thought_graph.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_thought_graph.py`:

```python
"""Tests for ThoughtGraph — SQLite-backed reasoning trace storage."""
import os
import time
import tempfile
import pytest
from thinking.graph import ThoughtGraph


@pytest.fixture
def graph(tmp_path):
    """ThoughtGraph backed by a temp SQLite file."""
    db_path = str(tmp_path / "test_memory.db")
    return ThoughtGraph(db_path=db_path)


def test_write_returns_thought_id(graph):
    tid = graph.write(
        session_id="s1", parent_id=None, iteration=0,
        query="test query", content="test content", score=0.8
    )
    assert isinstance(tid, str) and len(tid) > 0


def test_query_by_session_returns_written_thought(graph):
    graph.write("s1", None, 0, "q", "content", 0.8)
    rows = graph.query_by_session("s1")
    assert len(rows) == 1
    assert rows[0]["content"] == "content"
    assert rows[0]["score"] == 0.8


def test_mark_selected(graph):
    tid = graph.write("s1", None, 0, "q", "content", 0.9)
    graph.mark_selected(tid)
    rows = graph.query_by_session("s1")
    assert rows[0]["selected"] == 1


def test_query_low_scoring(graph):
    graph.write("s1", None, 0, "q", "bad", 0.3)
    graph.write("s1", None, 1, "q", "good", 0.9)
    low = graph.query_low_scoring(max_score=0.6)
    assert len(low) == 1
    assert low[0]["content"] == "bad"


def test_tool_calls_stored_and_retrieved(graph):
    tool_calls = [{"tool": "read_file", "result": "file contents"}]
    tid = graph.write("s1", None, 0, "q", "content", 0.8, tool_calls=tool_calls)
    rows = graph.query_by_session("s1")
    assert rows[0]["tool_calls"] == tool_calls


def test_failed_tool_calls_query(graph):
    graph.write("s1", None, 0, "q", "c", 0.5,
                tool_calls=[{"tool": "run_shell", "result": "Error: permission denied"}])
    graph.write("s1", None, 1, "q", "c", 0.9,
                tool_calls=[{"tool": "read_file", "result": "ok"}])
    failed = graph.query_failed_tool_calls()
    assert len(failed) == 1


def test_write_failure_does_not_raise(tmp_path):
    """ThoughtGraph must never crash callers even if DB write fails."""
    graph = ThoughtGraph(db_path="/nonexistent/path/memory.db")
    # Should not raise
    result = graph.write("s1", None, 0, "q", "c", 0.5)
    assert result == ""  # empty string on failure


def test_project_id_stored(graph):
    graph.write("s1", None, 0, "q", "c", 0.7, project_id="proj_abc")
    rows = graph.query_by_session("s1")
    assert rows[0]["project_id"] == "proj_abc"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_thought_graph.py -v
```
Expected: ImportError — `thinking.graph` does not exist.

- [ ] **Step 3: Create `thinking/__init__.py`**

```python
# thinking/__init__.py
```

(empty)

- [ ] **Step 4: Implement ThoughtGraph**

Create `thinking/graph.py`:

```python
"""ThoughtGraph — persists reasoning traces to SQLite for analysis and self-improvement."""
import json
import os
import sqlite3
import time
import uuid


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS thought_graph (
    thought_id   TEXT PRIMARY KEY,
    session_id   TEXT,
    project_id   TEXT,
    parent_id    TEXT,
    iteration    INTEGER,
    query        TEXT,
    content      TEXT,
    tool_calls   TEXT,
    score        REAL,
    selected     BOOLEAN DEFAULT 0,
    timestamp    REAL
);
"""


class ThoughtGraph:
    """Persists per-iteration reasoning traces to SQLite."""

    def __init__(self, db_path: str = None):
        if db_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            db_path = os.path.join(base_dir, "intelligence", "memory.db")
        self._db_path = db_path
        self._init_db()

    def _init_db(self):
        try:
            with self._connect() as conn:
                conn.execute(CREATE_TABLE_SQL)
        except Exception as e:
            print(f"--- ThoughtGraph: DB init failed ({e}) ---")

    def _connect(self):
        return sqlite3.connect(self._db_path)

    def write(
        self,
        session_id: str,
        parent_id,
        iteration: int,
        query: str,
        content: str,
        score: float,
        tool_calls: list = None,
        project_id: str = None,
    ) -> str:
        """Persist one reasoning iteration. Returns thought_id, or '' on failure."""
        thought_id = uuid.uuid4().hex
        tool_calls_json = json.dumps(tool_calls or [])
        try:
            with self._connect() as conn:
                conn.execute(
                    """INSERT INTO thought_graph
                       (thought_id, session_id, project_id, parent_id, iteration,
                        query, content, tool_calls, score, selected, timestamp)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)""",
                    (thought_id, session_id, project_id, parent_id, iteration,
                     query, content, tool_calls_json, score, time.time()),
                )
            return thought_id
        except Exception as e:
            print(f"--- ThoughtGraph: write failed ({e}) ---")
            return ""

    def mark_selected(self, thought_id: str):
        """Mark a thought as the best result for its session."""
        try:
            with self._connect() as conn:
                conn.execute(
                    "UPDATE thought_graph SET selected=1 WHERE thought_id=?",
                    (thought_id,),
                )
        except Exception as e:
            print(f"--- ThoughtGraph: mark_selected failed ({e}) ---")

    def query_by_session(self, session_id: str) -> list:
        try:
            with self._connect() as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute(
                    "SELECT * FROM thought_graph WHERE session_id=? ORDER BY iteration ASC",
                    (session_id,),
                ).fetchall()
            result = []
            for row in rows:
                d = dict(row)
                try:
                    d["tool_calls"] = json.loads(d.get("tool_calls") or "[]")
                except Exception:
                    d["tool_calls"] = []
                result.append(d)
            return result
        except Exception as e:
            print(f"--- ThoughtGraph: query_by_session failed ({e}) ---")
            return []

    def query_low_scoring(
        self, min_score: float = 0.0, max_score: float = 0.6, limit: int = 50
    ) -> list:
        try:
            with self._connect() as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute(
                    """SELECT * FROM thought_graph
                       WHERE score >= ? AND score <= ?
                       ORDER BY timestamp DESC LIMIT ?""",
                    (min_score, max_score, limit),
                ).fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            print(f"--- ThoughtGraph: query_low_scoring failed ({e}) ---")
            return []

    def query_failed_tool_calls(self, limit: int = 50) -> list:
        """Returns thoughts whose tool_calls contain an 'Error:' result."""
        try:
            with self._connect() as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute(
                    "SELECT * FROM thought_graph ORDER BY timestamp DESC LIMIT 500"
                ).fetchall()
            failed = []
            for row in rows:
                d = dict(row)
                try:
                    calls = json.loads(d.get("tool_calls") or "[]")
                except Exception:
                    calls = []
                if any("Error:" in str(c.get("result", "")) for c in calls):
                    d["tool_calls"] = calls
                    failed.append(d)
                if len(failed) >= limit:
                    break
            return failed
        except Exception as e:
            print(f"--- ThoughtGraph: query_failed_tool_calls failed ({e}) ---")
            return []

    def prune_old_thoughts(self, max_age_days: int = 30, max_rows: int = 10_000):
        """Weekly maintenance: remove old thoughts, keep selected for 90 days."""
        import time as _time
        cutoff = _time.time() - (max_age_days * 86400)
        selected_cutoff = _time.time() - (90 * 86400)
        try:
            with self._connect() as conn:
                conn.execute(
                    """DELETE FROM thought_graph
                       WHERE timestamp < ? AND (selected=0 OR timestamp < ?)""",
                    (cutoff, selected_cutoff),
                )
                # Cap at max_rows, delete oldest first
                conn.execute(
                    """DELETE FROM thought_graph WHERE thought_id IN (
                           SELECT thought_id FROM thought_graph
                           ORDER BY timestamp ASC
                           LIMIT MAX(0, (SELECT COUNT(*) FROM thought_graph) - ?)
                       )""",
                    (max_rows,),
                )
        except Exception as e:
            print(f"--- ThoughtGraph: prune failed ({e}) ---")
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_thought_graph.py -v
```
Expected: 8 passed.

- [ ] **Step 6: Commit**

```bash
git add thinking/__init__.py thinking/graph.py tests/test_thought_graph.py
git commit -m "feat: implement ThoughtGraph with SQLite persistence and retention pruning"
```

---

## Chunk 2: ContextController + ThinkingLoop + Orchestrator Integration

### Task 5: ContextController

**Files:**
- Create: `thinking/context.py`
- Create: `tests/test_context_controller.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_context_controller.py`:

```python
"""Tests for ContextController — semantic and recency-based context trimming."""
import pytest
from thinking.context import ContextController


def test_trim_returns_all_chunks_under_budget():
    """When total tokens < budget, all chunks are returned unchanged."""
    cc = ContextController()
    chunks = ["short", "also short", "tiny"]
    result = cc.trim("query", chunks, budget_tokens=10_000)
    assert result == chunks


def test_trim_drops_chunks_over_budget():
    """When total tokens > budget, some chunks are dropped."""
    cc = ContextController()
    # Each 'x'*1000 ≈ 250 tokens (len/4). Three chunks = ~750 tokens.
    chunks = ["x" * 1000, "y" * 1000, "z" * 1000]
    result = cc.trim("query", chunks, budget_tokens=300)  # force drop
    assert len(result) < len(chunks)


def test_trim_without_embedder_drops_oldest():
    """Without embedder, recency trimming drops the first (oldest) chunks."""
    cc = ContextController(embedder=None)
    chunks = ["oldest", "middle", "newest"]
    # Budget for ~1 chunk only (each ~1-2 tokens estimated)
    result = cc.trim("query", chunks, budget_tokens=5)
    assert "newest" in result
    assert "oldest" not in result


def test_default_budget_uses_n_ctx():
    cc = ContextController(n_ctx=4096)
    assert cc.default_budget() == int(4096 * 0.85)


def test_default_budget_custom_n_ctx():
    cc = ContextController(n_ctx=8192)
    assert cc.default_budget() == int(8192 * 0.85)


def test_trim_with_embedder_keeps_relevant_chunks():
    """With embedder, low-relevance chunks are dropped before older ones."""
    from unittest.mock import MagicMock
    import numpy as np

    embedder = MagicMock()
    # query embedding
    query_emb = np.array([1.0, 0.0])
    # chunk embeddings: relevant, irrelevant, somewhat relevant
    chunk_embs = [
        np.array([1.0, 0.0]),   # cosine sim = 1.0 (most relevant)
        np.array([0.0, 1.0]),   # cosine sim = 0.0 (irrelevant)
        np.array([0.7, 0.7]),   # cosine sim ≈ 0.7
    ]
    embedder.embed = MagicMock(side_effect=[query_emb] + chunk_embs)

    cc = ContextController(embedder=embedder, n_ctx=4096)
    chunks = ["relevant", "irrelevant", "somewhat"]
    # Budget forces dropping 1 chunk (each ≈ 2-3 tokens, budget = 5)
    result = cc.trim("query", chunks, budget_tokens=5)
    assert "irrelevant" not in result
    assert "relevant" in result


def test_trim_graceful_on_embedder_failure():
    """If embedder.embed() throws, fall back to recency trimming — no crash."""
    from unittest.mock import MagicMock
    embedder = MagicMock()
    embedder.embed = MagicMock(side_effect=RuntimeError("GPU OOM"))

    cc = ContextController(embedder=embedder)
    chunks = ["a", "b", "c"]
    result = cc.trim("query", chunks, budget_tokens=5)
    assert isinstance(result, list)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_context_controller.py -v
```
Expected: ImportError — `thinking.context` does not exist.

- [ ] **Step 3: Implement ContextController**

Create `thinking/context.py`:

```python
"""ContextController — trims context chunks to fit within a token budget."""
from __future__ import annotations


def _estimate_tokens(text: str) -> int:
    """Rough approximation: 4 characters per token."""
    return max(1, len(text) // 4)


class ContextController:
    """Trims context to fit within a token budget.

    Trimming strategy:
    - With embedder: drops lowest-relevance chunks first (cosine similarity).
    - Without embedder (or on embedder failure): drops oldest chunks first.
    """

    def __init__(self, embedder=None, n_ctx: int = 4096):
        self._embedder = embedder
        self._n_ctx = n_ctx

    def default_budget(self) -> int:
        """Returns the recommended budget for this controller's n_ctx."""
        return int(self._n_ctx * 0.85)

    def trim(self, query: str, chunks: list[str], budget_tokens: int) -> list[str]:
        """Return a subset of chunks that fits within budget_tokens.

        Args:
            query: The current user query (used for relevance scoring).
            chunks: Ordered list of context strings (oldest first).
            budget_tokens: Maximum total tokens allowed.

        Returns:
            Trimmed list; always a subset of chunks, preserving relative order.
        """
        if not chunks:
            return []

        total = sum(_estimate_tokens(c) for c in chunks)
        if total <= budget_tokens:
            return list(chunks)

        # Try semantic trimming first
        try:
            if self._embedder is not None:
                return self._semantic_trim(query, chunks, budget_tokens)
        except Exception as e:
            print(f"--- ContextController: embedder failed ({e}), using recency trim ---")

        return self._recency_trim(chunks, budget_tokens)

    def _semantic_trim(self, query: str, chunks: list[str], budget: int) -> list[str]:
        import numpy as np

        query_emb = self._embedder.embed(query)
        scored = []
        for chunk in chunks:
            chunk_emb = self._embedder.embed(chunk)
            # Cosine similarity
            denom = (np.linalg.norm(query_emb) * np.linalg.norm(chunk_emb))
            score = float(np.dot(query_emb, chunk_emb) / denom) if denom > 0 else 0.0
            scored.append((score, chunk))

        # Sort by score descending, keep highest until budget filled
        scored.sort(key=lambda x: x[0], reverse=True)
        kept, total = [], 0
        for score, chunk in scored:
            t = _estimate_tokens(chunk)
            if total + t <= budget:
                kept.append(chunk)
                total += t

        # Restore original order for kept chunks
        kept_set = set(id(c) for c in kept)
        return [c for c in chunks if id(c) in kept_set]

    def _recency_trim(self, chunks: list[str], budget: int) -> list[str]:
        """Keep the most recent (rightmost) chunks that fit in the budget."""
        kept, total = [], 0
        for chunk in reversed(chunks):
            t = _estimate_tokens(chunk)
            if total + t <= budget:
                kept.append(chunk)
                total += t
            # Stop if even one more chunk would overflow
        kept.reverse()
        return kept
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_context_controller.py -v
```
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add thinking/context.py tests/test_context_controller.py
git commit -m "feat: implement ContextController with semantic and recency-based trimming"
```

---

### Task 6: ThinkingLoop

**Files:**
- Create: `thinking/loop.py`
- Create: `tests/test_thinking_loop.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_thinking_loop.py`:

```python
"""Tests for ThinkingLoop — iterative self-correcting reasoning loop."""
import asyncio
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from core.planner import Plan
from agents.protocol import UACPPayload
from thinking.loop import ThinkingLoop
from thinking.graph import ThoughtGraph


def _make_plan(task="test task"):
    return Plan(
        task=task,
        reasoning_required=False,
        coding_required=False,
        models=[],
        tool_calls=[],
        confidence=0.9,
    )


def _make_payload(score: float, guidance: str = ""):
    return UACPPayload(
        agent="critic",
        confidence=score,
        analysis="test analysis",
        guidance=guidance or ("Revise." if score < 0.7 else "Looks good."),
    )


@pytest.fixture
def mock_components(tmp_path):
    planner = MagicMock()
    planner.plan = MagicMock(return_value=_make_plan())

    agent_loop = MagicMock()
    agent_loop.run = AsyncMock(return_value=[])

    synthesizer = MagicMock()
    synthesizer.synthesize = MagicMock(return_value="draft response")

    critic = MagicMock()
    critic.evaluate = MagicMock(return_value=_make_payload(0.9))

    graph = ThoughtGraph(db_path=str(tmp_path / "test.db"))

    return planner, agent_loop, synthesizer, critic, graph


def test_think_returns_string(mock_components):
    """think() must return a string."""
    planner, agent_loop, synthesizer, critic, graph = mock_components
    loop = ThinkingLoop(planner, agent_loop, synthesizer, critic, graph)
    result = asyncio.run(loop.think("hello", "ctx", []))
    assert isinstance(result, str)
    assert result == "draft response"


def test_think_commits_on_first_pass_when_score_high(mock_components):
    """When CriticAgent scores >= threshold on first iteration, loop exits immediately."""
    planner, agent_loop, synthesizer, critic, graph = mock_components
    critic.evaluate.return_value = _make_payload(0.95)

    loop = ThinkingLoop(planner, agent_loop, synthesizer, critic, graph,
                        threshold=0.75, max_iters=8)
    asyncio.run(loop.think("q", "ctx", []))
    assert planner.plan.call_count == 1


def test_think_retries_when_score_low(mock_components):
    """When score < threshold, loop retries until score is high enough."""
    planner, agent_loop, synthesizer, critic, graph = mock_components
    # First two calls fail, third passes
    critic.evaluate.side_effect = [
        _make_payload(0.4),
        _make_payload(0.5),
        _make_payload(0.9),
    ]
    loop = ThinkingLoop(planner, agent_loop, synthesizer, critic, graph,
                        threshold=0.75, max_iters=8)
    result = asyncio.run(loop.think("q", "ctx", []))
    assert planner.plan.call_count == 3
    assert result == "draft response"


def test_think_stops_at_max_iters(mock_components):
    """Loop must stop at max_iters even if score never reaches threshold."""
    planner, agent_loop, synthesizer, critic, graph = mock_components
    critic.evaluate.return_value = _make_payload(0.3)  # always low
    loop = ThinkingLoop(planner, agent_loop, synthesizer, critic, graph,
                        threshold=0.75, max_iters=3)
    asyncio.run(loop.think("q", "ctx", []))
    assert planner.plan.call_count == 3


def test_think_injects_critique_feedback_on_retry(mock_components):
    """On retry, critique guidance must be appended to short_memory."""
    planner, agent_loop, synthesizer, critic, graph = mock_components
    critic.evaluate.side_effect = [
        _make_payload(0.4, "Fix the logic."),
        _make_payload(0.9),
    ]
    loop = ThinkingLoop(planner, agent_loop, synthesizer, critic, graph)
    asyncio.run(loop.think("q", "initial context", []))

    # Second call to planner should receive context with critique embedded
    second_call_context = planner.plan.call_args_list[1][0][1]
    assert "Fix the logic." in second_call_context


def test_think_writes_to_thought_graph(mock_components, tmp_path):
    """Each iteration must write a node to ThoughtGraph."""
    planner, agent_loop, synthesizer, critic, graph = mock_components
    critic.evaluate.side_effect = [_make_payload(0.4), _make_payload(0.9)]

    loop = ThinkingLoop(planner, agent_loop, synthesizer, critic, graph)
    asyncio.run(loop.think("q", "ctx", []))

    rows = graph.query_by_session(loop._last_session_id)
    assert len(rows) == 2
    assert any(r["selected"] for r in rows)


def test_think_stream_yields_events(mock_components):
    """think_stream() must yield typed event dicts for each phase."""
    planner, agent_loop, synthesizer, critic, graph = mock_components

    loop = ThinkingLoop(planner, agent_loop, synthesizer, critic, graph)

    async def collect():
        events = []
        async for event in loop.think_stream("q", "ctx", []):
            events.append(event)
        return events

    events = asyncio.run(collect())
    types = {e["type"] for e in events}
    assert "plan" in types
    assert "critique" in types
    assert "final" in types
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_thinking_loop.py -v
```
Expected: ImportError — `thinking.loop` does not exist.

- [ ] **Step 3: Implement ThinkingLoop**

Create `thinking/loop.py`:

```python
"""ThinkingLoop — iterative self-correcting reasoning loop for Project ECHO."""
from __future__ import annotations
import uuid
from config import settings
from thinking.context import ContextController


class ThinkingLoop:
    """Wraps Planner → AgentLoop → Synthesizer in a CriticAgent-driven loop.

    Two public methods:
    - think()        — coroutine, returns final answer string (non-streaming).
    - think_stream() — async generator, yields partial result dicts (streaming).
    Both share _run_iteration() for the core logic.
    """

    def __init__(
        self,
        planner,
        agent_loop,
        synthesizer,
        critic,
        graph,
        max_iters: int = None,
        threshold: float = None,
        context_controller: ContextController = None,
    ):
        self._planner = planner
        self._agent_loop = agent_loop
        self._synthesizer = synthesizer
        self._critic = critic
        self._graph = graph
        self._max_iters = max_iters if max_iters is not None else settings.THINKING_LOOP_MAX_ITERS
        self._threshold = threshold if threshold is not None else settings.THINKING_LOOP_THRESHOLD
        self._context_ctrl = context_controller or ContextController()
        self._last_session_id = None  # set on each think() call, used by tests

    async def think(self, user_input: str, context: str, memories: list) -> str:
        """Non-streaming: run full loop, return final answer string."""
        session_id = uuid.uuid4().hex
        self._last_session_id = session_id
        parent_id = None
        current_context = context
        best_answer = ""

        for iteration in range(self._max_iters):
            answer, payload, tool_results = await self._run_iteration(
                user_input, current_context, memories
            )

            thought_id = self._graph.write(
                session_id=session_id,
                parent_id=parent_id,
                iteration=iteration,
                query=user_input,
                content=answer,
                score=payload.confidence,
                tool_calls=tool_results,
            )
            parent_id = thought_id
            best_answer = answer

            if payload.confidence >= self._threshold:
                self._graph.mark_selected(thought_id)
                break

            if iteration < self._max_iters - 1:
                current_context = self._build_revision_context(
                    current_context, payload, iteration
                )

        return best_answer

    async def think_stream(self, user_input: str, context: str, memories: list):
        """Streaming async generator: yields typed partial result dicts."""
        session_id = uuid.uuid4().hex
        self._last_session_id = session_id
        parent_id = None
        current_context = context

        for iteration in range(self._max_iters):
            # Signal: planning started
            plan = self._planner.plan(user_input, current_context,
                                      self._format_memories(memories))
            yield {"type": "plan", "iteration": iteration,
                   "data": plan.task}

            # Execute tools
            tool_results = []
            if plan.tool_calls:
                tool_results = await self._agent_loop.run(plan, plan.tool_calls)
                for i, r in enumerate(tool_results):
                    yield {"type": "tool_result", "index": i, "data": str(r)}

            # Synthesize
            outputs = {"tools": tool_results}
            answer = self._synthesizer.synthesize(plan, outputs)
            yield {"type": "token", "data": answer}

            # Critique
            payload = self._critic.evaluate({"output": answer, "task_id": session_id})
            yield {"type": "critique", "score": payload.confidence, "iteration": iteration}

            thought_id = self._graph.write(
                session_id=session_id,
                parent_id=parent_id,
                iteration=iteration,
                query=user_input,
                content=answer,
                score=payload.confidence,
                tool_calls=tool_results,
            )
            parent_id = thought_id

            if payload.confidence >= self._threshold:
                self._graph.mark_selected(thought_id)
                yield {"type": "final", "data": answer}
                return

            if iteration < self._max_iters - 1:
                current_context = self._build_revision_context(
                    current_context, payload, iteration
                )

        yield {"type": "final", "data": answer}

    async def _run_iteration(self, user_input: str, context: str, memories: list):
        """Execute one planner → agent_loop → synthesizer → critic cycle."""
        plan = self._planner.plan(user_input, context, self._format_memories(memories))
        tool_results = []
        if plan.tool_calls:
            tool_results = await self._agent_loop.run(plan, plan.tool_calls)
        outputs = {"tools": tool_results}
        answer = self._synthesizer.synthesize(plan, outputs)
        payload = self._critic.evaluate({"output": answer, "task_id": user_input[:50]})
        return answer, payload, tool_results

    def _build_revision_context(self, prev_context: str, payload, iteration: int) -> str:
        feedback = (
            f"\n[Iteration {iteration + 1} critique — score {payload.confidence:.2f}]: "
            f"{payload.guidance}"
        )
        return prev_context + feedback

    @staticmethod
    def _format_memories(memories: list) -> list:
        """Ensure memories is a list of strings."""
        if not memories:
            return []
        return [str(m) if not isinstance(m, str) else m for m in memories]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_thinking_loop.py -v
```
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add thinking/loop.py tests/test_thinking_loop.py
git commit -m "feat: implement ThinkingLoop with iterative self-correction and think_stream()"
```

---

### Task 7: Orchestrator Integration

**Files:**
- Modify: `core/orchestrator.py`
- Create: `tests/test_orchestrator_integration.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_orchestrator_integration.py`:

```python
"""Integration tests for Orchestrator's ThinkingLoop integration."""
import asyncio
import pytest
from unittest.mock import MagicMock, AsyncMock, patch


def _make_mock_orchestrator():
    """Build a minimal Orchestrator with all heavy deps mocked."""
    with patch("core.orchestrator.Llama") as mock_llama_cls, \
         patch("core.orchestrator.ProfileManager"), \
         patch("core.orchestrator.SystemTelemetry") as mock_telemetry, \
         patch("core.orchestrator.SwarmController"), \
         patch("core.orchestrator.BackgroundScheduler"), \
         patch("core.orchestrator.BackgroundAgent"), \
         patch("core.orchestrator.VoiceTTS"):
        mock_llama_cls.return_value = MagicMock()
        mock_telemetry.return_value.nvidia_available = False
        from core.orchestrator import Orchestrator
        orch = Orchestrator.__new__(Orchestrator)
        # Minimal state
        orch.planner_llm = MagicMock()
        orch.short_mem = MagicMock()
        orch.short_mem.context = MagicMock(return_value="ctx")
        orch.short_mem.add = MagicMock()
        orch.short_mem.buffer = []
        return orch


def test_orchestrator_has_thinking_loop_attribute():
    """After Phase 1 integration, Orchestrator must expose a thinking_loop attribute."""
    # This test will fail until Task 7 is complete
    from core.orchestrator import Orchestrator
    import inspect
    src = inspect.getsource(Orchestrator.__init__)
    assert "ThinkingLoop" in src or "thinking_loop" in src


def test_legacy_process_method_exists():
    """_legacy_process() must exist as a fallback."""
    from core.orchestrator import Orchestrator
    assert hasattr(Orchestrator, "_legacy_process")


def test_settings_flag_respected():
    """When THINKING_LOOP_ENABLED=False, process() must use _legacy_process."""
    import config.settings as s
    original = s.THINKING_LOOP_ENABLED
    try:
        s.THINKING_LOOP_ENABLED = False
        from core.orchestrator import Orchestrator
        import inspect
        src = inspect.getsource(Orchestrator.process)
        assert "THINKING_LOOP_ENABLED" in src or "_legacy_process" in src
    finally:
        s.THINKING_LOOP_ENABLED = original
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_orchestrator_integration.py -v
```
Expected: `test_orchestrator_has_thinking_loop_attribute` and `test_legacy_process_method_exists` fail.

- [ ] **Step 3: Integrate ThinkingLoop into Orchestrator**

In `core/orchestrator.py`, make three targeted changes:

**3a — Add imports at the top (after existing imports):**
```python
from thinking.loop import ThinkingLoop
from thinking.graph import ThoughtGraph
from thinking.context import ContextController
from config import settings
```

**3b — In `__init__()`, after `self.smart_router = SmartRouter()`, add:**
```python
# Phase 1: Cognitive Architecture
self.thought_graph = ThoughtGraph()
self.context_ctrl = ContextController(n_ctx=4096)
self.thinking_loop = None  # lazy-initialized after planner LLM is ready
```

**3c — Add `_get_thinking_loop()` helper method:**
```python
def _get_thinking_loop(self):
    if self.thinking_loop is None:
        from agents.critic_agent import CriticAgent
        critic = CriticAgent(self.planner_llm)
        self.thinking_loop = ThinkingLoop(
            planner=self.planner,
            agent_loop=self.agent_loop,
            synthesizer=self.synthesizer,
            critic=critic,
            graph=self.thought_graph,
            context_controller=self.context_ctrl,
        )
    return self.thinking_loop
```

**3d — Extract `_legacy_process()` from the existing `process()` body:**

The current `process()` method (lines 193–287) contains the single-pass logic. Extract the core response generation into `_legacy_process()`:

```python
async def _legacy_process(self, user_input: str, plan, outputs: dict) -> str:
    """Single-pass synthesis — fallback when ThinkingLoop is disabled or fails."""
    if plan.reasoning_required:
        reasoner = self.get_reasoning()
        outputs["reasoning"] = reasoner.run(user_input)
    print("\nAI: ", end="", flush=True)
    final_answer = self.synthesizer.synthesize(plan, outputs)
    print("\n")
    return final_answer
```

**3e — In `process()`, replace the synthesis section with:**

```python
# --- ThinkingLoop or legacy ---
if settings.THINKING_LOOP_ENABLED:
    try:
        memories_text = [str(m) for m in memories]
        final_answer = await self._get_thinking_loop().think(
            user_input,
            self.short_mem.context(),
            memories_text,
        )
        print(f"\nAI: {final_answer}\n")
    except Exception as e:
        print(f"--- ThinkingLoop failed ({e}), falling back to legacy ---")
        import traceback; traceback.print_exc()
        outputs = await self.agent_loop.run(plan, plan.tool_calls) if plan.tool_calls else {}
        final_answer = await self._legacy_process(user_input, plan, outputs)
else:
    outputs = await self.agent_loop.run(plan, plan.tool_calls) if plan.tool_calls else {}
    final_answer = await self._legacy_process(user_input, plan, outputs)
```

- [ ] **Step 4: Run all Phase 1 tests**

```bash
venv\Scripts\python -m pytest tests/test_protocol.py tests/test_critic_guidance.py tests/test_thought_graph.py tests/test_context_controller.py tests/test_thinking_loop.py tests/test_orchestrator_integration.py -v
```
Expected: All tests pass (21+ tests).

- [ ] **Step 5: Smoke test — start ECHO and send one message**

```bash
venv\Scripts\python main.py
```
Type: `hello`
Expected: ECHO responds normally (ThinkingLoop runs, no crash). Console shows `--- Iteration 0 ---` style output or similar.

If console shows `--- ThinkingLoop failed ... falling back to legacy ---`, the loop itself has a bug — fix before committing.

- [ ] **Step 6: Commit**

```bash
git add core/orchestrator.py tests/test_orchestrator_integration.py
git commit -m "feat: integrate ThinkingLoop into Orchestrator with legacy fallback"
```

---

## Phase 1 Complete

Run the full suite one final time before moving to Phase 2:

```bash
venv\Scripts\python -m pytest tests/ -v --tb=short
```

Expected: All Phase 1 tests pass. Zero failures.

**Next:** Phase 2 — Agent Personality Models + Skill Compiler (`docs/superpowers/plans/2026-03-12-phase2-agent-intelligence.md`)
