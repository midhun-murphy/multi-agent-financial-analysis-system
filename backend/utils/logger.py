"""
backend/utils/logger.py
========================
Structured logger factory for the entire application.

Provides a consistent logging interface across all modules.
Logs are emitted in structured format (JSON-compatible in production,
human-readable in development).

Usage:
    from backend.utils.logger import get_logger
    logger = get_logger(__name__)
    logger.info("Analysis started", extra={"ticker": "AAPL", "phase": "metrics"})
"""

import logging
import sys
from typing import Optional


# ---------------------------------------------------------------------------
# Log format constants
# ---------------------------------------------------------------------------

_DEV_FORMAT: str = (
    "%(asctime)s | %(levelname)-8s | %(name)-40s | %(message)s"
)
_PROD_FORMAT: str = (
    '{"time": "%(asctime)s", "level": "%(levelname)s", '
    '"logger": "%(name)s", "message": "%(message)s"}'
)

_DATE_FORMAT: str = "%Y-%m-%d %H:%M:%S"


def _build_handler(level: str, production: bool) -> logging.StreamHandler:
    """
    Build a configured StreamHandler for stdout.

    Args:
        level: Logging level string (e.g. "INFO").
        production: If True, use JSON-compatible format.

    Returns:
        Configured StreamHandler instance.
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    fmt = _PROD_FORMAT if production else _DEV_FORMAT
    formatter = logging.Formatter(fmt=fmt, datefmt=_DATE_FORMAT)
    handler.setFormatter(formatter)
    return handler


def get_logger(
    name: str,
    level: Optional[str] = None,
    production: bool = False,
) -> logging.Logger:
    """
    Return a configured Logger instance for the given module name.

    Follows a singleton pattern per logger name — repeated calls with
    the same name return the same logger without adding duplicate handlers.

    Args:
        name: Logger name, typically __name__ of the calling module.
        level: Override log level. Defaults to settings.LOG_LEVEL.
        production: If True, emit JSON-formatted logs.

    Returns:
        Configured logging.Logger instance.
    """
    # Import here to avoid circular imports at module level
    try:
        from backend.config.settings import get_settings
        settings = get_settings()
        effective_level = level or settings.log_level
        is_production = production or (settings.app_env == "production")
    except Exception:
        effective_level = level or "INFO"
        is_production = production

    logger = logging.getLogger(name)

    # Avoid adding duplicate handlers on repeated calls
    if logger.handlers:
        return logger

    logger.setLevel(effective_level)
    logger.addHandler(_build_handler(effective_level, is_production))
    logger.propagate = False

    return logger


# ---------------------------------------------------------------------------
# Application-level root logger
# ---------------------------------------------------------------------------

def configure_root_logger(level: str = "INFO", production: bool = False) -> None:
    """
    Configure the root logger for the FastAPI application startup.

    Should be called once during app lifespan setup (api/main.py).

    Args:
        level: Root log level.
        production: If True, use JSON format.
    """
    root = logging.getLogger()
    root.setLevel(level)

    # Remove any pre-existing handlers
    root.handlers.clear()
    root.addHandler(_build_handler(level, production))

    # Silence overly verbose third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("chromadb").setLevel(logging.WARNING)
    logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
