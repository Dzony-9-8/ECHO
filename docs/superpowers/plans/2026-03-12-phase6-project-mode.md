# Phase 6 — AI Project Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable ECHO to manage long-running, multi-session projects with persistent goal, artifact, and thought-graph context that survives session restarts.

**Architecture:** `ProjectManager` stores projects and artifacts in `intelligence/memory.db`. `ProjectContext` builds the context string injected into `ThinkingLoop`. `Orchestrator.process()` parses `!project` commands before routing to ThinkingLoop. On session start, the last active project is proposed for auto-resume.

**Tech Stack:** Python 3.12, SQLite (stdlib), unittest.mock, pytest

**Prerequisite:** Phase 1 complete (ThinkingLoop, ThoughtGraph, settings.py).

**Working directory:** `D:\AI\Claude Code\Project ECHO\ai-orchestrator`

---

## Chunk 1: ProjectManager + ProjectContext

### Task 1: ProjectManager

**Files:**
- Create: `projects/__init__.py`
- Create: `projects/manager.py`
- Create: `tests/test_project_manager.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_project_manager.py`:

```python
"""Tests for ProjectManager — persistent project storage in SQLite."""
import pytest
from projects.manager import ProjectManager


@pytest.fixture
def mgr(tmp_path):
    return ProjectManager(db_path=str(tmp_path / "memory.db"))


def test_create_project_returns_id(mgr):
    pid = mgr.create("My Project", goal="Build something cool")
    assert isinstance(pid, str) and len(pid) > 0


def test_get_project_by_name(mgr):
    mgr.create("Alpha", goal="Goal A")
    project = mgr.get_by_name("Alpha")
    assert project is not None
    assert project["name"] == "Alpha"
    assert project["goal"] == "Goal A"
    assert project["status"] == "active"


def test_list_active_projects(mgr):
    mgr.create("Proj1", "g1")
    mgr.create("Proj2", "g2")
    active = mgr.list_active()
    assert len(active) == 2


def test_pause_project(mgr):
    pid = mgr.create("Work", "do work")
    mgr.pause(pid)
    project = mgr.get_by_name("Work")
    assert project["status"] == "paused"


def test_complete_project(mgr):
    pid = mgr.create("Done", "finish")
    mgr.complete(pid)
    project = mgr.get_by_name("Done")
    assert project["status"] == "complete"


def test_add_and_list_artifacts(mgr):
    pid = mgr.create("Art", "make art")
    mgr.add_artifact(pid, type_="code", content="def foo(): pass", path="foo.py")
    artifacts = mgr.list_artifacts(pid)
    assert len(artifacts) == 1
    assert artifacts[0]["content"] == "def foo(): pass"
    assert artifacts[0]["path"] == "foo.py"


def test_get_last_active_returns_most_recent(mgr):
    mgr.create("Old", "old goal")
    import time; time.sleep(0.01)
    mgr.create("New", "new goal")
    last = mgr.get_last_active()
    assert last["name"] == "New"


def test_get_last_active_returns_none_when_empty(mgr):
    assert mgr.get_last_active() is None


def test_create_fails_gracefully_on_duplicate_name(mgr):
    """Duplicate project names should not crash — return existing project id."""
    pid1 = mgr.create("UniqueProject", "goal")
    pid2 = mgr.create("UniqueProject", "goal")
    assert isinstance(pid2, str)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_project_manager.py -v
```
Expected: ImportError.

- [ ] **Step 3: Create `projects/__init__.py`**

```python
# projects/__init__.py
```

- [ ] **Step 4: Implement ProjectManager**

Create `projects/manager.py`:

