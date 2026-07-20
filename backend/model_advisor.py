"""
Model Update Advisor
────────────────────
Button-triggered helper that answers a single question: *is the model I'm running
outdated?* It gathers **real** metadata from public sources and compares the current
model's family/version against what's available.

It is strictly advisory — it never downloads, deploys, or deletes anything. All network
calls are best-effort and wrapped so a single unreachable source never breaks the check.

Sources:
  • Ollama library (ollama.com/library)  — clean model names + pull counts (primary signal)
  • Hugging Face  (huggingface.co/api)   — popular text-generation models (supplementary)
  • The Rundown AI (therundown.ai)        — news signal for freshly-announced models (notes)
"""

from __future__ import annotations

import math
import re
from typing import Any

import httpx

HF_API = "https://huggingface.co/api/models"
OLLAMA_LIBRARY = "https://ollama.com/library?sort=popular"
RUNDOWN_URL = "https://www.therundown.ai/"

# Families we recognise for the news-signal scan of The Rundown AI.
_KNOWN_FAMILIES = ["llama", "qwen", "deepseek", "gemma", "mistral", "phi", "mixtral", "qwq", "granite"]

_UA = {"User-Agent": "Mozilla/5.0 (ECHO model-advisor)"}


def _parse_family_version(model_id: str) -> tuple[str, float]:
    """
    Extracts a coarse (family, version) from a model id.
      'llama3.2:3b'          -> ('llama', 3.2)
      'qwen2.5-coder:3b'     -> ('qwen', 2.5)
      'org/Llama-3.3-70B'    -> ('llama', 3.3)
      'deepseek-r1:7b'       -> ('deepseek', 1.0)
    """
    base = model_id.split(":")[0].split("/")[-1].lower()
    fam_match = re.match(r"[a-z]+", base)
    family = fam_match.group(0) if fam_match else base
    ver_match = re.search(r"(\d+(?:\.\d+)?)", base)
    version = float(ver_match.group(1)) if ver_match else 0.0
    return family, version


def _parse_pull_count(raw: str) -> int:
    p = raw.lower().strip()
    try:
        if "m" in p:
            return int(float(p.replace("m", "")) * 1_000_000)
        if "k" in p:
            return int(float(p.replace("k", "")) * 1_000)
        return int(re.sub(r"[^\d]", "", p) or 0)
    except Exception:
        return 0


_SIZE_RE = re.compile(r">\s*(\d+(?:\.\d+)?)\s*([bBmM])\s*<")
_PULLS_RE = re.compile(r">\s*([\d.]+\s*[KMB]?)\s*</span>\s*<span[^>]*>\s*(?:&nbsp;|\s)*Pulls", re.I)


def _extract_sizes(block: str) -> list[str]:
    """Parameter sizes advertised on a library card, e.g. ["8b", "70b", "405b"].

    Matched on content shape rather than CSS classes: ollama.com dropped the
    x-test-size hooks these were originally scraped from, and its Tailwind
    classes churn. A standalone span whose text is `<number><b|m>` is a size
    badge; capability badges ("tools", "vision") can't match this pattern.

    Only the region *before* the stats line is scanned — the pull count renders
    as e.g. "117.3M" and would otherwise be misread as a 117.3-million-parameter
    size (it was, on the first pass).
    """
    stats = _PULLS_RE.search(block)
    region = block[: stats.start()] if stats else block
    out: list[str] = []
    for num, unit in _SIZE_RE.findall(region):
        s = f"{num}{unit.lower()}"
        if s not in out:
            out.append(s)
    return out


def _extract_pulls(block: str) -> int:
    """Pull count from a library card, anchored on the visible "Pulls" label."""
    m = _PULLS_RE.search(block)
    return _parse_pull_count(m.group(1).strip()) if m else 0


async def _scan_ollama(client: httpx.AsyncClient, logger) -> list[dict[str, Any]]:
    """Scrapes ollama.com/library for popular native models (name + pull count)."""
    out: list[dict[str, Any]] = []
    try:
        resp = await client.get(OLLAMA_LIBRARY, headers=_UA, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"[advisor] Ollama library returned {resp.status_code}")
            return out
        html = resp.text
        seen: set[str] = set()
        for m in re.finditer(r'<a href="/library/([^"]+)"[^>]*>(.*?)</a>', html, re.DOTALL):
            name, block = m.group(1), m.group(2)
            if not name or "/" in name or name in seen:
                continue
            seen.add(name)
            pulls = _extract_pulls(block)
            fam, ver = _parse_family_version(name)
            sizes = _extract_sizes(block)
            out.append({
                "id": name, "source": "ollama", "downloads": pulls,
                "last_modified": "", "family": fam, "version": ver,
                "sizes": [s.strip() for s in sizes if s.strip()],
            })
    except Exception as e:
        logger.warning(f"[advisor] Ollama scan failed: {e}")
    return out


