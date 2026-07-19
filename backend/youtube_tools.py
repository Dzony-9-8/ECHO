"""YouTube tools — fetch real video metadata and captions with no extra deps.

Metadata comes from YouTube's public oEmbed endpoint (no API key). Transcripts
are read from the caption tracks embedded in the watch page (the same source
youtube-transcript-api uses) and parsed from the timedtext XML. Everything is
real; when a video has no captions we say so rather than inventing a transcript.
"""

from __future__ import annotations

import html
import json
import re
from typing import Any, Optional

import httpx

_ID_PATTERNS = [
    re.compile(r"(?:v=|/v/|youtu\.be/|/embed/|/shorts/)([0-9A-Za-z_-]{11})"),
    re.compile(r"^([0-9A-Za-z_-]{11})$"),
]


def parse_video_id(url: str) -> Optional[str]:
    url = (url or "").strip()
    for pat in _ID_PATTERNS:
        m = pat.search(url)
        if m:
            return m.group(1)
    return None


async def fetch_metadata(client: httpx.AsyncClient, url: str) -> dict[str, Any]:
    """Title / channel / thumbnail via oEmbed. Returns {} if unavailable."""
    try:
        r = await client.get(
            "https://www.youtube.com/oembed",
            params={"url": url, "format": "json"},
            timeout=10.0,
        )
        if r.status_code != 200:
            return {}
        d = r.json()
        return {
            "title": d.get("title"),
            "author": d.get("author_name"),
            "author_url": d.get("author_url"),
            "thumbnail": d.get("thumbnail_url"),
        }
    except Exception:
        return {}


def _extract_caption_tracks(page_html: str) -> list[dict[str, Any]]:
    """Pull captionTracks[] out of the ytInitialPlayerResponse blob in the page."""
    marker = '"captionTracks":'
    idx = page_html.find(marker)
    if idx == -1:
        return []
    start = page_html.find("[", idx)
    if start == -1:
        return []
    # Walk to the matching close bracket (tracks contain no nested arrays here,
    # but be safe and balance brackets).
    depth = 0
    for i in range(start, min(len(page_html), start + 20000)):
        c = page_html[i]
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(page_html[start : i + 1])
                except Exception:
                    return []
    return []


def _parse_timedtext(xml: str) -> list[dict[str, Any]]:
    """Parse timedtext XML (<text start=".." dur="..">...</text>) into segments."""
    segments: list[dict[str, Any]] = []
    for m in re.finditer(r'<text start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>(.*?)</text>', xml, re.S):
        raw = m.group(3)
        # timedtext double-escapes; unescape twice and strip tags.
        text = html.unescape(html.unescape(raw))
        text = re.sub(r"<[^>]+>", "", text).replace("\n", " ").strip()
        if not text:
            continue
        segments.append({
            "start": round(float(m.group(1)), 2),
            "dur": round(float(m.group(2) or 0.0), 2),
            "text": text,
        })
    return segments


async def fetch_transcript(client: httpx.AsyncClient, video_id: str) -> dict[str, Any]:
    """Return {available, text, segments, lang, languages, reason}. Never fabricates.

    Caption *tracks* are still discoverable from the watch page, so we always
    report which languages a video has. Fetching the caption *body*, however, is
    now blocked by YouTube for plain server-side requests: the timedtext URL
    returns HTTP 200 with an empty body unless the request carries a
    proof-of-origin token. We still attempt the download (it succeeds in
    environments where that restriction doesn't apply) and, when it comes back
    empty, say exactly why instead of implying the video has no captions.
    """
    try:
        watch = await client.get(
            f"https://www.youtube.com/watch?v={video_id}&hl=en",
            headers={"Accept-Language": "en-US,en;q=0.9"},
            cookies={"CONSENT": "YES+cb"},   # skip the EU consent interstitial
            timeout=12.0,
        )
    except Exception as e:
        return {"available": False, "reason": f"could not load the video page ({type(e).__name__})"}

    tracks = _extract_caption_tracks(watch.text)
    if not tracks:
        return {"available": False, "reason": "this video has no caption tracks"}

    languages = sorted({t.get("languageCode") for t in tracks if t.get("languageCode")})

    # Prefer a manually-created English track, else the first track.
    def score(t: dict[str, Any]) -> int:
        lang = (t.get("languageCode") or "").lower()
        manual = t.get("kind") != "asr"
        return (2 if lang.startswith("en") else 0) + (1 if manual else 0)

    track = sorted(tracks, key=score, reverse=True)[0]
    base_url = track.get("baseUrl")
    if not base_url:
        return {"available": False, "languages": languages, "reason": "caption track had no URL"}

    try:
        cap = await client.get(
            base_url,
            headers={"Referer": "https://www.youtube.com/", "Accept-Language": "en-US,en;q=0.9"},
            timeout=12.0,
        )
        segments = _parse_timedtext(cap.text)
    except Exception as e:
        return {
            "available": False,
            "languages": languages,
            "reason": f"could not fetch the caption track ({type(e).__name__})",
        }

    if not segments:
        return {
            "available": False,
            "languages": languages,
            "blocked": True,
            "reason": (
                "YouTube returned an empty caption track. It now requires a "
                "proof-of-origin token for server-side caption downloads, so ECHO "
                "can't fetch the text. Paste the transcript below to use the AI tools."
            ),
        }

    return {
        "available": True,
        "lang": track.get("languageCode"),
        "languages": languages,
        "kind": "auto-generated" if track.get("kind") == "asr" else "manual",
        "segments": segments,
        "text": " ".join(s["text"] for s in segments),
    }


async def fetch_video(client: httpx.AsyncClient, url: str) -> dict[str, Any]:
    """Top-level: resolve a URL to {video_id, url, metadata, transcript}."""
    video_id = parse_video_id(url)
    if not video_id:
        return {"error": "Could not parse a YouTube video ID from that URL."}
    canonical = f"https://www.youtube.com/watch?v={video_id}"
    metadata = await fetch_metadata(client, canonical)
    transcript = await fetch_transcript(client, video_id)
    return {
        "video_id": video_id,
        "url": canonical,
        "metadata": metadata,
        "transcript": transcript,
    }
