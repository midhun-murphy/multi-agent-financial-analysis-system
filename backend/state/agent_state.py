from typing import TypedDict, Any, Dict, Optional

class AgentState(TypedDict):
    """
    Represents the input/output slice of state for an individual agent.
    """
    agent_name: str
    status: str  # "pending", "running", "completed", "failed"
    output: Optional[Dict[str, Any]]
    error: Optional[str]
    confidence_score: Optional[float]
