"""Embedding engine — local BGE-Large via sentence-transformers."""
from sentence_transformers import SentenceTransformer
import numpy as np


class EmbeddingModel:
    """BAAI/bge-large-en — 1024 dimensions."""

    def __init__(self, model_name: str = "BAAI/bge-large-en-v1.5"):
        self.model = SentenceTransformer(model_name)
        self._dim = self.model.get_sentence_embedding_dimension()

    @property
    def dim(self) -> int:
        return self._dim

    def embed(self, text: str) -> np.ndarray:
        out = self.model.encode([text], normalize_embeddings=False)
        return np.array(out[0], dtype=np.float32)
