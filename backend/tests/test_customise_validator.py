#!/usr/bin/env python3
"""
Unit tests for the customise plan validator (`_validate_and_normalize_plan`).
Runs entirely offline, no LLM calls needed. Verifies that, given a mock
Claude plan (often deliberately incomplete or wrong), the validator produces
the deterministically correct final plan.

Run:
  python3 -m pytest backend/tests/test_customise_validator.py -v
  # or
  python3 backend/tests/test_customise_validator.py
"""
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Bypass FastAPI bootstrap by importing only the helpers
import importlib.util
_spec = importlib.util.spec_from_file_location("server", os.path.join(os.path.dirname(__file__), "..", "server.py"))
_server = importlib.util.module_from_spec(_spec)
# We can't easily exec the full server.py (it starts uvicorn-bound objects). Instead, use a tiny shim:
# Read the source and exec just the helper functions we need.
with open(os.path.join(os.path.dirname(__file__), "..", "server.py")) as f:
    _src = f.read()
_start = _src.find("def _extract_answers(")
_end = _src.find("@api_router.post(\"/customize/generate\")")
_helpers_src = _src[_start:_end]
_ns = {}
exec(_helpers_src, _ns)
_validate_and_normalize_plan = _ns["_validate_and_normalize_plan"]
_compute_required_actions = _ns["_compute_required_actions"]
_extract_answers = _ns["_extract_answers"]


# ─── Mock course structure: minimal version of the real curriculum ──────────
def _mod(num, title, n_sessions):
    return {
        "id": f"mod-{num}",
        "title": title,
        "master_sessions": [{"id": f"m{num}s{i}", "title": f"M{num} Session {i}", "order_index": i} for i in range(1, n_sessions + 1)],
    }


COURSE = [
    _mod(1, "M1 Foundations", 15),
    _mod(2, "M2 Markets", 7),
    _mod(3, "M3 Excel", 13),
    _mod(4, "M4 Modelling", 8),
    _mod(5, "M5 Governance", 7),
    _mod(6, "M6 Annual Reports", 12),
    _mod(7, "M7 FSA", 13),
    _mod(8, "M8 Red Flags", 14),
    _mod(9, "M9 Ratios", 13),
    _mod(10, "M10 Macro", 10),
    _mod(11, "M11 Sectors", 12),
    _mod(12, "M12 Valuation", 14),
    _mod(13, "M13 Reports", 12),
    _mod(14, "M14 Resume", 13),
    _mod(15, "M15 AI", 10),
]


def _mock_req(answers_dict):
    """Build a SimpleNamespace mimicking CustomizeRequest."""
    answers = []
    qmeta = [
        (1, "What's your finance background?"),
        (2, "What's your primary career goal?"),
        (3, "How comfortable are you reading the 3 financial statements?"),
        (4, "How would you rate your Excel skill for finance work?"),
        (5, "Have you built a financial model from scratch?"),
        (6, "How deep is your accounting & accrual concept understanding?"),
        (7, "How familiar are you with ratio & FSA frameworks (ROE, DuPont, EV/EBITDA)?"),
        (8, "Which valuation methods have you actually used?"),
        (9, "How comfortable are you reading annual reports & concalls?"),
        (10, "How familiar are you with Indian markets & macro?"),
        (11, "Which sectors do you want to specialise in?"),
        (12, "Certifications you're pursuing or have cleared?"),
        (13, "How much emphasis do you want on each of these output skills?"),
    ]
    keys = ["q1_background","q2_goal","q3_statements","q4_excel","q5_modelling","q6_accounting","q7_ratios","q8_valuation","q9_annual_reports","q10_markets","q11_sectors","q12_certs","q13_emphasis"]
    for i, (num, qtext) in enumerate(qmeta):
        answers.append({"question_text": qtext, "answer": answers_dict.get(keys[i])})
    return SimpleNamespace(answers=answers, course_structure=COURSE, free_text="", course_title="Equity Research Analyst")


def _empty_plan():
    return {"customisation_plan": [], "final_modules": [], "conservative_flags": []}


