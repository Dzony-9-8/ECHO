"""
Hindsight Engine — retain/recall/reflect memory system.
Based on vectorize-io/hindsight architecture.

Four parallel retrieval strategies:
  1. Semantic   — ChromaDB vector similarity
  2. Keyword    — BM25 full-text search
  3. Entity     — graph-style entity/noun matching
  4. Temporal   — most-recently-stored first

Results fused via Reciprocal Rank Fusion (RRF) for best relevance.
"""
import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("echo.hindsight")

# ── Optional deps — graceful fallback ─────────────────────────────────────────
try:
    import chromadb
    from chromadb.utils.embedding_functions import OllamaEmbeddingFunction
    _CHROMA_OK = True
except ImportError:
    _CHROMA_OK = False

try:
    from rank_bm25 import BM25Okapi
    _BM25_OK = True
except ImportError:
    _BM25_OK = False


# ── Helpers ────────────────────────────────────────────────────────────────────

def _rrf(ranked_lists: List[List[str]], k: int = 60) -> List[str]:
    """Reciprocal Rank Fusion — merge multiple ranked id lists."""
    scores: Dict[str, float] = {}
    for lst in ranked_lists:
        for rank, doc_id in enumerate(lst):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores, key=lambda x: scores[x], reverse=True)


def _extract_entities(text: str) -> List[str]:
    """Extract capitalized phrases and quoted strings as pseudo-entities."""
    caps = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
    quoted = re.findall(r'"([^"]{2,40})"', text)
    return list({e.lower() for e in caps + quoted if len(e) > 2})


# ── Main class ─────────────────────────────────────────────────────────────────

