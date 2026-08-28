"""
Tests for iteration 63:
- Security: /api/_download/codebase must return 404
- Admin login: POST /api/admin/login
- Admin migrations status: GET /api/admin/migrations/status
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSecurityEndpoint:
    """Verify removed codebase download endpoint returns 404"""

    def test_codebase_download_returns_404(self):
        response = requests.get(f"{BASE_URL}/api/_download/codebase")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: /api/_download/codebase returns 404")


class TestAdminLogin:
    """Referral admin login endpoint tests"""

    def test_login_success(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@valuevade.com",
            "password": "VV-Admin#2026-Sec"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, f"No token in response: {data}"
        assert isinstance(data["token"], str) and len(data["token"]) > 10
        print(f"PASS: Admin login returns token: {data['token'][:20]}...")

    def test_login_wrong_password_returns_401(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@valuevade.com",
            "password": "WrongPassword123"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: Wrong password returns 401")

    def test_login_wrong_email_returns_401(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "wrong@example.com",
            "password": "VV-Admin#2026-Sec"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: Wrong email returns 401")


class TestAdminMigrations:
    """Admin migrations status endpoint tests"""

    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@valuevade.com",
            "password": "VV-Admin#2026-Sec"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed - skipping migration tests")
        return response.json()["token"]

    def test_migrations_status_returns_200(self, admin_token):
        response = requests.get(
            f"{BASE_URL}/api/admin/migrations/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, (list, dict)), f"Expected list or dict, got: {type(data)}"
        print(f"PASS: /api/admin/migrations/status returns 200: {str(data)[:100]}")

    def test_migrations_status_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/admin/migrations/status")
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"PASS: /api/admin/migrations/status without auth returns {response.status_code}")
