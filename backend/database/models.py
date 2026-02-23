from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import json
from ..config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    role = Column(String)  # "user" or "assistant"
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Metadata as JSON string
    metadata_json = Column(String, nullable=True)

    @property
    def get_metadata(self):
        if self.metadata_json:
            return json.loads(self.metadata_json)
        return {}

    @get_metadata.setter
    def get_metadata(self, value):
        if value is not None:
            self.metadata_json = json.dumps(value)
        else:
            self.metadata_json = None

class WeatherCache(Base):
    __tablename__ = "weather_cache"

    id = Column(Integer, primary_key=True, index=True)
    location = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    json_data = Column(String)

class UserProfile(Base):
    __tablename__ = "user_profile"

    id = Column(Integer, primary_key=True, index=True)
    default_location = Column(String, nullable=True)

# Initialize the db
Base.metadata.create_all(bind=engine)
