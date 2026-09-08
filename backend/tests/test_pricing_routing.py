"""
Test pricing (4999), health, doubts and study-plan route registration.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def get_auth_token():
    """Login with test user and return access token."""
    import subprocess, json
    # We can't easily get a Supabase token here, so we test unauthenticated endpoints
    # and verify authenticated routes return 401/403 (not 404)
    return None


class TestHealth:
    def test_health_ok(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"

    def test_root_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200


class TestPricingEligibility:
    def test_eligibility_requires_auth(self):
        """Without auth, should return 401/403 not 500."""
        r = requests.get(f"{BASE_URL}/api/payments/eligibility", timeout=10)
        assert r.status_code in [401, 403, 422], f"Expected 401/403/422 got {r.status_code}: {r.text}"

    def test_pricing_amount_in_code(self):
        """Verify pricing 4999 is in the backend source code."""
        import os
        with open('/app/backend/payment_endpoints.py') as f:
            content = f.read()
        assert '4999' in content, "4999 not found in payment_endpoints.py"
        assert '999' not in content.replace('4999', ''), "Old price 999 still exists"


class TestDoubtRoutes:
    def test_doubts_start_requires_auth(self):
        """Route should exist (401) not 404."""
        r = requests.post(f"{BASE_URL}/api/doubts/start",
                          json={"phase": "notes", "module_code": "M1"},
                          timeout=10)
        assert r.status_code in [401, 403, 422], f"Expected 401/403/422, got {r.status_code}: {r.text}"

    def test_doubts_sessions_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/doubts/sessions", timeout=10)
        assert r.status_code in [401, 403, 422], f"Unexpected: {r.status_code}"

    def test_health_doubts(self):
        r = requests.get(f"{BASE_URL}/api/health/doubts?user_id=valuevade-mvp2", timeout=10)
        assert r.status_code in [200, 401, 403], f"Unexpected: {r.status_code}: {r.text}"


class TestStudyPlanRoutes:
    def test_study_plan_active_requires_auth(self):
        """Should return 401 not 404."""
        r = requests.get(f"{BASE_URL}/api/study-plan/active", timeout=10)
        assert r.status_code in [401, 403, 422], f"Expected 401/403/422, got {r.status_code}: {r.text}"

    def test_study_plan_preview_requires_auth_or_422(self):
        """POST with empty body → 422 (validation) or 401 (auth check first)."""
        r = requests.post(f"{BASE_URL}/api/study-plan/preview",
                          json={}, timeout=10)
        assert r.status_code in [401, 403, 422], f"Expected 401/422, got {r.status_code}: {r.text}"

    def test_study_plan_dashboard_summary_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/study-plan/dashboard-summary", timeout=10)
        assert r.status_code in [401, 403, 422], f"Unexpected: {r.status_code}"


class TestFaqPricing:
    def test_faq_has_4999(self):
        with open('/app/frontend/src/data/faqs.js') as f:
            content = f.read()
        assert '4999' in content, "4999 not in faqs.js"
        # Check old price 999 is only part of 4999 not standalone
        import re
        standalone_999 = re.findall(r'(?<!4)₹999(?!9)', content)
        assert len(standalone_999) == 0, f"Found standalone ₹999 in faqs.js: {standalone_999}"
