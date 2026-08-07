# System Architecture — Multi-Agent Financial Statement Analysis System

> Last updated: 2026-07-18 | Version: 1.0.0

---

## Overview

This system is a multi-agent AI pipeline that transforms financial documents (annual reports, quarterly filings) into structured investment analysis dashboards. The architecture is designed around three principles: **modularity**, **strict separation of concerns**, and **zero-hallucination** data handling.

---

## Architectural Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: PRESENTATION                                          │
│  frontend/  — Vanilla HTML/CSS/JS + Apache ECharts              │
│  Bloomberg-inspired dark dashboard                              │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP REST + Server-Sent Events (SSE)
┌─────────────────────────▼───────────────────────────────────────┐
│  LAYER 2: API GATEWAY                                           │
│  backend/api/  — FastAPI 0.115.6 + Uvicorn                     │
│  Routes: /upload /analyze /chat /export /health                 │
│  Middleware: CORS, structured request logging                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Python function calls
┌─────────────────────────▼───────────────────────────────────────┐
│  LAYER 3: ORCHESTRATION                                         │
│  backend/graph/ — LangGraph StateGraph                          │
│  CEO Agent: pure routing, no computation                        │
│  V1: 9 agent nodes with conditional edges                       │
└──────┬──────────────────┬────────────────────┬──────────────────┘
       │                  │                    │
┌──────▼──────┐   ┌───────▼──────┐   ┌────────▼───────┐
│  LAYER 4a   │   │  LAYER 4b    │   │  LAYER 4c      │
│  AGENTS     │   │  RAG         │   │  LLM LAYER     │
│  backend/   │   │  backend/    │   │  backend/llm/  │
│  agents/    │   │  rag/        │   │  provider.py   │
│  9 modular  │   │  ChromaDB    │   │  factory.py    │
│  folders    │   │  BM25+Vector │   │  gemini.py     │
└──────┬──────┘   └───────┬──────┘   └────────┬───────┘
       │                  │                    │
┌──────▼──────────────────▼────────────────────▼──────────────────┐
│  LAYER 5: SERVICES                                              │
│  backend/services/                                              │
│  finance/ → Yahoo Finance, Finnhub, FMP (fallback chain)        │
│  news/    → NewsAPI, Google News RSS                            │
│  pdf/     → Orchestrates RAG pipeline                           │
│  llm/     → Wraps LLM abstraction layer                         │
│  export/  → WeasyPrint HTML→PDF                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Architecture

### CEO Agent — Orchestrator (NOT a processor)

The CEO Agent's **only responsibilities**:
1. Receive the initial `AnalysisState` from the API layer
2. Validate the session (ticker, company name, uploaded document)
3. Define the execution sequence via LangGraph conditional edges
4. Collect terminal state and return it to the API layer

The CEO Agent **never**:
- Calculates any financial metric
- Calls any external API or service
- Makes LLM calls
- Generates summaries or recommendations

### Agent Module Structure

Every V1 agent follows the identical folder structure:

```
agents/{agent_name}/
├── __init__.py          # Exports the agent class
├── agent.py             # Agent class: run(state) → state
├── prompt.py            # Agent-specific prompt builders (imports from config/prompts.py)
├── parser.py            # Parses raw LLM JSON output into Pydantic models
├── validator.py         # Validates parsed output against business rules
└── models.py            # Agent-specific Pydantic input/output models
```

### Data Flow per Agent

```
AnalysisState (input)
      │
      ▼
agent.run(state)
      │
      ├── Retrieves context via services/ (never calls APIs directly)
      │
      ├── Builds prompt via config/prompts.py templates
      │
      ├── Calls llm_service.generate(prompt)  ← only via abstraction
      │
      ├── Parses response via parser.py
      │
      ├── Validates output via validator.py
      │
      └── Returns updated AnalysisState
```

---

## LLM Abstraction Layer

```
backend/llm/
├── provider.py    # Abstract base: generate(prompt) → str
├── factory.py     # Reads LLM_PROVIDER env var, returns correct provider
├── gemini.py      # GeminiProvider: implements generate()
├── openai.py      # OpenAIProvider: stub for V2
└── claude.py      # ClaudeProvider: stub for V2
```

**Zero-migration design**: Switching from Gemini to OpenAI requires one `.env` change (`LLM_PROVIDER=openai`). Agent code is unchanged.

---

## State Management

```
backend/state/
├── analysis_state.py    # TypedDict — full pipeline state
├── agent_state.py       # TypedDict — per-agent input/output slice
└── session_state.py     # TypedDict — user session context
```

LangGraph operates exclusively on `AnalysisState`. Each agent receives the full state and returns an updated version. State is immutable within agent execution (functional update pattern).

---

## Hybrid RAG Pipeline

```
PDF File
   │
   ▼
pdf_processor.py          # PyMuPDF native extraction
   │                      # pytesseract OCR fallback for scanned pages
   ▼
chunker.py                # Semantic + structural chunking
   │                      # Respects section boundaries, table structure
   ▼
embedder.py               # sentence-transformers all-MiniLM-L6-v2
   │
   ▼
ChromaDB                  # Vector storage (./storage/chroma)
   │
   │ Query time:
   ├── BM25 (rank-bm25)   # Sparse lexical retrieval  (weight: 0.4)
   ├── ChromaDB            # Dense vector retrieval    (weight: 0.6)
   └── Score fusion        # Reciprocal Rank Fusion    → top-K chunks
```

---

## Service Fallback Chain (Finance Data)

```
Agent requests data for ticker "APOLLOHOSP"
      │
      ▼
1. PDF/RAG retrieval  ──────────── Found → Return
      │ Not found
      ▼
2. Yahoo Finance (free, no key) ── Found → Return
      │ Not found / unavailable
      ▼
3. Finnhub (API key required) ──── Found → Return
      │ Not found / unavailable
      ▼
4. Financial Modeling Prep ──────── Found → Return
      │ Not found / unavailable
      ▼
5. DataNotFoundError raised ──── Logged + returned as null in state
```

---

## Frontend Architecture

- **Framework**: None — pure Vanilla JS (ES6 modules)
- **Charts**: Apache ECharts 5.5.1
  - Gauge: Financial Health Score
  - Radar: 5-dimension health breakdown
  - Bar + Line combo: Performance trend (revenue, profit, cash flow)
  - Sparklines: Metric cards (revenue, profit, EBITDA, ROE, D/E, FCF)
  - Progress bars: Risk scores (CSS-animated)
- **Fonts**: Inter (Google Fonts CDN)
- **Icons**: Lucide 0.474.0 (CDN)
- **Communication**: `api.js` fetch wrapper + SSE for streaming progress

---

## Evaluation Module

```
evaluation/
├── accuracy.py      # Compares agent output against ground truth labels
├── benchmark.py     # Measures end-to-end pipeline latency per agent
├── metrics.py       # Precision, recall, F1 for financial metric extraction
└── comparison.py    # Multi-model / multi-run comparison tables
```

Designed for research publication. Produces reproducible metrics files.
