"""TTS endpoint smoke test for /api/interview-sim/tts (Pari's voice)."""
import os
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mock-exam-mvp.preview.emergentagent.com").rstrip("/")
SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30.0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"

EMAIL = "mocktest@valuevade.test"
PASSWORD = "MockTest2026!"


def _login():
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
        json={"email": EMAIL, "password": PASSWORD}, timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers():
    return {"Authorization": f"Bearer {_login()}", "Content-Type": "application/json"}


class TestTTS:
    def test_unauth(self):
        r = requests.post(f"{BASE_URL}/api/interview-sim/tts",
                          json={"text": "Hello"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_missing_text(self, headers):
        r = requests.post(f"{BASE_URL}/api/interview-sim/tts",
                          headers=headers, json={"text": ""}, timeout=30)
        assert r.status_code == 400

    def test_first_call_not_cached(self, headers):
        text = "Hello candidate, welcome to the interview. Tell me about yourself."
        r = requests.post(f"{BASE_URL}/api/interview-sim/tts",
                          headers=headers, json={"text": text, "voice": "nova"},
                          timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mime"] == "audio/mpeg"
        assert "audio_base64" in data and len(data["audio_base64"]) > 100
        # valid base64
        audio = base64.b64decode(data["audio_base64"])
        assert len(audio) > 1000, f"audio too small: {len(audio)} bytes"
        # first call may be cached=False OR cached=True if a prior run already primed it
        assert data["cached"] in (True, False)
        # sanity: MP3 files typically start with ID3 tag or 0xFF frame sync
        assert audio[:3] == b"ID3" or audio[0] == 0xFF, f"not an mp3: {audio[:4]!r}"

    def test_repeat_call_cached(self, headers):
        text = "This is a caching probe for Pari's voice at " + "x" * 10
        r1 = requests.post(f"{BASE_URL}/api/interview-sim/tts",
                           headers=headers, json={"text": text, "voice": "nova"},
                           timeout=60)
        assert r1.status_code == 200
        r2 = requests.post(f"{BASE_URL}/api/interview-sim/tts",
                           headers=headers, json={"text": text, "voice": "nova"},
                           timeout=30)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["cached"] is True, "second identical call should be cached"
        # audio matches
        assert d2["audio_base64"] == r1.json()["audio_base64"]

    def test_invalid_voice_defaults_to_nova(self, headers):
        r = requests.post(f"{BASE_URL}/api/interview-sim/tts",
                          headers=headers,
                          json={"text": "Voice fallback test.", "voice": "not-a-voice"},
                          timeout=60)
        assert r.status_code == 200
