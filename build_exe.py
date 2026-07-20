"""
ECHO Portable Exe Builder
==========================
Builds a single portable ECHO.exe that bundles:
  - FastAPI backend (Ollama + ChromaDB + all v3.x features)
  - Vite/React frontend (pre-built dist/)
  - Skills directory

Usage:
    python build_exe.py

Prerequisites:
    pip install -r backend/requirements.txt   (includes pyinstaller)
    npm install                                (for frontend build)
    Ollama must be installed separately on the target machine.
    Models are downloaded on first run via the in-app setup wizard.

Output:
    build_output/ECHO.exe
"""

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent
BACKEND_DIR = PROJECT_ROOT / "backend"
DIST_DIR = PROJECT_ROOT / "dist"
BACKEND_DIST = BACKEND_DIR / "dist"
SKILLS_DIR = BACKEND_DIR / "skills"
BUILD_OUTPUT = PROJECT_ROOT / "build_output"

# PyInstaller --add-data separator: ; on Windows, : on Linux/Mac
SEP = ";" if platform.system() == "Windows" else ":"

# Python 3.12 path (pythonnet/pywebview don't build on 3.14)
PYTHON312 = Path(r"C:\Users\dzoni\AppData\Local\Programs\Python\Python312\python.exe")


def get_python() -> str:
    """Return a working Python path that has PyInstaller + pywebview installed."""
    if PYTHON312.exists():
        return str(PYTHON312)
    return sys.executable


def fail(msg: str):
    """Print error and wait for keypress before exiting."""
    print(f"\n[FAIL] {msg}")
    print()
    try:
        input("Press Enter to close...")
    except EOFError:
        pass  # non-interactive shell / CI
    sys.exit(1)


def run(cmd: list[str], cwd: Path | None = None, description: str = ""):
    """Run a subprocess, exit on failure."""
    print(f"\n{'='*50}")
    print(f"  {description}")
    print(f"  > {' '.join(cmd)}")
    print(f"{'='*50}\n")
    # shell=True on Windows so it can find .cmd/.bat files like npm.cmd
    result = subprocess.run(cmd, cwd=cwd, shell=(platform.system() == "Windows"))
    if result.returncode != 0:
        fail(f"{description} failed with exit code {result.returncode}")


