import time
from typing import Dict, Any, Literal
from langgraph.graph import StateGraph, END

from backend.state.analysis_state import AnalysisState
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# ── 1. Node Wrapper Adapters with Dynamic Imports to Prevent Circular Dependency ──

def company_detection_node(state: AnalysisState) -> AnalysisState:
    t_start = time.perf_counter()
    logger.info(f"[DEBUG LOG] [0.00s] Enter Company Detection Node")
    from backend.agents.company_detection.agent import CompanyDetectionAgent
    agent = CompanyDetectionAgent()
    pages_data = state["metadata"].get("pages_data", [])
    state = agent.run(state, pages_data)
    # Populate required metadata fields
    state["metadata"]["company_name"] = state["session"].get("company_name", "")
    state["metadata"]["stock_symbol"] = state["session"].get("ticker", "")
    t_end = time.perf_counter()
    logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exit Company Detection Node")
    return state

def financial_parser_node(state: AnalysisState) -> AnalysisState:
    t_start = time.perf_counter()
    logger.info(f"[DEBUG LOG] [0.00s] Enter Financial Parser Node")
    from backend.agents.financial_parser.agent import FinancialParserAgent
    agent = FinancialParserAgent()
    pages_data = state["metadata"].get("pages_data", [])
    state = agent.run(state, pages_data)
    # parsed_statements is populated inside agent.run to state["metadata"]["parsed_statements"]
    t_end = time.perf_counter()
    logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exit Financial Parser Node")
    return state

def financial_metrics_node(state: AnalysisState) -> AnalysisState:
    import asyncio
    t_start = time.perf_counter()
    logger.info(f"[DEBUG LOG] [0.00s] Enter Financial Metrics Node")
    from backend.agents.financial_metrics.agent import FinancialMetricsAgent
    agent = FinancialMetricsAgent()
    # agent.run is async — drive it from the synchronous node wrapper
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, agent.run(state))
                state = future.result()
        else:
            state = loop.run_until_complete(agent.run(state))
    except RuntimeError:
        state = asyncio.run(agent.run(state))
    state["metadata"]["financial_metrics"] = state["agents"].get("financial_metrics", {}).get("output")
    t_end = time.perf_counter()
    logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exit Financial Metrics Node")
    return state

def financial_ratios_node(state: AnalysisState) -> AnalysisState:
    t_start = time.perf_counter()
    logger.info(f"[DEBUG LOG] [0.00s] Enter Financial Ratios Node")
    from backend.agents.financial_ratios.agent import FinancialRatiosAgent
    agent = FinancialRatiosAgent()
    state = agent.run(state)
    state["metadata"]["financial_ratios"] = state["agents"].get("financial_ratios", {}).get("output")
    t_end = time.perf_counter()
    logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exit Financial Ratios Node")
    return state

def financial_health_node(state: AnalysisState) -> AnalysisState:
    t_start = time.perf_counter()
    logger.info(f"[DEBUG LOG] [0.00s] Enter Financial Health Node")
    from backend.agents.financial_health.agent import FinancialHealthAgent
    agent = FinancialHealthAgent()
    state = agent.run(state)
    state["metadata"]["financial_health"] = state["agents"].get("financial_health", {}).get("output")
    t_end = time.perf_counter()
    logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exit Financial Health Node")
    return state

def risk_analysis_node(state: AnalysisState) -> AnalysisState:
    t_start = time.perf_counter()
    logger.info(f"[DEBUG LOG] [0.00s] Enter Risk Analysis Node")
    from backend.agents.risk_analysis.agent import RiskAnalysisAgent
    agent = RiskAnalysisAgent()
    state = agent.run(state)
    state["metadata"]["risk_analysis"] = state["agents"].get("risk_analysis", {}).get("output")
    t_end = time.perf_counter()
    logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exit Risk Analysis Node")
    return state

def competitor_analysis_node(state: AnalysisState) -> AnalysisState:
    import asyncio
    t_start = time.perf_counter()
    logger.info(f"[DEBUG LOG] [0.00s] Enter Competitor Analysis Node")
    from backend.agents.competitor.agent import CompetitorAgent
    agent = CompetitorAgent()
    # agent.run is async — drive it from the synchronous node wrapper
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, agent.run(state))
                state = future.result()
        else:
            state = loop.run_until_complete(agent.run(state))
    except RuntimeError:
        state = asyncio.run(agent.run(state))
    state["metadata"]["competitor_analysis"] = state["agents"].get("competitor", {}).get("output")
    t_end = time.perf_counter()
    logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exit Competitor Analysis Node")
    return state

