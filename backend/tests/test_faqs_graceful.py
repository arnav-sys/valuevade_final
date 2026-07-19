"""FAQ graceful-degradation tests.

Backing table `faqs` intentionally does not exist yet in Supabase
(migration 0033_faqs.sql has NOT been run). This suite verifies the
backend returns friendly empty-state payloads instead of raw PGRST205.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://excel-rebuild.preview.emergentagent.com").rstrip("/")
SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SUPABASE_ANON = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30."
    "0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"
)

ADMIN_EMAIL = "info@valuevade.com"
ADMIN_PASS = "aa1aa2sam3"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Cannot log in as admin: {r.status_code} {r.text[:200]}")
    tok = r.json().get("access_token")
    assert tok, "no access_token in login response"
    return tok


# ---------- Public read ----------
class TestPublicFaqs:
    def test_get_public_faqs_returns_200_with_graceful_flag(self):
        r = requests.get(f"{BASE_URL}/api/faqs", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "faqs" in body
        assert body["faqs"] == []
        assert body.get("table_ready") is False, f"expected table_ready=False, got: {body}"

    def test_get_public_faqs_no_pgrst_leak(self):
        r = requests.get(f"{BASE_URL}/api/faqs", timeout=15)
        assert "PGRST205" not in r.text
        assert "Could not find the table" not in r.text


# ---------- Admin list ----------
class TestAdminFaqsList:
    def test_get_admin_faqs_returns_graceful_shape(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/faqs",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("total") == 0
        assert body.get("faqs") == []
        assert body.get("table_ready") is False
        hint = (body.get("hint") or "").lower()
        assert "faqs" in hint
        assert "0033_faqs.sql" in body.get("hint", "")

    def test_admin_faqs_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/faqs", timeout=15)
        assert r.status_code in (401, 403), f"expected auth failure, got {r.status_code}"


# ---------- Admin create ----------
class TestAdminFaqsCreate:
    def test_post_admin_faq_returns_503_with_helpful_hint(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/admin/faqs",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json",
            },
            json={"category": "Course", "question": "Test?", "answer": "Test."},
            timeout=15,
        )
        assert r.status_code == 503, f"expected 503, got {r.status_code}: {r.text}"
        detail = (r.json().get("detail") or "").lower()
        assert "faqs" in detail
        assert "migration" in detail or "0033_faqs.sql" in detail

    def test_post_admin_faq_validation_still_works(self, admin_token):
        # Missing required fields → 400, not 503.
        r = requests.post(
            f"{BASE_URL}/api/admin/faqs",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json",
            },
            json={"category": "", "question": "", "answer": ""},
            timeout=15,
        )
        assert r.status_code == 400, r.text
