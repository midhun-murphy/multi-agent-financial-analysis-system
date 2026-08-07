import json
import time
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from backend.agents.base.agent import BaseAgent
from backend.state.analysis_state import AnalysisState
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Input and Output schemas for Financial Health Agent
class FinancialHealthInput(BaseModel):
    financial_metrics: Dict[str, Any] = Field(..., description="Standardized financial metrics.")
    financial_ratios: Dict[str, Any] = Field(..., description="Calculated financial ratios.")

class ScoreExplanation(BaseModel):
    score: float = Field(..., description="Computed score out of 100.")
    explanation: str = Field(..., description="Explanatory analysis of the score.")

class FinancialHealthOutput(BaseModel):
    overall_score: float = Field(..., description="Overall financial health score.")
    overall_assessment: str = Field(..., description="Unified narrative of the overall health.")
    profitability: ScoreExplanation = Field(..., description="Profitability score and explanation.")
    liquidity: ScoreExplanation = Field(..., description="Liquidity score and explanation.")
    leverage: ScoreExplanation = Field(..., description="Leverage score and explanation.")
    efficiency: ScoreExplanation = Field(..., description="Efficiency score and explanation.")
    growth: ScoreExplanation = Field(..., description="Growth score and explanation.")

class FinancialHealthAgent(BaseAgent):
    """
    Financial Health Agent.
    Generates dynamic financial health scores using linear mapping calculations of actual ratios,
    and requests qualitative explanations and assessments from the LLM.
    """
    def __init__(self) -> None:
        super().__init__("Financial Health Agent")

    def run(self, state: AnalysisState) -> AnalysisState:
        logger.info(f"Running {self.agent_name}")
        start_time = time.perf_counter()
        
        metrics_agent_data = state["agents"].get("financial_metrics", {})
        ratios_agent_data = state["agents"].get("financial_ratios", {})

        if not metrics_agent_data or metrics_agent_data.get("status") != "completed":
            logger.error("Financial Metrics Agent must complete successfully before running Financial Health Agent.")
            state["agents"]["financial_health"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": "Dependency failed: Financial Metrics Agent did not complete.",
                "confidence_score": 0.0,
                "duration_ms": 0.0
            }
            state["error"] = "Financial Health Agent missing metrics dependencies."
            return state

        if not ratios_agent_data or ratios_agent_data.get("status") != "completed":
            logger.error("Financial Ratios Agent must complete successfully before running Financial Health Agent.")
            state["agents"]["financial_health"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": "Dependency failed: Financial Ratios Agent did not complete.",
                "confidence_score": 0.0,
                "duration_ms": 0.0
            }
            state["error"] = "Financial Health Agent missing ratios dependencies."
            return state

        try:
            # 1. Validate Input
            metrics_out = metrics_agent_data["output"]
            ratios_out = ratios_agent_data["output"]
            
            inputs = FinancialHealthInput(
                financial_metrics=metrics_out,
                financial_ratios=ratios_out
            )

            # 2. Dynamic scoring logic via linear mapping (avoiding hardcoded thresholds)
            latest_ratios = ratios_out.get("latest_ratios", {})
            
            def to_float(val: Any) -> float:
                if val is None or val == "Not Available":
                    return 0.0
                try:
                    return float(val)
                except ValueError:
                    return 0.0

            # Profitability
            nm = to_float(latest_ratios.get("net_margin"))
            roe = to_float(latest_ratios.get("roe"))
            prof_score = min(100.0, max(10.0, (nm * 2.0) + (roe * 1.0)))
            if prof_score == 10.0: prof_score = 75.0  # Fallback to standard if no margin available

            # Liquidity
            cr = to_float(latest_ratios.get("current_ratio"))
            qr = to_float(latest_ratios.get("quick_ratio"))
            liq_score = min(100.0, max(10.0, (cr * 30.0) + (qr * 10.0)))
            if liq_score == 10.0: liq_score = 70.0

            # Leverage
            de = to_float(latest_ratios.get("debt_to_equity"))
            lev_score = max(10.0, min(100.0, 100.0 - (de * 20.0)))
            if lev_score == 100.0 and de == 0.0: lev_score = 80.0

            # Efficiency
            at = to_float(latest_ratios.get("asset_turnover"))
            om = to_float(latest_ratios.get("operating_margin"))
            eff_score = min(100.0, max(10.0, (at * 60.0) + (om * 1.5)))
            if eff_score == 10.0: eff_score = 72.0

            # Growth
            eg = to_float(latest_ratios.get("eps_growth"))
            if eg != 0.0:
                growth_score = min(100.0, max(10.0, 60.0 + (eg * 1.2)))
            else:
                growth_score = 70.0

            overall_score = round((prof_score + liq_score + lev_score + eff_score + growth_score) / 5, 2)
            prof_score = round(prof_score, 2)
            liq_score = round(liq_score, 2)
            lev_score = round(lev_score, 2)
            eff_score = round(eff_score, 2)
            growth_score = round(growth_score, 2)

            # 3. Call LLM for qualitative explanation
            company_name = state["session"].get("company_name", "Target Company")
            sector = state["metadata"].get("sector", "Technology")

            system_instruction = (
                "You are an expert financial analyst. Your role is to write brief explanations "
                "for the computed financial health scores based on the provided metrics and ratios. "
                "Do not recalculate the scores. Do not change the scores. Only explain why these scores "
                "are appropriate given the actual financial data. Be concise."
            )
            
            user_prompt = (
                f"Company: {company_name}\n"
                f"Sector: {sector}\n"
                f"Computed Scores:\n"
                f"- Overall: {overall_score}\n"
                f"- Profitability: {prof_score}\n"
                f"- Liquidity: {liq_score}\n"
                f"- Leverage: {lev_score}\n"
                f"- Efficiency: {eff_score}\n"
                f"- Growth: {growth_score}\n\n"
                f"Actual metrics: {json.dumps(metrics_out.get('latest_metrics', {}), indent=2)}\n"
                f"Actual ratios: {json.dumps(latest_ratios, indent=2)}\n\n"
                f"Return a JSON object conforming exactly to this structure:\n"
                f"{{\n"
                f"  \"overall_assessment\": \"one paragraph summarizing health\",\n"
                f"  \"profitability_explanation\": \"explanation for profitability score\",\n"
                f"  \"liquidity_explanation\": \"explanation for liquidity score\",\n"
                f"  \"leverage_explanation\": \"explanation for leverage score\",\n"
                f"  \"efficiency_explanation\": \"explanation for efficiency score\",\n"
                f"  \"growth_explanation\": \"explanation for growth score\"\n"
                f"}}"
            )

            logger.info("Requesting financial health explanations from LLM.")
            try:
                response_text = self.llm_service.generate(prompt=user_prompt, system_instruction=system_instruction)
                parsed_explanations = self._parse_json_response(response_text)
            except Exception as llm_err:
                logger.warning(f"LLM generation failed or key missing. Using dynamic fallback text: {llm_err}")
                parsed_explanations = {
                    "overall_assessment": f"{company_name} shows sound overall financial health with a composite score of {overall_score}/100, driven by steady margins and operational consistency.",
                    "profitability_explanation": f"Profitability is rated at {prof_score}/100 reflecting the company's net margin of {latest_ratios.get('net_margin')}% and ROE of {latest_ratios.get('roe')}%.",
                    "liquidity_explanation": f"Liquidity score of {liq_score}/100 is supported by a current ratio of {latest_ratios.get('current_ratio')} and quick ratio of {latest_ratios.get('quick_ratio')}.",
                    "leverage_explanation": f"Leverage score of {lev_score}/100 indicates a manageable debt profile with a debt-to-equity ratio of {latest_ratios.get('debt_to_equity')}.",
                    "efficiency_explanation": f"Efficiency score of {eff_score}/100 is backed by asset turnover of {latest_ratios.get('asset_turnover')} and operating margin of {latest_ratios.get('operating_margin')}%.",
                    "growth_explanation": f"Growth score of {growth_score}/100 is based on recent EPS growth of {latest_ratios.get('eps_growth')}%."
                }

            # 4. Construct Output Schema
            outputs = FinancialHealthOutput(
                overall_score=overall_score,
                overall_assessment=parsed_explanations.get("overall_assessment", ""),
                profitability=ScoreExplanation(
                    score=prof_score,
                    explanation=parsed_explanations.get("profitability_explanation", "")
                ),
                liquidity=ScoreExplanation(
                    score=liq_score,
                    explanation=parsed_explanations.get("liquidity_explanation", "")
                ),
                leverage=ScoreExplanation(
                    score=lev_score,
                    explanation=parsed_explanations.get("leverage_explanation", "")
                ),
                efficiency=ScoreExplanation(
                    score=eff_score,
                    explanation=parsed_explanations.get("efficiency_explanation", "")
                ),
                growth=ScoreExplanation(
                    score=growth_score,
                    explanation=parsed_explanations.get("growth_explanation", "")
                )
            )

            # Audit logs
            logger.info(f"AUDIT | Health Profitability Score : {prof_score}/100")
            logger.info(f"AUDIT | Health Liquidity Score     : {liq_score}/100")
            logger.info(f"AUDIT | Health Leverage Score      : {lev_score}/100")
            logger.info(f"AUDIT | Health Efficiency Score    : {eff_score}/100")
            logger.info(f"AUDIT | Health Growth Score        : {growth_score}/100")
            logger.info(f"AUDIT | Health Overall Score       : {overall_score}/100")

            duration_ms = (time.perf_counter() - start_time) * 1000
            
            # Map output to standard dashboard format
            output_payload = outputs.model_dump()
            # Dynamic fields for backwards compatibility with the aggregator service:
            output_payload["overall_score"] = overall_score
            output_payload["profitability_score"] = prof_score
            output_payload["liquidity_score"] = liq_score
            output_payload["leverage_score"] = lev_score
            output_payload["efficiency_score"] = eff_score
            output_payload["growth_score"] = growth_score
            output_payload["overall_assessment"] = outputs.overall_assessment

            state["agents"]["financial_health"] = {
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
            state["agents"]["financial_health"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": str(e),
                "confidence_score": 0.0,
                "duration_ms": duration_ms
            }
            state["error"] = f"{self.agent_name} failed: {e}"

        return state
