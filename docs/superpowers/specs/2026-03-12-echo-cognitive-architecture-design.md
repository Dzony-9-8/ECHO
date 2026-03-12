# ECHO Cognitive Architecture — Full Design Spec
**Date:** 2026-03-12
**Status:** Approved
**Scope:** All 14 features across 4 layers

---

## Overview

This spec covers the full cognitive architecture upgrade for Project ECHO — a local AI orchestration system running GGUF models on a GTX 1080Ti. The upgrade is decomposed into 4 layers with explicit dependencies. Each layer is an independent implementation cycle.

**Guiding principles:**
- Every new component degrades gracefully — no new component can crash `Orchestrator.process()`
- Additive-only changes to existing files where possible
- Feature flags for all major new behaviors
- GTX 1080Ti constraint (11GB VRAM, 4096 n_ctx) informs all inference design decisions

---

## Layer 1 — Foundation

### 1. Context Window Manager

**Module:** `thinking/context.py` — `ContextController`
**Purpose:** Prevent context overflow before LLM calls; prioritize relevant context over recent context.

**Interface:**
```python
class ContextController:
    def __init__(self, embedder=None, n_ctx: int = 4096): ...
    def trim(self, query: str, chunks: list[str], budget_tokens: int) -> list[str]: ...
    def default_budget(self) -> int: ...  # returns int(self.n_ctx * 0.85)
```

**Behavior:**
- `budget_tokens` is **caller-supplied**: callers compute `int(model.n_ctx * 0.85)` and pass it in. Default callers use `int(4096 * 0.85) = 3480`.
- `n_ctx` is a constructor argument (default 4096) used only when callers call the convenience helper `default_budget() -> int` which returns `int(self.n_ctx * 0.85)`.
- If embedder is available: scores each chunk against query via cosine similarity, trims lowest-scoring chunks first
- If embedder unavailable: falls back to recency-based trimming (drop oldest first)
- Token count estimated as `len(text) / 4` (character-to-token approximation)

**Integration points:** Called by `Planner.plan()` and `OutputSynthesizer.synthesize()` before LLM calls. Each caller passes the budget appropriate for its model instance's `n_ctx`.

**Feature flag:** `CONTEXT_CONTROLLER_ENABLED` (default: `True`)

---

### 2. Cognitive Architecture Loop (Thinking Loop)

**Module:** `thinking/loop.py` — `ThinkingLoop`
**Purpose:** Replace single-pass reasoning with iterative self-correcting loop.

**Interface — two methods, never combined:**
```python
class ThinkingLoop:
    def __init__(self, planner, agent_loop, synthesizer, critic, graph, max_iters=8, threshold=0.75): ...

    async def think(self, user_input: str, context: str, memories: list) -> str:
        """Non-streaming: runs full loop, returns final answer string."""
        ...

    async def think_stream(self, user_input: str, context: str, memories: list):
        """Streaming async generator: yields partial result dicts. Used by StreamingPipeline (Phase 5)."""
        ...
```

`think()` and `think_stream()` share the same internal loop logic via a private `_run_iteration()` helper. `Orchestrator.process()` calls `think()` in Phase 1. Phase 5 replaces the emit path with `think_stream()` for streaming clients only — `think()` remains unchanged.

**Loop behavior per iteration (shared by both methods):**
1. `ContextController.trim()` applied to context + memories, using `int(planner_model.n_ctx * 0.85)` as budget
2. `Planner.plan()` called — on revision iterations, critique feedback appended to context
3. `AgentLoop.run()` executes tool calls
4. `OutputSynthesizer.synthesize()` generates draft
5. `CriticAgent.evaluate()` scores draft — returns `UACPPayload` with `confidence`, `analysis`, and `guidance` fields (see §2a below)
6. If `payload.confidence >= threshold` or `iteration == max_iters`: commit and return
7. Else: append `f"Previous attempt scored {payload.confidence}/1.0 because: {payload.analysis}. Revise by: {payload.guidance}"` to context, loop

**ThoughtGraph writes:** One node per iteration (see §3).

**Integration:** `Orchestrator.process()` replaces direct planner/loop/synthesizer calls with `await ThinkingLoop.think(...)`.

**Feature flag:** `THINKING_LOOP_ENABLED` (default: `True`). When `False`, orchestrator uses existing single-pass behavior unchanged.

---

#### 2a. UACPPayload and CriticAgent Extension

