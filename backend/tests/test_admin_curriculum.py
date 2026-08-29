"""
Backend tests for Admin Curriculum CRUD (Phase A: modules + sessions).

Tests:
- Auth guardrails (401 unauth, 403 non-admin)
- GET /api/admin/curriculum/modules
- GET /api/admin/curriculum/sessions?module_id=...
- POST/PATCH/DELETE /api/admin/modules[/{id}]
- GET /api/admin/modules/{id}/impact
- POST/PATCH/DELETE /api/admin/sessions[/{id}]
- Cascade delete (module removes sessions)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mock-exam-mvp.preview.emergentagent.com").rstrip("/")
SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30.0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"

ADMIN_EMAIL = "info@valuevade.com"
ADMIN_PASS = "aa1aa2sam3"
NON_ADMIN_EMAIL = "testagent2026@gmail.com"
NON_ADMIN_PASS = "TestPass123!"


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
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def user_token():
    return _login(NON_ADMIN_EMAIL, NON_ADMIN_PASS)


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}


# ---------------- Auth ----------------
class TestAuth:
    def test_unauth_modules_list(self):
        r = requests.get(f"{BASE_URL}/api/admin/curriculum/modules", timeout=30)
        assert r.status_code == 401, f"expected 401 got {r.status_code}: {r.text[:200]}"

    def test_unauth_create_module(self):
        r = requests.post(f"{BASE_URL}/api/admin/modules", json={"title": "x"}, timeout=30)
        assert r.status_code == 401

    def test_unauth_create_session(self):
        r = requests.post(f"{BASE_URL}/api/admin/sessions", json={"title": "x"}, timeout=30)
        assert r.status_code == 401

    def test_unauth_impact(self):
        r = requests.get(f"{BASE_URL}/api/admin/modules/some-id/impact", timeout=30)
        assert r.status_code == 401

    def test_non_admin_modules_list(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/admin/curriculum/modules", headers=user_headers, timeout=30)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:200]}"

    def test_non_admin_create_module(self, user_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/modules",
            headers=user_headers,
            json={"path_id": "00000000-0000-0000-0000-000000000000", "title": "__TEST_forbidden"},
            timeout=30,
        )
        assert r.status_code == 403


# ---------------- Read ----------------
class TestReads:
    def test_list_modules_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/curriculum/modules", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        j = r.json()
        assert "path_id" in j and "modules" in j
        assert isinstance(j["modules"], list)
        assert j["path_id"], "path_id must be non-null"
        if j["modules"]:
            m = j["modules"][0]
            for k in ("id", "title", "module_number", "order_index", "session_count"):
                assert k in m, f"missing key {k} in module row: {m}"

    def test_list_sessions_for_first_module(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/curriculum/modules", headers=admin_headers, timeout=30)
        mods = r.json().get("modules", [])
        if not mods:
            pytest.skip("no modules seeded")
        mid = mods[0]["id"]
        r2 = requests.get(
            f"{BASE_URL}/api/admin/curriculum/sessions?module_id={mid}",
            headers=admin_headers,
            timeout=30,
        )
        assert r2.status_code == 200, r2.text[:300]
        assert isinstance(r2.json().get("sessions"), list)

    def test_impact_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/curriculum/modules", headers=admin_headers, timeout=30)
        mods = r.json().get("modules", [])
        if not mods:
            pytest.skip("no modules seeded")
        mid = mods[0]["id"]
        r2 = requests.get(f"{BASE_URL}/api/admin/modules/{mid}/impact", headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        j = r2.json()
        for k in ("sessions", "notes_cards", "quiz_items", "interview_questions"):
            assert k in j
            assert isinstance(j[k], int)


# ---------------- CRUD lifecycle (create + patch + cascade delete) ----------------
class TestCRUD:
    @pytest.fixture(scope="class")
    def created(self, admin_headers):
        """Create a test module + session; yield ids; cleanup afterwards."""
        # get path_id (modules list is slow due to n+1 session-count queries → 120s cap)
        r = requests.get(f"{BASE_URL}/api/admin/curriculum/modules", headers=admin_headers, timeout=120)
        assert r.status_code == 200
        path_id = r.json()["path_id"]
        assert path_id

        # CREATE module
        r = requests.post(
            f"{BASE_URL}/api/admin/modules",
            headers=admin_headers,
            json={"path_id": path_id, "title": "__TEST_TB"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        mod = r.json()["module"]
        assert mod and mod.get("id")
        assert mod["title"] == "__TEST_TB"
        assert mod.get("path_id") == path_id
        assert isinstance(mod.get("order_index"), int)
        assert isinstance(mod.get("module_number"), int)
        module_id = mod["id"]

        # CREATE session under it
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions",
            headers=admin_headers,
            json={"module_id": module_id, "title": "Test Session A"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        sess = r.json()["session"]
        assert sess and sess.get("id")
        assert sess["title"] == "Test Session A"
        assert isinstance(sess.get("order_index"), int)
        session_id = sess["id"]

        state = {"module_id": module_id, "session_id": session_id, "path_id": path_id}
        yield state

        # cleanup (idempotent — module delete cascades sessions)
        try:
            requests.delete(f"{BASE_URL}/api/admin/modules/{module_id}", headers=admin_headers, timeout=30)
        except Exception:
            pass

    def test_module_appears_in_list(self, admin_headers, created):
        r = requests.get(f"{BASE_URL}/api/admin/curriculum/modules", headers=admin_headers, timeout=30)
        ids = [m["id"] for m in r.json().get("modules", [])]
        assert created["module_id"] in ids

    def test_patch_module(self, admin_headers, created):
        r = requests.patch(
            f"{BASE_URL}/api/admin/modules/{created['module_id']}",
            headers=admin_headers,
            json={"title": "__TEST_RENAMED"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        j = r.json()["module"]
        assert j and j["title"] == "__TEST_RENAMED"
        # Verify persistence via GET list
        r2 = requests.get(f"{BASE_URL}/api/admin/curriculum/modules", headers=admin_headers, timeout=30)
        found = next((m for m in r2.json().get("modules", []) if m["id"] == created["module_id"]), None)
        assert found and found["title"] == "__TEST_RENAMED"

    def test_session_appears_in_list(self, admin_headers, created):
        r = requests.get(
            f"{BASE_URL}/api/admin/curriculum/sessions?module_id={created['module_id']}",
            headers=admin_headers,
            timeout=30,
        )
        ids = [s["id"] for s in r.json().get("sessions", [])]
        assert created["session_id"] in ids

    def test_patch_session(self, admin_headers, created):
        r = requests.patch(
            f"{BASE_URL}/api/admin/sessions/{created['session_id']}",
            headers=admin_headers,
            json={"title": "Session Renamed"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        j = r.json()["session"]
        assert j and j["title"] == "Session Renamed"

    def test_impact_reports_our_session(self, admin_headers, created):
        r = requests.get(
            f"{BASE_URL}/api/admin/modules/{created['module_id']}/impact",
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200
        j = r.json()
        assert j["sessions"] >= 1

    def test_delete_single_session(self, admin_headers, created):
        # Create a second session, delete it, verify removal
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions",
            headers=admin_headers,
            json={"module_id": created["module_id"], "title": "__TEST_second_sess"},
            timeout=30,
        )
        assert r.status_code == 200
        sid2 = r.json()["session"]["id"]
        rd = requests.delete(f"{BASE_URL}/api/admin/sessions/{sid2}", headers=admin_headers, timeout=30)
        assert rd.status_code == 200
        # verify
        r2 = requests.get(
            f"{BASE_URL}/api/admin/curriculum/sessions?module_id={created['module_id']}",
            headers=admin_headers,
            timeout=30,
        )
        ids = [s["id"] for s in r2.json().get("sessions", [])]
        assert sid2 not in ids

    def test_delete_module_cascades(self, admin_headers, created):
        mid = created["module_id"]
        sid = created["session_id"]
        rd = requests.delete(f"{BASE_URL}/api/admin/modules/{mid}", headers=admin_headers, timeout=30)
        assert rd.status_code == 200, rd.text[:300]

        # Module gone from list
        r = requests.get(f"{BASE_URL}/api/admin/curriculum/modules", headers=admin_headers, timeout=30)
        ids = [m["id"] for m in r.json().get("modules", [])]
        assert mid not in ids

        # Sessions gone — verify via public supabase (module_id filter returns [])
        # Since we don't have direct DB, verify via impact returning 0 sessions no longer valid
        # (module removed) — instead verify via sessions endpoint returns empty.
        r2 = requests.get(
            f"{BASE_URL}/api/admin/curriculum/sessions?module_id={mid}",
            headers=admin_headers,
            timeout=30,
        )
        # sessions endpoint may return [] since module is deleted (FK-cascade)
        assert r2.status_code == 200
        remaining = r2.json().get("sessions", [])
        assert sid not in [s["id"] for s in remaining]
        assert len(remaining) == 0


# ---------------- Validation ----------------
class TestValidation:
    def test_create_module_missing_title(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/modules", headers=admin_headers, json={"path_id": "x"}, timeout=30)
        assert r.status_code == 400

    def test_create_session_missing_title(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/sessions", headers=admin_headers, json={"module_id": "x"}, timeout=30)
        assert r.status_code == 400

    def test_patch_module_empty(self, admin_headers):
        # get a module id
        r = requests.get(f"{BASE_URL}/api/admin/curriculum/modules", headers=admin_headers, timeout=30)
        mods = r.json().get("modules", [])
        if not mods:
            pytest.skip("no modules")
        r2 = requests.patch(
            f"{BASE_URL}/api/admin/modules/{mods[0]['id']}",
            headers=admin_headers,
            json={},
            timeout=30,
        )
        assert r2.status_code == 400
