import os
import numpy as np

class EmbeddingIndex:
    def __init__(self, embedder):
        self.embedder = embedder
        self.vectors = []
        self.metadata = []

    def index_files(self, file_map):
        """Indexes files by generating embeddings for their content."""
        print(f"--- Developer Profile: Semantic Indexing {len(file_map)} files ---")
        for file_path in file_map:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # Use the provided embedder
                vector = self.embedder.embed(content)

                self.vectors.append(vector)
                self.metadata.append(file_path)
            except Exception as e:
                print(f"--- Warning: Failed to embed {file_path}: {e} ---")

    def search(self, query, top_k=5):
        """Searches for files matching the semantic meaning of the query."""
        if not self.vectors:
            return []
            
        query_vec = self.embedder.embed(query)
        similarities = []

        for i, vec in enumerate(self.vectors):
            # dot product similarity (standard for BGE embeddings)
            sim = np.dot(query_vec, vec)
            similarities.append((float(sim), self.metadata[i]))

        # Sort by similarity score descending
        similarities.sort(key=lambda x: x[0], reverse=True)
        return similarities[:top_k]
