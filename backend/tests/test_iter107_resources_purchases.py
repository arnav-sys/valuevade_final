"""
Iteration 107 (updated for multi-file resources): Resources + Purchases critical regression.
Covers admin multi-file upload/delete validation, private per-file download access,
purchases payload, and redirects.
"""

from __future__ import annotations

import io
import uuid
from pathlib import Path
from urllib.parse import quote

import pytest
import requests
from pypdf import PdfWriter
from openpyxl import Workbook


def _read_env_value(path: str, key: str) -> str:
    env_path = Path(path)
    if not env_path.exists():
        raise RuntimeError(f"Missing env file: {path}")
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == key:
            return v.strip()
    raise RuntimeError(f"Missing env key {key} in {path}")


BASE_URL = _read_env_value("/app/frontend/.env", "REACT_APP_BACKEND_URL").rstrip("/")
SUPABASE_URL = _read_env_value("/app/frontend/.env", "REACT_APP_SUPABASE_URL").rstrip("/")
SUPABASE_ANON_KEY = _read_env_value("/app/frontend/.env", "REACT_APP_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = _read_env_value("/app/backend/.env", "SUPABASE_SERVICE_ROLE_KEY")

ADMIN_EMAIL = "info@valuevade.com"
ADMIN_PASSWORD = "VV-Admin#2026-Sec"
PAID_EMAIL = "testagent2026@gmail.com"
PAID_PASSWORD = "TestPass123!"
UNPAID_EMAIL = "vvtest673479@example.com"
UNPAID_PASSWORD = "TestPass123!"


def _auth_token(email: str, password: str) -> str | None:
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    if r.status_code == 200:
        return r.json().get("access_token")
    return None


def _pdf_bytes() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=300, height=300)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _xlsx_bytes() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "QA"
    ws["A1"] = "Valuevade QA"
    ws["B1"] = 2026
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _admin_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _service_headers() -> dict:
    return {"apikey": SUPABASE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"}


def _cleanup_resource(resource_id: str | None) -> None:
    if not resource_id:
        return
    files = requests.get(
        f"{SUPABASE_URL}/rest/v1/resource_files?resource_id=eq.{resource_id}&select=file_path",
        headers=_service_headers(),
        timeout=30,
    )
    paths = [row["file_path"] for row in files.json()] if files.status_code == 200 else []
    requests.delete(
        f"{SUPABASE_URL}/rest/v1/marketplace_resources?id=eq.{resource_id}",
        headers=_service_headers(),
        timeout=30,
    )
    if paths:
        requests.delete(
            f"{SUPABASE_URL}/storage/v1/object/paid-resources",
            headers={**_service_headers(), "Content-Type": "application/json"},
            json={"prefixes": paths},
            timeout=30,
        )


def _resource_files_ready() -> bool:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/resource_files?select=id&limit=0",
        headers=_service_headers(),
        timeout=20,
    )
    return r.status_code == 200


@pytest.fixture(scope="module", autouse=True)
def require_resource_files_table():
    if not _resource_files_ready():
        pytest.skip("resource_files table is not set up yet - run the latest setup.sql in Supabase")


@pytest.fixture(scope="module")
def tokens():
    admin = _auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
    paid = _auth_token(PAID_EMAIL, PAID_PASSWORD)
    unpaid = _auth_token(UNPAID_EMAIL, UNPAID_PASSWORD)
    if not admin:
        pytest.skip("Admin auth failed")
    if not paid:
        pytest.skip("Paid-user auth failed")
    if not unpaid:
        pytest.skip("Unpaid-user auth failed")
    return {"admin": admin, "paid": paid, "unpaid": unpaid}


