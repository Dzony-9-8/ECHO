"""
ECHO V4 — RAG Service (backend/app/services/rag_service.py)
Façade for ingest + retrieval using the V4 VectorStore.
"""
from ..memory.vector_store import vector_store
from ..core.logging import logger


class RAGService:
    def ingest(self, text: str, doc_id: str = None, metadata: dict = None):
        if not vector_store.enabled:
            logger.warning("[RAGService] RAG disabled — skipping ingest.")
            return
        logger.info(f"[RAGService] Ingesting document: {doc_id or 'auto-id'}")
        vector_store.ingest(text, doc_id=doc_id, metadata=metadata)

    def retrieve(self, query: str, n_results: int = 3):
        if not vector_store.enabled:
            return []
        chunks = vector_store.retrieve(query, n_results=n_results)
        logger.info(f"[RAGService] Retrieved {len(chunks)} chunk(s) for query.")
        return chunks


rag_service = RAGService()
