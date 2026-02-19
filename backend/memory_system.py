# memory_system.py
import sqlite3
from datetime import datetime
import json
import os

class ConversationMemory:
    def __init__(self, db_path="assistant_memory.db"):
        self.db_path = db_path
        # Ensure database is created in the same directory if relative path
        if not os.path.isabs(db_path) and not ":memory:" in db_path:
             self.db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), db_path)

        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.create_tables()
        
    def create_tables(self):
        """Create necessary database tables"""
        cursor = self.conn.cursor()
        
        # Main conversations table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                session_id TEXT,
                user_message TEXT NOT NULL,
                detected_emotion TEXT,
                emotion_score REAL,
                ai_response TEXT NOT NULL,
                context_summary TEXT,
                user_feedback TEXT
            )
        ''')
        
        # User profile table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                preference_key TEXT,
                preference_value TEXT
            )
        ''')
        
        # Emotional patterns table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS emotional_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                hour INTEGER,
                emotion TEXT,
                count INTEGER
            )
        ''')

        # Conversation Insights table (NEW)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS conversation_insights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                emotional_summary TEXT NOT NULL,
                intent_summary TEXT NOT NULL,
                notable_patterns TEXT, -- JSON array
                confidence_level TEXT CHECK (
                    confidence_level IN ('low', 'medium', 'high')
                )
            )
        ''')

        # Confidence Trends table (NEW)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS confidence_trends (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                confidence_average REAL
            )
        ''')

        # Create indices for performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_insights_session ON conversation_insights(session_id)')

        self.conn.commit()
        
    def store_interaction(self, user_msg, emotion_data, ai_response, session_id="default", feedback=""):
        """Store a conversation interaction"""
        cursor = self.conn.cursor()
        
        # Create context summary
        recent = self.get_recent_context(3)
        context_parts = []
        for row in recent:
            context_parts.append(f"User: {row[2][:50]}... | AI: {row[4][:50]}...")
        context_summary = " | ".join(context_parts) if context_parts else "New conversation"
        
        cursor.execute('''
            INSERT INTO conversations 
            (timestamp, session_id, user_message, detected_emotion, emotion_score, 
             ai_response, context_summary, user_feedback)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            datetime.now().isoformat(),
            session_id,
            user_msg,
            emotion_data.get('emotion', 'neutral'),
            emotion_data.get('scores', {}).get('compound', 0.0),
            ai_response,
            context_summary,
            feedback
        ))
        
        # Update emotional patterns
        self._update_emotional_patterns(emotion_data.get('emotion', 'neutral'))
        
        self.conn.commit()
        return cursor.lastrowid
    
    def get_recent_context(self, limit=5, session_id=None):
        """Get recent conversation context"""
        cursor = self.conn.cursor()
        
        if session_id:
            cursor.execute('''
                SELECT * FROM conversations 
                WHERE session_id = ?
                ORDER BY id DESC LIMIT ?
            ''', (session_id, limit))
        else:
            cursor.execute('''
                SELECT * FROM conversations 
                ORDER BY id DESC LIMIT ?
            ''', (limit,))
        
        # Return in chronological order for context window (oldest first)
        results = cursor.fetchall()
        return results[::-1] # Reverse to get oldest->newest
    
    def get_conversation_history(self, days=7):
        """Get conversation history for specified days"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM conversations 
            ORDER BY timestamp DESC
        ''')
        return cursor.fetchall()
    
    def get_emotional_stats(self):
        """Get emotional statistics"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT detected_emotion, COUNT(*) as count 
            FROM conversations 
            GROUP BY detected_emotion 
            ORDER BY count DESC
        ''')
        return cursor.fetchall()
    
    def get_user_preferences(self):
        """Get user preferences"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT preference_key, preference_value FROM user_profile')
        return {row[0]: row[1] for row in cursor.fetchall()}
    
    def set_user_preference(self, key, value):
        """Set a user preference"""
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO user_profile (timestamp, preference_key, preference_value)
            VALUES (?, ?, ?)
        ''', (datetime.now().isoformat(), key, value))
        self.conn.commit()
    
    def _update_emotional_patterns(self, emotion):
        """Update emotional patterns for analytics"""
        cursor = self.conn.cursor()
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        hour = now.hour
        
        cursor.execute('''
            SELECT * FROM emotional_patterns 
            WHERE date = ? AND hour = ? AND emotion = ?
        ''', (date_str, hour, emotion))
        
        if cursor.fetchone():
            cursor.execute('''
                UPDATE emotional_patterns 
                SET count = count + 1 
                WHERE date = ? AND hour = ? AND emotion = ?
            ''', (date_str, hour, emotion))
        else:
            cursor.execute('''
                INSERT INTO emotional_patterns (date, hour, emotion, count)
                VALUES (?, ?, ?, 1)
            ''', (date_str, hour, emotion))
        
        self.conn.commit()
    
    def clear_conversation_history(self, days_old=None):
        """Clear conversation history"""
        cursor = self.conn.cursor()
        if days_old:
            # Calculate cutoff date
            cutoff = datetime.now().timestamp() - (days_old * 24 * 60 * 60)
            cursor.execute('DELETE FROM conversations WHERE timestamp < ?', 
                          (datetime.fromtimestamp(cutoff).isoformat(),))
        else:
            cursor.execute('DELETE FROM conversations')
        
        self.conn.commit()
        return cursor.rowcount

    def truncate_session(self, session_id, keep_count):
        """
        Deletes all messages in a session after the first 'keep_count' exchanges.
        Used when editing a message to start a new branch.
        """
        cursor = self.conn.cursor()
        # Find the IDs to keep
        cursor.execute('''
            SELECT id FROM conversations 
            WHERE session_id = ? 
            ORDER BY id ASC LIMIT ?
        ''', (session_id, keep_count))
        rows = cursor.fetchall()
        ids_to_keep = [r[0] for r in rows]
        
        if ids_to_keep:
            cursor.execute(f'''
                DELETE FROM conversations 
                WHERE session_id = ? AND id NOT IN ({','.join(map(str, ids_to_keep))})
            ''', (session_id,))
        else:
            cursor.execute('DELETE FROM conversations WHERE session_id = ?', (session_id,))
            
        self.conn.commit()
        return cursor.rowcount

    def get_session_message_count(self, session_id):
        """Get total number of messages in a session"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM conversations WHERE session_id = ?', (session_id,))
        return cursor.fetchone()[0]
    
    def backup_memory(self, backup_path="memory_backup.json"):
        """Backup memory to JSON file"""
        cursor = self.conn.cursor()
        
        # Get all conversations
        cursor.execute('SELECT * FROM conversations ORDER BY timestamp')
        conversations = cursor.fetchall()
        
        # Get user preferences
        preferences = self.get_user_preferences()
        
        # Get emotional stats
        emotional_stats = self.get_emotional_stats()
        
        backup_data = {
            "backup_timestamp": datetime.now().isoformat(),
            "total_conversations": len(conversations),
            "conversations": [
                {
                    "id": conv[0],
                    "timestamp": conv[1],
                    "session_id": conv[2],
                    "user_message": conv[3],
                    "detected_emotion": conv[4],
                    "ai_response": conv[6]
                }
                for conv in conversations
            ],
            "user_preferences": preferences,
            "emotional_stats": [
                {"emotion": stat[0], "count": stat[1]}
                for stat in emotional_stats
            ]
        }
        
        with open(backup_path, 'w') as f:
            json.dump(backup_data, f, indent=2)
        
        return backup_path
    
    def store_insight(self, session_id, emotional_summary, intent_summary, notable_patterns, confidence_level):
        """Store a session insight"""
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO conversation_insights 
            (session_id, timestamp, emotional_summary, intent_summary, notable_patterns, confidence_level)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            session_id,
            datetime.now().isoformat(),
            emotional_summary,
            intent_summary,
            json.dumps(notable_patterns), # Store list as JSON string
            confidence_level
        ))
        self.conn.commit()
    
    def get_latest_insight(self, session_id):
        """Get the latest insight for a session"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM conversation_insights 
            WHERE session_id = ?
            ORDER BY timestamp DESC LIMIT 1
        ''', (session_id,))
        row = cursor.fetchone()
        
        if row:
            return {
                "id": row[0],
                "session_id": row[1],
                "timestamp": row[2],
                "emotional_summary": row[3],
                "intent_summary": row[4],
                "notable_patterns": json.loads(row[5]),
                "confidence_level": row[6]
            }
        return None

    def __del__(self):
        """Cleanup connection when object is destroyed"""
        if hasattr(self, 'conn'):
            self.conn.close()
