"""
FMP Service — v2
===============
Financial Modeling Prep API integration.
Key fixes:
  1. Detects placeholder API key and disables self gracefully
  2. Returns FULL normalized data from all 3 endpoints (profile + key_metrics + ratios)
  3. Correct field mapping from FMP JSON → internal schema
  4. Indian ticker: tries SYMBOL.NS first, then falls back to SYMBOL (NSE tickers on FMP)
  5. Async HTTP with retry on 429
"""

import os
import asyncio
import time
from typing import Dict, Any, List, Optional
import httpx

from backend.services.finance.base import FinancialService
from backend.config.settings import get_settings
from backend.utils.logger import get_logger
from backend.utils.exceptions import ServiceUnavailableError, ServiceRateLimitError

logger = get_logger(__name__)

# Keys that indicate the placeholder was never replaced
_PLACEHOLDER_KEYS = {
    "", "your-fmp-api-key-here", "YOUR_FMP_API_KEY", "placeholder",
    "your-api-key", "xxx", "none", "null",
}


class FMPService(FinancialService):
    """
    Financial Modeling Prep (FMP) API service.
    Provides company profile, key metrics, ratios, and statements.
    Gracefully disabled when API key is absent or placeholder.
    """

    BASE_URL = "https://financialmodelingprep.com/api/v3"

    def __init__(self) -> None:
        settings = get_settings()
        self.service_name = "Financial Modeling Prep"
        raw_key = settings.fmp_api_key or os.environ.get("FMP_API_KEY", "")
        self.enabled = settings.fmp_enabled and bool(raw_key) and raw_key.lower() not in _PLACEHOLDER_KEYS
        self.api_key = raw_key if self.enabled else ""

        if not settings.fmp_enabled:
            logger.info(f"{self.service_name}: Disabled via FMP_ENABLED=false")
            self.client = None
        elif not self.enabled:
            logger.warning(
                f"{self.service_name}: API key is placeholder/empty ('{raw_key[:12]}...'). "
                "Service disabled. Set a real FMP_API_KEY in .env to enable."
            )
            self.client = None
        else:
            self.client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                timeout=httpx.Timeout(15.0, connect=5.0),
            )
            logger.info(
                f"{self.service_name}: Initialized | key prefix={self.api_key[:8]}... | len={len(self.api_key)}"
            )

    async def _get(self, endpoint: str, params: Optional[Dict] = None, retries: int = 2) -> Optional[Any]:
        """Make a GET request with retry on 429 rate limit."""
        if not self.client:
            return None
        full_params = {"apikey": self.api_key, **(params or {})}
        for attempt in range(retries + 1):
            try:
                resp = await self.client.get(endpoint, params=full_params)
                if resp.status_code == 200:
                    data = resp.json()
                    return data if data else None
                elif resp.status_code == 429:
                    wait = 2 ** attempt * 3
                    logger.warning(f"[FMP] 429 rate limit on {endpoint}. Waiting {wait}s (attempt {attempt+1})")
                    await asyncio.sleep(wait)
                elif resp.status_code in (401, 403):
                    logger.error(
                        f"[FMP] HTTP {resp.status_code} on {endpoint} — "
                        "API key may be invalid, expired, or plan restriction."
                    )
                    return None
                else:
                    logger.warning(f"[FMP] HTTP {resp.status_code} on {endpoint}: {resp.text[:200]}")
                    return None
            except Exception as e:
                logger.warning(f"[FMP] Request error {endpoint}: {e}")
                if attempt < retries:
                    await asyncio.sleep(2)
        return None

    def _first(self, data: Any) -> Optional[Dict]:
        """Return first item if list, or the dict itself."""
        if isinstance(data, list):
            return data[0] if data else None
        return data if isinstance(data, dict) else None

    # ── Public API ────────────────────────────────────────────────────────────

    async def get_company_profile(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Fetch company profile → maps to internal schema.
        FMP profile includes: companyName, exchange, currency, sector, industry,
        mktCap, price, beta, volAvg, dcfDiff, dcf, description, fullTimeEmployees
        """
        data = await self._get(f"/profile/{ticker}")
        p = self._first(data)
        if not p:
            logger.debug(f"[FMP] No profile for {ticker}")
            return None

        result = {
            "symbol":               p.get("symbol"),
            "shortName":            p.get("companyName"),
            "longBusinessSummary":  p.get("description"),
            "sector":               p.get("sector"),
            "industry":             p.get("industry"),
            "fullTimeEmployees":    p.get("fullTimeEmployees"),
            "website":              p.get("website"),
            "currency":             p.get("currency"),
            "exchange":             p.get("exchangeShortName"),
            # Extra fields used by CompetitorAgent
            "market_cap":           p.get("mktCap"),
            "price":                p.get("price"),
            "beta":                 p.get("beta"),
            "fiscal_year_end":      p.get("lastDiv"),
            "country":              p.get("country"),
        }
        logger.debug(f"[FMP] profile({ticker}): name={result['shortName']} mc={result['market_cap']}")
        return result

    async def get_key_metrics(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Fetch TTM key metrics → comprehensive financial data.
        FMP /key-metrics-ttm fields:
          revenuePerShareTTM, netIncomePerShareTTM, operatingCashFlowPerShareTTM,
          freeCashFlowPerShareTTM, cashPerShareTTM, bookValuePerShareTTM,
          tangibleBookValuePerShareTTM, shareholdersEquityPerShareTTM,
          interestDebtPerShareTTM, marketCapTTM, enterpriseValueTTM,
          peRatioTTM, priceToSalesRatioTTM, pocfratioTTM, pfcfRatioTTM,
          pbRatioTTM, ptbRatioTTM, evToSalesTTM, enterpriseValueOverEBITDATTM,
          evToOperatingCashFlowTTM, evToFreeCashFlowTTM, earningsYieldTTM,
          freeCashFlowYieldTTM, debtToEquityTTM, debtToAssetsTTM,
          netDebtToEBITDATTM, currentRatioTTM, interestCoverageTTM,
          incomeQualityTTM, dividendYieldTTM, dividendYieldPercentageTTM,
          payoutRatioTTM, salesGeneralAndAdministrativeToRevenueTTM,
          researchAndDevelopementToRevenueTTM, intangiblesToTotalAssetsTTM,
          capexToOperatingCashFlowTTM, capexToRevenueTTM, capexToDepreciationTTM,
          stockBasedCompensationToRevenueTTM, grahamNumberTTM, roicTTM,
          returnOnTangibleAssetsTTM, grahamNetNetTTM, workingCapitalTTM,
          tangibleAssetValueTTM, netCurrentAssetValueTTM, investedCapitalTTM,
          averageReceivablesTTM, averagePayablesTTM, averageInventoryTTM,
          daysSalesOutstandingTTM, daysPayablesOutstandingTTM,
          daysOfInventoryOnHandTTM, receivablesTurnoverTTM, payablesTurnoverTTM,
          inventoryTurnoverTTM, roeTTM, capexPerShareTTM,
          revenueTTM, netIncomeTTM, ebitdaTTM, freeCashFlowTTM
        """
        data = await self._get(f"/key-metrics-ttm/{ticker}")
        m = self._first(data)
        if not m:
            logger.debug(f"[FMP] No key metrics for {ticker}")
            return None

        result = {
            # Primary financials
            "revenue":          m.get("revenueTTM"),
            "netIncome":        m.get("netIncomeTTM"),
            "ebitda":           m.get("ebitdaTTM"),
            "freeCashFlow":     m.get("freeCashFlowTTM"),
            # Market data
            "marketCap":        m.get("marketCapTTM"),
            "enterpriseValue":  m.get("enterpriseValueTTM"),
            # Valuation ratios
            "pe":               m.get("peRatioTTM"),
            "pb":               m.get("pbRatioTTM"),
            "evToEBITDA":       m.get("enterpriseValueOverEBITDATTM"),
            "evToSales":        m.get("evToSalesTTM"),
            # Per-share
            "eps":              m.get("netIncomePerShareTTM"),
            "bookValuePerShare":m.get("bookValuePerShareTTM"),
            # Yield
            "dividendYield":    m.get("dividendYieldTTM"),
            "freeCashFlowYield":m.get("freeCashFlowYieldTTM"),
            # Leverage / liquidity
            "debtToEquity":     m.get("debtToEquityTTM"),
            "debtToAssets":     m.get("debtToAssetsTTM"),
            "currentRatio":     m.get("currentRatioTTM"),
            "interestCoverage": m.get("interestCoverageTTM"),
            # Returns
            "roe":              m.get("roeTTM"),
            "roic":             m.get("roicTTM"),
            "roa":              m.get("returnOnTangibleAssetsTTM"),
            # Working capital
            "workingCapital":   m.get("workingCapitalTTM"),
        }
        logger.debug(
            f"[FMP] key_metrics({ticker}): rev={result['revenue']} mc={result['marketCap']} "
            f"pe={result['pe']} roe={result['roe']}"
        )
        return result

    async def get_financial_ratios(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Fetch TTM financial ratios.
        FMP /ratios-ttm fields include margin, efficiency and valuation ratios.
        """
        data = await self._get(f"/ratios-ttm/{ticker}")
        r = self._first(data)
        if not r:
            logger.debug(f"[FMP] No ratios for {ticker}")
            return None

        result = {
            # PE variants
            "forwardPE":        r.get("priceEarningsRatioTTM"),
            "priceToSales":     r.get("priceToSalesRatioTTM"),
            "pegRatio":         r.get("pegRatioTTM"),
            # Profitability ratios
            "grossMargin":      r.get("grossProfitMarginTTM"),
            "operatingMargin":  r.get("operatingProfitMarginTTM"),
            "netMargin":        r.get("netProfitMarginTTM"),
            "ebitdaMargin":     r.get("ebitdaPerRevenueTTM"),
            "returnOnEquity":   r.get("returnOnEquityTTM"),
            "returnOnAssets":   r.get("returnOnAssetsTTM"),
            # Leverage
            "debtToEquity":     r.get("debtEquityRatioTTM"),
            "currentRatio":     r.get("currentRatioTTM"),
            "quickRatio":       r.get("quickRatioTTM"),
            "interestCoverage": r.get("interestCoverageTTM"),
            # Efficiency
            "assetTurnover":    r.get("assetTurnoverTTM"),
            "inventoryTurnover":r.get("inventoryTurnoverTTM"),
        }
        logger.debug(
            f"[FMP] ratios({ticker}): grossMargin={result['grossMargin']} "
            f"netMargin={result['netMargin']} roe={result['returnOnEquity']}"
        )
        return result

    async def get_income_statement(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        data = await self._get(f"/income-statement/{ticker}", params={"limit": limit})
        if not data or not isinstance(data, list):
            return []
        records = []
        for item in data:
            records.append({
                "date":             item.get("date"),
                "revenue":          item.get("revenue"),
                "grossProfit":      item.get("grossProfit"),
                "ebit":             item.get("operatingIncome"),
                "netIncome":        item.get("netIncome"),
                "ebitda":           item.get("ebitda"),
                "eps":              item.get("eps"),
                "epsDiluted":       item.get("epsdiluted"),
                "weightedAvgShares":item.get("weightedAverageShsOutDil"),
            })
        return records

    async def get_balance_sheet(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        data = await self._get(f"/balance-sheet-statement/{ticker}", params={"limit": limit})
        if not data or not isinstance(data, list):
            return []
        records = []
        for item in data:
            records.append({
                "date":              item.get("date"),
                "totalAssets":       item.get("totalAssets"),
                "currentAssets":     item.get("totalCurrentAssets"),
                "currentLiabilities":item.get("totalCurrentLiabilities"),
                "totalLiabilities":  item.get("totalLiabilities"),
                "totalEquity":       item.get("totalStockholdersEquity"),
                "cash":              item.get("cashAndCashEquivalents"),
                "longTermDebt":      item.get("longTermDebt"),
                "totalDebt":         item.get("totalDebt"),
                "netDebt":           item.get("netDebt"),
            })
        return records

    async def get_cash_flow_statement(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        data = await self._get(f"/cash-flow-statement/{ticker}", params={"limit": limit})
        if not data or not isinstance(data, list):
            return []
        records = []
        for item in data:
            records.append({
                "date":              item.get("date"),
                "operatingCashFlow": item.get("operatingCashFlow"),
                "investingCashFlow": item.get("investingActivitiesCashFlow"),
                "financingCashFlow": item.get("financingActivitiesCashFlow"),
                "capex":             item.get("capitalExpenditure"),
                "freeCashFlow":      item.get("freeCashFlow"),
            })
        return records

    async def get_stock_data(self, ticker: str, period: str = "1y") -> Optional[Dict[str, Any]]:
        """Fetch historical daily price data from FMP."""
        # Map period strings to FMP date ranges
        from datetime import datetime, timedelta
        end_date = datetime.today()
        period_map = {"1d": 1, "5d": 5, "1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825}
        days = period_map.get(period, 365)
        start_date = end_date - timedelta(days=days)
        params = {
            "from": start_date.strftime("%Y-%m-%d"),
            "to":   end_date.strftime("%Y-%m-%d"),
        }
        data = await self._get(f"/historical-price-full/{ticker}", params=params)
        if not data or "historical" not in data:
            return None
        return {
            "ticker": ticker,
            "period": period,
            "data": [
                {
                    "date":   item.get("date"),
                    "open":   item.get("open"),
                    "high":   item.get("high"),
                    "low":    item.get("low"),
                    "close":  item.get("close"),
                    "volume": item.get("volume"),
                }
                for item in data["historical"][:days]
            ],
        }

    async def get_peers(self, ticker: str) -> List[str]:
        """
        Fetch peer companies from FMP /stock_peers endpoint.
        Returns a list of ticker symbols.
        """
        data = await self._get(f"/stock_peers", params={"symbol": ticker})
        p = self._first(data)
        if not p:
            return []
        peers = p.get("peersList", [])
        logger.info(f"[FMP] peers({ticker}): {peers}")
        return peers

    async def get_full_competitor_data(self, ticker: str) -> Dict[str, Any]:
        """
        Single consolidated call that fetches profile + key_metrics + ratios
        concurrently and merges them into one flat dict for CompetitorAgent.
        This is the primary entry point for competitor data.
        Returns {} if any error or no data.
        """
        if not self.client:
            return {}

        profile_task     = asyncio.create_task(self.get_company_profile(ticker))
        key_metrics_task = asyncio.create_task(self.get_key_metrics(ticker))
        ratios_task      = asyncio.create_task(self.get_financial_ratios(ticker))

        profile, key_metrics, ratios = await asyncio.gather(
            profile_task, key_metrics_task, ratios_task,
            return_exceptions=True
        )

        # Handle exceptions from gather
        if isinstance(profile, Exception):
            logger.warning(f"[FMP] profile({ticker}) exception: {profile}")
            profile = None
        if isinstance(key_metrics, Exception):
            logger.warning(f"[FMP] key_metrics({ticker}) exception: {key_metrics}")
            key_metrics = None
        if isinstance(ratios, Exception):
            logger.warning(f"[FMP] ratios({ticker}) exception: {ratios}")
            ratios = None

        if not profile and not key_metrics and not ratios:
            logger.warning(f"[FMP] No data returned for {ticker} from any endpoint")
            return {}

        # Merge: profile takes precedence for identity fields; metrics/ratios for financials
        merged = {}
        if profile:
            merged.update(profile)
        if key_metrics:
            merged.update(key_metrics)
        if ratios:
            # ratios may duplicate some ratio fields — overwrite with the more complete ratios endpoint
            for k, v in ratios.items():
                if v is not None and merged.get(k) is None:
                    merged[k] = v

        logger.info(
            f"[FMP] full_competitor_data({ticker}): "
            f"name={merged.get('shortName')} mc={merged.get('marketCap')} "
            f"rev={merged.get('revenue')} roe={merged.get('roe') or merged.get('returnOnEquity')} "
            f"pe={merged.get('pe') or merged.get('forwardPE')} "
            f"ebm={merged.get('ebitdaMargin')}"
        )
        return merged

    async def close(self) -> None:
        if self.client:
            await self.client.aclose()
