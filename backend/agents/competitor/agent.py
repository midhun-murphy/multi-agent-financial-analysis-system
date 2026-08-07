import time
import json
import os
import asyncio
import requests
import yfinance as yf
from typing import Dict, Any, List, Union
from pydantic import BaseModel, Field
from backend.agents.base.agent import BaseAgent
from backend.state.analysis_state import AnalysisState
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# User-Agent request session to prevent 429 errors from Yahoo Finance
session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
})

# Pydantic schemas for the agent outputs
class CompetitorAnalysisOutput(BaseModel):
    industry: str = Field(..., description="Detected company industry.")
    competitors: List[Dict[str, Any]] = Field(..., description="List of competitors with all metrics.")
    comparison_summary: str = Field(..., description="AI narrative summary referencing numbers.")
    rankings: List[Dict[str, Any]] = Field(default=[], description="Sorted rankings.")
    leader: Dict[str, Any] = Field(default={}, description="Strategic leader details.")
    averages: Dict[str, Any] = Field(default={}, description="Average industry metrics.")
    best_performer: Dict[str, Any] = Field(default={}, description="Best performers per metric.")
    weakest_performer: Dict[str, Any] = Field(default={}, description="Weakest performers per metric.")
    radar_comparison: Dict[str, Any] = Field(default={}, description="Radar chart data.")
    strengths: List[str] = Field(default=[], description="Target company strengths compared to peers.")
    weaknesses: List[str] = Field(default=[], description="Target company weaknesses compared to peers.")
    overall_score: float = Field(default=0.0, description="Dynamic score of target company (0-100).")

