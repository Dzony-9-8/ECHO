"""
ECHO V4 — SQLite Memory (backend/app/memory/sqlite_memory.py)
Provides structured access to conversation history stored in SQLite.
"""
from .schemas import SessionLocal, Conversation


class SQLiteMemory:
    def get_session(self):
        return SessionLocal()

    def add_message(self, session_id: str, role: str, content: str, metadata: dict = None):
        with self.get_session() as db:
            msg = Conversation(
                session_id=session_id,
                role=role,
                content=content,
                metadata_json=None
            )
            if metadata:
                import json
                msg.metadata_json = json.dumps(metadata)
            db.add(msg)
            db.commit()

    def get_history(self, session_id: str, limit: int = 50):
        with self.get_session() as db:
            messages = (
                db.query(Conversation)
                .filter(Conversation.session_id == session_id)
                .order_by(Conversation.timestamp.asc())
                .limit(limit)
                .all()
            )
            return [{"role": m.role, "content": m.content} for m in messages]

    def clear_session(self, session_id: str):
        with self.get_session() as db:
            db.query(Conversation).filter(Conversation.session_id == session_id).delete()
            db.commit()


sqlite_memory = SQLiteMemory()
