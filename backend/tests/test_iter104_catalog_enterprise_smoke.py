"""Iteration 104: public catalog + enterprise config smoke checks.

Focused regression for navigation-backed APIs used by new student/enterprise
course and AI-agent surfaces.
"""

import os
from pathlib import Path

import requests


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
BASE_URL = FRONTEND_ENV["REACT_APP_BACKEND_URL"].rstrip("/")


def test_courses_catalog_200_and_shape():
    response = requests.get(f"{BASE_URL}/api/courses/catalog", timeout=25)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data.get("paths"), list)
    assert isinstance(data.get("module_counts"), dict)
    assert isinstance(data.get("session_counts"), dict)


def test_courses_catalog_contains_expected_published_courses():
    response = requests.get(f"{BASE_URL}/api/courses/catalog", timeout=25)
    assert response.status_code == 200
    data = response.json()
    paths = data["paths"]

    # Regression contract for this release: 6 real published courses surfaced.
    assert len(paths) >= 6

    ids = {p.get("id") for p in paths}
    assert "5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c" in ids  # live student detail
    assert "ceccacd7-51aa-42a7-9de4-c89c23757f16" in ids  # coming soon example


def test_enterprise_config_200_with_pricing():
    response = requests.get(f"{BASE_URL}/api/enterprise/config", timeout=25)
    assert response.status_code == 200
    data = response.json()
    assert "pricing" in data
    assert "currency" in data["pricing"]
    assert data["pricing"]["currency"] == "INR"
    assert isinstance(data["pricing"].get("slabs"), list)


def test_resources_catalog_200():
    response = requests.get(f"{BASE_URL}/api/resources", timeout=25)
    assert response.status_code == 200
    data = response.json()
    # Keep assertion flexible for setup states, but endpoint must stay healthy.
    assert isinstance(data, (list, dict))
