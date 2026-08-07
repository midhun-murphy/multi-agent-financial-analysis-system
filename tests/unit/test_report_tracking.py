import pytest
import time
import json
import os
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from backend.api.main import app
from backend.database.database import SessionLocal
from backend.database.models import User, Report

client = TestClient(app)

def test_report_relationship_and_tracking():
    db = SessionLocal()
    email = f"report_test_{int(time.time())}@example.com"
    try:
        # 1. Create a user manually
        user = User(
            name="Report Tester",
            email=email,
            password_hash="some_hashed_password"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # 2. Add report metadata manually to verify relationships
        report = Report(
            user_id=user.id,
            company_name="Test Company",
            ticker="TST",
            pdf_name="test_report.pdf",
            status="Uploaded"
        )
        db.add(report)
        db.commit()
        db.refresh(user)
        
        # Verify relationship functions correctly
        assert len(user.reports) == 1
        assert user.reports[0].company_name == "Test Company"
        assert user.reports[0].user.name == "Report Tester"
        
    finally:
        db.close()

def test_upload_saves_metadata():
    email = f"upload_test_{int(time.time())}@example.com"
    
    # 1. Sign up the user
    signup_res = client.post("/api/auth/signup", json={
        "name": "Upload Tester",
        "email": email,
        "password": "supersecurepassword123"
    })
    assert signup_res.status_code == 201
    
    # 2. Log in to get the JWT
    login_res = client.post("/api/auth/login", json={
        "email": email,
        "password": "supersecurepassword123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Load sample dashboard.json and format fields to satisfy strict Pydantic schemas
    dashboard_path = os.path.join(os.getcwd(), "frontend", "data", "dashboard.json")
    with open(dashboard_path, "r", encoding="utf-8") as f:
        mock_payload = json.load(f)
    
    # Format competitors fields to strings
    for comp in mock_payload.get("competitors", []):
        for key in ["revenue", "roe", "ebitda_margin", "pe"]:
            if key in comp:
                comp[key] = str(comp[key])
                
    # Format investment fields
    inv = mock_payload.get("investment", {})
    for key in ["target_price_12m", "current_price", "upside_potential"]:
        if key in inv:
            inv[key] = str(inv[key])
    
    if "overall_score" not in inv:
        inv["overall_score"] = 3.5
    if "contributing_metrics" not in inv:
        inv["contributing_metrics"] = []
    if "key_strengths" not in inv:
        inv["key_strengths"] = ["Strong growth"]
    if "key_weaknesses" not in inv:
        inv["key_weaknesses"] = ["High debt"]
        
    mock_payload["agent_execution_summary"] = []
    
    with patch("backend.services.analysis_pipeline_service.AnalysisPipelineService.execute_pipeline", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = mock_payload
        
        files = {
            "file": ("annual_report.pdf", b"%PDF-1.4 mock content", "application/pdf")
        }
        data = {
            "company_name": "Mocked Company",
            "ticker": "MCK"
        }
        
        # Call protected analyze endpoint
        response = client.post("/api/analyze", files=files, data=data, headers=headers)
        assert response.status_code == 200
        
        # Verify metadata record exists in MySQL database
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            assert user is not None
            assert len(user.reports) == 1
            report = user.reports[0]
            # Verify fields correctly match the incoming form data overrides
            assert report.company_name == "Mocked Company"
            assert report.ticker == "MCK"
            assert report.pdf_name == "annual_report.pdf"
            assert report.status == "Uploaded"
            assert report.upload_time is not None
        finally:
            db.close()
