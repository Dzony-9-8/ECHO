# Phase 2 — Agent Intelligence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every specialist agent a consistent personality and add a skill compiler that converts `.md` skill files into structured plan templates injected by ThinkingLoop.

**Architecture:** `config/agents.yaml` defines per-agent personality traits. `Persona.get_agent_persona()` renders them as system prompt prefixes. `SkillCompiler` scans `config/skills/*.md`, compiles them to JSON, and `ThinkingLoop` injects matched skills as planner context. No existing agent logic changes.

**Tech Stack:** Python 3.12, PyYAML, dataclasses, unittest.mock, pytest

**Prerequisite:** Phase 1 complete (ThinkingLoop, config/settings.py exist).

**Working directory:** `D:\AI\Claude Code\Project ECHO\ai-orchestrator`

---

## Chunk 1: Agent Personality Models

### Task 1: `config/agents.yaml`

**Files:**
- Create: `config/agents.yaml`

- [ ] **Step 1: Create agents.yaml**

```yaml
# config/agents.yaml
# Per-agent personality definitions injected as system prompt prefixes.
agents:
  dev:
    tone: "methodical, precise, direct"
    verbosity: low
    strengths:
      - code generation
      - refactoring
      - debugging
    communication_style: "Respond with code first, explanation after."
    quirks: "Always state assumptions before generating code."

  research:
    tone: "curious, thorough, exploratory"
    verbosity: high
    strengths:
      - web research
      - summarization
      - fact-finding
    communication_style: "Lead with key findings, then supporting evidence."
    quirks: "Always cite uncertainty when data is incomplete."

  critic:
    tone: "blunt, exacting, constructive"
    verbosity: low
    strengths:
      - quality assessment
      - hallucination detection
    communication_style: "State the score first, then justify."
    quirks: "Never soften criticism. Be specific about what failed."

  supervisor:
    tone: "calm, strategic, decisive"
    verbosity: medium
    strengths:
      - task delegation
      - synthesis
      - conflict resolution
    communication_style: "Give clear directives. Summarise outcomes."
    quirks: "Always confirm the objective before delegating."
```

- [ ] **Step 2: Verify YAML is valid**

```bash
venv\Scripts\python -c "import yaml; d=yaml.safe_load(open('config/agents.yaml')); print(list(d['agents'].keys()))"
```
Expected: `['dev', 'research', 'critic', 'supervisor']`

- [ ] **Step 3: Commit**

```bash
git add config/agents.yaml
git commit -m "feat: add per-agent personality definitions (config/agents.yaml)"
```

---

### Task 2: `Persona.get_agent_persona()`

**Files:**
- Modify: `core/persona.py`
- Create: `tests/test_agent_personas.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_agent_personas.py`:

```python
"""Tests for per-agent personality injection."""
import pytest
from core.persona import Persona


@pytest.fixture
def persona():
    return Persona()


def test_get_agent_persona_returns_string(persona):
    result = persona.get_agent_persona("dev")
    assert isinstance(result, str)
    assert len(result) > 0


def test_get_agent_persona_includes_tone(persona):
    result = persona.get_agent_persona("dev")
    assert "methodical" in result or "precise" in result or "direct" in result


def test_get_agent_persona_includes_communication_style(persona):
    result = persona.get_agent_persona("dev")
    assert "code first" in result.lower() or "explanation after" in result.lower()


def test_get_agent_persona_critic_is_blunt(persona):
    result = persona.get_agent_persona("critic")
    assert "blunt" in result or "score first" in result.lower()


def test_get_agent_persona_unknown_agent_returns_empty(persona):
    result = persona.get_agent_persona("nonexistent_agent")
    assert result == ""


def test_get_agent_persona_research_mentions_uncertainty(persona):
    result = persona.get_agent_persona("research")
    assert "uncertainty" in result.lower() or "incomplete" in result.lower()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
venv\Scripts\python -m pytest tests/test_agent_personas.py -v
```
Expected: AttributeError — `Persona` has no `get_agent_persona`.

- [ ] **Step 3: Read existing persona.py before editing**

