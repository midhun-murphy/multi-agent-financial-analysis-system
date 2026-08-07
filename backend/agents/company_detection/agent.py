import time
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from backend.services.company_detection_service import CompanyDetectionService
from backend.state.analysis_state import AnalysisState
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Input and Output schemas for the Company Detection Agent
class CompanyDetectionInput(BaseModel):
    pages_data: List[Dict[str, Any]] = Field(..., description="List of dictionaries representing extracted page text.")
    user_company: str = Field("", description="Optional user-supplied company name override.")
    user_ticker: str = Field("", description="Optional user-supplied ticker symbol override.")

class CompanyDetectionOutput(BaseModel):
    company_name: str = Field(..., description="Detected company name.")
    ticker: str = Field(..., description="Detected stock ticker.")
    sector: str = Field(..., description="Detected business sector.")
    industry: str = Field(..., description="Detected business industry.")
    fiscal_year: str = Field(..., description="Detected fiscal year reporting period.")

class CompanyDetectionAgent:
    """
    Company Detection Agent.
    Analyzes document context to detect the target company name, ticker, sector, industry,
    and reporting period, returning structured metadata.
    """
    def __init__(self, detection_service: CompanyDetectionService = None):
        self.agent_name = "Company Detection Agent"
        self.service = detection_service or CompanyDetectionService()

    def run(self, state: AnalysisState, pages_data: List[Dict[str, Any]]) -> AnalysisState:
        logger.info(f"Running {self.agent_name}")
        start_time = time.perf_counter()
        
        session = state.get("session", {})
        user_company = session.get("company_name", "")
        user_ticker = session.get("ticker", "")

        try:
            # 1. Validation of inputs
            inputs = CompanyDetectionInput(
                pages_data=pages_data,
                user_company=user_company,
                user_ticker=user_ticker
            )
            
            # 2. Run core service
            detected_data = self.service.detect_company_details(
                pages_data=inputs.pages_data,
                user_company=inputs.user_company,
                user_ticker=inputs.user_ticker
            )
            
            # 3. Validate outputs
            outputs = CompanyDetectionOutput(
                company_name=detected_data["company_name"],
                ticker=detected_data["ticker"],
                sector=detected_data["sector"],
                industry=detected_data["industry"],
                fiscal_year=detected_data["fiscal_year"]
            )
            
            # 4. Update state
            state["metadata"]["sector"] = outputs.sector
            state["metadata"]["fiscal_year"] = outputs.fiscal_year
            state["metadata"]["industry"] = outputs.industry
            state["metadata"]["company_name"] = outputs.company_name
            state["metadata"]["stock_symbol"] = outputs.ticker
            state["session"]["ticker"] = outputs.ticker
            state["session"]["company_name"] = outputs.company_name

            duration_ms = (time.perf_counter() - start_time) * 1000
            state["agents"]["company_detection"] = {
                "agent_name": self.agent_name,
                "status": "completed",
                "output": outputs.model_dump(),
                "error": None,
                "confidence_score": 0.98,
                "duration_ms": duration_ms
            }
            logger.info(f"{self.agent_name} finished successfully in {duration_ms:.2f}ms.")
            
        except Exception as e:
            logger.error(f"Error in {self.agent_name}: {e}", exc_info=True)
            duration_ms = (time.perf_counter() - start_time) * 1000
            state["agents"]["company_detection"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": str(e),
                "confidence_score": 0.0,
                "duration_ms": duration_ms
            }
            state["error"] = f"{self.agent_name} failed: {e}"
            
        return state
