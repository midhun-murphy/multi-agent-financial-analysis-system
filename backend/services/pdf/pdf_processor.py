import os
from typing import List, Dict, Any, Optional
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io

from backend.utils.logger import get_logger
from backend.utils.exceptions import PDFProcessingError

logger = get_logger(__name__)

class PDFProcessor:
    """
    Service responsible for robustly parsing and extracting content from PDF files.
    Uses PyMuPDF (fitz) for native text/table extraction and pytesseract/OCR for scanned pages.
    """

    @staticmethod
    def extract_text_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extracts text from a PDF file page by page.
        Returns a list of dictionaries containing page index and extracted text, tables, or metadata.
        """
        if not os.path.exists(pdf_path):
            raise PDFProcessingError(pdf_path, f"PDF file not found at: {pdf_path}")

        pages_data = []
        try:
            doc = fitz.open(pdf_path)
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text = page.get_text("text")

                # Table extraction: only run if the page is likely to contain financial tables
                tables = []
                text_lower = text.lower()
                table_keywords = [
                    "statement", "balance", "sheet", "cash", "flow", "income", "revenue", 
                    "profit", "peer", "competitor", "financial", "table", "operations", 
                    "assets", "liabilities", "equity"
                ]
                if any(kw in text_lower for kw in table_keywords):
                    try:
                        tabs = page.find_tables()
                        for tab in tabs:
                            tables.append(tab.extract())
                    except Exception as table_err:
                        logger.debug(f"Could not extract tables from page {page_num}: {table_err}")

                # Fallback to OCR if page has absolutely no text (scanned page)
                if len(text.strip()) == 0:
                    logger.info(f"Page {page_num} of {pdf_path} has no text. Attempting OCR fallback.")
                    text = PDFProcessor._ocr_page(page)

                pages_data.append({
                    "page_number": page_num + 1,
                    "text": text,
                    "tables": tables,
                    "metadata": {
                        "source": pdf_path,
                        "page": page_num + 1
                    }
                })
            doc.close()
            logger.info(f"Successfully processed PDF: {pdf_path} ({len(pages_data)} pages)")
            
            # Diagnostics Step 1
            full_pdf_text = "".join(p.get("text", "") for p in pages_data)
            print("------------------------------------")
            print("PDF LENGTH:", len(full_pdf_text))
            print("FIRST 1000 CHARACTERS:")
            print(full_pdf_text[:1000])
            print("LAST 1000 CHARACTERS:")
            print(full_pdf_text[-1000:])
            print("------------------------------------")

            return pages_data
        except Exception as e:
            logger.error(f"Error parsing PDF: {pdf_path}, Error: {e}", exc_info=True)
            raise PDFProcessingError(pdf_path, str(e))

    @staticmethod
    def _ocr_page(page: fitz.Page) -> str:
        """
        Render the PDF page as an image and perform OCR using Tesseract.
        """
        try:
            pix = page.get_pixmap(dpi=150)
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            text = pytesseract.image_to_string(img)
            return text
        except Exception as ocr_err:
            logger.error(f"OCR fallback failed for page: {ocr_err}")
            return ""
