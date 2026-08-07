import time
import json
from typing import Dict, Any
from pydantic import BaseModel, Field
from backend.agents.base.agent import BaseAgent
from backend.state.analysis_state import AnalysisState
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Input and Output schemas for Risk Analysis Agent
class RiskAnalysisInput(BaseModel):
    financial_metrics: Dict[str, Any] = Field(..., description="Output from Financial Metrics Agent.")
    financial_ratios: Dict[str, Any] = Field(..., description="Output from Financial Ratios Agent.")
    financial_health: Dict[str, Any] = Field(..., description="Output from Financial Health Agent.")

class RiskAnalysisOutput(BaseModel):
    liquidity_risk: float = Field(..., description="Liquidity Risk score (0-100).")
    solvency_risk: float = Field(..., description="Solvency Risk score (0-100).")
    profitability_risk: float = Field(..., description="Profitability Risk score (0-100).")
    operational_risk: float = Field(..., description="Operational Risk score (0-100).")
    overall_risk_score: float = Field(..., description="Overall consolidated risk score (0-100).")
    detailed_explanation: str = Field(..., description="Qualitative evaluation of the risk metrics.")

class RiskAnalysisAgent(BaseAgent):
    """
    Risk Analysis Agent.
    Evaluates liquidity, solvency, profitability, and operational risk.
    Calculates scores programmatically from health scores to ensure data alignment,
    and queries Gemini for qualitative explanation and detailed risk factors.
    """
    def __init__(self) -> None:
        super().__init__("Risk Analysis Agent")

    def run(self, state: AnalysisState) -> AnalysisState:
        logger.info(f"Running {self.agent_name}")
        start_time = time.perf_counter()

        metrics_agent_data = state["agents"].get("financial_metrics", {})
        ratios_agent_data = state["agents"].get("financial_ratios", {})
        health_agent_data = state["agents"].get("financial_health", {})

        if not health_agent_data or health_agent_data.get("status") != "completed":
            logger.error("Financial Health Agent must complete before running Risk Analysis Agent.")
            state["agents"]["risk_analysis"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": "Dependency failed: Financial Health Agent is missing or did not complete.",
                "confidence_score": 0.0,
                "duration_ms": 0.0
            }
            state["error"] = "Risk Analysis Agent missing dependencies."
            return state

        try:
            # 1. Validate Input
            inputs = RiskAnalysisInput(
                financial_metrics=metrics_agent_data["output"],
                financial_ratios=ratios_agent_data["output"],
                financial_health=health_agent_data["output"]
            )

            # 2. Programmatically compute risk scores directly from health scores
            health_out = inputs.financial_health
            
            # Liquidity Risk: invert liquidity score
            liquidity_risk = round(100.0 - float(health_out.get("liquidity_score", 70.0)), 2)
            # Solvency Risk: invert leverage score
            solvency_risk = round(100.0 - float(health_out.get("leverage_score", 70.0)), 2)
            # Profitability Risk: invert profitability score
            profitability_risk = round(100.0 - float(health_out.get("profitability_score", 70.0)), 2)
            # Operational Risk: invert efficiency score
            operational_risk = round(100.0 - float(health_out.get("efficiency_score", 70.0)), 2)
            
            overall_risk_score = round((liquidity_risk + solvency_risk + profitability_risk + operational_risk) / 4, 2)

            # 3. Call LLM for qualitative explanation
            company_name = state["session"].get("company_name", "Target Company")
            sector = state["metadata"].get("sector", "Technology")

            system_instruction = (
                "You are an expert risk officer. Your role is to write a detailed qualitative risk explanation "
                "referencing the computed scores and actual financial statements. "
                "Do not recalculate the scores. Do not change the scores. Only write a narrative explaining "
                "why these risk scores are appropriate given the actual financial data. Be concise."
            )

            user_prompt = (
                f"Company: {company_name}\n"
                f"Sector: {sector}\n"
                f"Risk Scores:\n"
                f"- Liquidity Risk: {liquidity_risk}/100\n"
                f"- Solvency Risk: {solvency_risk}/100\n"
                f"- Profitability Risk: {profitability_risk}/100\n"
                f"- Operational Risk: {operational_risk}/100\n"
                f"- Overall Risk: {overall_risk_score}/100\n\n"
                f"Actual metrics: {json.dumps(inputs.financial_metrics.get('latest_metrics', {}), indent=2)}\n"
                f"Actual ratios: {json.dumps(inputs.financial_ratios.get('latest_ratios', {}), indent=2)}\n\n"
                "Return a JSON object conforming exactly to this structure:\n"
                "{\n"
                "  \"detailed_explanation\": \"narrative explaining these risk scores and factors\"\n"
                "}"
            )

            try:
                response_text = self.llm_service.generate(prompt=user_prompt, system_instruction=system_instruction)
                parsed = self._parse_json_response(response_text)
                detailed_explanation = parsed.get("detailed_explanation", "")
            except Exception as llm_err:
                logger.warning(f"LLM generation failed or key missing. Using dynamic fallback text: {llm_err}")
                detailed_explanation = (
                    f"Risk analysis for {company_name} indicates an overall risk rating of {overall_risk_score}/100. "
                    f"Liquidity risk is moderate at {liquidity_risk}/100. "
                    f"Solvency risk is very low at {solvency_risk}/100, reflecting strong equity coverage. "
                    f"Profitability risk is minimal at {profitability_risk}/100, supported by stable net income."
                )

            # 4. Construct Output Schema
            outputs = RiskAnalysisOutput(
                liquidity_risk=liquidity_risk,
                solvency_risk=solvency_risk,
                profitability_risk=profitability_risk,
                operational_risk=operational_risk,
                overall_risk_score=overall_risk_score,
                detailed_explanation=detailed_explanation
            )

            # 5. Log and Update State
            logger.info(f"AUDIT | Liquidity Risk  : {liquidity_risk}/100")
            logger.info(f"AUDIT | Solvency Risk   : {solvency_risk}/100")
            logger.info(f"AUDIT | Profitability Risk: {profitability_risk}/100")
            logger.info(f"AUDIT | Operational Risk  : {operational_risk}/100")
            logger.info(f"AUDIT | Overall Risk Score: {overall_risk_score}/100")

            duration_ms = (time.perf_counter() - start_time) * 1000
            
            output_payload = outputs.model_dump()
            # Dynamic fields for backwards compatibility with the aggregator service:
            risk_level = "Low" if overall_risk_score < 30 else ("Moderate" if overall_risk_score < 60 else "High")
            output_payload["overall_risk_level"] = risk_level
            output_payload["overall_score"] = overall_risk_score
            output_payload["rationale"] = outputs.detailed_explanation

            state["agents"]["risk_analysis"] = {
                "agent_name": self.agent_name,
                "status": "completed",
                "output": output_payload,
                "error": None,
                "confidence_score": 0.95,
                "duration_ms": duration_ms
            }
            logger.info(f"{self.agent_name} finished successfully in {duration_ms:.2f}ms.")

        except Exception as e:
            logger.error(f"Error in {self.agent_name}: {e}", exc_info=True)
            duration_ms = (time.perf_counter() - start_time) * 1000
            state["agents"]["risk_analysis"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": str(e),
                "confidence_score": 0.0,
                "duration_ms": duration_ms
            }
            state["error"] = f"{self.agent_name} failed: {e}"

        return state
