"""
Iteration 92 — verify /api/admin/courses graceful fallback + photo upload
returns a clean 503 with migration hint when the new master_paths columns
(image_url/category/is_coming_soon) don't exist yet.
"""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fintech-mvp-38.preview.emergentagent.com").rstrip("/")


def _load_env():
    for line in open("/app/frontend/.env").read().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k, v)
    for line in open("/app/backend/.env").read().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k, v)


_load_env()


@pytest.fixture(scope="module")
def admin_token():
    url = os.environ.get("REACT_APP_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    anon = os.environ.get("REACT_APP_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    if not url or not anon:
        pytest.skip("Supabase env not configured")
    try:
        r = requests.post(
            f"{url}/auth/v1/token?grant_type=password",
            headers={"apikey": anon, "Content-Type": "application/json"},
            json={"email": "info@valuevade.com", "password": "VV-Admin#2026-Sec"},
            timeout=15,
        )
        if r.status_code != 200:
            pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
        return r.json()["access_token"]
    except Exception as e:
        pytest.skip(f"Admin login failed: {e}")


def test_public_catalog_returns_at_least_one_course():
    r = requests.get(f"{BASE_URL}/api/courses/catalog", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "paths" in data
    assert isinstance(data["paths"], list)
    print(f"catalog paths count: {len(data['paths'])}")


def test_admin_courses_list_ok(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/admin/courses",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200, f"{r.status_code}: {r.text}"
    j = r.json()
    assert "courses" in j
    assert isinstance(j["courses"], list)
    assert len(j["courses"]) >= 1
    for c in j["courses"]:
        assert "id" in c and "title" in c
    # media_ready flag present
    assert "media_ready" in j
    print(f"admin courses count: {len(j['courses'])}, media_ready={j['media_ready']}")
    if not j["media_ready"]:
        assert "hint" in j and "0046_courses_media.sql" in j["hint"]


def test_admin_courses_photo_upload_returns_clean_error_when_migration_pending(admin_token):
    # Fetch a real course id
    r = requests.get(
        f"{BASE_URL}/api/admin/courses",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    courses = r.json().get("courses", [])
    if not courses:
        pytest.skip("no courses in DB")
    cid = courses[0]["id"]
    media_ready = r.json().get("media_ready")

    # Fake tiny valid PNG (>=200 bytes)
    png_header = b"\x89PNG\r\n\x1a\n" + b"\x00" * 300
    files = {"file": ("cover.png", io.BytesIO(png_header), "image/png")}
    r2 = requests.post(
        f"{BASE_URL}/api/admin/courses/{cid}/photo",
        files=files,
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=60,
    )
    # If migration not run, expect a CLEAN 503 with migration hint text
    if not media_ready:
        assert r2.status_code == 503, f"expected 503, got {r2.status_code}: {r2.text}"
        detail = r2.json().get("detail", "")
        assert "0046_courses_media.sql" in detail
        print(f"clean 503 returned as expected: {detail[:120]}")
    else:
        # migration ran → should succeed or return 502 storage upload failed
        assert r2.status_code in (200, 502), r2.text
        print(f"upload result status={r2.status_code}")


def test_admin_courses_no_500_error(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/admin/courses",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code != 500, f"got 500: {r.text}"
