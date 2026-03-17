"""
ECHO Portable Exe Builder
==========================
Builds a single portable ECHO.exe that bundles:
  - FastAPI backend (Ollama + ChromaDB)
  - Vite/React frontend (pre-built dist/)
  - Skills directory

Usage:
    python build_exe.py

Prerequisites:
    pip install -r backend/requirements.txt   (includes pyinstaller)
    npm install                                (for frontend build)
    Ollama must be installed separately on the target machine.

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
    input("Press Enter to close...")
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
        ECHO Portable Exe Builder
    =============================================
    """)

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
        "httpx",
        "httpx._transports",
        "httpx._transports.default",
        "psutil",
        "GPUtil",
        "fastapi",
        "fastapi.middleware",
        "fastapi.middleware.cors",
        "pydantic",
        "starlette",
        "starlette.responses",
        "starlette.routing",
        "starlette.staticfiles",
        "starlette.middleware",
        "anyio",
        "anyio._backends",
        "anyio._backends._asyncio",
        "webview",
        "webview.platforms",
        "webview.platforms.winforms",
        "clr_loader",
        "pythonnet",
    ]

    pyinstaller_cmd = [
        get_python(), "-m", "PyInstaller",
        "--onefile",
        "--name", "ECHO",
        "--clean",
        f"--add-data={BACKEND_DIST}{SEP}dist",
        f"--add-data={SKILLS_DIR}{SEP}skills",
        "--distpath", str(BUILD_OUTPUT),
        "--workpath", str(PROJECT_ROOT / "build_temp"),
        "--specpath", str(PROJECT_ROOT / "build_temp"),
    ]

    for imp in hidden_imports:
        pyinstaller_cmd.extend(["--hidden-import", imp])

    pyinstaller_cmd.append(str(BACKEND_DIR / "main.py"))

    run(
        pyinstaller_cmd,
        cwd=PROJECT_ROOT,
        description="Building portable exe with PyInstaller",
    )

    # ── Step 5: Verify output ─────────────────────────────────────────────
    exe_name = "ECHO.exe" if platform.system() == "Windows" else "ECHO"
    exe_path = BUILD_OUTPUT / exe_name

    if not exe_path.exists():
        fail(f"Expected output not found: {exe_path}")

    size_mb = exe_path.stat().st_size / (1024 * 1024)

    # ── Step 6: Cleanup build artifacts ───────────────────────────────────
    build_temp = PROJECT_ROOT / "build_temp"
    if build_temp.exists():
        shutil.rmtree(build_temp, ignore_errors=True)

    if BACKEND_DIST.exists():
        shutil.rmtree(BACKEND_DIST, ignore_errors=True)

    print(f"""
    =============================================
        BUILD SUCCESSFUL
    =============================================

    Output:  {exe_path}
    Size:    {size_mb:.1f} MB

    To run:
      1. Make sure Ollama is installed and running
         (ollama serve)
      2. Double-click ECHO.exe
      3. Browser will open automatically

    Note: ChromaDB data will be stored next to
          the exe file in a chroma_db/ folder.
    =============================================
    """)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n[ERROR] {e}")
    finally:
        print()
        input("Press Enter to close...")
