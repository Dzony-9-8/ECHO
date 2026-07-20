"""YouTube tools — fetch real video metadata and captions.

Two transcript paths, tried in order:

1. **yt-dlp** (primary). It runs YouTube's player handshake, so the timedtext
   URLs it hands back carry the ``pot``/``ei`` params that plain scraping can't
   produce. We only use it to *resolve* URLs and metadata — the caption body is
   fetched with our own async httpx client, which avoids yt-dlp's temp-file
   writing and the 429s it triggers when asked for many languages at once.
2. **Watch-page scrape** (fallback). No extra deps; works when YouTube isn't
   demanding a proof-of-origin token.

Metadata falls back to the public oEmbed endpoint. Everything is real: when a
video has no captions, or YouTube refuses to serve them, we say exactly that
rather than inventing a transcript.
"""

from __future__ import annotations

import asyncio
import html
import json
import re
from typing import Any, Optional

import httpx

try:  # optional dependency — the scrape fallback still works without it
    import yt_dlp  # type: ignore
except Exception:  # pragma: no cover - exercised only on installs without it
    yt_dlp = None  # type: ignore

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


# ── yt-dlp path ───────────────────────────────────────────────────────────────

def _parse_json3(raw: str) -> list[dict[str, Any]]:
    """Parse timedtext json3 into segments. Returns [] if it isn't json3."""
    try:
        data = json.loads(raw)
    except Exception:
        return []
    segments: list[dict[str, Any]] = []
    for ev in data.get("events") or []:
        segs = ev.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8", "") for s in segs).replace("\n", " ").strip()
        if not text:
            continue
        segments.append({
            "start": round((ev.get("tStartMs") or 0) / 1000.0, 2),
            "dur": round((ev.get("dDurationMs") or 0) / 1000.0, 2),
            "text": text,
        })
    return segments


def _ytdlp_extract(video_id: str) -> dict[str, Any]:
    """Blocking yt-dlp metadata+caption-URL extraction. Caller runs it in a thread."""
    opts = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "socket_timeout": 20,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:  # type: ignore[union-attr]
        return ydl.extract_info(
            f"https://www.youtube.com/watch?v={video_id}", download=False
        )


def _pick_track(info: dict[str, Any]) -> tuple[Optional[str], Optional[str], str, list[str]]:
    """Choose the best caption track. Returns (url, lang, kind, all_languages)."""
    manual = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}
    languages = sorted(set(manual) | set(auto))

    def english_first(langs: dict[str, Any]) -> list[str]:
        return sorted(langs, key=lambda l: (not l.lower().startswith("en"), l))

    # Manual captions beat auto-generated ones; English beats everything else.
    for source, kind in ((manual, "manual"), (auto, "auto-generated")):
        for lang in english_first(source):
            formats = source.get(lang) or []
            # json3 is the cheapest to parse; vtt/srv1 are the usual fallbacks.
            for ext in ("json3", "srv1", "vtt"):
                for f in formats:
                    if f.get("ext") == ext and f.get("url"):
                        return f["url"], lang, kind, languages
    return None, None, "", languages


async def fetch_via_ytdlp(client: httpx.AsyncClient, video_id: str) -> dict[str, Any]:
    """Resolve metadata + transcript through yt-dlp. Returns {} if it can't."""
    if yt_dlp is None:
        return {}
    try:
        info = await asyncio.to_thread(_ytdlp_extract, video_id)
    except Exception as e:
        return {"_error": f"{type(e).__name__}: {e}"}
    if not isinstance(info, dict):
        return {}

    metadata = {
        "title": info.get("title"),
        "author": info.get("channel") or info.get("uploader"),
        "author_url": info.get("channel_url") or info.get("uploader_url"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
    }

    url, lang, kind, languages = _pick_track(info)
    if not url:
        return {
            "metadata": metadata,
            "transcript": {
                "available": False,
                "languages": languages,
                "reason": "this video has no caption tracks",
            },
        }

    try:
        r = await client.get(url, headers={"Referer": "https://www.youtube.com/"}, timeout=20.0)
        raw = r.text
    except Exception as e:
        return {
            "metadata": metadata,
            "transcript": {
                "available": False,
                "languages": languages,
                "reason": f"could not fetch the caption track ({type(e).__name__})",
            },
        }

    segments = _parse_json3(raw) or _parse_timedtext(raw)
    if not segments:
        # Let the caller fall through to the scrape path rather than giving up.
        return {"metadata": metadata, "transcript": {}}

    return {
        "metadata": metadata,
        "transcript": {
            "available": True,
            "lang": lang,
            "languages": languages,
            "kind": kind,
            "source": "yt-dlp",
            "segments": segments,
            "text": " ".join(s["text"] for s in segments),
        },
    }


async def fetch_video(client: httpx.AsyncClient, url: str) -> dict[str, Any]:
    """Top-level: resolve a URL to {video_id, url, metadata, transcript}."""
    video_id = parse_video_id(url)
    if not video_id:
        return {"error": "Could not parse a YouTube video ID from that URL."}
    canonical = f"https://www.youtube.com/watch?v={video_id}"

    # Primary: yt-dlp. It performs the player handshake, so its timedtext URLs
    # carry the proof-of-origin params that a plain scrape cannot produce.
    primary = await fetch_via_ytdlp(client, video_id)
    metadata = primary.get("metadata") or {}
    transcript = primary.get("transcript") or {}
    if transcript.get("available"):
        return {
            "video_id": video_id,
            "url": canonical,
            "metadata": metadata,
            "transcript": transcript,
        }

    # Fallback: scrape the watch page. Also covers a missing/broken yt-dlp.
    scraped = await fetch_transcript(client, video_id)
    if not scraped.get("available") and transcript.get("reason"):
        # yt-dlp saw the caption inventory directly; trust its verdict over the
        # scrape's, which can't tell "no captions" from "token required".
        scraped = {**scraped, **transcript}
    if not metadata.get("title"):
        metadata = await fetch_metadata(client, canonical)

    return {
        "video_id": video_id,
        "url": canonical,
        "metadata": metadata,
        "transcript": scraped,
    }