`agents/protocol.py` — add `guidance: str = ""` field to `UACPPayload`:
```python
@dataclass
class UACPPayload:
    agent: str
    task_id: str = ""
    analysis: str = ""
    output: Any = None
    confidence: float = 1.0
    requires_revision: bool = False
    notes_for_memory: str = ""
    execution_time_ms: int = 0
    guidance: str = ""          # NEW: actionable revision instruction for ThinkingLoop
```

`agents/critic_agent.py` — `CriticAgent.evaluate()` populates `guidance` by deriving it from `analysis`. The same three-branch derivation applies in **both** the LLM success path and the `except` block (before `_heuristic_evaluate()` is called):
```python
# Applied after extracting score and analysis (in both LLM and heuristic paths):
guidance = analysis  # default: use analysis as guidance directly
if score < 0.4:
    guidance = f"Completely redo the response. Core issue: {analysis}"
elif score < 0.7:
    guidance = f"Revise the response. Address: {analysis}"
```

`agents/critic_agent.py` is **modified** (contradicting the original "unchanged" claim — corrected in File Changes Summary below).

---

### 3. Thought Graph System

**Module:** `thinking/graph.py` — `ThoughtGraph`
**Purpose:** Persist reasoning traces for analysis, debugging, and self-improvement.

**Path anchoring:** `ThoughtGraph` uses the same pattern as `orchestrator.py` line 64:
```python
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(base_dir, "intelligence", "memory.db")
```
This resolves correctly regardless of `os.getcwd()` at runtime.

**Storage:** New table `thought_graph` in `intelligence/memory.db`:
```sql
CREATE TABLE IF NOT EXISTS thought_graph (
    thought_id   TEXT PRIMARY KEY,
    session_id   TEXT,
    project_id   TEXT,
    parent_id    TEXT,
    iteration    INTEGER,
    query        TEXT,
    content      TEXT,
    tool_calls   TEXT,   -- JSON-serialized list of tool call results from AgentLoop
    score        REAL,
    selected     BOOLEAN DEFAULT FALSE,
    timestamp    REAL
);
```

**`tool_calls` column:** Each `ThinkingLoop` iteration passes `AgentLoop` results into `ThoughtGraph.write()`. This is the authoritative record of tool call history used by `SelfImprovementEngine` — no separate `AgentLoop` history store is needed.

**Interface:**
```python
class ThoughtGraph:
    def write(self, session_id, parent_id, iteration, query, content, score,
              tool_calls: list = None, project_id: str = None) -> str: ...
    def mark_selected(self, thought_id): ...
    def query_by_session(self, session_id) -> list[dict]: ...
    def query_low_scoring(self, min_score=0.0, max_score=0.6, limit=50) -> list[dict]: ...
    def query_failed_tool_calls(self, limit=50) -> list[dict]: ...  # parses tool_calls JSON
```

**Failure mode:** All writes wrapped in try/except. Failure logs a warning but never interrupts `ThinkingLoop`.

---

## Layer 2 — Agent Intelligence

### 4. Agent Personality Models

**Module:** `core/persona.py` (extended) + `config/agents.yaml` (new)
**Purpose:** Give each specialist agent a consistent, injected personality.

**`config/agents.yaml` schema:**
```yaml
agents:
  dev:
    tone: methodical, precise, direct
    verbosity: low
    strengths: [code generation, refactoring, debugging]
    communication_style: "Respond with code first, explanation after."
    quirks: "Always state assumptions before generating code."
  research:
    tone: curious, thorough, exploratory
    verbosity: high
    strengths: [web research, summarization, fact-finding]
    communication_style: "Lead with key findings, then supporting evidence."
    quirks: "Always cite uncertainty when data is incomplete."
  critic:
    tone: blunt, exacting, constructive
    verbosity: low
    strengths: [quality assessment, hallucination detection]
    communication_style: "State the score first, then justify."
    quirks: "Never soften criticism. Be specific about what failed."
```

**Integration:** `Persona.get_agent_persona(agent_name) -> str` returns formatted system prompt prefix. Each agent's `execute()` method prepends this to its system prompt.

---

### 5. AI Skill Compiler

**Module:** `skills/compiler.py` — `SkillCompiler`
**Purpose:** Compile human-readable `.md` skill files into structured agent execution plans.

