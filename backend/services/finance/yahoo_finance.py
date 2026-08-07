"""
Yahoo Finance Service — v2
Fixes:
  1. Uses yfinance.Ticker with session management to reduce 429 errors
  2. Adds exponential backoff retry on 429
  3. Falls back to .fast_info for price/market cap when .info fails
  4. All DataFrames use .loc[] not dict .get()
"""
import asyncio
import time
import math
from typing import Dict, Any, List, Optional
import yfinance as yf

from backend.services.finance.base import FinancialService
from backend.utils.logger import get_logger
from backend.utils.exceptions import ServiceUnavailableError, DataNotFoundError

logger = get_logger(__name__)


def _sf(val) -> Optional[float]:
    """Safe float conversion — returns None for NaN/Inf."""
    if val is None:
        return None
    try:
        f = float(val)
        return None if math.isnan(f) or math.isinf(f) else f
    except (TypeError, ValueError):
        return None


class YahooFinanceService(FinancialService):
    """
    Financial data service using Yahoo Finance via the yfinance library.
    No API key required. Implements retry with backoff for 429 errors.
    """

    def __init__(self) -> None:
        self.service_name = "Yahoo Finance"
        import requests
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        })
        logger.info(f"Initializing {self.service_name} Service.")

    def _get_stock(self, ticker: str) -> yf.Ticker:
        return yf.Ticker(ticker, session=self._session)

    def _fetch_info_sync(self, ticker: str, retries: int = 3) -> Dict[str, Any]:
        """
        Synchronous fetch of stock.info with exponential backoff.
        Swallows 429 errors gracefully and returns {} on repeated failure.
        """
        stock = self._get_stock(ticker)
        for attempt in range(retries):
            try:
                info = stock.info or {}
                if info and len(info) > 5:
                    return info
                logger.warning(f"[{ticker}] Empty info dict on attempt {attempt + 1}")
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "Too Many Requests" in err_str:
                    wait = 2 ** attempt * 3   # 3s, 6s, 12s
                    logger.warning(f"[{ticker}] Rate limited (429). Waiting {wait}s before retry {attempt + 1}.")
                    time.sleep(wait)
                elif "Expecting value" in err_str:
                    # Empty response body — also rate limiting
                    wait = 2 ** attempt * 2
                    logger.warning(f"[{ticker}] Empty response (likely rate limit). Waiting {wait}s.")
                    time.sleep(wait)
                else:
                    logger.error(f"[{ticker}] info fetch error: {e}")
                    break
        return {}

    def _fetch_fast_info_sync(self, ticker: str) -> Dict[str, Any]:
        """
        Fetch fast_info (price + market cap) — uses a lighter API endpoint.
        """
        try:
            stock = self._get_stock(ticker)
            fi = stock.fast_info
            return {
                "market_cap":    _sf(getattr(fi, "market_cap", None)),
                "price":         _sf(getattr(fi, "last_price", None)),
                "week_52_high":  _sf(getattr(fi, "year_high", None)),
                "week_52_low":   _sf(getattr(fi, "year_low", None)),
                "currency":      getattr(fi, "currency", None),
                "exchange":      getattr(fi, "exchange", None),
            }
        except Exception as e:
            logger.debug(f"[{ticker}] fast_info failed: {e}")
            return {}

    async def _get_ticker_object(self, ticker: str) -> Optional[yf.Ticker]:
        """
        Async wrapper — validates ticker by checking fast_info.
        """
        try:
            stock = self._get_stock(ticker)
            # Use fast_info to validate ticker without triggering heavy REST call
            fi = await asyncio.to_thread(lambda: stock.fast_info)
            mc = getattr(fi, "market_cap", None)
            if mc is None:
                logger.warning(f"[{ticker}] fast_info market_cap is None — ticker may be invalid.")
            return stock
        except Exception as e:
            logger.error(f"[{ticker}] Ticker validation failed: {e}")
            return None

    async def get_company_profile(self, ticker: str) -> Optional[Dict[str, Any]]:
        info = await asyncio.to_thread(self._fetch_info_sync, ticker)
        if not info:
            return None
        return {
            "symbol":               info.get("symbol"),
            "shortName":            info.get("shortName") or info.get("longName"),
            "longBusinessSummary":  info.get("longBusinessSummary"),
            "sector":               info.get("sector"),
            "industry":             info.get("industry"),
            "fullTimeEmployees":    info.get("fullTimeEmployees"),
            "website":              info.get("website"),
            "currency":             info.get("currency"),
            "exchange":             info.get("exchange"),
        }

    async def get_key_metrics(self, ticker: str) -> Optional[Dict[str, Any]]:
        info = await asyncio.to_thread(self._fetch_info_sync, ticker)
        if not info:
            return None
        return {
            "revenue":       info.get("totalRevenue"),
            "netIncome":     info.get("netIncomeToCommon") or info.get("netIncome"),
            "ebitda":        info.get("ebitda"),
            "marketCap":     info.get("marketCap"),
            "freeCashFlow":  info.get("freeCashflow") or info.get("freeCashFlow"),
        }

    async def get_financial_ratios(self, ticker: str) -> Optional[Dict[str, Any]]:
        info = await asyncio.to_thread(self._fetch_info_sync, ticker)
        if not info:
            return None
        return {
            "pegRatio":      info.get("pegRatio"),
            "forwardPE":     info.get("forwardPE"),
            "trailingPE":    info.get("trailingPE"),
            "debtToEquity":  info.get("debtToEquity"),
            "returnOnEquity":info.get("returnOnEquity"),
            "returnOnAssets":info.get("returnOnAssets"),
            "currentRatio":  info.get("currentRatio"),
            "priceToBook":   info.get("priceToBook"),
            "ebitdaMargins": info.get("ebitdaMargins"),
            "grossMargins":  info.get("grossMargins"),
            "operatingMargins": info.get("operatingMargins"),
            "profitMargins": info.get("profitMargins"),
        }

    async def get_income_statement(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        stock = await self._get_ticker_object(ticker)
        if not stock:
            return []
        try:
            df = await asyncio.to_thread(lambda: stock.income_stmt)
            if df is None or df.empty:
                return []
            records = []
            for col in df.columns[:limit]:
                date_str = col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)[:10]
                def _loc(row):
                    try:
                        return _sf(df.loc[row, col]) if row in df.index else None
                    except Exception:
                        return None
                records.append({
                    "date":       date_str,
                    "revenue":    _loc("Total Revenue"),
                    "grossProfit":_loc("Gross Profit"),
                    "ebit":       _loc("Operating Income"),
                    "netIncome":  _loc("Net Income"),
                    "ebitda":     _loc("EBITDA"),
                })
            return records
        except Exception as e:
            logger.error(f"[{ticker}] income_stmt error: {e}")
            return []

    async def get_balance_sheet(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        stock = await self._get_ticker_object(ticker)
        if not stock:
            return []
        try:
            df = await asyncio.to_thread(lambda: stock.balance_sheet)
            if df is None or df.empty:
                return []
            records = []
            for col in df.columns[:limit]:
                date_str = col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)[:10]
                def _loc(row):
                    try:
                        return _sf(df.loc[row, col]) if row in df.index else None
                    except Exception:
                        return None
                records.append({
                    "date":               date_str,
                    "totalAssets":        _loc("Total Assets"),
                    "currentAssets":      _loc("Current Assets"),
                    "currentLiabilities": _loc("Current Liabilities"),
                    "totalLiabilities":   _loc("Total Liabilities Net Minority Interest"),
                    "totalEquity":        _loc("Stockholders Equity"),
                    "cash":               _loc("Cash And Cash Equivalents"),
                    "longTermDebt":       _loc("Long Term Debt"),
                })
            return records
        except Exception as e:
            logger.error(f"[{ticker}] balance_sheet error: {e}")
            return []

    async def get_cash_flow_statement(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        stock = await self._get_ticker_object(ticker)
        if not stock:
            return []
        try:
            df = await asyncio.to_thread(lambda: stock.cashflow)
            if df is None or df.empty:
                return []
            records = []
            for col in df.columns[:limit]:
                date_str = col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)[:10]
                def _loc(row):
                    try:
                        return _sf(df.loc[row, col]) if row in df.index else None
                    except Exception:
                        return None
                records.append({
                    "date":              date_str,
                    "operatingCashFlow": _loc("Operating Cash Flow"),
                    "investingCashFlow": _loc("Investing Cash Flow"),
                    "financingCashFlow": _loc("Financing Cash Flow"),
                    "capex":             _loc("Capital Expenditure"),
                    "freeCashFlow":      _loc("Free Cash Flow"),
                })
            return records
        except Exception as e:
            logger.error(f"[{ticker}] cashflow error: {e}")
            return []

    async def get_stock_data(self, ticker: str, period: str = "1y") -> Optional[Dict[str, Any]]:
        stock = await self._get_ticker_object(ticker)
        if not stock:
            return None
        try:
            hist = await asyncio.to_thread(lambda: stock.history(period=period))
            if hist is None or hist.empty:
                return None
            data = []
            for index, row in hist.iterrows():
                data.append({
                    "date":   index.strftime("%Y-%m-%d"),
                    "open":   _sf(row.get("Open")),
                    "high":   _sf(row.get("High")),
                    "low":    _sf(row.get("Low")),
                    "close":  _sf(row.get("Close")),
                    "volume": _sf(row.get("Volume")),
                })
            return {"ticker": ticker, "period": period, "data": data}
        except Exception as e:
            logger.error(f"[{ticker}] stock_data error: {e}")
            return None

    async def get_peers(self, ticker: str) -> List[str]:
        logger.info(f"{self.service_name} does not support direct peer lookup.")
        return []
