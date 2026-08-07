from typing import List, Dict, Any
from backend.services.pdf.financial_statement_parser import FinancialStatementParser
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class FinancialParserService:
    """
    Service wrapping the high-precision rule-based table and text metric parser.
    """
    def __init__(self):
        pass

    def parse_statements(self, pages_data: List[Dict[str, Any]], company_name: str = "") -> Dict[str, Any]:
        """
        Parses pages_data for Income Statement, Balance Sheet, Cash Flow metrics, and multi-year trends.
        """
        logger.info(f"Triggering statement parser for company: {company_name}")
        try:
            parsed_payload = FinancialStatementParser.parse_financial_statements(pages_data, company_name=company_name)
            logger.info(f"Parsing complete. Detected {len(parsed_payload.get('metadata', {}).get('detected_years', []))} fiscal years.")
            return parsed_payload
        except Exception as e:
            logger.error(f"Financial statements parser failed: {e}", exc_info=True)
            raise RuntimeError(f"Financial statement parsing failed: {e}")
