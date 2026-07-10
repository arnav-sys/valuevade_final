"""Backend tests for the new TUS-proxy upload endpoints.

Endpoints under test:
  POST /api/admin/sessions/{sid}/tus-create-upload
  POST /api/admin/tus-patch-chunk
Regression:
  POST /api/admin/sessions/{sid}/video-url
"""
import io
import os
import time

import pytest
import requests

def _load_env(path):
    out = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    except Exception:
        pass
    return out


_FE_ENV = _load_env("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _FE_ENV.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
SUPABASE_URL = (os.environ.get("REACT_APP_SUPABASE_URL") or _FE_ENV.get("REACT_APP_SUPABASE_URL") or "https://yuadeybycbfqlkdpxbkv.supabase.co").rstrip("/")
_SUPABASE_ANON = os.environ.get("REACT_APP_SUPABASE_ANON_KEY") or _FE_ENV.get("REACT_APP_SUPABASE_ANON_KEY") or ""

ADMIN_EMAIL = "info@valuevade.com"
ADMIN_PASSWORD = "aa1aa2sam3"

# Session used for destructive tests (per review request note). Restored after.
TEST_SESSION_ID = "bd1c604c-016f-44d9-9f34-ca9334b053bf"


# ─────────── auth helpers ───────────
def _supabase_login():
    """Login using Supabase gotrue directly to obtain access token."""
    anon = _SUPABASE_ANON
    assert anon, "Supabase anon key not available"
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": anon, "Content-Type": "application/json"},
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    tok = _supabase_login()
    if not tok:
        pytest.skip("Could not obtain admin token")
    return tok


@pytest.fixture(scope="module")
def original_lecture_url(admin_token):
    """Snapshot lecture_url and restore after tests."""
    hdr = {"Authorization": f"Bearer {admin_token}"}
    # Grab via master_sessions via admin videos list
    r = requests.get(f"{BASE_URL}/api/admin/sessions/videos", headers=hdr, timeout=30)
    orig = None
    if r.status_code == 200:
        for mod in (r.json().get("modules") or []):
            for s in (mod.get("sessions") or []):
                if s.get("id") == TEST_SESSION_ID:
                    orig = s.get("lecture_url")
                    break
    yield orig
    # Teardown: restore
    if orig:
        try:
            requests.post(
                f"{BASE_URL}/api/admin/sessions/{TEST_SESSION_ID}/video-url",
                headers={**hdr, "Content-Type": "application/json"},
                json={"public_url": orig},
                timeout=30,
            )
        except Exception:
            pass


# ─────────── tus-create-upload ───────────
class TestTusCreateUpload:

    def test_unauthenticated_returns_401(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{TEST_SESSION_ID}/tus-create-upload",
            json={"upload_length": 1024, "content_type": "video/mp4"},
            timeout=30,
        )
        assert r.status_code in (401, 403), r.text[:200]

    def test_happy_path_returns_location(self, admin_token, original_lecture_url):
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{TEST_SESSION_ID}/tus-create-upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"upload_length": 1024, "content_type": "video/mp4"},
            timeout=60,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        j = r.json()
        assert "location" in j and j["location"].startswith(
            f"{SUPABASE_URL}/storage/v1/upload/resumable/"
        ), f"Bad location: {j.get('location')}"
        assert j.get("bucket") == "session-videos"
        assert "key" in j and j["key"]
        assert "public_url" in j and j["public_url"].startswith("http")
        assert "max_bytes" in j and isinstance(j["max_bytes"], int) and j["max_bytes"] > 0

    def test_invalid_session_returns_404(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/00000000-0000-0000-0000-000000000000/tus-create-upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"upload_length": 1024, "content_type": "video/mp4"},
            timeout=30,
        )
        assert r.status_code == 404, r.text[:200]

    def test_negative_upload_length_returns_422(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{TEST_SESSION_ID}/tus-create-upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"upload_length": -1, "content_type": "video/mp4"},
            timeout=30,
        )
        assert r.status_code == 422, r.text[:200]

    def test_huge_upload_length_returns_422(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{TEST_SESSION_ID}/tus-create-upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"upload_length": 100 * 1024 * 1024 * 1024, "content_type": "video/mp4"},  # 100 GB
            timeout=30,
        )
        assert r.status_code == 422, r.text[:200]