```bash
venv\Scripts\python -c "import inspect; from core.persona import Persona; print(inspect.getsource(Persona))"
```

- [ ] **Step 4: Add `get_agent_persona()` to Persona**

Add to the bottom of the `Persona` class in `core/persona.py`:

```python
def get_agent_persona(self, agent_name: str) -> str:
    """Returns a system prompt prefix for the named agent, or '' if unknown."""
    import os
    import yaml
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    agents_yaml = os.path.join(base_dir, "config", "agents.yaml")
    try:
        with open(agents_yaml, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        agent = data.get("agents", {}).get(agent_name)
        if not agent:
            return ""
        lines = [
            f"AGENT PERSONALITY [{agent_name.upper()}]:",
            f"Tone: {agent.get('tone', '')}",
            f"Communication style: {agent.get('communication_style', '')}",
            f"Quirk: {agent.get('quirks', '')}",
            "---",
        ]
        return "\n".join(lines)
    except Exception as e:
        print(f"--- Persona: failed to load agents.yaml ({e}) ---")
        return ""
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_agent_personas.py -v
```
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add core/persona.py tests/test_agent_personas.py
git commit -m "feat: add get_agent_persona() to Persona for per-agent system prompt injection"
```

---

## Chunk 2: Skill Compiler

### Task 3: Skill Data Structures

**Files:**
- Create: `skills/__init__.py`
- Create: `skills/compiler.py`
- Create: `config/skills/example_code_review.md`
- Create: `tests/test_skill_compiler.py`

- [ ] **Step 1: Create example skill file**

Create `config/skills/example_code_review.md`:

```markdown
---
name: code_review
trigger_keywords:
  - review
  - audit
  - check my code
  - inspect
steps:
  - action: call_tool
    target: read_file
    args:
      path: "{{file_path}}"
    on_failure: skip
  - action: llm_prompt
    target: planner
    args:
      prompt: "Review the following code for bugs, security issues, and style: {{file_contents}}"
    on_failure: abort
success_criteria: "Code review completed with specific findings listed."
fallback_strategy: "If file cannot be read, ask user to paste the code directly."
---

This skill reviews code files for quality issues.
```

- [ ] **Step 2: Write the failing tests**

Create `tests/test_skill_compiler.py`:

```python
"""Tests for SkillCompiler — compiles .md skill files into structured plans."""
import os
import pytest
import tempfile
from pathlib import Path
from skills.compiler import SkillCompiler, CompiledSkill, SkillStep


@pytest.fixture
def skills_dir(tmp_path):
    """Temporary skills directory with one valid skill."""
    skill_md = tmp_path / "code_review.md"
    skill_md.write_text("""---
name: code_review
trigger_keywords:
  - review
  - audit
steps:
  - action: call_tool
    target: read_file
    args:
      path: "file.py"
    on_failure: skip
success_criteria: "Review done."
fallback_strategy: "Ask user to paste code."
---
Reviews code files.
""")
    return str(tmp_path)


@pytest.fixture
def compiler(skills_dir):
    return SkillCompiler(skills_dir=skills_dir)


def test_scan_returns_count(compiler, skills_dir):
    count = compiler.scan(skills_dir)
    assert count == 1


def test_compiled_skill_has_correct_fields(compiler, skills_dir):
    compiler.scan(skills_dir)
    skill = compiler._skills.get("code_review")
    assert skill is not None
    assert isinstance(skill, CompiledSkill)
    assert skill.name == "code_review"
    assert "review" in skill.trigger_keywords
    assert len(skill.steps) == 1


def test_step_fields_correct(compiler, skills_dir):
    compiler.scan(skills_dir)
    step = compiler._skills["code_review"].steps[0]
    assert step.action == "call_tool"
    assert step.target == "read_file"
    assert step.on_failure == "skip"


def test_match_keyword_returns_skill(compiler, skills_dir):
    compiler.scan(skills_dir)
    result = compiler.match("please review my code")
    assert result is not None
    assert result.name == "code_review"


def test_match_no_match_returns_none(compiler, skills_dir):
    compiler.scan(skills_dir)
    result = compiler.match("what is the weather today")
    assert result is None


