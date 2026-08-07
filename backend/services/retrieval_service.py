from typing import List, Dict, Any
from backend.rag.retriever import HybridRetriever
from backend.services.embedding_service import EmbeddingService
from backend.services.vectorstore_service import VectorStoreService
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class RetrievalService:
    """
    Executes hybrid (BM25 + Semantic Vector) keyword query scans across indexed document chunks.
    """
    def __init__(self, vectorstore_service: VectorStoreService = None, embedding_service: EmbeddingService = None):
        self.vs_service = vectorstore_service or VectorStoreService()
        self.emb_service = embedding_service or EmbeddingService()
        self.retriever = HybridRetriever(self.vs_service.chroma_manager, self.emb_service.embedder)

    def build_index(self, chunks: List[Dict[str, Any]]) -> None:
        """
        Builds the BM25 local index using the generated chunks.
        """
        logger.info(f"Building local BM25 index with {len(chunks)} chunks.")
        try:
            self.retriever.build_bm25(chunks)
            logger.info("BM25 indexing complete.")
        except Exception as e:
            logger.error(f"Failed to build BM25 index: {e}", exc_info=True)
            raise RuntimeError(f"BM25 index generation failed: {e}")

    def retrieve(self, query: str) -> List[Dict[str, Any]]:
        """
        Retrieves context snippets relevant to the incoming query.
        """
        logger.info(f"Retrieving context for query: '{query}'")
        try:
            results = self.retriever.retrieve(query)
            logger.info(f"Retrieved {len(results)} context chunks.")
            return results
        except Exception as e:
            logger.error(f"Context retrieval query failed: {e}", exc_info=True)
            return []
