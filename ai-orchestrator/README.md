# Project ECHO — Local AI Orchestrator

A fully local, self-improving AI system running open-source GGUF models on a single GPU. ECHO uses a multi-agent architecture with a cognitive thinking loop, persistent memory, and autonomous tool discovery — no cloud required.

```
User Input
    ↓
ContextController (trim context to fit VRAM)
    ↓
ThinkingLoop (plan → execute → critique → revise until score ≥ 0.75)
    ├── SkillCompiler (inject matched .md skill steps)
    ├── Planner (LLaMA 3.1 8B)
    ├── AgentLoop (tools: file, shell, python)
    ├── OutputSynthesizer
    └── CriticAgent (score + guidance)
    ↓
ThoughtGraph (persist every reasoning iteration to SQLite)
    ↓
StreamBatcher → UI / Terminal
    ↓
[Background]
SelfImprovementEngine (analyse patterns, patch prompts)
GPUScheduler (yield VRAM to foreground tasks)
ProjectManager (long-running project context)
```

---

## Features

| Layer | Feature | Description |
|-------|---------|-------------|
| Foundation | **Thinking Loop** | Iterative self-correction: loop retries until CriticAgent scores ≥ 0.75 |
| Foundation | **Thought Graph** | Every reasoning iteration persisted to SQLite for analysis |
| Foundation | **Context Controller** | Semantic trimming keeps context within VRAM budget |
| Agent | **Personality Models** | Each agent (dev/research/critic) has a consistent injected personality |
| Agent | **Skill Compiler** | `.md` skill files compiled to structured plan templates |
| Agent | **Tool Discovery** | Auto-registers tools from `TOOL_MANIFEST` dicts at startup |
| Agent | **Self-Improvement** | Analyses ThoughtGraph, patches prompts and routing thresholds |
| Inference | **KV Cache Reuse** | Avoids re-encoding unchanged system prompt prefixes |
| Inference | **Quantization Switching** | Q4/Q6/Q8 selection based on task complexity score |
| Inference | **GPU Scheduler** | Cooperative asyncio.Event pauses background tasks for foreground VRAM |
| Inference | **Speculative Decoding** | Draft (8B) + verify (DeepSeek-R1) for faster reasoning |
| Inference | **Token Stream Batcher** | Batches tokens before UI emit to reduce overhead |
| Inference | **Streaming Pipeline** | `process_stream()` yields typed events per phase |
| Product | **Project Mode** | `!project new/resume/pause/status` — persistent multi-session projects |

---

## Models

Place GGUF files in `ai-orchestrator/models/`:

| Role | Model | File |
|------|-------|------|
| Planner / Synth | LLaMA 3.1 8B Q4_K_M | `llama-3.1-8b.gguf` |
| Reasoning | DeepSeek-R1 7B Q4_K_M | `deepseek-r1.gguf` |
| Coding | DeepSeek-Coder 6.7B Q4_K_M | `deepseek-coder.gguf` |

For quantization switching (Phase 4), also place:
- `deepseek-r1-q4.gguf`, `deepseek-r1-q6.gguf`, `deepseek-r1-q8.gguf`

---

## Installation

**Python 3.10, 3.11, or 3.12 required.** Not 3.13 (no prebuilt llama-cpp-python wheel).

```powershell
cd "D:\AI\Claude Code\Project ECHO\ai-orchestrator"
py -3.12 -m venv venv
venv\Scripts\activate.bat
```

**GPU (CUDA):**
```powershell
install-cuda.bat
```

**CPU only:**
```powershell
install-cpu.bat
```

Or manually:
```powershell
# GPU
pip install --only-binary :all: llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu121
pip install -r requirements-other.txt

# CPU
pip install -r requirements-cpu.txt
```

---

## Running

```powershell
cd "D:\AI\Claude Code\Project ECHO\ai-orchestrator"
venv\Scripts\activate.bat
python main.py
```

Type `exit` to quit.

---

## Project Mode Commands

```
!project new <name>      — create a new project and make it active
!project resume <name>   — resume a paused project
!project pause           — pause the active project
!project status          — show active project goal and status
```

On startup, if a project was active in the last session, ECHO will offer to resume it.

---

## Custom Skills

Add `.md` files to `config/skills/` with YAML front matter:

