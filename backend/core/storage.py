"""
ECHO V3 — Storage Abstraction Layer
All file read/write operations should go through StorageManager.
Storage root is configurable via ECHO_STORAGE_ROOT env variable.
In portable mode, writes are sandboxed to the storage root.
"""

import os
from pathlib import Path
from ..config import ECHO_STORAGE_ROOT, ECHO_MODE

class StorageManager:
    def __init__(self):
        self.root = Path(ECHO_STORAGE_ROOT).resolve()
        self.portable = (ECHO_MODE == "portable")
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, relative_path: str) -> Path:
        """Resolve a path relative to the storage root."""
        full_path = (self.root / relative_path).resolve()
        if self.portable:
            # In portable mode, enforce sandbox — no escaping storage root
            if not str(full_path).startswith(str(self.root)):
                raise PermissionError(
                    f"[ECHO Portable] Path escape blocked: {full_path} is outside {self.root}"
                )
        return full_path

    def write(self, relative_path: str, content: str, mode: str = "w") -> Path:
        """Write text content to a file inside the storage root."""
        target = self.path(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, mode, encoding="utf-8") as f:
            f.write(content)
        return target

    def read(self, relative_path: str) -> str:
        """Read text content from a file inside the storage root."""
        target = self.path(relative_path)
        if not target.exists():
            raise FileNotFoundError(f"[ECHO Storage] File not found: {target}")
        with open(target, "r", encoding="utf-8") as f:
            return f.read()

    def exists(self, relative_path: str) -> bool:
        """Check if a file exists in storage."""
        return self.path(relative_path).exists()

    def delete(self, relative_path: str) -> bool:
        """Delete a file from storage."""
        target = self.path(relative_path)
        if target.exists():
            target.unlink()
            return True
        return False

storage = StorageManager()
