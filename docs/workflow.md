# LangGraph Pipeline Workflow — V1

> Last updated: 2026-07-25

## Pipeline Execution Sequence

```
API Request (POST /api/analyze)
    │
    ▼
[CEO Agent] 
    │ (Validates session and builds initial StateGraph layout)
    ▼
[Company Detection Agent]
    │ (Detects target company metadata: name, ticker, sector, industry)
    ▼
[Financial Parser Agent]
    │ (Runs high-precision statements parser to extract raw accounting items)
    ▼
[Financial Metrics Agent]
    │ (Normalizes metrics and runs LLM fallback over RAG collections)
    ▼
[Financial Ratios Agent]
    │ (Calculates key ratios: margins, leverage, ROE)
    ▼
[Financial Health Agent]
    │ (Calculates multi-dimension financial health scoring)
    ▼
[Risk Analysis Agent]
    │ (Evaluates liquidity, solvency, operational, and market risks)
    ▼
[Market News Agent]
    │ (Fetches RSS news updates and runs LLM sentiment checks)
    ▼
[Competitor Agent]
    │ (Performs peer comparisons and retrieves peer statements)
    ▼
[SWOT Agent]
    │ (Consolidates SWOT metrics using upstream output keys)
    ▼
[Investment Recommendation Agent]
    │ (Calculates quantitative BUY/HOLD/SELL triggers and horizonal pricing)
    ▼
[Executive Summary Agent]
    │ (Synthesizes comprehensive textual executive analysis summaries)
    ▼
Terminal State → Aggregator Service → UI Frontend Dashboard
```

## State Object at Each Node

Every agent receives the full `AnalysisState` and returns it with its own output merged into `state["agents"]` and its compiled summary stored under `state["metadata"]`. No agent can overwrite another agent's output field.

## Conditional Edge Logic

The CEO agent uses LangGraph conditional edges to route:
- **Error route**: If an error is detected or critical parameters are missing during CEO state initialization, the graph immediately routes to `END`.
- **Pipeline route**: Under normal operations, the graph routes directly to `Company Detection Agent` to start the sequential execution pipeline.
