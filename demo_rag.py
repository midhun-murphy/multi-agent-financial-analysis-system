import asyncio
import os
from backend.services.pdf.pdf_processor import PDFProcessor
from backend.rag.chunker import Chunker
from backend.rag.embedder import Embedder
from backend.vectorstore.chroma import ChromaManager
from backend.rag.retriever import HybridRetriever

async def run_demo():
    print("--- Phase 4: RAG Pipeline Demo ---")
    
    # 1. Create a dummy text file and pretend it's a PDF for extraction logic test 
    # Or just use a string for testing components if PyMuPDF requires a real file
    test_text = """
    Apollo Hospitals Enterprise Limited (AHEL) is an Indian multinational healthcare group.
    In the fiscal year 2023-2024, the company reported a total revenue of ₹18,000 crores.
    The healthcare services segment contributed 60% of the revenue.
    Apollo Health & Lifestyle (AHLL) showed significant growth in the retail pharmacy business.
    The debt-to-equity ratio remains stable at 0.4.
    Risk factors include regulatory changes in the healthcare industry and rising competition from regional hospital chains.
    """
    
    # Mocking PDFProcessor pages_data output
    pages_data = [{
        "page_number": 1,
        "text": test_text,
        "tables": [[["Metric", "Value"], ["Revenue", "18000"], ["D/E Ratio", "0.4"]]],
        "metadata": {"source": "demo.pdf", "page": 1}
    }]
    
    print("\n[1] Text Chunking...")
    chunker = Chunker()
    chunks = chunker.chunk_pages(pages_data, chunk_size=100, chunk_overlap=20)
    for i, chunk in enumerate(chunks[:3]):
        print(f" Chunk {i}: {chunk['text'][:50]}...")

    print("\n[2] Embedding Generation...")
    embedder = Embedder()
    # Embed first chunk
    sample_embedding = embedder.embed_text(chunks[0]["text"])
    print(f" Embedding generated. Vector dimension: {len(sample_embedding[0])}")

    print("\n[3] Vector Store & Retrieval...")
    chroma = ChromaManager()
    # Clear old collection for demo
    chroma.delete_collection()
    
    # Prep data for Chroma
    ids = [f"id_{i}" for i in range(len(chunks))]
    texts = [c["text"] for c in chunks]
    metadatas = [c["metadata"] for c in chunks]
    embeddings = embedder.embed_text(texts)
    
    chroma.add_documents(ids, texts, embeddings, metadatas)
    
    retriever = HybridRetriever(chroma, embedder)
    retriever.build_bm25(chunks)
    
    query = "What is the revenue and debt-to-equity ratio?"
    print(f" Query: {query}")
    results = retriever.retrieve(query)
    
    print("\n[4] Retrieval Results:")
    for i, res in enumerate(results[:2]):
        print(f" Result {i+1}: {res['text'][:100]}...")

if __name__ == "__main__":
    asyncio.run(run_demo())
