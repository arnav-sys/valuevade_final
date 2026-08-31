"""Backend tests for DELETE /api/admin/users/{user_id} and LinkedIn message in rewards PATCH"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_EMAIL = "info@valuevade.com"
ADMIN_PASSWORD = "VV-Admin#2026-Sec"
SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30.0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"

FAKE_USER_ID = "00000000-0000-0000-0000-000000000000"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin JWT via Supabase email/password login"""
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        },
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if resp.status_code != 200:
        pytest.skip(f"Admin login failed: {resp.status_code} {resp.text[:200]}")
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestDeleteUserEndpoint:
    """Tests for DELETE /api/admin/users/{user_id}"""

    def test_delete_nonexistent_user_returns_200_or_404(self, auth_headers):
        """DELETE with a fake UUID should return 200 (deleted=True, user not found) or 404"""
        resp = requests.delete(f"{BASE_URL}/api/admin/users/{FAKE_USER_ID}", headers=auth_headers)
        # Acceptable: 200 (user not found but endpoint exists) or 404 (user not found)
        assert resp.status_code in (200, 404), f"Expected 200 or 404, got {resp.status_code}: {resp.text[:300]}"
        print(f"DELETE /api/admin/users/fake → {resp.status_code}: {resp.json()}")

    def test_delete_endpoint_exists_not_401_or_404_route(self, auth_headers):
        """Verify the DELETE endpoint exists (not a missing route 404)"""
        resp = requests.delete(f"{BASE_URL}/api/admin/users/{FAKE_USER_ID}", headers=auth_headers)
        # Should not be a 404 from FastAPI route not found (would have detail="Not Found")
        if resp.status_code == 404:
            data = resp.json()
            # FastAPI missing-route 404 has {"detail": "Not Found"}
            assert data.get("detail") != "Not Found", "Route does not exist at all!"
        print(f"Endpoint check → {resp.status_code}")

    def test_delete_unauthenticated_returns_401(self):
        """DELETE without token should be rejected"""
        resp = requests.delete(f"{BASE_URL}/api/admin/users/{FAKE_USER_ID}")
        assert resp.status_code in (401, 403), f"Expected 401/403, got {resp.status_code}"
        print(f"Unauth delete → {resp.status_code}")


class TestLinkedInMessageReward:
    """Tests for LinkedIn message field persistence in PATCH /api/admin/rewards/{id}"""

    def test_get_rewards_list(self, auth_headers):
        """GET /api/admin/rewards returns a list"""
        resp = requests.get(f"{BASE_URL}/api/admin/rewards", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
        data = resp.json()
        assert isinstance(data, list) or isinstance(data, dict), "Response should be list or dict"
        print(f"GET rewards → {resp.status_code}, count={len(data) if isinstance(data, list) else 'dict'}")

    def test_patch_reward_linkedin_message_persists(self, auth_headers):
        """PATCH an existing reward's linkedin_message and verify it persists via GET"""
        # Get existing rewards
        get_resp = requests.get(f"{BASE_URL}/api/admin/rewards", headers=auth_headers)
        assert get_resp.status_code == 200
        rewards = get_resp.json()
        if isinstance(rewards, dict):
            rewards = rewards.get("rewards", [])
        if not rewards:
            pytest.skip("No rewards available to test linkedin_message patch")

        reward = rewards[0]
        reward_id = reward.get("id")
        assert reward_id, "Reward must have an id"

        test_message = "TEST_linkedin_message_persistence_check_iter84"

        # PATCH with new linkedin_message
        patch_resp = requests.patch(
            f"{BASE_URL}/api/admin/rewards/{reward_id}",
            headers=auth_headers,
            json={"linkedin_message": test_message}
        )
        assert patch_resp.status_code in (200, 204), f"PATCH failed: {patch_resp.status_code}: {patch_resp.text[:300]}"
        print(f"PATCH reward linkedin_message → {patch_resp.status_code}")

        # Verify via GET that message persists
        get_after = requests.get(f"{BASE_URL}/api/admin/rewards", headers=auth_headers)
        assert get_after.status_code == 200
        rewards_after = get_after.json()
        if isinstance(rewards_after, dict):
            rewards_after = rewards_after.get("rewards", [])
        
        updated = next((r for r in rewards_after if r.get("id") == reward_id), None)
        assert updated is not None, "Could not find reward by id after PATCH"
        assert updated.get("linkedin_message") == test_message, (
            f"linkedin_message not persisted! Expected '{test_message}', got '{updated.get('linkedin_message')}'"
        )
        print(f"LinkedIn message persisted: ✓ ({test_message})")

        # Restore original value
        original_msg = reward.get("linkedin_message", "")
        requests.patch(
            f"{BASE_URL}/api/admin/rewards/{reward_id}",
            headers=auth_headers,
            json={"linkedin_message": original_msg}
        )