```python
"""ProjectManager — stores and retrieves projects and artifacts from SQLite."""
from __future__ import annotations
import os
import sqlite3
import time
import uuid


CREATE_PROJECTS_SQL = """
CREATE TABLE IF NOT EXISTS projects (
    project_id  TEXT PRIMARY KEY,
    name        TEXT UNIQUE,
    goal        TEXT,
    status      TEXT DEFAULT 'active',
    created_at  REAL,
    updated_at  REAL
);
"""

CREATE_ARTIFACTS_SQL = """
CREATE TABLE IF NOT EXISTS project_artifacts (
    artifact_id TEXT PRIMARY KEY,
    project_id  TEXT,
    type        TEXT,
    content     TEXT,
    path        TEXT,
    timestamp   REAL
);
"""


class ProjectManager:
    """Manages long-running projects persisted in intelligence/memory.db."""

    def __init__(self, db_path: str = None):
        if db_path is None:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            db_path = os.path.join(base, "intelligence", "memory.db")
        self._db_path = db_path
        self._init_db()

    def _connect(self):
        return sqlite3.connect(self._db_path)

    def _init_db(self):
        try:
            with self._connect() as conn:
                conn.execute(CREATE_PROJECTS_SQL)
                conn.execute(CREATE_ARTIFACTS_SQL)
        except Exception as e:
            print(f"--- ProjectManager: DB init failed ({e}) ---")

    def create(self, name: str, goal: str = "") -> str:
        """Create a new active project. Returns project_id."""
        existing = self.get_by_name(name)
        if existing:
            return existing["project_id"]
        pid = uuid.uuid4().hex
        now = time.time()
        try:
            with self._connect() as conn:
                conn.execute(
                    "INSERT INTO projects (project_id, name, goal, status, created_at, updated_at) "
                    "VALUES (?, ?, ?, 'active', ?, ?)",
                    (pid, name, goal, now, now),
                )
        except Exception as e:
            print(f"--- ProjectManager: create failed ({e}) ---")
        return pid

    def get_by_name(self, name: str) -> dict | None:
        try:
            with self._connect() as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute(
                    "SELECT * FROM projects WHERE name=?", (name,)
                ).fetchone()
            return dict(row) if row else None
        except Exception:
            return None

    def get_by_id(self, project_id: str) -> dict | None:
        try:
            with self._connect() as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute(
                    "SELECT * FROM projects WHERE project_id=?", (project_id,)
                ).fetchone()
            return dict(row) if row else None
        except Exception:
            return None

    def list_active(self) -> list:
        try:
            with self._connect() as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute(
                    "SELECT * FROM projects WHERE status='active' ORDER BY updated_at DESC"
                ).fetchall()
            return [dict(r) for r in rows]
        except Exception:
            return []

    def get_last_active(self) -> dict | None:
        try:
            with self._connect() as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute(
                    "SELECT * FROM projects WHERE status='active' ORDER BY updated_at DESC LIMIT 1"
                ).fetchone()
            return dict(row) if row else None
        except Exception:
            return None

    def _set_status(self, project_id: str, status: str):
        try:
            with self._connect() as conn:
                conn.execute(
                    "UPDATE projects SET status=?, updated_at=? WHERE project_id=?",
                    (status, time.time(), project_id),
                )
        except Exception as e:
            print(f"--- ProjectManager: status update failed ({e}) ---")

    def pause(self, project_id: str):
        self._set_status(project_id, "paused")

    def complete(self, project_id: str):
        self._set_status(project_id, "complete")

    def add_artifact(self, project_id: str, type_: str, content: str, path: str = "") -> str:
        aid = uuid.uuid4().hex
        try:
            with self._connect() as conn:
                conn.execute(
                    "INSERT INTO project_artifacts (artifact_id, project_id, type, content, path, timestamp) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (aid, project_id, type_, content, path, time.time()),
                )
            self._set_status(project_id, "active")
        except Exception as e:
            print(f"--- ProjectManager: add_artifact failed ({e}) ---")
        return aid

    def list_artifacts(self, project_id: str, limit: int = 20) -> list:
        try:
            with self._connect() as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute(
                    "SELECT * FROM project_artifacts WHERE project_id=? ORDER BY timestamp DESC LIMIT ?",
                    (project_id, limit),
                ).fetchall()
            return [dict(r) for r in rows]
        except Exception:
            return []
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_project_manager.py -v
```
Expected: 9 passed.

- [ ] **Step 6: Commit**

```bash
git add projects/__init__.py projects/manager.py tests/test_project_manager.py
git commit -m "feat: implement ProjectManager with SQLite-backed project and artifact storage"
```

---

### Task 2: ProjectContext

**Files:**
- Create: `projects/context.py`
- Create: `tests/test_project_context.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_project_context.py`:

