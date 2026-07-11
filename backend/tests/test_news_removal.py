"""Backend regression tests for the removed Daily Finance News feature (iter_24).

Verifies:
  - GET /api/news/today and POST /api/news/mark_read return 404 (endpoints removed).
  - Other unrelated endpoints still respond correctly.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback: read from frontend/.env (still safe because value is a public URL)
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1]
                break
BASE_URL = (BASE_URL or "").rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- News endpoints must return 404 (feature removed) --------------------------

class TestNewsRemoval:
    def test_get_news_today_no_auth_returns_404(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/news/today")
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text[:200]}"

    def test_get_news_today_with_bearer_still_404(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/news/today",
            headers={"Authorization": "Bearer dummy-token"},
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"

    def test_post_news_mark_read_no_auth_returns_404(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/news/mark_read", json={})
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text[:200]}"

    def test_post_news_mark_read_with_bearer_still_404(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/news/mark_read",
            headers={"Authorization": "Bearer dummy-token"},
            json={},
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"


# ---- Regression: other endpoints unaffected -----------------------------------

class TestRegressionOtherEndpoints:
    def test_root_api_still_200(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        # Response is expected: {"message": "Valuevade API"}
        assert "message" in data
        assert "Valuevade" in data["message"]

    def test_pari_welcome_requires_auth(self, api_client):
        # Endpoint is registered but auth-guarded (should NOT be 404)
        r = api_client.get(f"{BASE_URL}/api/me/pari_welcome")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_portfolio_me_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/portfolio/me")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_admin_sessions_videos_requires_auth(self, api_client):
        # Endpoint should exist and be auth-guarded (401), not 404
        r = api_client.get(f"{BASE_URL}/api/admin/sessions/videos")
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"