```markdown
---
name: my_skill
trigger_keywords:
  - keyword1
  - keyword2
steps:
  - action: llm_prompt
    target: planner
    args:
      prompt: "Do X with {{input}}"
    on_failure: skip
success_criteria: "X completed."
fallback_strategy: "Ask user for clarification."
---
Description of what this skill does.
```

Skills are compiled and cached automatically on startup. Matched by keyword (or embedding similarity if embedder is loaded).

---

## Configuration

All feature flags in `config/settings.py`:

```python
THINKING_LOOP_ENABLED    = True   # iterative self-correction
THINKING_LOOP_MAX_ITERS  = 8      # max iterations before committing
THINKING_LOOP_THRESHOLD  = 0.75   # CriticAgent score to accept answer
CONTEXT_CONTROLLER_ENABLED = True # semantic context trimming
SKILL_COMPILER_ENABLED   = True   # .md skill injection
TOOL_DISCOVERY_ENABLED   = True   # auto tool registration
SELF_IMPROVEMENT_ENABLED = True   # background prompt patching
GPU_SCHEDULER_ENABLED    = True   # cooperative VRAM scheduling
SPECULATIVE_DECODING_ENABLED = True
STREAM_BATCH_SIZE        = 12     # tokens per UI emit batch
PROJECT_MODE_ENABLED     = True
```

---

## Hardware

Tuned for **GTX 1080Ti (11GB VRAM)**:
- Default: `n_gpu_layers=35`, `n_ctx=4096`
- Low VRAM: set `n_gpu_layers=25` in `main.py`
- GPU scheduler yields VRAM to foreground tasks automatically

---

## Structure

```
ai-orchestrator/
├── config/
│   ├── settings.py        — feature flags
│   ├── persona.yaml       — ECHO's personality
│   ├── agents.yaml        — per-agent personality traits
│   ├── prompt_patches.json — self-improvement patches
│   └── skills/            — .md skill definitions
├── core/
│   ├── orchestrator.py    — main entry point
│   ├── planner.py         — intent decomposition
│   ├── router.py          — specialist routing
│   ├── synthesis.py       — output synthesis
│   ├── gpu_scheduler.py   — VRAM cooperative scheduling
│   ├── kv_cache.py        — system prompt hash tracking
│   ├── quant_controller.py — quantization selection
│   ├── speculative.py     — draft-verify decoding
│   └── stream_batcher.py  — token batch buffering
├── thinking/
│   ├── loop.py            — ThinkingLoop (core cognitive engine)
│   ├── graph.py           — ThoughtGraph (SQLite persistence)
│   └── context.py         — ContextController (semantic trimming)
├── agents/
│   ├── critic_agent.py    — quality gatekeeper
│   ├── executor.py        — tool executor
│   └── loop.py            — agent execution loop
├── memory/
│   ├── short_term.py
│   ├── long_term.py       — FAISS vector store
│   └── embeddings.py      — BGE-Large embeddings
├── tools/
│   ├── discovery.py       — auto tool registration
│   ├── file_tools.py
│   ├── shell_tools.py
│   └── python_tools.py
├── skills/
│   └── compiler.py        — .md → CompiledSkill compiler
├── intelligence/
│   ├── self_improvement.py — background performance analysis
│   └── memory.db          — SQLite (memory + thought_graph + projects)
├── projects/
│   ├── manager.py         — project CRUD
│   └── context.py         — project context builder
└── models/                — GGUF model files (not in git)
```

---

## Tests

```powershell
cd "D:\AI\Claude Code\Project ECHO\ai-orchestrator"
venv\Scripts\activate.bat
venv\Scripts\python -m pytest tests/ -v --tb=short
```

---

## Implementation Plans

Detailed phase-by-phase implementation plans in `docs/superpowers/plans/`:

| Plan | Features |
|------|---------|
| `phase1-foundation` | ThinkingLoop, ThoughtGraph, ContextController |
| `phase2-agent-intelligence` | Personalities, SkillCompiler |
| `phase3-self-improvement` | ToolDiscovery, SelfImprovementEngine |
| `phase4-inference-performance` | KVCache, QuantController, GPUScheduler |
| `phase5-streaming` | SpeculativeDecoding, StreamBatcher, Streaming Pipeline |
| `phase6-project-mode` | AI Project Mode |
