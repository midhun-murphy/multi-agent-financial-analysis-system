# Multi-Agent Financial Statement Analysis System

> **Research-grade | Production-quality | Bloomberg-inspired Dashboard**  
> Built with LangGraph · FastAPI · ChromaDB · Apache ECharts · Python 3.12

---

## Overview

An AI-powered Financial Statement Analysis System that ingests company annual reports (PDF), automatically retrieves supplemental data from financial APIs, and produces a comprehensive investment analysis dashboard powered by a 9-agent LangGraph pipeline.

Designed for:
- Investment research teams
- Academic / research publication (IEEE, Springer, Scopus)
- Financial AI prototyping and benchmarking

---

## Dashboard Preview

Inspired by Bloomberg Terminal, TradingView, and Morningstar — featuring:
- Financial performance trend charts (bar + line combo)
- Financial health radar with 5-dimension scoring
- Risk analysis with color-coded progress bars
- Competitor comparison table
- Market news with sentiment scoring
- Investment recommendation card (BUY / HOLD / SELL)
- AI chat widget for Q&A on the report

---

## Architecture

```
Frontend (Vanilla JS + Apache ECharts)
         │
         ▼
FastAPI Backend (Python 3.12)
         │
         ▼
LangGraph Multi-Agent Pipeline
    CEO Agent (orchestrator)
    ├── Financial Metrics Agent
    ├── Financial Ratios Agent
    ├── Financial Health Agent
    ├── Risk Analysis Agent
    ├── Competitor Agent
    ├── Market News Agent
    ├── Investment Recommendation Agent
    └── Executive Summary Agent
         │
    ┌────┴────────────────────────┐
    │  Hybrid RAG                │
    │  PDF → BM25 + ChromaDB     │
    └────┬────────────────────────┘
         │ Fallback chain
    Yahoo Finance → Finnhub → FMP → NewsAPI
```

---

## Quick Start

### 1. Prerequisites

```bash
# Python 3.12
python3 --version

# Tesseract OCR (for scanned PDFs)
sudo apt-get install tesseract-ocr

# Pango + Cairo (for PDF export)
sudo apt-get install libpango-1.0-0 libcairo2
```

### 2. Setup

```bash
# Clone / navigate to project
cd /path/to/multi-agent

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Linux/macOS

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your API keys
```

### 3. Run Backend

```bash
source .venv/bin/activate
uvicorn backend.api.main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

### 4. Run Frontend

```bash
python3 -m http.server 8080 --directory frontend
# Dashboard: http://localhost:8080
```

---

## Required API Keys

| Service | Key Variable | Required | Free Tier |
|---|---|---|---|
| Google Gemini | `GOOGLE_API_KEY` | Yes | Yes (limited) |
| Finnhub | `FINNHUB_API_KEY` | Recommended | Yes |
| Financial Modeling Prep | `FMP_API_KEY` | Recommended | Yes |
| NewsAPI | `NEWSAPI_KEY` | Recommended | Yes |
| Yahoo Finance | — | No | Free (no key) |

---

## Project Structure

```
multi-agent/
├── backend/
│   ├── agents/          # One modular folder per agent
│   ├── config/          # Settings, constants, prompts
│   ├── graph/           # LangGraph StateGraph
│   ├── state/           # Typed state management
│   ├── llm/             # LLM abstraction layer
│   ├── rag/             # PDF processing + hybrid retrieval
│   ├── services/        # External API clients
│   ├── models/          # Pydantic data models
│   ├── api/             # FastAPI routes + middleware
│   └── utils/           # Logger + exceptions
├── frontend/            # Vanilla HTML/CSS/JS dashboard
├── storage/             # Uploads, reports, exports
├── evaluation/          # Research metrics + benchmarking
├── tests/               # Unit + integration tests
└── docs/                # Architecture, API reference, research notes
```

---

## Development Phases

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ Complete | Project Architecture & Environment |
| 2 | ✅ Complete | Dashboard UI Layout |
| 3 | ✅ Complete | FastAPI Backend Skeleton |
| 4 | ✅ Complete | PDF Processing & RAG Pipeline |
| 5 | ✅ Complete | Service Layer (Finance + News APIs) |
| 6 | ⏳ Pending | Multi-Agent LangGraph Workflow |
| 7 | ⏳ Pending | Frontend ↔ Backend Integration |
| 8 | ⏳ Pending | Evaluation, Export & Final QA |

---

## Running Tests

```bash
source .venv/bin/activate
pytest tests/ -v --cov=backend --cov-report=term-missing
```

## Code Quality

```bash
flake8 backend/ --max-line-length=100
mypy backend/ --ignore-missing-imports
```

---

## Version Roadmap

**V1 (Current)**: 9-agent pipeline — metrics, ratios, health, risk, competitor, news, investment, summary  
**V2 (Planned)**: Cash flow, balance sheet, income statement, industry benchmarking, forecast, deep sentiment

---

## License

This project is intended for academic research purposes.
