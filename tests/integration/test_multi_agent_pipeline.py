import pytest
from backend.graph.workflow import build_workflow_graph
from backend.state.analysis_state import AnalysisState

def test_workflow_graph_compiles():
    graph = build_workflow_graph()
    assert graph is not None

def test_initial_state_validation():
    # Construct a default sample AnalysisState
    initial_state: AnalysisState = {
        "session": {
            "session_id": "test_sess_123",
            "ticker": "APOLLOHOSP",
            "company_name": "Apollo Hospitals",
            "uploaded_file_path": None,
            "created_at": "2026-07-19"
        },
        "agents": {},
        "metadata": {
            "sector": "Healthcare",
            "fiscal_year": "FY2023-2024"
        },
        "retrieved_context": [],
        "chat_history": [],
        "error": None
    }
    
    from backend.agents.ceo.agent import CEOAgent
    ceo = CEOAgent()
    res = ceo.run(initial_state)
    assert res["error"] is None
    assert "APOLLOHOSP" == res["session"]["ticker"]
