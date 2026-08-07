from typing import List
from backend.rag.embedder import Embedder
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class EmbeddingService:
    """
    Manages vector representations of text segments.
    """
    def __init__(self, embedder: Embedder = None):
        # Allow dependency injection of a shared Embedder instance
        self.embedder = embedder or Embedder()

    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Translates a list of strings into high-dimensional vector representations.
        """
        logger.info(f"Generating dense embeddings for {len(texts)} chunks.")
        try:
            embeddings = self.embedder.embed_text(texts)
            logger.info(f"Successfully generated {len(embeddings)} embeddings.")
            return embeddings
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}", exc_info=True)
            raise RuntimeError(f"Embedding generation failed: {e}")
