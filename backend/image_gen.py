"""
Image generation — thin proxy to an OpenAI-compatible images API.

ECHO ships no image model. Like Odysseus, generation is delegated to an
OpenAI-compatible `/images/generations` endpoint that the operator configures via
environment variables:

    IMAGE_API_URL   base URL, e.g. https://api.openai.com/v1  (or a local server:
                    http://localhost:8080/v1 for LocalAI / an SD OpenAI-compat shim)
    IMAGE_API_KEY   API key / token for that endpoint
    IMAGE_MODEL     model name (default "gpt-image-1")

IMAGE_API_KEY may be a vault reference — ``{{vault:openai}}`` — in which case the
key is only materialised for the duration of the outbound request, and the
environment never holds the secret itself. See vault.py.

If those are unset the feature reports itself as not-configured and never fabricates
an image — the UI surfaces setup instructions instead.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

import vault


def _config() -> dict[str, str | None]:
    """Resolve config. Raises vault.VaultLocked if the key needs an unlocked vault."""
    return {
        "base_url": (os.getenv("IMAGE_API_URL") or "").rstrip("/") or None,
        "api_key": vault.resolve_env("IMAGE_API_KEY") or None,
        "model": os.getenv("IMAGE_MODEL") or "gpt-image-1",
    }


def status() -> dict[str, Any]:
    """Never raises: a locked vault is a reportable state, not an error."""
    locked = False
    try:
        cfg = _config()
    except vault.VaultError:
        locked = True
        cfg = {
            "base_url": (os.getenv("IMAGE_API_URL") or "").rstrip("/") or None,
            "api_key": None,
            "model": os.getenv("IMAGE_MODEL") or "gpt-image-1",
        }
    configured = bool(cfg["base_url"] and cfg["api_key"])
    return {
        "configured": configured,
        "model": cfg["model"] if configured or locked else None,
        "base_url_set": bool(cfg["base_url"]),
        # The key IS set — it just can't be read yet. Saying "not configured"
        # would send the user to re-enter something they already have.
        "api_key_set": bool(cfg["api_key"]) or locked,
        "vault_locked": locked,
    }


async def generate(prompt: str, size: str, n: int, client: httpx.AsyncClient, logger) -> dict[str, Any]:
    """
    Returns {"images": [b64, ...]} on success, or {"error": "..."} — never a fake image.
    """
    try:
        cfg = _config()
    except vault.VaultError as e:
        # The key is configured as a vault reference and the vault is locked.
        # Say so — this is fixable by unlocking, unlike a missing key.
        return {"error": f"{e} Unlock the vault to use image generation.", "images": []}
    if not (cfg["base_url"] and cfg["api_key"]):
        return {"error": "Image generation is not configured. Set IMAGE_API_URL and IMAGE_API_KEY on the backend.", "images": []}
    if not prompt.strip():
        return {"error": "Prompt is required.", "images": []}

    url = f"{cfg['base_url']}/images/generations"
    payload = {
        "model": cfg["model"],
        "prompt": prompt.strip(),
        "size": size or "1024x1024",
        "n": max(1, min(n, 4)),
        "response_format": "b64_json",
    }
    headers = {"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"}

    try:
        resp = await client.post(url, json=payload, headers=headers, timeout=120)
        if resp.status_code != 200:
            # Upstream error bodies sometimes quote the credential back at you.
            # Redact before this reaches a log file or the browser.
            detail = vault.redact(resp.text[:300])
            logger.warning(f"[image_gen] endpoint returned {resp.status_code}: {detail}")
            return {"error": f"Image endpoint returned HTTP {resp.status_code}: {detail}", "images": []}
        data = resp.json()
        images: list[str] = []
        for item in data.get("data", []):
            if item.get("b64_json"):
                images.append(item["b64_json"])
            elif item.get("url"):
                # Some backends only return URLs — fetch and inline as base64 so the
                # client gets a uniform payload it can store/download offline.
                try:
                    img = await client.get(item["url"], timeout=60)
                    if img.status_code == 200:
                        import base64
                        images.append(base64.b64encode(img.content).decode("ascii"))
                except Exception:
                    pass
        if not images:
            return {"error": "The image endpoint returned no image data.", "images": []}
        return {"images": images, "model": cfg["model"]}
    except Exception as e:
        logger.warning(f"[image_gen] request failed: {vault.redact(str(e))}")
        return {"error": f"Image request failed: {e}", "images": []}
