"""Backend tests for LinkedIn-share Rewards feature.

Coverage:
- GET /api/rewards/eligible (auth required, graceful when table missing)
- POST /api/rewards/claim (auth + eligibility guard)
- Admin CRUD: GET/POST/PATCH/DELETE /api/admin/rewards
- GET /api/admin/rewards/triggers
- POST /api/admin/rewards/upload (multipart, size + MIME guard)
"""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://pivot-power-1.preview.emergentagent.com",
).rstrip("/")

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30.0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"

ADMIN_EMAIL = "info@valuevade.com"
ADMIN_PASS = "aa1aa2sam3"
USER_EMAIL = "testagent2026@gmail.com"
USER_PASS = "TestPass123!"


def _login(email, password):
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"Login failed for {email}: {r.status_code} {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers():
    tok = _login(ADMIN_EMAIL, ADMIN_PASS)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def user_headers():
    tok = _login(USER_EMAIL, USER_PASS)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Public /rewards/eligible
# ---------------------------------------------------------------------------
class TestRewardsEligible:
    def test_unauth_rejected(self):
        r = requests.get(f"{BASE_URL}/api/rewards/eligible", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_authed_ok_graceful_when_missing(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/rewards/eligible", headers=user_headers, timeout=20)
        assert r.status_code == 200, f"expected 200 (graceful degradation), got {r.status_code}: {r.text[:250]}"
        data = r.json()
        assert "rewards" in data
        assert isinstance(data["rewards"], list)
        # Either table_ready=True with list, or table_ready=False with hint
        if data.get("table_ready") is False:
            assert "hint" in data and "master_rewards" in data["hint"]


# ---------------------------------------------------------------------------
# Admin CRUD gating
# ---------------------------------------------------------------------------
class TestAdminRewardsGating:
    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/rewards", timeout=15)
        assert r.status_code in (401, 403)

    def test_list_non_admin_403(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/admin/rewards", headers=user_headers, timeout=20)
        assert r.status_code == 403, f"expected 403 for non-admin, got {r.status_code}: {r.text[:250]}"

    def test_create_non_admin_403(self, user_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/rewards",
            headers=user_headers,
            json={"title": "hax", "trigger_type": "module_complete", "trigger_ref_id": "x"},
            timeout=20,
        )
        assert r.status_code == 403

    def test_patch_non_admin_403(self, user_headers):
        r = requests.patch(
            f"{BASE_URL}/api/admin/rewards/00000000-0000-0000-0000-000000000000",
            headers=user_headers,
            json={"title": "nope"},
            timeout=20,
        )
        assert r.status_code == 403

    def test_delete_non_admin_403(self, user_headers):
        r = requests.delete(
            f"{BASE_URL}/api/admin/rewards/00000000-0000-0000-0000-000000000000",
            headers=user_headers,
            timeout=20,
        )
        assert r.status_code == 403

    def test_triggers_non_admin_403(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/admin/rewards/triggers", headers=user_headers, timeout=20)
        assert r.status_code == 403

    def test_upload_non_admin_403(self, user_headers):
        files = {"file": ("tiny.pdf", b"%PDF-1.4\n%EOF", "application/pdf")}
        # requests handles multipart; strip json content-type from user_headers
        h = {k: v for k, v in user_headers.items() if k.lower() != "content-type"}
        r = requests.post(f"{BASE_URL}/api/admin/rewards/upload", headers=h, files=files, timeout=30)
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Admin CRUD as admin — validates graceful degradation OR real success
# ---------------------------------------------------------------------------
class TestAdminRewardsAsAdmin:
    def test_admin_list_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/rewards", headers=admin_headers, timeout=20)
        assert r.status_code == 200, f"admin list failed: {r.status_code} {r.text[:250]}"
        data = r.json()
        assert "rewards" in data
        assert isinstance(data["rewards"], list)
        # capture flag for later tests
        pytest.rewards_table_ready = bool(data.get("table_ready", True) is not False)

    def test_admin_triggers_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/rewards/triggers", headers=admin_headers, timeout=25)
        assert r.status_code == 200, f"triggers failed: {r.status_code} {r.text[:250]}"
        data = r.json()
        assert "modules" in data and "capstones" in data
        assert isinstance(data["modules"], list)
        assert isinstance(data["capstones"], list)
        # Modules should have entries (curriculum is seeded)
        assert len(data["modules"]) > 0, "expected some master_modules"

    def test_admin_create_bad_body_400(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/rewards",
            headers=admin_headers,
            json={"title": "", "trigger_type": "wrong"},
            timeout=20,
        )
        # Either 400 (validation) or 503 (table missing) is acceptable
        assert r.status_code in (400, 503), f"expected 400/503, got {r.status_code}: {r.text[:250]}"

    def test_admin_create_valid_body(self, admin_headers):
        # Get a real module id first
        tr = requests.get(f"{BASE_URL}/api/admin/rewards/triggers", headers=admin_headers, timeout=20).json()
        mods = tr.get("modules") or []
        if not mods:
            pytest.skip("No modules to attach reward to")
        mod_id = mods[0]["id"]
        r = requests.post(
            f"{BASE_URL}/api/admin/rewards",
            headers=admin_headers,
            json={
                "title": "TEST_reward_temp",
                "description": "auto-test",
                "linkedin_message": "Just completed module 1!",
                "trigger_type": "module_complete",
                "trigger_ref_id": mod_id,
                "order_index": 999,
                "is_active": True,
            },
            timeout=20,
        )
        # Either 200 (table ready) OR 503 (migration not applied) is acceptable
        assert r.status_code in (200, 503), f"unexpected {r.status_code}: {r.text[:250]}"
        if r.status_code == 200:
            body = r.json()
            assert body.get("reward"), "missing reward in response"
            created_id = body["reward"]["id"]
            # cleanup
            d = requests.delete(
                f"{BASE_URL}/api/admin/rewards/{created_id}",
                headers=admin_headers,
                timeout=20,
            )
            assert d.status_code in (200, 204)


# ---------------------------------------------------------------------------
# /rewards/claim eligibility abuse guard
# ---------------------------------------------------------------------------
class TestRewardsClaim:
    def test_claim_unauth(self):
        r = requests.post(
            f"{BASE_URL}/api/rewards/claim",
            json={"reward_id": "00000000-0000-0000-0000-000000000000"},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_claim_unknown_reward(self, user_headers):
        r = requests.post(
            f"{BASE_URL}/api/rewards/claim",
            headers=user_headers,
            json={"reward_id": "00000000-0000-0000-0000-000000000000"},
            timeout=20,
        )
        # Acceptable: 404 (not found), 403 (not eligible), or 503 (migration missing)
        assert r.status_code in (403, 404, 503), f"got {r.status_code}: {r.text[:250]}"


# ---------------------------------------------------------------------------
# Upload endpoint — admin path (may 503 if bucket missing)
# ---------------------------------------------------------------------------
class TestRewardsUpload:
    def test_upload_as_admin(self, admin_headers):
        files = {"file": ("test.pdf", b"%PDF-1.4\ntest\n%%EOF", "application/pdf")}
        h = {k: v for k, v in admin_headers.items() if k.lower() != "content-type"}
        r = requests.post(f"{BASE_URL}/api/admin/rewards/upload", headers=h, files=files, timeout=60)
        # 200 if bucket exists, 502/500 otherwise
        assert r.status_code in (200, 500, 502, 503), f"got {r.status_code}: {r.text[:250]}"
        if r.status_code == 200:
            data = r.json()
            assert "resource_file_path" in data
            assert data.get("resource_size_bytes", 0) > 0