# ─── Tests ──────────────────────────────────────────────────────────────────
def test_finance_grad_removes_M1():
    req = _mock_req({"q1_background": "fin_grad", "q2_goal": "er_sell",
                     "q3_statements": "confident", "q4_excel": "intermediate",
                     "q5_modelling": "tutorial", "q6_accounting": "advanced",
                     "q7_ratios": "comfortable", "q8_valuation": ["dcf"],
                     "q9_annual_reports": "mda", "q10_markets": "moderate",
                     "q11_sectors": ["it"], "q12_certs": [],
                     "q13_emphasis": {"governance": 3, "sectors": 4, "valuation": 5, "reports": 3, "jobs": 4, "ai": 3}})
    plan = _validate_and_normalize_plan(_empty_plan(), req)
    removed_mods = {a["module_number"] for a in plan["customisation_plan"] if a["action"] == "remove_module"}
    assert 1 in removed_mods, "fin_grad must remove M1"
    print(f"✓ test_finance_grad_removes_M1: removed_mods = {sorted(removed_mods)}")


def test_professional_removes_M1_M2():
    req = _mock_req({"q1_background": "professional", "q2_goal": "ib",
                     "q3_statements": "confident", "q4_excel": "advanced",
                     "q5_modelling": "basic", "q6_accounting": "expert",
                     "q7_ratios": "advanced", "q8_valuation": ["dcf","comps","precedent"],
                     "q9_annual_reports": "analyst", "q10_markets": "deep",
                     "q11_sectors": ["banking"], "q12_certs": [],
                     "q13_emphasis": {"governance": 1, "sectors": 1, "valuation": 5, "reports": 1, "jobs": 1, "ai": 1}})
    plan = _validate_and_normalize_plan(_empty_plan(), req)
    removed_mods = {a["module_number"] for a in plan["customisation_plan"] if a["action"] == "remove_module"}
    # Should remove M1, M2, M6 (analyst AR), M10 (deep markets), M5 (gov<=2), M13 (reports<=2), M11 (sectors<=2 and goal=ib)
    for m in (1, 2, 5, 6, 10, 11, 13):
        assert m in removed_mods, f"M{m} should be removed for this profile, got {sorted(removed_mods)}"
    assert 14 not in removed_mods and 15 not in removed_mods, "M14/M15 must never be removed"
    print(f"✓ test_professional_removes_M1_M2: removed_mods = {sorted(removed_mods)}")


def test_cert_override_keeps_M7():
    """CFA cert must force-keep M7 even if accounting=expert would otherwise still keep it,
       and force-keep M12 even if user has used many valuation methods."""
    req = _mock_req({"q1_background": "fin_grad", "q2_goal": "er_buy",
                     "q3_statements": "confident", "q4_excel": "expert",
                     "q5_modelling": "confident", "q6_accounting": "expert",
                     "q7_ratios": "advanced", "q8_valuation": ["dcf","comps","precedent","sotp","sector_specific"],
                     "q9_annual_reports": "analyst", "q10_markets": "deep",
                     "q11_sectors": ["all"], "q12_certs": ["cfa"],
                     "q13_emphasis": {"governance": 3, "sectors": 5, "valuation": 5, "reports": 4, "jobs": 4, "ai": 3}})
    # Pretend Claude removed M9 (which CFA should force-keep)
    bad_plan = {"customisation_plan": [
        {"action": "remove_module", "module_number": 9, "module_title": "M9 Ratios", "reason": "advanced ratios"},
    ], "final_modules": [], "conservative_flags": []}
    plan = _validate_and_normalize_plan(bad_plan, req)
    removed_mods = {a["module_number"] for a in plan["customisation_plan"] if a["action"] == "remove_module"}
    assert 9 not in removed_mods, "CFA must force-keep M9"
    assert "cert_override" in plan["conservative_flags"], "cert_override flag expected"
    print(f"✓ test_cert_override_keeps_M7: removed_mods = {sorted(removed_mods)}, flags = {plan['conservative_flags']}")