**`CompiledSkill` schema:**
```python
@dataclass
class SkillStep:
    action: str          # "call_tool" | "call_agent" | "llm_prompt" | "call_skill"
    target: str          # tool name, agent name, or skill name
    args: dict
    on_failure: str      # "skip" | "abort" | "fallback"

@dataclass
class CompiledSkill:
    name: str
    trigger_keywords: list[str]
    steps: list[SkillStep]
    required_tools: list[str]
    success_criteria: str
    fallback_strategy: str
```

**Interface:**
```python
class SkillCompiler:
    def __init__(self, embedder=None): ...
    def scan(self, skills_dir: str) -> int: ...         # returns count of compiled skills
    def match(self, query: str) -> CompiledSkill | None: ...
```

**`match()` degradation behavior:**
- If `embedder` is available: uses cosine similarity with threshold 0.7
- If `embedder` is `None` or fails: falls back to keyword matching — checks if any `trigger_keyword` appears (case-insensitive) in the query. When multiple skills match, the skill with the most matching keywords wins; alphabetical skill name is the tiebreaker. Returns best match or `None`.
- Either path returning `None` = no skill matched = `ThinkingLoop` proceeds without skill injection. No crash.

**Behavior:**
- Scans `config/skills/*.md` on startup
- Compiled JSON cached in `config/skills/compiled/`
- Cache invalidated when source `.md` mtime changes
- When matched, `ThinkingLoop` injects skill steps as structured plan template into `Planner` context

**Failure mode:** Parse errors log and skip the skill. No compiled skill = no crash.

---

### 6. Autonomous Tool Discovery

**Module:** `tools/discovery.py` — `ToolDiscovery`
**Purpose:** Automatically register tools without manual `_register_tools()` additions.

**Discovery mechanism:**
- Scans `tools/` for Python files with `TOOL_MANIFEST = {"name": ..., "description": ..., "fn": ...}` dict
- Also supports `@register_tool(name, description)` decorator
- Checks `tools/available/` for disabled/optional tools — activates matching ones when a task requires a capability not in the registry

**Scheduling:** Background task every 10 minutes via existing `BackgroundScheduler`.

**Interface:**
```python
class ToolDiscovery:
    def scan(self) -> list[str]: ...           # returns list of newly registered tool names
    def probe_for_capability(self, capability_description: str) -> bool: ...
```

---

### 7. Self-Improvement Engine

**Module:** `intelligence/self_improvement.py` — `SelfImprovementEngine`
**Purpose:** Analyze performance patterns and apply targeted improvements automatically.

**Runs:** Background task every 30 minutes via `BackgroundScheduler`.

**Data source:** All analysis reads from `ThoughtGraph` only. The `tool_calls` column in `thought_graph` contains serialized tool call results per iteration — this is the authoritative source for failed tool call analysis. No separate `AgentLoop` history store is required.

**Analysis pipeline:**
1. Query `ThoughtGraph` for last 100 thoughts
2. Identify low-scoring query types (score < 0.6) — group by query similarity clusters
3. Identify which critique feedback patterns (from `analysis` + `guidance` fields) led to successful revision (score jumped from < 0.6 to >= 0.75 in subsequent iterations)
4. Identify failed tool calls via `ThoughtGraph.query_failed_tool_calls()` (parses `tool_calls` JSON for error entries)

**Three adjustment types:**
- **(a) Prompt patches:** Appended to agent system prompts. Stored in `config/prompt_patches.json`. Format: `{"agent": "dev", "patch": "When generating SQL, always include error handling.", "source_thought_id": "abc123"}`
- **(b) Routing adjustments:** Updates `SmartRouter` confidence thresholds based on observed escalation outcomes
- **(c) Memory priority adjustments:** Tunes `ImportanceScorer` weights for memory types that correlated with high-scoring outputs

**Safety:** All adjustments logged to `intelligence/improvement_log.jsonl`. Any adjustment can be reverted by deleting its entry. No adjustment modifies core model weights.

---

## Layer 3 — Inference Performance

### 8. KV Cache Reuse

**Module:** `core/kv_cache.py` — `KVCacheManager`
**Purpose:** Avoid re-encoding unchanged system prompt prefix on every turn.

**Mechanism:**
- Hash the system prompt (persona + profile + agent personality) per model instance
- If hash matches previous call: skip prefix re-encoding (llama-cpp-python reuses KV state automatically when the same `Llama` instance is reused with overlapping prefix tokens)
- `KVCacheManager` enforces that model instances are not reloaded unnecessarily

