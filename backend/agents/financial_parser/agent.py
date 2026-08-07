import time
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from backend.services.financial_parser_service import FinancialParserService
from backend.state.analysis_state import AnalysisState
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Input and Output schemas for the Financial Parser Agent
class FinancialParserInput(BaseModel):
    pages_data: List[Dict[str, Any]] = Field(..., description="Structured page data extracted from PDF.")
    company_name: str = Field(..., description="Target company name.")

class FinancialParserOutput(BaseModel):
    income_statement: Dict[str, Any] = Field(..., description="Extracted Income Statement rows.")
    balance_sheet: Dict[str, Any] = Field(..., description="Extracted Balance Sheet rows.")
    cash_flow: Dict[str, Any] = Field(..., description="Extracted Cash Flow statement rows.")
    metadata: Dict[str, Any] = Field(..., description="Parsing metadata including detected years and target pages.")

class FinancialParserAgent:
    """
    Financial Parser Agent.
    Runs the high-precision statement parser to extract Income Statement, Balance Sheet,
    and Cash Flow statement values from the PDF, preserving reported fiscal years.
    """
    def __init__(self, parser_service: FinancialParserService = None):
        self.agent_name = "Financial Parser Agent"
        self.service = parser_service or FinancialParserService()

    def run(self, state: AnalysisState, pages_data: List[Dict[str, Any]]) -> AnalysisState:
        logger.info(f"Running {self.agent_name}")
        start_time = time.perf_counter()
        
        company_name = state["session"].get("company_name", "Target Company")

        try:
            # 1. Input Validation
            inputs = FinancialParserInput(
                pages_data=pages_data,
                company_name=company_name
            )

            # 2. Run core service parsing
            parsed_data = self.service.parse_statements(
                pages_data=inputs.pages_data,
                company_name=inputs.company_name
            )

            # 3. Output Validation
            outputs = FinancialParserOutput(
                income_statement=parsed_data.get("income_statement", {}),
                balance_sheet=parsed_data.get("balance_sheet", {}),
                cash_flow=parsed_data.get("cash_flow", {}),
                metadata=parsed_data.get("metadata", {})
            )

            # 4. Update state with parsed data
            state["metadata"]["historical_trend"] = parsed_data.get("historical_trend", {})
            # Store the parser's standard output in a dedicated key in state for downstream metrics extraction
            state["metadata"]["parsed_statements"] = parsed_data

            duration_ms = (time.perf_counter() - start_time) * 1000
            state["agents"]["financial_parser"] = {
                "agent_name": self.agent_name,
                "status": "completed",
                "output": outputs.model_dump(),
                "error": None,
                "confidence_score": 0.95,
                "duration_ms": duration_ms
            }
            logger.info(f"{self.agent_name} finished successfully in {duration_ms:.2f}ms.")

        except Exception as e:
            logger.error(f"Error in {self.agent_name}: {e}", exc_info=True)
            duration_ms = (time.perf_counter() - start_time) * 1000
            state["agents"]["financial_parser"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": str(e),
                "confidence_score": 0.0,
                "duration_ms": duration_ms
            }
            state["error"] = f"{self.agent_name} failed: {e}"

        return state
