from typing import TypedDict, Any, Dict, List, Optional
from backend.state.session_state import SessionState
from backend.state.agent_state import AgentState

class AnalysisState(TypedDict):
    """
    Represents the full pipeline execution state for LangGraph.
    """
    session: SessionState
    agents: Dict[str, AgentState]  # Keyed by agent_name
    metadata: Dict[str, Any]
    retrieved_context: Optional[List[Dict[str, Any]]]
    chat_history: List[Dict[str, str]]
    error: Optional[str]
