import os
from typing import List, Dict, Any, Optional
import httpx

from backend.services.news.base import NewsService
from backend.config.settings import get_settings
from backend.utils.logger import get_logger
from backend.utils.exceptions import MissingAPIKeyError, ServiceUnavailableError, ServiceRateLimitError

logger = get_logger(__name__)

class NewsAPIService(NewsService):
    """
    News service using the NewsAPI.
    Requires NEWSAPI_KEY.
    """
    BASE_URL = "https://newsapi.org/v2"

    def __init__(self) -> None:
        settings = get_settings()
        self.service_name = "NewsAPI"
        self.api_key = settings.newsapi_key or os.environ.get("NEWSAPI_KEY")
        self.enabled = settings.newsapi_enabled

        if not self.enabled:
            logger.info(f"{self.service_name} service is disabled.")
            self.client = None
            return

        if not self.api_key:
            raise MissingAPIKeyError(self.service_name)
        
        self.client = httpx.AsyncClient(base_url=self.BASE_URL, timeout=10.0)
        logger.info(f"Initializing {self.service_name} Service.")

    async def _make_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        if not self.client:
            logger.debug(f"Skipping {self.service_name} request, client not initialized.")
            return None

        headers = {"X-Api-Key": self.api_key}
        try:
            response = await self.client.get(endpoint, params=params, headers=headers)
            response.raise_for_status() # Raise an exception for 4xx/5xx responses
            data = response.json()
            if data.get("status") == "error":
                error_code = data.get("code")
                error_message = data.get("message")
                if error_code == "rateLimited":
                    raise ServiceRateLimitError(self.service_name)
                else:
                    raise ServiceUnavailableError(self.service_name, error_message)
            return data
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise ServiceRateLimitError(self.service_name)
            else:
                raise ServiceUnavailableError(self.service_name, str(e))
        except httpx.RequestError as e:
            raise ServiceUnavailableError(self.service_name, f"Network error: {e}")
        except Exception as e:
            raise ServiceUnavailableError(self.service_name, str(e))

    async def get_company_news(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        params = {
            "q": query,
            "language": "en",
            "sortBy": "relevancy",
            "pageSize": limit,
        }
        data = await self._make_request("/everything", params=params)
        if not data or "articles" not in data: return []

        articles = []
        for article in data["articles"]:
            articles.append({
                "source": article.get("source", {}).get("name"),
                "author": article.get("author"),
                "title": article.get("title"),
                "description": article.get("description"),
                "url": article.get("url"),
                "publishedAt": article.get("publishedAt"),
            })
        return articles
