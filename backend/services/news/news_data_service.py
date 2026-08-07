from typing import List, Dict, Any, Optional

from backend.config.settings import get_settings
from backend.utils.logger import get_logger
from backend.utils.exceptions import DataNotFoundError
from backend.services.news.base import NewsService
from backend.services.news.newsapi import NewsAPIService
from backend.services.news.google_news_rss import GoogleNewsRSSService

logger = get_logger(__name__)

class NewsDataService(NewsService):
    """
    Aggregates various news data services and provides a fallback mechanism.
    It attempts to fetch news from preferred sources first, then falls back to others.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.services: List[NewsService] = []

        # Initialize services based on configuration and preference
        if settings.newsapi_enabled:
            try:
                self.services.append(NewsAPIService())
            except Exception as e:
                logger.warning(f"NewsAPIService could not be initialized: {e}")
        if settings.google_news_enabled:
            try:
                self.services.append(GoogleNewsRSSService())
            except Exception as e:
                logger.warning(f"GoogleNewsRSSService could not be initialized: {e}")
        
        if not self.services:
            logger.error("No news data services are enabled or configured. All news data calls will fail.")

    async def get_company_news(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        for service in self.services:
            try:
                logger.info(f"Attempting to fetch news for \'{query}\' from {service.service_name}")
                articles = await service.get_company_news(query, limit=limit)
                if articles:
                    logger.info(f"Successfully fetched news for \'{query}\' from {service.service_name}")
                    return articles
            except DataNotFoundError:
                logger.info(f"News for \'{query}\' not found in {service.service_name}. Trying next service.")
            except Exception as e:
                logger.warning(f"Error fetching news for \'{query}\' from {service.service_name}: {e}")
        logger.error(f"Failed to fetch news for \'{query}\' from all configured services.")
        return []
