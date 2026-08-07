from typing import List, Union, Optional
import numpy as np
from sentence_transformers import SentenceTransformer

from backend.config.settings import get_settings
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class Embedder:
    """
    Service for generating vector embeddings using sentence-transformers.
    Default model: all-MiniLM-L6-v2
    """

    def __init__(self, model_name: Optional[str] = None) -> None:
        settings = get_settings()
        self.model_name = model_name or settings.embedding_model
        logger.info(f"Loading embedding model: {self.model_name}")
        self.model = SentenceTransformer(self.model_name)

    def embed_text(self, text: Union[str, List[str]]) -> List[List[float]]:
        """
        Generates embeddings for a single string or a list of strings.
        Returns a list of embedding vectors.
        """
        try:
            # Ensure input is a list
            texts = [text] if isinstance(text, str) else text
            
            embeddings = self.model.encode(texts, batch_size=128)
            
            # Convert numpy array to list of lists
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}", exc_info=True)
            raise e

    def get_embedding_dimension(self) -> int:
        """
        Returns the dimension of the embeddings produced by the model.
        """
        return self.model.get_sentence_embedding_dimension()