async def _scan_huggingface(client: httpx.AsyncClient, logger) -> list[dict[str, Any]]:
    """Fetches the most-downloaded text-generation models from the HF API."""
    out: list[dict[str, Any]] = []
    try:
        resp = await client.get(
            HF_API,
            params={"filter": "text-generation", "sort": "downloads", "direction": "-1", "limit": "50"},
            headers=_UA, timeout=15,
        )
        if resp.status_code != 200:
            logger.warning(f"[advisor] Hugging Face returned {resp.status_code}")
            return out
        for m in resp.json():
            mid = m.get("id") or m.get("modelId") or ""
            if not mid:
                continue
            fam, ver = _parse_family_version(mid)
            out.append({
                "id": mid, "source": "huggingface",
                "downloads": int(m.get("downloads") or 0),
                "last_modified": m.get("lastModified") or "",
                "family": fam, "version": ver,
            })
    except Exception as e:
        logger.warning(f"[advisor] Hugging Face scan failed: {e}")
    return out


async def _scan_rundown(client: httpx.AsyncClient, logger) -> dict[str, float]:
    """
    Best-effort: scans The Rundown AI's front page for '<family> <version>' mentions
    (e.g. 'Llama 3.3', 'Qwen3'). Returns the highest version seen per family. Purely a
    freshness signal for notes — never authoritative.
    """
    found: dict[str, float] = {}
    try:
        resp = await client.get(RUNDOWN_URL, headers=_UA, timeout=10)
        if resp.status_code != 200:
            return found
        text = resp.text.lower()
        pattern = re.compile(r"(" + "|".join(_KNOWN_FAMILIES) + r")[\s-]*?(\d+(?:\.\d+)?)")
        for fam, ver in pattern.findall(text):
            try:
                v = float(ver)
            except ValueError:
                continue
            if v > found.get(fam, 0.0):
                found[fam] = v
    except Exception as e:
        logger.warning(f"[advisor] Rundown scan failed: {e}")
    return found