# ─────────── tus-patch-chunk ───────────
class TestTusPatchChunk:

    def test_unauthenticated_returns_401(self):
        files = {"chunk": ("chunk.bin", b"x" * 100, "application/offset+octet-stream")}
        data = {"location": f"{SUPABASE_URL}/storage/v1/upload/resumable/dummy",
                "offset": "0"}
        r = requests.post(
            f"{BASE_URL}/api/admin/tus-patch-chunk",
            data=data, files=files, timeout=30,
        )
        assert r.status_code in (401, 403), r.text[:200]

    def test_invalid_location_returns_400(self, admin_token):
        files = {"chunk": ("chunk.bin", b"x" * 100, "application/offset+octet-stream")}
        data = {"location": "https://evil.example.com/upload/resumable/abc", "offset": "0"}
        r = requests.post(
            f"{BASE_URL}/api/admin/tus-patch-chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            data=data, files=files, timeout=30,
        )
        assert r.status_code == 400, r.text[:200]
        assert "invalid tus location url" in r.text.lower()

    def test_full_5mb_upload(self, admin_token, original_lecture_url):
        """Happy path: create session for 5 MB, patch full chunk, verify offset."""
        size = 5 * 1024 * 1024  # 5 MB
        # 1. create
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{TEST_SESSION_ID}/tus-create-upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"upload_length": size, "content_type": "video/mp4"},
            timeout=60,
        )
        assert r.status_code == 200, r.text[:200]
        loc = r.json()["location"]
        public_url = r.json()["public_url"]

        # 2. patch full 5 MB in one chunk
        payload = b"A" * size
        files = {"chunk": ("chunk.bin", payload, "application/offset+octet-stream")}
        data = {"location": loc, "offset": "0"}
        r2 = requests.post(
            f"{BASE_URL}/api/admin/tus-patch-chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            data=data, files=files, timeout=180,
        )
        assert r2.status_code == 200, f"{r2.status_code}: {r2.text[:300]}"
        j = r2.json()
        assert j["upload_offset"] == size, f"Expected {size}, got {j['upload_offset']}"

        # 3. HEAD the public URL to confirm object exists (may take 1-2s)
        time.sleep(2.0)
        head = requests.head(public_url, timeout=30, allow_redirects=True)
        assert head.status_code == 200, f"HEAD {public_url} → {head.status_code}"
        cl = int(head.headers.get("content-length", "0"))
        assert cl == size, f"Expected content-length {size}, got {cl}"

    def test_multi_chunk_12mb_upload(self, admin_token, original_lecture_url):
        """12 MB in 2 chunks (8 MB + 4 MB) — validates offset accumulation."""
        size = 12 * 1024 * 1024
        chunk_size = 8 * 1024 * 1024
        # create
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{TEST_SESSION_ID}/tus-create-upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"upload_length": size, "content_type": "video/mp4"},
            timeout=60,
        )
        assert r.status_code == 200, r.text[:300]
        loc = r.json()["location"]
        public_url = r.json()["public_url"]

        # chunk 1: 0..8 MB
        c1 = b"B" * chunk_size
        files = {"chunk": ("chunk.bin", c1, "application/offset+octet-stream")}
        data = {"location": loc, "offset": "0"}
        r1 = requests.post(
            f"{BASE_URL}/api/admin/tus-patch-chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            data=data, files=files, timeout=180,
        )
        assert r1.status_code == 200, r1.text[:300]
        assert r1.json()["upload_offset"] == chunk_size

        # chunk 2: 8..12 MB
        remaining = size - chunk_size
        c2 = b"C" * remaining
        files = {"chunk": ("chunk.bin", c2, "application/offset+octet-stream")}
        data = {"location": loc, "offset": str(chunk_size)}
        r2 = requests.post(
            f"{BASE_URL}/api/admin/tus-patch-chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            data=data, files=files, timeout=180,
        )
        assert r2.status_code == 200, r2.text[:300]
        assert r2.json()["upload_offset"] == size

        # HEAD verification
        time.sleep(2.0)
        head = requests.head(public_url, timeout=30, allow_redirects=True)
        assert head.status_code == 200
        cl = int(head.headers.get("content-length", "0"))
        assert cl == size, f"Expected content-length {size}, got {cl}"

    def test_chunk_past_eof_bubbles_up_as_502(self, admin_token, original_lecture_url):
        """Sending a chunk past end-of-file → Supabase 4xx → backend returns 502."""
        size = 1024
        # create
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{TEST_SESSION_ID}/tus-create-upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"upload_length": size, "content_type": "video/mp4"},
            timeout=60,
        )
        assert r.status_code == 200
        loc = r.json()["location"]

        # complete
        payload = b"D" * size
        r1 = requests.post(
            f"{BASE_URL}/api/admin/tus-patch-chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            data={"location": loc, "offset": "0"},
            files={"chunk": ("chunk.bin", payload, "application/offset+octet-stream")},
            timeout=60,
        )
        assert r1.status_code == 200

        # try to push another chunk
        r2 = requests.post(
            f"{BASE_URL}/api/admin/tus-patch-chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            data={"location": loc, "offset": str(size)},
            files={"chunk": ("chunk.bin", b"E" * 128, "application/offset+octet-stream")},
            timeout=60,
        )
        # Backend should surface as 502 or similar upstream error
        assert r2.status_code in (400, 404, 410, 502), f"expected upstream error, got {r2.status_code}: {r2.text[:200]}"


# ─────────── video-url regression ───────────
class TestVideoUrlRegression:

    def test_external_url_saves(self, admin_token, original_lecture_url):
        test_url = "https://example.com/test-external-video.mp4"
        r = requests.post(
            f"{BASE_URL}/api/admin/sessions/{TEST_SESSION_ID}/video-url",
            headers={"Authorization": f"Bearer {admin_token}",
                     "Content-Type": "application/json"},
            json={"public_url": test_url},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:200]
        j = r.json()
        assert j.get("lecture_url") == test_url

        # verify via admin sessions list
        r2 = requests.get(
            f"{BASE_URL}/api/admin/sessions/videos",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r2.status_code == 200
        found = None
        for mod in r2.json().get("modules", []):
            for s in mod.get("sessions", []):
                if s.get("id") == TEST_SESSION_ID:
                    found = s.get("lecture_url")
        assert found == test_url
