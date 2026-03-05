"""File tools — read/write; path must be within allowed base (caller can enforce)."""
from pathlib import Path


def read_file(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write_file(path: str, content: str) -> str:
    Path(path).write_text(content, encoding="utf-8")
    return "OK"
