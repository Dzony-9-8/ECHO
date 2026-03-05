from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum

class AgentType(Enum):
    SUPERVISOR = "supervisor"
    DEVELOPER = "developer"
    RESEARCHER = "researcher"
    CRITIC = "critic"

class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    REVISION_REQUESTED = "revision_requested"

@dataclass
class AgentTask:
    task_id: str
    description: str
    assigned_to: AgentType
    status: TaskStatus = TaskStatus.PENDING
    payload: Dict[str, Any] = field(default_factory=dict)
    result: Optional[str] = None
    confidence: float = 0.0
    reasoning_trace: List[str] = field(default_factory=list)

@dataclass
class SwarmPacket:
    sender: AgentType
    receiver: Optional[AgentType]
    payload: Any
    context: Dict[str, Any] = field(default_factory=dict)
    routing_id: Optional[str] = None
