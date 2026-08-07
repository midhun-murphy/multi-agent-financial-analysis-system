import pytest
import time
from fastapi.testclient import TestClient
from backend.api.main import app
from backend.database.database import SessionLocal
from backend.database.models import User

client = TestClient(app)

def test_signup_flow():
    # Generate a unique email address for the test run
    email = f"test_{int(time.time())}@example.com"
    
    try:
        # 1. Successful Signup
        response = client.post("/api/auth/signup", json={
            "name": "Test User",
            "email": email,
            "password": "securepassword123"
        })
        assert response.status_code == 201
        assert response.json() == {"message": "Account created successfully"}
        
        # Verify user exists in the database and password is encrypted with bcrypt
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            assert user is not None
            assert user.name == "Test User"
            assert user.password_hash.startswith("$2b$") or user.password_hash.startswith("$2a$")
        finally:
            db.close()
            
        # 2. Duplicate Signup Conflict
        response = client.post("/api/auth/signup", json={
            "name": "Another User",
            "email": email,
            "password": "password456"
        })
        assert response.status_code == 409
        assert response.json()["detail"] == "Email already registered"
    
        # 3. Invalid Email Format
        response = client.post("/api/auth/signup", json={
            "name": "Bad Email",
            "email": "invalid_email_format",
            "password": "password456"
        })
        assert response.status_code == 400
        assert "Invalid email address format" in response.json()["detail"]
    
        # 4. Weak Password Validation
        response = client.post("/api/auth/signup", json={
            "name": "Short Pass",
            "email": f"short_{int(time.time())}@example.com",
            "password": "123"
        })
        assert response.status_code == 422
    finally:
        db = SessionLocal()
        try:
            db.query(User).filter(User.email == email).delete()
            db.commit()
        finally:
            db.close()
