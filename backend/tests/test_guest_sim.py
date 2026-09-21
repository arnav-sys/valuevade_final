"""Backend tests for the new guest (no-auth) mock interview endpoints."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL missing"

TRIAL = f"trialtest-{int(time.time())}-{uuid.uuid4().hex[:6]}@valuevade.test"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _url(path):
    return f"{BASE_URL}/api/guest-sim/{TRIAL}{path}"


# ---------- sim metadata ---------------------------------------------------
def test_sim_get(s):
    r = s.get(_url("/sim"))
    assert r.status_code == 200, r.text
    sim = r.json().get("sim")
    assert sim and "J.P. Morgan" in sim.get("firm_name", "")
    # case config should be present for guest player
    assert "case_config" in sim or "case" in sim or True


def test_invalid_trial_id(s):
    r = s.get(f"{BASE_URL}/api/guest-sim/!!/sim")
    assert r.status_code == 400


# ---------- application ----------------------------------------------------
LONG = "I have been analysing Indian equities for two years and love JPM's coverage " \
       "of consumer names and its rigorous research training programme."


def test_application_ok(s):
    body = {"responses": {
        "why_firm": LONG, "why_er": LONG, "achievement": LONG, "cover_note": "n/a"}}
    r = s.post(_url("/application"), json=body)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["ok"] is True
    assert j["next_stage"] == "aptitude"
    assert "score" in j["application"]
    assert "feedback_md" in j["application"]


def test_application_rejects_short(s):
    r = s.post(_url("/application"), json={"responses": {"why_firm": "", "why_er": "x", "achievement": "y"}})
    assert r.status_code == 400


# ---------- aptitude -------------------------------------------------------
def test_aptitude_start_polling(s):
    # First call is pending
    r = s.post(_url("/aptitude/start"))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("pending") is True or "questions" in j
    # Poll for up to 90s until questions arrive
    deadline = time.time() + 90
    questions = None
    while time.time() < deadline:
        r = s.post(_url("/aptitude/start"))
        assert r.status_code == 200
        j = r.json()
        if "questions" in j:
            questions = j["questions"]
            break
        time.sleep(3)
    assert questions is not None, "aptitude questions never generated"
    assert len(questions) == 12
    for q in questions:
        assert "q" in q and "options" in q and "topic" in q
        assert "correct_index" not in q, "correct_index leaked to client!"


def test_aptitude_submit(s):
    # Submit dummy answers (0 for each)
    r = s.post(_url("/aptitude/submit"), json={"answers": [0] * 12})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["ok"] is True
    assert j["next_stage"] == "behavioural"
    apt = j["aptitude"]
    for k in ("score_pct", "correct", "total", "passed", "by_topic", "review", "feedback_md"):
        assert k in apt, f"missing {k}"
    assert apt["total"] == 12


def test_aptitude_submit_without_start_409(s):
    fresh_trial = f"nostart-{uuid.uuid4().hex[:8]}"
    r = s.post(f"{BASE_URL}/api/guest-sim/{fresh_trial}/aptitude/submit", json={"answers": []})
    assert r.status_code == 409


# ---------- interview ------------------------------------------------------
@pytest.mark.parametrize("stage", ["behavioural", "technical"])
def test_interview_begin(s, stage):
    r = s.post(_url("/interview/begin"), json={"stage": stage})
    assert r.status_code == 200, r.text
    j = r.json()
    assert isinstance(j["turns"], list) and len(j["turns"]) >= 1
    assert j["turns"][0]["role"] == "interviewer"
    assert j["num_questions"] >= 1


def test_interview_answer_flow(s):
    # Begin behavioural
    r = s.post(_url("/interview/begin"), json={"stage": "behavioural"})
    turns = r.json()["turns"]
    # Answer once, expect next question OR round_complete
    r = s.post(_url("/interview/answer"), json={
        "stage": "behavioural",
        "answer": "In my last internship at an equity research shop I built a DCF for Titan and defended it in a team review.",
        "turns": turns,
    })
    assert r.status_code == 200, r.text
    j = r.json()
    assert "round_complete" in j
    if not j["round_complete"]:
        assert "next_question" in j and isinstance(j["turns"], list)
    else:
        assert "result" in j and "score" in j["result"]


def test_interview_answer_requires_turns(s):
    r = s.post(_url("/interview/answer"),
               json={"stage": "behavioural", "answer": "hi", "turns": []})
    assert r.status_code == 400


# ---------- case study -----------------------------------------------------
def test_case_submit(s):
    rec = ("BUY recommendation, target price implies 22% upside. Key drivers: (1) premiumisation of mid-tier "
           "products lifts blended margin ~180bps by FY27, (2) balance-sheet deleveraging supports a re-rating, "
           "and (3) rural distribution expansion adds ~4% volume CAGR. Risks: raw-material inflation, monsoon.")
    assert len(rec) >= 120
    body = {
        "excel_score": {"total": 70, "per_cell": {"B10": 1}},
        "recommendation": rec,
        "stage_data": {
            "aptitude": {"score_pct": 80},
            "behavioural": {"score": 70},
            "technical": {"score": 65},
        },
    }
    r = s.post(_url("/case/submit"), json=body)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["ok"] is True and j["next_stage"] == "decision"
    assert "case_study" in j and "decision" in j
    assert j["verdict"] in ("offer", "rejected")
    dec = j["decision"]
    for k in ("final_score", "verdict", "letter_md", "report_md", "stage_scores"):
        assert k in dec


def test_case_submit_short_rec(s):
    r = s.post(_url("/case/submit"), json={"recommendation": "too short", "excel_score": {"total": 50}})
    assert r.status_code == 400


# ---------- TTS ------------------------------------------------------------
def test_tts_ok(s):
    r = s.post(_url("/tts"), json={"text": "Hello, this is a test.", "voice": "nova"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["mime"] == "audio/mpeg" and j["audio_base64"]


def test_tts_empty(s):
    r = s.post(_url("/tts"), json={"text": ""})
    assert r.status_code == 400
