"""
ECHO V4 — Portable USB Launcher (portable/launcher.py)
Detects host OS, sets runtime env for portable mode,
then launches the ECHO backend from the USB drive.

Usage:
  python portable/launcher.py [--usb-path /path/to/usb]
"""
import os
import sys
import platform
import subprocess
import argparse
from pathlib import Path


def detect_os() -> str:
    system = platform.system()
    return {"Windows": "windows", "Darwin": "macos", "Linux": "linux"}.get(system, "unknown")


def resolve_usb_root(explicit_path: str = None) -> str:
    if explicit_path:
        return str(Path(explicit_path).resolve())
    # Auto-detect: assume launcher.py lives on the USB, so use parent dir
    return str(Path(__file__).parent.parent.resolve())


def main():
    parser = argparse.ArgumentParser(description="ECHO Portable Launcher")
    parser.add_argument("--usb-path", help="Override USB/storage root path", default=None)
    parser.add_argument("--port",     help="Backend port",  default="8000")
    parser.add_argument("--host",     help="Backend host",  default="127.0.0.1")
    args = parser.parse_args()

    os_name  = detect_os()
    usb_root = resolve_usb_root(args.usb_path)

    print(f"[ECHO Portable] Detected OS : {os_name}")
    print(f"[ECHO Portable] Storage root: {usb_root}")

    # Set environment for portable mode
    env = os.environ.copy()
    env.update({
        "ECHO_MODE":         "portable",
        "ECHO_STORAGE_ROOT": usb_root,
    })

    # Launch backend
    echo_root = Path(__file__).parent.parent
    cmd = [
        sys.executable, "-m", "uvicorn",
        "backend.app.main:app",
        "--host", args.host,
        "--port", args.port,
        "--reload"
    ]

    print(f"[ECHO Portable] Launching: {' '.join(cmd)}")
    try:
        subprocess.run(cmd, cwd=str(echo_root), env=env, check=True)
    except KeyboardInterrupt:
        print("\n[ECHO Portable] Shutdown.")


if __name__ == "__main__":
    main()