def test_locked_modules_protection():
    """If Claude hallucinates and tries to remove M14 or M15, validator must strip them."""
    req = _mock_req({"q1_background": "beginner", "q2_goal": "explore",
                     "q3_statements": "never", "q4_excel": "basic",
                     "q5_modelling": "never", "q6_accounting": "basic",
                     "q7_ratios": "heard", "q8_valuation": ["none"],
                     "q9_annual_reports": "never", "q10_markets": "none",
                     "q11_sectors": ["all"], "q12_certs": [],
                     "q13_emphasis": {"governance": 3, "sectors": 3, "valuation": 3, "reports": 3, "jobs": 3, "ai": 3}})
    bad_plan = {"customisation_plan": [
        {"action": "remove_module", "module_number": 14, "module_title": "M14", "reason": "hallucination"},
        {"action": "remove_session", "module_number": 15, "session_id": "m15s1", "session_title": "AI intro", "reason": "hallucination"},
    ], "final_modules": [], "conservative_flags": []}
    plan = _validate_and_normalize_plan(bad_plan, req)
    bad_actions = [a for a in plan["customisation_plan"] if a.get("module_number") in (14, 15)]
    assert len(bad_actions) == 0, f"M14/M15 actions should be stripped, got: {bad_actions}"
    assert "dropped_locked_action" in plan["conservative_flags"]
    print(f"✓ test_locked_modules_protection: locked actions stripped, flags = {plan['conservative_flags']}")


def test_session_level_removals():
    """confident statements + intermediate excel + tutorial modelling + mda AR should
       inject specific session-level removals."""
    req = _mock_req({"q1_background": "commerce", "q2_goal": "er_sell",
                     "q3_statements": "confident", "q4_excel": "intermediate",
                     "q5_modelling": "tutorial", "q6_accounting": "comfortable",
                     "q7_ratios": "basic", "q8_valuation": ["dcf"],
                     "q9_annual_reports": "mda", "q10_markets": "basic",
                     "q11_sectors": ["banking","it","pharma"], "q12_certs": [],
                     "q13_emphasis": {"governance": 3, "sectors": 4, "valuation": 5, "reports": 3, "jobs": 3, "ai": 3}})
    plan = _validate_and_normalize_plan(_empty_plan(), req)
    session_removals = [a for a in plan["customisation_plan"] if a["action"] == "remove_session"]
    by_mod = {}
    for a in session_removals:
        by_mod.setdefault(a["module_number"], []).append(a["session_title"])
    # M1: S4,S6,S7,S8,S9 (confident stmts) + S5 (commerce or comfortable acc)
    assert 1 in by_mod, "M1 sessions should be removed"
    # M3: S1-S5 (intermediate excel)
    assert 3 in by_mod and len(by_mod[3]) == 5, f"M3 should have 5 sessions removed, got {by_mod.get(3)}"
    # M4: S1,S2 (tutorial modelling)
    assert 4 in by_mod and len(by_mod[4]) == 2, f"M4 should have 2 sessions removed, got {by_mod.get(4)}"
    # M6: S1-S5 (mda AR)
    assert 6 in by_mod and len(by_mod[6]) == 5, f"M6 should have 5 sessions removed, got {by_mod.get(6)}"
    # M11: sectors not picked (banking=4, it=5, pharma=8) → drop 6,7,9,10
    m11_removed = by_mod.get(11, [])
    assert len(m11_removed) == 4, f"M11 should have 4 session removals (unpicked sectors), got {len(m11_removed)}: {m11_removed}"
    # M12: dcf → drop S6,S7,S8
    m12_removed = by_mod.get(12, [])
    assert len(m12_removed) == 3, f"M12 should have 3 DCF sessions removed, got {len(m12_removed)}: {m12_removed}"
    print(f"✓ test_session_level_removals: M1={len(by_mod.get(1,[]))} M3={len(by_mod.get(3,[]))} M4={len(by_mod.get(4,[]))} M6={len(by_mod.get(6,[]))} M11={len(by_mod.get(11,[]))} M12={len(by_mod.get(12,[]))}")


def test_beginner_suppresses_session_removals():
    """beginner background should keep M1/M7/M9/M10 sessions intact even if other answers
       would normally remove them."""
    req = _mock_req({"q1_background": "beginner", "q2_goal": "er_sell",
                     "q3_statements": "confident",        # would normally remove M1 sessions
                     "q4_excel": "intermediate",          # M3 session removal still applies
                     "q5_modelling": "tutorial",          # M4 session removal still applies
                     "q6_accounting": "advanced",         # would normally remove M1S5, M7S1-S2
                     "q7_ratios": "advanced",             # would normally remove M9 sessions
                     "q8_valuation": ["none"],
                     "q9_annual_reports": "chairman",
                     "q10_markets": "moderate",           # would normally remove M10 sessions
                     "q11_sectors": ["all"], "q12_certs": [],
                     "q13_emphasis": {"governance": 3, "sectors": 3, "valuation": 3, "reports": 3, "jobs": 3, "ai": 3}})
    plan = _validate_and_normalize_plan(_empty_plan(), req)
    session_removals = [a for a in plan["customisation_plan"] if a["action"] == "remove_session"]
    suppressed_mods = {1, 7, 9, 10}
    leaked = [a for a in session_removals if a["module_number"] in suppressed_mods]
    assert len(leaked) == 0, f"beginner should suppress M1/M7/M9/M10 session removals, but got: {[(a['module_number'],a['session_title']) for a in leaked]}"
    assert "beginner_suppress" in plan["conservative_flags"]
    print(f"✓ test_beginner_suppresses_session_removals: {len(session_removals)} session removals, none in suppressed mods {sorted(suppressed_mods)}")


