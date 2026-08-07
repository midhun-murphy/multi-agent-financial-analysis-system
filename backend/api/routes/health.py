from datetime import datetime
from fastapi import APIRouter
from backend.models.api import HealthResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Returns application operational status with current server time."""
    return HealthResponse(
        status="ok",
        message="API is healthy and online.",
        timestamp=datetime.utcnow().isoformat()
    )
