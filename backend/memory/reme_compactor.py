"""
ReMe Compactor — context window management based on agentscope-ai/ReMe.

Checks if message history exceeds the model's token budget, then compacts
old turns into a structured summary (Goal / Progress / Key Decisions / Next Steps)
while keeping recent turns verbatim for coherent continuation.
"""
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("echo.reme")

_CHARS_PER_TOKEN = 4   # conservative estimate: ~4 chars per token


def _estimate_tokens(messages: List[Dict[str, Any]]) -> int:
    """Character-based token estimate.  Good enough for deciding when to compact."""
    total = sum(len(str(m.get("content", ""))) for m in messages)
    return total // _CHARS_PER_TOKEN + len(messages) * 4  # 4-token overhead per message


def _split_messages(
    messages: List[Dict[str, Any]],
    keep_recent: int = 6,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Separate messages into:
      to_compact — older turns that will be summarised
      to_keep    — recent turns (always kept verbatim) + any system prompts

    System messages are always kept as-is at the front.
    """
    system_msgs = [m for m in messages if m.get("role") == "system"]
    non_system  = [m for m in messages if m.get("role") != "system"]

    if len(non_system) <= keep_recent:
        return [], system_msgs + non_system

    to_compact = non_system[:-keep_recent]
    to_keep    = non_system[-keep_recent:]
    return to_compact, system_msgs + to_keep


class ContextCompactor:
    """
    Usage pattern (already wired in main.py ContextWindowManager.trim):

        _reme.token_limit = model_limit
        if _reme.check_context(messages):
            messages = _reme.compact_memory(messages)
    """

    def __init__(self, token_limit: int = 4000):
        self.token_limit = token_limit
        self._ollama_url = "http://localhost:11434"
        self._summary_model = "llama3.2:3b"

    # ── Public API ─────────────────────────────────────────────────────────────

    def check_context(self, messages: List[Dict[str, Any]]) -> bool:
        """Return True when estimated token count exceeds 85% of the limit."""
        estimated = _estimate_tokens(messages)
        threshold = int(self.token_limit * 0.85)
        over = estimated > threshold
        if over:
            logger.info(
                f"[ReMe] ~{estimated} tokens > threshold {threshold} "
                f"(limit {self.token_limit}) — compaction triggered"
            )
        return over

    def compact_memory(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Summarise old turns into a single system message, keep recent turns intact.
        Falls back to simple truncation if Ollama is unreachable.
        """
        import datetime as _dt
        self._last_compaction_at = _dt.datetime.now(_dt.timezone.utc).isoformat()
        to_compact, to_keep = _split_messages(messages, keep_recent=6)
        if not to_compact:
            return messages

        history_text = self._format_for_summary(to_compact)
        summary = self._summarize_blocking(history_text)

        summary_msg: Dict[str, Any] = {
            "role": "system",
            "content": (
                "[Conversation Summary — earlier context compacted]\n"
                f"{summary}\n"
                "[End of Summary — recent messages follow]"
            ),
        }

        # Insert summary after any existing system messages
        result: List[Dict[str, Any]] = []
        injected = False
        for m in to_keep:
            if m.get("role") == "system" and not injected:
                result.append(m)
                result.append(summary_msg)
                injected = True
            else:
                result.append(m)
        if not injected:
            result.insert(0, summary_msg)

        logger.info(
            f"[ReMe] Compacted {len(to_compact)} turns → summary, "
            f"kept {len(to_keep)} recent messages"
        )
        return result

    # ── Internal helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _format_for_summary(messages: List[Dict[str, Any]]) -> str:
        lines = []
        for m in messages:
            role    = m.get("role", "?").upper()
            content = str(m.get("content", ""))[:400]
            lines.append(f"{role}: {content}")
        return "\n".join(lines)

    def _summarize_blocking(self, history_text: str) -> str:
        """
        Blocking (synchronous) Ollama call — called from compact_memory which
        may itself be called synchronously from ContextWindowManager.trim().
        """
        prompt = (
            "Summarize this conversation history. "
            "Output ONLY the four fields below, no extra text:\n\n"
            "Goal: [what the user is trying to accomplish]\n"
            "Progress: [what has been achieved so far]\n"
            "Key Decisions: [important choices or facts established]\n"
            "Next Steps: [what still needs to be done]\n\n"
            f"Conversation:\n{history_text[:3000]}"
        )
        try:
            import httpx
            resp = httpx.post(
                f"{self._ollama_url}/api/chat",
                json={
                    "model": self._summary_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "options": {"temperature": 0.2, "num_predict": 400},
                },
                timeout=30.0,
            )
            if resp.status_code == 200:
                text = resp.json().get("message", {}).get("content", "").strip()
                if text:
                    return text
        except Exception as e:
            logger.warning(f"[ReMe] Ollama summarize failed: {e}")

        # Fallback: plain header so context window still shrinks
        turn_count = len(history_text.split("\n"))
        return (
            f"Goal: [prior conversation — {turn_count} turns compacted]\n"
            "Progress: [see compacted history]\n"
            "Key Decisions: [unavailable — Ollama offline during compaction]\n"
            "Next Steps: [continue conversation]"
        )
