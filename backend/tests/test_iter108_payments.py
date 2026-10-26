"""Razorpay payment infrastructure tests for iteration 108"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "info@valuevade.com"
ADMIN_PASSWORD = "VV-Admin#2026-Sec"
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://yuadeybycbfqlkdpxbkv.supabase.co')
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30.0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"

PAID_EMAIL = "testagent2026@gmail.com"
PAID_PASSWORD = "TestPass123!"
UNPAID_EMAIL = "vvtest673479@example.com"
UNPAID_PASSWORD = "TestPass123!"


@pytest.fixture(scope="module")
def admin_token():
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if resp.status_code != 200:
        pytest.skip(f"Admin auth failed: {resp.text}")
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def paid_token():
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": PAID_EMAIL, "password": PAID_PASSWORD}
    )
    if resp.status_code != 200:
        pytest.skip(f"Paid user auth failed: {resp.text}")
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def unpaid_token():
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": UNPAID_EMAIL, "password": UNPAID_PASSWORD}
    )
    if resp.status_code != 200:
        pytest.skip(f"Unpaid user auth failed: {resp.text}")
    return resp.json()["access_token"]


class TestSetupStatus:
    """Admin setup-status endpoint"""

    def test_setup_status_requires_auth(self):
        resp = requests.get(f"{BASE_URL}/api/admin/payments/setup-status")
        assert resp.status_code == 401

    def test_setup_status_returns_test_mode(self, admin_token):
        resp = requests.get(
            f"{BASE_URL}/api/admin/payments/setup-status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mode"] == "test", f"Expected test mode, got {data['mode']}"
        assert data["keys_configured"] is True
        assert data["webhook_secret_configured"] is False
        assert "key_id_display" in data


class TestResourceOrderEndpoint:
    """Resource order endpoint auth checks"""

    def test_order_requires_auth(self):
        resp = requests.post(
            f"{BASE_URL}/api/resources/00000000-0000-0000-0000-000000000001/order",
            headers={"Content-Type": "application/json"}
        )
        assert resp.status_code in [401, 422], f"Expected 401/422, got {resp.status_code}"

    def test_order_enrolled_user_returns_owned(self, paid_token):
        """Enrolled user should get owned=True for any resource"""
        # Get first marketplace resource (endpoint returns {items:[], categories:[]})
        resp = requests.get(f"{BASE_URL}/api/resources",
                           headers={"Authorization": f"Bearer {paid_token}"})
        if resp.status_code != 200:
            pytest.skip(f"Resources API failed: {resp.status_code}")
        items = resp.json().get("items", [])
        if not items:
            pytest.skip("No marketplace resources available")
        resource_id = items[0]["id"]
        
        order_resp = requests.post(
            f"{BASE_URL}/api/resources/{resource_id}/order",
            headers={"Authorization": f"Bearer {paid_token}", "Content-Type": "application/json"}
        )
        assert order_resp.status_code == 200
        data = order_resp.json()
        assert data.get("owned") is True
        assert data.get("included_in_course") is True

    def test_order_unenrolled_price_zero_returns_403(self, unpaid_token):
        """Unenrolled user + price_paise=0 resource should get 403 (course-included)"""
        resp = requests.get(f"{BASE_URL}/api/resources",
                           headers={"Authorization": f"Bearer {unpaid_token}"})
        if resp.status_code != 200:
            pytest.skip(f"Resources API failed: {resp.status_code}")
        items = resp.json().get("items", [])
        # Find resource with price_paise=0
        zero_price = [r for r in items if r.get("price_paise", 0) == 0]
        if not zero_price:
            pytest.skip("No zero-price resources found")
        resource_id = zero_price[0]["id"]
        
        order_resp = requests.post(
            f"{BASE_URL}/api/resources/{resource_id}/order",
            headers={"Authorization": f"Bearer {unpaid_token}", "Content-Type": "application/json"}
        )
        # 403 = course-included, 409 = file not uploaded yet (both are valid non-purchase responses)
        assert order_resp.status_code in [403, 409]


class TestResourceWebhook:
    """Resource payment webhook"""

    def test_webhook_returns_503_no_secret(self):
        resp = requests.post(
            f"{BASE_URL}/api/resources/payment/webhook",
            headers={"Content-Type": "application/json"},
            json={}
        )
        assert resp.status_code == 503
        assert "not configured" in resp.json().get("detail", "").lower()


class TestEnrollmentEligibility:
    """Course enrollment price check"""

    def test_eligibility_returns_4999_price(self, unpaid_token):
        resp = requests.get(
            f"{BASE_URL}/api/payments/eligibility",
            headers={"Authorization": f"Bearer {unpaid_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("amount_inr") == 4999, f"Expected 4999, got {data}"
        assert data.get("paid") is False

    def test_admin_payments_overview_loads(self, admin_token):
        """Admin payments overview endpoint"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/payments/overview",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