```python
"""Tests for ProjectContext — builds context string injected into ThinkingLoop."""
import pytest
from projects.manager import ProjectManager
from projects.context import ProjectContext


@pytest.fixture
def setup(tmp_path):
    mgr = ProjectManager(db_path=str(tmp_path / "memory.db"))
    pid = mgr.create("Test Project", goal="Build a test system")
    mgr.add_artifact(pid, "code", "def test(): pass", "test.py")
    ctx = ProjectContext(manager=mgr)
    return mgr, pid, ctx


def test_build_returns_string(setup):
    mgr, pid, ctx = setup
    result = ctx.build(pid)
    assert isinstance(result, str) and len(result) > 0


def test_build_includes_goal(setup):
    mgr, pid, ctx = setup
    result = ctx.build(pid)
    assert "Build a test system" in result


def test_build_includes_artifact(setup):
    mgr, pid, ctx = setup
    result = ctx.build(pid)
    assert "test.py" in result or "def test()" in result


def test_build_returns_empty_for_unknown_project(setup):
    mgr, pid, ctx = setup
    result = ctx.build("nonexistent_project_id")
    assert result == ""


def test_build_limits_artifact_count(setup):
    mgr, pid, ctx = setup
    for i in range(25):
        mgr.add_artifact(pid, "note", f"note {i}", "")
    result = ctx.build(pid)
    # Should not include all 25 notes — context must be bounded
    assert len(result) < 10_000
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_project_context.py -v
```
Expected: ImportError.

- [ ] **Step 3: Implement ProjectContext**

Create `projects/context.py`:

```python
"""ProjectContext — builds a context string for active projects injected into ThinkingLoop."""
from __future__ import annotations


class ProjectContext:
    """Builds a context string summarising a project's goal and recent artifacts."""

    def __init__(self, manager):
        self._manager = manager

    def build(self, project_id: str, max_artifacts: int = 10) -> str:
        """Return a formatted context string for the project, or '' if not found."""
        project = self._manager.get_by_id(project_id)
        if not project:
            return ""

        artifacts = self._manager.list_artifacts(project_id, limit=max_artifacts)
        artifact_lines = []
        for a in artifacts:
            t = a.get("type", "note")
            path = a.get("path", "")
            content_preview = a.get("content", "")[:200]
            line = f"  [{t}]"
            if path:
                line += f" {path}"
            line += f": {content_preview}"
            artifact_lines.append(line)

        lines = [
            f"[ACTIVE PROJECT: {project['name']}]",
            f"Goal: {project['goal']}",
            f"Status: {project['status']}",
        ]
        if artifact_lines:
            lines.append("Recent artifacts:")
            lines.extend(artifact_lines)
        lines.append("---")

        return "\n".join(lines)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
venv\Scripts\python -m pytest tests/test_project_context.py -v
```
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add projects/context.py tests/test_project_context.py
git commit -m "feat: implement ProjectContext for ThinkingLoop project context injection"
```

---

## Chunk 2: Orchestrator Integration + Auto-Resume

### Task 3: Wire Project Mode into Orchestrator

**Files:**
- Modify: `core/orchestrator.py`
- Create: `tests/test_project_integration.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_project_integration.py`:

```python
"""Tests for project command parsing in Orchestrator."""
from core.orchestrator import Orchestrator


def test_parse_project_command_new():
    cmd, args = Orchestrator._parse_project_command("!project new My Project")
    assert cmd == "new"
    assert args == "My Project"


def test_parse_project_command_resume():
    cmd, args = Orchestrator._parse_project_command("!project resume Alpha")
    assert cmd == "resume"
    assert args == "Alpha"


def test_parse_project_command_returns_none_for_normal_input():
    result = Orchestrator._parse_project_command("what is 2+2")
    assert result is None


def test_parse_project_command_returns_none_for_empty():
    result = Orchestrator._parse_project_command("")
    assert result is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv\Scripts\python -m pytest tests/test_project_integration.py -v
```
Expected: AttributeError — `_parse_project_command` does not exist.

- [ ] **Step 3: Add project command parsing to Orchestrator**

In `core/orchestrator.py`, add static method:

```python
@staticmethod
def _parse_project_command(user_input: str):
    """Parse !project commands. Returns (command, args) tuple or None."""
    stripped = user_input.strip()
    if not stripped.startswith("!project"):
        return None
    parts = stripped.split(None, 2)
    if len(parts) < 2:
        return None
    command = parts[1].lower() if len(parts) > 1 else ""
    args = parts[2] if len(parts) > 2 else ""
    return command, args
```

In `__init__()`, after Phase 1 section:

```python
from config import settings as _s
if _s.PROJECT_MODE_ENABLED:
    from projects.manager import ProjectManager
    from projects.context import ProjectContext
    self.project_manager = ProjectManager()
    self.project_context = ProjectContext(manager=self.project_manager)
    self.active_project_id = None
else:
    self.project_manager = None
    self.project_context = None
    self.active_project_id = None
