# Research Notes — Design Decisions for Publication

> Last updated: 2026-07-18

## Motivation

Traditional financial analysis requires domain expertise and is time-intensive. This system demonstrates that a multi-agent LLM pipeline with hybrid RAG can produce investment-grade analysis comparable to human analysts.

## Key Design Decisions

### 1. Hybrid RAG vs. Pure Vector Search
BM25 (sparse) + ChromaDB (dense) retrieval consistently outperforms pure vector search on financial documents where specific figures ("Net Profit: ₹1,614 Cr") are queried. Weight: BM25 0.4, Vector 0.6.

### 2. Agent Specialization vs. Monolithic LLM
A single prompt asking for all analysis degrades quality on all dimensions. Specialized agents with focused system prompts produce higher accuracy per dimension.

### 3. LLM Abstraction Layer
Enables fair multi-model comparison (Gemini vs. GPT-4o vs. Claude) using the same agent logic — critical for academic evaluation.

### 4. Fallback Chain Design
Prevents analysis failure when a single data source is unavailable. Primary source is always the uploaded PDF (ground truth), APIs are supplements.

## Evaluation Metrics Planned
- Financial metric extraction accuracy vs. manually labeled ground truth
- Agent output consistency across multiple runs (stability)
- End-to-end pipeline latency per agent
- RAG retrieval precision@K

## Publication Target
IEEE Transactions on Neural Networks and Learning Systems / Springer Applied Intelligence / Scopus-indexed AI journals
