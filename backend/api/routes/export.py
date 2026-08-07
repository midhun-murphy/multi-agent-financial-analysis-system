from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from typing import Dict, Any
import io

from backend.services.report_export_service import ReportExportService
from backend.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

def get_export_service() -> ReportExportService:
    return ReportExportService()

@router.post("/export/pdf", tags=["Export"])
async def export_pdf(
    payload: Dict[str, Any] = Body(..., description="The dashboard analysis data payload."),
    service: ReportExportService = Depends(get_export_service)
):
    """
    Receives current dashboard JSON data and compiles a printable PDF download.
    """
    logger.info("Route: POST /export/pdf triggered.")
    try:
        pdf_bytes = service.export_pdf_report(payload)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=financial_analysis_report.pdf"}
        )
    except Exception as e:
        logger.error(f"Error generating PDF export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

@router.post("/export/excel", tags=["Export"])
async def export_excel(
    payload: Dict[str, Any] = Body(..., description="The dashboard analysis data payload."),
    service: ReportExportService = Depends(get_export_service)
):
    """
    Receives current dashboard JSON data and compiles a structured Excel workbook (.xlsx) download.
    """
    logger.info("Route: POST /export/excel triggered.")
    try:
        excel_bytes = service.export_excel_report(payload)
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=financial_analysis_report.xlsx"}
        )
    except Exception as e:
        logger.error(f"Error generating Excel export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Excel generation failed: {str(e)}")
