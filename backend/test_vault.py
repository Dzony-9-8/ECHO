"""Vault tests — the security properties, not just CRUD.

Run: python -m pytest backend/test_vault.py -q
     (or: python backend/test_vault.py)
"""

from __future__ import annotations

import base64
import json
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import vault  # noqa: E402

PASS = "correct horse battery staple"


def fresh() -> Path:
    """A temp base dir with a locked, empty vault module state."""
    vault.lock()
    vault._failed_attempts = 0
    return Path(tempfile.mkdtemp())


# ── Round trip ───────────────────────────────────────────────────────────────

def test_create_set_lock_unlock_roundtrip():
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "openai", "sk-secret-value")
    vault.lock()

    assert vault.list_names() == [], "locked vault must not list names"
    vault.unlock(base, PASS)
    assert vault.list_names() == ["openai"]
    assert vault.resolve("key={{vault:openai}}") == "key=sk-secret-value"


def test_secrets_survive_restart():
    """A new process is simulated by wiping module state, not re-importing."""
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "a", "one")
    vault.set_secret(base, "b", "two")
    vault.lock()
    vault.unlock(base, PASS)
    assert vault.list_names() == ["a", "b"]
    assert vault.resolve("{{vault:b}}") == "two"


# ── The file must not leak ───────────────────────────────────────────────────

def test_plaintext_never_touches_disk():
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "openai", "sk-UNIQUE-CANARY-9137")
    raw = vault.vault_path(base).read_bytes()
    assert b"sk-UNIQUE-CANARY-9137" not in raw
    assert b"openai" not in raw, "secret NAMES must be encrypted too"
    assert PASS.encode() not in raw


def test_no_tmp_file_left_behind():
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "k", "v")
    leftovers = list(vault.vault_path(base).parent.glob("*.tmp"))
    assert leftovers == [], f"temp files left on disk: {leftovers}"


# ── Wrong passphrase / tampering ─────────────────────────────────────────────

def test_wrong_passphrase_rejected():
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "k", "v")
    vault.lock()
    try:
        vault.unlock(base, "wrong passphrase")
        assert False, "wrong passphrase must not unlock"
    except vault.VaultError:
        pass
    assert not vault.is_unlocked()


def test_ciphertext_tampering_detected():
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "k", "v")
    vault.lock()

    p = vault.vault_path(base)
    env = json.loads(p.read_text())
    ct = bytearray(base64.b64decode(env["ciphertext"]))
    ct[0] ^= 0x01                                  # flip one bit
    env["ciphertext"] = base64.b64encode(bytes(ct)).decode()
    p.write_text(json.dumps(env))

    try:
        vault.unlock(base, PASS)
        assert False, "tampered ciphertext must not decrypt"
    except vault.VaultError:
        pass


def test_kdf_downgrade_rejected():
    """Weakening the KDF on disk must not yield a readable vault.

    This holds even without authenticated headers — different parameters derive
    a different key — but it is the attack worth naming, so it gets a test.
    """
    base = fresh()
    vault.create(base, PASS)
    vault.lock()

    p = vault.vault_path(base)
    env = json.loads(p.read_text())
    env["kdf"]["n"] = 1024                         # try to weaken the KDF
    p.write_text(json.dumps(env))

    try:
        vault.unlock(base, PASS)
        assert False, "altered KDF parameters must be rejected"
    except vault.VaultError:
        pass


def test_metadata_tampering_detected():
    """Genuinely exercises the AAD binding.

    ``created`` does not feed the KDF, so the only thing standing between an
    edit and a successful decrypt is including it in the associated data. An
    earlier version of this test edited a KDF field instead, and passed even
    with AAD disabled — it was testing nothing.
    """
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "k", "v")
    vault.lock()

    p = vault.vault_path(base)
    env = json.loads(p.read_text())
    env["created"] = "1999-01-01T00:00:00+00:00"
    p.write_text(json.dumps(env))

    try:
        vault.unlock(base, PASS)
        assert False, "altered metadata must be rejected"
    except vault.VaultError:
        pass


def test_corrupt_file_reports_honestly():
    base = fresh()
    vault.create(base, PASS)
    vault.vault_path(base).write_text("this is not json")
    vault.lock()
    try:
        vault.unlock(base, PASS)
        assert False, "corrupt file must raise"
    except vault.VaultError as e:
        assert "corrupt" in str(e).lower()


# ── Locked state refuses everything ──────────────────────────────────────────

def test_locked_vault_refuses_operations():
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "k", "v")
    vault.lock()

    for label, fn in [
        ("set", lambda: vault.set_secret(base, "x", "y")),
        ("delete", lambda: vault.delete_secret(base, "k")),
        ("resolve", lambda: vault.resolve("{{vault:k}}")),
    ]:
        try:
            fn()
            assert False, f"{label} must fail while locked"
        except vault.VaultLocked:
            pass


def test_idle_timeout_locks():
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "k", "v")
    original = vault.IDLE_TIMEOUT_SECONDS
    try:
        vault.IDLE_TIMEOUT_SECONDS = 0.2
        assert vault.is_unlocked()
        time.sleep(0.35)
        assert not vault.is_unlocked(), "must auto-lock when idle"
        assert vault.list_names() == []
    finally:
        vault.IDLE_TIMEOUT_SECONDS = original


# ── Resolution ───────────────────────────────────────────────────────────────

def test_resolve_multiple_and_unknown():
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "user", "alice")
    vault.set_secret(base, "pw", "hunter2")
    assert vault.resolve("{{vault:user}}:{{vault:pw}}") == "alice:hunter2"
    assert vault.resolve("nothing here") == "nothing here"
    try:
        vault.resolve("{{vault:missing}}")
        assert False, "unknown reference must raise"
    except vault.VaultError as e:
        assert "missing" in str(e)


def test_resolve_does_not_recurse():
    """A secret containing a reference must not be expanded again."""
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "a", "{{vault:b}}")
    vault.set_secret(base, "b", "REAL")
    assert vault.resolve("{{vault:a}}") == "{{vault:b}}"


def test_redact():
    base = fresh()
    vault.create(base, PASS)
    vault.set_secret(base, "k", "sk-12345")
    assert vault.redact("sent sk-12345 to api") == "sent [redacted] to api"


# ── Input validation ─────────────────────────────────────────────────────────

def test_rejects_bad_names_and_empty_values():
    base = fresh()
    vault.create(base, PASS)
    for bad in ["has space", "semi;colon", "", "a" * 65, "brace{"]:
        try:
            vault.set_secret(base, bad, "v")
            assert False, f"name {bad!r} must be rejected"
        except vault.VaultError:
            pass
    try:
        vault.set_secret(base, "ok", "")
        assert False, "empty value must be rejected"
    except vault.VaultError:
        pass


def test_short_passphrase_and_double_create_rejected():
    base = fresh()
    try:
        vault.create(base, "short")
        assert False, "short passphrase must be rejected"
    except vault.VaultError:
        pass
    vault.create(base, PASS)
    try:
        vault.create(base, PASS)
        assert False, "must not clobber an existing vault"
    except vault.VaultError:
        pass


def test_status_shape_locked_and_unlocked():
    base = fresh()
    assert vault.status(base)["exists"] is False
    vault.create(base, PASS)
    vault.set_secret(base, "k", "v")
    s = vault.status(base)
    assert (s["exists"], s["unlocked"], s["count"], s["names"]) == (True, True, 1, ["k"])
    vault.lock()
    s = vault.status(base)
    assert (s["exists"], s["unlocked"], s["count"], s["names"]) == (True, False, 0, [])


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
