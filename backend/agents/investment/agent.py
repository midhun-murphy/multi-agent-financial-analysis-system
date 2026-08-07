import time
import json
from typing import Dict, Any, Literal
from pydantic import BaseModel, Field
from backend.agents.base.agent import BaseAgent
from backend.state.analysis_state import AnalysisState
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Input and Output schemas for Investment Recommendation Agent
class InvestmentInput(BaseModel):
    financial_metrics: Dict[str, Any] = Field(..., description="Metrics details.")
    financial_ratios: Dict[str, Any] = Field(..., description="Ratios details.")
    financial_health: Dict[str, Any] = Field(..., description="Health details.")
    risk_analysis: Dict[str, Any] = Field(..., description="Risk details.")
    swot: Dict[str, Any] = Field(..., description="SWOT details.")
    market_news: Dict[str, Any] = Field(..., description="News details.")

class InvestmentOutput(BaseModel):
    recommendation: Literal["BUY", "HOLD", "SELL"] = Field(..., description="Actionable investment recommendation.")
    confidence_score: float = Field(..., description="Confidence score as percentage (0-100).")
    explanation: str = Field(..., description="Detailed rationale explaining the recommendation choice.")

class InvestmentRecommendationAgent(BaseAgent):
    """
    Investment Recommendation Agent.
    Synthesizes financial fundamentals, ratio analysis, risk profile, SWOT assessment,
    and market sentiment to output a definitive BUY, HOLD, or SELL decision.
    """
    def __init__(self) -> None:
        super().__init__("Investment Recommendation Agent")

    def run(self, state: AnalysisState) -> AnalysisState:
        logger.info(f"Running {self.agent_name}")
        start_time = time.perf_counter()
        logger.info(f"[DEBUG LOG] [0.00s] Entering {self.agent_name}")

        metrics = state["agents"].get("financial_metrics", {})
        ratios = state["agents"].get("financial_ratios", {})
        health = state["agents"].get("financial_health", {})
        risk = state["agents"].get("risk_analysis", {})
        swot = state["agents"].get("swot", {})
        market_news = state["agents"].get("market_news", {})

        missing = []
        if not metrics or metrics.get("status") != "completed": missing.append("financial_metrics")
        if not ratios or ratios.get("status") != "completed": missing.append("financial_ratios")
        if not health or health.get("status") != "completed": missing.append("financial_health")
        if not risk or risk.get("status") != "completed": missing.append("risk_analysis")
        if not swot or swot.get("status") != "completed": missing.append("swot")
        if not market_news or market_news.get("status") != "completed": missing.append("market_news")

        if missing:
            logger.error(f"Investment Recommendation Agent is missing upstream dependencies: {missing}")
            state["agents"]["investment"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": f"Missing upstream dependencies: {missing}",
                "confidence_score": 0.0,
                "duration_ms": 0.0
            }
            state["error"] = "Investment Recommendation Agent missing dependencies."
            logger.info(f"[DEBUG LOG] [{time.perf_counter() - start_time:.2f}s] Exiting {self.agent_name} early due to missing dependencies.")
            return state

        try:
            # 1. Validate Input
            t_val_start = time.perf_counter()
            logger.info(f"[DEBUG LOG] [{t_val_start - start_time:.2f}s] Entering Investment Agent Input Validation")
            inputs = InvestmentInput(
                financial_metrics=metrics["output"],
                financial_ratios=ratios["output"],
                financial_health=health["output"],
                risk_analysis=risk["output"],
                swot=swot["output"],
                market_news=market_news["output"]
            )
            t_val_end = time.perf_counter()
            logger.info(f"[DEBUG LOG] [{t_val_end - start_time:.2f}s] Exiting Investment Agent Input Validation. Success")

            # 2. Programmatically calculate recommendation score to ensure consistency
            logger.info(f"[DEBUG LOG] [{time.perf_counter() - start_time:.2f}s] Entering recommendation score calculation")
            health_out = inputs.financial_health
            risk_out = inputs.risk_analysis
            
            h_score = float(health_out.get("overall_score", 70.0))
            r_score = float(risk_out.get("overall_risk_score", 30.0))
            
            # Recommendation Score: starts from health and subtracts risk
            rec_score = h_score - (r_score * 0.5)  # e.g., Health = 88, Risk = 12 -> rec_score = 82
            
            if rec_score >= 70:
                rec_val = "BUY"
                conf_val = min(98.0, 50.0 + rec_score * 0.5)
            elif rec_score >= 50:
                rec_val = "HOLD"
                conf_val = min(90.0, 40.0 + rec_score * 0.5)
            else:
                rec_val = "SELL"
                conf_val = min(95.0, 30.0 + (100.0 - rec_score) * 0.5)
            logger.info(f"[DEBUG LOG] [{time.perf_counter() - start_time:.2f}s] Exiting recommendation score calculation. Score: {rec_score}, Rec: {rec_val}, Conf: {conf_val}%")

            # 3. Call LLM for qualitative explanation and confirmation
            company_name = state["session"].get("company_name", "Target Company")
            
            system_instruction = (
                "You are an expert investment advisor. Your role is to write a qualitative rationale "
                "supporting the recommendation choice. "
                "Do not recalculate the scores. Do not change the recommendation. "
                "Only explain why the decision (BUY, HOLD, or SELL) is sound given the financial metrics, "
                "ratios, risks, and SWOT factors. Be concise."
            )

            logger.info(f"[DEBUG LOG] [{time.perf_counter() - start_time:.2f}s] Building user prompt for Gemini")
            
            # Construct token-efficient summaries to reduce prompt size and avoid narrative redundancy
            health_summary = {
                "overall_score": health_out.get("overall_score"),
                "overall_assessment": health_out.get("overall_assessment"),
                "category_scores": {
                    "profitability": health_out.get("profitability", {}).get("score"),
                    "liquidity": health_out.get("liquidity", {}).get("score"),
                    "leverage": health_out.get("leverage", {}).get("score"),
                    "efficiency": health_out.get("efficiency", {}).get("score"),
                    "growth": health_out.get("growth", {}).get("score")
                }
            }
            
            risk_summary = {
                "overall_risk_score": risk_out.get("overall_risk_score"),
                "overall_risk_level": risk_out.get("overall_risk_level"),
                "rationale": risk_out.get("rationale") or risk_out.get("detailed_explanation"),
                "category_scores": {
                    "liquidity_risk": risk_out.get("liquidity_risk"),
                    "solvency_risk": risk_out.get("solvency_risk"),
                    "profitability_risk": risk_out.get("profitability_risk"),
                    "operational_risk": risk_out.get("operational_risk")
                }
            }
            
            swot_summary = {
                "strengths": inputs.swot.get("strengths", []),
                "weaknesses": inputs.swot.get("weaknesses", []),
                "opportunities": inputs.swot.get("opportunities", []),
                "threats": inputs.swot.get("threats", [])
            }

            user_prompt = (
                f"Company: {company_name}\n"
                f"Decision Choice: {rec_val}\n"
                f"Confidence Score: {conf_val}%\n\n"
                f"Financial health summary: {json.dumps(health_summary, indent=2)}\n"
                f"Risk Analysis summary: {json.dumps(risk_summary, indent=2)}\n"
                f"SWOT Analysis factors: {json.dumps(swot_summary, indent=2)}\n\n"
                "Return a JSON object conforming exactly to this structure:\n"
                "{\n"
                "  \"explanation\": \"narrative explaining this choice and confidence level\"\n"
                "}"
            )

            try:
                response_text = self.llm_service.generate(
                    prompt=user_prompt,
                    system_instruction=system_instruction,
                    response_mime_type="application/json"
                )
                parsed = self._parse_json_response(response_text)
                explanation = parsed.get("explanation", "")
            except Exception as llm_err:
                logger.warning(f"LLM generation failed. Using dynamic fallback explanation: {llm_err}")
                explanation = (
                    f"Recommend {rec_val} with a confidence score of {conf_val}%. "
                    f"This is supported by {company_name}'s high financial health score of {h_score}/100 "
                    f"and low overall risk level of {r_score}/100."
                )

            # 4. Construct Output Schema
            t_out_val_start = time.perf_counter()
            logger.info(f"[DEBUG LOG] [{t_out_val_start - start_time:.2f}s] Entering Investment Agent Output Validation")
            outputs = InvestmentOutput(
                recommendation=rec_val,
                confidence_score=conf_val,
                explanation=explanation
            )
            t_out_val_end = time.perf_counter()
            logger.info(f"[DEBUG LOG] [{t_out_val_end - start_time:.2f}s] Exiting Investment Agent Output Validation. Success")

            # 5. Log and Update State
            logger.info(f"AUDIT | Investment Rec  : {rec_val}")
            logger.info(f"AUDIT | Investment Conf : {conf_val}%")

            duration_ms = (time.perf_counter() - start_time) * 1000
            
            output_payload = outputs.model_dump()
            # Dynamic fields for backwards compatibility with the aggregator service:
            output_payload["recommendation"] = rec_val
            output_payload["overall_score"] = conf_val
            output_payload["confidence_pct"] = conf_val
            output_payload["target_price_12m"] = "Not Available"
            output_payload["current_price"] = "Not Available"
            output_payload["upside_potential_pct"] = "Not Available"
            output_payload["time_horizon"] = "12 Months"
            output_payload["risk_level"] = "Low" if r_score < 30 else ("Moderate" if r_score < 60 else "High")
            output_payload["rationale"] = outputs.explanation
            output_payload["contributing_metrics"] = []

            state["agents"]["investment"] = {
                "agent_name": self.agent_name,
                "status": "completed",
                "output": output_payload,
                "error": None,
                "confidence_score": conf_val / 100.0,
                "duration_ms": duration_ms
            }
            logger.info(f"{self.agent_name} finished successfully in {duration_ms:.2f}ms.")

        except Exception as e:
            logger.error(f"Error in {self.agent_name}: {e}", exc_info=True)
            duration_ms = (time.perf_counter() - start_time) * 1000
            state["agents"]["investment"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": str(e),
                "confidence_score": 0.0,
                "duration_ms": duration_ms
            }
            state["error"] = f"{self.agent_name} failed: {e}"

        logger.info(f"[DEBUG LOG] [{time.perf_counter() - start_time:.2f}s] Exiting {self.agent_name}. Return state.")
        return state
