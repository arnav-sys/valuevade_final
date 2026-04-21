"""Regression tests for POST /api/interview/evaluate

Verifies the LLM-backed evaluator returns differentiated scores and
response-specific feedback for the SAME interview question across
answers of different quality.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://finance-copilot-dev.preview.emergentagent.com').rstrip('/')
EVAL_URL = f"{BASE_URL}/api/interview/evaluate"

QUESTION = "Walk me through how you would value a growing perpetuity using the Time Value of Money framework."
CONTEXT = "This is a 2nd-round IB screening question. Assume discount rate 10%, growth rate 3%, next-year cashflow $100."
CRITERIA = {
    "must_cover": ["Gordon growth formula", "discount rate must exceed growth rate", "PV = CF1 / (r - g)"],
    "bonus_points": ["state assumption about perpetual growth", "sensitivity to r-g spread"],
    "red_flags": ["using simple perpetuity formula with growth", "r < g"],
}
MODEL_ANSWER = "Use the Gordon Growth Model: PV = CF1 / (r - g). With CF1=$100, r=10%, g=3%, PV = 100/0.07 = $1,428.57. Assumes r>g and constant perpetual growth."

STRONG = (
    "I'd use the Gordon Growth Model, which is an extension of TVM for a growing perpetuity. "
    "The present value equals next year's cashflow divided by the discount rate minus growth rate, so PV = CF1 / (r - g). "
    "Plugging in the numbers: $100 divided by (10% - 3%) equals $100 / 0.07, which is about $1,428.57. "
    "Key assumption: r must exceed g, otherwise the formula breaks down and you get a negative or infinite PV. "
    "I'd also flag sensitivity — a 1% tightening of the r-g spread materially raises valuation."
)
MID = (
    "I would discount the cashflows. Since it grows, I'd use a growing perpetuity formula. "
    "You take the cashflow and divide by the discount rate, adjusted for growth. "
    "So something like 100 divided by 10 minus 3, which gives around 1400 dollars."
)
# ~80 chars - weak but >50 so UI would accept
WEAK = "You just divide the cashflow by the rate and that gives you the value of the perpetuity."


def _post(body_response: str):
    return requests.post(
        EVAL_URL,
        json={
            "question": QUESTION,
            "response": body_response,
            "context": CONTEXT,
            "evaluation_criteria": CRITERIA,
            "model_answer": MODEL_ANSWER,
            "session_title": "Time Value of Money",
        },
        timeout=60,
    )


@pytest.fixture(scope="module")
def three_evals():
    r_strong = _post(STRONG)
    r_mid = _post(MID)
    r_weak = _post(WEAK)
    return r_strong, r_mid, r_weak


class TestInterviewEvaluate:
    def test_strong_answer_200_and_shape(self, three_evals):
        r, _, _ = three_evals
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data["scores"].keys()) == {"technical", "communication", "structure", "overall"}
        for k, v in data["scores"].items():
            assert isinstance(v, int) and 1 <= v <= 5, f"{k}={v}"
        assert isinstance(data["feedback"]["strengths"], list) and len(data["feedback"]["strengths"]) >= 1
        assert isinstance(data["feedback"]["improvements"], list) and len(data["feedback"]["improvements"]) >= 1

    def test_mid_answer_200(self, three_evals):
        _, r, _ = three_evals
        assert r.status_code == 200, r.text
        data = r.json()
        assert 2 <= data["scores"]["overall"] <= 4

    def test_weak_answer_200(self, three_evals):
        _, _, r = three_evals
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["scores"]["overall"] <= 3

    def test_scores_differentiated_across_qualities(self, three_evals):
        r_strong, r_mid, r_weak = three_evals
        s_tech = r_strong.json()["scores"]["technical"]
        m_tech = r_mid.json()["scores"]["technical"]
        w_tech = r_weak.json()["scores"]["technical"]
        assert s_tech > w_tech, f"strong={s_tech} must beat weak={w_tech}"
        # strong should be >= mid >= weak (allow equality at mid boundary)
        assert s_tech >= m_tech >= w_tech, f"ordering: strong={s_tech} mid={m_tech} weak={w_tech}"

    def test_feedback_differentiated_across_answers(self, three_evals):
        r_strong, r_mid, r_weak = three_evals
        strong_fb = " ".join(r_strong.json()["feedback"]["strengths"] + r_strong.json()["feedback"]["improvements"])
        mid_fb = " ".join(r_mid.json()["feedback"]["strengths"] + r_mid.json()["feedback"]["improvements"])
        weak_fb = " ".join(r_weak.json()["feedback"]["strengths"] + r_weak.json()["feedback"]["improvements"])
        assert strong_fb != mid_fb != weak_fb
        assert strong_fb.strip() and mid_fb.strip() and weak_fb.strip()

    def test_strong_feedback_references_specifics(self, three_evals):
        r_strong, _, _ = three_evals
        all_fb = " ".join(r_strong.json()["feedback"]["strengths"] + r_strong.json()["feedback"]["improvements"]).lower()
        # Should reference at least one concrete concept from candidate answer
        hits = ["gordon", "1,428", "1428", "r-g", "r - g", "perpetuity", "growth", "discount", "spread", "sensitivity"]
        assert any(h in all_fb for h in hits), f"feedback not specific: {all_fb}"

    def test_weak_feedback_points_out_gaps(self, three_evals):
        _, _, r_weak = three_evals
        improvements = " ".join(r_weak.json()["feedback"]["improvements"]).lower()
        # Weak answer omitted Gordon model name, r>g assumption, and formula exactness
        hits = ["gordon", "formula", "assumption", "r > g", "r>g", "growth", "detail", "specific", "example", "number"]
        assert any(h in improvements for h in hits), f"improvements too generic: {improvements}"

    def test_too_short_returns_400(self):
        r = requests.post(
            EVAL_URL,
            json={"question": QUESTION, "response": "nope"},
            timeout=30,
        )
        assert r.status_code == 400