def main():
    print(r"""
    =============================================
        ECHO Portable Exe Builder  v3.7
    =============================================
    """)

    # ── Step 0: Sync dependencies into the build interpreter ──────────────
    # PyInstaller bundles what it finds in THIS interpreter, not what
    # requirements.txt lists. Skipping this yields an exe that builds cleanly
    # and fails at runtime on whatever was added since the last build.
    if "--skip-deps" in sys.argv:
        print("[SKIP] Dependency sync (--skip-deps)")
    else:
        run(
            [get_python(), "-m", "pip", "install", "-q",
             "-r", str(BACKEND_DIR / "requirements.txt")],
            cwd=PROJECT_ROOT,
            description=f"Syncing dependencies into {get_python()}",
        )
        print("[OK] Dependencies in sync with requirements.txt")

    # ── Step 1: Build frontend ────────────────────────────────────────────
    run(
        ["npm", "run", "build"],
        cwd=PROJECT_ROOT,
        description="Building frontend (npm run build)",
    )

    if not DIST_DIR.exists() or not (DIST_DIR / "index.html").exists():
        fail("Frontend build did not produce dist/index.html")

    print("[OK] Frontend built successfully")

    # ── Step 2: Copy dist/ to backend/dist/ ───────────────────────────────
    if BACKEND_DIST.exists():
        shutil.rmtree(BACKEND_DIST)
    shutil.copytree(DIST_DIR, BACKEND_DIST)
    print(f"[OK] Copied dist/ -> backend/dist/")

    # ── Step 3: Ensure skills/ directory exists ───────────────────────────
    SKILLS_DIR.mkdir(exist_ok=True)
    readme = SKILLS_DIR / "README.md"
    if not readme.exists():
        readme.write_text(
            "# ECHO Skills\n\nPlace `.md` skill files here.\n"
            "They will be bundled into the portable exe.\n",
            encoding="utf-8",
        )
    print(f"[OK] Skills directory ready ({len(list(SKILLS_DIR.glob('*.md')))} files)")

    # ── Step 4: Run PyInstaller ───────────────────────────────────────────
    hidden_imports = [
        # uvicorn internals
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.protocols.websockets.wsproto_impl",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        # HTTP
        "httpx",
        "httpx._transports",
        "httpx._transports.default",
        "h2",
        "h2.connection",
        "h2.config",
        # FastAPI / Starlette
        "fastapi",
        "fastapi.middleware",
        "fastapi.middleware.cors",
        "pydantic",
        "pydantic.v1",
        "starlette",
        "starlette.responses",
        "starlette.routing",
        "starlette.staticfiles",
        "starlette.middleware",
        "starlette.middleware.cors",
        "anyio",
        "anyio._backends",
        "anyio._backends._asyncio",
        # System / GPU
        "psutil",
        "GPUtil",
        # ChromaDB
        "chromadb",
        "chromadb.api",
        "chromadb.api.client",
        "chromadb.db.impl",
        "chromadb.db.impl.sqlite",
        "chromadb.segment",
        "chromadb.segment.impl",
        "chromadb.segment.impl.vector",
        "chromadb.segment.impl.vector.local_hnsw",
        "chromadb.segment.impl.metadata",
        "chromadb.segment.impl.metadata.sqlite",
        "hnswlib",
        # RAG / NLP
        "rank_bm25",
        "ollama",
        # File processing
        "pdfplumber",
        "pdfminer",
        "pdfminer.high_level",
        "pdfminer.layout",
        "docx",
        "docx.shared",
        # Web search / scraping
        "duckduckgo_search",
        "bs4",
        "trafilatura",
        "lxml",
        "lxml.etree",
        "lxml.html",
        "cachetools",
        # Watchdog
        "watchdog",
        "watchdog.observers",
        "watchdog.events",
        # Voice
        "faster_whisper",
        "faster_whisper.transcribe",
        "ctranslate2",
        "pyttsx3",
        "pyttsx3.drivers",
        "pyttsx3.drivers.sapi5",
        # PyWebView (desktop window)
        "webview",
        "webview.platforms",
        "webview.platforms.winforms",
        "clr_loader",
        "pythonnet",
        # Multiprocessing (sandboxed code runner)
        "multiprocessing",
        "multiprocessing.process",
        "multiprocessing.queues",
        # Standard lib extras
        "email.mime.multipart",
        "email.mime.text",
        "hashlib",
        "hmac",
    ]

    pyinstaller_cmd = [
        get_python(), "-m", "PyInstaller",
        "--onefile",
        "--name", "ECHO",
        "--clean",
        "--noconfirm",
        f"--add-data={BACKEND_DIST}{SEP}dist",
        f"--add-data={SKILLS_DIR}{SEP}skills",
        "--distpath", str(BUILD_OUTPUT),
        "--workpath", str(PROJECT_ROOT / "build_temp"),
        "--specpath", str(PROJECT_ROOT / "build_temp"),
        # yt-dlp resolves extractors lazily through importlib, so PyInstaller's
        # static analysis never sees them. Without this the exe imports fine but
        # fails at runtime with "Unsupported URL".
        "--collect-submodules", "yt_dlp",
        # Exclude heavy ML libs that are not used at runtime
        "--exclude-module", "torch",
        "--exclude-module", "torchvision",
        "--exclude-module", "tensorflow",
        "--exclude-module", "matplotlib",
        "--exclude-module", "scipy",
        "--exclude-module", "sklearn",
        "--exclude-module", "pandas",
        # NOTE: numpy must NOT be excluded — chromadb, rank_bm25 and
        # faster_whisper all import it. It was excluded here for a long time and
        # got bundled anyway, pulled in as a hook dependency of the heavy libs
        # that were leaking into the build. Once those stopped leaking, the
        # exclude took effect and silently broke RAG, BM25 and voice.
        "--exclude-module", "PIL",
        "--exclude-module", "cv2",
        "--exclude-module", "jupyter",
        "--exclude-module", "notebook",
        "--exclude-module", "IPython",
    ]

    for imp in hidden_imports:
        pyinstaller_cmd.extend(["--hidden-import", imp])

    pyinstaller_cmd.append(str(BACKEND_DIR / "main.py"))

    run(
        pyinstaller_cmd,
        cwd=PROJECT_ROOT,
        description="Building portable exe with PyInstaller",
    )

    # ── Step 5: Download Ollama installer into build_output/ ─────────────
    OLLAMA_INSTALLER_URL = "https://ollama.com/download/OllamaSetup.exe"
    ollama_installer = BUILD_OUTPUT / "OllamaSetup.exe"
    if not ollama_installer.exists():
        print(f"\n{'='*50}")
        print("  Downloading Ollama installer...")
        print(f"  {OLLAMA_INSTALLER_URL}")
        print(f"{'='*50}\n")
        try:
            import urllib.request
            BUILD_OUTPUT.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(OLLAMA_INSTALLER_URL, ollama_installer)
            size_mb = ollama_installer.stat().st_size / (1024 * 1024)
            print(f"[OK] OllamaSetup.exe downloaded ({size_mb:.0f} MB)")
        except Exception as e:
            print(f"[WARN] Could not download Ollama installer: {e}")
            print("       Distribute ECHO.exe with OllamaSetup.exe manually, or")
            print("       users can download it from https://ollama.com/download")
    else:
        print(f"[OK] OllamaSetup.exe already present in build_output/")

    # ── Step 6: Verify output ─────────────────────────────────────────────
    exe_name = "ECHO.exe" if platform.system() == "Windows" else "ECHO"
    exe_path = BUILD_OUTPUT / exe_name

    if not exe_path.exists():
        fail(f"Expected output not found: {exe_path}")

    size_mb = exe_path.stat().st_size / (1024 * 1024)

    # A healthy build is ~140 MB. A large jump means a heavy library (torch is
    # the repeat offender) got pulled in via a hook — --exclude-module does not
    # stop that, so the fix is a clean build env, not more excludes.
    SIZE_CEILING_MB = 400
    if size_mb > SIZE_CEILING_MB:
        fail(
            f"ECHO.exe is {size_mb:.0f} MB, over the {SIZE_CEILING_MB} MB ceiling.\n"
            "       A heavy dependency was bundled. Build from a clean venv:\n"
            "         python -m venv .venv-build\n"
            "         .venv-build/Scripts/python.exe -m pip install -r backend/requirements.txt\n"
            "         .venv-build/Scripts/python.exe build_exe.py"
        )

    # ── Step 7: Smoke-test the frozen exe ─────────────────────────────────
    # Runs --selftest inside the real bundle, so it catches modules that were
    # missing from the build env or lost to lazy imports. A build that only
    # checks "the file exists" has shipped broken features before.
    print(f"\n{'='*50}")
    print("  Smoke-testing the built exe (--selftest)")
    print(f"{'='*50}\n")
    try:
        proc = subprocess.run(
            [str(exe_path), "--selftest"],
            capture_output=True, text=True, timeout=300,
        )
        print((proc.stdout or "").strip() or "(no output)")
        if proc.returncode != 0:
            print((proc.stderr or "").strip()[:2000])
            fail(
                "Self-test failed — the exe is missing something it needs.\n"
                "       If a module is absent, install it into the build env and\n"
                "       rebuild; if it imports here but not in the exe, it needs a\n"
                "       --hidden-import or --collect-submodules entry."
            )
    except subprocess.TimeoutExpired:
        fail("Self-test timed out after 300s")
    print("[OK] Self-test passed")

    # ── Step 8: Cleanup build artifacts ───────────────────────────────────
    build_temp = PROJECT_ROOT / "build_temp"
    if build_temp.exists():
        shutil.rmtree(build_temp, ignore_errors=True)

    if BACKEND_DIST.exists():
        shutil.rmtree(BACKEND_DIST, ignore_errors=True)

    ollama_bundled = (BUILD_OUTPUT / "OllamaSetup.exe").exists()
    print(f"""
    =============================================
        BUILD SUCCESSFUL
    =============================================

    Output:  {exe_path}
    Size:    {size_mb:.1f} MB
    {'Bundled: OllamaSetup.exe (distribute alongside ECHO.exe)' if ollama_bundled else 'Note: OllamaSetup.exe not bundled — users will be directed to download it'}

    To distribute:
      Copy the entire build_output/ folder:
        - ECHO.exe              (main application)
        {'- OllamaSetup.exe       (Ollama installer, auto-launched if missing)' if ollama_bundled else ''}

    On first run:
      1. Double-click ECHO.exe
      2. ECHO detects if Ollama/models are missing
      3. Click "Run Bundled Installer" to install Ollama
      4. After Ollama installs, restart ECHO
      5. Click "Install All Models" or "Install Main Only"
      6. Wait for models to download (one-time, ~2–6 GB)
      7. Enjoy ECHO!

    Note: ChromaDB data stored next to ECHO.exe
          in a chroma_db/ folder (auto-created).
    =============================================
    """)


if __name__ == "__main__":
    status = 0
    try:
        main()
    except SystemExit as e:          # fail() already reported the reason
        status = e.code or 0
    except Exception as e:
        print(f"\n[ERROR] {e}")
        status = 1
    finally:
        print()
        try:
            input("Press Enter to close...")
        except EOFError:
            pass  # non-interactive shell / CI
    sys.exit(status)
