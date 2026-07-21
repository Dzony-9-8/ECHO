"""Tests for the startup feature banner.

The banner used to print a fixed list, so it advertised "BM25 | Knowledge
Watcher" on the same startup where the lines above it reported both imports as
unavailable. These tests pin the property that matters: a feature is only
listed as available when its flag says so.

The banner is built inside the lifespan startup, so rather than booting the app
these tests exercise the same (label, condition) construction against forced
flag combinations.

Run: python backend/test_startup_banner.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import main  # noqa: E402

# Mirrors the table in main.lifespan. Kept in sync by
# test_banner_labels_match_main, below.
LABELS = ["Hybrid RAG", "Web Research", "BM25", "Knowledge Watcher", "Workflow Builder"]


def build(chroma: bool, bm25: bool, ddg: bool, watchdog: bool):
    """The banner's own logic, over forced flags. Returns (available, missing)."""
    features = [
        ("Hybrid RAG",        chroma and bm25),
        ("Web Research",      ddg),
        ("BM25",              bm25),
        ("Knowledge Watcher", watchdog),
        ("Workflow Builder",  True),
    ]
    return ([n for n, ok in features if ok], [n for n, ok in features if not ok])


def test_nothing_available_is_never_advertised():
    """The actual bug: BM25 and the watcher listed while their imports failed."""
    on, off = build(chroma=False, bm25=False, ddg=False, watchdog=False)
    assert "BM25" not in on
    assert "Knowledge Watcher" not in on
    assert "Hybrid RAG" not in on
    assert "Web Research" not in on
    for label in ["BM25", "Knowledge Watcher", "Hybrid RAG", "Web Research"]:
        assert label in off, f"{label} missing from the unavailable list"


def test_every_feature_is_reported_exactly_once():
    for combo in range(16):
        on, off = build(bool(combo & 1), bool(combo & 2), bool(combo & 4), bool(combo & 8))
        assert sorted(on + off) == sorted(LABELS), f"combo {combo}: {on} / {off}"
        assert not set(on) & set(off), f"combo {combo}: feature in both lists"


def test_rag_is_only_hybrid_when_both_halves_are_present():
    """Vector store without BM25 is RAG, but it is not hybrid."""
    on, _ = build(chroma=True, bm25=False, ddg=True, watchdog=True)
    assert "Hybrid RAG" not in on
    on, _ = build(chroma=True, bm25=True, ddg=True, watchdog=True)
    assert "Hybrid RAG" in on


def test_all_present_reports_no_missing_line():
    on, off = build(chroma=True, bm25=True, ddg=True, watchdog=True)
    assert off == [], f"expected nothing missing, got {off}"
    assert on == LABELS


def test_workflow_builder_needs_no_optional_dependency():
    on, _ = build(chroma=False, bm25=False, ddg=False, watchdog=False)
    assert on == ["Workflow Builder"]


# ── guards against the table drifting out of sync with main.py ───────────────

def test_flags_the_banner_reads_still_exist():
    for flag in ["_BM25_AVAILABLE", "_WATCHDOG_AVAILABLE", "_DDG_AVAILABLE"]:
        assert hasattr(main, flag), f"main.{flag} is gone; the banner reads it"


def test_banner_labels_match_main():
    """If someone edits the banner table, this test should be updated with it."""
    source = Path(main.__file__).read_text(encoding="utf-8", errors="replace")
    start = source.index("_features = [")
    table = source[start:source.index("]", start)]
    for label in LABELS:
        assert f'"{label}"' in table, f"{label} no longer in main.py's banner table"


def test_banner_is_not_a_hardcoded_string():
    """The regression: a fixed f-string listing every feature."""
    source = Path(main.__file__).read_text(encoding="utf-8", errors="replace")
    assert "Features: Hybrid RAG | Web Research | BM25" not in source, \
        "banner is hardcoded again"


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
