"""
Odysseus Update Checker
───────────────────────
Advisory-only helper that checks the upstream Odysseus GitHub repo
(github.com/pewdiepie-archdaemon/odysseus) for new commits since the last
acknowledged point and reports *what changed*.

It deliberately does NOT modify ECHO's code. Odysseus is Python/Flask + vanilla JS
and ECHO is React/FastAPI — the two stacks share no code, so upstream changes have to
be ported deliberately. This module just surfaces the changelog so that porting is an
informed decision, never a blind auto-merge.

State (the acknowledged/baseline commit SHA) is persisted to
``<writable>/data/odysseus_updates.json`` so "what's new since I last looked" survives
restarts.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx

DEFAULT_OWNER = "pewdiepie-archdaemon"
DEFAULT_REPO = "odysseus"
DEFAULT_BRANCH = "dev"  # Odysseus' default branch — gets the newest changes first.
GITHUB_API = "https://api.github.com"

_HEADERS_BASE = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "ECHO-odysseus-update-checker",
    "X-GitHub-Api-Version": "2022-11-28",
}


# ── State persistence ────────────────────────────────────────────────────────
def _state_file(base: Path) -> Path:
    d = base / "data"
    d.mkdir(parents=True, exist_ok=True)
    return d / "odysseus_updates.json"


def load_state(base: Path) -> dict[str, Any]:
    f = _state_file(base)
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_state(base: Path, state: dict[str, Any]) -> None:
    try:
        _state_file(base).write_text(json.dumps(state, indent=2), encoding="utf-8")
    except Exception:
        pass


# ── Helpers ──────────────────────────────────────────────────────────────────
def _headers(token: str | None) -> dict[str, str]:
    h = dict(_HEADERS_BASE)
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _fmt_commit(c: dict[str, Any]) -> dict[str, Any]:
    commit = c.get("commit", {}) or {}
    author = commit.get("author", {}) or {}
    message = (commit.get("message") or "").strip()
    subject = message.splitlines()[0] if message else "(no message)"
    return {
        "sha": (c.get("sha") or "")[:10],
        "full_sha": c.get("sha") or "",
        "subject": subject,
        "author": author.get("name") or (c.get("author") or {}).get("login") or "unknown",
        "date": author.get("date") or "",
        "url": c.get("html_url") or "",
    }


async def _recent_commits(
    client: httpx.AsyncClient, headers: dict[str, str], owner: str, repo: str, branch: str, limit: int = 30
) -> list[dict[str, Any]]:
    r = await client.get(
        f"{GITHUB_API}/repos/{owner}/{repo}/commits",
        params={"sha": branch, "per_page": str(limit)},
        headers=headers, timeout=15,
    )
    if r.status_code != 200:
        return []
    return [_fmt_commit(c) for c in r.json()]


# ── Public API ───────────────────────────────────────────────────────────────
async def check_updates(
    base: Path,
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
    branch: str,
    token: str | None,
    logger,
) -> dict[str, Any]:
    """
    Returns a report of what changed upstream since the acknowledged baseline:
      { owner, repo, branch, repo_url, acked_sha, latest_sha, has_updates,
        behind_by, first_run, commits[], compare_url, error, rate_limited }
    """
    headers = _headers(token)
    state = load_state(base)
    acked = state.get("acked_sha")

    result: dict[str, Any] = {
        "owner": owner, "repo": repo, "branch": branch,
        "repo_url": f"https://github.com/{owner}/{repo}",
        "acked_sha": acked, "acked_at": state.get("acked_at"),
        "latest_sha": None, "has_updates": False, "behind_by": 0,
        "first_run": not acked, "commits": [], "compare_url": None,
        "error": None, "rate_limited": False, "authenticated": bool(token),
    }

    try:
        # Latest commit on the tracked branch.
        r = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/commits/{branch}", headers=headers, timeout=15
        )
        if r.status_code == 403 and "rate limit" in r.text.lower():
            result["rate_limited"] = True
            result["error"] = "GitHub API rate limit reached. Set a GITHUB_TOKEN env var to raise it (60→5000/hr)."
            return result
        if r.status_code == 404:
            result["error"] = f"Repo or branch not found: {owner}/{repo}@{branch}"
            return result
        if r.status_code != 200:
            result["error"] = f"GitHub returned HTTP {r.status_code}"
            return result

        latest_sha = r.json().get("sha")
        result["latest_sha"] = latest_sha

        if not acked:
            # No baseline yet — show recent history for context, but don't claim "behind".
            result["commits"] = await _recent_commits(client, headers, owner, repo, branch)
            result["has_updates"] = False
            return result

        if acked == latest_sha:
            result["has_updates"] = False
            return result

        # We have a baseline and upstream moved — get the precise diff range.
        result["compare_url"] = f"https://github.com/{owner}/{repo}/compare/{acked[:10]}...{latest_sha[:10]}"
        cmp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/compare/{acked}...{latest_sha}", headers=headers, timeout=20
        )
        if cmp.status_code == 200:
            data = cmp.json()
            result["behind_by"] = data.get("ahead_by", 0)
            # compare returns oldest→newest; present newest first, cap at 60.
            commits = [_fmt_commit(c) for c in data.get("commits", [])]
            result["commits"] = list(reversed(commits))[:60]
            result["has_updates"] = result["behind_by"] > 0
        else:
            # Baseline too old / not comparable — fall back to recent history.
            result["commits"] = await _recent_commits(client, headers, owner, repo, branch)
            result["has_updates"] = True
    except Exception as e:
        logger.warning(f"[odysseus] update check failed: {e}")
        result["error"] = str(e)

    return result


def acknowledge(base: Path, sha: str) -> dict[str, Any]:
    """Records `sha` as the new baseline so future checks report only newer commits."""
    from datetime import datetime, timezone

    state = load_state(base)
    state["acked_sha"] = sha
    state["acked_at"] = datetime.now(timezone.utc).isoformat()
    save_state(base, state)
    return {"ok": True, "acked_sha": sha, "acked_at": state["acked_at"]}
