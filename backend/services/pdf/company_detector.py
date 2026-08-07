import re
from typing import Dict, Any, List
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Known company registry mapping common names and tickers for instant accurate matching
KNOWN_COMPANIES = [
    {
        "keywords": ["apple inc", "apple computer", "iphone", "macbook", "aapl"],
        "name": "Apple Inc.",
        "ticker": "AAPL",
        "sector": "Technology",
        "industry": "Consumer Electronics"
    },
    {
        "keywords": ["tesla", "tsla", "elon musk", "gigafactory", "model s", "model 3", "model y"],
        "name": "Tesla, Inc.",
        "ticker": "TSLA",
        "sector": "Automotive",
        "industry": "Electric Vehicles & Clean Energy"
    },
    {
        "keywords": ["microsoft", "msft", "azure", "windows", "satya nadella"],
        "name": "Microsoft Corporation",
        "ticker": "MSFT",
        "sector": "Technology",
        "industry": "Software & Cloud Services"
    },
    {
        "keywords": ["nvidia", "nvda", "geforce", "cuda", "jensen huang"],
        "name": "NVIDIA Corporation",
        "ticker": "NVDA",
        "sector": "Technology",
        "industry": "Semiconductors & AI Hardware"
    },
    {
        "keywords": ["amazon", "amzn", "aws", "jeff bezos", "andy jassy"],
        "name": "Amazon.com, Inc.",
        "ticker": "AMZN",
        "sector": "Consumer Discretionary",
        "industry": "E-Commerce & Cloud Computing"
    },
    {
        "keywords": ["apollo hospitals", "apollo hospital", "apollohosp"],
        "name": "Apollo Hospitals Enterprise Limited",
        "ticker": "APOLLOHOSP",
        "sector": "Healthcare",
        "industry": "Hospitals & Healthcare Services"
    }
]

class CompanyDetector:
    """
    Service to detect company name, stock symbol/ticker, sector, and fiscal year from PDF pages.
    Guarantees every upload gets dynamically inspected.
    """

    @staticmethod
    def detect(pages_data: List[Dict[str, Any]], user_company: str = "", user_ticker: str = "") -> Dict[str, str]:
        """
        Analyzes PDF text pages to auto-detect company name and ticker.
        """
        logger.info(f"Running Company & Stock Symbol Detection on {len(pages_data)} pages...")
        
        # Combine text from first 5 pages for header inspection
        combined_header_text = " ".join([p["text"] for p in pages_data[:5]]).lower()

        # Initialize empty to prioritize PDF text extraction
        detected_name = ""
        detected_ticker = ""
        detected_sector = "Technology"
        detected_industry = "General Industry"
        detected_fy = "FY 2024-25"

        # 1. Match against known companies registry first from PDF text
        for comp in KNOWN_COMPANIES:
            matched = False
            for kw in comp["keywords"]:
                if kw in combined_header_text:
                    detected_name = comp["name"]
                    detected_ticker = comp["ticker"]
                    detected_sector = comp["sector"]
                    detected_industry = comp["industry"]
                    logger.info(f"Matched keyword '{kw}' in PDF -> Company: {comp['name']} ({comp['ticker']})")
                    matched = True
                    break
            if matched:
                break

        # 2. Fallback to user-supplied overrides ONLY if not detected from PDF
        if not detected_name and user_company:
            detected_name = user_company.strip()
            # Check if user-supplied name matches a known company to fill ticker/sector details
            for comp in KNOWN_COMPANIES:
                if comp["name"].lower() == detected_name.lower() or any(kw in detected_name.lower() for kw in comp["keywords"]):
                    detected_name = comp["name"]
                    detected_ticker = comp["ticker"]
                    detected_sector = comp["sector"]
                    detected_industry = comp["industry"]
                    break

        if not detected_ticker and user_ticker:
            detected_ticker = user_ticker.strip().upper()
            # Try to resolve other details if ticker is known
            for comp in KNOWN_COMPANIES:
                if comp["ticker"].upper() == detected_ticker:
                    detected_name = comp["name"]
                    detected_sector = comp["sector"]
                    detected_industry = comp["industry"]
                    break

        # 3. Extract fiscal year from text
        fy_match = re.search(r'(fy\s*20\d{2}[-\s]*\d{2,4}|fiscal\s*year\s*20\d{2}|annual\s*report\s*20\d{2})', combined_header_text, re.IGNORECASE)
        if fy_match:
            detected_fy = fy_match.group(0).upper()

        # 4. Fallbacks if name or ticker still empty
        if not detected_name:
            # Try to extract first prominent line
            lines = [line.strip() for page in pages_data[:2] for line in page["text"].split("\n") if len(line.strip()) > 3]
            detected_name = lines[0] if lines else "Target Company"

        if not detected_ticker:
            # Generate ticker from company initials
            words = [w for w in re.sub(r'[^a-zA-Z0-9 ]', '', detected_name).split() if w.lower() not in ['inc', 'corp', 'corporation', 'ltd', 'limited', 'co']]
            detected_ticker = "".join([w[0] for w in words]).upper()[:6] if words else "TICKER"

        result = {
            "company_name": detected_name,
            "ticker": detected_ticker,
            "sector": detected_sector,
            "industry": detected_industry,
            "fiscal_year": detected_fy
        }

        logger.info(f"Detected Company: '{result['company_name']}', Stock Symbol: '{result['ticker']}', Sector: '{result['sector']}', Fiscal Year: '{result['fiscal_year']}'")
        return result
