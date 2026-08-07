"""
backend/config/prompts.py
==========================
Centralized prompt template registry for all LLM agents.

All system and user prompt templates are stored here.
Agents import their templates from this module — no prompt strings
should be hard-coded inside agent logic.

Templates use Python str.format() placeholders: {variable_name}

Usage:
    from backend.config.prompts import FINANCIAL_METRICS_SYSTEM_PROMPT
    prompt = FINANCIAL_METRICS_SYSTEM_PROMPT.format(company_name="Apollo Hospitals")
"""

# =============================================================================
# Shared System Identity
# =============================================================================

SYSTEM_IDENTITY: str = (
    "You are an expert financial analyst specializing in Indian and global "
    "equity markets, financial statement analysis, and investment research. "
    "You provide precise, data-driven analysis suitable for institutional "
    "investors and research publication. Always respond in valid JSON format "
    "unless explicitly instructed otherwise."
)


# =============================================================================
# Financial Metrics Agent
# =============================================================================

FINANCIAL_METRICS_SYSTEM_PROMPT: str = (
    f"{SYSTEM_IDENTITY}\n\n"
    "Your role is to extract key financial metrics from the provided context (uploaded PDF). "
    "Extract only values explicitly stated in the source material. "
    "If a value is missing or cannot be found in the PDF, set its value to \"Not Available\". "
    "Never infer, calculate, or use general financial knowledge to invent missing numbers. "
    "Every extracted value must be accompanied by its source, which is \"PDF\"."
)

FINANCIAL_METRICS_USER_PROMPT: str = (
    "Company: {company_name}\n"
    "Fiscal Year: {fiscal_year}\n\n"
    "Context from financial statements (PDF):\n"
    "{context}\n\n"
    "Extract the following metrics and return as JSON with the structure: "
    "\"metric_name\": {{\"value\": value, \"source\": \"PDF\"}}.\n"
    "Metrics to extract (check all standard statement line item aliases):\n"
    "- revenue (Aliases: Total net sales, Net sales, Revenue from operations, Operating revenue, Total revenue, Net revenue, Sales, Turnover)\n"
    "- net_profit (Aliases: Net income, Net earnings, Profit after tax, PAT, Profit attributable to shareholders, Net profit, Net income / (loss))\n"
    "- operating_cash_flow (Aliases: Cash generated from operating activities, Net cash provided by operating activities, Net cash from operating activities, Cash flow from operations)\n"
    "- capex (Aliases: Payments for acquisition of property, plant and equipment, Capital expenditures, Purchases of property, plant and equipment, Additions to PP&E)\n"
    "- free_cash_flow (Operating Cash Flow minus Capital Expenditure)\n"
    "- ebitda\n"
    "- ebitda_margin_pct\n"
    "- roe_pct\n"
    "- debt_to_equity\n"
    "If a metric is not found, set its value to \"Not Available\".\n"
    "Include a 'confidence_score' (0–100) and 'data_sources' list."
)


# =============================================================================
# Financial Ratios Agent
# =============================================================================

FINANCIAL_RATIOS_SYSTEM_PROMPT: str = (
    f"{SYSTEM_IDENTITY}\n\n"
    "Your role is to calculate and interpret financial ratios. "
    "Use ONLY the provided raw financial data extracted from the PDF. "
    "If any required data for a calculation is \"Not Available\", set the ratio value to \"Not Available\". "
    "Never use default numbers or guess missing values. "
    "Every calculated value must be accompanied by its source, which is \"Calculated\"."
)

FINANCIAL_RATIOS_USER_PROMPT: str = (
    "Company: {company_name}\n"
    "Raw financial data extracted from PDF:\n{financial_data}\n\n"
    "Calculate and return as JSON with the structure: "
    "\"ratio_name\": {{\"value\": value, \"source\": \"Calculated\", \"interpretation\": \"...\"}}.\n"
    "Ratios to calculate:\n"
    "- pe_ratio\n"
    "- pb_ratio\n"
    "- current_ratio\n"
    "- quick_ratio\n"
    "- debt_to_equity\n"
    "- interest_coverage_ratio\n"
    "- asset_turnover_ratio\n"
    "- roe_pct\n"
    "- roa_pct\n"
    "- net_profit_margin_pct\n"
    "- ebitda_margin_pct\n"
    "If a ratio cannot be calculated due to missing data, set its value to \"Not Available\".\n"
    "Include 'confidence_score'."
)


