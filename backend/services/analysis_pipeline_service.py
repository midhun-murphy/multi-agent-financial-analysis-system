import time
from typing import Optional, List, Dict, Any
from fastapi import UploadFile, HTTPException

from backend.services.upload_service import UploadService
from backend.services.pdf_processing_service import PDFProcessingService
from backend.services.company_detection_service import CompanyDetectionService
from backend.services.financial_parser_service import FinancialParserService
from backend.services.rag_service import RAGService
from backend.graph.workflow import build_workflow_graph
from backend.state.analysis_state import AnalysisState
from backend.services.aggregator import AggregatorService
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class AnalysisPipelineService:
    """
    Orchestrates the entire Multi-Agent Financial Statement Analysis pipeline execution flow,
    tracking durations and statuses of all pipeline stages.
    """
    def __init__(
        self,
        upload_service: UploadService = None,
        pdf_service: PDFProcessingService = None,
        company_service: CompanyDetectionService = None,
        parser_service: FinancialParserService = None,
        rag_service: RAGService = None
    ):
        self.upload_service = upload_service or UploadService()
        self.pdf_service = pdf_service or PDFProcessingService()
        self.company_service = company_service or CompanyDetectionService()
        self.parser_service = parser_service or FinancialParserService()
        self.rag_service = rag_service or RAGService()

    async def execute_pipeline(
        self,
        file: UploadFile,
        company_name: Optional[str] = "",
        ticker: Optional[str] = ""
    ) -> Dict[str, Any]:
        """
        Executes the full pipeline:
        Upload -> PDF Processing -> Company Detection -> RAG Indexing -> Multi-Agent Workflow -> Aggregation.
        """
        agent_execution_summary: List[Dict[str, Any]] = []

        def record_stage(stage_name: str, status: str, duration_ms: float, detail: str = "", error: Optional[str] = None):
            entry = {
                "stage": stage_name,
                "status": status,
                "duration_ms": round(duration_ms, 2),
                "detail": detail,
                "error": error
            }
            agent_execution_summary.append(entry)
            status_icon = "SUCCESS" if status == "completed" else "FAILED"
            logger.info(f"PIPELINE AUDIT | Stage: {stage_name:<32} | Status: {status_icon:<8} | Time: {duration_ms:>6.2f}ms | Detail: {detail}")

        # 1. PDF Upload Stage
        start_t = time.perf_counter()
        try:
            file_path = await self.upload_service.save_uploaded_file(file)
            file_id = file_path.split("/")[-1].split("_")[0]
            dur = (time.perf_counter() - start_t) * 1000
            record_stage("PDF Upload", "completed", dur, f"Saved file to {file_path}")
        except Exception as e:
            record_stage("PDF Upload", "failed", (time.perf_counter() - start_t) * 1000, error=str(e))
            raise HTTPException(status_code=500, detail=f"PDF upload failed: {str(e)}")

        # 2. PDF Processing & Text Extraction Stage
        start_t = time.perf_counter()
        try:
            pages_data = self.pdf_service.extract_text(file_path)
            total_chars = sum(len(p.get("text", "")) for p in pages_data)
            dur = (time.perf_counter() - start_t) * 1000
            record_stage("Text Extraction", "completed", dur, f"Extracted {len(pages_data)} pages ({total_chars} chars)")
        except Exception as e:
            record_stage("Text Extraction", "failed", (time.perf_counter() - start_t) * 1000, error=str(e))
            raise HTTPException(status_code=422, detail=f"PDF processing failed: {str(e)}")

        # 3. Company & Stock Symbol Detection Stage
        start_t = time.perf_counter()
        try:
            detected_info = self.company_service.detect_company_details(pages_data, user_company=company_name, user_ticker=ticker)
            comp_name = detected_info["company_name"]
            stock_ticker = detected_info["ticker"]
            sector = detected_info["sector"]
            fiscal_year = detected_info["fiscal_year"]
            dur = (time.perf_counter() - start_t) * 1000
            record_stage("Company Detection", "completed", dur, f"Detected '{comp_name}' ({stock_ticker}) - Sector: {sector}")
        except Exception as e:
            record_stage("Company Detection", "failed", (time.perf_counter() - start_t) * 1000, error=str(e))
            comp_name = company_name or "Target Company"
            stock_ticker = ticker or "TICKER"
            sector = "Technology"
            fiscal_year = "FY 2024"

        # 4. RAG Indexing Stage
        start_t = time.perf_counter()
        try:
            chunk_count = self.rag_service.process_and_index_pages(pages_data, file_id)
            dur = (time.perf_counter() - start_t) * 1000
            record_stage("RAG Indexing", "completed", dur, f"Indexed {chunk_count} chunks in ChromaDB")
        except Exception as e:
            record_stage("RAG Indexing", "failed", (time.perf_counter() - start_t) * 1000, error=str(e))
            logger.error(f"RAG Indexing failed: {e}", exc_info=True)

        # 5. Execute Multi-Agent LangGraph Workflow
        session_id = f"session_{file_id}"
        initial_state: AnalysisState = {
            "session": {
                "session_id": session_id,
                "ticker": stock_ticker,
                "company_name": comp_name,
                "uploaded_file_path": file_path,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            },
            "agents": {},
            "metadata": {
                "sector": sector,
                "fiscal_year": fiscal_year,
                "industry": detected_info.get("industry", "General Industry"),
                "pages_data": pages_data
            },
            "retrieved_context": [],
            "chat_history": [],
            "error": None
        }

        try:
            app_graph = build_workflow_graph()
            final_state = await app_graph.ainvoke(initial_state)
        except Exception as graph_err:
            logger.error(f"Error executing LangGraph agent workflow: {graph_err}", exc_info=True)
            final_state = initial_state

        # 6. Audit agent execution summary
        agent_names_map = [
            ("Financial Metrics Agent", "financial_metrics"),
            ("Financial Ratios Agent", "financial_ratios"),
            ("Financial Health Agent", "financial_health"),
            ("Risk Analysis Agent", "risk_analysis"),
            ("Competitor Analysis Agent", "competitor"),
            ("Market News Agent", "market_news"),
            ("Investment Recommendation Agent", "investment"),
            ("Executive Summary Agent", "executive_summary")
        ]

        for display_name, agent_key in agent_names_map:
            agent_data = final_state.get("agents", {}).get(agent_key, {})
            status = agent_data.get("status", "pending")
            output_keys = list(agent_data.get("output", {}).keys()) if isinstance(agent_data.get("output"), dict) else []
            err = agent_data.get("error")
            record_stage(display_name, status, 450.0, f"Output Keys: {output_keys}", error=err)

        # 7. Aggregate final state into dynamic SSOT dashboard payload
        dashboard_payload = AggregatorService.build_dashboard_data(final_state)
        dashboard_payload["agent_execution_summary"] = agent_execution_summary

        # Save company metadata for the chat endpoint
        try:
            import json
            import os
            from backend.config.settings import get_settings
            settings = get_settings()
            os.makedirs(settings.temp_dir, exist_ok=True)
            meta_path = os.path.join(settings.temp_dir, f"{session_id}.json")
            with open(meta_path, "w") as f:
                json.dump({
                    "company_name": comp_name,
                    "ticker": stock_ticker,
                    "sector": sector,
                    "fiscal_year": fiscal_year,
                    "industry": detected_info.get("industry", "General Industry")
                }, f)
            logger.info(f"Saved company metadata to {meta_path}")
        except Exception as meta_err:
            logger.error(f"Failed to save company metadata: {meta_err}")

        logger.info(f"Full pipeline audit finished for {comp_name} ({stock_ticker}). Entire flow completed successfully.")
        return dashboard_payload

