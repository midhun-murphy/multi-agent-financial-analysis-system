import pytest
import time
from fastapi.testclient import TestClient
from backend.api.main import app

client = TestClient(app)

def test_login_and_protection_flow():
    # 1. Sign up a new user first
    email = f"auth_test_{int(time.time())}@example.com"
    signup_res = client.post("/api/auth/signup", json={
        "name": "Auth Test User",
        "email": email,
        "password": "supersecurepassword123"
    })
    assert signup_res.status_code == 201

    # 2. Login with wrong password (should return 401)
    login_res = client.post("/api/auth/login", json={
        "email": email,
        "password": "wrongpassword"
    })
    assert login_res.status_code == 401
    assert "Invalid email or password" in login_res.json()["detail"]

    # 3. Login with correct password (should succeed and return token)
    login_res = client.post("/api/auth/login", json={
        "email": email,
        "password": "supersecurepassword123"
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    token = data["access_token"]

    # 4. Access protected endpoint WITHOUT token (should return 401)
    # Clear client cookies to simulate unauthenticated request
    client.cookies.clear()
    protected_res = client.post("/api/chat", json={
        "query": "Can I invest now?"
    })
    assert protected_res.status_code == 401

    # 5. Access protected endpoint WITH valid token header (should pass authentication check)
    headers = {"Authorization": f"Bearer {token}"}
    protected_res = client.post("/api/chat", json={
        "query": "Can I invest now?"
    }, headers=headers)
    # The route might return 400 or succeed depending on dynamic session context, but it should NOT return 401
    assert protected_res.status_code != 401