def test_final_module_summary_rebuilt():
    """final_modules array must be rebuilt deterministically, reflecting the real actions."""
    req = _mock_req({"q1_background": "fin_grad", "q2_goal": "er_sell",
                     "q3_statements": "confident", "q4_excel": "intermediate",
                     "q5_modelling": "tutorial", "q6_accounting": "advanced",
                     "q7_ratios": "comfortable", "q8_valuation": ["dcf"],
                     "q9_annual_reports": "mda", "q10_markets": "moderate",
                     "q11_sectors": ["it","fmcg","pharma"], "q12_certs": ["cfa"],
                     "q13_emphasis": {"governance": 4, "sectors": 5, "valuation": 5, "reports": 4, "jobs": 5, "ai": 3}})
    plan = _validate_and_normalize_plan(_empty_plan(), req)
    fm = {m["module_number"]: m for m in plan["final_modules"]}
    assert fm[1]["status"] == "removed", f"M1 should be removed, got {fm[1]['status']}"
    assert fm[14]["status"] == "locked"
    assert fm[15]["status"] == "locked"
    # CFA force-keep M7, M9, M10, M12
    for m in (7, 9, 10, 12):
        assert fm[m]["status"] != "removed", f"CFA should force-keep M{m}"
    # Session totals should be sensible
    assert plan["total_sessions_final"] >= 60, f"Floor violated: {plan['total_sessions_final']}"
    assert plan["total_modules_final"] == sum(1 for m in plan["final_modules"] if m["status"] != "removed")
    print(f"✓ test_final_module_summary_rebuilt: {plan['total_modules_final']} modules, {plan['total_sessions_final']} sessions")


def test_dedupe_remove_session_in_removed_module():
    """If LLM emits a remove_session for a module that's also being removed,
       the redundant session removal should be dropped."""
    req = _mock_req({"q1_background": "professional", "q2_goal": "er_sell",
                     "q3_statements": "confident", "q4_excel": "expert",
                     "q5_modelling": "confident", "q6_accounting": "expert",
                     "q7_ratios": "advanced", "q8_valuation": ["dcf","comps"],
                     "q9_annual_reports": "analyst", "q10_markets": "deep",
                     "q11_sectors": ["banking"], "q12_certs": [],
                     "q13_emphasis": {"governance": 3, "sectors": 3, "valuation": 3, "reports": 3, "jobs": 3, "ai": 3}})
    # Claude redundantly emits remove_session for M1 sessions AND remove_module M1
    bad_plan = {"customisation_plan": [
        {"action": "remove_module", "module_number": 1, "module_title": "M1", "reason": "professional"},
        {"action": "remove_session", "module_number": 1, "session_id": "m1s4", "session_title": "M1 Session 4", "reason": "redundant"},
        {"action": "remove_session", "module_number": 1, "session_id": "m1s5", "session_title": "M1 Session 5", "reason": "redundant"},
    ], "final_modules": [], "conservative_flags": []}
    plan = _validate_and_normalize_plan(bad_plan, req)
    redundant = [a for a in plan["customisation_plan"] if a["action"] == "remove_session" and a["module_number"] == 1]
    assert len(redundant) == 0, f"Redundant M1 session removals should be dropped, got: {redundant}"
    print(f"✓ test_dedupe_remove_session_in_removed_module: redundant session removals dropped")


if __name__ == "__main__":
    print("\n=== Running customise validator tests ===\n")
    test_finance_grad_removes_M1()
    test_professional_removes_M1_M2()
    test_cert_override_keeps_M7()
    test_locked_modules_protection()
    test_session_level_removals()
    test_beginner_suppresses_session_removals()
    test_final_module_summary_rebuilt()
    test_dedupe_remove_session_in_removed_module()
    print("\n=== All tests passed ===")
