"""Iteration 102: Enterprise/resources expansion + M18 notes validations."""

import os
import uuid
import sys
from pathlib import Path
from io import BytesIO

import pytest
import requests
from fastapi import HTTPException
from starlette.datastructures import UploadFile

sys.path.insert(0, "/app/backend")


def _read_env(path: str) -> dict:
    values = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        values[key.strip()] = val.strip()
    return values


FRONTEND_ENV = _read_env("/app/frontend/.env")
BACKEND_ENV = _read_env("/app/backend/.env")
BASE_URL = FRONTEND_ENV["REACT_APP_BACKEND_URL"].rstrip("/")
SUPABASE_URL = FRONTEND_ENV["REACT_APP_SUPABASE_URL"].rstrip("/")
SUPABASE_ANON_KEY = FRONTEND_ENV["REACT_APP_SUPABASE_ANON_KEY"]

M18_MODULE_ID = "6928cd65-c7a8-4b75-bb01-ae7a8a12c547"
ALLOWED_CARD_TYPES = {
    "hook",
    "concept",
    "deep-dive",
    "example",
    "formula",
    "mistake",
    "summary",
    "study-card",
}


def _supabase_password_login(email: str, password: str) -> str:
    response = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=25,
    )
    if response.status_code >= 400:
        pytest.skip(f"Supabase login failed for {email}: {response.status_code}")
    data = response.json()
    token = data.get("access_token")
    if not token:
        pytest.skip(f"Supabase login returned no access_token for {email}")
    return token


@pytest.fixture(scope="session")
def user_token():
    # Existing regular paid student for auth checks.
    return _supabase_password_login("testagent2026@gmail.com", "TestPass123!")


@pytest.fixture(scope="session")
def admin_token():
    # Existing admin-panel account documented in /app/memory/test_credentials.md.
    return _supabase_password_login("info@valuevade.com", "VV-Admin#2026-Sec")


# --- Public + auth guard API checks for enterprise/resources ---


def test_enterprise_config_public_shape():
    response = requests.get(f"{BASE_URL}/api/enterprise/config", timeout=20)
    assert response.status_code == 200
    data = response.json()
    assert "pricing" in data and "enquiries_available" in data
    assert data["pricing"]["currency"] == "INR"
    assert isinstance(data["pricing"]["slabs"], list) and len(data["pricing"]["slabs"]) >= 1


def test_public_enterprise_enquiry_disabled_without_schema():
    payload = {
        "id": str(uuid.uuid4()),
        "name": "QA Enterprise",
        "email": "qa.enterprise@example.com",
        "company": "Valuevade QA Org",
        "seats": 25,
        "interest": "both",
        "requirements": "Need AI training and workflow automation pilots for our finance team.",
        "consent": True,
        "website": "",
    }
    response = requests.post(f"{BASE_URL}/api/enterprise/enquiries", json=payload, timeout=20)
    # Known setup limitation for this iteration: 0048 not applied.
    assert response.status_code == 503
    assert "pending" in response.json().get("detail", "").lower()


def test_public_resources_catalog_disabled_without_schema():
    response = requests.get(f"{BASE_URL}/api/resources", timeout=20)
    assert response.status_code == 503
    assert "pending" in response.json().get("detail", "").lower()


@pytest.mark.parametrize(
    "path,method",
    [
        ("/api/admin/enterprise/status", "GET"),
        ("/api/admin/enterprise/setup.sql", "GET"),
        ("/api/admin/enterprise/pricing", "PUT"),
        ("/api/admin/enterprise/leads", "GET"),
        ("/api/admin/resources", "GET"),
        ("/api/admin/resources", "POST"),
    ],
)
def test_admin_endpoints_reject_public(path, method):
    kwargs = {"timeout": 20}
    if method == "PUT":
        kwargs["json"] = {"sample": True, "currency": "INR", "slabs": [{"max_seats": 1000, "price_inr": 1000}]}
    if method == "POST":
        kwargs["json"] = {
            "title": "TEST_Resource",
            "description": "A test resource description text.",
            "category": "AI prompt packs",
            "price_paise": 1000,
            "includes": ["one"],
            "is_published": False,
        }
    response = requests.request(method, f"{BASE_URL}{path}", **kwargs)
    assert response.status_code in (401, 403)


def test_regular_user_denied_admin_enterprise_and_resources(user_token):
    headers = {"Authorization": f"Bearer {user_token}"}
    for path in ("/api/admin/enterprise/status", "/api/admin/resources", "/api/admin/enterprise/leads"):
        response = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=20)
        assert response.status_code == 403, f"{path} should deny non-admin users"


