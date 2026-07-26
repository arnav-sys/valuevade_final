"""
Backend tests — Admin direct-to-Supabase video upload architecture.
Covers:
  POST /api/admin/sessions/{sid}/video-signed-url  (admin only, 401/403/200)
  PUT  <supabase signed_url>                       (>2MB direct upload)
  POST /api/admin/sessions/{sid}/video-url         (persist public_url)
  GET  /api/admin/sessions/videos                  (verify has_video=True)
  Cleanup via DELETE /api/admin/sessions/{sid}/video
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://valuevade-mvp2.preview.emergentagent.com").rstrip("/")
SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30."
    "0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"
)

ADMIN_EMAIL = "info@valuevade.com"
ADMIN_PASSWORD = "aa1aa2sam3"
USER_EMAIL = "testagent2026@gmail.com"
USER_PASSWORD = "TestPass123!"


def _get_token(email: str, password: str) -> str:
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"Supabase login failed for {email}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _get_token(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def user_token():
    return _get_token(USER_EMAIL, USER_PASSWORD)


@pytest.fixture(scope="module")
def test_session(admin_token):
    """Pick an existing session from /admin/sessions/videos.
    Prefer one WITHOUT a current lecture_url so the cleanup nulls it back."""
    r = requests.get(
        f"{BASE_URL}/api/admin/sessions/videos",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 200, f"listing failed: {r.status_code} {r.text[:200]}"
    modules = r.json().get("modules") or []
    assert modules, "no modules returned"
    # Find first (module_number, session_id, order_index) with has_video=False
    for m in modules:
        module_number = m.get("module_number")
        for s in (m.get("sessions") or []):
            if not s.get("has_video"):
                return {
                    "session_id":   s["id"],
                    "module_number": module_number,
                    "order_index":  s.get("order_index"),
                    "prev_lecture_url": None,
                }
    # Fallback: first session with a video (we'll restore it)
    m = modules[0]
    s = (m.get("sessions") or [])[0]
    return {
        "session_id":       s["id"],
        "module_number":    m.get("module_number"),
        "order_index":      s.get("order_index"),
        "prev_lecture_url": s.get("lecture_url"),
    }


# ---------- Signed-URL endpoint ----------
class TestSignedUrlAuth:
    def test_unauthenticated_returns_401(self, test_session):
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{test_session['session_id']}/video-signed-url",
            timeout=30,
        )
        assert r.status_code == 401, f"expected 401 got {r.status_code}: {r.text[:200]}"

    def test_non_admin_returns_403(self, user_token, test_session):
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{test_session['session_id']}/video-signed-url",
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:200]}"

    def test_admin_returns_signed_url_shape(self, admin_token, test_session):
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{test_session['session_id']}/video-signed-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text[:200]}"
        data = r.json()
        # Shape validation
        for k in ("upload_url", "token", "key", "bucket", "public_url", "max_bytes"):
            assert k in data, f"missing '{k}' in {data}"
        assert data["bucket"] == "session-videos"
        assert data["max_bytes"] == 5 * 1024 * 1024 * 1024, f"max_bytes mismatch: {data['max_bytes']}"
        mn = test_session["module_number"]
        oi = test_session["order_index"]
        expected_key = f"m{mn}/s{mn}-{oi}.mp4"
        assert data["key"] == expected_key, f"key mismatch: {data['key']} vs {expected_key}"
        # upload_url starts with https://<supabase>/storage/v1/object/upload/sign/session-videos/mX/sX-Y.mp4?token=…
        assert data["upload_url"].startswith(
            f"{SUPABASE_URL}/storage/v1/object/upload/sign/session-videos/{expected_key}"
        ), f"upload_url shape wrong: {data['upload_url']}"
        assert "token=" in data["upload_url"]
        # public_url shape
        assert data["public_url"].startswith(
            f"{SUPABASE_URL}/storage/v1/object/public/session-videos/"
        ), f"public_url shape wrong: {data['public_url']}"
        assert data["public_url"].endswith(expected_key)


# ---------- video-url persist endpoint (auth) ----------
class TestVideoUrlAuth:
    def test_unauthenticated_returns_401(self, test_session):
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{test_session['session_id']}/video-url",
            json={"public_url": "https://example.com/x.mp4"},
            timeout=30,
        )
        assert r.status_code == 401

    def test_non_admin_returns_403(self, user_token, test_session):
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{test_session['session_id']}/video-url",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"public_url": "https://example.com/x.mp4"},
            timeout=30,
        )
        assert r.status_code == 403


# ---------- End-to-end: signed-url → direct PUT (>2MB) → persist ----------
class TestEndToEndDirectUpload:
    def test_direct_upload_and_persist(self, admin_token, test_session):
        sid = test_session["session_id"]
        # 1) Get signed URL
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{sid}/video-signed-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        signed = r.json()
        upload_url = signed["upload_url"]
        public_url = signed["public_url"]

        # 2) Direct PUT of a >2 MB blob (proves nginx 1MB cap is bypassed).
        blob = b"\x00\x01\x02\x03" * (700 * 1024)  # ~2.8 MB
        assert len(blob) > 2 * 1024 * 1024
        put = requests.put(
            upload_url,
            data=blob,
            headers={
                "Content-Type": "video/mp4",
                "x-upsert": "true",
            },
            timeout=120,
        )
        assert put.status_code == 200, f"direct PUT failed: {put.status_code} {put.text[:400]}"

        # 3) Persist public_url via FastAPI
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{sid}/video-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"public_url": public_url},
            timeout=30,
        )
        assert r.status_code == 200, f"video-url persist failed: {r.status_code} {r.text[:200]}"
        j = r.json()
        assert j.get("ok") is True
        assert j.get("lecture_url") == public_url

        # 4) Verify via GET /admin/sessions/videos
        r = requests.get(
            f"{BASE_URL}/api/admin/sessions/videos",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        found = False
        for m in r.json().get("modules", []):
            for s in m.get("sessions") or []:
                if s["id"] == sid:
                    found = True
                    assert s.get("has_video") is True, f"has_video not true: {s}"
                    assert s.get("lecture_url") == public_url
        assert found, "test session not found in listing"

        # 5) Accept external (non-bucket) URLs — this was previously rejected but
        # is now allowed so admins can attach large videos hosted on YouTube/Vimeo/
        # Cloudflare Stream/Mux/BunnyCDN when the file exceeds the Supabase Storage cap.
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{sid}/video-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"public_url": "https://example.com/not-in-bucket.mp4"},
            timeout=30,
        )
        assert r.status_code == 200, f"expected 200 got {r.status_code}"

        # 6) Cleanup — delete the video (nulls master_sessions.lecture_url)
        r = requests.delete(
            f"{BASE_URL}/api/admin/sessions/{sid}/video",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=60,
        )
        assert r.status_code == 200

        # 7) If the fixture recorded a prior lecture_url, restore it.
        prev = test_session.get("prev_lecture_url")
        if prev:
            requests.post(
                f"{BASE_URL}/api/admin/sessions/{sid}/video-url",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"public_url": prev},
                timeout=30,
            )
