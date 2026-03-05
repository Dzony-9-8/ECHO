# Local AI Orchestrator

Planner → Router → Specialists (Reasoning / Coding) → Tools (optional) → Synthesizer (persona + reflection) → Memory update.

## 1. Installation

**Go to the project folder first:**

```powershell
cd "D:\AI\Claude Code\Project ECHO\ai-orchestrator"
```

**Python version:** Prebuilt wheels for `llama-cpp-python` exist for **Python 3.10, 3.11 and 3.12 only** — **not 3.13**. If you see "Building wheel for llama-cpp-python" and then "nmake" / "CMAKE_C_COMPILER" errors, you are on 3.13 and must use 3.12 for this project.

**If you have Python 3.13 (or get the build error above):**

1. **Install Python 3.12** — you don’t have it yet. Download the **Windows 64-bit installer** from [python.org/downloads/release/python-3120](https://www.python.org/downloads/release/python-3120/) (or the latest 3.12.x). Run the installer; you can keep 3.13. Optionally check “Add Python to PATH”. Close and reopen the terminal after installing.
2. Remove the old venv and create one with 3.12.  
   **In PowerShell:**
   ```powershell
   cd "D:\AI\Claude Code\Project ECHO\ai-orchestrator"
   Remove-Item -Recurse -Force venv -ErrorAction SilentlyContinue
   py -3.12 -m venv venv
   venv\Scripts\activate.bat
   ```
   **In CMD (Command Prompt):**
   ```cmd
   cd "D:\AI\Claude Code\Project ECHO\ai-orchestrator"
   rmdir /s /q venv
   py -3.12 -m venv venv
   venv\Scripts\activate.bat
   ```
   If `py -3.12` says “No suitable Python runtime found”, Python 3.12 isn’t installed or wasn’t added to PATH; install it from the link in step 1 and try again. To see what’s installed: `py -0`.
3. Install with the **install scripts** (they force the prebuilt wheel and check Python version):
   - **GPU:** double‑click `install-cuda.bat` or run it from the project folder.
   - **CPU:** double‑click `install-cpu.bat`.
   Or manually (must be 3.12 in the venv):  
   `pip install --only-binary :all: llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu121`  
   then `pip install -r requirements-other.txt`.

**If you already have Python 3.10, 3.11 or 3.12 as default**, create the venv and activate:

```powershell
python -m venv venv
venv\Scripts\activate.bat
```
*(If PowerShell blocks scripts, use Command Prompt or run `venv\Scripts\activate.bat`.)*

**Install dependencies — use prebuilt wheels (no compiler needed):**

- **Easiest:** run **`install-cuda.bat`** (GPU) or **`install-cpu.bat`** (CPU). They check that the venv is Python 3.10/3.11/3.12 and install the wheel only (no build).

- **Manual — CPU:**  
  `pip install -r requirements-cpu.txt`

- **Manual — GPU (CUDA):**  
  Check CUDA with `nvidia-smi`; edit `requirements-cuda.txt` if needed (`cu121`, `cu122`, …). Then:  
  `pip install -r requirements-cuda.txt`

If the venv is **Python 3.13**, pip will try to **build from source** and you’ll get errors like "nmake not found" or "CMAKE_C_COMPILER not set" unless you have Visual Studio Build Tools (or MinGW) set up. So prefer **requirements-cpu.txt** or **requirements-cuda.txt**.

## 2. Download models (GGUF)

Place in `ai-orchestrator/models/`:

| Role            | Model                    | Suggested file            |
|-----------------|--------------------------|---------------------------|
| Planner / Synth | Llama 3.1 8B Q4_K_M      | `llama-3.1-8b.gguf`       |
| Reasoning       | DeepSeek-R1 7B Q4_K_M    | `deepseek-r1.gguf`        |
| Coding          | DeepSeek-Coder 6.7B Q4_K_M | `deepseek-coder.gguf`   |

## 3. Run

From `ai-orchestrator/` (same folder as `main.py`):

```powershell
cd "D:\AI\Claude Code\Project ECHO\ai-orchestrator"
venv\Scripts\activate.bat
python main.py
```

Type `exit` to quit.

## 4. GTX 1080Ti

- Default: `n_gpu_layers=35`, `n_ctx=4096`.
- If you run out of VRAM: set `n_gpu_layers=25` in `main.py` (`load_model`).

## Structure

- `config/persona.yaml` — tone and rules (single source of truth).
- `core/` — planner, router, synthesis, persona.
- `memory/` — short-term, long-term (FAISS), episodic, embeddings, importance, summarizer, decay.
- `models/` — specialist wrappers (DeepSeek-R1, DeepSeek-Coder).
- `tools/` — registry, file, shell, python.
- `agents/` — executor, verifier, loop.
