"""Tests for the vault <-> configuration seam.

Covers resolve_env and how consumers behave when the vault is locked.
Run: python backend/test_vault_resolution.py
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import vault  # noqa: E402

PASS = "correct horse battery staple"
KEY = "sk-live-SECRET-8823"


def fresh() -> Path:
    vault.lock()
    vault._failed_attempts = 0
    for k in ("IMAGE_API_KEY", "IMAGE_API_URL", "GITHUB_TOKEN"):
        os.environ.pop(k, None)
    return Path(tempfile.mkdtemp())


def test_plain_env_value_passes_through():
    fresh()
    os.environ["IMAGE_API_KEY"] = "plain-key"
    assert vault.resolve_env("IMAGE_API_KEY") == "plain-key"
    assert vault.env_needs_vault("IMAGE_API_KEY") is False


def test_reference_resolves_when_unlocked():
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "openai", KEY)
    os.environ["IMAGE_API_KEY"] = "{{vault:openai}}"
    assert vault.env_needs_vault("IMAGE_API_KEY") is True
    assert vault.resolve_env("IMAGE_API_KEY") == KEY


def test_reference_raises_when_locked():
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "openai", KEY)
    os.environ["IMAGE_API_KEY"] = "{{vault:openai}}"
    vault.lock()
    try:
        vault.resolve_env("IMAGE_API_KEY")
        assert False, "locked vault must not silently return the reference"
    except vault.VaultLocked:
        pass


def test_missing_env_is_none_not_an_error():
    fresh()
    assert vault.resolve_env("IMAGE_API_KEY") is None
    assert vault.resolve_env("IMAGE_API_KEY", "fallback") == "fallback"


def test_env_never_holds_the_secret():
    """The whole point: the plaintext key is not in the environment."""
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "openai", KEY)
    os.environ["IMAGE_API_KEY"] = "{{vault:openai}}"
    assert KEY not in os.environ.get("IMAGE_API_KEY", "")
    assert not any(KEY in v for v in os.environ.values()), \
        "secret must not appear anywhere in the environment"


# ── Consumer behaviour ───────────────────────────────────────────────────────

def test_image_status_reports_locked_not_unconfigured():
    """A locked vault must not look like a missing key."""
    import image_gen
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "openai", KEY)
    os.environ["IMAGE_API_URL"] = "https://api.example.com/v1"
    os.environ["IMAGE_API_KEY"] = "{{vault:openai}}"

    vault.lock()
    s = image_gen.status()
    assert s["vault_locked"] is True
    assert s["configured"] is False
    assert s["api_key_set"] is True, \
        "a locked key is set-but-unreadable, not missing — do not tell the user to re-enter it"

    vault.unlock(base, PASS)
    s = image_gen.status()
    assert (s["vault_locked"], s["configured"], s["api_key_set"]) == (False, True, True)


def test_image_generate_explains_the_lock():
    import asyncio
    import image_gen
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "openai", KEY)
    os.environ["IMAGE_API_URL"] = "https://api.example.com/v1"
    os.environ["IMAGE_API_KEY"] = "{{vault:openai}}"
    vault.lock()

    class NullLogger:
        def warning(self, *a, **k): pass

    out = asyncio.run(image_gen.generate("a cat", "1024x1024", 1, None, NullLogger()))
    assert out["images"] == []
    assert "nlock" in out["error"], f"error should tell the user to unlock: {out['error']}"
    assert KEY not in out["error"]


def test_redaction_of_upstream_echo():
    """An upstream error quoting the key back must be scrubbed."""
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "openai", KEY)
    upstream = f'{{"error":"invalid api key: {KEY}"}}'
    assert KEY not in vault.redact(upstream)
    assert "[redacted]" in vault.redact(upstream)


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
