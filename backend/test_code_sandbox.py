"""Sandbox tests — mostly escape attempts.

Each ESCAPE case is code that broke, or could break, the old restricted-globals
sandbox. They must all be rejected by check_code OR fail at runtime with the
dangerous name absent. The SAFE cases must still run, or the layer is useless.

Run: python backend/test_code_sandbox.py
"""

from __future__ import annotations

import io
import sys
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import code_sandbox as cs  # noqa: E402

# Real strings this machine has, to prove a read actually happened if one does.
CANARY_FILE = str(Path(__file__).parent / "requirements.txt")


def run(code: str):
    """Mimic the executor: check, then exec in the safe namespace."""
    cs.check_code(code)
    buf = io.StringIO()
    with redirect_stdout(buf):
        exec(compile(code, "<sandbox>", "exec"), cs.safe_globals())
    return buf.getvalue()


def blocked(code: str) -> bool:
    """True if the code cannot execute — rejected statically or at runtime."""
    try:
        cs.check_code(code)
    except cs.UnsafeCode:
        return True
    # Passed the static check; it must still fail to do anything dangerous.
    try:
        exec(compile(code, "<sandbox>", "exec"), cs.safe_globals())
        return False   # it ran without error — NOT blocked
    except Exception:
        return True


# ── Escapes that must all be blocked ─────────────────────────────────────────

ESCAPES = {
    "import os": "import os",
    "from os import x": "from os import getcwd",
    "__import__": "__import__('os').getcwd()",
    "open()": "open('x')",
    "eval": "eval('1+1')",
    "exec": "exec('x=1')",
    "compile": "compile('1', '<s>', 'eval')",
    "getattr concat": "getattr((), '__cla' + 'ss__')",
    "subclasses escape": "().__class__.__bases__[0].__subclasses__()",
    "print globals": "print.__globals__",
    "builtins via dunder": "().__class__.__mro__[1].__subclasses__()",
    "globals()": "globals()",
    "vars()": "vars()",
    "read a real file": f"open({CANARY_FILE!r}).read()",
    "type dunder dict": "type.__dict__",
    "breakpoint": "breakpoint()",
    "global stmt": "def f():\n global x\n x=1",
}


def test_all_escapes_blocked():
    leaked = [label for label, code in ESCAPES.items() if not blocked(code)]
    assert not leaked, f"escape(s) NOT blocked: {leaked}"


def test_import_is_rejected_statically():
    try:
        cs.check_code("import os")
        assert False
    except cs.UnsafeCode as e:
        assert "import" in str(e).lower()


def test_dunder_access_rejected_statically():
    try:
        cs.check_code("().__class__")
        assert False
    except cs.UnsafeCode as e:
        assert "__class__" in str(e)


def test_dangerous_builtins_absent_from_namespace():
    b = cs.safe_globals()["__builtins__"]
    for bad in ["eval", "exec", "compile", "open", "__import__", "getattr", "globals"]:
        assert bad not in b, f"{bad} must not be in the safe builtins"


# ── Legitimate code must still work ──────────────────────────────────────────

SAFE = {
    "arithmetic": ("print(6 * 7)", "42"),
    "loop + sum": ("print(sum(range(1, 11)))", "55"),
    "string ops": ("print('abc'.upper())", "ABC"),
    "comprehension": ("print([x*x for x in range(4)])", "[0, 1, 4, 9]"),
    "math module": ("print(round(math.sqrt(144)))", "12"),
    "json module": ("print(json.dumps({'a': 1}))", '{"a": 1}'),
    "regex module": ("print(re.findall(r'\\d+', 'a1b22')[1])", "22"),
    "sorted/filter": ("print(sorted(filter(lambda n: n%2, range(6))))", "[1, 3, 5]"),
    "throwaway underscore": ("_ = 5\nprint(_ + 1)", "6"),
    "define and call fn": ("def sq(n):\n return n*n\nprint(sq(9))", "81"),
}


def test_safe_code_runs():
    failed = []
    for label, (code, expected) in SAFE.items():
        try:
            out = run(code).strip()
            if out != expected:
                failed.append(f"{label}: got {out!r}, expected {expected!r}")
        except Exception as e:
            failed.append(f"{label}: raised {type(e).__name__}: {e}")
    assert not failed, "safe code failed:\n  " + "\n  ".join(failed)


def test_underscore_throwaway_allowed_but_dunder_name_blocked():
    cs.check_code("_ = 1")                       # single underscore is fine
    try:
        cs.check_code("__x = 1")                 # dunder name is not
        assert False
    except cs.UnsafeCode:
        pass


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items())
             if n.startswith("test_") and callable(f)]
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  PASS  {name}")
        except Exception as e:
            failed += 1
            print(f"  FAIL  {name}: {type(e).__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    print(f"({len(ESCAPES)} escape attempts, {len(SAFE)} safe snippets)")
    sys.exit(1 if failed else 0)
