"""
ECHO V4 — Storage Manager (backend/app/storage/manager.py)
Moved from backend/core/storage.py with updated import path.
"""
import os
from pathlib import Path
from ..core.config import ECHO_STORAGE_ROOT, ECHO_MODE


class StorageManager:
    def __init__(self):
        self.root     = Path(ECHO_STORAGE_ROOT).resolve()
        self.portable = (ECHO_MODE == "portable")
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, relative_path: str) -> Path:
        full_path = (self.root / relative_path).resolve()
        if self.portable and not str(full_path).startswith(str(self.root)):
            raise PermissionError(
                f"[ECHO Portable] Write blocked outside storage root: {full_path}"
            )
        return full_path

    def write(self, relative_path: str, content: str, mode: str = "w") -> Path:
        target = self.path(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, mode, encoding="utf-8") as f:
            f.write(content)
        return target

    def read(self, relative_path: str) -> str:
        target = self.path(relative_path)
        if not target.exists():
            raise FileNotFoundError(f"[ECHO Storage] Not found: {target}")
        with open(target, "r", encoding="utf-8") as f:
            return f.read()

    def exists(self, relative_path: str) -> bool:
        return self.path(relative_path).exists()

    def delete(self, relative_path: str) -> bool:
        target = self.path(relative_path)
        if target.exists():
            target.unlink()
            return True
        return False


storage = StorageManager()
