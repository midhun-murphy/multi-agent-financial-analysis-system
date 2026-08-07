import time
import asyncio

# --- Global Asyncio Run Patch to prevent Event Loop Collisions ---
original_asyncio_run = asyncio.run

def custom_asyncio_run(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
        
    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            def run_in_thread():
                new_loop = asyncio.new_event_loop()
                try:
                    asyncio.set_event_loop(new_loop)
                    return new_loop.run_until_complete(coro)
                finally:
                    new_loop.close()
            future = executor.submit(run_in_thread)
            return future.result()
    else:
        return original_asyncio_run(coro)

asyncio.run = custom_asyncio_run
# -----------------------------------------------------------------

import json
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from backend.agents.base.agent import BaseAgent
from backend.state.analysis_state import AnalysisState
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# ── Input Schema ──────────────────────────────────────────────────────────────
class FinancialMetricsInput(BaseModel):
    parsed_statements: Dict[str, Any] = Field(..., description="Parsed statements payload.")
    company_name: str = Field(..., description="Target company name.")
    ticker: str = Field(..., description="Target stock ticker.")


# ── Per-Year Metrics Model ─────────────────────────────────────────────────────
class MetricsByYear(BaseModel):
    # Income Statement
    revenue: Any = Field("Not Available")
    revenue_from_operations: Any = Field("Not Available")
    net_sales: Any = Field("Not Available")
    cost_of_goods_sold: Any = Field("Not Available")
    cost_of_revenue: Any = Field("Not Available")
    gross_profit: Any = Field("Not Available")
    operating_expenses: Any = Field("Not Available")
    selling_expenses: Any = Field("Not Available")
    administrative_expenses: Any = Field("Not Available")
    research_and_development: Any = Field("Not Available")
    depreciation: Any = Field("Not Available")
    amortization: Any = Field("Not Available")
    ebit: Any = Field("Not Available")
    ebitda: Any = Field("Not Available")
    finance_cost: Any = Field("Not Available")
    interest_expense: Any = Field("Not Available")
    other_income: Any = Field("Not Available")
    pre_tax_income: Any = Field("Not Available")
    income_tax: Any = Field("Not Available")
    net_income: Any = Field("Not Available")
    net_profit: Any = Field("Not Available")
    eps: Any = Field("Not Available")
    diluted_eps: Any = Field("Not Available")
    shares_outstanding: Any = Field("Not Available")

    # Balance Sheet
    cash_and_cash_equivalents: Any = Field("Not Available")
    short_term_investments: Any = Field("Not Available")
    accounts_receivable: Any = Field("Not Available")
    inventory: Any = Field("Not Available")
    current_assets: Any = Field("Not Available")
    property_plant_equipment: Any = Field("Not Available")
    goodwill: Any = Field("Not Available")
    intangible_assets: Any = Field("Not Available")
    long_term_investments: Any = Field("Not Available")
    total_assets: Any = Field("Not Available")
    accounts_payable: Any = Field("Not Available")
    short_term_debt: Any = Field("Not Available")
    current_liabilities: Any = Field("Not Available")
    long_term_debt: Any = Field("Not Available")
    lease_liabilities: Any = Field("Not Available")
    total_debt: Any = Field("Not Available")
    total_liabilities: Any = Field("Not Available")
    share_capital: Any = Field("Not Available")
    retained_earnings: Any = Field("Not Available")
    total_equity: Any = Field("Not Available")
    shareholders_equity: Any = Field("Not Available")
    book_value: Any = Field("Not Available")

    # Cash Flow
    operating_cash_flow: Any = Field("Not Available")
    capital_expenditure: Any = Field("Not Available")
    free_cash_flow: Any = Field("Not Available")
    investing_cash_flow: Any = Field("Not Available")
    financing_cash_flow: Any = Field("Not Available")
    dividend_paid: Any = Field("Not Available")
    stock_buyback: Any = Field("Not Available")
    net_change_in_cash: Any = Field("Not Available")

    # Legacy / Derived / Supplementary keys for backward compatibility
    operating_profit: Any = Field("Not Available")
    equity: Any = Field("Not Available")
    cash: Any = Field("Not Available")
    capex: Any = Field("Not Available")
    market_capitalization: Any = Field("Not Available")
    net_margin_pct: Any = Field("Not Available")
    operating_margin_pct: Any = Field("Not Available")
    ebitda_margin_pct: Any = Field("Not Available")
    roe_pct: Any = Field("Not Available")
    roa_pct: Any = Field("Not Available")
    debt_to_equity: Any = Field("Not Available")
    current_ratio: Any = Field("Not Available")
    quick_ratio: Any = Field("Not Available")
    asset_turnover: Any = Field("Not Available")
    interest_coverage: Any = Field("Not Available")


# ── Output Schema ──────────────────────────────────────────────────────────────
class FinancialMetricsOutput(BaseModel):
    company: Dict[str, str] = Field(..., description="Company meta details.")
    latest_year: str = Field(..., description="The latest completed financial year.")
    detected_years: List[str] = Field(..., description="Detected years in descending order.")
    latest_metrics: MetricsByYear = Field(..., description="Unified metrics for the latest completed year.")
    historical_metrics: Dict[str, MetricsByYear] = Field(..., description="Unified metrics for each historical fiscal year.")
    unified_financial_json: Dict[str, Any] = Field(default={}, description="Unified Financial JSON mapping each metric name -> year -> data")
    validation_counters: Dict[str, Any] = Field(default={}, description="Audit validation counters.")
    sources: Dict[str, Any] = Field(default={}, description="Metric sources tracker.")


# ── Agent ──────────────────────────────────────────────────────────────────────
class FinancialMetricsAgent(BaseAgent):
    """
    Financial Metrics Agent.
    Combines rule-based parsed statement extractions with API-driven financial data 
    enrichment and derived ratio calculations.
    """
    def __init__(self) -> None:
        super().__init__("Financial Metrics Agent")

    async def run(self, state: AnalysisState) -> AnalysisState:
        logger.info(f"Running {self.agent_name}")
        start_time = time.perf_counter()

        parsed_statements = state["metadata"].get("parsed_statements")
        company_name = state["session"].get("company_name", "Target Company")
        ticker = state["session"].get("ticker", "TICKER")

        if not parsed_statements:
            logger.error("No parsed statements data found in state metadata.")
            state["agents"]["financial_metrics"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": "Missing parsed statements data from Financial Parser Agent.",
                "confidence_score": 0.0,
                "duration_ms": 0.0
            }
            state["error"] = "Financial Metrics Agent missing statement dependencies."
            return state

        try:
            # 1. Validate Input
            inputs = FinancialMetricsInput(
                parsed_statements=parsed_statements,
                company_name=company_name,
                ticker=ticker
            )

            # 2. Execute Data Enrichment Pipeline (PDF -> API -> Calculated)
            from backend.services.finance.financial_data_service import FinancialDataService
            enrichment_service = FinancialDataService()
            enriched_history = await enrichment_service.enrich_financial_data(inputs.ticker, inputs.parsed_statements)

            # Extract metadata
            meta = parsed_statements.get("metadata", {})
            currency = meta.get("currency", "USD")
            detected_years = list(enriched_history.keys())
            detected_years.sort(reverse=True)
            latest_year = meta.get("latest_year") or (detected_years[0] if detected_years else "2024")

            # 3. Map enriched data to Pydantic MetricsByYear objects
            def get_existing_val(field: str, yr: str) -> Any:
                # Check metadata financial_metrics first
                meta_metrics = state["metadata"].get("financial_metrics") or {}
                if isinstance(meta_metrics, dict):
                    val = meta_metrics.get("historical_metrics", {}).get(yr, {}).get(field)
                    if val not in [None, "Not Available"]:
                        return val
                
                # Check agents output
                agent_metrics = state["agents"].get("financial_metrics", {}).get("output") or {}
                if isinstance(agent_metrics, dict):
                    val = agent_metrics.get("historical_metrics", {}).get(yr, {}).get(field)
                    if val not in [None, "Not Available"]:
                        return val
                
                # Check historical trend
                hist_trend = state["metadata"].get("historical_trend") or {}
                if isinstance(hist_trend, dict) and "years" in hist_trend and field in hist_trend:
                    years_list = hist_trend.get("years", [])
                    field_list = hist_trend.get(field, [])
                    if yr in years_list:
                        idx = years_list.index(yr)
                        if idx < len(field_list):
                            val = field_list[idx]
                            if val not in [None, "Not Available"]:
                                return val
                return None

            historical_metrics: Dict[str, MetricsByYear] = {}
            for year, yr_data in enriched_history.items():
                def get_val(field: str, alt_key: str = None) -> Any:
                    existing = get_existing_val(field, year)
                    if existing is not None:
                        return existing
                    if alt_key:
                        existing_alt = get_existing_val(alt_key, year)
                        if existing_alt is not None:
                            return existing_alt
                    
                    val = yr_data.get(field)
                    if val not in [None, "Not Available"]:
                        return val
                    if alt_key:
                        val_alt = yr_data.get(alt_key)
                        if val_alt not in [None, "Not Available"]:
                            return val_alt
                    return "Not Available"

                metrics_by_year = MetricsByYear(
                    # Income Statement
                    revenue=get_val("revenue"),
                    revenue_from_operations=get_val("revenue_from_operations"),
                    net_sales=get_val("net_sales"),
                    cost_of_goods_sold=get_val("cost_of_goods_sold"),
                    cost_of_revenue=get_val("cost_of_revenue"),
                    gross_profit=get_val("gross_profit"),
                    operating_expenses=get_val("operating_expenses"),
                    selling_expenses=get_val("selling_expenses"),
                    administrative_expenses=get_val("administrative_expenses"),
                    research_and_development=get_val("research_and_development"),
                    depreciation=get_val("depreciation"),
                    amortization=get_val("amortization"),
                    ebit=get_val("ebit"),
                    ebitda=get_val("ebitda"),
                    finance_cost=get_val("finance_cost"),
                    interest_expense=get_val("interest_expense"),
                    other_income=get_val("other_income"),
                    pre_tax_income=get_val("pre_tax_income"),
                    income_tax=get_val("income_tax"),
                    net_income=get_val("net_income"),
                    net_profit=get_val("net_profit"),
                    eps=get_val("eps"),
                    diluted_eps=get_val("diluted_eps"),
                    shares_outstanding=get_val("shares_outstanding"),

                    # Balance Sheet
                    cash_and_cash_equivalents=get_val("cash_and_cash_equivalents"),
                    short_term_investments=get_val("short_term_investments"),
                    accounts_receivable=get_val("accounts_receivable"),
                    inventory=get_val("inventory"),
                    current_assets=get_val("current_assets"),
                    property_plant_equipment=get_val("property_plant_equipment"),
                    goodwill=get_val("goodwill"),
                    intangible_assets=get_val("intangible_assets"),
                    long_term_investments=get_val("long_term_investments"),
                    total_assets=get_val("total_assets"),
                    accounts_payable=get_val("accounts_payable"),
                    short_term_debt=get_val("short_term_debt"),
                    current_liabilities=get_val("current_liabilities"),
                    long_term_debt=get_val("long_term_debt"),
                    lease_liabilities=get_val("lease_liabilities"),
                    total_debt=get_val("total_debt"),
                    total_liabilities=get_val("total_liabilities"),
                    share_capital=get_val("share_capital"),
                    retained_earnings=get_val("retained_earnings"),
                    total_equity=get_val("total_equity"),
                    shareholders_equity=get_val("shareholders_equity"),
                    book_value=get_val("book_value"),

                    # Cash Flow
                    operating_cash_flow=get_val("operating_cash_flow"),
                    capital_expenditure=get_val("capital_expenditure"),
                    free_cash_flow=get_val("free_cash_flow"),
                    investing_cash_flow=get_val("investing_cash_flow"),
                    financing_cash_flow=get_val("financing_cash_flow"),
                    dividend_paid=get_val("dividend_paid"),
                    stock_buyback=get_val("stock_buyback"),
                    net_change_in_cash=get_val("net_change_in_cash"),

                    # Legacy / Derived / Supplementary
                    operating_profit=get_val("operating_profit", "ebit"),
                    equity=get_val("equity", "shareholders_equity"),
                    cash=get_val("cash", "cash_and_cash_equivalents"),
                    capex=get_val("capex", "capital_expenditure"),
                    market_capitalization=get_val("market_capitalization"),
                    net_margin_pct=get_val("net_margin_pct", "net_margin"),
                    operating_margin_pct=get_val("operating_margin_pct", "operating_margin"),
                    ebitda_margin_pct=get_val("ebitda_margin_pct", "ebitda_margin"),
                    roe_pct=get_val("roe_pct", "roe"),
                    roa_pct=get_val("roa_pct", "roa"),
                    debt_to_equity=get_val("debt_to_equity"),
                    current_ratio=get_val("current_ratio"),
                    quick_ratio=get_val("quick_ratio"),
                    asset_turnover=get_val("asset_turnover"),
                    interest_coverage=get_val("interest_coverage"),
                )
                historical_metrics[year] = metrics_by_year

            # Latest Year metrics
            latest_metrics = historical_metrics.get(latest_year, MetricsByYear())

            # Store sources tracker metadata internally in state
            state["metadata"]["enrichment_sources"] = {
                yr: yr_data.get("sources", {}) for yr, yr_data in enriched_history.items()
            }

            # 4. Build Output Schema
            company_info = {
                "name": company_name,
                "ticker": ticker,
                "exchange": meta.get("exchange", "N/A"),
                "report_year": meta.get("report_year", "N/A"),
                "currency": currency,
                "currency_symbol": "$" if currency == "USD" else "₹",
                "unit_label": "Millions" if currency == "USD" else "Crores",
                "unit_suffix": "M" if currency == "USD" else "Cr"
            }

            # Build Unified Financial JSON
            METRIC_STATEMENTS = {
                # Income Statement
                "revenue": "Income Statement",
                "revenue_from_operations": "Income Statement",
                "net_sales": "Income Statement",
                "cost_of_goods_sold": "Income Statement",
                "cost_of_revenue": "Income Statement",
                "gross_profit": "Income Statement",
                "operating_expenses": "Income Statement",
                "selling_expenses": "Income Statement",
                "administrative_expenses": "Income Statement",
                "research_and_development": "Income Statement",
                "depreciation": "Income Statement",
                "amortization": "Income Statement",
                "ebit": "Income Statement",
                "ebitda": "Income Statement",
                "finance_cost": "Income Statement",
                "interest_expense": "Income Statement",
                "other_income": "Income Statement",
                "pre_tax_income": "Income Statement",
                "income_tax": "Income Statement",
                "net_income": "Income Statement",
                "net_profit": "Income Statement",
                "eps": "Income Statement",
                "diluted_eps": "Income Statement",
                "shares_outstanding": "Income Statement",

                # Balance Sheet
                "cash_and_cash_equivalents": "Balance Sheet",
                "short_term_investments": "Balance Sheet",
                "accounts_receivable": "Balance Sheet",
                "inventory": "Balance Sheet",
                "current_assets": "Balance Sheet",
                "property_plant_equipment": "Balance Sheet",
                "goodwill": "Balance Sheet",
                "intangible_assets": "Balance Sheet",
                "long_term_investments": "Balance Sheet",
                "total_assets": "Balance Sheet",
                "accounts_payable": "Balance Sheet",
                "short_term_debt": "Balance Sheet",
                "current_liabilities": "Balance Sheet",
                "long_term_debt": "Balance Sheet",
                "lease_liabilities": "Balance Sheet",
                "total_debt": "Balance Sheet",
                "total_liabilities": "Balance Sheet",
                "share_capital": "Balance Sheet",
                "retained_earnings": "Balance Sheet",
                "total_equity": "Balance Sheet",
                "shareholders_equity": "Balance Sheet",
                "book_value": "Balance Sheet",

                # Cash Flow
                "operating_cash_flow": "Cash Flow Statement",
                "capital_expenditure": "Cash Flow Statement",
                "free_cash_flow": "Cash Flow Statement",
                "investing_cash_flow": "Cash Flow Statement",
                "financing_cash_flow": "Cash Flow Statement",
                "dividend_paid": "Cash Flow Statement",
                "stock_buyback": "Cash Flow Statement",
                "net_change_in_cash": "Cash Flow Statement",
            }

            prior_year = detected_years[1] if len(detected_years) > 1 else None

            def _safe_float(val: Any) -> Optional[float]:
                if val in [None, "Not Available", "N/A", "nan", "NaN"]:
                    return None
                try:
                    return float(str(val).replace(",", "").strip())
                except:
                    return None

            def map_source_details(src: str) -> tuple:
                if src == "Annual Report":
                    return "PDF", 98
                elif src == "API":
                    return "API", 95
                elif src == "Calculated":
                    return "Calculated", 90
                else:
                    return "PDF", 95

            unified_financial_json = {}
            
            # Map canonical display names for metrics
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
                "ebit": "Operating Income (EBIT)",
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
                "shareholders_equity": "Shareholders' Equity",
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

            for metric_name, statement_name in METRIC_STATEMENTS.items():
                curr_metrics = historical_metrics.get(latest_year)
                prev_metrics = historical_metrics.get(prior_year) if prior_year else None

                alt_name = None
                if metric_name == "operating_profit":
                    alt_name = "ebit"
                elif metric_name == "equity":
                    alt_name = "shareholders_equity"
                elif metric_name == "cash":
                    alt_name = "cash_and_cash_equivalents"
                elif metric_name == "capex":
                    alt_name = "capital_expenditure"

                curr_val_raw = getattr(curr_metrics, metric_name, "Not Available") if curr_metrics else "Not Available"
                if curr_val_raw == "Not Available" and alt_name:
                    curr_val_raw = getattr(curr_metrics, alt_name, "Not Available") if curr_metrics else "Not Available"

                prev_val_raw = getattr(prev_metrics, metric_name, "Not Available") if prev_metrics else "Not Available"
                if prev_val_raw == "Not Available" and alt_name:
                    prev_val_raw = getattr(prev_metrics, alt_name, "Not Available") if prev_metrics else "Not Available"

                curr_val = _safe_float(curr_val_raw)
                prev_val = _safe_float(prev_val_raw)

                difference = "Unavailable"
                growth = "Unavailable"
                trend = "flat"
                status = "validated"

                if curr_val is not None and prev_val is not None:
                    difference = round(curr_val - prev_val, 2)
                    if prev_val != 0.0:
                        growth = round((difference / abs(prev_val)) * 100, 2)
                    if curr_val > prev_val:
                        trend = "up"
                    elif curr_val < prev_val:
                        trend = "down"
                elif curr_val is not None:
                    trend = "flat"
                else:
                    status = "missing"

                src_raw = state["metadata"].get("enrichment_sources", {}).get(latest_year, {}).get(metric_name, "Not Available")
                if src_raw == "Not Available" and alt_name:
                    src_raw = state["metadata"].get("enrichment_sources", {}).get(latest_year, {}).get(alt_name, "Not Available")
                src_name, conf = map_source_details(src_raw)

                display_name = METRIC_DISPLAY_NAMES.get(metric_name, metric_name.replace("_", " ").title())

                # Top-level is the flat validation object structure requested by prompt
                metric_entry = {
                    "name": display_name,
                    "current": curr_val if curr_val is not None else "Unavailable",
                    "previous": prev_val if prev_val is not None else "Unavailable",
                    "difference": difference,
                    "growth": growth,
                    "trend": trend,
                    "statement": statement_name,
                    "source": src_name if status == "validated" else "Not Available",
                    "confidence": conf if status == "validated" else 0,
                    "status": status
                }

                # Add year-by-year entries directly inside the same dictionary so ratios agent remains fully backward compatible
                for yr in detected_years:
                    yr_metrics = historical_metrics.get(yr)
                    y_val = getattr(yr_metrics, metric_name, "Not Available") if yr_metrics else "Not Available"
                    if y_val == "Not Available" and alt_name:
                        y_val = getattr(yr_metrics, alt_name, "Not Available") if yr_metrics else "Not Available"
                    
                    y_val_float = _safe_float(y_val)
                    metric_entry[yr] = {
                        "name": metric_name,
                        "value": y_val_float if y_val_float is not None else "Not Available",
                        "unit": "Million USD" if currency == "USD" else ("Crore INR" if currency == "INR" or company_info.get("currency_symbol") == "₹" else f"Million {currency}"),
                        "year": yr,
                        "statement": statement_name,
                        "source": src_name,
                        "confidence": conf
                    }

                unified_financial_json[metric_name] = metric_entry

            state["metadata"]["unified_financial_json"] = unified_financial_json

            # Log exact prints
            log_mapping = [
                ("Revenue", "revenue"),
                ("Gross Profit", "gross_profit"),
                ("Operating Income", "operating_profit"),
                ("EBITDA", "ebitda"),
                ("Net Income", "net_profit"),
                ("Assets", "total_assets"),
                ("Equity", "equity"),
                ("Debt", "total_debt"),
                ("Current Assets", "current_assets"),
                ("Current Liabilities", "current_liabilities"),
            ]
            for display_name, key in log_mapping:
                metric_obj = unified_financial_json.get(key, {})
                status = metric_obj.get("status")
                val_curr = metric_obj.get("current")
                if status == "missing" or val_curr is None or val_curr == "Unavailable":
                    print(f"{display_name} -> Missing")
                    logger.info(f"{display_name} -> Missing")
                else:
                    src = metric_obj.get("source", "PDF")
                    dots = "." * (18 - len(display_name))
                    print(f"{display_name} {dots} {src}")
                    logger.info(f"{display_name} {dots} {src}")

            validated_fields = 0
            missing_fields = 0
            derived_fields = 0
            
            for key in METRIC_STATEMENTS.keys():
                metric_obj = unified_financial_json.get(key, {})
                status = metric_obj.get("status")
                src = metric_obj.get("source")
                if status == "missing" or metric_obj.get("current") == "Unavailable":
                    missing_fields += 1
                elif src == "Calculated":
                    derived_fields += 1
                else:
                    validated_fields += 1
            
            total_attempted = len(METRIC_STATEMENTS)
            validation_counters = {
                "validated_fields": validated_fields,
                "missing": missing_fields,
                "derived": derived_fields,
                "extraction_confidence": int(100 * (validated_fields / total_attempted)) if total_attempted else 0
            }

            sources = {
                yr: yr_data.get("sources", {}) for yr, yr_data in enriched_history.items()
            }

            outputs = FinancialMetricsOutput(
                company=company_info,
                latest_year=latest_year,
                detected_years=detected_years,
                latest_metrics=latest_metrics,
                historical_metrics=historical_metrics,
                unified_financial_json=unified_financial_json,
                validation_counters=validation_counters,
                sources=sources
            )

            # 9. Store in state
            duration_ms = (time.perf_counter() - start_time) * 1000
            state["metadata"]["financial_metrics"] = outputs.model_dump()
            state["agents"]["financial_metrics"] = {
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
            state["agents"]["financial_metrics"] = {
                "agent_name": self.agent_name,
                "status": "failed",
                "output": None,
                "error": str(e),
                "confidence_score": 0.0,
                "duration_ms": duration_ms
            }
            state["error"] = f"{self.agent_name} failed: {e}"

        return state
