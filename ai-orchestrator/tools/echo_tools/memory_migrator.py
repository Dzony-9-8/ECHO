import sqlite3
import os
import sys
from pathlib import Path

# Add project root to sys.path to allow imports from other modules
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

from intelligence.interface import IntelligenceLayer
from memory.embeddings import EmbeddingModel

def migrate_sqlite(db_path: str, intel: IntelligenceLayer):
    if not os.path.exists(db_path):
        print(f"[SKIP] Legacy SQLite not found: {db_path}")
        return

    print(f"[START] Migrating legacy SQLite: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Migrate insights
    try:
        cursor.execute("SELECT * FROM insights")
        insights = cursor.fetchall()
        for row in insights:
            text = f"Session Insight [{row['session_id']}]: {row['intent_summary']} - {row['notable_patterns']}"
            meta = {
                "source": "legacy_echo_insight",
                "emotion": row["emotional_summary"],
                "confidence": row["confidence_level"],
                "timestamp": row["timestamp"],
                "tags": ["insight", "legacy"]
            }
            intel.store_research_conclusion(text, meta)
        print(f"  -> Migrated {len(insights)} insights to VectorMemory")
    except Exception as e:
        print(f"  -> No insights table found or error: {e}")

    # 2. Migrate preferences
    try:
        cursor.execute("SELECT * FROM preferences")
        prefs = cursor.fetchall()
        for row in prefs:
            text = f"User Preference: {row['key']} = {row['value']}"
            meta = {
                "source": "legacy_echo_preference",
                "tags": ["preference", "legacy"]
            }
            intel.store_research_conclusion(text, meta)
        print(f"  -> Migrated {len(prefs)} preference rules to VectorMemory")
    except Exception as e:
        print(f"  -> No preferences table found or error: {e}")

    conn.close()


def migrate_chromadb(chroma_path: str, intel: IntelligenceLayer):
    if not os.path.exists(chroma_path):
        print(f"[SKIP] Legacy ChromaDB not found: {chroma_path}")
        return

    print(f"[START] Migrating legacy ChromaDB: {chroma_path}")
    
    try:
        import chromadb
        client = chromadb.PersistentClient(path=chroma_path)
        collection = client.get_collection("echo_memory")
        data = collection.get()
        
        docs = data.get("documents", [])
        metas = data.get("metadatas", [])
        
        for i, doc in enumerate(docs):
            meta = metas[i] if metas and i < len(metas) else {}
            meta["source"] = "legacy_echo_chroma"
            meta["tags"] = meta.get("tags", []) + ["search", "legacy"]
            
            # Use IntelligenceLayer to index it semantically
            intel.store_research_conclusion(doc, meta)
            
        print(f"  -> Migrated {len(docs)} documents to VectorMemory")
    except ImportError:
        print("  -> chromadb is not installed. Please 'pip install chromadb' to migrate.")
    except Exception as e:
        print(f"  -> Error migrating ChromaDB: {e}")


def run_migration():
    print("=== ECHO Unified Memory Migrator ===")
    
    # Init Embeddings and Intelligence Layer
    print("Loading embedding model (this may take a moment)...")
    embed_model = EmbeddingModel()
    intel = IntelligenceLayer(embed_model)
    
    # Paths configured for the D:\AI\ECHO setup
    legacy_sqlite = r"D:\AI\ECHO\backend\assistant_memory.db"
    legacy_chroma = r"D:\AI\ECHO\backend\memory_db"
    
    migrate_sqlite(legacy_sqlite, intel)
    migrate_chromadb(legacy_chroma, intel)
    
    print("=== Migration Complete ===")

if __name__ == "__main__":
    run_migration()
