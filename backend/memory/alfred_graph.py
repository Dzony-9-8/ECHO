"""
Alfred Knowledge Graph — SQLite-backed semantic entity graph.
Based on wagner-niklas/Alfred knowledge graph architecture.

Stores labeled nodes with JSON properties and typed relationships between them.
Provides natural-language query via keyword matching over node names and labels.
No external graph DB (Neo4j) required — runs embedded via SQLite.
"""
import json
import logging
import re
import sqlite3
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("echo.alfred")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS nodes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT    NOT NULL,
    name        TEXT    NOT NULL DEFAULT '',
    properties  TEXT    NOT NULL DEFAULT '{}',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(label, name)
);

CREATE TABLE IF NOT EXISTS relationships (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    node_a      TEXT    NOT NULL,
    node_b      TEXT    NOT NULL,
    relation    TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(node_a, node_b, relation)
);

CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(label);
CREATE INDEX IF NOT EXISTS idx_nodes_name  ON nodes(name);
CREATE INDEX IF NOT EXISTS idx_rel_a       ON relationships(node_a);
CREATE INDEX IF NOT EXISTS idx_rel_b       ON relationships(node_b);
CREATE INDEX IF NOT EXISTS idx_rel_type    ON relationships(relation);
"""


def _node_name(properties: dict, label: str) -> str:
    """Pick the best 'name' key from properties for deduplication."""
    for key in ("name", "id", "content", "title"):
        val = properties.get(key)
        if val:
            return str(val)[:120]
    return label


class AlfredKnowledgeGraph:
    """
    Lightweight knowledge graph stored in SQLite.

    Graph shape:
      NODES        — (label, name, {json properties})
      RELATIONSHIPS — (node_a_name, node_b_name, relation_type)

    Example:
        graph.add_node("Topic", {"name": "Machine Learning", "domain": "AI"})
        graph.add_node("Topic", {"name": "Neural Networks", "domain": "AI"})
        graph.add_relationship("Machine Learning", "Neural Networks", "includes")
        graph.query_graph("neural network topics")
    """

    def __init__(self, connection_string: str = ""):
        # Accept a file path or ignore neo4j:// URIs (fall back to default path)
        if connection_string and not connection_string.startswith("neo4j"):
            self._db_path = connection_string
        else:
            default_dir = Path(__file__).resolve().parent.parent / "chroma_db"
            self._db_path = str(default_dir / "alfred_graph.db")

        self._lock = threading.Lock()
        self._conn: Optional[sqlite3.Connection] = None
        self._init_db()

    # ── Internal ───────────────────────────────────────────────────────────────

    def _connect(self) -> Optional[sqlite3.Connection]:
        if self._conn is not None:
            return self._conn
        try:
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(self._db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")   # concurrent read/write
            conn.execute("PRAGMA synchronous=NORMAL")
            self._conn = conn
            return conn
        except Exception as e:
            logger.warning(f"[Alfred] DB connect failed: {e}")
            return None

    def _init_db(self):
        conn = self._connect()
        if conn is None:
            return
        with self._lock:
            try:
                conn.executescript(_SCHEMA)
                conn.commit()
            except Exception as e:
                logger.warning(f"[Alfred] Schema init failed: {e}")

    # ── Public API ─────────────────────────────────────────────────────────────

    def add_node(self, label: str, properties: dict):
        """
        Upsert a node.  On conflict (same label + name) the properties are updated.
        """
        conn = self._connect()
        if conn is None:
            return
        name = _node_name(properties, label)
        props_json = json.dumps(properties, ensure_ascii=False)
        with self._lock:
            try:
                conn.execute(
                    """
                    INSERT INTO nodes (label, name, properties)
                    VALUES (?, ?, ?)
                    ON CONFLICT(label, name)
                    DO UPDATE SET properties = excluded.properties
                    """,
                    (label, name, props_json),
                )
                conn.commit()
            except Exception as e:
                logger.debug(f"[Alfred] add_node '{label}/{name}': {e}")

    def add_relationship(self, node_a: str, node_b: str, relation: str):
        """Upsert a directional relationship between two node names."""
        conn = self._connect()
        if conn is None:
            return
        with self._lock:
            try:
                conn.execute(
                    "INSERT OR IGNORE INTO relationships (node_a, node_b, relation) VALUES (?, ?, ?)",
                    (node_a, node_b, relation),
                )
                conn.commit()
            except Exception as e:
                logger.debug(f"[Alfred] add_relationship '{node_a}'→'{node_b}': {e}")

    def query_graph(self, nl_query: str) -> Dict[str, Any]:
        """
        Natural-language graph query via keyword matching.

        Extracts words > 2 chars from nl_query, searches node names/labels
        and relationship types, returns matching nodes + relationships.
        """
        conn = self._connect()
        if conn is None:
            return {"nodes": [], "relationships": [], "query": nl_query}

        terms = list({t.lower() for t in re.findall(r'\b\w{3,}\b', nl_query)})[:6]
        if not terms:
            return {"nodes": [], "relationships": [], "query": nl_query}

        matched_nodes: List[Dict] = []
        matched_rels:  List[Dict] = []
        seen_nodes: set = set()
        seen_rels:  set = set()

        with self._lock:
            try:
                for term in terms:
                    pat = f"%{term}%"
                    rows = conn.execute(
                        "SELECT label, name, properties FROM nodes "
                        "WHERE LOWER(name) LIKE ? OR LOWER(label) LIKE ? LIMIT 10",
                        (pat, pat),
                    ).fetchall()
                    for row in rows:
                        key = (row["label"], row["name"])
                        if key not in seen_nodes:
                            seen_nodes.add(key)
                            try:
                                props = json.loads(row["properties"] or "{}")
                            except Exception:
                                props = {}
                            matched_nodes.append({
                                "label": row["label"],
                                "name": row["name"],
                                "properties": props,
                            })

                    rows = conn.execute(
                        "SELECT node_a, node_b, relation FROM relationships "
                        "WHERE LOWER(relation) LIKE ? "
                        "   OR LOWER(node_a)   LIKE ? "
                        "   OR LOWER(node_b)   LIKE ? LIMIT 10",
                        (pat, pat, pat),
                    ).fetchall()
                    for row in rows:
                        key = (row["node_a"], row["node_b"], row["relation"])
                        if key not in seen_rels:
                            seen_rels.add(key)
                            matched_rels.append({
                                "from": row["node_a"],
                                "to":   row["node_b"],
                                "type": row["relation"],
                            })
            except Exception as e:
                logger.warning(f"[Alfred] query_graph failed: {e}")

        return {
            "nodes":         matched_nodes[:20],
            "relationships": matched_rels[:20],
            "query":         nl_query,
        }

    def get_neighbors(self, node_name: str) -> List[Dict[str, Any]]:
        """Return all relationships touching a given node name."""
        conn = self._connect()
        if conn is None:
            return []
        with self._lock:
            try:
                rows = conn.execute(
                    "SELECT node_a, node_b, relation FROM relationships "
                    "WHERE node_a = ? OR node_b = ? LIMIT 50",
                    (node_name, node_name),
                ).fetchall()
                return [{"from": r["node_a"], "to": r["node_b"], "type": r["relation"]} for r in rows]
            except Exception:
                return []

    def node_count(self) -> int:
        """Return total node count (convenience method for telemetry)."""
        return self.stats().get("nodes", 0)

    def stats(self) -> Dict[str, int]:
        """Return total node and relationship counts."""
        conn = self._connect()
        if conn is None:
            return {"nodes": 0, "relationships": 0}
        with self._lock:
            try:
                nodes = conn.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
                rels  = conn.execute("SELECT COUNT(*) FROM relationships").fetchone()[0]
                return {"nodes": nodes, "relationships": rels}
            except Exception:
                return {"nodes": 0, "relationships": 0}
