import sqlite3
import json
import os
import faiss
import numpy as np

DB_PATH = "memory/memory.db"
INDEX_PATH = "memory/faiss.index"


class MemoryPersistence:

    def __init__(self, dim=1024):
        # Path relative to the script execution directory (ai-orchestrator/)
        os.makedirs("memory", exist_ok=True)

        self.conn = sqlite3.connect(DB_PATH)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT,
                importance REAL,
                timestamp REAL
            )
        """)

        if os.path.exists(INDEX_PATH):
            print(f"--- Loading FAISS index from {INDEX_PATH} ---")
            self.index = faiss.read_index(INDEX_PATH)
        else:
            print(f"--- Creating new FAISS index ({dim} dimensions) ---")
            self.index = faiss.IndexFlatL2(dim)

    def save_memory(self, embedding, text, importance, timestamp):
        # Ensure embedding is float32 and correct shape
        arr = np.array(embedding, dtype=np.float32).reshape(1, -1)
        self.index.add(arr)
        
        self.conn.execute(
            "INSERT INTO memories (text, importance, timestamp) VALUES (?, ?, ?)",
            (text, importance, timestamp)
        )
        self.conn.commit()
        faiss.write_index(self.index, INDEX_PATH)

    def load_all(self):
        cursor = self.conn.execute("SELECT text, importance, timestamp FROM memories")
        return cursor.fetchall()
