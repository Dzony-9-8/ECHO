import os
from ..config import VECTOR_DB_PATH, ENABLE_RAG

class RAGEngine:
    def __init__(self):
        self.enabled = ENABLE_RAG
        self.client = None
        self.collection = None
        self.model = None
        
        if self.enabled:
            try:
                import chromadb
                from sentence_transformers import SentenceTransformer
                os.makedirs(VECTOR_DB_PATH, exist_ok=True)
                self.client = chromadb.PersistentClient(path=VECTOR_DB_PATH)
                self.collection = self.client.get_or_create_collection("echo_knowledge")
                self.model = SentenceTransformer('all-MiniLM-L6-v2')
            except Exception as e:
                print(f"Failed to initialize RAG: {e}")
                self.enabled = False

    def ingest_text(self, text: str, metadata: dict = None):
        if not self.enabled: return
        chunks = [text[i:i+1000] for i in range(0, len(text), 1000)]
        if not chunks: return
        embeddings = self.model.encode(chunks).tolist()
        ids = [f"chunk_{os.urandom(4).hex()}" for _ in chunks]
        metadatas = [metadata or {} for _ in chunks]
        
        self.collection.add(
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )

    def retrieve(self, query: str, top_k: int = 3):
        if not self.enabled: return []
        query_embedding = self.model.encode([query]).tolist()
        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=top_k
        )
        return results.get("documents", [[]])[0]

rag_engine = RAGEngine()
