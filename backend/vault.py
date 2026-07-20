"""Encrypted secrets store.

Design constraints, all deliberate:

* **Write-only from the outside.** Nothing in this module's public API returns a
  secret value except :func:`resolve`, which exists so the backend can
  substitute secrets into an outbound request at the moment it is sent. No HTTP
  endpoint may return a value, and no value is ever logged.
* **The key lives in memory only.** It is derived on unlock and dropped on lock.
  There is no key file, no auto-unlock, and no recovery path — a forgotten
  passphrase means the data is gone, which is the point.
* **Authenticated encryption.** AES-256-GCM with the header as associated data,
  so editing the KDF parameters on disk is detected rather than silently
  producing a wrong key.

What this protects against: someone who obtains the file — a stolen laptop, a
backup, a synced folder. What it cannot protect against: code running as you
while the vault is unlocked, because the key is in this process by definition.
The UI states that plainly; a store that oversells itself is worse than none.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

VERSION = 1

# scrypt cost. n=2^15 with r=8 needs ~32 MB and ~100 ms to derive, which is
# tolerable to unlock once and expensive to brute-force. argon2 would be the
# better primitive but is not a dependency; scrypt is in the standard library.
_KDF = {"name": "scrypt", "n": 1 << 15, "r": 8, "p": 1, "dklen": 32}
_SALT_BYTES = 16
_NONCE_BYTES = 12

# Auto-lock after inactivity so an unlocked vault does not outlive its use.
IDLE_TIMEOUT_SECONDS = 15 * 60

# Slow down repeated unlock attempts against a stolen file being probed through
# a running instance. Brute force against the file itself is bounded by scrypt.
_MAX_ATTEMPTS_BEFORE_DELAY = 3
_ATTEMPT_DELAY_SECONDS = 2.0

_REF_RE = re.compile(r"\{\{\s*vault:([A-Za-z0-9_.-]{1,64})\s*\}\}")


class VaultError(Exception):
    """Any vault failure. The message is safe to show a user."""


class VaultLocked(VaultError):
    def __init__(self, msg: str = "The vault is locked."):
        super().__init__(msg)


# ── In-memory state (never persisted) ────────────────────────────────────────

_key: Optional[bytes] = None
_secrets: dict[str, str] = {}
_unlocked_at: float = 0.0
_last_used: float = 0.0
_failed_attempts: int = 0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def vault_path(base: Path) -> Path:
    return Path(base) / "data" / "vault.enc"


def exists(base: Path) -> bool:
    return vault_path(base).exists()


# ── Crypto ───────────────────────────────────────────────────────────────────

def _derive(passphrase: str, salt: bytes, params: dict[str, Any]) -> bytes:
    return hashlib.scrypt(
        passphrase.encode("utf-8"),
        salt=salt,
        n=int(params["n"]),
        r=int(params["r"]),
        p=int(params["p"]),
        dklen=int(params["dklen"]),
        maxmem=int(params["n"]) * int(params["r"]) * 256,
    )


def _header(envelope: dict[str, Any]) -> bytes:
    """Associated data: the parts that must not be altered without detection.

    ``kdf`` is included for completeness, though altering it is self-detecting:
    different parameters derive a different key, so decryption fails anyway.
    ``created`` is the field that gives this real work to do — it is metadata
    that does not feed the KDF, so without binding it here it could be rewritten
    freely on a vault someone else holds.
    """
    return json.dumps(
        {
            "version": envelope["version"],
            "kdf": envelope["kdf"],
            "created": envelope.get("created"),
        },
        sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")


def _b64e(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _b64d(s: str) -> bytes:
    return base64.b64decode(s.encode("ascii"))


def _write(path: Path, envelope: dict[str, Any]) -> None:
    """Atomic write, owner-only where the OS honours it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(envelope, indent=2), encoding="utf-8")
    try:
        # Effective on POSIX. On Windows this does not restrict other accounts —
        # NTFS needs an ACL change — so the threat model does not lean on it.
        os.chmod(tmp, 0o600)
    except OSError:
        pass
    os.replace(tmp, path)


def _seal(path: Path, secrets: dict[str, str], key: bytes, kdf: dict[str, Any],
          salt: bytes, created: Optional[str] = None) -> None:
    envelope: dict[str, Any] = {
        "version": VERSION,
        "kdf": {**kdf, "salt": _b64e(salt)},
        "created": created or _now_iso(),
        "modified": _now_iso(),
    }
    nonce = os.urandom(_NONCE_BYTES)
    blob = json.dumps(secrets, separators=(",", ":")).encode("utf-8")
    envelope["nonce"] = _b64e(nonce)
    envelope["ciphertext"] = _b64e(AESGCM(key).encrypt(nonce, blob, _header(envelope)))
    _write(path, envelope)


def _load(path: Path) -> dict[str, Any]:
    try:
        envelope = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise VaultError("No vault has been created yet.")
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise VaultError("The vault file is corrupt and cannot be read.")
    if envelope.get("version") != VERSION:
        raise VaultError(f"Unsupported vault version: {envelope.get('version')!r}")
    return envelope


# ── Lifecycle ────────────────────────────────────────────────────────────────

