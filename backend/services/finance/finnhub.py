import os
from typing import Dict, Any, List, Optional
import finnhub

from backend.services.finance.base import FinancialService
from backend.config.settings import get_settings
from backend.utils.logger import get_logger
from backend.utils.exceptions import MissingAPIKeyError, ServiceUnavailableError, ServiceRateLimitError, DataNotFoundError

logger = get_logger(__name__)

class FinnhubService(FinancialService):
    """
    Financial data service using Finnhub API.
    Requires FINNHUB_API_KEY.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.service_name = "Finnhub"
        self.api_key = settings.finnhub_api_key or os.environ.get("FINNHUB_API_KEY")
        self.enabled = settings.finnhub_enabled

        if not self.enabled:
            logger.info(f"{self.service_name} service is disabled.")
            self.client = None
            return

        if not self.api_key:
            raise MissingAPIKeyError(self.service_name)
        
        self.client = finnhub.Client(api_key=self.api_key)
        logger.info(f"Initializing {self.service_name} Service.")

    async def _make_request(self, func, *args, **kwargs) -> Optional[Dict[str, Any]]:
        if not self.client:
            logger.debug(f"Skipping {self.service_name} request, client not initialized.")
            return None
        try:
            # Finnhub client methods are synchronous, run in executor for async compatibility
            import asyncio
            loop = asyncio.get_running_loop()
            from functools import partial
            p_func = partial(func, *args, **kwargs)
            result = await loop.run_in_executor(None, p_func)
            if not result:
                return None
            return result
        except finnhub.FinnhubAPIException as e:
            if e.status_code == 429: # Rate limit exceeded
                raise ServiceRateLimitError(self.service_name)
            else:
                raise ServiceUnavailableError(self.service_name, str(e))
        except Exception as e:
            raise ServiceUnavailableError(self.service_name, str(e))

    async def get_company_profile(self, ticker: str) -> Optional[Dict[str, Any]]:
        profile = await self._make_request(self.client.company_profile2, symbol=ticker)
        if not profile: return None
        return {
            "symbol": profile.get("ticker"),
            "shortName": profile.get("name"),
            "longBusinessSummary": profile.get("finnhubIndustry"), # Best match for summary
            "sector": profile.get("sector"),
            "industry": profile.get("finnhubIndustry"),
            "fullTimeEmployees": None, # Not directly available
            "website": profile.get("weburl"),
            "currency": profile.get("currency"),
            "exchange": profile.get("exchange"),
        }

    async def get_key_metrics(self, ticker: str) -> Optional[Dict[str, Any]]:
        # Finnhub provides these as part of financial statements, not separate key metrics endpoint
        return None 

    async def get_financial_ratios(self, ticker: str) -> Optional[Dict[str, Any]]:
        # Finnhub provides these as part of financial statements, not separate ratios endpoint
        return None

    async def get_income_statement(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        return []

    async def get_balance_sheet(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        return []

    async def get_cash_flow_statement(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        return []

    async def get_stock_data(self, ticker: str, period: str = "1y") -> Optional[Dict[str, Any]]:
        # Finnhub provides candlestick data but requires date ranges.
        # This method is simplified for now, might need date conversion for 'period'
        logger.warning(f"Finnhub get_stock_data not fully implemented for period ")
        return None # Returning None as full implementation requires date logic

    async def get_peers(self, ticker: str) -> List[str]:
        peers = await self._make_request(self.client.company_peers, symbol=ticker)
        if not peers: return []
        return peers

    async def get_basic_financials(self, ticker: str) -> Optional[Dict[str, Any]]:
        financials = await self._make_request(self.client.company_basic_financials, symbol=ticker, metric="all")
        if not financials or "metric" not in financials:
            return None
        m = financials.get("metric", {})
        return {
            "pe":             m.get("peTTM") or m.get("peBasicExclExtraItemsTTM"),
            "pb":             m.get("pbRatioTTM"),
            "roe":            m.get("roeTTM") or m.get("roeTTMEquity"),
            "roa":            m.get("roaTTM") or m.get("roaTTMAssets"),
            "dividendYield":  m.get("dividendYieldIndicatedAnnually"),
            "netMargin":      m.get("netProfitMarginTTM"),
            "grossMargin":    m.get("grossMarginTTM"),
            "operatingMargin":m.get("operatingMarginTTM"),
            "debtToEquity":   m.get("debt/equityTTM") or m.get("totalDebt/totalEquityTTM"),
            "currentRatio":   m.get("currentRatioTTM"),
            "quickRatio":     m.get("quickRatioTTM"),
            "eps":            m.get("epsBasicExclExtraItemsTTM"),
            "marketCap":      m.get("marketCapitalization"),
        }
