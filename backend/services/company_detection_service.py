from typing import List, Dict, Any
from backend.services.pdf.company_detector import CompanyDetector
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class CompanyDetectionService:
    """
    Auto-detects company names, tickers, sectors, and report periods from parsed PDF documents.
    """
    def __init__(self):
        pass

    def detect_company_details(self, pages_data: List[Dict[str, Any]], user_company: str = "", user_ticker: str = "") -> Dict[str, str]:
        """
        Analyzes PDF text pages to auto-detect company metadata with fallback overrides.
        """
        logger.info(f"Detecting company metadata (User input: company={user_company}, ticker={user_ticker})")
        try:
            detected = CompanyDetector.detect(pages_data, user_company=user_company, user_ticker=user_ticker)
            logger.info(f"Detection results: ticker={detected.get('ticker')}, company={detected.get('company_name')}, fiscal_year={detected.get('fiscal_year')}")
            return detected
        except Exception as e:
            logger.error(f"Failed to auto-detect company details: {e}", exc_info=True)
            # Safe fallback if detection breaks
            return {
                "company_name": user_company or "Target Company",
                "ticker": user_ticker or "TICKER",
                "sector": "Technology",
                "industry": "General Industry",
                "fiscal_year": "FY 2024"
            }