def create(base: Path, passphrase: str) -> None:
    """Create an empty vault. Refuses to clobber an existing one."""
    if not passphrase or len(passphrase) < 8:
        raise VaultError("Passphrase must be at least 8 characters.")
    path = vault_path(base)
    if path.exists():
        raise VaultError("A vault already exists.")
    salt = os.urandom(_SALT_BYTES)
    key = _derive(passphrase, salt, _KDF)
    _seal(path, {}, key, _KDF, salt)
    _adopt(key, {})


def unlock(base: Path, passphrase: str) -> None:
    """Derive the key and decrypt. Raises VaultError on a bad passphrase."""
    global _failed_attempts
    if _failed_attempts >= _MAX_ATTEMPTS_BEFORE_DELAY:
        time.sleep(_ATTEMPT_DELAY_SECONDS)

    envelope = _load(vault_path(base))
    kdf = dict(envelope["kdf"])
    salt = _b64d(kdf.pop("salt"))
    key = _derive(passphrase, salt, kdf)
    try:
        blob = AESGCM(key).decrypt(
            _b64d(envelope["nonce"]), _b64d(envelope["ciphertext"]), _header(envelope)
        )
    except (InvalidTag, ValueError, KeyError):
        _failed_attempts += 1
        # GCM cannot distinguish a wrong key from altered bytes, so say both.
        raise VaultError(
            "Could not decrypt the vault — wrong passphrase, or the file has been modified."
        )
    _failed_attempts = 0
    _adopt(key, json.loads(blob))


def _adopt(key: bytes, secrets: dict[str, str]) -> None:
    global _key, _secrets, _unlocked_at, _last_used
    _key, _secrets = key, secrets
    _unlocked_at = _last_used = time.time()


def lock() -> None:
    """Drop the key and decrypted secrets.

    CPython cannot reliably scrub bytes from memory, so this removes references
    rather than guaranteeing erasure. It is not a defence against a memory dump.
    """
    global _key, _secrets, _unlocked_at, _last_used
    _key, _secrets, _unlocked_at, _last_used = None, {}, 0.0, 0.0


def is_unlocked() -> bool:
    """True if unlocked and not idle. Locks on expiry as a side effect."""
    global _last_used
    if _key is None:
        return False
    if time.time() - _last_used > IDLE_TIMEOUT_SECONDS:
        lock()
        return False
    return True


def _require_unlocked() -> None:
    if not is_unlocked():
        raise VaultLocked()
    global _last_used
    _last_used = time.time()


# ── Secrets ──────────────────────────────────────────────────────────────────

def set_secret(base: Path, name: str, value: str) -> None:
    _require_unlocked()
    if not _REF_RE.fullmatch("{{vault:%s}}" % name):
        raise VaultError(
            "Name may only contain letters, numbers, dot, dash and underscore."
        )
    if not value:
        raise VaultError("Value cannot be empty.")
    envelope = _load(vault_path(base))
    kdf = dict(envelope["kdf"])
    salt = _b64d(kdf.pop("salt"))
    _secrets[name] = value
    _seal(vault_path(base), _secrets, _key, kdf, salt, envelope.get("created"))


def delete_secret(base: Path, name: str) -> bool:
    _require_unlocked()
    if name not in _secrets:
        return False
    envelope = _load(vault_path(base))
    kdf = dict(envelope["kdf"])
    salt = _b64d(kdf.pop("salt"))
    del _secrets[name]
    _seal(vault_path(base), _secrets, _key, kdf, salt, envelope.get("created"))
    return True


def list_names() -> list[str]:
    """Names only — this is what the HTTP layer is allowed to expose."""
    if not is_unlocked():
        return []
    return sorted(_secrets)


def status(base: Path) -> dict[str, Any]:
    unlocked = is_unlocked()
    return {
        "exists": exists(base),
        "unlocked": unlocked,
        "names": sorted(_secrets) if unlocked else [],
        "count": len(_secrets) if unlocked else 0,
        "idle_timeout_seconds": IDLE_TIMEOUT_SECONDS,
        "unlocked_at": _unlocked_at if unlocked else None,
    }


# ── Reference resolution ─────────────────────────────────────────────────────

def has_refs(text: str) -> bool:
    return bool(text) and bool(_REF_RE.search(text))


def resolve(text: str) -> str:
    """Substitute ``{{vault:name}}`` with real values.

    INTERNAL ONLY. The result contains plaintext secrets: use it to build an
    outbound request and never return it to a client, write it to a log, or
    store it in a trace.
    """
    if not has_refs(text):
        return text
    _require_unlocked()

    def sub(m: re.Match) -> str:
        name = m.group(1)
        if name not in _secrets:
            raise VaultError(f"No secret named {name!r} in the vault.")
        return _secrets[name]

    return _REF_RE.sub(sub, text)


def redact(text: str) -> str:
    """Replace any secret value appearing in text with a placeholder.

    Defence in depth for anything that might be logged or echoed back after
    resolution. Longest-first so overlapping values cannot leave a fragment.
    """
    if not text or not _secrets:
        return text
    for value in sorted(_secrets.values(), key=len, reverse=True):
        if value and value in text:
            text = text.replace(value, "[redacted]")
    return text
