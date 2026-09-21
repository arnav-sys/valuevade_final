"""Interview Simulation (Module 20) - comprehensive backend tests.

Covers:
 - GET /api/interview-sim/overview (auth guard + QA account expectations)
 - Full MS pipeline: start -> application -> aptitude/start (no answer leak) -> aptitude/submit
 - interview begin/answer for behavioural + technical
 - case/submit with decision returned
 - guards: 3rd attempt (JPM), completed-attempt app submit, short recommendation, unauth
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fintech-mvp-38.preview.emergentagent.com").rstrip("/")
SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30.0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"

QA_EMAIL = "qa-interview@valuevade.test"
QA_PASS = "QaInterview2026!"

LONG = 120  # generous timeout for LLM endpoints


def _login(email, password):
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def qa_token():
    return _login(QA_EMAIL, QA_PASS)


@pytest.fixture(scope="module")
def qa_headers(qa_token):
    return {"Authorization": f"Bearer {qa_token}", "Content-Type": "application/json"}


# ---------------------------------------------------------------- overview
class TestOverview:
    def test_unauth_returns_401_403(self):
        r = requests.get(f"{BASE_URL}/api/interview-sim/overview", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_overview_qa_account(self, qa_headers):
        r = requests.get(f"{BASE_URL}/api/interview-sim/overview", headers=qa_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["unlocked"] is True, f"expected unlocked True, got {data.get('unlocked')}"
        assert data["videos_done"] == data["videos_total"], f"videos {data['videos_done']}/{data['videos_total']}"
        assert data["videos_total"] >= 3
        firms = data["firms"]
        assert len(firms) == 5, f"expected 5 firms, got {len(firms)}"
        jpm = next((f for f in firms if f.get("firm_slug") == "jpmorgan"), None)
        assert jpm is not None, "jpmorgan firm missing"
        assert jpm["is_done"] is True, f"JPM is_done={jpm['is_done']}"
        assert jpm["best_verdict"] == "rejected", f"JPM verdict={jpm['best_verdict']}"
        assert jpm["attempts_left"] == 1, f"JPM attempts_left={jpm['attempts_left']}"


# ---------------------------------------------------------------- guards
class TestGuards:
    def test_jpm_third_attempt_forbidden_when_two_used(self, qa_headers):
        # Overview says JPM already has 1 completed rejected + 1 attempt_left.
        # We only test 3rd-attempt guard IF attempts_used already == 2.
        r = requests.get(f"{BASE_URL}/api/interview-sim/overview", headers=qa_headers, timeout=30)
        firms = r.json()["firms"]
        jpm = next(f for f in firms if f["firm_slug"] == "jpmorgan")
        if jpm["attempts_used"] < 2:
            pytest.skip(f"JPM attempts_used={jpm['attempts_used']}, cannot test 3rd-attempt guard without polluting state")
        r2 = requests.post(f"{BASE_URL}/api/interview-sim/start",
                           headers=qa_headers, json={"sim_id": jpm["id"]}, timeout=30)
        assert r2.status_code == 409, f"expected 409, got {r2.status_code} {r2.text}"

    def test_short_recommendation_rejected(self, qa_headers):
        # Need a case_study-active attempt to hit the 120-char guard directly.
        # Fastest: hit any attempt in wrong stage, 409 short-circuits before the len check.
        # Instead, we validate the response of case/submit on a non-case attempt returns 409 (guard exists).
        # The <120 char guard is unit-tested only when case_study is active, see full pipeline test below.
        pytest.skip("Covered inside TestPipeline.test_short_recommendation_400")


# ---------------------------------------------------------------- pipeline
class TestMorganStanleyPipeline:
    """Run the FULL MS pipeline end-to-end. This is slow (~2-4 min)."""

    _shared = {}

    def _get_ms_sim(self, qa_headers):
        r = requests.get(f"{BASE_URL}/api/interview-sim/overview", headers=qa_headers, timeout=30)
        firms = r.json()["firms"]
        ms = next((f for f in firms if f.get("firm_slug") == "morganstanley"), None)
        assert ms is not None, "morgan stanley firm missing"
        return ms

    def test_01_start(self, qa_headers):
        ms = self._get_ms_sim(qa_headers)
        if ms["attempts_left"] <= 0:
            pytest.skip("MS attempts exhausted; run seed script to reset")
        r = requests.post(f"{BASE_URL}/api/interview-sim/start",
                          headers=qa_headers, json={"sim_id": ms["id"]}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "attempt_id" in data
        TestMorganStanleyPipeline._shared["attempt_id"] = data["attempt_id"]
        TestMorganStanleyPipeline._shared["sim_id"] = ms["id"]

    def test_02_application(self, qa_headers):
        aid = self._shared.get("attempt_id")
        if not aid:
            pytest.skip("no attempt")
        payload = {"responses": {
            "why_firm": "Morgan Stanley's India equity research franchise combines global perspective with deep local coverage in banks and consumer.",
            "why_er": "I love converting raw filings into a defensible thesis; equity research rewards intellectual rigor and clear writing.",
            "achievement": "Built a full DCF for HDFC Bank during Valuevade capstone, arrived at a target price within 6% of consensus.",
            "cover_note": "Excited to bring quantitative rigor and Indian-market curiosity to the MS team.",
        }}
        r = requests.post(f"{BASE_URL}/api/interview-sim/attempt/{aid}/application",
                          headers=qa_headers, json=payload, timeout=LONG)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("next_stage") == "aptitude"
        assert "application" in data and "score" in data["application"]

    def test_03_completed_attempt_app_submit_409(self, qa_headers):
        """Re-submitting application on an attempt already past app stage -> 409."""
        aid = self._shared.get("attempt_id")
        if not aid:
            pytest.skip("no attempt")
        r = requests.post(f"{BASE_URL}/api/interview-sim/attempt/{aid}/application",
                          headers=qa_headers, json={"responses": {"why_firm": "x"*40, "why_er": "y"*40, "achievement": "z"*40}},
                          timeout=30)
        assert r.status_code == 409, f"expected 409, got {r.status_code} {r.text}"

    def test_04_aptitude_start_no_answer_leak(self, qa_headers):
        aid = self._shared.get("attempt_id")
        if not aid:
            pytest.skip("no attempt")
        r = requests.post(f"{BASE_URL}/api/interview-sim/attempt/{aid}/aptitude/start",
                          headers=qa_headers, json={}, timeout=LONG)
        assert r.status_code == 200, r.text
        data = r.json()
        qs = data["questions"]
        assert len(qs) == 12, f"expected 12 questions, got {len(qs)}"
        for i, q in enumerate(qs):
            assert "correct_index" not in q, f"LEAK: correct_index in q[{i}]"
            assert "explanation" not in q, f"LEAK: explanation in q[{i}]"
            assert len(q["options"]) == 4
        assert data.get("time_limit_minutes") == 15
        assert data.get("pass_pct") == 40
        TestMorganStanleyPipeline._shared["n_q"] = len(qs)

    def test_05_aptitude_submit(self, qa_headers):
        aid = self._shared.get("attempt_id")
        n = self._shared.get("n_q") or 12
        if not aid:
            pytest.skip("no attempt")
        # Answer all index 1 to have a chance of ~pass (fallback bank has many correct=1)
        r = requests.post(f"{BASE_URL}/api/interview-sim/attempt/{aid}/aptitude/submit",
                          headers=qa_headers, json={"answers": [1] * n}, timeout=LONG)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "passed" in data
        assert data["next_stage"] in ("behavioural", "decision")
        TestMorganStanleyPipeline._shared["apt_passed"] = data["passed"]
        if not data["passed"]:
            # rejection path, decision should be present
            assert "decision" in data
            assert data["decision"]["verdict"] == "rejected"
            assert data["decision"].get("letter_md")
            assert data["decision"].get("report_md")

    def test_06_behavioural_begin_and_answer(self, qa_headers):
        aid = self._shared.get("attempt_id")
        if not aid or not self._shared.get("apt_passed"):
            pytest.skip("aptitude not passed or no attempt; behavioural not reachable")
        r = requests.post(f"{BASE_URL}/api/interview-sim/attempt/{aid}/interview/begin",
                          headers=qa_headers, json={"stage": "behavioural"}, timeout=LONG)
        assert r.status_code == 200, r.text
        turns = r.json()["turns"]
        assert any(t["role"] == "interviewer" for t in turns)

        # Answer 4 questions with varied text
        answers = [
            "During my Valuevade capstone I led a 3-person DCF for HDFC Bank; we split coverage across NIM, credit costs, and fee income and I owned the assumption reconciliation.",
            "A vague brief on a mid-cap NBFC, I clarified scope with a written one-pager listing the 5 drivers I'd focus on, and got sign-off before modelling.",
            "I disagreed with a peer's terminal growth of 6% for a consumer staple; I ran a sensitivity showing intrinsic value swung 22% and we compromised at 4.5%.",
            "Long-term I want to run sector coverage; short term I want two solid years learning the craft of modelling and thesis writing.",
        ]
        n_ans = 0
        for i, ans in enumerate(answers):
            r = requests.post(f"{BASE_URL}/api/interview-sim/attempt/{aid}/interview/answer",
                              headers=qa_headers,
                              json={"stage": "behavioural", "answer": ans, "input_method": "text"},
                              timeout=LONG)
            assert r.status_code == 200, r.text
            data = r.json()
            n_ans += 1
            if data.get("round_complete"):
                assert data["next_stage"] == "technical"
                assert "result" in data and "score" in data["result"]
                TestMorganStanleyPipeline._shared["behavioural_done"] = True
                return
        # If we ran out of answers without completing, note it
        TestMorganStanleyPipeline._shared["behavioural_done"] = False

    def test_07_technical_round(self, qa_headers):
        aid = self._shared.get("attempt_id")
        if not aid or not self._shared.get("behavioural_done"):
            pytest.skip("behavioural not completed")
        r = requests.post(f"{BASE_URL}/api/interview-sim/attempt/{aid}/interview/begin",
                          headers=qa_headers, json={"stage": "technical"}, timeout=LONG)
        assert r.status_code == 200, r.text

        answers = [
            "DCF: forecast FCF for 5 years off revenue growth and EBIT margin, subtract taxes, add back D&A, subtract capex and WC change; discount at WACC; terminal value via Gordon growth.",
            "For Indian banks I'd use residual income or P/BV, DCF is noisy because of loan-loss provisioning and regulatory capital changes.",
            "ROE decomposition: net margin x asset turnover x leverage. For a bank leverage is huge so ROE is misleading; I'd focus on ROA and NIM.",
            "Sensitivity: I flex WACC ±150bps and terminal growth ±100bps; presenting a football-field of implied prices instead of a single point estimate.",
            "Red flags in a 10-K: rising DSO, one-off gains propping up EBITDA, related-party transactions, and shrinking cash conversion vs reported profit.",
        ]
        for ans in answers:
            r = requests.post(f"{BASE_URL}/api/interview-sim/attempt/{aid}/interview/answer",
                              headers=qa_headers,
                              json={"stage": "technical", "answer": ans, "input_method": "text"},
                              timeout=LONG)
            assert r.status_code == 200, r.text
            data = r.json()
            if data.get("round_complete"):
                assert data["next_stage"] == "case_study"
                TestMorganStanleyPipeline._shared["technical_done"] = True
                return
        TestMorganStanleyPipeline._shared["technical_done"] = False

    def test_08_case_short_recommendation_400(self, qa_headers):
        aid = self._shared.get("attempt_id")
        if not aid or not self._shared.get("technical_done"):
            pytest.skip("technical not completed")
        r = requests.post(f"{BASE_URL}/api/interview-sim/attempt/{aid}/case/submit",
                          headers=qa_headers,
                          json={"excel_score": {"total": 80, "per_cell": {}}, "recommendation": "too short"},
                          timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_09_case_submit_and_decision(self, qa_headers):
        aid = self._shared.get("attempt_id")
        if not aid or not self._shared.get("technical_done"):
            pytest.skip("technical not completed")
        rec = (
            "Recommendation: BUY with a 12-month target price of INR 1,850, implying ~18% upside from the current price. "
            "Thesis rests on three pillars: (1) revenue growth trajectory of 14-16% CAGR driven by rural pickup and premiumisation; "
            "(2) operating leverage expanding EBITDA margins from 22.5% to 25% by FY27 as raw-material tailwinds sustain; "
            "(3) capital efficiency, the company generates 24% ROCE and converts 90% of EBITDA to cash. "
            "Valuation: DCF (WACC 11%, terminal growth 4.5%) yields intrinsic value of INR 1,900; peer P/E of 42x FY26 EPS of INR 44 supports INR 1,850. "
            "Key risks: raw-material inflation, competitive intensity from D2C brands, and monsoon volatility affecting rural volumes. "
            "Catalysts include Q3 rural volume growth print, new plant commissioning in Q4, and potential EPS beat. "
            "Position sizing 3% of the model portfolio; stop-loss at INR 1,450. Overall a high-conviction long."
        )
        assert len(rec) >= 150
        r = requests.post(f"{BASE_URL}/api/interview-sim/attempt/{aid}/case/submit",
                          headers=qa_headers,
                          json={"excel_score": {"total": 80, "per_cell": {}}, "recommendation": rec},
                          timeout=LONG)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["next_stage"] == "decision"
        assert "case_study" in data and "score" in data["case_study"]
        dec = data["decision"]
        assert dec["verdict"] in ("offer", "rejected")
        assert dec.get("letter_md")
        assert dec.get("report_md")
        assert "final_score" in dec
        assert "stage_scores" in dec

        # Verify attempt is completed
        r2 = requests.get(f"{BASE_URL}/api/interview-sim/attempt/{aid}", headers=qa_headers, timeout=30)
        assert r2.status_code == 200
        att = r2.json()["attempt"]
        assert att["status"] == "completed"
        assert att["current_stage"] == "decision"