class CompetitorAgent(BaseAgent):
    """
    Competitor Analysis Agent.
    Retrieves dynamic competitors using maintained mapping or yfinance metadata,
    compares live metrics from Yahoo Finance, computes dynamic weighted scores,
    and constructs a comprehensive comparison dashboard payload.
    """
    def __init__(self) -> None:
        super().__init__("Competitor Agent")

    async def run(self, state: AnalysisState) -> AnalysisState:
        logger.info(f"Running {self.agent_name}")
        start_time = time.perf_counter()

        # 1. Identify Target Ticker & Info
        target_ticker = state["session"].get("ticker", "TICKER")
        target_company_name = state["session"].get("company_name", target_ticker)
        industry = state["metadata"].get("industry", "Technology")
        sector = state["metadata"].get("sector", "Technology")

        # 2. Competitor Discovery
        # Fallback mappings loader
        peer_tickers = []
        mapping_path = os.path.join(os.path.dirname(__file__), "peer_mapping.json")
        try:
            with open(mapping_path, "r") as f:
                peer_mapping = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load peer_mapping.json: {e}")
            peer_mapping = {
                "AAPL": ["MSFT", "GOOGL", "DELL", "HPQ"],
                "WIT": ["INFY.NS", "TCS.NS", "HCLTECH.NS", "TECHM.NS"],
                "WIPRO": ["INFY.NS", "TCS.NS", "HCLTECH.NS", "TECHM.NS"],
                "WIPRO.NS": ["INFY.NS", "TCS.NS", "HCLTECH.NS", "TECHM.NS"],
                "TSLA": ["BYDDY", "F", "GM", "RIVN"]
            }

        # Resolve peer list
        norm_ticker = target_ticker.upper().strip()
        if norm_ticker in peer_mapping:
            peer_tickers = peer_mapping[norm_ticker]
            logger.info(f"Found peer mapping for {norm_ticker}: {peer_tickers}")
        else:
            # Fallback based on industry / sector metadata
            ind_lower = industry.lower()
            sec_lower = sector.lower()
            if "auto" in ind_lower or "auto" in sec_lower or "car" in ind_lower:
                peer_tickers = ["TSLA", "BYDDY", "F", "GM", "RIVN"]
            elif "tech" in ind_lower or "software" in ind_lower or "tech" in sec_lower:
                peer_tickers = ["AAPL", "MSFT", "GOOGL", "DELL", "HPQ"]
            else:
                # General default peers
                peer_tickers = ["MSFT", "AAPL", "GOOGL"]
            logger.info(f"Using industry/sector fallback peers for {norm_ticker}: {peer_tickers}")

        # Remove duplicate target if present
        peer_tickers = [t for t in peer_tickers if t.upper().strip() != norm_ticker][:5]

        # 3. Data Collection (Target and Competitors)
        # Fetch target live market data
        target_live_data = await self.fetch_live_market_data(target_ticker)
        
        # Build Target Company Data using PDF Extracted values + Live Market values
        fm_output = state["agents"].get("financial_metrics", {}).get("output") or {}
        fr_output = state["agents"].get("financial_ratios", {}).get("output") or {}
        
        latest_metrics = fm_output.get("latest_metrics") or {}
        latest_ratios = fr_output.get("latest_ratios") or {}

        def get_target_metric(key_list):
            for k in key_list:
                if k in latest_ratios and latest_ratios[k] not in [None, "Not Available"]:
                    return latest_ratios[k]
                if k in latest_metrics and latest_metrics[k] not in [None, "Not Available"]:
                    return latest_metrics[k]
            return "Not Available"

        def clean_val(val, to_percentage=False, divide_by_1m=False):
            if val is None or val == "Not Available" or str(val) == "NaN" or str(val) == "nan":
                return "Not Available"
            try:
                f = float(val)
                if divide_by_1m and f > 1e6:
                    f = f / 1e6
                if to_percentage:
                    if abs(f) <= 2.0:
                        f = f * 100.0
                return round(f, 2)
            except Exception:
                return "Not Available"

        # Construct target metrics combining PDF (priority) and Live Market Data
        target_comp_data = {
            "name": target_company_name,
            "ticker": target_ticker,
            "market_cap": clean_val(get_target_metric(["market_cap", "market_capitalization"])) if get_target_metric(["market_cap", "market_capitalization"]) != "Not Available" else target_live_data.get("market_cap"),
            "current_market_cap": clean_val(get_target_metric(["market_cap", "market_capitalization"])) if get_target_metric(["market_cap", "market_capitalization"]) != "Not Available" else target_live_data.get("market_cap"),
            "revenue": clean_val(get_target_metric(["revenue"]), divide_by_1m=True),
            "net_profit": clean_val(get_target_metric(["net_profit", "net_income"]), divide_by_1m=True),
            "roe": clean_val(get_target_metric(["roe", "roe_pct"]), to_percentage=True),
            "roa": clean_val(get_target_metric(["roa", "roa_pct"]), to_percentage=True),
            "operating_margin": clean_val(get_target_metric(["operating_margin", "operating_margin_pct"]), to_percentage=True),
            "net_margin": clean_val(get_target_metric(["net_margin", "net_margin_pct"]), to_percentage=True),
            "current_ratio": clean_val(get_target_metric(["current_ratio"])),
            "debt_to_equity": clean_val(get_target_metric(["debt_to_equity"])),
            "pe": clean_val(get_target_metric(["pe", "pe_ratio"])) if get_target_metric(["pe", "pe_ratio"]) != "Not Available" else target_live_data.get("pe"),
            "dividend_yield": clean_val(get_target_metric(["dividend_yield"]), to_percentage=True) if get_target_metric(["dividend_yield"]) != "Not Available" else target_live_data.get("dividend_yield"),
            "ebitda_margin": clean_val(get_target_metric(["ebitda_margin", "ebitda_margin_pct"]), to_percentage=True),
            "price": target_live_data.get("price"),
            "week_52_high": target_live_data.get("week_52_high"),
            "week_52_low": target_live_data.get("week_52_low"),
            "recommendation": target_live_data.get("recommendation", "HOLD"),
            "exchange": target_live_data.get("exchange", "Not Available"),
            "sector": sector,
            "industry": industry,
            "currency": target_live_data.get("currency", "USD"),
            "is_target": True
        }

        # Fetch competitors live market data
        peers_data = []
        for peer in peer_tickers:
            peer_live = await self.fetch_live_market_data(peer)
            peers_data.append(peer_live)

        # 4. Comparison Engine & Scoring
        comparison_results = self.run_comparison_engine(target_comp_data, peers_data)

        # 5. AI Summary Generation (referencing actual numbers)
        target_summary_info = {
            "name": target_comp_data["name"],
            "ticker": target_comp_data["ticker"],
            "revenue": target_comp_data["revenue"],
            "operating_margin": target_comp_data["operating_margin"],
            "roe": target_comp_data["roe"],
            "current_ratio": target_comp_data["current_ratio"],
            "debt_to_equity": target_comp_data["debt_to_equity"],
            "pe": target_comp_data["pe"]
        }
        
        peers_summary_info = [
            {
                "name": p["name"],
                "ticker": p["ticker"],
                "revenue": p["revenue"],
                "operating_margin": p["operating_margin"],
                "roe": p["roe"],
                "current_ratio": p["current_ratio"],
                "debt_to_equity": p["debt_to_equity"],
                "pe": p["pe"]
            } for p in peers_data
        ]
        
        system_instruction = (
            "You are a professional financial analyst. Your role is to write a concise 2-3 paragraph "
            "competitor comparison analysis summary. "
            "You MUST reference actual numbers from the provided target and peer data in your text "
            "(e.g., 'Wipro's operating margin of 19.8% exceeds the peer average of 17.1%'). "
            "Do not use generic text or placeholders. Conclude with a clear statement on the competitive leader."
        )
        
        user_prompt = (
            f"Target Company Data:\n{json.dumps(target_summary_info, indent=2)}\n\n"
            f"Peers Data:\n{json.dumps(peers_summary_info, indent=2)}\n\n"
            f"Industry Averages:\n{json.dumps(comparison_results['averages'], indent=2)}\n\n"
            "Return a JSON object conforming exactly to this structure:\n"
            "{\n"
            "  \"comparison_summary\": \"detailed comparison text referencing actual numbers\"\n"
            "}"
        )
        
        comparison_summary = ""
        try:
            response_text = self.llm_service.generate(prompt=user_prompt, system_instruction=system_instruction)
            parsed = self._parse_json_response(response_text)
            comparison_summary = parsed.get("comparison_summary", "")
        except Exception as llm_err:
            logger.warning(f"LLM competitor comparison generation failed: {llm_err}")
            
        # Fallback comparison summary if LLM fails
        if not comparison_summary:
            t_name = target_comp_data["name"]
            t_om = target_comp_data["operating_margin"]
            avg_om = comparison_results['averages'].get('operating_margin')
            leader_name = comparison_results['leader']['name']
            
            om_text = f"{t_name}'s operating margin of {t_om}%" if isinstance(t_om, (int, float)) else f"{t_name}'s operating margin"
            avg_om_text = f"the peer average of {avg_om}%" if isinstance(avg_om, (int, float)) else "the peer average"
            
            comparison_summary = (
                f"Financial comparison for {t_name} against its sector competitors. "
                f"Operational analysis shows that {om_text} compares with {avg_om_text}. "
                f"Overall competitive scoring ranks {leader_name} as the current industry leader in this peer group based on weighted profitability, leverage, and valuation parameters."
            )

        # 6. Format Final Outputs
        all_companies = [target_comp_data] + peers_data
        outputs = CompetitorAnalysisOutput(
            industry=industry,
            competitors=all_companies,
            comparison_summary=comparison_summary,
            rankings=comparison_results["rankings"],
            leader=comparison_results["leader"],
            averages=comparison_results["averages"],
            best_performer=comparison_results["best_performer"],
            weakest_performer=comparison_results["weakest_performer"],
            radar_comparison=comparison_results["radar_comparison"],
            strengths=comparison_results["strengths"],
            weaknesses=comparison_results["weaknesses"],
            overall_score=comparison_results["overall_score"]
        )

        duration_ms = (time.perf_counter() - start_time) * 1000
        output_payload = outputs.model_dump()
        output_payload["overall_score"] = comparison_results["overall_score"]
        output_payload["rationale"] = comparison_summary
        output_payload["winner"] = f"{comparison_results['leader']['name']} ({comparison_results['leader']['ticker']})"
        output_payload["ranking"] = comparison_results["rankings"]

        state["agents"]["competitor"] = {
            "agent_name": self.agent_name,
            "status": "completed",
            "output": output_payload,
            "error": None,
            "confidence_score": 0.90,
            "duration_ms": duration_ms
        }
        
        logger.info(f"{self.agent_name} completed successfully in {duration_ms:.2f}ms.")
        return state

    async def fetch_live_market_data(self, ticker: str) -> Dict[str, Any]:
        """
        Queries Yahoo Finance via yfinance directly to fetch requested live competitor/target metrics.
        Returns a dictionary of normalized values.
        """
        def _get_info(t_str):
            try:
                t = yf.Ticker(t_str, session=session)
                info = t.info
                if info and len(info) > 3:
                    return info
            except Exception as e:
                logger.warning(f"[{t_str}] yfinance info fetch failed: {e}")
            
            # Fast info fallback
            try:
                t = yf.Ticker(t_str, session=session)
                fi = t.fast_info
                return {
                    "shortName": t_str,
                    "marketCap": getattr(fi, "market_cap", None),
                    "currentPrice": getattr(fi, "last_price", None),
                    "fiftyTwoWeekHigh": getattr(fi, "year_high", None),
                    "fiftyTwoWeekLow": getattr(fi, "year_low", None),
                }
            except Exception as e:
                logger.warning(f"[{t_str}] yfinance fast_info fetch failed: {e}")
            return {}

        info = await asyncio.to_thread(_get_info, ticker)

        def clean_val(val, to_percentage=False, divide_by_1m=False):
            if val is None or val == "Not Available" or str(val) == "NaN" or str(val) == "nan":
                return "Not Available"
            try:
                f = float(val)
                if divide_by_1m:
                    f = f / 1e6
                if to_percentage:
                    # If it's a small decimal (e.g. <= 2.0), scale to percentage
                    if abs(f) <= 2.0:
                        f = f * 100.0
                return round(f, 2)
            except Exception:
                return "Not Available"

        # Analyst recommendation cleanup
        rec = info.get("recommendationKey") or info.get("recommendationMean") or "Not Available"
        if isinstance(rec, float):
            if rec <= 1.5: rec = "strong_buy"
            elif rec <= 2.5: rec = "buy"
            elif rec <= 3.5: rec = "hold"
            elif rec <= 4.5: rec = "sell"
            else: rec = "strong_sell"
        rec = str(rec).replace("_", " ").upper()

        # D/E in yfinance is percentage format (e.g., 60.5 = 60.5% = 0.605 ratio)
        raw_de = info.get("debtToEquity")
        if isinstance(raw_de, (int, float)) and raw_de > 3.0:
            raw_de = raw_de / 100.0

        return {
            "name": info.get("shortName") or info.get("longName") or ticker,
            "ticker": ticker,
            "market_cap": clean_val(info.get("marketCap"), divide_by_1m=True),
            "current_market_cap": clean_val(info.get("marketCap"), divide_by_1m=True),
            "revenue": clean_val(info.get("totalRevenue"), divide_by_1m=True),
            "net_profit": clean_val(info.get("netIncomeToCommon") or info.get("netIncome"), divide_by_1m=True),
            "roe": clean_val(info.get("returnOnEquity"), to_percentage=True),
            "roa": clean_val(info.get("returnOnAssets"), to_percentage=True),
            "operating_margin": clean_val(info.get("operatingMargins"), to_percentage=True),
            "net_margin": clean_val(info.get("profitMargins"), to_percentage=True),
            "current_ratio": clean_val(info.get("currentRatio")),
            "debt_to_equity": clean_val(raw_de),
            "pe": clean_val(info.get("trailingPE") or info.get("forwardPE")),
            "dividend_yield": clean_val(info.get("dividendYield"), to_percentage=True),
            "ebitda_margin": clean_val(info.get("ebitdaMargins"), to_percentage=True),
            "price": clean_val(info.get("currentPrice") or info.get("regularMarketPrice")),
            "week_52_high": clean_val(info.get("fiftyTwoWeekHigh")),
            "week_52_low": clean_val(info.get("fiftyTwoWeekLow")),
            "recommendation": rec,
            "exchange": info.get("exchange", "Not Available"),
            "sector": info.get("sector", "Not Available"),
            "industry": info.get("industry", "Not Available"),
            "currency": info.get("currency", "USD"),
            "is_target": False
        }

    def run_comparison_engine(self, target: Dict[str, Any], peers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Compares target company against peers.
        Computes overall dynamic score, category breakdowns, averages, best/weakest performers,
        and target strengths/weaknesses.
        """
        all_companies = [target] + peers
        
        # Helper to compute category and overall scores
        def compute_scores(comp):
            def get_num(key, default_val):
                val = comp.get(key)
                if val is None or val == "Not Available":
                    return default_val
                try:
                    return float(val)
                except Exception:
                    return default_val

            roe = get_num("roe", 12.0)
            op_margin = get_num("operating_margin", 10.0)
            net_margin = get_num("net_margin", 8.0)
            current_ratio = get_num("current_ratio", 1.2)
            debt_equity = get_num("debt_to_equity", 0.8)
            pe = get_num("pe", 20.0)
            roa = get_num("roa", 6.0)
            
            # 1. Profitability (Weight: 20%)
            roe_score = min(100.0, max(0.0, (roe / 25.0) * 100.0))
            op_m_score = min(100.0, max(0.0, (op_margin / 25.0) * 100.0))
            net_m_score = min(100.0, max(0.0, (net_margin / 20.0) * 100.0))
            profitability = round((roe_score + op_m_score + net_m_score) / 3, 2)
            
            # 2. Liquidity (Weight: 15%)
            if current_ratio >= 1.5:
                liquidity = 95.0
            elif current_ratio >= 1.0:
                liquidity = 75.0
            else:
                liquidity = 45.0
                
            # 3. Efficiency (Weight: 15%)
            efficiency = min(100.0, max(0.0, (roa / 12.0) * 100.0))
            
            # 4. Leverage (Weight: 15%)
            if debt_equity <= 0.4:
                leverage = 95.0
            elif debt_equity <= 1.0:
                leverage = 80.0
            elif debt_equity <= 2.0:
                leverage = 60.0
            else:
                leverage = 35.0
                
            # 5. Valuation (Weight: 15%)
            if pe <= 15.0:
                valuation = 90.0
            elif pe <= 25.0:
                valuation = 75.0
            elif pe <= 40.0:
                valuation = 55.0
            else:
                valuation = 30.0
                
            # 6. Growth (Weight: 10%)
            growth = 75.0
            
            # 7. Market Position (Weight: 10%) - default, will be adjusted dynamically
            mc = get_num("market_cap", 1000.0)
            if mc > 100000.0:
                market_position = 95.0
            elif mc > 10000.0:
                market_position = 80.0
            elif mc > 1000.0:
                market_position = 65.0
            else:
                market_position = 50.0
                
            overall = (
                profitability * 0.20 +
                liquidity * 0.15 +
                efficiency * 0.15 +
                leverage * 0.15 +
                valuation * 0.15 +
                growth * 0.10 +
                market_position * 0.10
            )
            
            return {
                "overall": round(overall, 2),
                "breakdown": {
                    "Profitability": profitability,
                    "Liquidity": liquidity,
                    "Efficiency": efficiency,
                    "Leverage": leverage,
                    "Valuation": valuation,
                    "Growth": growth,
                    "Market Position": market_position
                }
            }

        # Calculate initial scores
        for comp in all_companies:
            score_res = compute_scores(comp)
            comp["overall_score"] = score_res["overall"]
            comp["score_breakdown"] = score_res["breakdown"]

        # Adjust Market Position dynamically based on market cap rankings
        valid_mc_companies = [c for c in all_companies if isinstance(c.get("market_cap"), (int, float))]
        if len(valid_mc_companies) > 0:
            valid_mc_companies.sort(key=lambda x: x["market_cap"], reverse=True)
            for idx, c in enumerate(valid_mc_companies):
                rank_score = 100.0 if len(valid_mc_companies) == 1 else 100.0 - (idx / (len(valid_mc_companies) - 1)) * 40.0
                c["score_breakdown"]["Market Position"] = round(rank_score, 2)
                # Re-calculate overall score
                b = c["score_breakdown"]
                c["overall_score"] = round(
                    b["Profitability"] * 0.20 +
                    b["Liquidity"] * 0.15 +
                    b["Efficiency"] * 0.15 +
                    b["Leverage"] * 0.15 +
                    b["Valuation"] * 0.15 +
                    b["Growth"] * 0.10 +
                    b["Market Position"] * 0.10,
                    2
                )

        # Build rankings
        rankings = sorted(
            [{"name": c["name"], "ticker": c["ticker"], "combinedScore": c["overall_score"], "is_target": c["is_target"]} for c in all_companies],
            key=lambda x: x["combinedScore"],
            reverse=True
        )
        leader = rankings[0]

        # Standard compare fields
        numeric_fields = [
            "market_cap", "revenue", "net_profit", "roe", "roa",
            "operating_margin", "net_margin", "current_ratio",
            "debt_to_equity", "pe", "dividend_yield", "ebitda_margin",
            "price", "week_52_high", "week_52_low", "current_market_cap"
        ]

        averages = {}
        best_performer = {}
        weakest_performer = {}

        def is_better(field, val1, val2):
            if field in ["pe", "debt_to_equity"]:
                return val1 < val2
            return val1 > val2

        for field in numeric_fields:
            vals = []
            for c in all_companies:
                val = c.get(field)
                if isinstance(val, (int, float)):
                    vals.append((val, c))
                    
            if vals:
                avg_val = round(sum(v[0] for v in vals) / len(vals), 2)
                averages[field] = avg_val
                
                best_val = vals[0][0]
                best_c = vals[0][1]
                weak_val = vals[0][0]
                weak_c = vals[0][1]
                
                for v, c in vals[1:]:
                    if is_better(field, v, best_val):
                        best_val = v
                        best_c = c
                    if is_better(field, weak_val, v):
                        weak_val = v
                        weak_c = c
                
                best_performer[field] = {"name": best_c["name"], "ticker": best_c["ticker"], "value": best_val}
                weakest_performer[field] = {"name": weak_c["name"], "ticker": weak_c["ticker"], "value": weak_val}
            else:
                averages[field] = "Not Available"
                best_performer[field] = "Not Available"
                weakest_performer[field] = "Not Available"

        # Categories for radar chart comparison
        categories = ["Profitability", "Liquidity", "Efficiency", "Leverage", "Valuation", "Growth", "Market Position"]
        radar_comparison = {
            "categories": categories,
            "target": [target["score_breakdown"][cat] for cat in categories],
            "peers": {
                p["ticker"]: [p["score_breakdown"][cat] for cat in categories] for p in peers
            }
        }

        # Strengths and Weaknesses
        strengths = []
        weaknesses = []

        t_roe = target.get("roe")
        avg_roe = averages.get("roe")
        if isinstance(t_roe, (int, float)) and isinstance(avg_roe, (int, float)) and t_roe != avg_roe:
            if t_roe > avg_roe:
                strengths.append(f"Return on Equity (ROE) of {t_roe:.2f}% exceeds the peer average of {avg_roe:.2f}%.")
            else:
                weaknesses.append(f"Return on Equity (ROE) of {t_roe:.2f}% lags the peer average of {avg_roe:.2f}%.")
                
        t_om = target.get("operating_margin")
        avg_om = averages.get("operating_margin")
        if isinstance(t_om, (int, float)) and isinstance(avg_om, (int, float)) and t_om != avg_om:
            if t_om > avg_om:
                strengths.append(f"Operating margin of {t_om:.2f}% outperforms the peer average of {avg_om:.2f}%.")
            else:
                weaknesses.append(f"Operating margin of {t_om:.2f}% is below the peer average of {avg_om:.2f}%.")
                
        t_cr = target.get("current_ratio")
        avg_cr = averages.get("current_ratio")
        if isinstance(t_cr, (int, float)) and isinstance(avg_cr, (int, float)) and t_cr != avg_cr:
            if t_cr > avg_cr:
                strengths.append(f"Current Ratio of {t_cr:.2f}x indicates stronger short-term liquidity compared to peer average of {avg_cr:.2f}x.")
            else:
                weaknesses.append(f"Current Ratio of {t_cr:.2f}x indicates lower liquidity buffer relative to peer average of {avg_cr:.2f}x.")
                
        t_de = target.get("debt_to_equity")
        avg_de = averages.get("debt_to_equity")
        if isinstance(t_de, (int, float)) and isinstance(avg_de, (int, float)) and t_de != avg_de:
            if t_de < avg_de:
                strengths.append(f"Debt-to-Equity ratio of {t_de:.2f} shows a more conservative leverage profile than the peer average of {avg_de:.2f}.")
            else:
                weaknesses.append(f"Debt-to-Equity ratio of {t_de:.2f} reflects higher financial leverage compared to the peer average of {avg_de:.2f}.")
                
        t_pe = target.get("pe")
        avg_pe = averages.get("pe")
        if isinstance(t_pe, (int, float)) and isinstance(avg_pe, (int, float)) and t_pe != avg_pe:
            if t_pe < avg_pe:
                strengths.append(f"Trading at a lower P/E multiple of {t_pe:.2f}x compared to the peer average of {avg_pe:.2f}x (valuation discount).")
            else:
                weaknesses.append(f"Trading at a higher P/E multiple of {t_pe:.2f}x compared to the peer average of {avg_pe:.2f}x (valuation premium).")

        if not strengths:
            strengths.append(f"Target company maintains a stable financial position with an overall score of {target['overall_score']:.1f}/100.")
        if not weaknesses:
            weaknesses.append(f"Valuation metrics suggest standard competitive exposure in the {target.get('industry', 'industry')} sector.")

        return {
            "rankings": rankings,
            "leader": leader,
            "averages": averages,
            "best_performer": best_performer,
            "weakest_performer": weakest_performer,
            "radar_comparison": radar_comparison,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "overall_score": target["overall_score"]
        }
