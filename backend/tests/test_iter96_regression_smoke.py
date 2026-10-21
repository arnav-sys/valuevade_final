import os
import requests


BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


def test_api_root_health_message():
    """Public API root health payload"""
    response = requests.get(f"{BASE_URL}/api/", timeout=20)
    assert response.status_code == 200
    data = response.json()
    assert data.get("message") == "Valuevade API"


def test_payments_eligibility_requires_auth():
    """Payments eligibility gate auth enforcement"""
    response = requests.get(f"{BASE_URL}/api/payments/eligibility", timeout=20)
    assert response.status_code in (401, 403)
    data = response.json()
    assert isinstance(data, dict)
    assert any(k in data for k in ("detail", "message", "error"))


def test_mock_interview_eligible_requires_auth():
    """Mock interview eligibility auth enforcement"""
    response = requests.get(f"{BASE_URL}/api/mock-interview/eligible", timeout=20)
    assert response.status_code in (401, 403)
    data = response.json()
    assert isinstance(data, dict)
    assert any(k in data for k in ("detail", "message", "error"))


def test_mock_interview_result_requires_auth_even_for_invalid_uuid():
    """Mock interview results endpoint auth guard before resource lookup"""
    bad_id = "11111111-1111-1111-1111-111111111111"
    response = requests.get(f"{BASE_URL}/api/mock-interview/{bad_id}", timeout=20)
    assert response.status_code in (401, 403)
    data = response.json()
    assert isinstance(data, dict)
    assert any(k in data for k in ("detail", "message", "error"))