def test_match_with_embedder_none_uses_keywords(compiler, skills_dir):
    """Without embedder, keyword fallback must work."""
    compiler._embedder = None
    compiler.scan(skills_dir)
    result = compiler.match("audit this file")
    assert result is not None


def test_match_tie_breaking_alphabetical(tmp_path):
    """When two skills match equally, alphabetically first wins."""
    for name, kw in [("aardvark", "review"), ("zebra", "review")]:
        (tmp_path / f"{name}.md").write_text(f"""---
name: {name}
trigger_keywords:
  - {kw}
steps: []
success_criteria: ""
fallback_strategy: ""
---
""")
    compiler = SkillCompiler(skills_dir=str(tmp_path))
    compiler.scan(str(tmp_path))
    result = compiler.match("please review")
    assert result.name == "aardvark"


def test_scan_skips_invalid_skill(tmp_path):
    """Malformed skill files must be skipped without crashing."""
    (tmp_path / "bad.md").write_text("not yaml at all ::::")
    compiler = SkillCompiler(skills_dir=str(tmp_path))
    count = compiler.scan(str(tmp_path))
    assert count == 0


def test_compiled_cache_written(compiler, skills_dir, tmp_path):
    """After scan, a compiled JSON cache file must exist."""
    compiler.scan(skills_dir)
    cache_dir = Path(skills_dir) / "compiled"
    assert cache_dir.exists()
    assert len(list(cache_dir.glob("*.json"))) >= 1
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_skill_compiler.py -v
```
Expected: ImportError — `skills.compiler` does not exist.

- [ ] **Step 4: Create `skills/__init__.py`**

```python
# skills/__init__.py
```

- [ ] **Step 5: Implement SkillCompiler**

Create `skills/compiler.py`:

```python
"""SkillCompiler — parses .md skill files into structured CompiledSkill objects."""
from __future__ import annotations
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class SkillStep:
    action: str       # "call_tool" | "call_agent" | "llm_prompt" | "call_skill"
    target: str
    args: dict = field(default_factory=dict)
    on_failure: str = "skip"   # "skip" | "abort" | "fallback"


@dataclass
class CompiledSkill:
    name: str
    trigger_keywords: list
    steps: list
    required_tools: list = field(default_factory=list)
    success_criteria: str = ""
    fallback_strategy: str = ""


