from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional

class FinancialService(ABC):
    """
    Abstract base class for all financial data services.
    Defines the common interface for fetching financial metrics.
    """

    @abstractmethod
    async def get_company_profile(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Fetches general company profile information.
        """
        pass

    @abstractmethod
    async def get_key_metrics(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Fetches key financial metrics (e.g., revenue, net income, EBITDA).
        """
        pass

    @abstractmethod
    async def get_financial_ratios(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Fetches financial ratios (e.g., P/E, Debt-to-Equity, ROE).
        """
        pass

    @abstractmethod
    async def get_income_statement(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Fetches income statements for the last 'limit' periods.
        """
        pass

    @abstractmethod
    async def get_balance_sheet(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Fetches balance sheets for the last 'limit' periods.
        """
        pass

    @abstractmethod
    async def get_cash_flow_statement(self, ticker: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Fetches cash flow statements for the last 'limit' periods.
        """
        pass

    @abstractmethod
    async def get_stock_data(self, ticker: str, period: str = "1y") -> Optional[Dict[str, Any]]:
        """
        Fetches historical stock data.
        """
        pass

    @abstractmethod
    async def get_peers(self, ticker: str) -> List[str]:
        """
        Fetches a list of peer company tickers.
        """
        pass
