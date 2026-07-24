"""
Backend tests — GET /api/admin/curriculum/export (Phase F, Jan 2026)

Verifies:
    * 401/403 without admin auth
    * 200 shape with admin auth
    * summary counts + entity keys
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://excel-rebuild.preview.emergentagent.com").rstrip("/")
SUPA_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30."
    "0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"
)


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{SUPA_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        json={"email": "info@valuevade.com", "password": "aa1aa2sam3"},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def curriculum(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/admin/curriculum/export",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=60,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
    return r.json()


# ---------------- Auth ----------------
class TestAuth:
    def test_no_auth_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/curriculum/export", timeout=30)
        assert r.status_code in (401, 403), f"got {r.status_code}"


# ---------------- Happy path ----------------
class TestExportShape:
    def test_top_level_keys(self, curriculum):
        for k in ("path", "modules", "capstones", "summary", "generated_at"):
            assert k in curriculum, f"missing key: {k}"

    def test_path_shape(self, curriculum):
        p = curriculum["path"]
        assert "id" in p and "title" in p
        assert isinstance(p["title"], str) and len(p["title"]) > 0

    def test_summary_counts(self, curriculum):
        s = curriculum["summary"]
        assert s["module_count"] >= 20, f"module_count={s['module_count']}"
        assert s["session_count"] > 200, f"session_count={s['session_count']}"
        assert s["project_count"] > 10, f"project_count={s['project_count']}"
        assert s["capstone_count"] == 3, f"capstone_count={s['capstone_count']}"

    def test_summary_matches_arrays(self, curriculum):
        s = curriculum["summary"]
        assert s["module_count"] == len(curriculum["modules"])
        assert s["capstone_count"] == len(curriculum["capstones"])
        session_total = sum(len(m.get("sessions") or []) for m in curriculum["modules"])
        project_total = sum(len(m.get("projects") or []) for m in curriculum["modules"])
        assert s["session_count"] == session_total
        assert s["project_count"] == project_total

    def test_each_module_has_sessions_projects_keys(self, curriculum):
        for m in curriculum["modules"]:
            assert "sessions" in m and isinstance(m["sessions"], list), f"module {m.get('title')} missing sessions"
            assert "projects" in m and isinstance(m["projects"], list), f"module {m.get('title')} missing projects"
            assert "title" in m and m["title"]

    def test_first_module_has_sessions(self, curriculum):
        first = curriculum["modules"][0]
        assert len(first["sessions"]) > 0
        s0 = first["sessions"][0]
        for k in ("id", "title", "order_index", "estimated_minutes", "has_video"):
            assert k in s0

    def test_every_capstone_has_title_and_tasks_raw(self, curriculum):
        assert len(curriculum["capstones"]) == 3
        for c in curriculum["capstones"]:
            assert c.get("title"), "capstone missing title"
            assert c.get("tasks_raw"), f"capstone {c.get('title')} missing tasks_raw"

    def test_generated_at_is_iso(self, curriculum):
        from datetime import datetime
        # will raise on bad format
        datetime.fromisoformat(curriculum["generated_at"].replace("Z", "+00:00"))