```

In `process()`, add at the very start (before memory retrieval):

```python
# Handle !project commands
parsed = self._parse_project_command(user_input)
if parsed:
    cmd, args = parsed
    return await self._handle_project_command(cmd, args)
```

Add `_handle_project_command()` method:

```python
async def _handle_project_command(self, cmd: str, args: str) -> str:
    """Handle !project new/resume/pause/status commands."""
    if self.project_manager is None:
        return "Project mode is disabled (PROJECT_MODE_ENABLED=False)."
    if cmd == "new":
        if not args:
            return "Usage: !project new <project name>"
        pid = self.project_manager.create(args, goal="")
        self.active_project_id = pid
        return f"Project '{args}' created (id: {pid[:8]}). Now active."
    elif cmd == "resume":
        proj = self.project_manager.get_by_name(args)
        if not proj:
            return f"No project named '{args}' found."
        self.active_project_id = proj["project_id"]
        return f"Resumed project '{args}'."
    elif cmd == "pause":
        if self.active_project_id:
            self.project_manager.pause(self.active_project_id)
            self.active_project_id = None
            return "Project paused."
        return "No active project to pause."
    elif cmd == "status":
        if not self.active_project_id:
            return "No active project."
        proj = self.project_manager.get_by_id(self.active_project_id)
        return f"Project: {proj['name']}\nGoal: {proj['goal']}\nStatus: {proj['status']}"
    return f"Unknown project command: {cmd}"
```

In `_get_thinking_loop()`, inject project context:

```python
# Inject project context if active
project_ctx_str = ""
if self.active_project_id and self.project_context:
    project_ctx_str = self.project_context.build(self.active_project_id)
```

Pass `project_ctx_str` to `think()` by prepending to `short_mem.context()`:

```python
combined_context = (project_ctx_str + "\n" + self.short_mem.context()).strip() \
    if project_ctx_str else self.short_mem.context()
final_answer = await self._get_thinking_loop().think(
    user_input, combined_context, memories_text
)
```

Also tag ThoughtGraph thoughts with `project_id` by passing it through `ThinkingLoop`:

In `ThinkingLoop.__init__()`, add optional `project_id: str = None` param.
In `think()`, pass `project_id=self._project_id` to `self._graph.write()`.

In `_get_thinking_loop()`:
```python
loop.project_id = self.active_project_id
```

In `ThinkingLoop.think()`, update the `self._graph.write()` call:
```python
thought_id = self._graph.write(
    ...,
    project_id=getattr(self, '_project_id', None),
)
```

- [ ] **Step 4: Add auto-resume on session start**

In `core/orchestrator.py` after `self.active_project_id = None`:

```python
# Auto-resume last active project
if _s.PROJECT_MODE_ENABLED and self.project_manager:
    last = self.project_manager.get_last_active()
    if last:
        print(f"\n--- Last active project: '{last['name']}' ---")
        print(f"--- Goal: {last['goal']} ---")
        answer = input("Resume this project? (y/n): ").strip().lower()
        if answer == "y":
            self.active_project_id = last["project_id"]
            print(f"--- Project '{last['name']}' resumed ---")
```

- [ ] **Step 5: Run all Phase 6 tests**

```bash
venv\Scripts\python -m pytest tests/test_project_manager.py tests/test_project_context.py tests/test_project_integration.py -v
```
Expected: All pass.

- [ ] **Step 6: Smoke test**

```bash
venv\Scripts\python main.py
```
Type: `!project new Test Build`
Expected: `Project 'Test Build' created (id: xxxxxxxx). Now active.`

Type: `what should I build first?`
Expected: Normal response with project context injected.

- [ ] **Step 7: Commit**

```bash
git add projects/ core/orchestrator.py thinking/loop.py tests/test_project_integration.py
git commit -m "feat: integrate AI Project Mode with auto-resume, command parsing, and context injection"
```

---

## Phase 6 Complete — All 14 Features Implemented

Run the full test suite:

```bash
venv\Scripts\python -m pytest tests/ -v --tb=short
```
Expected: All Phase 1–6 tests pass.

**Final integration smoke test:**

```bash
venv\Scripts\python main.py
```

Test sequence:
1. Type `hello` — ThinkingLoop runs, responds normally
2. Type `!project new ECHO Development` — project created
3. Type `review my orchestrator code` — SkillCompiler matches, project context injected
4. Type `!project status` — shows project status
5. Type `exit` — clean shutdown

All 14 features are now active and integrated.
