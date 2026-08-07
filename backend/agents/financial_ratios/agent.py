import time
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from backend.state.analysis_state import AnalysisState
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Input and Output schemas for Financial Ratios Agent
class FinancialRatiosInput(BaseModel):
    financial_metrics: Dict[str, Any] = Field(..., description="Metrics output dictionary from Financial Metrics Agent.")
    parsed_statements: Dict[str, Any] = Field(..., description="Raw parsed statement details.")

class RatiosByYear(BaseModel):
    # Profitability
    gross_margin: Any = Field("Not Available")
    operating_margin: Any = Field("Not Available")
    net_margin: Any = Field("Not Available")
    ebitda_margin: Any = Field("Not Available")
    roa: Any = Field("Not Available")
    roe: Any = Field("Not Available")
    roce: Any = Field("Not Available")
    eps: Any = Field("Not Available")

    # Liquidity
    current_ratio: Any = Field("Not Available")
    quick_ratio: Any = Field("Not Available")
    cash_ratio: Any = Field("Not Available")
    working_capital: Any = Field("Not Available")
    working_capital_ratio: Any = Field("Not Available")

    # Efficiency
    asset_turnover: Any = Field("Not Available")
    inventory_turnover: Any = Field("Not Available")
    receivable_turnover: Any = Field("Not Available")
    payable_turnover: Any = Field("Not Available")
    working_capital_turnover: Any = Field("Not Available")

    # Solvency
    debt_to_equity: Any = Field("Not Available")
    debt_to_assets: Any = Field("Not Available")
    debt_ratio: Any = Field("Not Available")
    equity_ratio: Any = Field("Not Available")
    interest_coverage: Any = Field("Not Available")
    financial_leverage: Any = Field("Not Available")
    long_term_debt_ratio: Any = Field("Not Available")

class FinancialRatiosOutput(BaseModel):
    latest_year: str = Field(..., description="Latest financial reporting year.")
    latest_ratios: RatiosByYear = Field(..., description="Ratios for the latest year.")
    historical_ratios: Dict[str, RatiosByYear] = Field(..., description="Ratios mapped by historical year.")
    validation_report: Dict[str, Any] = Field(default={}, description="Ratios calculation and mapping audit validation report.")