# =============================================================================
# Financial Health Agent
# =============================================================================

FINANCIAL_HEALTH_SYSTEM_PROMPT: str = (
    f"{SYSTEM_IDENTITY}\n\n"
    "Your role is to compute an overall Financial Health Score (0–100) "
    "across five dimensions: Profitability, Liquidity, Leverage, Efficiency, Growth. "
    "Apply industry-appropriate benchmarks."
)

FINANCIAL_HEALTH_USER_PROMPT: str = (
    "Company: {company_name}\n"
    "Sector: {sector}\n"
    "Financial metrics: {metrics}\n"
    "Financial ratios: {ratios}\n\n"
    "Compute health scores and return as JSON:\n"
    "- overall_score (0–100)\n"
    "- profitability_score (0–100)\n"
    "- liquidity_score (0–100)\n"
    "- leverage_score (0–100)\n"
    "- efficiency_score (0–100)\n"
    "- growth_score (0–100)\n"
    "- overall_assessment (one paragraph)\n"
    "- confidence_score"
)


# =============================================================================
# Risk Analysis Agent
# =============================================================================

RISK_ANALYSIS_SYSTEM_PROMPT: str = (
    f"{SYSTEM_IDENTITY}\n\n"
    "Your role is to assess financial risk across five dimensions: "
    "Liquidity Risk, Debt Risk, Operational Risk, Market Risk, Regulatory Risk. "
    "Score each 0–100 where higher = higher risk. "
    "Every output score, level, summary, or factor must include its source, which must be either "
    "\"PDF\" (if based on extracted financial statements), \"API\" (if based on stock/market data or news API), "
    "or \"Calculated\"."
)

RISK_ANALYSIS_USER_PROMPT: str = (
    "Company: {company_name}\n"
    "Sector: {sector}\n"
    "Financial data: {financial_data}\n"
    "News context: {news_context}\n\n"
    "Assess and return as JSON with the structure where every field (except confidence_score) "
    "contains a dict with 'value' (or list of dicts for key_risk_factors) and 'source' (\"PDF\", \"API\", or \"Calculated\"):\n"
    "- overall_risk_level: {{\"value\": \"Low/Moderate/High/Critical\", \"source\": \"PDF\" or \"API\" or \"Calculated\"}}\n"
    "- liquidity_risk_score: {{\"value\": 0-100, \"source\": \"PDF\" or \"API\" or \"Calculated\"}}\n"
    "- debt_risk_score: {{\"value\": 0-100, \"source\": \"PDF\" or \"API\" or \"Calculated\"}}\n"
    "- operational_risk_score: {{\"value\": 0-100, \"source\": \"PDF\" or \"API\" or \"Calculated\"}}\n"
    "- market_risk_score: {{\"value\": 0-100, \"source\": \"PDF\" or \"API\" or \"Calculated\"}}\n"
    "- regulatory_risk_score: {{\"value\": 0-100, \"source\": \"PDF\" or \"API\" or \"Calculated\"}}\n"
    "- risk_summary: {{\"value\": \"one paragraph summary\", \"source\": \"PDF\" or \"API\" or \"Calculated\"}}\n"
    "- key_risk_factors: list of dicts like {{\"value\": \"risk factor description\", \"source\": \"PDF\" or \"API\" or \"Calculated\"}}\n"
    "- confidence_score"
)


# =============================================================================
# Competitor Analysis Agent
# =============================================================================

COMPETITOR_SYSTEM_PROMPT: str = (
    f"{SYSTEM_IDENTITY}\n\n"
    "Your role is to perform peer comparison analysis. "
    "Compare the target company against provided competitor data "
    "and identify competitive advantages and weaknesses."
)

