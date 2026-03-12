"""
ECHO V4 — Vector Store (backend/app/memory/vector_store.py)
ChromaDB wrapper for RAG retrieval. Storage root respects ECHO_STORAGE_ROOT.
"""
import os
from ..core.config import ENABLE_RAG, ECHO_STORAGE_ROOT, ECHO_MODE, VECTOR_DB_PATH


def _resolve_vector_path() -> str:
    if ECHO_MODE == "portable":
        return os.path.join(ECHO_STORAGE_ROOT, "vector")
    return VECTOR_DB_PATH


class VectorStore:
    def __init__(self):
        self.enabled    = ENABLE_RAG
        self.client     = None
        self.collection = None
        self.model      = None

        if self.enabled:
            try:
                import chromadb
                from sentence_transformers import SentenceTransformer
                path = _resolve_vector_path()
                os.makedirs(path, exist_ok=True)
                self.client     = chromadb.PersistentClient(path=path)
                self.collection = self.client.get_or_create_collection("echo_knowledge")
                self.model      = SentenceTransformer("all-MiniLM-L6-v2")
            except Exception as e:
                print(f"[VectorStore] Init failed — RAG disabled: {e}")
                self.enabled = False

    def ingest(self, text: str, doc_id: str = None, metadata: dict = None):
        if not self.enabled:
            return
        import uuid
        embedding = self.model.encode([text])[0].tolist()
        self.collection.add(
            ids=[doc_id or str(uuid.uuid4())],
            embeddings=[embedding],
            documents=[text],
            metadatas=[metadata or {}]
        )

    def retrieve(self, query: str, n_results: int = 3):
        if not self.enabled or not self.collection:
            return []
        embedding = self.model.encode([query])[0].tolist()
        results = self.collection.query(query_embeddings=[embedding], n_results=n_results)
        return results.get("documents", [[]])[0]


vector_store = VectorStore()
