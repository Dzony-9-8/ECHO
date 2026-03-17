"""
ECHO Quick Start (Development / Testing)
=========================================
Double-click this to launch ECHO without building an exe.
The backend terminal stays visible so you can monitor logs and errors.

Usage:
    Double-click ECHO_start.py   (or: python ECHO_start.py)

What it does:
    1. Kills any stale ECHO/Python processes on port 8000
    2. Builds the frontend (if dist/ is missing)
    3. Copies dist/ into backend/dist/ so the API serves the UI
    4. Starts uvicorn in a subprocess (logs visible in this terminal)
    5. Opens a native pywebview window
    6. When the window is closed, kills the server and exits cleanly
"""

import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path

# Python 3.12 path — pywebview/pythonnet don't build on 3.14
PYTHON312 = Path(r"C:\Users\dzoni\AppData\Local\Programs\Python\Python312\python.exe")

PROJECT_ROOT = Path(__file__).parent
BACKEND_DIR = PROJECT_ROOT / "backend"
DIST_DIR = PROJECT_ROOT / "dist"
BACKEND_DIST = BACKEND_DIR / "dist"


def _needs_relaunch() -> bool:
    """Check if we need to re-launch under Python 3.12 for pywebview."""
    try:
        import webview  # noqa: F401
        return False  # pywebview available — we're fine
    except ImportError:
        if PYTHON312.exists() and Path(sys.executable).resolve() != PYTHON312.resolve():
            return True
        return False


def kill_port(port: int):
    """Kill leftover processes on the given port, including orphan children."""
    if platform.system() != "Windows":
        return
    try:
        import psutil
    except ImportError:
        return

    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True, timeout=5,
        )
        my_pid = os.getpid()
        killed = 0
        owner_pids = set()

        for line in result.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.split()
                if not parts:
                    continue
                try:
                    pid = int(parts[-1])
                except ValueError:
                    continue
                if pid in (my_pid, 0):
                    continue
                owner_pids.add(pid)

                # Try to kill the owner process
                try:
                    proc = psutil.Process(pid)
                    name = proc.name().lower()
                    if any(k in name for k in ("echo", "python", "uvicorn")):
                        print(f"  [cleanup] Killing stale PID {pid} ({name})")
                        proc.kill()
                        proc.wait(timeout=3)
                        killed += 1
                except psutil.NoSuchProcess:
                    # Ghost socket — owner is dead but orphan children may
                    # have inherited the socket. Find and kill them.
                    print(f"  [cleanup] Ghost socket (PID {pid} dead) — hunting orphan children...")
                    for child in psutil.process_iter(["pid", "name", "cmdline"]):
                        try:
                            cmd = " ".join(child.info["cmdline"] or [])
                            if f"parent_pid={pid}" in cmd and "multiprocessing" in cmd:
                                print(f"  [cleanup] Killing orphan child PID {child.pid}")
                                child.kill()
                                child.wait(timeout=3)
                                killed += 1
                        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.TimeoutExpired):
                            pass
                except (psutil.AccessDenied, psutil.TimeoutExpired):
                    pass

        if killed:
            print(f"  [cleanup] Removed {killed} stale process(es)")
        else:
            if owner_pids:
                print(f"  [cleanup] Found ghost sockets but no killable processes")
            else:
                print("  [cleanup] Port is free")
    except Exception as e:
        print(f"  [cleanup] Scan failed (non-fatal): {e}")


def ensure_frontend():
    """Build the frontend if dist/ is missing, then copy into backend/dist/."""
    # Check if we already have a fresh backend/dist/
    if BACKEND_DIST.exists() and (BACKEND_DIST / "index.html").exists():
        print("  Frontend already present in backend/dist/")
        return True

    # Try copying from project-root dist/ (from a previous npm run build)
    if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
        print("  Copying existing dist/ -> backend/dist/")
        if BACKEND_DIST.exists():
            shutil.rmtree(BACKEND_DIST)
        shutil.copytree(DIST_DIR, BACKEND_DIST)
        return True

    # Need to build
    print("  Running npm run build ...")
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=str(PROJECT_ROOT),
        shell=(platform.system() == "Windows"),
    )
    if result.returncode != 0:
        print("  [FAIL] npm run build failed")
        return False

    if not DIST_DIR.exists() or not (DIST_DIR / "index.html").exists():
        print("  [FAIL] Build did not produce dist/index.html")
        return False

    if BACKEND_DIST.exists():
        shutil.rmtree(BACKEND_DIST)
    shutil.copytree(DIST_DIR, BACKEND_DIST)
    print("  Frontend built and copied successfully")
    return True


def main():
    print(r"""
    =============================================
        ECHO Quick Start  (Development)
    =============================================
    """)

    # ── Step 1: Kill stale processes ─────────────────────────────────────
    print("[1/4] Checking for stale processes on port 8000...")
    kill_port(8000)
    time.sleep(0.5)

    # ── Step 2: Ensure frontend is available ─────────────────────────────
    print("[2/4] Preparing frontend...")
    if not ensure_frontend():
        print("\n[FAIL] Cannot start without frontend. Fix the build and retry.")
        return

    # ── Step 3: Start uvicorn as a visible subprocess ────────────────────
    print("[3/4] Starting backend (uvicorn --reload)...")
    print("=" * 50)
    print("  Backend logs will appear below.")
    print("  Close the ECHO window to stop everything.")
    print("=" * 50)

    server_proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "main:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--reload",
        ],
        cwd=str(BACKEND_DIR),
    )

    # Wait for server to be ready
    time.sleep(2.5)

    # Quick check: did the server crash immediately?
    if server_proc.poll() is not None:
        print("\n[FAIL] Backend failed to start (exit code %d)" % server_proc.returncode)
        return

    # ── Step 4: Open native window ───────────────────────────────────────
    print("[4/4] Opening ECHO window...\n")

    try:
        import webview
        webview.create_window(
            "ECHO",
            "http://localhost:8000",
            width=1280,
            height=800,
            min_size=(800, 500),
        )
        webview.start()
    except ImportError:
        # Fallback to browser
        import webbrowser
        print("[!!] pywebview not installed — opening in browser instead")
        print("     Install it:  pip install pywebview")
        webbrowser.open("http://localhost:8000")
        print("\nPress Ctrl+C to stop the server...\n")
        try:
            server_proc.wait()
        except KeyboardInterrupt:
            pass

    # ── Window closed — shut everything down ─────────────────────────────
    print("\n[shutdown] Window closed — stopping backend...")

    # Kill the uvicorn process tree (main + reload watcher)
    try:
        import psutil
        parent = psutil.Process(server_proc.pid)
        children = parent.children(recursive=True)
        for child in children:
            child.kill()
        parent.kill()
        parent.wait(timeout=3)
    except Exception:
        # Fallback: just kill the main process
        try:
            server_proc.kill()
            server_proc.wait(timeout=3)
        except Exception:
            pass

    print("[shutdown] All processes stopped. Goodbye!")


if __name__ == "__main__":
    # Re-launch under Python 3.12 if pywebview isn't available here
    if _needs_relaunch():
        print("[info] pywebview needs Python 3.12 — re-launching...\n")
        result = subprocess.run([str(PYTHON312), str(Path(__file__).resolve())])
        input("\nPress Enter to close...")
        sys.exit(result.returncode)

    try:
        main()
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
    finally:
        print()
        input("Press Enter to close...")
