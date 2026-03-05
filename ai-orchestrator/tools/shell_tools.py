"""Shell tools — very limited allowlist."""
import subprocess

ALLOWED_PREFIXES = ("git", "ls", "dir", "pip", "python", "npm", "npx")


def run_shell(command: str) -> str:
    cmd = command.strip()
    if not any(cmd.startswith(p) for p in ALLOWED_PREFIXES):
        raise PermissionError(f"Command not allowed: {cmd[:50]}")
    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
        timeout=60,
    )
    out = (result.stdout or "") + (result.stderr or "")
    return out.strip() or f"(exit code {result.returncode})"
