"""
Tests for guest/free-session endpoints and admin flags endpoint.
Migration 0042 (is_preview_session, is_free_session) may NOT be applied yet;
endpoints should return empty arrays or 404s, not 500s.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGuestEndpoints:
    """No-auth public endpoints for free/preview sessions."""

    def test_free_sessions_no_crash(self):
        """GET /api/free-sessions returns 200 with sessions key (even if empty)."""
        r = requests.get(f"{BASE_URL}/api/free-sessions", timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "sessions" in data, "Response must have 'sessions' key"
        assert isinstance(data["sessions"], list), "'sessions' must be a list"

    def test_preview_sessions_no_crash(self):
        """GET /api/preview-sessions returns 200 with sessions key (even if empty)."""
        r = requests.get(f"{BASE_URL}/api/preview-sessions", timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "sessions" in data, "Response must have 'sessions' key"
        assert isinstance(data["sessions"], list), "'sessions' must be a list"

    def test_free_session_nonexistent_returns_404(self):
        """GET /api/free-session/{id} for non-existent ID returns 404."""
        r = requests.get(f"{BASE_URL}/api/free-session/00000000-0000-0000-0000-000000000000", timeout=10)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_free_session_notes_nonexistent_404(self):
        """GET /api/free-session/{id}/notes for non-existent ID returns 404."""
        r = requests.get(f"{BASE_URL}/api/free-session/00000000-0000-0000-0000-000000000000/notes", timeout=10)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_free_session_quiz_nonexistent_404(self):
        """GET /api/free-session/{id}/quiz for non-existent ID returns 404."""
        r = requests.get(f"{BASE_URL}/api/free-session/00000000-0000-0000-0000-000000000000/quiz", timeout=10)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_free_session_simulation_nonexistent_404(self):
        """GET /api/free-session/{id}/simulation for non-existent ID returns 404."""
        r = requests.get(f"{BASE_URL}/api/free-session/00000000-0000-0000-0000-000000000000/simulation", timeout=10)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


class TestAdminFlagsAuth:
    """Admin flags endpoint should require auth."""

    def test_patch_flags_without_auth_returns_401(self):
        """PATCH /api/admin/sessions/{id}/flags without auth returns 401."""
        r = requests.patch(
            f"{BASE_URL}/api/admin/sessions/00000000-0000-0000-0000-000000000000/flags",
            json={"is_preview_session": True},
            timeout=10
        )
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text}"