def test_admin_setup_sql_download_and_status(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    status_response = requests.get(f"{BASE_URL}/api/admin/enterprise/status", headers=headers, timeout=20)
    assert status_response.status_code == 200
    status_data = status_response.json()
    assert "database_ready" in status_data and "email_configured" in status_data

    sql_response = requests.get(f"{BASE_URL}/api/admin/enterprise/setup.sql", headers=headers, timeout=20)
    assert sql_response.status_code == 200
    assert "create table if not exists public.enterprise_leads" in sql_response.text


def test_admin_pricing_roundtrip_and_invalid_validation(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    config_response = requests.get(f"{BASE_URL}/api/enterprise/config", timeout=20)
    assert config_response.status_code == 200
    current = config_response.json()["pricing"]

    # Persist the same payload (no business-data mutation).
    put_response = requests.put(f"{BASE_URL}/api/admin/enterprise/pricing", headers=headers, json=current, timeout=20)
    assert put_response.status_code == 200
    assert put_response.json()["slabs"] == current["slabs"]

    invalid = {"sample": True, "currency": "INR", "slabs": [{"max_seats": 200, "price_inr": 5000}]}
    invalid_response = requests.put(
        f"{BASE_URL}/api/admin/enterprise/pricing", headers=headers, json=invalid, timeout=20
    )
    assert invalid_response.status_code == 422


# --- Unit validations for resource/enterprise backend logic (mocked where needed) ---


def test_quote_price_boundaries():
    from enterprise_common import SAMPLE_PRICING, quote_price

    checks = [1, 10, 11, 50, 51, 200, 201, 1000]
    for seats in checks:
        quoted = quote_price(seats, SAMPLE_PRICING)
        assert quoted["seats"] == seats
        assert quoted["total_inr"] == seats * quoted["per_seat_inr"]
        assert quoted["currency"] == "INR"


@pytest.mark.anyio
async def test_upload_resource_rejects_invalid_extension():
    from resource_storage import upload_resource

    bad_file = UploadFile(filename="payload.exe", file=BytesIO(b"MZ-test"))
    with pytest.raises(HTTPException) as exc:
        await upload_resource("rid", bad_file)
    assert exc.value.status_code == 415


@pytest.mark.anyio
async def test_reconcile_mismatch_rejected(monkeypatch):
    from resource_payments import reconcile

    class _DummyPayment:
        def fetch(self, *_args, **_kwargs):
            return {}

    class _DummyRazor:
        payment = _DummyPayment()

    async def fake_gateway(fn, *args):
        return {"order_id": "order_wrong", "amount": 1, "currency": "INR", "status": "captured"}

    monkeypatch.setattr("resource_payments._razor", lambda: _DummyRazor())
    monkeypatch.setattr("resource_payments.gateway", fake_gateway)
    with pytest.raises(HTTPException) as exc:
        await reconcile({"id": "x", "razorpay_order_id": "order_abc", "amount_paise": 5000, "resource_id": "r1"}, "pay_1")
    assert exc.value.status_code == 400


@pytest.mark.anyio
async def test_reconcile_captured_patches_paid(monkeypatch):
    from resource_payments import reconcile

    class _DummyPayment:
        def fetch(self, *_args, **_kwargs):
            return {}

    class _DummyRazor:
        payment = _DummyPayment()

    calls = []

    async def fake_gateway(fn, *args):
        return {
            "order_id": "order_ok",
            "amount": 5000,
            "currency": "INR",
            "status": "captured",
            "amount_refunded": 0,
        }

    async def fake_rest(path, method="GET", data=None):
        calls.append((path, method, data))
        return []

    monkeypatch.setattr("resource_payments.gateway", fake_gateway)
    monkeypatch.setattr("resource_payments.rest", fake_rest)
    monkeypatch.setattr("resource_payments._razor", lambda: _DummyRazor())

    result = await reconcile(
        {"id": "ord-1", "razorpay_order_id": "order_ok", "amount_paise": 5000, "resource_id": "res-1"},
        "pay_ok",
    )
    assert result["paid"] is True
    assert any("status=eq.created" in p and m == "PATCH" for p, m, _ in calls)


def test_public_catalog_fields_do_not_expose_storage_path():
    from enterprise_common import PUBLIC_FIELDS

    assert "file_path" not in PUBLIC_FIELDS


# --- M18 read-only checks (no regeneration) ---


def test_m18_has_20_sessions_with_7_cards_each_and_nonempty_body():
    service_role = BACKEND_ENV.get("SUPABASE_SERVICE_ROLE_KEY")
    if not service_role:
        pytest.skip("SUPABASE_SERVICE_ROLE_KEY not present in backend .env")

    headers = {
        "apikey": service_role,
        "Authorization": f"Bearer {service_role}",
        "Content-Type": "application/json",
    }
    sessions = requests.get(
        f"{SUPABASE_URL}/rest/v1/master_sessions"
        f"?module_id=eq.{M18_MODULE_ID}&select=id,order_index,title&order=order_index",
        headers=headers,
        timeout=25,
    )
    assert sessions.status_code == 200
    session_rows = sessions.json()
    assert len(session_rows) == 20

    for row in session_rows:
        cards = requests.get(
            f"{SUPABASE_URL}/rest/v1/master_notes_cards?session_id=eq.{row['id']}&select=card_type,content,order_index&order=order_index",
            headers=headers,
            timeout=25,
        )
        assert cards.status_code == 200
        card_rows = cards.json()
        assert len(card_rows) == 7, f"Session {row['order_index']} does not have 7 cards"
        for card in card_rows:
            assert card["card_type"] in ALLOWED_CARD_TYPES
            body = (card.get("content") or {}).get("body_md", "")
            assert isinstance(body, str) and body.strip(), f"Empty body_md in session {row['order_index']}"