class FinancialRatiosAgent:
    """
    Financial Ratios Agent.
    Calculates key financial ratios programmatically using metrics from the RAG pipeline
    and parser statements, avoiding model hallucinations or math errors.
    """
    def __init__(self) -> None:
        self.agent_name = "Financial Ratios Agent"

    def run(self, state: AnalysisState) -> AnalysisState:
        logger.info(f"Running {self.agent_name}")
        start_time = time.perf_counter()
        
        metrics_agent_data = state["agents"].get("financial_metrics", {})
        unified_financial_json = state["metadata"].get("unified_financial_json", {})

        if not metrics_agent_data or metrics_agent_data.get("status") != "completed":
            logger.error("Financial Metrics Agent must complete successfully before running Financial Ratios Agent.")
            state["agents"]["financial_ratios"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": "Dependency failed: Financial Metrics Agent is missing or did not complete.",
                "confidence_score": 0.0,
                "duration_ms": 0.0
            }
            state["error"] = "Financial Ratios Agent missing metrics dependencies."
            return state

        try:
            # 1. Fetch metadata and detected years
            metrics_output = metrics_agent_data["output"]
            detected_years = metrics_output.get("detected_years", ["2024", "2023", "2022"])
            latest_year = metrics_output.get("latest_year", detected_years[0] if detected_years else "2024")
            
            # Helper to extract clean float or None from Unified Financial JSON
            def get_metric_val(metric_name: str, yr: str) -> Optional[float]:
                metric_data = unified_financial_json.get(metric_name, {})
                year_data = metric_data.get(yr, {})
                val = year_data.get("value")
                if val in [None, "Not Available", "N/A", "nan", "NaN"]:
                    return None
                try:
                    return float(str(val).replace(",", "").strip())
                except (ValueError, TypeError):
                    return None

            # Safe division helper
            def safe_divide(num: Optional[float], den: Optional[float]) -> Optional[float]:
                if num is None or den is None or den == 0.0:
                    return None
                return float(num / den)

            historical_ratios: Dict[str, RatiosByYear] = {}

            # Calculate ratios for each year
            for year in detected_years:
                # ── Retrieve metrics ──
                rev = get_metric_val("revenue", year)
                gp = get_metric_val("gross_profit", year)
                ebit = get_metric_val("ebit", year)
                ebitda = get_metric_val("ebitda", year)
                np_profit = get_metric_val("net_profit", year) or get_metric_val("net_income", year)
                tot_assets = get_metric_val("total_assets", year)
                curr_assets = get_metric_val("current_assets", year)
                curr_liab = get_metric_val("current_liabilities", year)
                inventory = get_metric_val("inventory", year) or 0.0
                cash = get_metric_val("cash_and_cash_equivalents", year) or 0.0
                ar = get_metric_val("accounts_receivable", year) or 0.0
                ap = get_metric_val("accounts_payable", year) or 0.0
                cogs = get_metric_val("cost_of_goods_sold", year) or get_metric_val("cost_of_revenue", year)
                
                # Debt & Equity
                std = get_metric_val("short_term_debt", year) or 0.0
                ltd = get_metric_val("long_term_debt", year) or 0.0
                debt_val = get_metric_val("total_debt", year) or (std + ltd)
                eq = get_metric_val("shareholders_equity", year) or get_metric_val("total_equity", year)
                tot_liab = get_metric_val("total_liabilities", year)
                
                # Interest and EPS
                interest_exp = get_metric_val("interest_expense", year) or get_metric_val("finance_cost", year)
                eps = get_metric_val("eps", year) or get_metric_val("diluted_eps", year)

                # ── Profitability Ratios ──
                gm = safe_divide(gp, rev)
                om = safe_divide(ebit, rev)
                nm = safe_divide(np_profit, rev)
                ebm = safe_divide(ebitda, rev)
                roa = safe_divide(np_profit, tot_assets)
                roe = safe_divide(np_profit, eq)
                roce = safe_divide(ebit, safe_divide(tot_assets, 1.0) if curr_liab is None else (tot_assets - curr_liab))

                # Multiply margins by 100 for percentage output
                gross_margin = round(gm * 100, 2) if gm is not None else "Not Available"
                operating_margin = round(om * 100, 2) if om is not None else "Not Available"
                net_margin = round(nm * 100, 2) if nm is not None else "Not Available"
                ebitda_margin = round(ebm * 100, 2) if ebm is not None else "Not Available"
                roa_val = round(roa * 100, 2) if roa is not None else "Not Available"
                roe_val = round(roe * 100, 2) if roe is not None else "Not Available"
                roce_val = round(roce * 100, 2) if roce is not None else "Not Available"
                eps_val = round(eps, 2) if eps is not None else "Not Available"

                # ── Liquidity Ratios ──
                current_ratio = round(safe_divide(curr_assets, curr_liab), 2) if curr_assets is not None and curr_liab else "Not Available"
                quick_ratio = round(safe_divide(curr_assets - inventory, curr_liab), 2) if curr_assets is not None and curr_liab else "Not Available"
                cash_ratio = round(safe_divide(cash, curr_liab), 2) if curr_liab else "Not Available"
                working_capital = round(curr_assets - curr_liab, 2) if curr_assets is not None and curr_liab is not None else "Not Available"
                working_capital_ratio = round(safe_divide(working_capital if isinstance(working_capital, (int, float)) else None, tot_assets), 2) if tot_assets else "Not Available"

                # ── Efficiency Ratios ──
                asset_turnover = round(safe_divide(rev, tot_assets), 2) if tot_assets else "Not Available"
                inventory_turnover = round(safe_divide(cogs or rev, inventory if inventory else None), 2) if inventory else "Not Available"
                receivable_turnover = round(safe_divide(rev, ar if ar else None), 2) if ar else "Not Available"
                payable_turnover = round(safe_divide(cogs or rev, ap if ap else None), 2) if ap else "Not Available"
                
                wc_val = curr_assets - curr_liab if curr_assets is not None and curr_liab is not None else 0.0
                working_capital_turnover = round(safe_divide(rev, wc_val if wc_val else None), 2) if wc_val else "Not Available"

                # ── Solvency Ratios ──
                debt_to_equity = round(safe_divide(debt_val or tot_liab, eq), 2) if eq else "Not Available"
                debt_ratio = round(safe_divide(tot_liab, tot_assets), 2) if tot_assets else "Not Available"
                debt_to_assets = round(safe_divide(debt_val, tot_assets), 2) if tot_assets else "Not Available"
                equity_ratio = round(safe_divide(eq, tot_assets), 2) if tot_assets else "Not Available"
                financial_leverage = round(safe_divide(tot_assets, eq), 2) if eq else "Not Available"
                interest_coverage = round(safe_divide(ebit, interest_exp), 2) if interest_exp else "Not Available"
                long_term_debt_ratio = round(safe_divide(ltd, tot_assets), 2) if tot_assets else "Not Available"

                ratios_by_year = RatiosByYear(
                    gross_margin=gross_margin,
                    operating_margin=operating_margin,
                    net_margin=net_margin,
                    ebitda_margin=ebitda_margin,
                    roa=roa_val,
                    roe=roe_val,
                    roce=roce_val,
                    eps=eps_val,
                    
                    current_ratio=current_ratio,
                    quick_ratio=quick_ratio,
                    cash_ratio=cash_ratio,
                    working_capital=working_capital,
                    working_capital_ratio=working_capital_ratio,
                    
                    asset_turnover=asset_turnover,
                    inventory_turnover=inventory_turnover,
                    receivable_turnover=receivable_turnover,
                    payable_turnover=payable_turnover,
                    working_capital_turnover=working_capital_turnover,
                    
                    debt_to_equity=debt_to_equity,
                    debt_to_assets=debt_to_assets,
                    debt_ratio=debt_ratio,
                    equity_ratio=equity_ratio,
                    interest_coverage=interest_coverage,
                    financial_leverage=financial_leverage,
                    long_term_debt_ratio=long_term_debt_ratio
                )
                historical_ratios[year] = ratios_by_year

            latest_ratios = historical_ratios.get(latest_year, RatiosByYear())

            # ── 3. Validate and Generate validation report ──
            METRIC_DISPLAY_NAMES = {
                "revenue": "Revenue",
                "revenue_from_operations": "Revenue From Operations",
                "net_sales": "Net Sales",
                "cost_of_goods_sold": "Cost of Goods Sold",
                "cost_of_revenue": "Cost of Revenue",
                "gross_profit": "Gross Profit",
                "operating_expenses": "Operating Expenses",
                "selling_expenses": "Selling Expenses",
                "administrative_expenses": "Administrative Expenses",
                "research_and_development": "Research & Development",
                "depreciation": "Depreciation",
                "amortization": "Amortization",
                "ebit": "EBIT",
                "ebitda": "EBITDA",
                "finance_cost": "Finance Cost",
                "interest_expense": "Interest Expense",
                "other_income": "Other Income",
                "pre_tax_income": "Pre-Tax Income",
                "income_tax": "Income Tax",
                "net_income": "Net Income",
                "net_profit": "Net Profit",
                "eps": "EPS",
                "diluted_eps": "Diluted EPS",
                "shares_outstanding": "Shares Outstanding",
                "cash_and_cash_equivalents": "Cash & Cash Equivalents",
                "short_term_investments": "Short-Term Investments",
                "accounts_receivable": "Accounts Receivable",
                "inventory": "Inventory",
                "current_assets": "Current Assets",
                "property_plant_equipment": "Property Plant Equipment",
                "goodwill": "Goodwill",
                "intangible_assets": "Intangible Assets",
                "long_term_investments": "Long-Term Investments",
                "total_assets": "Total Assets",
                "accounts_payable": "Accounts Payable",
                "short_term_debt": "Short-Term Debt",
                "current_liabilities": "Current Liabilities",
                "long_term_debt": "Long-Term Debt",
                "lease_liabilities": "Lease Liabilities",
                "total_debt": "Total Debt",
                "total_liabilities": "Total Liabilities",
                "share_capital": "Share Capital",
                "retained_earnings": "Retained Earnings",
                "total_equity": "Total Equity",
                "shareholders_equity": "Shareholders Equity",
                "book_value": "Book Value",
                "operating_cash_flow": "Operating Cash Flow",
                "capital_expenditure": "Capital Expenditure",
                "free_cash_flow": "Free Cash Flow",
                "investing_cash_flow": "Investing Cash Flow",
                "financing_cash_flow": "Financing Cash Flow",
                "dividend_paid": "Dividend Paid",
                "stock_buyback": "Stock Buyback",
                "net_change_in_cash": "Net Change in Cash",
            }

            extracted_metrics_count = 0
            missing_metrics_count = 0
            missing_source_metrics = []

            for m_key, m_name in METRIC_DISPLAY_NAMES.items():
                if get_metric_val(m_key, latest_year) is not None:
                    extracted_metrics_count += 1
                else:
                    missing_metrics_count += 1
                    missing_source_metrics.append(m_name)

            total_ratios_count = len(RatiosByYear.model_fields)
            calculated_ratios_count = 0
            missing_ratios_count = 0
            for field in RatiosByYear.model_fields.keys():
                v = getattr(latest_ratios, field)
                if v != "Not Available" and v is not None:
                    calculated_ratios_count += 1
                else:
                    missing_ratios_count += 1

            validation_report = {
                "metrics_extracted": extracted_metrics_count,
                "metrics_missing": missing_metrics_count,
                "ratios_calculated": calculated_ratios_count,
                "ratios_missing": missing_ratios_count,
                "missing_source_metrics": missing_source_metrics
            }

            outputs = FinancialRatiosOutput(
                latest_year=latest_year,
                latest_ratios=latest_ratios,
                historical_ratios=historical_ratios,
                validation_report=validation_report
            )

            # 4. Audit Log Reports
            logger.info("======================================================")
            logger.info("FINANCIAL RATIOS PRE-FLIGHT VALIDATION AUDIT REPORT")
            logger.info(f"Metrics Extracted:  {extracted_metrics_count}")
            logger.info(f"Metrics Missing:    {missing_metrics_count}")
            logger.info(f"Ratios Calculated:  {calculated_ratios_count}")
            logger.info(f"Ratios Missing:     {missing_ratios_count}")
            logger.info(f"Missing Source Metrics: {missing_source_metrics}")
            logger.info("======================================================")

            # 5. Populate State
            duration_ms = (time.perf_counter() - start_time) * 1000
            
            state["agents"]["financial_ratios"] = {
                "agent_name": self.agent_name,
                "status": "completed",
                "output": outputs.model_dump(),
                "error": None,
                "confidence_score": 1.0,
                "duration_ms": duration_ms
            }
            logger.info(f"{self.agent_name} finished successfully in {duration_ms:.2f}ms.")

        except Exception as e:
            logger.error(f"Error in {self.agent_name}: {e}", exc_info=True)
            duration_ms = (time.perf_counter() - start_time) * 1000
            state["agents"]["financial_ratios"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": str(e),
                "confidence_score": 0.0,
                "duration_ms": duration_ms
            }
            state["error"] = f"{self.agent_name} failed: {e}"

        return state
