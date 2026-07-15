"""Server-side document drafts.

Plain JSON persistence under <writable>/data/documents.json so drafts survive a
browser clear and are shared across browsers on the same machine. No cleverness:
read the file, mutate, write it back atomically-ish.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any


def _file(writable: Path) -> Path:
    d = writable / "data"
    d.mkdir(parents=True, exist_ok=True)
    return d / "documents.json"


def load_all(writable: Path) -> list[dict[str, Any]]:
    p = _file(writable)
    if not p.exists():
        return []
    try:
        with p.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        # A corrupt/unreadable store must not take the endpoint down.
        return []


def save_all(writable: Path, docs: list[dict[str, Any]]) -> None:
    p = _file(writable)
    tmp = p.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=2)
    os.replace(tmp, p)  # atomic swap — never leave a half-written store


def upsert(writable: Path, doc: dict[str, Any]) -> dict[str, Any]:
    docs = load_all(writable)
    doc = {
        "id": str(doc.get("id") or f"{int(time.time() * 1000)}"),
        "title": str(doc.get("title") or ""),
        "content": str(doc.get("content") or ""),
        "updatedAt": int(doc.get("updatedAt") or time.time() * 1000),
    }
    for i, d in enumerate(docs):
        if d.get("id") == doc["id"]:
            docs[i] = doc
            break
    else:
        docs.insert(0, doc)
    save_all(writable, docs)
    return doc


def delete(writable: Path, doc_id: str) -> bool:
    docs = load_all(writable)
    remaining = [d for d in docs if d.get("id") != doc_id]
    if len(remaining) == len(docs):
        return False
    save_all(writable, remaining)
    return True
