"""
ECHO V4 — Database Schemas (backend/app/memory/schemas.py)
Consolidated SQLAlchemy models (merged from database/models.py).
"""
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import json
from ..core.config import DATABASE_URL

engine       = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()


class Conversation(Base):
    __tablename__ = "conversations"

    id           = Column(Integer, primary_key=True, index=True)
    session_id   = Column(String, index=True)
    role         = Column(String)
    content      = Column(String)
    timestamp    = Column(DateTime, default=datetime.utcnow)
    metadata_json = Column(String, nullable=True)

    @property
    def meta(self):
        return json.loads(self.metadata_json) if self.metadata_json else {}

    @meta.setter
    def meta(self, value):
        self.metadata_json = json.dumps(value) if value else None


class WeatherCache(Base):
    __tablename__ = "weather_cache"

    id        = Column(Integer, primary_key=True, index=True)
    location  = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    json_data = Column(String)


class UserProfile(Base):
    __tablename__ = "user_profile"

    id               = Column(Integer, primary_key=True, index=True)
    default_location = Column(String, nullable=True)


# Create tables on first import
Base.metadata.create_all(bind=engine)
