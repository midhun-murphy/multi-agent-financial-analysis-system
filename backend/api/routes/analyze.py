import time
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form, Depends
from sqlalchemy.orm import Session

from backend.services.analysis_pipeline_service import AnalysisPipelineService
from backend.models.api import AnalysisResponse
from backend.utils.logger import get_logger
from backend.database.database import get_db
from backend.api.routes.auth import get_current_user
from backend.database.models import User, Report

logger = get_logger(__name__)
router = APIRouter()

# Dependency provider for AnalysisPipelineService
def get_analysis_pipeline_service() -> AnalysisPipelineService:
    return AnalysisPipelineService()

@router.post("/analyze", response_model=AnalysisResponse, tags=["Analysis"])
async def analyze_pdf(
    file: UploadFile = File(...),
    company_name: Optional[str] = Form(""),
    ticker: Optional[str] = Form(""),
    pipeline_service: AnalysisPipelineService = Depends(get_analysis_pipeline_service),
    current_user_email: str = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> AnalysisResponse:
    t_start = time.perf_counter()
    logger.info(f"[DEBUG LOG] [0.00s] Enter POST /analyze API endpoint. File: {file.filename} by {current_user_email}")
    
    # Execute existing pipeline logic completely unchanged
    dashboard_payload = await pipeline_service.execute_pipeline(
        file=file,
        company_name=company_name,
        ticker=ticker
    )
    
    # Save Report metadata only after pipeline executes successfully
    try:
        user = db.query(User).filter(User.email == current_user_email).first()
        if user:
            company_info = dashboard_payload.get("company", {})
            resolved_company = company_name or company_info.get("name") or "Unknown Company"
            resolved_ticker = ticker or company_info.get("ticker") or "UNKNOWN"
            
            new_report = Report(
                user_id=user.id,
                company_name=resolved_company,
                ticker=resolved_ticker,
                pdf_name=file.filename,
                status="Uploaded"
            )
            db.add(new_report)
            db.commit()
            logger.info(f"Metadata saved for successfully analyzed PDF report. Company: {resolved_company}, User: {user.email}")
    except Exception as db_err:
        logger.error(f"Failed to record upload report metadata in MySQL: {db_err}")
    
    t_end = time.perf_counter()
    logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exit POST /analyze API endpoint. Status 200")
    return dashboard_payload
