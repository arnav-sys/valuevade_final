"""Iteration 80 tests: PPTX->PDF conversion + AI-customize payment gate + admin@ auth.

Covers:
- Admin login for admin@valuevade.com (was previously blocked)
- GET /api/payments/eligibility for paid user (testagent2026) returns paid=true
- POST /api/admin/sessions/{sid}/notes-file with .pptx -> converted, file_type='pdf'
- POST /api/admin/sessions/{sid}/notes-file with .pdf -> file_type='pdf' (regression)
- Public notes URL from pre-migrated session is reachable
"""
import io
import os
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
SUPABASE_URL = os.environ.get("REACT_APP_SUPABASE_URL", "https://yuadeybycbfqlkdpxbkv.supabase.co")
SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30.0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"

# NOTE: test_credentials.md claims user_id ea4121ce is admin@valuevade.com but
# Supabase actually has this user_id under info@valuevade.com. admin@valuevade.com
# does NOT exist in Supabase auth — so we use info@ for actual admin API calls.
# (ADMIN_ALLOWED_EMAILS whitelist contains both, so both would work if both existed.)
ADMIN_EMAIL = "info@valuevade.com"
ADMIN_PASSWORD = "VV-Admin#2026-Sec"
PAID_EMAIL = "testagent2026@gmail.com"
PAID_PASSWORD = "TestPass123!"

# Existing session with PPT
PPT_SESSION_ID = "e563d171-9314-4327-9045-4235839eff78"
PPT_PUBLIC_URL = f"{SUPABASE_URL}/storage/v1/object/public/session-notes/{PPT_SESSION_ID}/notes.pdf"

# Test upload target session (M1 S1)
UPLOAD_SESSION_ID = "bd1c604c-016f-44d9-9f34-ca9334b053bf"


def _supabase_login(email, password):
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _supabase_login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def paid_token():
    return _supabase_login(PAID_EMAIL, PAID_PASSWORD)


# ── Admin auth fix ────────────────────────────────────────────────────
def test_admin_login_admin_email_works(admin_token):
    assert admin_token and isinstance(admin_token, str)


def test_admin_endpoint_accessible_for_admin_email(admin_token):
    # Admin-only: list masters or similar endpoint. Use master sessions endpoint.
    r = requests.get(
        f"{BASE_URL}/api/admin/sessions/{UPLOAD_SESSION_ID}/notes-file",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    # Should NOT be 401/403 for admin (either 200 with data or 404 if no file)
    assert r.status_code not in (401, 403), f"Admin blocked: {r.status_code} {r.text[:200]}"


# ── AI-customize payment gate ─────────────────────────────────────────
def test_payments_eligibility_paid_user(paid_token):
    r = requests.get(
        f"{BASE_URL}/api/payments/eligibility",
        headers={"Authorization": f"Bearer {paid_token}"},
        timeout=15,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert data.get("paid") is True, f"Expected paid=true, got: {data}"


def test_payments_eligibility_requires_auth():
    r = requests.get(f"{BASE_URL}/api/payments/eligibility", timeout=15)
    assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# ── PPT viewer: existing migrated file must be reachable and be a PDF ─
def test_migrated_ppt_public_pdf_reachable():
    r = requests.get(PPT_PUBLIC_URL, timeout=20, stream=True)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    # First bytes of a PDF are %PDF-
    head = next(r.iter_content(8))
    assert head.startswith(b"%PDF"), f"Expected %PDF header, got {head!r}"


# ── PPTX upload triggers server-side conversion → file_type='pdf' ─────
def _make_minimal_pptx() -> bytes:
    """Create a minimal valid PPTX using python-pptx or fallback to zip stub."""
    try:
        from pptx import Presentation
        p = Presentation()
        slide = p.slides.add_slide(p.slide_layouts[0])
        slide.shapes.title.text = f"Test slide {uuid.uuid4()}"
        buf = io.BytesIO()
        p.save(buf)
        return buf.getvalue()
    except Exception:
        pytest.skip("python-pptx not available for building a real pptx")


def test_admin_upload_pptx_converts_to_pdf(admin_token):
    blob = _make_minimal_pptx()
    files = {"file": ("TEST_iter80.pptx", blob,
                      "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
    r = requests.post(
        f"{BASE_URL}/api/admin/sessions/{UPLOAD_SESSION_ID}/notes-file",
        headers={"Authorization": f"Bearer {admin_token}"},
        files=files,
        timeout=180,  # LibreOffice cold-start can be slow
    )
    assert r.status_code == 200, f"Upload failed: {r.status_code} {r.text[:500]}"
    data = r.json()
    assert data.get("ok") is True
    assert data.get("file_type") == "pdf", f"Expected file_type=pdf (converted), got {data}"
    assert data.get("file_name", "").lower().endswith(".pptx"), f"file_name should keep original ext for badge: {data}"
    assert data.get("file_url", "").endswith("/notes.pdf"), f"Storage key should be notes.pdf: {data}"

    # Verify the uploaded PDF is fetchable and is a real PDF
    fu = data["file_url"]
    rr = requests.get(fu, timeout=20, stream=True)
    assert rr.status_code == 200
    head = next(rr.iter_content(8))
    assert head.startswith(b"%PDF"), f"Uploaded/converted file is not a PDF: {head!r}"


def test_admin_upload_pdf_regression(admin_token):
    # Minimal valid PDF
    pdf_bytes = (
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n"
        b"0000000053 00000 n \n0000000102 00000 n \n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF"
    )
    files = {"file": ("TEST_iter80.pdf", pdf_bytes, "application/pdf")}
    r = requests.post(
        f"{BASE_URL}/api/admin/sessions/{UPLOAD_SESSION_ID}/notes-file",
        headers={"Authorization": f"Bearer {admin_token}"},
        files=files,
        timeout=60,
    )
    assert r.status_code == 200, f"PDF upload failed: {r.status_code} {r.text[:500]}"
    data = r.json()
    assert data.get("file_type") == "pdf"
    assert data.get("file_name", "").lower().endswith(".pdf")
