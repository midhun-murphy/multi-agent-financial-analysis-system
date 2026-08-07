from typing import List, Dict, Any, Optional
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document

from backend.vectorstore.chroma import ChromaManager
from backend.rag.embedder import Embedder
from backend.config.settings import get_settings
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class HybridRetriever:
    """
    Hybrid retriever combining BM25 (lexical) and Vector (semantic) search.
    Uses Reciprocal Rank Fusion / Score Fusion for ranking.
    """

    def __init__(self, chroma_manager: ChromaManager, embedder: Embedder) -> None:
        self.chroma_manager = chroma_manager
        self.embedder = embedder
        settings = get_settings()
        self.bm25_weight = settings.bm25_weight
        self.vector_weight = settings.vector_weight
        self.top_k = settings.retrieval_top_k
        self.bm25_retriever: Optional[BM25Retriever] = None

    def build_bm25(self, chunks: List[Dict[str, Any]]) -> None:
        """
        Builds the BM25 index from the provided chunks.
        """
        try:
            documents = [Document(page_content=chunk["text"], metadata=chunk["metadata"]) for chunk in chunks]
            self.bm25_retriever = BM25Retriever.from_documents(documents)
            self.bm25_retriever.k = self.top_k
            logger.info(f"Built BM25 index with {len(chunks)} chunks.")
        except Exception as e:
            logger.error(f"Error building BM25 index: {e}")

    def retrieve(self, query: str) -> List[Dict[str, Any]]:
        """
        Performs hybrid retrieval for the given query.
        """
        try:
            # 1. Lexical Retrieval (BM25)
            if not self.bm25_retriever:
                logger.info("BM25 retriever is None. Rebuilding BM25 index from ChromaDB documents on the fly.")
                try:
                    all_docs = self.chroma_manager.collection.get()
                    if all_docs and all_docs.get("documents"):
                        chunks = []
                        for doc, meta in zip(all_docs["documents"], all_docs["metadatas"]):
                            chunks.append({"text": doc, "metadata": meta})
                        self.build_bm25(chunks)
                except Exception as ex:
                    logger.error(f"Failed to dynamically rebuild BM25: {ex}")

            bm25_results = []
            if self.bm25_retriever:
                bm25_results = self.bm25_retriever.invoke(query)


            # 2. Semantic Retrieval (Vector)
            query_embedding = self.embedder.embed_text(query)
            vector_results_raw = self.chroma_manager.query(query_embedding, n_results=self.top_k)
            
            # Format vector results
            vector_results = []
            if vector_results_raw and "documents" in vector_results_raw:
                for i in range(len(vector_results_raw["documents"][0])):
                    vector_results.append({
                        "text": vector_results_raw["documents"][0][i],
                        "metadata": vector_results_raw["metadatas"][0][i],
                        "distance": vector_results_raw["distances"][0][i]
                    })

            # 3. Simple Score Fusion (Reciprocal Rank Fusion simplified)
            # For V1, we return a merged set of top results.
            merged_results = self._merge_results(bm25_results, vector_results)
            return merged_results[:self.top_k]

        except Exception as e:
            logger.error(f"Error during hybrid retrieval: {e}", exc_info=True)
            return []

    def _merge_results(self, bm25_docs: List[Document], vector_dicts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Merges results from BM25 and Vector search.
        """
        seen_texts = set()
        merged = []

        # Interleave or prioritize
        # For simplicity in V1: add vector results first (higher weight usually), then bm25
        for v in vector_dicts:
            if v["text"] not in seen_texts:
                merged.append(v)
                seen_texts.add(v["text"])

        for b in bm25_docs:
            if b.page_content not in seen_texts:
                merged.append({
                    "text": b.page_content,
                    "metadata": b.metadata
                })
                seen_texts.add(b.page_content)

        return merged
