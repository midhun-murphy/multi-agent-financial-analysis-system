from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str = Field(default="ok", description="Status of the API.")
    message: str = Field(default="API is healthy", description="Detailed health message.")
    timestamp: str = Field(description="ISO-formatted check timestamp.")

class StageAuditEntry(BaseModel):
    stage: str = Field(..., description="Name of the pipeline stage.")
    status: str = Field(..., description="Stage status (completed, failed, pending).")
    duration_ms: float = Field(..., description="Execution duration in milliseconds.")
    detail: Optional[str] = Field(None, description="Detailed stage logs or summary.")
    error: Optional[str] = Field(None, description="Stage failure traceback/details.")

class KPIItem(BaseModel):
    label: str
    value: Optional[float] = None
    formatted: str
    change: Optional[float] = None
    change_label: Optional[str] = None
    change_type: Optional[str] = None
    change_period: Optional[str] = None
    positive: bool = True
    sparkline: List[float] = Field(default_factory=list)
    color: str

class CompanySummary(BaseModel):
    name: str
    ticker: str
    exchange: str
    sector: str
    industry: str
    report_year: str
    uploaded_on: str
    overall_decision: str
    health_score: int

class CompetitorEntry(BaseModel):
    name: str
    revenue: str
    roe: str
    ebitda_margin: str
    pe: str
    is_target: bool

class NewsArticleEntry(BaseModel):
    headline: str
    source: str
    days_ago: int
    sentiment: str

class NewsPayload(BaseModel):
    overall_sentiment: str
    sentiment_score: int
    articles: List[NewsArticleEntry]

class RecommendationPayload(BaseModel):
    recommendation: str
    confidence: int
    overall_score: float
    target_price_12m: str
    current_price: str
    upside_potential: str
    time_horizon: str
    risk_level: str
    stars: float
    rationale: str
    contributing_metrics: List[Dict[str, str]]
    key_strengths: List[str]
    key_weaknesses: List[str]

class ExecutiveSummaryPayload(BaseModel):
    paragraphs: List[str]
    highlights: List[str]

class AnalysisResponse(BaseModel):
    company: CompanySummary
    metrics: Dict[str, KPIItem]
    performance_trend: Dict[str, List[Any]]
    health_breakdown: Dict[str, Any]
    risk: Dict[str, Any]
    competitors: List[CompetitorEntry]
    swot: Dict[str, List[str]]
    news: NewsPayload
    investment: RecommendationPayload
    executive_summary: ExecutiveSummaryPayload
    confidence_scores: Dict[str, int]
    chat_suggestions: List[str]
    agent_execution_summary: List[StageAuditEntry]
    raw_agent_outputs: Optional[Dict[str, Any]] = None
