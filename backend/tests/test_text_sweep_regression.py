"""Regression tests after em-dash text sweep (iter 87)."""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fintech-mvp-38.preview.emergentagent.com').rstrip('/')


def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200, r.text


def test_courses_catalog():
    r = requests.get(f"{BASE_URL}/api/courses/catalog", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "paths" in data
    assert isinstance(data["paths"], list)
    assert len(data["paths"]) >= 1
    # response must be JSON-serialisable (already parsed) — no crash
    p = data["paths"][0]
    assert "id" in p and "title" in p


def test_faculty_graceful():
    r = requests.get(f"{BASE_URL}/api/faculty", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "faculty" in d
    assert isinstance(d["faculty"], list)


def test_testimonials_graceful():
    r = requests.get(f"{BASE_URL}/api/testimonials", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "testimonials" in d
    assert isinstance(d["testimonials"], list)


def test_payments_eligibility_requires_auth():
    r = requests.get(f"{BASE_URL}/api/payments/eligibility", timeout=15)
    # unauthenticated request should fail auth-cleanly, not 500
    assert r.status_code in (401, 403), r.text


def test_faqs_endpoint():
    # covered by faqs.js file rewrite; endpoint should not 500
    r = requests.get(f"{BASE_URL}/api/faqs", timeout=15)
    assert r.status_code in (200, 404), r.text