**Integration:** Wraps `_get_model_instance()` in `Orchestrator`. No changes to `Llama` initialization parameters needed.

---

### 9. Speculative Decoding

**Module:** `core/speculative.py` — `SpeculativeDecoder`
**Purpose:** Use the fast 8B planner model to draft tokens; verify with DeepSeek-R1.

**Activation condition:** `plan.reasoning_required == True` (set by `SmartRouter`)

**Prerequisite check:** On `SpeculativeDecoder.__init__()`, probe for `llama_speculative` in `llama_cpp`:
```python
try:
    from llama_cpp import llama_speculative
    self._native_speculative = True
except ImportError:
    self._native_speculative = False
```
If `_native_speculative` is `False`, `SpeculativeDecoder` uses the **response-level fallback**: draft model generates a full response candidate; verifier model scores the full candidate via a single short continuation prompt ("Is this response correct? Score 0-1:"). If verifier score < 0.6, full DeepSeek-R1 generation is used instead.

**Native mechanism (when available):**
- Draft model (LLaMA 3.1 8B) generates `k=4` candidate tokens
- Verifier model (DeepSeek-R1) scores the draft tokens in a single forward pass
- Accepted tokens are committed; rejected tokens cause rollback and re-generation from DeepSeek-R1
- Expected speedup: 2–3x on reasoning tasks

**Required llama-cpp-python version for native path:** `>= 0.2.90` (first version with public `llama_speculative` support). Check with `pip show llama-cpp-python`.

**Failure mode:** If draft acceptance rate < 40% over 10 iterations (native), or if verifier score is consistently > 0.6 but actual output quality is poor (response-level), `SpeculativeDecoder` disables itself for the session and falls back to standard DeepSeek-R1 decoding. If the verifier scoring call itself fails for any reason (model unavailable, generation error), treat it as score < 0.6 and use full DeepSeek-R1 generation directly.

---

### 10. Model Quantization Switching

**Module:** `core/quant_controller.py` — `QuantController`
**Purpose:** Select the right quantization level based on task complexity.

**Complexity → quantization mapping:**
| Complexity Score | Quantization | Use Case |
|---|---|---|
| < 0.4 | Q4_K_M | Simple queries, low VRAM |
| 0.4 – 0.7 | Q6_K | Balanced tasks |
| > 0.7 | Q8_0 | Complex reasoning |

**Model file naming convention:** `deepseek-r1-q4.gguf`, `deepseek-r1-q6.gguf`, `deepseek-r1-q8.gguf`

**Graceful degradation:** If a quantization variant is missing, falls back to whatever is available (scans for any `deepseek-r1-*.gguf`, picks highest available quant). Logs a warning.

**Integration:** `QuantController.select(model_name, complexity_score) -> str` returns the absolute path. Called from `get_reasoning()` and `get_coder()` in `Orchestrator`.

---

### 11. Token Streaming Optimization

**Module:** `core/stream_batcher.py` — `StreamBatcher`
**Purpose:** Reduce IPC/WebSocket overhead by batching tokens before emitting to UI.

**Interface:**
```python
class StreamBatcher:
    def __init__(self, batch_size: int = 12): ...
    def feed(self, token: str) -> str | None: ...  # returns batch when full, else None
    def flush(self) -> str: ...                    # returns remaining buffered tokens
```

**Integration:** Sits between model token generator and UI emit layer in `main.py` / API server.

**Configurable:** `STREAM_BATCH_SIZE` in config (default: 12). Set to 1 for per-token streaming.

---

### 12. Response Streaming Pipeline

**Module:** `core/pipeline.py` — `StreamingPipeline`
**Purpose:** Stream intermediate results between agents rather than waiting for full completion.

**Mechanism:** `ThinkingLoop.think_stream()` (the async generator defined in §2) yields partial result dicts:
- After plan is generated: yields `{"type": "plan", "data": plan_summary}`
- After each tool call completes: yields `{"type": "tool_result", "data": result}`
- After each synthesizer token batch: yields `{"type": "token", "data": token_batch}`
- After critic evaluation: yields `{"type": "critique", "score": score, "iteration": n}`

`think()` (non-streaming) remains unchanged. `Orchestrator.process()` is not modified in Phase 5 — streaming is accessed via a new `Orchestrator.process_stream()` method that calls `think_stream()` and passes events to the UI via the existing WebSocket/IPC layer.

