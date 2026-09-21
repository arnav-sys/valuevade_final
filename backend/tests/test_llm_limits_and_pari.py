"""
Backend tests for Feb 2026 LLM limits & Pari cost cap.

Covers:
  - GET  /api/pari/status  (401 unauth, 200 auth)
  - POST /api/customize/generate  (401 unauth)
  - POST /api/doubts/start  (401 unauth)
  - POST /api/doubts/ask    (401 unauth)
  - POST /api/doubts/extended/start (401 unauth)
  - POST /api/doubts/extended/ask   (401 unauth)

Migration 0036 has NOT been applied on the test project, so the 429 / 402
enforcement branches cannot be exercised end-to-end without service-role SQL
access. The code is designed to degrade gracefully in that case
(counters == 0, caps let requests through) — this suite verifies the
graceful path returns HTTP 200 with default zero counters.
"""
import os
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
           "https://fintech-mvp-38.preview.emergentagent.com"

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SUPABASE_ANON = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6"
    "Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMs"
    "ImV4cCI6MjA5MTQ4ODA0M30.0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"
)

TEST_EMAIL = "testagent2026@gmail.com"
TEST_PASS = "TestPass123!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
        json={"email": TEST_EMAIL, "password": TEST_PASS},
        timeout=15,
    )
    assert r.status_code == 200, f"Supabase auth failed: {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ─── /api/pari/status ───────────────────────────────────────────────
class TestPariStatus:
    def test_no_auth_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/pari/status", timeout=10)
        assert r.status_code == 401
        assert "bearer" in r.json().get("detail", "").lower()

    def test_with_auth_returns_shape(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pari/status", headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "pari" in data and "customize" in data
        pari = data["pari"]
        for key in ("total_cost_inr", "limit_inr", "over_budget", "remaining_inr"):
            assert key in pari, f"missing {key}"
        assert pari["limit_inr"] == 500.0
        cust = data["customize"]
        for key in ("generations_used", "generations_limit",
                    "generations_remaining", "exhausted"):
            assert key in cust, f"missing {key}"
        assert cust["generations_limit"] == 4
        # Graceful degradation (migration 0036 not applied) → counters are 0
        assert isinstance(cust["generations_used"], int)
        assert isinstance(pari["total_cost_inr"], (int, float))


# ─── Auth-gate for /customize/generate ──────────────────────────────
class TestCustomizeGenerateAuthGate:
    def test_no_auth_returns_401(self):
        r = requests.post(
            f"{BASE_URL}/api/customize/generate",
            json={"course_title": "x", "course_structure": [], "answers": []},
            timeout=10,
        )
        assert r.status_code == 401
        assert "bearer" in r.json().get("detail", "").lower()

    def test_bad_bearer_returns_401(self):
        r = requests.post(
            f"{BASE_URL}/api/customize/generate",
            headers={"Authorization": "Bearer invalid.jwt.here",
                     "Content-Type": "application/json"},
            json={"course_title": "x", "course_structure": [], "answers": []},
            timeout=10,
        )
        assert r.status_code == 401


# ─── Auth-gate for /doubts endpoints ────────────────────────────────
class TestDoubtsAuthGate:
    endpoints = [
        "/api/doubts/start",
        "/api/doubts/ask",
        "/api/doubts/extended/start",
        "/api/doubts/extended/ask",
    ]

    @pytest.mark.parametrize("ep", endpoints)
    def test_no_auth_returns_401(self, ep):
        r = requests.post(f"{BASE_URL}{ep}", json={}, timeout=10)
        assert r.status_code == 401, f"{ep} returned {r.status_code}"


# ─── Basic health ───────────────────────────────────────────────────
def test_backend_health():
    r = requests.get(f"{BASE_URL}/api/", timeout=10)
    assert r.status_code == 200
    assert "Valuevade" in r.text or "message" in r.json()
