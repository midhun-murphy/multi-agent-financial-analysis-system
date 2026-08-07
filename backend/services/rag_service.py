from typing import List, Dict, Any
from backend.rag.chunker import Chunker
from backend.services.embedding_service import EmbeddingService
from backend.services.vectorstore_service import VectorStoreService
from backend.services.retrieval_service import RetrievalService
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class RAGService:
    """
    Orchestrates the entire RAG pipeline from page chunking and embedding generation
    to Chroma vector indexing and Hybrid search configuration.
    """
    def __init__(
        self,
        embedding_service: EmbeddingService = None,
        vectorstore_service: VectorStoreService = None,
        retrieval_service: RetrievalService = None
    ):
        self.emb_service = embedding_service or EmbeddingService()
        self.vs_service = vectorstore_service or VectorStoreService()
        # Initialize retrieval service injecting our configured embedding/vector store instances
        self.ret_service = retrieval_service or RetrievalService(
            vectorstore_service=self.vs_service,
            embedding_service=self.emb_service
        )
        self.chunker = Chunker()

    def process_and_index_pages(self, pages_data: List[Dict[str, Any]], file_id: str) -> int:
        """
        Splits pages into text chunks, builds embeddings, indices them in Chroma, and sets up BM25.
        Returns the total count of successfully indexed chunks.
        """
        logger.info(f"RAG: Processing {len(pages_data)} pages for text chunks...")
        
        # 1. Recursive Chunking
        chunks = self.chunker.chunk_pages(pages_data)
        if not chunks:
            logger.warning("RAG: No chunks created from document text.")
            return 0
            
        logger.info(f"RAG: Created {len(chunks)} text chunks.")

        # 2. Clear stale collection
        self.vs_service.clear_database()

        # 3. Embedding and Indexing
        ids = [f"{file_id}_chunk_{i}" for i in range(len(chunks))]
        texts = [c["text"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]

        embeddings = self.emb_service.generate_embeddings(texts)
        self.vs_service.add_documents(ids, texts, embeddings, metadatas)

        # 4. Build BM25 Retrieval Index
        self.ret_service.build_index(chunks)
        
        # Diagnostics Step 2
        print("===== STEP 2 CHUNKING =====")
        print("Number of chunks:", len(chunks))
        print("Average chunk size:", sum(len(c["text"]) for c in chunks) / len(chunks))
        print("Largest chunk:", max(len(c["text"]) for c in chunks))
        print("Smallest chunk:", min(len(c["text"]) for c in chunks))
        print("First chunk:", chunks[0]["text"][:200])
        print("Last chunk:", chunks[-1]["text"][:200])
        print("===========================")

        # Diagnostics Step 3
        print("===== STEP 3 EMBEDDINGS =====")
        print("Embedding count:", len(embeddings))
        print("Embedding dimension:", len(embeddings[0]) if embeddings else 0)
        try:
            print("Collection name:", self.vs_service.chroma_manager.collection.name)
        except Exception:
            print("Collection name: financial_analysis")
        print("Collection size:", self.vs_service.get_document_count())
        print("===========================")

        logger.info("RAG: Pipeline parsing, embedding, and indexing successfully completed.")
        return len(chunks)

    def retrieve_context_multi_query(self, company_name: str, queries: List[str] = None) -> List[Dict[str, Any]]:
        """
        Performs targeted multi-query hybrid retrievals across statements using retrieval service.
        """
        if not queries:
            queries = [
                f"Consolidated Statements of Operations {company_name} total net sales revenue net income",
                f"Consolidated Statements of Cash Flows cash generated from operating activities capital expenditures",
                f"Consolidated Balance Sheets total assets long-term debt total stockholders equity"
            ]

        retrieved_results = []
        for q in queries:
            retrieved_results.extend(self.ret_service.retrieve(q))
        
        logger.info(f"RAG: Retrieved {len(retrieved_results)} unified targeted contexts.")
        return retrieved_results
