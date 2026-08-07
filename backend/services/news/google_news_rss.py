import re
import httpx
from typing import List, Dict, Any, Optional
import xml.etree.ElementTree as ET

from backend.services.news.base import NewsService
from backend.config.settings import get_settings
from backend.utils.logger import get_logger
from backend.utils.exceptions import ServiceUnavailableError

logger = get_logger(__name__)

class GoogleNewsRSSService(NewsService):
    """
    News service using Google News RSS feeds.
    """

    BASE_URL = "https://news.google.com/rss/search?q="

    def __init__(self) -> None:
        settings = get_settings()
        self.service_name = "Google News RSS"
        self.enabled = settings.google_news_enabled

        if not self.enabled:
            logger.info(f"{self.service_name} service is disabled.")
            self.client = None
            return
        
        self.client = httpx.AsyncClient(timeout=10.0)
        logger.info(f"Initializing {self.service_name} Service.")

    async def _make_request(self, query: str) -> Optional[str]:
        if not self.client:
            logger.debug(f"Skipping {self.service_name} request, client not initialized.")
            return None
        
        try:
            search_query = query.replace(" ", "+")
            url = f"{self.BASE_URL}{search_query}&hl=en-IN&gl=IN&ceid=IN:en"
            response = await self.client.get(url)
            response.raise_for_status()
            return response.text
        except httpx.HTTPStatusError as e:
            raise ServiceUnavailableError(self.service_name, str(e))
        except httpx.RequestError as e:
            raise ServiceUnavailableError(self.service_name, f"Network error: {e}")
        except Exception as e:
            raise ServiceUnavailableError(self.service_name, str(e))

    async def get_company_news(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        xml_data = await self._make_request(query)
        if not xml_data: return []

        articles = []
        try:
            root = ET.fromstring(xml_data)
            for item in root.findall(".//item"):
                title = item.find("title").text if item.find("title") is not None else "No Title"
                link = item.find("link").text if item.find("link") is not None else ""
                pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
                description = item.find("description").text if item.find("description") is not None else ""
                
                # Clean up description (remove HTML tags)
                clean_description = re.sub(r'<.*?>', '', description)
                
                articles.append({
                    "source": "Google News",
                    "author": None,
                    "title": title,
                    "description": clean_description,
                    "url": link,
                    "publishedAt": pub_date,
                })
                if len(articles) >= limit:
                    break
            return articles
        except Exception as e:
            logger.error(f"Error parsing Google News RSS feed: {e}", exc_info=True)
            return []
