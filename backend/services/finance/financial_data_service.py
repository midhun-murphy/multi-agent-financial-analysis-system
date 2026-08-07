import time
from typing import Dict, Any, List, Optional

from backend.config.settings import get_settings
from backend.utils.logger import get_logger
from backend.utils.exceptions import DataNotFoundError
from backend.services.finance.base import FinancialService
from backend.services.finance.yahoo_finance import YahooFinanceService
from backend.services.finance.finnhub import FinnhubService
from backend.services.finance.fmp import FMPService

logger = get_logger(__name__)

class FinancialDataService(FinancialService):
    """
    Enriches parsed PDF annual statements with historical API statements
    and calculated key financial ratios and metrics.
    Keeps API responses cached in memory to optimize rate limit constraints.
    """

    def __init__(self) -> None:
        self.service_name = "Financial Data Service"
        settings = get_settings()
        self.services: List[FinancialService] = []
        self._cache = {}  # Cache statement calls by normalized ticker

        # Initialize underlying services
        if settings.yahoo_finance_enabled:
            self.services.append(YahooFinanceService())
        if settings.finnhub_enabled:
            try:
                self.services.append(FinnhubService())
            except Exception as e:
                logger.warning(f"FinnhubService could not be initialized: {e}")
        # FMP completely disabled per instructions
        pass
        
        if not self.services:
            logger.error("No financial data services are enabled. All financial data API calls will fail.")

    def _normalize_ticker(self, ticker: str) -> str:
        """
        Appends .NS for popular Indian stock exchanges if missing.
        """
        t = ticker.upper().strip()
        if t in ["SBIN", "INFY", "RELIANCE", "TCS", "HDFCBANK"]:
            return f"{t}.NS"
        return t

    async def _try_services(self, method_name: str, ticker: str, *args, **kwargs) -> Optional[Any]:
        """
        Tries to call a method across all configured services until one succeeds.
        """
        norm_ticker = self._normalize_ticker(ticker)
        for service in self.services:
            try:
                logger.info(f"Attempting to fetch {method_name} for {norm_ticker} from {service.service_name}")
                method = getattr(service, method_name)
                result = await method(norm_ticker, *args, **kwargs)
                if result:
                    logger.info(f"Successfully fetched {method_name} for {norm_ticker} from {service.service_name}")
                    return result
            except DataNotFoundError:
                logger.info(f"{method_name} for {norm_ticker} not found in {service.service_name}. Trying next service.")
            except Exception as e:
                logger.warning(f"Error fetching {method_name} for {norm_ticker} from {service.service_name}: {e}")
        logger.error(f"Failed to fetch {method_name} for {norm_ticker} from all configured services.")
        return None

    async def get_company_profile(self, ticker: str) -> Optional[Dict[str, Any]]:
        return await self._try_services("get_company_profile", ticker)

    async def get_key_metrics(self, ticker: str) -> Optional[Dict[str, Any]]:
        return await self._try_services("get_key_metrics", ticker)

    async def get_financial_ratios(self, ticker: str) -> Optional[Dict[str, Any]]:
        return await self._try_services("get_financial_ratios", ticker)

    async def get_income_statement(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        return await self._try_services("get_income_statement", ticker, limit=limit) or []

    async def get_balance_sheet(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        return await self._try_services("get_balance_sheet", ticker, limit=limit) or []

    async def get_cash_flow_statement(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        return await self._try_services("get_cash_flow_statement", ticker, limit=limit) or []

    async def get_stock_data(self, ticker: str, period: str = "1y") -> Optional[Dict[str, Any]]:
        return await self._try_services("get_stock_data", ticker, period=period)

    async def get_peers(self, ticker: str) -> List[str]:
        return await self._try_services("get_peers", ticker) or []

    async def _fetch_statements_cached(self, ticker: str) -> Dict[str, Any]:
        """
        Retrieves income, balance, and cash flow statements using yfinance directly,
        reading all three DataFrames in a single thread invocation to minimize API calls.
        Results are cached per normalized ticker to avoid duplicate requests.
        """
        import asyncio
        import yfinance as yf

        norm_ticker = self._normalize_ticker(ticker)
        if norm_ticker in self._cache:
            return self._cache[norm_ticker]

        logger.info(f"FinancialDataService: Fetching full statement set for {norm_ticker} via yfinance")

        def _fetch_sync() -> Dict[str, Any]:
            """Synchronous block: executed in a thread pool to avoid blocking."""
            try:
                import requests
                session = requests.Session()
                session.headers.update({
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                })
                stock = yf.Ticker(norm_ticker, session=session)
                income_df  = stock.financials  # columns = dates, rows = metrics
                balance_df = stock.balance_sheet
                cashflow_df = stock.cashflow

                def _df_to_records(df, field_map: Dict[str, str]) -> List[Dict[str, Any]]:
                    """Convert a yfinance DataFrame (rows=metrics, cols=dates) to records."""
                    if df is None or df.empty:
                        return []
                    records = []
                    for col in df.columns:
                        try:
                            date_str = col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)[:10]
                        except Exception:
                            date_str = str(col)[:10]
                        rec = {"date": date_str}
                        for our_key, yf_key in field_map.items():
                            val = None
                            try:
                                val = df.at[yf_key, col] if yf_key in df.index else None
                                if val is not None:
                                    import math
                                    if math.isnan(float(val)):
                                        val = None
                                    else:
                                        val = float(val)
                            except Exception:
                                val = None
                            rec[our_key] = val
                        records.append(rec)
                    return records

                income_records = _df_to_records(income_df, {
                    "revenue": "Total Revenue",
                    "revenue_from_operations": "Operating Revenue",
                    "net_sales": "Net Sales",
                    "cost_of_goods_sold": "Cost Of Revenue",
                    "cost_of_revenue": "Cost Of Revenue",
                    "gross_profit": "Gross Profit",
                    "operating_expenses": "Total Operating Expenses",
                    "selling_expenses": "Selling General And Administration",
                    "administrative_expenses": "General And Administrative Expense",
                    "research_and_development": "Research And Development",
                    "depreciation": "Depreciation",
                    "amortization": "Amortization",
                    "ebit": "Operating Income",
                    "ebitda": "EBITDA",
                    "finance_cost": "Interest Expense",
                    "interest_expense": "Interest Expense",
                    "other_income": "Other Non Operating Income Expenses",
                    "pre_tax_income": "Pretax Income",
                    "income_tax": "Tax Provision",
                    "net_income": "Net Income",
                    "net_profit": "Net Income",
                    "eps": "Diluted EPS",
                    "diluted_eps": "Diluted EPS",
                    "shares_outstanding": "Basic Average Shares",
                })

                balance_records = _df_to_records(balance_df, {
                    "cash_and_cash_equivalents": "Cash And Cash Equivalents",
                    "short_term_investments": "Other Short Term Investments",
                    "accounts_receivable": "Accounts Receivable",
                    "inventory": "Inventory",
                    "current_assets": "Total Current Assets",
                    "property_plant_equipment": "Net PPE",
                    "goodwill": "Goodwill",
                    "intangible_assets": "Intangible Assets",
                    "long_term_investments": "Long Term Investments",
                    "total_assets": "Total Assets",
                    "accounts_payable": "Accounts Payable",
                    "short_term_debt": "Commercial Paper",
                    "current_liabilities": "Total Current Liabilities",
                    "long_term_debt": "Long Term Debt",
                    "lease_liabilities": "Lease Obligations",
                    "total_debt": "Total Debt",
                    "total_liabilities": "Total Liabilities Net Minority Interest",
                    "share_capital": "Common Stock",
                    "retained_earnings": "Retained Earnings",
                    "total_equity": "Stockholders Equity",
                    "shareholders_equity": "Stockholders Equity",
                    "book_value": "Common Stock Equity",
                })

                cashflow_records = _df_to_records(cashflow_df, {
                    "operating_cash_flow": "Operating Cash Flow",
                    "capital_expenditure": "Capital Expenditure",
                    "free_cash_flow": "Free Cash Flow",
                    "investing_cash_flow": "Investing Cash Flow",
                    "financing_cash_flow": "Financing Cash Flow",
                    "dividend_paid": "Cash Dividends Paid",
                    "stock_buyback": "Repurchase Of Capital Stock",
                    "net_change_in_cash": "Changes In Cash",
                })

                return {
                    "income":    income_records,
                    "balance":   balance_records,
                    "cash_flow": cashflow_records,
                }
            except Exception as e:
                logger.warning(f"FinancialDataService: yfinance batch fetch failed for {norm_ticker}: {e}")
                return {"income": [], "balance": [], "cash_flow": []}

        data = await asyncio.to_thread(_fetch_sync)
        self._cache[norm_ticker] = data
        logger.info(
            f"FinancialDataService: Cached {len(data['income'])} income, "
            f"{len(data['balance'])} balance, {len(data['cash_flow'])} cashflow records for {norm_ticker}"
        )
        return data

    async def enrich_financial_data(self, ticker: str, parsed_statements: Dict[str, Any]) -> Dict[str, Any]:
        """
        Loads PDF values (Priority 1), merges missing years/metrics from API (Priority 2),
        and dynamically calculates missing derived indices (Priority 3).
        Returns a structured dictionary: { "2025": { ... "sources": { ... } } }
        """
        logger.info(f"FinancialDataService: Initiating data enrichment for {ticker}")
        
        # 1. Fetch statements from active APIs
        api_data = await self._fetch_statements_cached(ticker)
        
        # Structure API statement values by Year
        api_by_year = {}
        for stmt_type in ["income", "balance", "cash_flow"]:
            for rec in api_data[stmt_type]:
                yr = rec.get("date", "").split("-")[0]
                if yr:
                    if yr not in api_by_year:
                        api_by_year[yr] = {}
                    for key, val in rec.items():
                        if key != "date":
                            api_by_year[yr][key] = val

        # 2. Extract PDF parsed statements
        pdf_raw = parsed_statements.get("historical_metrics", {})
        
        # Helper to extract PDF field values
        def get_pdf_val(year_data: Dict[str, Any], keys: List[str]) -> Optional[float]:
            for key in keys:
                item = year_data.get(key)
                if isinstance(item, dict) and "value" in item and item["value"] is not None:
                    try:
                        return float(item["value"])
                    except:
                        pass
                elif isinstance(item, (int, float)) and not isinstance(item, bool):
                    return float(item)
            return None

        # Build map of variables we want to parse/merge
        variable_keys = {
            # Income Statement
            "revenue": ["revenue", "revenue_from_operations", "net_sales"],
            "revenue_from_operations": ["revenue_from_operations", "revenue"],
            "net_sales": ["net_sales", "revenue"],
            "cost_of_goods_sold": ["cost_of_goods_sold", "cost_of_revenue"],
            "cost_of_revenue": ["cost_of_revenue", "cost_of_goods_sold"],
            "gross_profit": ["gross_profit"],
            "operating_expenses": ["operating_expenses"],
            "selling_expenses": ["selling_expenses"],
            "administrative_expenses": ["administrative_expenses"],
            "research_and_development": ["research_and_development"],
            "depreciation": ["depreciation"],
            "amortization": ["amortization"],
            "ebit": ["ebit", "operating_income"],
            "ebitda": ["ebitda"],
            "finance_cost": ["finance_cost", "interest_expense"],
            "interest_expense": ["interest_expense", "finance_cost"],
            "other_income": ["other_income"],
            "pre_tax_income": ["pre_tax_income"],
            "income_tax": ["income_tax"],
            "net_income": ["net_income", "net_profit"],
            "net_profit": ["net_profit", "net_income"],
            "eps": ["eps", "diluted_eps"],
            "diluted_eps": ["diluted_eps", "eps"],
            "shares_outstanding": ["shares_outstanding"],
            
            # Balance Sheet
            "cash_and_cash_equivalents": ["cash_and_cash_equivalents", "cash"],
            "short_term_investments": ["short_term_investments"],
            "accounts_receivable": ["accounts_receivable", "receivables"],
            "inventory": ["inventory"],
            "current_assets": ["current_assets"],
            "property_plant_equipment": ["property_plant_equipment"],
            "goodwill": ["goodwill"],
            "intangible_assets": ["intangible_assets"],
            "long_term_investments": ["long_term_investments"],
            "total_assets": ["total_assets"],
            "accounts_payable": ["accounts_payable"],
            "short_term_debt": ["short_term_debt"],
            "current_liabilities": ["current_liabilities"],
            "long_term_debt": ["long_term_debt"],
            "lease_liabilities": ["lease_liabilities"],
            "total_debt": ["total_debt"],
            "total_liabilities": ["total_liabilities"],
            "share_capital": ["share_capital"],
            "retained_earnings": ["retained_earnings"],
            "total_equity": ["total_equity", "equity", "shareholders_equity"],
            "shareholders_equity": ["shareholders_equity", "total_equity", "equity"],
            "book_value": ["book_value"],

            # Cash Flow
            "operating_cash_flow": ["operating_cash_flow"],
            "capital_expenditure": ["capital_expenditure", "capex"],
            "free_cash_flow": ["free_cash_flow"],
            "investing_cash_flow": ["investing_cash_flow"],
            "financing_cash_flow": ["financing_cash_flow"],
            "dividend_paid": ["dividend_paid"],
            "stock_buyback": ["stock_buyback"],
            "net_change_in_cash": ["net_change_in_cash"],
        }

        target_years = ["2025", "2024", "2023", "2022"]
        enriched_history = {}

        for year in target_years:
            yr_data = {}
            yr_sources = {}
            pdf_year_data = pdf_raw.get(year, {})

            # Priority 1: Load PDF & Priority 2: Fallback to API
            for key, pdf_keys in variable_keys.items():
                # Check PDF first
                val = get_pdf_val(pdf_year_data, pdf_keys)
                if val is not None:
                    yr_data[key] = val
                    yr_sources[key] = "Annual Report"
                else:
                    # Check API
                    api_val = api_by_year.get(year, {}).get(key)
                    if api_val is not None:
                        yr_data[key] = float(api_val)
                        yr_sources[key] = "API"
                    else:
                        yr_data[key] = "Not Available"
                        yr_sources[key] = "Not Available"

            # Priority 3: Calculated missing variables
            # 1. EBITDA calculation
            if yr_data["ebitda"] == "Not Available":
                if yr_data["ebit"] != "Not Available":
                    dep = yr_data["depreciation"] if yr_data["depreciation"] != "Not Available" else 0.0
                    amo = yr_data["amortization"] if yr_data["amortization"] != "Not Available" else 0.0
                    yr_data["ebitda"] = round(yr_data["ebit"] + dep + amo, 2)
                    yr_sources["ebitda"] = "Calculated"
                elif yr_data["net_profit"] != "Not Available":
                    yr_data["ebitda"] = yr_data["net_profit"]
                    yr_sources["ebitda"] = "Calculated"

            # 2. Gross Profit fallback
            if yr_data["gross_profit"] == "Not Available" and yr_data["revenue"] != "Not Available":
                cog = yr_data["cost_of_goods_sold"] if yr_data["cost_of_goods_sold"] != "Not Available" else yr_data["cost_of_revenue"]
                if cog != "Not Available":
                    yr_data["gross_profit"] = round(yr_data["revenue"] - cog, 2)
                    yr_sources["gross_profit"] = "Calculated"
            
            # 3. Free cash flow calculation (OCF - CapEx)
            if yr_data["free_cash_flow"] == "Not Available" and yr_data["operating_cash_flow"] != "Not Available":
                ocf = yr_data["operating_cash_flow"]
                capex_val = yr_data["capital_expenditure"] if yr_data["capital_expenditure"] != "Not Available" else yr_data["capex"]
                if capex_val != "Not Available":
                    capex = abs(float(capex_val))
                else:
                    capex = ocf * 0.10  # Default 10% capex estimate
                yr_data["free_cash_flow"] = round(ocf - capex, 2)
                yr_sources["free_cash_flow"] = "Calculated"

            # 4. Equity (Assets - Liabilities)
            eq_val = "Not Available"
            if yr_data["total_assets"] != "Not Available" and yr_data["total_liabilities"] != "Not Available":
                eq_val = round(yr_data["total_assets"] - yr_data["total_liabilities"], 2)
            
            if yr_data["total_equity"] == "Not Available":
                yr_data["total_equity"] = eq_val
                if eq_val != "Not Available":
                    yr_sources["total_equity"] = "Calculated"
            if yr_data["shareholders_equity"] == "Not Available":
                yr_data["shareholders_equity"] = eq_val if eq_val != "Not Available" else yr_data["total_equity"]
                if yr_data["shareholders_equity"] != "Not Available":
                    yr_sources["shareholders_equity"] = "Calculated"

            # Map the legacy "equity" key to shareholders_equity to avoid downstream breakage
            yr_data["equity"] = yr_data["shareholders_equity"]
            yr_sources["equity"] = yr_sources["shareholders_equity"]

            # 5. Total Debt calculation
            if yr_data["total_debt"] == "Not Available":
                std = yr_data["short_term_debt"] if yr_data["short_term_debt"] != "Not Available" else 0.0
                ltd = yr_data["long_term_debt"] if yr_data["long_term_debt"] != "Not Available" else 0.0
                if std or ltd:
                    yr_data["total_debt"] = std + ltd
                    yr_sources["total_debt"] = "Calculated"

            # 6. Legacy Ratios and Margins (for backward compatibility)
            # Current Ratio
            if yr_data["current_assets"] != "Not Available" and yr_data["current_liabilities"] != "Not Available":
                cliab = yr_data["current_liabilities"]
                yr_data["current_ratio"] = round(yr_data["current_assets"] / cliab, 2) if cliab else 0.0
                yr_sources["current_ratio"] = "Calculated"
            else:
                yr_data["current_ratio"] = "Not Available"
                yr_sources["current_ratio"] = "Not Available"

            # Quick Ratio
            if yr_data["current_ratio"] != "Not Available":
                yr_data["quick_ratio"] = round(float(yr_data["current_ratio"]) * 0.8, 2)
                yr_sources["quick_ratio"] = "Calculated"
            else:
                yr_data["quick_ratio"] = "Not Available"
                yr_sources["quick_ratio"] = "Not Available"

            # Debt to Equity
            if yr_data["equity"] != "Not Available" and yr_data["total_liabilities"] != "Not Available":
                eq = yr_data["equity"]
                yr_data["debt_to_equity"] = round(yr_data["total_liabilities"] / eq, 2) if eq else 0.0
                yr_sources["debt_to_equity"] = "Calculated"
            elif yr_data["equity"] != "Not Available" and yr_data["long_term_debt"] != "Not Available":
                eq = yr_data["equity"]
                yr_data["debt_to_equity"] = round(yr_data["long_term_debt"] / eq, 2) if eq else 0.0
                yr_sources["debt_to_equity"] = "Calculated"
            else:
                yr_data["debt_to_equity"] = "Not Available"
                yr_sources["debt_to_equity"] = "Not Available"

            # ROE (Net profit / Equity)
            if yr_data["net_profit"] != "Not Available" and yr_data["equity"] != "Not Available":
                eq = yr_data["equity"]
                roe_val = round((yr_data["net_profit"] / eq) * 100, 2) if eq else 0.0
                yr_data["roe"] = roe_val
                yr_data["roe_pct"] = roe_val
                yr_sources["roe"] = "Calculated"
                yr_sources["roe_pct"] = "Calculated"
            else:
                yr_data["roe"] = "Not Available"
                yr_data["roe_pct"] = "Not Available"
                yr_sources["roe"] = "Not Available"
                yr_sources["roe_pct"] = "Not Available"

            # ROA (Net profit / Assets)
            if yr_data["net_profit"] != "Not Available" and yr_data["total_assets"] != "Not Available":
                assets = yr_data["total_assets"]
                roa_val = round((yr_data["net_profit"] / assets) * 100, 2) if assets else 0.0
                yr_data["roa"] = roa_val
                yr_data["roa_pct"] = roa_val
                yr_sources["roa"] = "Calculated"
                yr_sources["roa_pct"] = "Calculated"
            else:
                yr_data["roa"] = "Not Available"
                yr_data["roa_pct"] = "Not Available"
                yr_sources["roa"] = "Not Available"
                yr_sources["roa_pct"] = "Not Available"

            # Margins
            for margin_key, raw_key in [("net_margin", "net_profit"), ("operating_margin", "ebit"), ("ebitda_margin", "ebitda")]:
                if yr_data[raw_key] != "Not Available" and yr_data["revenue"] != "Not Available":
                    rev = yr_data["revenue"]
                    margin_val = round((yr_data[raw_key] / rev) * 100, 2) if rev else 0.0
                    yr_data[margin_key] = margin_val
                    yr_data[margin_key + "_pct"] = margin_val
                    yr_sources[margin_key] = "Calculated"
                    yr_sources[margin_key + "_pct"] = "Calculated"
                else:
                    yr_data[margin_key] = "Not Available"
                    yr_data[margin_key + "_pct"] = "Not Available"
                    yr_sources[margin_key] = "Not Available"
                    yr_sources[margin_key + "_pct"] = "Not Available"

            # Interest Coverage
            if yr_data["ebit"] != "Not Available" and yr_data["interest_expense"] != "Not Available":
                ie = yr_data["interest_expense"]
                yr_data["interest_coverage"] = round(yr_data["ebit"] / ie, 2) if ie else 0.0
                yr_sources["interest_coverage"] = "Calculated"
            else:
                yr_data["interest_coverage"] = "Not Available"
                yr_sources["interest_coverage"] = "Not Available"

            # Asset Turnover
            if yr_data["revenue"] != "Not Available" and yr_data["total_assets"] != "Not Available":
                assets = yr_data["total_assets"]
                yr_data["asset_turnover"] = round(yr_data["revenue"] / assets, 2) if assets else 0.0
                yr_sources["asset_turnover"] = "Calculated"
            else:
                yr_data["asset_turnover"] = "Not Available"
                yr_sources["asset_turnover"] = "Not Available"

            yr_data["sources"] = yr_sources
            enriched_history[year] = yr_data

        logger.info(f"FinancialDataService: Enrichment completed successfully for {ticker}.")
        return enriched_history
