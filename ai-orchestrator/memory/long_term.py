import time
import numpy as np
import faiss
from typing import Optional
from memory.persistence import MemoryPersistence


class LongTermMemory:
    def __init__(self, dim: int = 1024):
        self.dim = dim
        self.persistence = MemoryPersistence(dim)
        self.index = self.persistence.index
        # Load existing records from SQLite into RAM for fast access
        self.records = []
        rows = self.persistence.load_all()
        for row in rows:
             self.records.append({
                "text": row[0],
                "importance": row[1],
                "timestamp": row[2]
            })
        print(f"--- Loaded {len(self.records)} memories from persistence ---")

    def add(self, embedding: np.ndarray, text: str, importance: float) -> None:
        t = time.time()
        self.persistence.save_memory(embedding, text, importance, t)
        # Keep RAM copy in sync
        self.records.append({
            "text": text,
            "importance": importance,
            "timestamp": t,
        })

    def query(
        self,
        embedding: np.ndarray,
        k: int = 5,
        decay_obj: Optional["MemoryDecay"] = None,
    ) -> list[str]:
        if self.index.ntotal == 0:
            return []
        arr = np.array(embedding, dtype=np.float32).reshape(1, -1)
        distances, ids = self.index.search(arr, k)
        results = []
        for i in ids[0]:
            if i < 0:
                continue
            rec = self.records[i]
            score = rec["importance"]
            if decay_obj is not None:
                score *= decay_obj.decay_factor(rec["timestamp"])
            # Only return relevant/important memories
            if score > 0.15:
                results.append(rec["text"])
        return results
