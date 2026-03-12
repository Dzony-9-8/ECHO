"""
ECHO V4 — Encryption Stub (backend/app/storage/encryption.py)
Fernet-based encryption ready to be activated for portable USB mode.
Currently a no-op unless ECHO_ENCRYPT=true is set.
"""
import os

ECHO_ENCRYPT = os.getenv("ECHO_ENCRYPT", "false").lower() in ("true", "1", "t")

try:
    from cryptography.fernet import Fernet
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False


class EncryptionManager:
    def __init__(self):
        self.enabled = ECHO_ENCRYPT and CRYPTO_AVAILABLE
        self._fernet = None

        if self.enabled:
            key_env = os.getenv("ECHO_ENCRYPT_KEY", "")
            if key_env:
                self._fernet = Fernet(key_env.encode())
            else:
                # Auto-generate key (session-only — not persisted)
                key = Fernet.generate_key()
                self._fernet = Fernet(key)
                print("[ECHO Encryption] Auto-generated session key — set ECHO_ENCRYPT_KEY for persistence.")

    def encrypt(self, data: bytes) -> bytes:
        if self.enabled and self._fernet:
            return self._fernet.encrypt(data)
        return data  # Passthrough if disabled

    def decrypt(self, data: bytes) -> bytes:
        if self.enabled and self._fernet:
            return self._fernet.decrypt(data)
        return data  # Passthrough if disabled


encryption = EncryptionManager()
