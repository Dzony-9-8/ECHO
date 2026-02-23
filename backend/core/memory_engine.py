from sqlalchemy.orm import Session
from ..database.models import SessionLocal, Conversation

class MemoryEngine:
    def __init__(self):
        # The long-term vector database could be attached here later (e.g. Chroma/Faiss handler)
        pass

    def get_session(self) -> Session:
        return SessionLocal()

    def add_message(self, session_id: str, role: str, content: str, metadata: dict = None):
        with self.get_session() as db:
            msg = Conversation(
                session_id=session_id,
                role=role,
                content=content,
                metadata=metadata or {}
            )
            db.add(msg)
            db.commit()

    def get_conversation_history(self, session_id: str, limit: int = 50):
        with self.get_session() as db:
            messages = db.query(Conversation).filter(
                Conversation.session_id == session_id
            ).order_by(Conversation.timestamp.asc()).limit(limit).all()
            
            return [{"role": msg.role, "content": msg.content} for msg in messages]

    def clear_session(self, session_id: str):
        with self.get_session() as db:
            db.query(Conversation).filter(Conversation.session_id == session_id).delete()
            db.commit()

memory_engine = MemoryEngine()
