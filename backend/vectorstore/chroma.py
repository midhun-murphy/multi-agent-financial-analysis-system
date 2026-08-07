import os
import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Any, Optional

from backend.config.settings import get_settings
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class ChromaManager:
    """
    Manager for ChromaDB operations, including collection management and persistence.
    Guarantees isolation of vector embeddings per report upload.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.persist_directory = settings.chroma_persist_dir
        self.collection_name = settings.chroma_collection_name
        
        # Ensure persist directory exists
        os.makedirs(self.persist_directory, exist_ok=True)

        self.client = chromadb.PersistentClient(
            path=self.persist_directory,
            settings=ChromaSettings(allow_reset=True)
        )
        self.collection = self.client.get_or_create_collection(name=self.collection_name)
        logger.info(f"Initialized ChromaManager with collection: {self.collection_name} (Current doc count: {self.get_count()})")

    def get_count(self) -> int:
        """Returns the number of documents in the collection."""
        try:
            return self.collection.count()
        except Exception:
            return 0

    def add_documents(self, ids: List[str], documents: List[str], embeddings: List[List[float]], metadatas: List[Dict[str, Any]]) -> None:
        """
        Adds documents and their corresponding embeddings and metadata to the collection.
        """
        import time
        t_start = time.perf_counter()
        logger.info(f"[DEBUG LOG] [0.00s] Entering Chroma add_documents. Size: {len(ids)}")
        try:
            self.collection.add(
                ids=ids,
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas
            )
            t_end = time.perf_counter()
            logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exiting Chroma add_documents. Total collection size: {self.get_count()}")
        except Exception as e:
            logger.error(f"Error adding documents to ChromaDB: {e}", exc_info=True)
            raise e

    def query(self, query_embeddings: List[List[float]], n_results: int = 10) -> Dict[str, Any]:
        """
        Queries the collection using the provided embeddings.
        """
        import time
        t_start = time.perf_counter()
        logger.info(f"[DEBUG LOG] [0.00s] Entering Chroma query. Results limit: {n_results}")
        try:
            results = self.collection.query(
                query_embeddings=query_embeddings,
                n_results=n_results
            )
            t_end = time.perf_counter()
            logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exiting Chroma query. Returned {len(results.get('documents', [[]])[0])} chunks")
            return results
        except Exception as e:
            logger.error(f"Error querying ChromaDB: {e}", exc_info=True)
            raise e

    def delete_collection(self) -> None:
        """
        Deletes the current collection completely to ensure no stale vectors exist.
        """
        try:
            old_count = self.get_count()
            try:
                self.client.delete_collection(self.collection_name)
            except Exception as e:
                logger.debug(f"Collection deletion warning: {e}")
            
            self.collection = self.client.get_or_create_collection(name=self.collection_name)
            
            # If items still remain, clear by ID
            if self.get_count() > 0:
                existing = self.collection.get()
                if existing and existing.get("ids"):
                    self.collection.delete(ids=existing["ids"])
                    
            logger.info(f"Collection cleared. Old count: {old_count} -> New Collection size: {self.get_count()}")
        except Exception as e:
            logger.error(f"Error resetting collection: {e}", exc_info=True)
