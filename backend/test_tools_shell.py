"""Tests for /api/tools/shell and /api/tools/git.

The regression these guard: both handlers used asyncio's subprocess API, which
on Windows only works on a ProactorEventLoop. `uvicorn --reload` (the dev
server ECHO_start.py and the docs use) runs the app on a SelectorEventLoop,
where every spawn raises a bare NotImplementedError -- str() of which is "",
so the handler returned HTTP 500 {"detail": ""} for every allowed command.
So each command test runs on BOTH loop types.

Run: python backend/test_tools_shell.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import HTTPException  # noqa: E402

import main  # noqa: E402

# The loop uvicorn hands the app with --reload on Windows is the one that used
# to break; the plain one is what the packaged app gets. Both must work.
LOOPS = [asyncio.SelectorEventLoop, asyncio.ProactorEventLoop] \
    if sys.platform == "win32" else [asyncio.SelectorEventLoop]


def run_on(loop_factory, coro):
    """Run coro on a specific loop implementation, like uvicorn does."""
    with asyncio.Runner(loop_factory=loop_factory) as runner:
        return runner.run(coro)


def shell(command: str, timeout: int = 15):
    return main.tools_shell(main.ShellRequest(command=command, timeout=timeout))


def expect_status(fn, status: int):
    """Call fn(), require an HTTPException with this status, return it."""
    try:
        fn()
    except HTTPException as e:
        assert e.status_code == status, f"expected {status}, got {e.status_code}: {e.detail}"
        return e
    raise AssertionError(f"expected HTTPException {status}, call succeeded")


# ── the actual bug ───────────────────────────────────────────────────────────

def test_allowed_command_runs_on_every_loop_type():
    for factory in LOOPS:
        res = run_on(factory, shell("whoami"))
        assert res["returncode"] == 0, f"{factory.__name__}: {res}"
        assert res["stdout"].strip(), f"{factory.__name__}: no stdout, got {res}"


def test_echo_returns_its_argument_on_every_loop_type():
    for factory in LOOPS:
        res = run_on(factory, shell("echo hi"))
        assert res["stdout"].strip() == "hi", f"{factory.__name__}: {res}"


def test_git_endpoint_runs_on_every_loop_type():
    repo = str(Path(__file__).resolve().parent.parent)
    for factory in LOOPS:
        res = run_on(factory, main.tools_git(
            main.GitRequest(repo_path=repo, command="status --short")))
        assert res["returncode"] == 0, f"{factory.__name__}: {res}"


# ── every allowlisted command must actually be reachable ─────────────────────

def test_each_allowlisted_command_passes_the_allowlist_check():
    """`base_cmd.rstrip('.exe')` strips a character SET, not a suffix, so it
    turned date->dat, hostname->hostnam, type->typ and 403'd them."""
    for cmd in sorted(main.SAFE_SHELL_COMMANDS):
        try:
            run_on(LOOPS[0], shell(cmd, timeout=10))
        except HTTPException as e:
            assert e.status_code != 403, f"allowlisted '{cmd}' rejected: {e.detail}"


def test_exe_suffix_is_accepted():
    res = run_on(LOOPS[0], shell("whoami.exe"))
    assert res["returncode"] == 0, res


# ── failures must stay diagnosable ───────────────────────────────────────────

def test_spawn_failure_detail_is_never_empty():
    """An empty detail is what made this bug hard to find: the handler reported
    str(e), and str(NotImplementedError()) is ""."""
    detail = main._exec_failure(NotImplementedError()).detail
    assert detail.strip(), "500 with empty detail"
    assert "NotImplementedError" in detail, detail


def test_missing_binary_says_so():
    main.SAFE_SHELL_COMMANDS.add("definitely-not-a-real-binary")
    try:
        e = expect_status(
            lambda: run_on(LOOPS[0], shell("definitely-not-a-real-binary")), 404)
        assert "not installed" in e.detail, e.detail
    finally:
        main.SAFE_SHELL_COMMANDS.discard("definitely-not-a-real-binary")


def test_timeout_returns_408():
    main.SAFE_SHELL_COMMANDS.add("sleep")
    try:
        expect_status(lambda: run_on(LOOPS[0], shell("sleep 30", timeout=2)), 408)
    finally:
        main.SAFE_SHELL_COMMANDS.discard("sleep")


# ── the security properties the fix must not weaken ──────────────────────────

def test_command_outside_allowlist_is_rejected():
    expect_status(lambda: run_on(LOOPS[0], shell("python -c print(1)")), 403)
    expect_status(lambda: run_on(LOOPS[0], shell("curl http://example.com")), 403)


def test_shell_metacharacters_are_rejected():
    for attempt in ["echo a && whoami", "echo a | whoami", "echo a > out.txt",
                    "echo $(whoami)", "echo a; whoami"]:
        expect_status(lambda a=attempt: run_on(LOOPS[0], shell(a)), 403)


def test_arguments_are_not_interpreted_by_a_shell():
    """A shell would expand these; argv passes them through literally.

    Note `echo '*'` is NOT such a case on Windows: it does expand, but the
    MSYS/Git-for-Windows binary globs its own command line, no shell involved.
    Chaining and redirection -- what the blocklist above exists for -- can't
    happen either way.
    """
    for arg, expected in [("%PATH%", "%PATH%"), ("$HOME", "$HOME"),
                          ("a^&whoami", "a^&whoami")]:
        res = run_on(LOOPS[0], shell(f"echo {arg}"))
        assert res["stdout"].strip() == expected, res


def test_git_subcommand_outside_allowlist_is_rejected():
    expect_status(lambda: run_on(LOOPS[0], main.tools_git(
        main.GitRequest(repo_path=".", command="push origin main"))), 403)


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
    sys.exit(1 if failed else 0)
