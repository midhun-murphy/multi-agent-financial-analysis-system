# API Reference — Multi-Agent Financial Statement Analysis System

Base URL: `http://localhost:8000/api/v1`

---

## Endpoints

### GET /health
Health check.

**Response 200:**
```json
{"status": "ok", "version": "1.0.0", "timestamp": "2026-07-18T12:00:00Z"}
```

---

### POST /upload
Upload a financial statement PDF.

**Request:** `multipart/form-data`
- `file`: PDF file (max 50 MB)
- `company_name`: string
- `ticker`: string (optional)

**Response 200:**
```json
{"report_id": "uuid", "filename": "annual_report.pdf", "pages": 120, "status": "uploaded"}
```

---

### POST /analyze
Trigger the full multi-agent analysis pipeline.

**Request Body:**
```json
{
  "report_id": "uuid",
  "ticker": "APOLLOHOSP",
  "company_name": "Apollo Hospitals Enterprise Limited",
  "fiscal_year": "FY 2024-25",
  "sector": "Healthcare"
}
```

**Response 200:** Full AnalysisResult JSON (see models/request_response.py)

---

### POST /chat
Ask a question about an analyzed report.

**Request Body:**
```json
{"report_id": "uuid", "question": "What are the biggest risks?"}
```

**Response 200:**
```json
{"answer": "...", "sources": ["...", "..."]}
```

---

### GET /export/{report_id}
Download the analysis as a formatted PDF report.

**Response 200:** `application/pdf` file download
