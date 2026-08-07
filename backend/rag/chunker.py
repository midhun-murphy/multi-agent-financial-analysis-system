import re
from typing import List, Dict, Any

from backend.utils.logger import get_logger

logger = get_logger(__name__)

class Chunker:
    """
    Service for splitting text into semantic and structural chunks.
    Respects section boundaries, table structures, and uses a sliding window for context.
    """

    @staticmethod
    def chunk_pages(pages_data: List[Dict[str, Any]], chunk_size: int = 1000, chunk_overlap: int = 200) -> List[Dict[str, Any]]:
        """
        Splits text from pages into chunks with specified size and overlap.
        """
        chunks = []
        for page in pages_data:
            text = page["text"]
            page_num = page["page_number"]
            metadata = page["metadata"]

            # Basic recursive/semantic chunking simulation:
            # 1. Clean extra whitespace
            text = re.sub(r'\s+', ' ', text).strip()
            
            # 2. Split into segments (by sentences/paragraphs)
            segments = re.split(r'(?<=[.!?]) +', text)
            
            current_chunk = ""
            for segment in segments:
                if len(current_chunk) + len(segment) <= chunk_size:
                    current_chunk += " " + segment
                else:
                    if current_chunk:
                        chunks.append({
                            "text": current_chunk.strip(),
                            "metadata": {**metadata, "type": "text"}
                        })
                    
                    # Start new chunk with overlap from previous
                    overlap_text = current_chunk[-chunk_overlap:] if len(current_chunk) > chunk_overlap else current_chunk
                    current_chunk = overlap_text + " " + segment

            if current_chunk:
                chunks.append({
                    "text": current_chunk.strip(),
                    "metadata": {**metadata, "type": "text"}
                })

            # Also add tables as separate high-priority chunks
            for table_idx, table in enumerate(page["tables"]):
                table_str = Chunker._format_table(table)
                if table_str:
                    chunks.append({
                        "text": table_str,
                        "metadata": {**metadata, "type": "table", "table_index": table_idx}
                    })

        logger.info(f"Generated {len(chunks)} chunks from {len(pages_data)} pages.")
        return chunks

    @staticmethod
    def _format_table(table: List[List[Any]]) -> str:
        """
        Convert a list-of-lists table into a markdown-like string format for the LLM.
        """
        if not table:
            return ""
        rows = []
        for row in table:
            rows.append(" | ".join([str(cell) if cell is not None else "" for cell in row]))
        return "\n".join(rows)
