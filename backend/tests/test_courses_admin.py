"""Backend tests for admin courses tab + course_id on free session endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to reading frontend env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

COURSE_ID = "5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c"
FREE_SESSION_IDS = [
    "18bfb490-269b-444a-935f-df2508304a71",
    "b5b21761-5aab-4b07-ac46-baeddea842dd",
]


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    supa_url = "https://yuadeybycbfqlkdpxbkv.supabase.co"
    anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30.0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"
    r = requests.post(
        f"{supa_url}/auth/v1/token?grant_type=password",
        headers={"apikey": anon, "Content-Type": "application/json"},
        json={"email": "info@valuevade.com", "password": "aa1aa2sam3"},
        timeout=30,
    )
    assert r.status_code == 200, f"supabase login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token")
    assert token
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------- Free session endpoints must expose course_id ----------
class TestFreeSessionCourseId:
    def test_free_session_single_has_course_id(self):
        for sid in FREE_SESSION_IDS:
            r = requests.get(f"{BASE_URL}/api/free-session/{sid}", timeout=30)
            assert r.status_code == 200, f"{sid}: {r.status_code}"
            body = r.json()
            assert body.get("course_id") == COURSE_ID, f"expected course_id for {sid}, got {body.get('course_id')}"

    def test_free_sessions_list_has_course_id(self):
        r = requests.get(f"{BASE_URL}/api/free-sessions", timeout=30)
        assert r.status_code == 200
        body = r.json()
        sessions = body if isinstance(body, list) else body.get("sessions") or body.get("data") or []
        assert len(sessions) >= 1
        for s in sessions:
            assert s.get("course_id") == COURSE_ID
        # verify the two expected ids still marked free
        ids = {s.get("id") or s.get("session_id") for s in sessions}
        for sid in FREE_SESSION_IDS:
            assert sid in ids, f"expected free-session id {sid} missing from list"


# ---------- Admin courses endpoints ----------
class TestAdminCourses:
    def test_admin_courses_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/courses", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        courses = body if isinstance(body, list) else body.get("courses") or body.get("data") or []
        assert len(courses) >= 1
        ids = {c.get("id") or c.get("path_id") for c in courses}
        assert COURSE_ID in ids

    def test_admin_preview_sessions(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/admin/courses/{COURSE_ID}/preview-sessions", timeout=30
        )
        assert r.status_code == 200, r.text
        body = r.json()
        sessions = body if isinstance(body, list) else body.get("sessions") or body.get("data") or []
        assert len(sessions) > 50, f"expected many sessions, got {len(sessions)}"
        sample = sessions[0]
        for key in ("is_preview_session", "is_free_session", "module_title"):
            assert key in sample, f"missing {key} in preview-sessions row: {list(sample.keys())}"
        # both free-trial ids must remain is_free_session=true
        free_ids = {s.get("id") or s.get("session_id") for s in sessions if s.get("is_free_session")}
        for sid in FREE_SESSION_IDS:
            assert sid in free_ids, f"session {sid} is not is_free_session=true"

    def test_admin_course_title_patch_and_revert(self, admin_session):
        # fetch current title
        r = admin_session.get(f"{BASE_URL}/api/admin/courses", timeout=30)
        courses = r.json() if isinstance(r.json(), list) else r.json().get("courses") or []
        original = None
        for c in courses:
            if (c.get("id") or c.get("path_id")) == COURSE_ID:
                original = c.get("title") or c.get("name")
                break
        assert original, "could not find original title"
        new_title = original + " (TEST)"
        r2 = admin_session.patch(
            f"{BASE_URL}/api/admin/courses/{COURSE_ID}",
            json={"title": new_title},
            timeout=30,
        )
        assert r2.status_code in (200, 204), r2.text
        # verify
        r3 = admin_session.get(f"{BASE_URL}/api/admin/courses", timeout=30)
        cs = r3.json() if isinstance(r3.json(), list) else r3.json().get("courses") or []
        titles = {(c.get("id") or c.get("path_id")): (c.get("title") or c.get("name")) for c in cs}
        assert titles.get(COURSE_ID) == new_title
        # revert
        r4 = admin_session.patch(
            f"{BASE_URL}/api/admin/courses/{COURSE_ID}",
            json={"title": original},
            timeout=30,
        )
        assert r4.status_code in (200, 204)
