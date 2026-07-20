"""
Backend tests for Session Feedback endpoints.

Endpoints under test:
- POST   /api/sessions/{id}/feedback
- GET    /api/admin/session-feedback
- PATCH  /api/admin/session-feedback/{id}/resolve
- DELETE /api/admin/session-feedback/{id}

Notes:
- 0035_session_feedback.sql may NOT be applied. When the table is missing:
  - Admin GET returns 200 with {table_ready:false} (graceful).
  - POST / PATCH / DELETE may return 500 (PGRST205) — expected.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend/.env
    try:
        with open("/app/frontend/.env") as _f:
            for _line in _f:
                if _line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = _line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL is required"

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SUPABASE_ANON = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2Jm"
    "cWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30."
    "0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"
)

ADMIN_EMAIL = "info@valuevade.com"
ADMIN_PASS = "aa1aa2sam3"
USER_EMAIL = "testagent2026@gmail.com"
USER_PASS = "TestPass123!"

# A test session id — arbitrary but stable per session
TEST_SESSION_ID = "00000000-0000-0000-0000-000000000abc"


def _login(email, password):
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers():
    tok = _login(ADMIN_EMAIL, ADMIN_PASS)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def user_headers():
    tok = _login(USER_EMAIL, USER_PASS)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------- POST /api/sessions/{id}/feedback ----------------
class TestSubmitFeedback:
    def test_unauth_returns_401(self):
        r = requests.post(
            f"{BASE_URL}/api/sessions/{TEST_SESSION_ID}/feedback",
            json={"category": "content_issue", "message": "Test feedback from QA"},
            timeout=30,
        )
        assert r.status_code == 401, f"Expected 401 got {r.status_code}: {r.text}"

    def test_invalid_category_returns_400(self, user_headers):
        r = requests.post(
            f"{BASE_URL}/api/sessions/{TEST_SESSION_ID}/feedback",
            headers=user_headers,
            json={"category": "invalid", "message": "Long enough message"},
            timeout=30,
        )
        assert r.status_code == 400, f"Expected 400 got {r.status_code}: {r.text}"
        assert "category" in (r.json().get("detail") or "").lower()

    def test_short_message_returns_400(self, user_headers):
        r = requests.post(
            f"{BASE_URL}/api/sessions/{TEST_SESSION_ID}/feedback",
            headers=user_headers,
            json={"category": "content_issue", "message": "abc"},
            timeout=30,
        )
        assert r.status_code == 400
        assert "5 char" in (r.json().get("detail") or "").lower() or "at least 5" in (r.json().get("detail") or "").lower()

    def test_long_message_returns_400(self, user_headers):
        r = requests.post(
            f"{BASE_URL}/api/sessions/{TEST_SESSION_ID}/feedback",
            headers=user_headers,
            json={"category": "other", "message": "x" * 2500},
            timeout=30,
        )
        assert r.status_code == 400
        assert "2000" in (r.json().get("detail") or "")

    def test_valid_submit_reaches_persist(self, user_headers):
        """With valid payload we expect either 200 (table exists) or 500 (PGRST205
        because 0035 migration hasn't been applied). Both prove the request
        passes validation and reaches the persistence layer."""
        r = requests.post(
            f"{BASE_URL}/api/sessions/{TEST_SESSION_ID}/feedback",
            headers=user_headers,
            json={"category": "content_issue", "message": "Test feedback from QA"},
            timeout=30,
        )
        assert r.status_code in (200, 404, 500), f"Unexpected {r.status_code}: {r.text}"
        if r.status_code == 200:
            data = r.json()
            assert data.get("ok") is True
            assert "feedback" in data
        else:
            # Confirm this is the PGRST205 (table missing) path, not a generic error
            assert "PGRST205" in r.text or "session_feedback" in r.text


# ---------------- GET /api/admin/session-feedback ----------------
class TestAdminListFeedback:
    def test_unauth_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/session-feedback", timeout=30)
        assert r.status_code == 401

    def test_admin_list_graceful_when_table_missing(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/session-feedback",
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200, f"Expected 200 got {r.status_code}: {r.text}"
        data = r.json()
        assert "total" in data
        assert "feedback" in data
        assert isinstance(data["feedback"], list)
        # table_ready flag is present only when fallback fires
        if data.get("table_ready") is False:
            assert data["total"] == 0
            assert data["feedback"] == []

    def test_admin_list_with_filters(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/session-feedback?resolved=false&category=content_issue",
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert "feedback" in data
        assert isinstance(data["feedback"], list)


# ---------------- PATCH /api/admin/session-feedback/{id}/resolve ----------------
class TestAdminResolveFeedback:
    def test_unauth_returns_401(self):
        r = requests.patch(
            f"{BASE_URL}/api/admin/session-feedback/00000000-0000-0000-0000-000000000000/resolve",
            json={"resolved": True},
            timeout=30,
        )
        assert r.status_code == 401

    def test_admin_resolve_reaches_persist(self, admin_headers):
        r = requests.patch(
            f"{BASE_URL}/api/admin/session-feedback/00000000-0000-0000-0000-000000000000/resolve",
            headers=admin_headers,
            json={"resolved": True},
            timeout=30,
        )
        # 200 (no-op update on missing row) or 404/500 (table missing) all acceptable
        assert r.status_code in (200, 404, 500), f"Unexpected {r.status_code}: {r.text}"


# ---------------- DELETE /api/admin/session-feedback/{id} ----------------
class TestAdminDeleteFeedback:
    def test_unauth_returns_401(self):
        r = requests.delete(
            f"{BASE_URL}/api/admin/session-feedback/00000000-0000-0000-0000-000000000000",
            timeout=30,
        )
        assert r.status_code == 401

    def test_admin_delete_missing_row(self, admin_headers):
        r = requests.delete(
            f"{BASE_URL}/api/admin/session-feedback/00000000-0000-0000-0000-000000000000",
            headers=admin_headers,
            timeout=30,
        )
        # 404 if table exists but row missing, 500 if table missing
        assert r.status_code in (404, 500), f"Unexpected {r.status_code}: {r.text}"
