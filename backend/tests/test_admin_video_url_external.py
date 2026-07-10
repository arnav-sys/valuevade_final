"""
Backend tests — External Video URL fix (413 payload-too-large workaround).

Verifies:
  POST /api/admin/sessions/{sid}/video-url now accepts ANY https URL
  (previously required the URL to contain the 'session-videos' bucket path).

  This lets admins persist a video hosted on YouTube/Vimeo/Cloudflare Stream/
  Mux/BunnyCDN/direct-CDN as the session's lecture_url — the workaround for
  the Supabase Free-tier 50 MB storage cap.

  Also verifies:
    - Rejects invalid URLs (400).
    - Regression: still accepts bucket URLs.
    - GET /api/admin/sessions/videos reflects saved external URL.
    - Signed-URL endpoint now returns max_bytes=5GB (was 500MB).
"""
import os
import pytest
import requests

def _read_frontend_env(key: str) -> str:
    try:
        with open("/app/frontend/.env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return ""


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env("REACT_APP_BACKEND_URL")).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30."
    "0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"
)

ADMIN_EMAIL = "info@valuevade.com"
ADMIN_PASSWORD = "aa1aa2sam3"
# Session used in the review request
TEST_SESSION_ID = "955b2fd1-8b76-45d7-8ebe-2015572a77a1"


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def target_session(admin_token):
    """Prefer the review-request session if present; else pick any session
    from the videos listing. Capture original lecture_url so we can restore
    at the end of the module."""
    r = requests.get(
        f"{BASE_URL}/api/admin/sessions/videos",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 200, f"list failed: {r.text[:200]}"
    modules = r.json().get("modules") or []
    for m in modules:
        for s in (m.get("sessions") or []):
            if s["id"] == TEST_SESSION_ID:
                return {"session_id": s["id"], "prev_lecture_url": s.get("lecture_url")}
    # fallback: first session anywhere
    for m in modules:
        for s in (m.get("sessions") or []):
            return {"session_id": s["id"], "prev_lecture_url": s.get("lecture_url")}
    pytest.skip("no sessions available")


@pytest.fixture(scope="module", autouse=True)
def restore_after(admin_token, target_session):
    """Teardown: restore original lecture_url once all tests in the module run."""
    yield
    sid = target_session["session_id"]
    prev = target_session.get("prev_lecture_url")
    if prev:
        requests.post(
            f"{BASE_URL}/api/admin/sessions/{sid}/video-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"public_url": prev},
            timeout=30,
        )
    else:
        requests.delete(
            f"{BASE_URL}/api/admin/sessions/{sid}/video",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )


# ---------- External-URL accept (the bug fix) ----------
class TestExternalUrlAccept:
    def test_accepts_youtube_url(self, admin_token, target_session):
        sid = target_session["session_id"]
        url = "https://www.youtube.com/watch?v=abc123TEST"
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{sid}/video-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"public_url": url},
            timeout=30,
        )
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text[:400]}"
        j = r.json()
        assert j.get("ok") is True
        assert j.get("lecture_url") == url

        # Verify persistence via GET
        r2 = requests.get(
            f"{BASE_URL}/api/admin/sessions/videos",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r2.status_code == 200
        found = None
        for m in r2.json().get("modules", []):
            for s in (m.get("sessions") or []):
                if s["id"] == sid:
                    found = s
                    break
        assert found is not None, "test session not returned by /videos"
        assert found.get("lecture_url") == url, f"lecture_url not persisted: {found.get('lecture_url')}"
        # has_video is True for any non-null lecture_url
        assert found.get("has_video") is True

    def test_accepts_direct_cdn_url(self, admin_token, target_session):
        sid = target_session["session_id"]
        url = "https://cdn.example.com/lecture.mp4"
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{sid}/video-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"public_url": url},
            timeout=30,
        )
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text[:400]}"
        assert r.json().get("lecture_url") == url

    def test_accepts_vimeo_url(self, admin_token, target_session):
        sid = target_session["session_id"]
        url = "https://vimeo.com/123456789"
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{sid}/video-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"public_url": url},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json().get("lecture_url") == url

    def test_accepts_supabase_bucket_url_regression(self, admin_token, target_session):
        """Regression: a Supabase-bucket URL must still be accepted."""
        sid = target_session["session_id"]
        url = f"{SUPABASE_URL}/storage/v1/object/public/session-videos/m1/s1-1.mp4"
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{sid}/video-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"public_url": url},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json().get("lecture_url") == url


# ---------- URL validation (400 on invalid) ----------
class TestUrlValidation:
    def test_rejects_non_url(self, admin_token, target_session):
        sid = target_session["session_id"]
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{sid}/video-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"public_url": "not-a-url"},
            timeout=30,
        )
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:200]}"

    def test_rejects_empty_url(self, admin_token, target_session):
        sid = target_session["session_id"]
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{sid}/video-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"public_url": ""},
            timeout=30,
        )
        assert r.status_code == 400

    def test_rejects_ftp_url(self, admin_token, target_session):
        sid = target_session["session_id"]
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{sid}/video-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"public_url": "ftp://server/file.mp4"},
            timeout=30,
        )
        assert r.status_code == 400


# ---------- Signed-URL endpoint: max_bytes bumped to 5 GB ----------
class TestSignedUrlMaxBytes:
    def test_signed_url_returns_5gb_cap(self, admin_token, target_session):
        sid = target_session["session_id"]
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{sid}/video-signed-url",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"signed-url failed: {r.text[:200]}"
        data = r.json()
        assert data.get("max_bytes") == 5 * 1024 * 1024 * 1024, (
            f"max_bytes not 5GB: {data.get('max_bytes')}"
        )


# ---------- Auth guardrail (regression) ----------
class TestAuthRegression:
    def test_unauthenticated_video_url_returns_401(self, target_session):
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{target_session['session_id']}/video-url",
            json={"public_url": "https://example.com/x.mp4"},
            timeout=30,
        )
        assert r.status_code == 401, f"expected 401 got {r.status_code}"
