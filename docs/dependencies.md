# Dependencies — Multi-Agent Financial Statement Analysis System

> Version rationale for every pinned dependency.  
> Last updated: 2026-07-18

---

## Production Dependencies

| Package | Pinned Version | Selection Rationale |
|---|---|---|
| **langgraph** | 0.2.55 | Latest stable release. Provides StateGraph with typed nodes, conditional edges, and async execution — the core of the multi-agent pipeline. 0.2.x is the stable production branch. |
| **langchain** | 0.3.25 | Latest stable. Required by langgraph. Provides prompt templates, output parsers, chain abstractions. LangChain 0.3.x uses the new LCEL (LangChain Expression Language). |
| **langchain-core** | 0.3.61 | Pinned to match langchain 0.3.25 compatibility matrix exactly. Contains base Runnable, Messages, and PromptTemplate classes. |
| **langchain-community** | 0.3.24 | Pinned to match langchain 0.3.x. Required for community integrations (BM25Retriever). |
| **google-generativeai** | 0.8.5 | Latest stable Google AI SDK. Provides Gemini 2.0 Flash access. 0.8.x includes stable async support and improved error handling. |
| **langchain-google-genai** | 2.1.4 | LangChain wrapper for Google Generative AI. Enables `ChatGoogleGenerativeAI` integration. Pinned to match google-generativeai 0.8.x. |
| **openai** | 1.59.0 | Latest stable OpenAI Python SDK v1.x. Used by the OpenAI LLM provider stub (activated in V2). |
| **anthropic** | 0.40.0 | Latest stable Anthropic SDK. Used by the Claude LLM provider stub (activated in V2). |
| **fastapi** | 0.115.6 | Latest stable FastAPI. Async-first, Pydantic v2 compatible, OpenAPI auto-docs, SSE support. |
| **uvicorn** | 0.32.1 | Latest stable ASGI server. Production-ready with `--workers` flag for multi-process deployment. |
| **python-multipart** | 0.0.20 | Required by FastAPI for `multipart/form-data` file upload parsing. |
| **pydantic** | 2.10.3 | Latest stable Pydantic v2. 10x faster than v1, native TypeScript-like validation, required by FastAPI 0.115.x. |
| **pydantic-settings** | 2.7.0 | Pydantic v2 compatible settings management. Reads from `.env` files and environment variables. |
| **python-dotenv** | 1.0.1 | Stable `.env` file loader. Used as fallback before pydantic-settings. |
| **chromadb** | 0.5.23 | Latest stable ChromaDB. Local-first vector database with SQLite backend. No external service needed. 0.5.x stable release. |
| **sentence-transformers** | 3.3.1 | Latest stable. `all-MiniLM-L6-v2` model provides fast, high-quality embeddings for financial text. |
| **rank-bm25** | 0.2.2 | Stable pure-Python BM25 implementation. No C extension dependencies. Used for the sparse retrieval arm of hybrid RAG. |
| **PyMuPDF** | 1.24.14 | Latest stable. Best-in-class Python PDF library. Handles native text extraction, tables, images, and multi-column layouts. Licensed AGPL for research use. |
| **pytesseract** | 0.3.13 | Latest stable Python wrapper for Tesseract OCR engine. Used as fallback for scanned PDF pages. |
| **Pillow** | 10.4.0 | Latest stable PIL fork. Required by pytesseract for image preprocessing. |
| **pandas** | 2.2.3 | Latest stable LTS. Primary data manipulation library for financial dataframes and time series. |
| **numpy** | 1.26.4 | Latest stable 1.26.x. Required by pandas and sentence-transformers. NumPy 2.x intentionally avoided due to compatibility break with several scientific libraries. |
| **yfinance** | 0.2.51 | Latest stable. Yahoo Finance data retrieval — no API key required. Primary free fallback source. |
| **finnhub-python** | 2.4.20 | Latest stable official Finnhub SDK. Real-time quotes, company financials, news. |
| **httpx** | 0.27.2 | Latest stable async HTTP client. Used for FMP and NewsAPI REST calls. |
| **weasyprint** | 62.3 | Latest stable. HTML-to-PDF rendering for report export. Requires Pango + Cairo system libraries. |
| **python-dateutil** | 2.9.0 | Stable date parsing utilities. Used across financial data normalization. |
| **pytz** | 2024.2 | Stable timezone database. Used for IST/UTC date handling in Indian financial data. |

---

## Development Dependencies

| Package | Pinned Version | Selection Rationale |
|---|---|---|
| **pytest** | 8.3.4 | Latest stable test runner. |
| **pytest-asyncio** | 0.24.0 | Async test support for FastAPI route testing. Pinned to match pytest 8.x. |
| **pytest-cov** | 6.0.0 | Coverage reporting integrated with pytest. |
| **respx** | 0.21.1 | HTTPX mocking library for unit-testing service clients without network calls. |
| **flake8** | 7.1.1 | PEP8 linter. `--max-line-length=100` configured. |
| **flake8-docstrings** | 1.7.0 | Enforces docstring presence on all public functions/classes. |
| **flake8-bugbear** | 24.12.12 | Additional bug-finding rules for flake8. |
| **mypy** | 1.13.0 | Latest stable static type checker. |
| **types-python-dateutil** | 2.9.0.20241206 | Type stubs for python-dateutil. |
| **types-pytz** | 2024.2.0.20241221 | Type stubs for pytz. |
| **black** | 24.10.0 | Opinionated code formatter. Configured to 100-char line length. |
| **isort** | 5.13.2 | Import sorting. Configured to black-compatible profile. |

---

## System Dependencies (must be installed on host)

| Dependency | Version | Install Command | Purpose |
|---|---|---|---|
| Tesseract OCR | 4.x+ | `sudo apt-get install tesseract-ocr` | OCR for scanned PDFs |
| Pango | 1.x | `sudo apt-get install libpango-1.0-0` | WeasyPrint text rendering |
| Cairo | 1.x | `sudo apt-get install libcairo2` | WeasyPrint PDF export |
