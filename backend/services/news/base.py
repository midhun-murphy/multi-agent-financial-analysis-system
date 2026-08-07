from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class NewsService(ABC):
    """
    Abstract base class for all news data services.
    Defines the common interface for fetching news articles.
    """

    @abstractmethod
    async def get_company_news(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Fetches news articles related to a company query.
        """
        pass
