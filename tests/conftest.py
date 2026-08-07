"""
tests/conftest.py
==================
Shared pytest fixtures for the test suite.
"""
import pytest

@pytest.fixture
def sample_ticker() -> str:
    """Return a stable sample ticker for testing."""
    return "AAPL"

@pytest.fixture
def sample_company_name() -> str:
    """Return a stable sample company name for testing."""
    return "Apple Inc."
