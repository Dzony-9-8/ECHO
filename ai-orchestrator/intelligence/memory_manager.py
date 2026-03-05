import sqlite3
from datetime import datetime, timezone
import os

class MemoryManager:

    def __init__(self, db_path="intelligence/memory.db"):
        # Ensure the directory exists
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
            
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row  # Enable dictionary-like access
        self._create_tables()

    def _create_tables(self):
        cursor = self.conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS routing_history (
            id INTEGER PRIMARY KEY,
            task_type TEXT,
            complexity REAL,
            confidence REAL,
            selected_model TEXT,
            success INTEGER,
            timestamp TEXT
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS failure_patterns (
            id INTEGER PRIMARY KEY,
            task_type TEXT,
            error_signature TEXT,
            frequency INTEGER
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS cost_tracking (
            id INTEGER PRIMARY KEY,
            model TEXT,
            tokens INTEGER,
            cost REAL,
            timestamp TEXT
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS performance_metrics (
            id INTEGER PRIMARY KEY,
            cpu_percent REAL,
            memory_percent REAL,
            gpu_found INTEGER,
            timestamp TEXT
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS agent_memory (
            id INTEGER PRIMARY KEY,
            task_signature TEXT,
            agent_used TEXT,
            confidence REAL,
            success INTEGER,
            failure_type TEXT,
            time_ms INTEGER,
            tags TEXT,
            timestamp TEXT
        )
        """)

        self.conn.commit()

    def record_routing(self, task_type, complexity, confidence, model, success):
        cursor = self.conn.cursor()
        cursor.execute("""
        INSERT INTO routing_history
        (task_type, complexity, confidence, selected_model, success, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            task_type,
            complexity,
            confidence,
            model,
            int(success) if success is not None else -1, # -1 for pending
            datetime.now(timezone.utc).isoformat()
        ))
        self.conn.commit()
        return cursor.lastrowid

    def update_routing_success(self, routing_id, success):
        cursor = self.conn.cursor()
        cursor.execute("""
        UPDATE routing_history
        SET success = ?
        WHERE id = ?
        """, (int(success), routing_id))
        self.conn.commit()

    def record_cost(self, model, tokens, cost):
        cursor = self.conn.cursor()
        cursor.execute("""
        INSERT INTO cost_tracking
        (model, tokens, cost, timestamp)
        VALUES (?, ?, ?, ?)
        """, (
            model,
            tokens,
            cost,
            datetime.now(timezone.utc).isoformat()
        ))
        self.conn.commit()

    def record_performance(self, cpu, memory, gpu_found):
        cursor = self.conn.cursor()
        cursor.execute("""
        INSERT INTO performance_metrics
        (cpu_percent, memory_percent, gpu_found, timestamp)
        VALUES (?, ?, ?, ?)
        """, (
            cpu,
            memory,
            int(gpu_found),
            datetime.now(timezone.utc).isoformat()
        ))
        self.conn.commit()

    def record_agent_memory(self, intel: dict):
        cursor = self.conn.cursor()
        import json
        cursor.execute("""
        INSERT INTO agent_memory
        (task_signature, agent_used, confidence, success, failure_type, time_ms, tags, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            intel["task_signature"],
            intel["agent_used"],
            intel["confidence"],
            int(intel["success"]),
            intel.get("failure_type"),
            intel.get("time_ms", 0),
            json.dumps(intel.get("tags", [])),
            datetime.now(timezone.utc).isoformat()
        ))
        self.conn.commit()

    def get_recent_routing_history(self, limit=20):
        cursor = self.conn.cursor()
        cursor.execute("""
        SELECT task_type, complexity, confidence, selected_model, success
        FROM routing_history
        ORDER BY timestamp DESC
        LIMIT ?
        """, (limit,))
        return cursor.fetchall()