class SkillCompiler:
    """Scans a directory of .md skill files and compiles them to CompiledSkill objects."""

    def __init__(self, embedder=None, skills_dir: str = None):
        self._embedder = embedder
        self._skills_dir = skills_dir
        self._skills: dict[str, CompiledSkill] = {}

    def scan(self, skills_dir: str) -> int:
        """Scan directory, compile skills, cache to JSON. Returns count compiled."""
        self._skills_dir = skills_dir
        compiled_dir = Path(skills_dir) / "compiled"
        compiled_dir.mkdir(parents=True, exist_ok=True)

        count = 0
        for md_file in Path(skills_dir).glob("*.md"):
            try:
                skill = self._parse(md_file)
                if skill:
                    self._skills[skill.name] = skill
                    cache_path = compiled_dir / f"{skill.name}.json"
                    cache_path.write_text(json.dumps({
                        "name": skill.name,
                        "trigger_keywords": skill.trigger_keywords,
                        "steps": [s.__dict__ for s in skill.steps],
                        "required_tools": skill.required_tools,
                        "success_criteria": skill.success_criteria,
                        "fallback_strategy": skill.fallback_strategy,
                    }, indent=2), encoding="utf-8")
                    count += 1
            except Exception as e:
                print(f"--- SkillCompiler: skipping {md_file.name} ({e}) ---")
        return count

    def match(self, query: str) -> Optional[CompiledSkill]:
        """Return best matching skill for query, or None."""
        if not self._skills:
            return None

        # Semantic path
        if self._embedder is not None:
            try:
                return self._semantic_match(query)
            except Exception as e:
                print(f"--- SkillCompiler: embedder failed ({e}), using keyword match ---")

        return self._keyword_match(query)

    def _semantic_match(self, query: str) -> Optional[CompiledSkill]:
        import numpy as np
        q_emb = self._embedder.embed(query)
        best_score, best_skill = 0.0, None
        for skill in self._skills.values():
            kw_text = " ".join(skill.trigger_keywords)
            s_emb = self._embedder.embed(kw_text)
            denom = np.linalg.norm(q_emb) * np.linalg.norm(s_emb)
            score = float(np.dot(q_emb, s_emb) / denom) if denom > 0 else 0.0
            if score > best_score:
                best_score, best_skill = score, skill
        return best_skill if best_score >= 0.7 else None

    def _keyword_match(self, query: str) -> Optional[CompiledSkill]:
        query_lower = query.lower()
        scored = []
        for skill in self._skills.values():
            hits = sum(1 for kw in skill.trigger_keywords if kw.lower() in query_lower)
            if hits > 0:
                scored.append((hits, skill.name, skill))
        if not scored:
            return None
        # Sort by hit count desc, name asc (tiebreaker)
        scored.sort(key=lambda x: (-x[0], x[1]))
        return scored[0][2]

    def _parse(self, md_file: Path) -> Optional[CompiledSkill]:
        import yaml
        text = md_file.read_text(encoding="utf-8")
        if not text.startswith("---"):
            return None
        parts = text.split("---", 2)
        if len(parts) < 3:
            return None
        front_matter = yaml.safe_load(parts[1])
        if not front_matter or "name" not in front_matter:
            return None

        steps = []
        for s in front_matter.get("steps", []):
            if isinstance(s, dict):
                steps.append(SkillStep(
                    action=s.get("action", "llm_prompt"),
                    target=s.get("target", "planner"),
                    args=s.get("args", {}),
                    on_failure=s.get("on_failure", "skip"),
                ))

        return CompiledSkill(
            name=front_matter["name"],
            trigger_keywords=front_matter.get("trigger_keywords", []),
            steps=steps,
            required_tools=front_matter.get("required_tools", []),
            success_criteria=front_matter.get("success_criteria", ""),
            fallback_strategy=front_matter.get("fallback_strategy", ""),
        )
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_skill_compiler.py -v
```
Expected: 10 passed.

- [ ] **Step 7: Commit**

```bash
git add skills/__init__.py skills/compiler.py config/skills/ tests/test_skill_compiler.py
git commit -m "feat: implement SkillCompiler with keyword and semantic skill matching"
```

---

### Task 4: Wire SkillCompiler into ThinkingLoop

**Files:**
- Modify: `thinking/loop.py`
- Modify: `core/orchestrator.py`
- Create: `tests/test_skill_injection.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_skill_injection.py`:

```python
"""Tests for skill injection into ThinkingLoop."""
import asyncio
import pytest
from unittest.mock import MagicMock, AsyncMock
from core.planner import Plan
from agents.protocol import UACPPayload
from thinking.loop import ThinkingLoop
from thinking.graph import ThoughtGraph
from skills.compiler import SkillCompiler, CompiledSkill, SkillStep


def _make_plan():
    return Plan(task="t", reasoning_required=False, coding_required=False,
                models=[], tool_calls=[], confidence=0.9)


def _make_payload(score=0.9):
    return UACPPayload(agent="critic", confidence=score,
                       analysis="ok", guidance="ok")


@pytest.fixture
def loop_with_skill(tmp_path):
    planner = MagicMock()
    planner.plan = MagicMock(return_value=_make_plan())
    agent_loop = MagicMock()
    agent_loop.run = AsyncMock(return_value=[])
    synthesizer = MagicMock()
    synthesizer.synthesize = MagicMock(return_value="answer")
    critic = MagicMock()
    critic.evaluate = MagicMock(return_value=_make_payload(0.9))
    graph = ThoughtGraph(db_path=str(tmp_path / "t.db"))

    skill = CompiledSkill(
        name="review_code",
        trigger_keywords=["review"],
        steps=[SkillStep(action="llm_prompt", target="planner",
                         args={"prompt": "Review carefully"}, on_failure="skip")],
        success_criteria="Review done.",
        fallback_strategy="",
    )
    compiler = MagicMock()
    compiler.match = MagicMock(return_value=skill)

    loop = ThinkingLoop(planner, agent_loop, synthesizer, critic, graph,
                        skill_compiler=compiler)
    return loop, planner, compiler