class HindsightMemory:
    """
    Biomimetic three-bank memory:
      • world      — facts about the environment / user's domain
      • experience — historical interactions (maps to 'episodic')
      • mental_models — learned insights derived from reflection

    Legacy bank names 'episodic', 'semantic', 'procedural' are also supported
    so existing /api/memory/* calls keep working.
    """

    ALL_BANKS = ("world", "experience", "mental_models",
                 "episodic", "semantic", "procedural")

    def __init__(self, db_path: str = "chroma_db"):
        self.db_path = db_path
        self._chroma: Optional[Any] = None
        self._collections: Dict[str, Any] = {}

        # In-memory indices (rebuilt from ChromaDB on first use if needed)
        self._bm25_docs: Dict[str, List[str]] = {}   # bank → [doc text]
        self._bm25_ids: Dict[str, List[str]] = {}    # bank → [doc id]
        self._bm25_idx: Dict[str, Any] = {}          # bank → BM25Okapi
        self._entity_map: Dict[str, List[str]] = {}  # entity → [doc ids]
        self._temporal: Dict[str, List[Dict]] = {}   # bank → [{id, timestamp}]

    # ── ChromaDB ───────────────────────────────────────────────────────────────

    def _get_chroma(self):
        if not _CHROMA_OK:
            return None
        if self._chroma is None:
            try:
                self._chroma = chromadb.PersistentClient(path=self.db_path)
            except Exception as e:
                logger.warning(f"[Hindsight] ChromaDB init: {e}")
        return self._chroma

    def _get_collection(self, bank: str):
        if bank in self._collections:
            return self._collections[bank]
        client = self._get_chroma()
        if client is None:
            return None
        safe = re.sub(r"[^a-z0-9_]", "_", bank.lower())
        name = f"hs_{safe}"
        try:
            ef = OllamaEmbeddingFunction(
                url="http://localhost:11434",
                model_name="nomic-embed-text",
            )
            coll = client.get_or_create_collection(name=name, embedding_function=ef)
        except Exception:
            try:
                coll = client.get_or_create_collection(name=name)
            except Exception as e:
                logger.warning(f"[Hindsight] Collection '{name}': {e}")
                return None
        self._collections[bank] = coll
        return coll

    # ── BM25 ───────────────────────────────────────────────────────────────────

    def _rebuild_bm25(self, bank: str):
        if not _BM25_OK:
            return
        docs = self._bm25_docs.get(bank, [])
        if not docs:
            return
        self._bm25_idx[bank] = BM25Okapi([d.lower().split() for d in docs])

    def _bm25_search(self, bank: str, query: str, n: int) -> List[str]:
        if not _BM25_OK or bank not in self._bm25_idx:
            return []
        ids = self._bm25_ids.get(bank, [])
        if not ids:
            return []
        scores = self._bm25_idx[bank].get_scores(query.lower().split())
        ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        return [ids[i] for i in ranked[:n] if scores[i] > 0]

    # ── Entity search ──────────────────────────────────────────────────────────

    def _entity_search(self, bank: str, query: str, n: int) -> List[str]:
        entities = _extract_entities(query)
        if not entities:
            return []
        hits: Dict[str, int] = {}
        prefix = bank[:3]
        for ent in entities:
            for doc_id in self._entity_map.get(ent, []):
                if doc_id.startswith(prefix):
                    hits[doc_id] = hits.get(doc_id, 0) + 1
        return sorted(hits, key=lambda x: hits[x], reverse=True)[:n]

    # ── Temporal search ────────────────────────────────────────────────────────

    def _temporal_search(self, bank: str, n: int) -> List[str]:
        entries = self._temporal.get(bank, [])
        return [e["id"] for e in sorted(entries, key=lambda x: x.get("timestamp", ""), reverse=True)[:n]]

    # ── Public API ─────────────────────────────────────────────────────────────

    async def retain(
        self,
        bank_id: str,
        content: str,
        context: Optional[str] = None,
        timestamp: Optional[str] = None,
    ):
        """Store content in the memory bank, updating all retrieval indices."""
        if not content:
            return
        ts = timestamp or datetime.now(timezone.utc).isoformat()
        doc_id = f"{bank_id[:3]}-{int(time.time() * 1000)}"
        entities = _extract_entities(content)

        # BM25 index
        self._bm25_docs.setdefault(bank_id, []).append(content)
        self._bm25_ids.setdefault(bank_id, []).append(doc_id)
        self._rebuild_bm25(bank_id)

        # Entity map
        for ent in entities:
            self._entity_map.setdefault(ent, []).append(doc_id)

        # Temporal index
        self._temporal.setdefault(bank_id, []).append({"id": doc_id, "timestamp": ts})

        # ChromaDB
        coll = self._get_collection(bank_id)
        if coll is not None:
            meta = {
                "context": (context or "")[:500],
                "timestamp": ts,
                "entities": json.dumps(entities[:10]),
                "bank": bank_id,
            }
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    lambda: coll.upsert(documents=[content], ids=[doc_id], metadatas=[meta]),
                )
            except Exception as e:
                logger.debug(f"[Hindsight] ChromaDB upsert: {e}")

    async def recall(
        self,
        bank_id: str,
        query: str,
        n: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Run 4 retrieval strategies in parallel, fuse with RRF, return top-n docs.
        bank_id='all' searches across every bank that has data.
        """
        # Determine which banks to search
        if bank_id == "all":
            banks = list(
                set(list(self._collections.keys()) + list(self._temporal.keys()))
            ) or list(self.ALL_BANKS)
        else:
            banks = [bank_id]

        all_id_lists: List[List[str]] = []
        doc_cache: Dict[str, Dict] = {}  # id → formatted result

        for bk in banks:
            # 1. Semantic via ChromaDB
            sem_ids: List[str] = []
            coll = self._get_collection(bk)
            if coll is not None:
                try:
                    count = coll.count()
                    if count > 0:
                        loop = asyncio.get_event_loop()
                        res = await loop.run_in_executor(
                            None,
                            lambda c=coll: c.query(
                                query_texts=[query],
                                n_results=min(n, c.count()),
                            ),
                        )
                        ids = res.get("ids", [[]])[0]
                        docs = res.get("documents", [[]])[0]
                        metas = res.get("metadatas", [[]])[0]
                        dists = res.get("distances", [[]])[0]
                        sem_ids = ids
                        for i, did in enumerate(ids):
                            sim = round(1 - (dists[i] / 2), 4) if dists else 0.5
                            doc_cache[did] = {
                                "id": did,
                                "type": bk,
                                "content": docs[i] if i < len(docs) else "",
                                "summary": (metas[i] or {}).get("context", "") if metas else "",
                                "tags": [],
                                "similarity": sim,
                                "timestamp": (metas[i] or {}).get("timestamp", "") if metas else "",
                            }
                except Exception:
                    pass
            all_id_lists.append(sem_ids)

            # 2. BM25 keyword
            kw_ids = self._bm25_search(bk, query, n)
            all_id_lists.append(kw_ids)
            for did in kw_ids:
                if did not in doc_cache:
                    doc_cache[did] = {"id": did, "type": bk, "content": "", "summary": "", "tags": [], "similarity": 0.3, "timestamp": ""}

            # 3. Entity/graph
            ent_ids = self._entity_search(bk, query, n)
            all_id_lists.append(ent_ids)
            for did in ent_ids:
                if did not in doc_cache:
                    doc_cache[did] = {"id": did, "type": bk, "content": "", "summary": "", "tags": [], "similarity": 0.2, "timestamp": ""}

            # 4. Temporal (most recent)
            tmp_ids = self._temporal_search(bk, n)
            all_id_lists.append(tmp_ids)
            for did in tmp_ids:
                if did not in doc_cache:
                    doc_cache[did] = {"id": did, "type": bk, "content": "", "summary": "", "tags": [], "similarity": 0.1, "timestamp": ""}

        if not any(all_id_lists):
            return []

        fused = _rrf(all_id_lists)[:n]
        return [doc_cache[did] for did in fused if did in doc_cache]

    async def reflect(self, bank_id: str, query: str) -> str:
        """
        Recall top memories, then ask Ollama to synthesize patterns and insights.
        This creates 'mental models' — the third biomimetic memory type.
        """
        memories = await self.recall(bank_id, query, n=8)
        if not memories:
            return "No memories found to reflect on."

        mem_text = "\n".join(
            f"- [{m.get('type', '?')}] {m.get('content', m.get('summary', ''))[:300]}"
            for m in memories
        )
        prompt = (
            f"You are ECHO's memory reflection engine.\n"
            f"Analyze these past memories related to: '{query}'\n\n"
            f"{mem_text}\n\n"
            "Synthesize 2-3 concise insights: patterns, contradictions, or actionable knowledge. "
            "Be direct and specific."
        )
        try:
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "http://localhost:11434/api/chat",
                    json={
                        "model": "llama3.2:3b",
                        "messages": [{"role": "user", "content": prompt}],
                        "stream": False,
                        "options": {"temperature": 0.4, "num_predict": 512},
                    },
                )
                if resp.status_code == 200:
                    insight = resp.json().get("message", {}).get("content", "").strip()
                    # Store the reflection itself as a mental model
                    await self.retain(
                        "mental_models",
                        content=insight,
                        context=f"Reflection on: {query}",
                    )
                    return insight
        except Exception as e:
            logger.warning(f"[Hindsight] Reflect call failed: {e}")

        return f"Recalled {len(memories)} memories for '{query}'. Reflection engine offline."
