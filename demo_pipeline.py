import asyncio
import os
import json
from backend.graph.workflow import build_workflow_graph
from backend.state.analysis_state import AnalysisState

async def run_pipeline_demo():
    print("--- Phase 6: Multi-Agent Pipeline Demo (Mock LLM Mode) ---")
    
    # 1. Setup initial state
    initial_state: AnalysisState = {
        "session": {
            "session_id": "demo_session_456",
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
        "retrieved_context": [
            {"text": "Apollo Hospitals revenue was 18000 cr. Net profit was 1200 cr.", "metadata": {"page": 1}}
        ],
        "chat_history": [],
        "error": None
    }
    
    # 2. Build and run graph
    print("\n[1] Compiling LangGraph workflow...")
    app = build_workflow_graph()
    
    print("\n[2] Executing pipeline...")
    # LangGraph .invoke is async
    final_state = await app.ainvoke(initial_state)
    
    print("\n[3] Pipeline Results Summary:")
    for agent_id, agent_state in final_state["agents"].items():
        status_icon = "✅" if agent_state["status"] == "completed" else "❌"
        print(f" {status_icon} {agent_state['agent_name']}: {agent_state['status']}")
        if agent_state["status"] == "completed" and agent_state["output"]:
            # Print a snippet of the output
            snippet = str(agent_state["output"])[:100]
            print(f"    Output Snippet: {snippet}...")

    if "executive_summary" in final_state["agents"]:
        print("\n[4] Final Executive Summary Highlight:")
        print(final_state["agents"]["executive_summary"]["output"].get("paragraph_1", "No summary generated."))

if __name__ == "__main__":
    asyncio.run(run_pipeline_demo())
