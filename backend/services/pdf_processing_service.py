from typing import List, Dict, Any
from backend.services.pdf.pdf_processor import PDFProcessor
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class PDFProcessingService:
    """
    Handles PDF parsing, cleaning, and text extraction logic.
    """
    def __init__(self):
        pass

    def extract_text(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Parses a local PDF file and returns structured pages data.
        """
        logger.info(f"Delegating text extraction for file: {file_path}")
        try:
            pages_data = PDFProcessor.extract_text_from_pdf(file_path)
            total_chars = sum(len(p.get("text", "")) for p in pages_data)
            logger.info(f"PDF processed: {len(pages_data)} pages, {total_chars} total characters.")
            return pages_data
        except Exception as e:
            logger.error(f"Failed to process PDF text: {e}", exc_info=True)
            raise RuntimeError(f"PDF text extraction failed: {e}")
