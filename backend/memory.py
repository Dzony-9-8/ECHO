import chromadb
from chromadb.utils import embedding_functions
import os
import uuid
from typing import List

class MemoryManager:
    def __init__(self, persistence_path: str = "D:/AI/Yui/memory_db"):
        self.client = chromadb.PersistentClient(path=persistence_path)
        self.collection = self.client.get_or_create_collection(name="echo_memory")
        # Default embedding function is usually sufficient (Sentence Transformers)

    def remember(self, text: str, meta: dict = None):
        """Stores a memory."""
        self.collection.add(
            documents=[text],
            metadatas=[meta] if meta else [{"type": "conversation"}],
            ids=[str(uuid.uuid4())]
        )

    def recall(self, query: str, n_results: int = 5) -> List[str]:
        """Retrieves relevant memories."""
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        if results['documents']:
            return results['documents'][0]
        return []

    def clear_memory(self):
        """Wipes the memory."""
        self.client.delete_collection("echo_memory")
        self.collection = self.client.get_or_create_collection(name="echo_memory")