**Integration:** UI renders partial results in real-time when client connects to streaming endpoint.

---

### 13. GPU Scheduler

**Module:** `core/gpu_scheduler.py` — `GPUScheduler`
**Purpose:** Prevent VRAM conflicts between foreground and background tasks on the 1080Ti.

**Priority levels:**
- `FOREGROUND` — user-initiated tasks (always runs immediately)
- `BACKGROUND_HIGH` — memory consolidation, tool discovery
- `BACKGROUND_LOW` — self-improvement engine analysis

**Cooperative suspension protocol:**
`GPUScheduler` owns a shared `asyncio.Event` called `_foreground_clear`. Background tasks check this event at their natural `await` points via a helper:

```python
async def yield_to_foreground(self):
    """Background tasks call this at natural await points to suspend if foreground needs VRAM."""
    if not self._foreground_clear.is_set():
        await self._foreground_clear.wait()
```

Background tasks (`consolidate_memory`, `check_system_health`, `SelfImprovementEngine.run()`, `ToolDiscovery.scan()`) are **modified** to call `await scheduler.yield_to_foreground()` before each model call or heavy operation. When a foreground task arrives, `GPUScheduler` clears `_foreground_clear`; when it completes, it sets the event again. Background tasks resume at the next `yield_to_foreground()` call.

**Scheduler injection for new components:** `SelfImprovementEngine` and `ToolDiscovery` receive the `GPUScheduler` instance via constructor: `SelfImprovementEngine(graph, scheduler)` and `ToolDiscovery(registry, scheduler)`. Both store it as `self.scheduler`.

**Behavior:**
- Background tasks only start when `SystemTelemetry.check_vram_threshold(40%)` (VRAM < 60% used)
- When foreground arrives mid-background: `_foreground_clear` is cleared; background pauses at next `yield_to_foreground()` call; foreground runs; event is set; background resumes
- Existing background tasks that call no models (logging, file writes) need not be modified
- Uses existing `unload_idle_models()` as the VRAM eviction mechanism before foreground model load

**Multi-GPU:** If `nvidia-smi` detects 2+ GPUs, `GPUScheduler` assigns models to devices by VRAM capacity and current load. Single-GPU path is the default and fully implemented first.

---

## Layer 4 — Product Feature

### 14. AI Project Mode

**Module:** `projects/` — `ProjectManager`, `ProjectContext`
**Purpose:** Enable ECHO to manage long-running, multi-session projects with persistent context.

**Activation:** Commands `!project new <name>` and `!project resume <name>` in chat input, parsed in `Orchestrator.process()` before routing to `ThinkingLoop`.

**Storage:** New tables in `intelligence/memory.db` (same path anchoring as §3):
```sql
CREATE TABLE IF NOT EXISTS projects (
    project_id    TEXT PRIMARY KEY,
    name          TEXT UNIQUE,
    goal          TEXT,
    status        TEXT,  -- "active" | "paused" | "complete"
    created_at    REAL,
    updated_at    REAL
);
CREATE TABLE IF NOT EXISTS project_artifacts (
    artifact_id   TEXT PRIMARY KEY,
    project_id    TEXT,
    type          TEXT,  -- "file" | "code" | "note" | "summary"
    content       TEXT,
    path          TEXT,
    timestamp     REAL
);
```

**`ProjectContext`:** When a project is active, `ThinkingLoop.think()` receives project goal + recent artifacts + progress summary as additional context chunks. These chunks are passed through `ContextController.trim()` like all other context — no budget exception.

**Auto-resume:** On session start, if a project was `"active"` in the last session, `ProjectManager` proposes resuming it (prints prompt to user, waits for `y/n`).

**Progress summaries:** `ProjectManager.summarize()` uses the planner LLM to generate a concise status summary from artifact history. Stored as artifact of type `"summary"`.

**Integration with ThoughtGraph:** All thoughts tagged with `project_id` when project mode is active (via the `project_id` column in §3 schema).

---

## Cross-Cutting Concerns

### Feature Flags (`config/settings.py`)

All feature flags live in a single file. This is the authoritative list:

