from typing import Dict, Any
from backend.state.analysis_state import AnalysisState
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class CEOAgent:
    """
    CEO Agent: responsible ONLY for routing, state initialization, validation, and terminal state summary retrieval.
    Never calculates metrics, never calls LLMs directly for calculation.
    """

    def __init__(self) -> None:
        self.agent_name = "CEO Agent"

    def run(self, state: AnalysisState) -> AnalysisState:
        """
        Validates session information in the AnalysisState and sets up initial configuration.
        """
        logger.info("CEO Agent validating session state.")
        session = state.get("session", {})
        if not session.get("ticker"):
            state["error"] = "Missing ticker symbol in session state."
            logger.error(state["error"])
            return state

        # Initialize agents mapping if missing
        if "agents" not in state or not state["agents"]:
            state["agents"] = {}

        logger.info(f"CEO Agent successfully validated session for ticker: {session['ticker']}")
        return state
