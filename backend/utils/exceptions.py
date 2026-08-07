"""
backend/utils/exceptions.py
============================
Custom exception hierarchy for the Multi-Agent Financial Analysis System.

All application-specific exceptions inherit from FinancialAnalysisError.
This enables precise catch blocks and clean error propagation through
the LangGraph pipeline and FastAPI routes.

Usage:
    from backend.utils.exceptions import ServiceUnavailableError
    raise ServiceUnavailableError("Finnhub API key not configured.")
"""


# =============================================================================
# Base Exception
# =============================================================================

class FinancialAnalysisError(Exception):
    """
    Base exception for all application-specific errors.

    All custom exceptions must inherit from this class to allow
    callers to catch any application error with a single except clause.
    """

    def __init__(self, message: str, details: dict | None = None) -> None:
        """
        Initialize the base exception.

        Args:
            message: Human-readable error description.
            details: Optional dict with structured error context.
        """
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(message={self.message!r}, details={self.details})"


# =============================================================================
# Configuration Errors
# =============================================================================

class ConfigurationError(FinancialAnalysisError):
    """Raised when required configuration is missing or invalid."""


class MissingAPIKeyError(ConfigurationError):
    """Raised when an API key is required but not configured."""

    def __init__(self, service_name: str) -> None:
        super().__init__(
            message=f"API key for '{service_name}' is not configured. "
                    f"Set the corresponding variable in your .env file.",
            details={"service": service_name},
        )


# =============================================================================
# Service & Integration Errors
# =============================================================================

class ServiceUnavailableError(FinancialAnalysisError):
    """Raised when an external service is unreachable or returns an error."""

    def __init__(self, service_name: str, reason: str = "") -> None:
        super().__init__(
            message=f"Service '{service_name}' is unavailable. {reason}".strip(),
            details={"service": service_name, "reason": reason},
        )


class ServiceRateLimitError(FinancialAnalysisError):
    """Raised when an external API rate limit is exceeded."""

    def __init__(self, service_name: str) -> None:
        super().__init__(
            message=f"Rate limit exceeded for service '{service_name}'. "
                    f"Falling back to next available source.",
            details={"service": service_name},
        )


class DataNotFoundError(FinancialAnalysisError):
    """Raised when requested financial data cannot be found in any source."""

    def __init__(self, ticker: str, data_type: str) -> None:
        super().__init__(
            message=f"Could not find '{data_type}' data for ticker '{ticker}' "
                    f"in any configured data source.",
            details={"ticker": ticker, "data_type": data_type},
        )


# =============================================================================
# PDF & Document Errors
# =============================================================================

class PDFProcessingError(FinancialAnalysisError):
    """Raised when PDF extraction or OCR fails."""

    def __init__(self, filename: str, reason: str) -> None:
        super().__init__(
            message=f"Failed to process PDF '{filename}': {reason}",
            details={"filename": filename, "reason": reason},
        )


class UnsupportedFileTypeError(FinancialAnalysisError):
    """Raised when an uploaded file has an unsupported format."""

    def __init__(self, filename: str, detected_type: str) -> None:
        super().__init__(
            message=f"File '{filename}' has unsupported type '{detected_type}'. "
                    f"Only PDF files are accepted.",
            details={"filename": filename, "detected_type": detected_type},
        )


class FileTooLargeError(FinancialAnalysisError):
    """Raised when an uploaded file exceeds the size limit."""

    def __init__(self, filename: str, size_mb: float, limit_mb: int) -> None:
        super().__init__(
            message=f"File '{filename}' ({size_mb:.1f} MB) exceeds the "
                    f"{limit_mb} MB upload limit.",
            details={"filename": filename, "size_mb": size_mb, "limit_mb": limit_mb},
        )


# =============================================================================
# LLM & Agent Errors
# =============================================================================

class LLMProviderError(FinancialAnalysisError):
    """Raised when the LLM provider returns an error or invalid response."""

    def __init__(self, provider: str, reason: str) -> None:
        super().__init__(
            message=f"LLM provider '{provider}' failed: {reason}",
            details={"provider": provider, "reason": reason},
        )


class AgentExecutionError(FinancialAnalysisError):
    """Raised when an agent node fails during LangGraph execution."""

    def __init__(self, agent_name: str, reason: str) -> None:
        super().__init__(
            message=f"Agent '{agent_name}' execution failed: {reason}",
            details={"agent": agent_name, "reason": reason},
        )


class AgentTimeoutError(AgentExecutionError):
    """Raised when an agent node exceeds its timeout budget."""

    def __init__(self, agent_name: str, timeout_seconds: int) -> None:
        super().__init__(
            agent_name=agent_name,
            reason=f"Agent exceeded {timeout_seconds}s timeout.",
        )
        self.details["timeout_seconds"] = timeout_seconds


class OutputParsingError(FinancialAnalysisError):
    """Raised when an agent's LLM output cannot be parsed into a Pydantic model."""

    def __init__(self, agent_name: str, raw_output: str) -> None:
        super().__init__(
            message=f"Agent '{agent_name}' produced unparseable output.",
            details={"agent": agent_name, "raw_output_preview": raw_output[:200]},
        )


# =============================================================================
# Vector Store Errors
# =============================================================================

class VectorStoreError(FinancialAnalysisError):
    """Raised when ChromaDB operations fail."""

    def __init__(self, operation: str, reason: str) -> None:
        super().__init__(
            message=f"ChromaDB operation '{operation}' failed: {reason}",
            details={"operation": operation, "reason": reason},
        )


# =============================================================================
# Export Errors
# =============================================================================

class ExportError(FinancialAnalysisError):
    """Raised when PDF report export fails."""

    def __init__(self, report_id: str, reason: str) -> None:
        super().__init__(
            message=f"Export failed for report '{report_id}': {reason}",
            details={"report_id": report_id, "reason": reason},
        )
