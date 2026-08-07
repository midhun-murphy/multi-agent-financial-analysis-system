import pytest
from backend.services.pdf.pdf_processor import PDFProcessor
from backend.rag.chunker import Chunker
from backend.rag.embedder import Embedder
from backend.vectorstore.chroma import ChromaManager
from backend.rag.retriever import HybridRetriever

def test_pdf_processor_exists():
    assert PDFProcessor is not None

def test_chunker_exists():
    assert Chunker is not None

def test_embedder_initialization():
    embedder = Embedder()
    assert embedder is not None
    assert embedder.get_embedding_dimension() > 0

@pytest.mark.asyncio
async def test_llm_service_gemini():
    from backend.services.llm.service import LLMService
    import os
    if not os.environ.get("GOOGLE_API_KEY"):
        pytest.skip("GOOGLE_API_KEY not set")
    
    service = LLMService()
    response = await service.generate_async("Say hello")
    assert response is not None
    assert len(response) > 0