def test_skill_matched_context_injected(loop_with_skill):
    """When a skill matches, its steps must appear in the context sent to planner."""
    loop, planner, compiler = loop_with_skill
    asyncio.run(loop.think("please review my code", "base context", []))
    first_call_context = planner.plan.call_args_list[0][0][1]
    assert "Review carefully" in first_call_context or "review_code" in first_call_context


def test_no_skill_match_does_not_crash(loop_with_skill):
    """When no skill matches, ThinkingLoop must still complete normally."""
    loop, planner, compiler = loop_with_skill
    compiler.match.return_value = None
    result = asyncio.run(loop.think("what is 2+2", "ctx", []))
    assert result == "answer"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
venv\Scripts\python -m pytest tests/test_skill_injection.py -v
```
Expected: TypeError — `ThinkingLoop.__init__` does not accept `skill_compiler`.

- [ ] **Step 3: Add skill_compiler parameter to ThinkingLoop**

In `thinking/loop.py`, update `__init__` signature:

```python
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
    skill_compiler=None,
):
    ...
    self._skill_compiler = skill_compiler
```

Add skill injection at the start of `think()` and `think_stream()`, before `_run_iteration()` is called on iteration 0:

```python
def _build_skill_context(self, user_input: str, base_context: str) -> str:
    """If a skill matches, prepend its steps as structured context."""
    if self._skill_compiler is None:
        return base_context
    try:
        skill = self._skill_compiler.match(user_input)
        if skill is None:
            return base_context
        step_lines = "\n".join(
            f"  Step {i+1}: [{s.action}] {s.target} — args: {s.args}"
            for i, s in enumerate(skill.steps)
        )
        injection = (
            f"[SKILL: {skill.name}]\n"
            f"Steps to follow:\n{step_lines}\n"
            f"Success criteria: {skill.success_criteria}\n"
        )
        return injection + "\n" + base_context
    except Exception as e:
        print(f"--- ThinkingLoop: skill injection failed ({e}) ---")
        return base_context
```

In `think()`, change the first line of the loop body from:

```python
answer, payload, tool_results = await self._run_iteration(
    user_input, current_context, memories
)
```

to:

```python
if iteration == 0:
    current_context = self._build_skill_context(user_input, current_context)
answer, payload, tool_results = await self._run_iteration(
    user_input, current_context, memories
)
```

- [ ] **Step 4: Instantiate SkillCompiler in Orchestrator**

In `core/orchestrator.py` `__init__()`, after `self.thought_graph = ThoughtGraph()`:

```python
from skills.compiler import SkillCompiler
import os as _os
_skills_dir = _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), "config", "skills")
self.skill_compiler = SkillCompiler()
if _os.path.isdir(_skills_dir) and settings.SKILL_COMPILER_ENABLED:
    self.skill_compiler.scan(_skills_dir)
```

And in `_get_thinking_loop()`, pass it:

```python
self.thinking_loop = ThinkingLoop(
    planner=self.planner,
    agent_loop=self.agent_loop,
    synthesizer=self.synthesizer,
    critic=critic,
    graph=self.thought_graph,
    context_controller=self.context_ctrl,
    skill_compiler=self.skill_compiler if settings.SKILL_COMPILER_ENABLED else None,
)
```

- [ ] **Step 5: Run all Phase 2 tests**

```bash
venv\Scripts\python -m pytest tests/test_agent_personas.py tests/test_skill_compiler.py tests/test_skill_injection.py -v
```
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add thinking/loop.py core/orchestrator.py tests/test_skill_injection.py
git commit -m "feat: wire SkillCompiler into ThinkingLoop for automatic skill injection"
```

---

## Phase 2 Complete

```bash
venv\Scripts\python -m pytest tests/ -v --tb=short
```
Expected: All Phase 1 + Phase 2 tests pass.

**Next:** Phase 3 — Autonomous Tool Discovery + Self-Improvement Engine (`docs/superpowers/plans/2026-03-12-phase3-self-improvement.md`)
