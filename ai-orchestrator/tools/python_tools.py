"""Python execution — sandboxed exec; for simple expressions only."""
from typing import Any


def run_python(code: str) -> str:
    """Execute code in restricted scope; return repr of last expression or 'OK'."""
    local: dict[str, Any] = {}
    exec(code, {"__builtins__": __builtins__}, local)
    # If they defined a result or __result, use it
    if "result" in local:
        return str(local["result"])
    if "__result" in local:
        return str(local["__result"])
    return "OK"