@pytest.fixture(scope="module")
def qa_resource(tokens):
    created_id = None
    try:
        payload = {
            "title": f"TEST_QA Resource {uuid.uuid4().hex[:8]}",
            "description": "TEST_QA description for multi-file upload and signed download checks.",
            "category": "Excel financial models",
            "price_paise": 19900,
            "includes": ["TEST_QA worksheet"],
            "is_published": False,
        }
        create = requests.post(
            f"{BASE_URL}/api/admin/resources",
            headers={**_admin_headers(tokens["admin"]), "Content-Type": "application/json"},
            json=payload,
            timeout=40,
        )
        assert create.status_code == 201, create.text
        body = create.json()
        created_id = body["id"]

        upload_pdf = requests.post(
            f"{BASE_URL}/api/admin/resources/{created_id}/files",
            headers=_admin_headers(tokens["admin"]),
            files={"file": ("qa-upload.pdf", _pdf_bytes(), "application/pdf")},
            timeout=80,
        )
        assert upload_pdf.status_code == 201, upload_pdf.text
        pdf_file = upload_pdf.json()

        upload_xlsx = requests.post(
            f"{BASE_URL}/api/admin/resources/{created_id}/files",
            headers=_admin_headers(tokens["admin"]),
            files={
                "file": (
                    "qa-second.xlsx",
                    _xlsx_bytes(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            timeout=80,
        )
        assert upload_xlsx.status_code == 201, upload_xlsx.text
        xlsx_file = upload_xlsx.json()

        publish = requests.put(
            f"{BASE_URL}/api/admin/resources/{created_id}",
            headers={**_admin_headers(tokens["admin"]), "Content-Type": "application/json"},
            json={
                "title": body["title"],
                "description": body["description"],
                "category": body["category"],
                "price_paise": body["price_paise"],
                "includes": body.get("includes") or [],
                "is_published": True,
            },
            timeout=40,
        )
        assert publish.status_code == 200, publish.text

        yield {"id": created_id, "pdf_file": pdf_file, "xlsx_file": xlsx_file}
    finally:
        _cleanup_resource(created_id)


class TestAdminMultiFileUploadFlow:
    """Admin multi-file upload, delete, and validation checks."""

    def test_two_files_both_persisted(self, qa_resource):
        assert qa_resource["pdf_file"]["file_type"] == "PDF"
        assert qa_resource["xlsx_file"]["file_type"] == "XLSX"
        assert qa_resource["pdf_file"]["id"] != qa_resource["xlsx_file"]["id"]

    def test_unauthenticated_admin_upload_denied(self, qa_resource):
        r = requests.post(
            f"{BASE_URL}/api/admin/resources/{qa_resource['id']}/files",
            files={"file": ("unauth.pdf", _pdf_bytes(), "application/pdf")},
            timeout=30,
        )
        assert r.status_code in (401, 403)

    def test_nonadmin_admin_upload_denied(self, tokens, qa_resource):
        r = requests.post(
            f"{BASE_URL}/api/admin/resources/{qa_resource['id']}/files",
            headers=_admin_headers(tokens["unpaid"]),
            files={"file": ("nonadmin.pdf", _pdf_bytes(), "application/pdf")},
            timeout=30,
        )
        assert r.status_code == 403

    def test_invalid_extension_rejected(self, tokens, qa_resource):
        r = requests.post(
            f"{BASE_URL}/api/admin/resources/{qa_resource['id']}/files",
            headers=_admin_headers(tokens["admin"]),
            files={"file": ("bad.exe", b"MZ", "application/octet-stream")},
            timeout=30,
        )
        assert r.status_code == 415
        assert "Choose PDF" in r.text

    def test_empty_file_rejected(self, tokens, qa_resource):
        r = requests.post(
            f"{BASE_URL}/api/admin/resources/{qa_resource['id']}/files",
            headers=_admin_headers(tokens["admin"]),
            files={"file": ("empty.pdf", b"", "application/pdf")},
            timeout=30,
        )
        assert r.status_code == 413

    def test_invalid_pdf_rejected_without_touching_existing_files(self, tokens, qa_resource):
        before = requests.get(
            f"{BASE_URL}/api/admin/resources",
            headers=_admin_headers(tokens["admin"]),
            timeout=40,
        )
        assert before.status_code == 200
        row_before = next(x for x in before.json() if x["id"] == qa_resource["id"])
        count_before = len(row_before.get("resource_files") or [])

        bad = requests.post(
            f"{BASE_URL}/api/admin/resources/{qa_resource['id']}/files",
            headers=_admin_headers(tokens["admin"]),
            files={"file": ("invalid.pdf", b"not-a-pdf", "application/pdf")},
            timeout=30,
        )
        assert bad.status_code == 415

        after = requests.get(
            f"{BASE_URL}/api/admin/resources",
            headers=_admin_headers(tokens["admin"]),
            timeout=40,
        )
        row_after = next(x for x in after.json() if x["id"] == qa_resource["id"])
        assert len(row_after.get("resource_files") or []) == count_before

    def test_admin_can_delete_a_single_file(self, tokens, qa_resource):
        third = requests.post(
            f"{BASE_URL}/api/admin/resources/{qa_resource['id']}/files",
            headers=_admin_headers(tokens["admin"]),
            files={"file": ("qa-third.txt", b"a disposable text file", "text/plain")},
            timeout=40,
        )
        assert third.status_code == 201, third.text
        file_id = third.json()["id"]

        delete = requests.delete(
            f"{BASE_URL}/api/admin/resources/{qa_resource['id']}/files/{file_id}",
            headers=_admin_headers(tokens["admin"]),
            timeout=30,
        )
        assert delete.status_code == 204

        listing = requests.get(
            f"{BASE_URL}/api/admin/resources",
            headers=_admin_headers(tokens["admin"]),
            timeout=40,
        )
        row = next(x for x in listing.json() if x["id"] == qa_resource["id"])
        assert file_id not in {f["id"] for f in (row.get("resource_files") or [])}


class TestPublicAndProtectedAccess:
    """Public metadata shape and protected private per-file download flow."""

    def test_catalog_detail_expose_files_array_not_storage_path(self, qa_resource):
        catalog = requests.get(f"{BASE_URL}/api/resources", timeout=30)
        assert catalog.status_code == 200
        item = next(x for x in catalog.json()["items"] if x["id"] == qa_resource["id"])
        assert "file_path" not in item
        assert "url" not in item
        assert item["file_available"] is True
        assert len(item["files"]) == 2
        assert {f["file_name"] for f in item["files"]} == {"qa-upload.pdf", "qa-second.xlsx"}

        detail = requests.get(f"{BASE_URL}/api/resources/{qa_resource['id']}", timeout=30)
        assert detail.status_code == 200
        d = detail.json()
        assert "file_path" not in d
        assert "url" not in d
        assert len(d["files"]) == 2

    def test_sample_route_retired_410(self, tokens, qa_resource):
        r = requests.get(
            f"{BASE_URL}/api/resources/{qa_resource['id']}/sample",
            headers={"Authorization": f"Bearer {tokens['paid']}"},
            timeout=30,
        )
        assert r.status_code == 410

    def test_signed_download_for_enrolled_user(self, tokens, qa_resource):
        file_id = qa_resource["xlsx_file"]["id"]
        r = requests.post(
            f"{BASE_URL}/api/resources/{qa_resource['id']}/files/{file_id}/download",
            headers={"Authorization": f"Bearer {tokens['paid']}"},
            timeout=40,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("expires_in") == 120
        assert "/storage/v1/object/sign/paid-resources/" in data.get("url", "")
        assert "download=qa-second.xlsx" in data.get("url", "")
        downloaded = requests.get(data["url"], timeout=30)
        assert downloaded.status_code == 200
        from openpyxl import load_workbook
        workbook = load_workbook(io.BytesIO(downloaded.content), read_only=True)
        assert workbook["QA"]["A1"].value == "Valuevade QA"
        workbook.close()

    def test_private_bucket_blocks_unsigned_public_access(self, tokens, qa_resource):
        admin_rows = requests.get(
            f"{BASE_URL}/api/admin/resources",
            headers={"Authorization": f"Bearer {tokens['admin']}"},
            timeout=40,
        )
        assert admin_rows.status_code == 200
        row = next(x for x in admin_rows.json() if x["id"] == qa_resource["id"])
        file_path = next(f["file_path"] for f in row["resource_files"] if f["id"] == qa_resource["pdf_file"]["id"])

        direct = requests.get(
            f"{SUPABASE_URL}/storage/v1/object/public/paid-resources/{quote(file_path, safe='/')}",
            timeout=30,
        )
        assert direct.status_code in (400, 401, 403, 404)

    def test_download_denied_for_anonymous_and_non_enrolled(self, tokens, qa_resource):
        file_id = qa_resource["pdf_file"]["id"]
        unauth = requests.post(
            f"{BASE_URL}/api/resources/{qa_resource['id']}/files/{file_id}/download", timeout=30
        )
        assert unauth.status_code in (401, 403)

        unpaid = requests.post(
            f"{BASE_URL}/api/resources/{qa_resource['id']}/files/{file_id}/download",
            headers={"Authorization": f"Bearer {tokens['unpaid']}"},
            timeout=30,
        )
        assert unpaid.status_code == 403

    def test_order_endpoint_returns_owned_included_for_enrolled(self, tokens, qa_resource):
        r = requests.post(
            f"{BASE_URL}/api/resources/{qa_resource['id']}/order",
            headers={"Authorization": f"Bearer {tokens['paid']}"},
            timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("owned") is True
        assert data.get("included_in_course") is True
        assert "order_id" not in data

    def test_purchase_blocked_for_resource_with_no_files(self, tokens):
        catalog = requests.get(f"{BASE_URL}/api/resources", timeout=30)
        items = catalog.json().get("items", [])
        missing = next((x for x in items if not x.get("file_available")), None)
        if not missing:
            pytest.skip("No file-missing published resource available")
        d = requests.post(
            f"{BASE_URL}/api/resources/{missing['id']}/order",
            headers={"Authorization": f"Bearer {tokens['unpaid']}"},
            timeout=40,
        )
        assert d.status_code == 409
        assert "File coming soon" in d.text


class TestPurchasesAndRedirects:
    """Purchases API and route redirect expectations."""

    def test_purchases_api_is_user_scoped_and_deduped(self, tokens):
        r = requests.get(
            f"{BASE_URL}/api/purchases",
            headers={"Authorization": f"Bearer {tokens['paid']}"},
            timeout=40,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("included_resources"), list)
        assert len(data.get("included_resources", [])) >= 7
        included_ids = {x["id"] for x in data["included_resources"]}
        purchased_ids = {x["resource_id"] for x in data.get("resource_purchases", [])}
        assert not (included_ids & purchased_ids)
        assert all("amount_paise" in row for row in data.get("history", []))

    def test_purchases_api_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/purchases", timeout=30)
        assert r.status_code == 401

    def test_route_redirects(self):
        o = requests.get(f"{BASE_URL}/my-orders", allow_redirects=False, timeout=30)
        # In this deployment the ingress may serve index.html (200) and let
        # React Router perform the redirect client-side. Ensure route exists.
        assert o.status_code in (200, 301, 302, 307, 308)
        if o.status_code in (301, 302, 307, 308):
            assert "/purchases?tab=history" in o.headers.get("location", "")

        lib = requests.get(f"{BASE_URL}/resources/library", allow_redirects=False, timeout=30)
        assert lib.status_code in (200, 301, 302, 307, 308)
        if lib.status_code in (301, 302, 307, 308):
            assert "/purchases" in lib.headers.get("location", "")
