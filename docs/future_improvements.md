# Future Improvements & V2 Roadmap

> Last updated: 2026-07-18

## V2 Agent Additions
- Cash Flow Agent: Operating/Investing/Financing breakdown
- Balance Sheet Agent: Asset quality, liabilities structure, equity trends
- Income Statement Agent: Revenue, COGS, EBIT/EBT progression
- Industry Agent: NIFTY sector benchmarking, peer percentile rankings
- Forecast Agent: 12-month revenue and EPS projections (time series)
- Sentiment Agent: VADER + FinBERT deep sentiment on filings corpus

## V2 Technical Improvements
- WebSocket-based streaming instead of SSE
- Redis caching layer for repeated ticker queries
- Multi-user session management
- Scheduled analysis (cron-based portfolio monitoring)
- SEC EDGAR integration for US stocks

## V3 Research Extensions
- Fine-tuned FinBERT embeddings for financial domain RAG
- Graph-based competitor relationship mapping
- Multi-document cross-company comparison
- Explainability layer (SHAP values on recommendation scores)
