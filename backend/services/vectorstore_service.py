from typing import List, Dict, Any
from backend.vectorstore.chroma import ChromaManager
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class VectorStoreService:
    """
    Interfaces directly with persistent ChromaDB indices.
    """
    def __init__(self, chroma_manager: ChromaManager = None):
        self.chroma_manager = chroma_manager or ChromaManager()

    def clear_database(self) -> None:
        """
        Clears all documents in the active Chroma collection.
        """
        logger.info("Clearing active vector store collection.")
        try:
            self.chroma_manager.delete_collection()
            logger.info("Vector collection cleared successfully.")
        except Exception as e:
            logger.error(f"Failed to clear vector database: {e}", exc_info=True)
            raise RuntimeError(f"ChromaDB clear operation failed: {e}")

    def add_documents(self, ids: List[str], texts: List[str], embeddings: List[List[float]], metadatas: List[Dict[str, Any]]) -> None:
        """
        Populates vector store database with chunks, embeddings, and metadata.
        """
        logger.info(f"Adding {len(ids)} document representations to Chroma collection.")
        try:
            self.chroma_manager.add_documents(ids, texts, embeddings, metadatas)
            logger.info(f"Indexed documents successfully. Current size: {self.get_document_count()}")
        except Exception as e:
            logger.error(f"Failed to index documents into Chroma: {e}", exc_info=True)
            raise RuntimeError(f"ChromaDB insert operation failed: {e}")

    def get_document_count(self) -> int:
        """
        Returns number of indexed vectors in the active collection.
        """
        try:
            return self.chroma_manager.collection.count()
        except Exception as e:
            logger.error(f"Error querying collection count: {e}")
            return 0
