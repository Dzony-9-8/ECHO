from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
import uuid
import time

@dataclass
class UACPPayload:
    """Unified Agent Communication Protocol (UACP) Schema."""
    agent: str # dev | research | critic | supervisor
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    analysis: str = ""
    output: Any = None
    confidence: float = 0.0
    requires_revision: bool = False
    notes_for_memory: str = ""
    execution_time_ms: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent": self.agent,
            "task_id": self.task_id,
            "analysis": self.analysis,
            "output": self.output,
            "confidence": self.confidence,
            "requires_revision": self.requires_revision,
            "notes_for_memory": self.notes_for_memory,
            "execution_time_ms": self.execution_time_ms
        }

@dataclass
class MemoryIntelligence:
    """Compressed format for shared memory writes."""
    task_signature: str
    agent_used: str
    confidence: float
    success: bool
    failure_type: Optional[str] = None
    time_ms: int = 0
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_signature": self.task_signature,
            "agent_used": self.agent_used,
            "confidence": self.confidence,
            "success": self.success,
            "failure_type": self.failure_type,
            "time_ms": self.time_ms,
            "tags": self.tags
        }
