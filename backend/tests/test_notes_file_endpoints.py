"""Tests for PDF/PPT notes-file endpoints: GET/POST/DELETE /api/admin/sessions/{session_id}/notes-file"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_ID = "bd1c604c-016f-44d9-9f34-ca9334b053bf"  # M1 S1 master_session


class TestNotesFileAuth:
    """Auth checks: all 3 endpoints must return 401 without Bearer token"""

    def test_get_notes_file_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/sessions/{SESSION_ID}/notes-file")
        assert r.status_code == 401, f"Expected 401 but got {r.status_code}: {r.text}"
        print(f"PASS GET no-auth: {r.status_code}")

    def test_post_notes_file_no_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/sessions/{SESSION_ID}/notes-file")
        assert r.status_code == 401, f"Expected 401 but got {r.status_code}: {r.text}"
        print(f"PASS POST no-auth: {r.status_code}")

    def test_delete_notes_file_no_auth(self):
        r = requests.delete(f"{BASE_URL}/api/admin/sessions/{SESSION_ID}/notes-file")
        assert r.status_code == 401, f"Expected 401 but got {r.status_code}: {r.text}"
        print(f"PASS DELETE no-auth: {r.status_code}")


class TestHealthEndpoint:
    def test_health_responds_200(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200, f"Expected 200 but got {r.status_code}: {r.text}"
        print(f"PASS /api/health: {r.status_code}")