async def check_model_outdated(current_model: str, client: httpx.AsyncClient, logger) -> dict[str, Any]:
    """
    Determines whether `current_model` is outdated relative to real sources and returns:
      { current_model, is_outdated, reason, checked_sources, suggestions[] }
    """
    family, version = _parse_family_version(current_model)

    ollama = await _scan_ollama(client, logger)
    hf = await _scan_huggingface(client, logger)
    rundown = await _scan_rundown(client, logger)

    checked = []
    if ollama:
        checked.append("ollama")
    if hf:
        checked.append("huggingface")
    if rundown:
        checked.append("rundown")

    candidates = ollama + hf

    # Strictly-newer versions of the SAME family — the core "am I outdated?" signal.
    newer = [c for c in candidates if c["family"] == family and c["version"] > version]
    newer.sort(key=lambda c: (c["version"], c["downloads"]), reverse=True)

    suggestions: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    def _add(c: dict[str, Any], note: str) -> None:
        if c["id"] in seen_ids:
            return
        seen_ids.add(c["id"])
        suggestions.append({
            "id": c["id"], "source": c["source"],
            "downloads": c["downloads"], "last_modified": c["last_modified"], "note": note,
        })

    rundown_v = rundown.get(family, 0.0)

    if newer:
        is_outdated = True
        best = newer[0]
        reason = (
            f"A newer {family} release (v{best['version']:g}) is available — "
            f"you're on v{version:g}."
        )
        for c in newer[:3]:
            _add(c, f"newer {family} v{c['version']:g}")
    else:
        is_outdated = False
        if version > 0:
            reason = f"No newer {family} release found in the sources checked — you appear up to date."
        else:
            reason = "Couldn't determine a version for this model; showing popular models for reference."
        # Informational: a few of the most popular models overall.
        for c in sorted(candidates, key=lambda x: x["downloads"], reverse=True)[:3]:
            _add(c, "popular alternative")

    # Fold in the news signal if The Rundown mentions a newer version than we're running.
    if rundown_v > version and rundown_v > 0:
        note = f"The Rundown AI references {family} {rundown_v:g}"
        if not is_outdated:
            is_outdated = True
            reason = f"{note} — newer than your v{version:g}."
        elif suggestions:
            suggestions[0]["note"] += f"; {note}"

    if not checked:
        reason = "Could not reach any model source (Hugging Face, Ollama, The Rundown AI). Check your connection."

    return {
        "current_model": current_model,
        "is_outdated": is_outdated,
        "reason": reason,
        "checked_sources": checked,
        "suggestions": suggestions,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Cookbook: hardware-aware model recommendations
# ─────────────────────────────────────────────────────────────────────────────

def _size_to_billions(size: str) -> float | None:
    """'7b' -> 7.0, '3.8b' -> 3.8, '500m' -> 0.5. None if unparseable."""
    m = re.match(r"([\d.]+)\s*([bm])", size.strip().lower())
    if not m:
        return None
    try:
        val = float(m.group(1))
    except ValueError:
        return None
    return val / 1000.0 if m.group(2) == "m" else val


def _est_vram_gb(params_b: float) -> float:
    """Rough VRAM for a Q4_K_M GGUF: ~0.7 GB per billion params + ~0.8 GB overhead."""
    return round(params_b * 0.7 + 0.8, 1)


def _fit_for(est_vram_gb: float, vram_gb: float, ram_gb: float) -> str:
    if vram_gb > 0 and est_vram_gb <= vram_gb * 0.9:
        return "gpu"      # fits comfortably in VRAM
    if est_vram_gb <= max(ram_gb, 0) * 0.7:
        return "cpu"      # too big for VRAM but runnable on CPU/offload (slower)
    return "too_large"


def _pick_size(sizes: list[str], vram_gb: float, ram_gb: float) -> tuple[str | None, float | None, float | None, str]:
    """Choose the best single size of a model for this hardware.

    Prefer the LARGEST size that still fits in VRAM (most capable); otherwise the
    largest that fits in RAM (CPU offload); otherwise the smallest (too large).
    Returns (size_str, params_b, est_vram_gb, fit).
    """
    parsed = [(s, _size_to_billions(s)) for s in sizes]
    parsed = [(s, p) for s, p in parsed if p is not None]
    if not parsed:
        return None, None, None, "unknown"

    gpu_fits = [(s, p) for s, p in parsed if _fit_for(_est_vram_gb(p), vram_gb, ram_gb) == "gpu"]
    if gpu_fits:
        s, p = max(gpu_fits, key=lambda x: x[1])
        return s, p, _est_vram_gb(p), "gpu"

    cpu_fits = [(s, p) for s, p in parsed if _fit_for(_est_vram_gb(p), vram_gb, ram_gb) == "cpu"]
    if cpu_fits:
        s, p = max(cpu_fits, key=lambda x: x[1])
        return s, p, _est_vram_gb(p), "cpu"

    s, p = min(parsed, key=lambda x: x[1])
    return s, p, _est_vram_gb(p), "too_large"


_FIT_RANK = {"gpu": 3, "cpu": 2, "unknown": 1, "too_large": 0}


async def recommend_models(
    vram_gb: float, ram_gb: float, client: httpx.AsyncClient, logger, top_n: int = 15
) -> dict[str, Any]:
    """
    Ranks real Ollama-library models by hardware fit, architecture recency, and
    popularity. Advisory only — surfaces `ollama pull` targets, never downloads.
    """
    candidates = await _scan_ollama(client, logger)
    recs: list[dict[str, Any]] = []

    for c in candidates:
        sizes = c.get("sizes") or []
        size, params_b, est_vram, fit = _pick_size(sizes, vram_gb, ram_gb)

        # Score: hardware fit dominates, then capability (bigger is better *if it fits*),
        # architecture recency, then popularity. Implements the Cookbook goal of ranking
        # newer, better-fitting models above near-identical scores for everything.
        score = _FIT_RANK.get(fit, 0) * 1000.0
        if fit == "gpu" and params_b:
            score += min(params_b, 100.0)          # prefer the largest model that still fits
        elif fit == "cpu" and params_b:
            score += max(0.0, 30.0 - params_b)      # for CPU, smaller = more usable
        score += (c.get("version") or 0.0) * 3.0    # newer family version bonus
        score += min(math.log10((c.get("downloads") or 0) + 1), 8.0) * 2.0  # popularity

        recs.append({
            "id": c["id"],
            "pull": f"{c['id']}:{size}" if size else c["id"],
            "size": size,
            "params_b": params_b,
            "est_vram_gb": est_vram,
            "fit": fit,
            "downloads": c.get("downloads") or 0,
            "family": c.get("family"),
            "version": c.get("version"),
            "sizes": sizes,
            "_score": score,
        })

    recs.sort(key=lambda r: r["_score"], reverse=True)
    for r in recs:
        r.pop("_score", None)

    return {
        "hardware": {"vram_gb": round(vram_gb, 1), "ram_gb": round(ram_gb, 1)},
        "source": "ollama",
        "recommendations": recs[:top_n],
        "error": None if candidates else "Could not reach the Ollama library.",
    }
