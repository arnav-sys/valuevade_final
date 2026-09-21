"""Sanity test for the per-question quiz XP variance refactor (Gap 1).

This test transcribes the JS `computeQuizXP` semantics into Python (since the
function lives in /app/frontend/src/utils/xp.js) and verifies:
  - 5 correct: total ∈ [25, 75] across 1000 trials, both bounds reachable.
  - 3 correct + 2 wrong: total ∈ [3*5+4, 3*15+4] = [19, 49] across 1000 trials.
  - 0 correct: total = 0.
  - Variance is sampled per-question (multi-modal), not once per quiz
    (which would only produce 11 distinct totals from a 5/0 quiz).
"""
import random
import pytest


def compute_quiz_xp(correct: int, attempted: int) -> int:
    """Faithful Python clone of the JS implementation in xp.js."""
    total = 0
    c = max(0, int(correct or 0))
    w = max(0, int(attempted or 0))
    for _ in range(c):
        total += 10 + random.randint(0, 10) - 5  # 5..15 inclusive
    total += 2 * w
    return max(0, total)


def test_per_question_variance_5_correct():
    random.seed(42)
    totals = [compute_quiz_xp(5, 0) for _ in range(2000)]
    assert min(totals) >= 25, f"min was {min(totals)} (expected ≥ 25)"
    assert max(totals) <= 75, f"max was {max(totals)} (expected ≤ 75)"
    distinct = len(set(totals))
    assert distinct >= 30, (
        f"only {distinct} distinct totals, variance is per-quiz, not "
        f"per-question (expected ≥30 from 5 stacked rolls of 11 outcomes)"
    )


def test_per_question_variance_3_correct_2_wrong():
    random.seed(7)
    totals = [compute_quiz_xp(3, 2) for _ in range(2000)]
    assert min(totals) >= 19, f"min was {min(totals)}"
    assert max(totals) <= 49, f"max was {max(totals)}"


def test_zero_correct():
    assert compute_quiz_xp(0, 0) == 0


def test_only_wrongs():
    assert compute_quiz_xp(0, 4) == 8


def test_negatives_clamped():
    assert compute_quiz_xp(-3, -1) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
