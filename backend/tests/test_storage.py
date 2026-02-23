"""
ECHO V4 — Storage Tests (backend/tests/test_storage.py)
"""
import pytest
import os
import tempfile
from backend.app.storage.manager import StorageManager


def test_write_and_read():
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["ECHO_STORAGE_ROOT"] = tmp
        sm = StorageManager.__new__(StorageManager)
        from pathlib import Path
        sm.root = Path(tmp).resolve()
        sm.portable = False

        sm.write("test_file.txt", "Hello ECHO V4")
        content = sm.read("test_file.txt")
        assert content == "Hello ECHO V4"


def test_portable_mode_blocks_escape():
    with tempfile.TemporaryDirectory() as tmp:
        sm = StorageManager.__new__(StorageManager)
        from pathlib import Path
        sm.root = Path(tmp).resolve()
        sm.portable = True

        with pytest.raises(PermissionError):
            sm.path("../../etc/passwd")


def test_delete():
    with tempfile.TemporaryDirectory() as tmp:
        sm = StorageManager.__new__(StorageManager)
        from pathlib import Path
        sm.root = Path(tmp).resolve()
        sm.portable = False

        sm.write("del_me.txt", "bye")
        assert sm.exists("del_me.txt")
        sm.delete("del_me.txt")
        assert not sm.exists("del_me.txt")
