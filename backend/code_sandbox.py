"""Restricted Python execution.

An honest statement of what this is: a **restriction layer**, not a jail. You
cannot turn in-process CPython into a hard security boundary — given arbitrary
bytecode and enough cleverness, someone reaches ``object.__subclasses__()`` and
from there the filesystem. The real isolation is that callers run this in a
separate short-lived process with a timeout, and on POSIX with resource limits.

What this layer does provide, and what is tested:

* **Static rejection before execution.** The code is parsed and walked. Imports
  are refused, and so is every attribute or name that begins with an underscore
  — which is the doorway to all the classic escapes (``__class__``,
  ``__bases__``, ``__subclasses__``, ``__globals__``, ``__builtins__``).
* **A real builtins allowlist.** The execution namespace gets a fixed set of
  safe callables. The dangerous ones — ``__import__``, ``open``, ``eval``,
  ``exec``, ``compile``, ``getattr``, ``globals`` — are simply absent, so even
  the string-concatenation tricks that defeat an AST filter have nothing to call.

Together these stop the escapes demonstrated against the old sandbox: ``import
os``, ``__import__(...)``, ``open(...)``, and ``().__class__.__bases__[0]
.__subclasses__()``. They are defence in depth, not a promise, and the caller's
process boundary is what a serious attacker has to beat.
"""

from __future__ import annotations

import ast

# Names that, if reachable, hand back a real builtins or an import. The AST
# check already blocks underscore access, but listing them makes the failure
# message specific and guards against a future edit loosening the walker.
_FORBIDDEN_NAMES = frozenset({
    "eval", "exec", "compile", "open", "input", "breakpoint",
    "globals", "locals", "vars", "getattr", "setattr", "delattr",
    "__import__", "__build_class__", "help", "memoryview",
})


class UnsafeCode(ValueError):
    """The submitted code is not allowed. The message is safe to show a user."""


def _describe(node: ast.AST) -> str:
    return f"line {getattr(node, 'lineno', '?')}"


def check_code(code: str) -> None:
    """Raise UnsafeCode if the source uses a forbidden construct.

    Run before execution. Rejecting here means the dangerous call never happens,
    rather than relying on it failing at runtime.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        raise UnsafeCode(f"Syntax error: {e.msg} (line {e.lineno})")

    for node in ast.walk(tree):
        # No imports — the sandbox has no need for them and they are the most
        # direct route out.
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise UnsafeCode(f"Imports are not allowed ({_describe(node)}).")

        # No underscore attribute access. This is the single check that closes
        # the __class__ -> __subclasses__ family of escapes.
        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            raise UnsafeCode(
                f"Access to '{node.attr}' is not allowed ({_describe(node)})."
            )

        # No dunder names, and none of the explicitly dangerous builtins, even
        # if some future change reintroduced one to the namespace.
        if isinstance(node, ast.Name):
            if node.id.startswith("__") or node.id in _FORBIDDEN_NAMES:
                raise UnsafeCode(
                    f"Use of '{node.id}' is not allowed ({_describe(node)})."
                )

        # Keyword arguments and attribute-free calls are fine; block the two
        # dynamic-execution AST forms that don't go through a Name we'd catch.
        if isinstance(node, ast.Global) or isinstance(node, ast.Nonlocal):
            raise UnsafeCode(f"global/nonlocal are not allowed ({_describe(node)}).")


def safe_builtins() -> dict[str, object]:
    """A fixed set of harmless builtins. Dangerous ones are simply not present."""
    allowed = [
        "abs", "all", "any", "ascii", "bin", "bool", "bytearray", "bytes",
        "chr", "complex", "dict", "divmod", "enumerate", "filter", "float",
        "format", "frozenset", "hash", "hex", "int", "isinstance", "issubclass",
        "iter", "len", "list", "map", "max", "min", "next", "oct", "ord",
        "pow", "print", "range", "repr", "reversed", "round", "set", "slice",
        "sorted", "str", "sum", "tuple", "type", "zip", "True", "False", "None",
    ]
    import builtins as _b
    out: dict[str, object] = {}
    for name in allowed:
        if hasattr(_b, name):
            out[name] = getattr(_b, name)
    return out


def safe_globals() -> dict[str, object]:
    """The execution namespace: safe builtins plus a few whitelisted modules.

    The modules are the pure-computation ones the old sandbox advertised. They
    are added as already-imported objects because ``import`` is blocked, and
    none of them expose a filesystem or network path through a public,
    non-underscore attribute.
    """
    import datetime as _datetime
    import json as _json
    import math as _math
    import random as _random
    import re as _re

    return {
        "__builtins__": safe_builtins(),
        "math": _math,
        "json": _json,
        "re": _re,
        "random": _random,
        "datetime": _datetime,
    }


def apply_resource_limits() -> None:
    """Best-effort OS limits for the child process. POSIX only; a no-op elsewhere.

    Not a substitute for the checks above — a second, independent wall. On
    Windows the ``resource`` module is absent, so the process timeout the caller
    enforces is the only limit; that is stated honestly rather than pretended.
    """
    try:
        import resource
    except ImportError:
        return
    _MB = 1024 * 1024
    for res, soft in [
        (resource.RLIMIT_CPU, 10),          # 10s of CPU
        (resource.RLIMIT_AS, 512 * _MB),    # 512MB address space
        (resource.RLIMIT_FSIZE, 0),         # no file writes at all
    ]:
        try:
            resource.setrlimit(res, (soft, soft))
        except (ValueError, OSError):
            pass