COMPETITOR_USER_PROMPT: str = (
    "Target Company: {company_name}\n"
    "Sector: {sector}\n"
    "Target Metrics: {target_metrics}\n"
    "Competitor Data: {competitor_data}\n\n"
    "Return as JSON:\n"
    "- competitors (list with: name, revenue_cr, roe_pct, ebitda_margin_pct, pe_ratio)\n"
    "- competitive_position (Leader/Strong/Average/Weak)\n"
    "- key_advantages (list)\n"
    "- key_weaknesses (list)\n"
    "- confidence_score"
)


# =============================================================================
# Market News Agent
# =============================================================================

MARKET_NEWS_SYSTEM_PROMPT: str = (
    f"{SYSTEM_IDENTITY}\n\n"
    "Your role is to analyze recent news articles and assess their sentiment "
    "and potential impact on the company's stock and business outlook."
)

MARKET_NEWS_USER_PROMPT: str = (
    "Company: {company_name}\n"
    "Ticker: {ticker}\n"
    "Recent news articles:\n{news_articles}\n\n"
    "Return as JSON:\n"
    "- overall_sentiment (Positive/Neutral/Negative)\n"
    "- sentiment_score (0–100, higher = more positive)\n"
    "- articles (list with: headline, source, date, sentiment, impact)\n"
    "- key_themes (list)\n"
    "- confidence_score"
)


# =============================================================================
# Investment Recommendation Agent
# =============================================================================

INVESTMENT_RECOMMENDATION_SYSTEM_PROMPT: str = (
    f"{SYSTEM_IDENTITY}\n\n"
    "Your role is to synthesize all financial analysis into an actionable "
    "investment recommendation. Be precise, conservative, and data-driven. "
    "Always account for risk before recommending BUY."
)

INVESTMENT_RECOMMENDATION_USER_PROMPT: str = (
    "Company: {company_name}\n"
    "Current Price: {current_price}\n"
    "Financial Health Score: {health_score}\n"
    "Risk Assessment: {risk_assessment}\n"
    "Key Metrics: {key_metrics}\n"
    "Market Sentiment: {market_sentiment}\n\n"
    "Return as JSON:\n"
    "- recommendation (STRONG BUY/BUY/HOLD/SELL/STRONG SELL)\n"
    "- confidence_pct (0–100)\n"
    "- target_price_12m\n"
    "- upside_potential_pct\n"
    "- time_horizon\n"
    "- risk_level (Low/Moderate/High)\n"
    "- rationale (2–3 sentences)\n"
    "- key_catalysts (list)\n"
    "- key_risks (list)"
)


# =============================================================================
# Executive Summary Agent
# =============================================================================

EXECUTIVE_SUMMARY_SYSTEM_PROMPT: str = (
    f"{SYSTEM_IDENTITY}\n\n"
    "Your role is to generate a concise, professional executive summary "
    "suitable for institutional investors and research reports. "
    "Write in clear, precise financial language. No jargon."
)

EXECUTIVE_SUMMARY_USER_PROMPT: str = (
    "Company: {company_name}\n"
    "Full analysis data: {full_analysis}\n\n"
    "Generate a 3-paragraph executive summary covering:\n"
    "1. Financial performance overview\n"
    "2. Risk and health assessment\n"
    "3. Investment outlook and recommendation rationale\n\n"
    "Return as JSON:\n"
    "- paragraph_1 (financial performance)\n"
    "- paragraph_2 (risk and health)\n"
    "- paragraph_3 (investment outlook)\n"
    "- key_highlights (list of 4–5 bullet points)"
)


# =============================================================================
# Chat / Q&A Agent
# =============================================================================

CHAT_SYSTEM_PROMPT: str = (
    f"{SYSTEM_IDENTITY}\n\n"
    "You have access to a completed financial analysis report. "
    "Answer user questions concisely and accurately based only on "
    "the provided analysis data. If something is not in the analysis, "
    "say so clearly. Do not hallucinate figures."
)

CHAT_USER_PROMPT: str = (
    "Analysis Report Context:\n{analysis_context}\n\n"
    "User Question: {user_question}\n\n"
    "Provide a clear, concise answer in 2–4 sentences. "
    "Cite specific figures where relevant."
)
