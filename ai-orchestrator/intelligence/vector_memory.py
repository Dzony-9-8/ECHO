import os
import numpy as np
import json

class VectorMemory:

    def __init__(self, embedder=None, path="intelligence/vector_index"):
        self.embedder = embedder
        self.path = path
        os.makedirs(path, exist_ok=True)
        self.vectors = []
        self.metadata = []
        self._load()

    def add(self, text, meta):
        if not self.embedder:
            return False
            
        vector = self.embedder.embed(text)
        self.vectors.append(vector)
        self.metadata.append(meta)
        self._save()
        return True

    def search(self, query, top_k=5):
        if not self.embedder or not self.vectors:
            return []
            
        query_vec = self.embedder.embed(query)
        scores = []

        for i, vec in enumerate(self.vectors):
            # Simple dot product for cosine similarity if normalized
            score = np.dot(query_vec, vec)
            scores.append((float(score), self.metadata[i]))

        scores.sort(key=lambda x: x[0], reverse=True)
        return scores[:top_k]

    def _save(self):
        # In a real system, we'd use FAISS or similar, but for ECHO, we'll start with numpy/json
        np.save(os.path.join(self.path, "vectors.npy"), np.array(self.vectors))
        with open(os.path.join(self.path, "metadata.json"), "w") as f:
            json.dump(self.metadata, f, indent=2)

    def _load(self):
        vec_path = os.path.join(self.path, "vectors.npy")
        meta_path = os.path.join(self.path, "metadata.json")
        
        if os.path.exists(vec_path):
            self.vectors = np.load(vec_path).tolist()
        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                self.metadata = json.load(f)
