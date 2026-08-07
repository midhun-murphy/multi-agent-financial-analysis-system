"""
backend/config/constants.py
============================
Application-wide constants, thresholds, and scoring weights.

All magic numbers must live here — never hard-coded in agent logic.
Organized by domain for easy reference and tuning.

Usage:
    from backend.config.constants import HealthScoreWeights, RiskThresholds
"""

from dataclasses import dataclass
from typing import Final


# =============================================================================
# API & Service Constants
# =============================================================================

API_VERSION: Final[str] = "v1"
API_PREFIX: Final[str] = f"/api/{API_VERSION}"
REQUEST_TIMEOUT_SECONDS: Final[int] = 30
MAX_RETRIES: Final[int] = 3
RETRY_BACKOFF_SECONDS: Final[float] = 1.5


# =============================================================================
# Financial Health Score Weights
# Weights must sum to 1.0
# =============================================================================

@dataclass(frozen=True)
class HealthScoreWeights:
    """
    Dimension weights used to compute the composite Financial Health Score.

    Weights are calibrated to emphasize profitability and liquidity
    for Indian listed companies (NIFTY context).
    """
    profitability: float = 0.30
    liquidity: float = 0.25
    leverage: float = 0.20
    efficiency: float = 0.15
    growth: float = 0.10


# =============================================================================
# Risk Score Thresholds (0–100 scale)
# =============================================================================

@dataclass(frozen=True)
class RiskThresholds:
    """Thresholds mapping numeric risk scores to categorical risk levels."""
    low_max: int = 35       # 0–35   → Low Risk
    moderate_max: int = 65  # 36–65  → Moderate Risk
    high_max: int = 85      # 66–85  → High Risk
                            # 86–100 → Critical Risk


# =============================================================================
# Investment Recommendation Thresholds
# =============================================================================

@dataclass(frozen=True)
class RecommendationThresholds:
    """Score thresholds for BUY / HOLD / SELL classification."""
    strong_buy_min: int = 80    # score >= 80 → STRONG BUY
    buy_min: int = 65           # score >= 65 → BUY
    hold_min: int = 45          # score >= 45 → HOLD
    sell_min: int = 30          # score >= 30 → SELL
                                # score < 30  → STRONG SELL


# =============================================================================
# Financial Ratio Benchmarks
# Industry-agnostic defaults — agents apply sector-specific adjustments
# =============================================================================

@dataclass(frozen=True)
class RatioBenchmarks:
    """Standard ratio benchmarks for financial health assessment."""
    # Liquidity
    current_ratio_healthy: float = 1.5
    quick_ratio_healthy: float = 1.0

    # Leverage
    debt_to_equity_max: float = 2.0
    interest_coverage_min: float = 3.0

    # Profitability
    roe_healthy: float = 15.0        # %
    roa_healthy: float = 8.0         # %
    ebitda_margin_healthy: float = 15.0  # %

    # Valuation
    pe_ratio_max: float = 40.0


# =============================================================================
# RAG / Chunking Constants
# =============================================================================

CHUNK_SIZE_TOKENS: Final[int] = 512
CHUNK_OVERLAP_TOKENS: Final[int] = 64
MIN_CHUNK_LENGTH_CHARS: Final[int] = 100
MAX_CHUNKS_PER_DOCUMENT: Final[int] = 2000


# =============================================================================
# LangGraph Constants
# =============================================================================

MAX_GRAPH_ITERATIONS: Final[int] = 50
AGENT_NODE_TIMEOUT_SECONDS: Final[int] = 60


# =============================================================================
# Confidence Score Labels
# =============================================================================

CONFIDENCE_LABELS: Final[dict[str, str]] = {
    "very_high": "95–100%",
    "high": "80–94%",
    "moderate": "60–79%",
    "low": "40–59%",
    "very_low": "0–39%",
}


# =============================================================================
# Supported File Types
# =============================================================================

ALLOWED_UPLOAD_EXTENSIONS: Final[set[str]] = {".pdf"}
ALLOWED_UPLOAD_MIME_TYPES: Final[set[str]] = {"application/pdf"}


# =============================================================================
# Singleton instances (use these in agent code)
# =============================================================================

HEALTH_WEIGHTS = HealthScoreWeights()
RISK_THRESHOLDS = RiskThresholds()
RECOMMENDATION_THRESHOLDS = RecommendationThresholds()
RATIO_BENCHMARKS = RatioBenchmarks()