```python
# config/settings.py
THINKING_LOOP_ENABLED   = True
THINKING_LOOP_MAX_ITERS = 8
THINKING_LOOP_THRESHOLD = 0.75
CONTEXT_CONTROLLER_ENABLED = True
STREAM_BATCH_SIZE       = 12
SPECULATIVE_DECODING_ENABLED = True
GPU_SCHEDULER_ENABLED   = True
SKILL_COMPILER_ENABLED  = True
TOOL_DISCOVERY_ENABLED  = True
SELF_IMPROVEMENT_ENABLED = True
PROJECT_MODE_ENABLED    = True
```

Components read from `settings` at init time. Any flag set to `False` causes that component to skip its initialization and the code path that calls it falls back to the legacy behavior.

---

### Database Migration Strategy

No migration framework is needed. Every new component that writes to `intelligence/memory.db` runs `CREATE TABLE IF NOT EXISTS` in its `__init__()`. This is idempotent — running against an existing populated database is safe. The `thought_graph`, `projects`, and `project_artifacts` tables are created this way. The existing `MemoryManager` tables are untouched.

**Path:** All components use the absolute-path pattern from §3:
```python
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path  = os.path.join(base_dir, "intelligence", "memory.db")
```

---

### ThoughtGraph Retention Policy

Without pruning, `thought_graph` grows ~100 rows/day under normal use. A background task (added to `BackgroundScheduler`, runs weekly) prunes rows older than 30 days, keeping a maximum of 10,000 rows (deleting oldest-first when the cap is exceeded). Selected thoughts (`selected=TRUE`) are exempt from pruning for 90 days to preserve the best reasoning traces for self-improvement analysis.

---

### ThinkingLoop Catastrophic Failure Fallback

If `ThinkingLoop.think()` raises an unhandled exception (e.g., the planner LLM crashes mid-loop), `Orchestrator.process()` catches it, logs the full traceback, and falls back to the legacy single-pass path (directly calling `planner.plan()` → `agent_loop.run()` → `synthesizer.synthesize()`). The user sees a response either way. The fallback path is the existing pre-loop code, extracted into `Orchestrator._legacy_process()` so both paths share a reference.

---

## Implementation Order

| Phase | Features | Rationale |
|---|---|---|
| Phase 1 | ContextController, ThinkingLoop, ThoughtGraph, UACPPayload+CriticAgent extension | Core foundation — everything else depends on this |
| Phase 2 | AgentPersonalityModels, SkillCompiler | Quick wins that improve output quality immediately |
| Phase 3 | AutonomousToolDiscovery, SelfImprovementEngine | Requires ThoughtGraph data to be useful |
| Phase 4 | KVCacheReuse, QuantController, GPUScheduler | Inference optimizations — independent of cognitive changes |
| Phase 5 | SpeculativeDecoding, StreamBatcher, StreamingPipeline | Streaming requires stable pipeline first |
| Phase 6 | ProjectMode | Uses everything above |

---

## File Changes Summary

**New files:**
- `thinking/__init__.py`, `thinking/loop.py`, `thinking/graph.py`, `thinking/context.py`
- `skills/compiler.py`, `skills/__init__.py`
- `config/skills/` directory + example `.md` skills
- `tools/discovery.py`
- `intelligence/self_improvement.py`
- `core/kv_cache.py`, `core/speculative.py`, `core/quant_controller.py`
- `core/stream_batcher.py`, `core/pipeline.py`, `core/gpu_scheduler.py`
- `projects/__init__.py`, `projects/manager.py`, `projects/context.py`
- `config/agents.yaml`, `config/prompt_patches.json`, `config/settings.py`
- `tests/test_thinking_loop.py`, `tests/test_thought_graph.py`, `tests/test_context_controller.py`

**Modified files:**
- `core/orchestrator.py` — integrate `ThinkingLoop`, `GPUScheduler`, `QuantController`, project command parsing, `process_stream()` method, extract `_legacy_process()` fallback
- `core/persona.py` — add `get_agent_persona()`
- `agents/protocol.py` — add `guidance: str = ""` field to `UACPPayload`
- `agents/critic_agent.py` — populate `guidance` field in `evaluate()` and `_heuristic_evaluate()`
- `agents/background.py` — add `yield_to_foreground()` calls for GPU scheduler cooperative suspension
- `intelligence/memory.db` — new tables added via migration on startup

**Unchanged:** `Planner`, `TaskRouter`, `OutputSynthesizer`, all existing memory logic, all existing tool logic, `AgentLoop`, `ExecutionAgent`, `VerificationAgent`, profile system.