def market_news_node(state: AnalysisState) -> AnalysisState:
    t_start = time.perf_counter()
    logger.info(f"[DEBUG LOG] [0.00s] Enter Market News Node")
    from backend.agents.market_news.agent import MarketNewsAgent
    agent = MarketNewsAgent()
    state = agent.run(state)
    state["metadata"]["market_news"] = state["agents"].get("market_news", {}).get("output")
    t_end = time.perf_counter()
    logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exit Market News Node")
    return state

def swot_node(state: AnalysisState) -> AnalysisState:
    t_start = time.perf_counter()
    logger.info(f"[DEBUG LOG] [0.00s] Enter SWOT Node")
    from backend.agents.swot.agent import SWOTAgent
    agent = SWOTAgent()
    state = agent.run(state)
    state["metadata"]["swot"] = state["agents"].get("swot", {}).get("output")
    t_end = time.perf_counter()
    logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exit SWOT Node")
    return state

def investment_recommendation_node(state: AnalysisState) -> AnalysisState:
    t_start = time.perf_counter()
    logger.info(f"[DEBUG LOG] [0.00s] Enter Investment Recommendation Node")
    from backend.agents.investment.agent import InvestmentRecommendationAgent
    agent = InvestmentRecommendationAgent()
    state = agent.run(state)
    state["metadata"]["recommendation"] = state["agents"].get("investment", {}).get("output")
    t_end = time.perf_counter()
    logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exit Investment Recommendation Node")
    return state

def executive_summary_node(state: AnalysisState) -> AnalysisState:
    t_start = time.perf_counter()
    logger.info(f"[DEBUG LOG] [0.00s] Enter Executive Summary Node")
    from backend.agents.executive_summary.agent import ExecutiveSummaryAgent
    agent = ExecutiveSummaryAgent()
    state = agent.run(state)
    state["metadata"]["executive_summary"] = state["agents"].get("executive_summary", {}).get("output")
    t_end = time.perf_counter()
    logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exit Executive Summary Node")
    return state

# ── 2. Graph routing condition ────────────────────────────────────────────────

def routing_condition(state: AnalysisState) -> Literal["company_detection_branch", "error_branch"]:
    """
    Decides routing logic at CEOAgent conditional branch.
    """
    if state.get("error"):
        return "error_branch"
    return "company_detection_branch"

# ── 3. Graph Builder ──────────────────────────────────────────────────────────

def build_workflow_graph() -> StateGraph:
    """
    Builds and compiles the full LangGraph V1 pipeline StateGraph.
    """
    logger.info("Initializing StateGraph workflow V1.")
    workflow = StateGraph(AnalysisState)

    from backend.agents.ceo.agent import CEOAgent
    ceo = CEOAgent()

    # Register nodes on graph using the adapter wrappers
    workflow.add_node("ceo", ceo.run)
    workflow.add_node("company_detection", company_detection_node)
    workflow.add_node("financial_parser", financial_parser_node)
    workflow.add_node("financial_metrics", financial_metrics_node)
    workflow.add_node("financial_ratios", financial_ratios_node)
    workflow.add_node("financial_health", financial_health_node)
    workflow.add_node("risk_analysis", risk_analysis_node)
    workflow.add_node("market_news", market_news_node)
    workflow.add_node("competitor_analysis", competitor_analysis_node)
    workflow.add_node("swot", swot_node)
    workflow.add_node("investment_recommendation", investment_recommendation_node)
    workflow.add_node("executive_summary", executive_summary_node)

    # 4. Define edges matching sequential execution
    workflow.set_entry_point("ceo")

    workflow.add_conditional_edges(
        "ceo",
        routing_condition,
        {
            "company_detection_branch": "company_detection",
            "error_branch": END
        }
    )

    # Sequential workflow pipeline execution
    workflow.add_edge("company_detection", "financial_parser")
    workflow.add_edge("financial_parser", "financial_metrics")
    workflow.add_edge("financial_metrics", "financial_ratios")
    workflow.add_edge("financial_ratios", "financial_health")
    workflow.add_edge("financial_health", "risk_analysis")
    workflow.add_edge("risk_analysis", "market_news")
    workflow.add_edge("market_news", "competitor_analysis")
    workflow.add_edge("competitor_analysis", "swot")
    workflow.add_edge("swot", "investment_recommendation")
    workflow.add_edge("investment_recommendation", "executive_summary")
    workflow.add_edge("executive_summary", END)

    logger.info("LangGraph workflow registered and compiled.")
    return workflow.compile()
