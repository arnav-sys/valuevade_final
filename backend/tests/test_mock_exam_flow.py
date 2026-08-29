"""
End-to-end backend tests for the NISM-style Mock Exam feature.

Covers:
- Admin auto-create/get exam for Module 16
- Admin PATCH exam settings
- Admin CSV bulk import + error handling
- Admin single-question CRUD
- Student flow: GET exam (correct_answer_index hidden), start attempt, submit
- Security: non-admin gets 403 on admin endpoints; foreign attempt_id => 403
- Module 16 = 'NISM Series XV — Research Analyst Certification',
  master_module id 5a6dd7bb-7b0a-42c6-9316-d5c7f27e1b8a, is_exam_module=true
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mock-exam-mvp.preview.emergentagent.com").rstrip("/")
SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTIwNDMsImV4cCI6MjA5MTQ4ODA0M30.0skD-qqK_BEpNJbgKNzxAa81zV_qE_WiHLMs233OqpA"

ADMIN_EMAIL = "info@valuevade.com"
ADMIN_PW = "aa1aa2sam3"
STUDENT_EMAIL = "testagent2026@gmail.com"
STUDENT_PW = "TestPass123!"

MODULE_16_MASTER_ID = "5a6dd7bb-7b0a-42c6-9316-d5c7f27e1b8a"


def _login(email, pw):
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
        json={"email": email, "password": pw},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PW)


@pytest.fixture(scope="module")
def student_token():
    return _login(STUDENT_EMAIL, STUDENT_PW)


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def student_h(student_token):
    return {"Authorization": f"Bearer {student_token}", "Content-Type": "application/json"}


# ────── Health check ─────────────────────────────────────────────
def test_backend_health():
    r = requests.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200


# ────── Admin: get-or-auto-create exam for Module 16 ─────────────
@pytest.fixture(scope="module")
def module_exam(admin_h):
    """Ensure a mock exam exists for Module 16; return {exam_id,...}."""
    r = requests.get(
        f"{BASE_URL}/api/admin/mock-exams/{MODULE_16_MASTER_ID}",
        headers=admin_h, timeout=30,
    )
    assert r.status_code == 200, f"admin GET failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    exam = data.get("exam")
    if not exam:
        # Create it via POST
        cr = requests.post(
            f"{BASE_URL}/api/admin/mock-exams/{MODULE_16_MASTER_ID}",
            headers=admin_h,
            json={
                "title": "NISM Series XV — Research Analyst Mock Exam",
                "description": "Auto-created by test suite",
                "time_limit_minutes": 120,
                "pass_percentage": 60,
            },
            timeout=30,
        )
        assert cr.status_code in (200, 201), f"create failed: {cr.status_code} {cr.text[:300]}"
        exam = cr.json()["exam"]
    assert exam and exam.get("id")
    return exam


def test_admin_exam_exists_or_created(module_exam):
    assert module_exam["module_id"] == MODULE_16_MASTER_ID
    assert isinstance(module_exam.get("time_limit_minutes"), int)


def test_admin_patch_exam_settings(admin_h, module_exam):
    exam_id = module_exam["id"]
    r = requests.patch(
        f"{BASE_URL}/api/admin/mock-exams/{exam_id}",
        headers=admin_h,
        json={"time_limit_minutes": 90, "pass_percentage": 60,
              "title": "NISM Series XV — Research Analyst Mock Exam"},
        timeout=30,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    exam = r.json()["exam"]
    assert exam["time_limit_minutes"] == 90
    assert int(exam["pass_percentage"]) == 60


# ────── Admin: CSV bulk import w/ error rows ─────────────────────
def test_admin_csv_bulk_import_with_errors(admin_h, module_exam):
    exam_id = module_exam["id"]
    rows = [
        {  # OK
            "question": "Which regulator issues the Research Analyst certification in India?",
            "options": ["SEBI", "RBI", "IRDAI", "PFRDA"],
            "correct_answer_index": 0,
            "explanation": "SEBI regulates research analysts under NISM Series XV.",
            "difficulty": "easy",
            "topic_tag": "regulation",
        },
        {  # OK
            "question": "Which valuation method uses free cash flows?",
            "options": ["DCF", "Comparable P/E", "Book Value"],
            "correct_answer_index": 0,
            "explanation": "DCF discounts future FCFs.",
            "difficulty": "medium",
            "topic_tag": "valuation",
        },
        {  # OK
            "question": "What does EBITDA stand for?",
            "options": [
                "Earnings Before Interest, Taxes, Depreciation & Amortisation",
                "Earnings Before Income Taxes",
                "Earnings Before Investing",
                "None",
            ],
            "correct_answer_index": 0,
            "explanation": "Standard definition.",
            "difficulty": "easy",
            "topic_tag": "accounting",
        },
        {  # ERROR: missing question
            "question": "",
            "options": ["A", "B"],
            "correct_answer_index": 0,
        },
        {  # ERROR: <2 options
            "question": "Bad row",
            "options": ["only-one"],
            "correct_answer_index": 0,
        },
    ]
    r = requests.post(
        f"{BASE_URL}/api/admin/mock-exams/{exam_id}/questions/csv",
        headers=admin_h, json={"rows": rows}, timeout=60,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
    body = r.json()
    assert body["inserted"] >= 3
    assert isinstance(body["errors"], list)
    assert len(body["errors"]) == 2
    reasons = " ".join(e["reason"].lower() for e in body["errors"])
    assert "missing question" in reasons or "fewer than 2 options" in reasons


def test_admin_csv_empty_rows_returns_400(admin_h, module_exam):
    exam_id = module_exam["id"]
    r = requests.post(
        f"{BASE_URL}/api/admin/mock-exams/{exam_id}/questions/csv",
        headers=admin_h, json={"rows": []}, timeout=30,
    )
    assert r.status_code == 400


# ────── Admin: single-question CRUD ──────────────────────────────
def test_admin_single_question_crud(admin_h, module_exam):
    exam_id = module_exam["id"]
    # CREATE
    c = requests.post(
        f"{BASE_URL}/api/admin/mock-exam-questions",
        headers=admin_h,
        json={
            "exam_id": exam_id,
            "question": "TEST_single Q: 2+2=?",
            "options": ["3", "4", "5", "22"],
            "correct_answer_index": 1,
            "explanation": "Basic math",
            "difficulty": "easy",
            "topic_tag": "TEST_math",
        },
        timeout=30,
    )
    assert c.status_code == 200, f"{c.status_code} {c.text[:200]}"
    q = c.json()["question"]
    qid = q["id"]

    # UPDATE
    u = requests.patch(
        f"{BASE_URL}/api/admin/mock-exam-questions/{qid}",
        headers=admin_h,
        json={"explanation": "Updated explanation", "difficulty": "medium"},
        timeout=30,
    )
    assert u.status_code == 200
    assert u.json()["question"]["explanation"] == "Updated explanation"

    # DELETE
    d = requests.delete(
        f"{BASE_URL}/api/admin/mock-exam-questions/{qid}",
        headers=admin_h, timeout=30,
    )
    assert d.status_code == 200
    assert d.json().get("ok") is True


# ────── Admin questions list ─────────────────────────────────────
def test_admin_questions_list(admin_h, module_exam):
    exam_id = module_exam["id"]
    r = requests.get(
        f"{BASE_URL}/api/admin/mock-exam-questions?exam_id={exam_id}",
        headers=admin_h, timeout=30,
    )
    assert r.status_code == 200
    qs = r.json()["questions"]
    assert isinstance(qs, list)
    assert len(qs) >= 3


# ────── Security: student cannot hit admin endpoints ─────────────
def test_student_forbidden_admin_get(student_h):
    r = requests.get(
        f"{BASE_URL}/api/admin/mock-exams/{MODULE_16_MASTER_ID}",
        headers=student_h, timeout=30,
    )
    assert r.status_code == 403


def test_student_forbidden_admin_csv(student_h, module_exam):
    r = requests.post(
        f"{BASE_URL}/api/admin/mock-exams/{module_exam['id']}/questions/csv",
        headers=student_h,
        json={"rows": [{"question": "x", "options": ["a", "b"], "correct_answer_index": 0}]},
        timeout=30,
    )
    assert r.status_code == 403


# ────── Student flow: GET exam, start, submit ───────────────────
def test_student_get_exam_hides_correct_answer(student_h):
    r = requests.get(
        f"{BASE_URL}/api/mock-exams/{MODULE_16_MASTER_ID}",
        headers=student_h, timeout=30,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    data = r.json()
    assert "exam" in data and "questions" in data
    assert data["exam"]["module_id"] == MODULE_16_MASTER_ID
    assert data["exam"]["question_count"] == len(data["questions"])
    # correct_answer_index MUST NOT be exposed
    for q in data["questions"]:
        assert "correct_answer_index" not in q, f"leak! q={q}"


@pytest.fixture(scope="module")
def student_attempt(student_h):
    r = requests.post(
        f"{BASE_URL}/api/mock-exams/{MODULE_16_MASTER_ID}/start",
        headers=student_h, timeout=30,
    )
    assert r.status_code == 200, f"start failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert data.get("attempt_id") and data.get("exam_id")
    return data


def test_student_start_attempt(student_attempt):
    assert student_attempt["attempt_id"]


def test_student_submit_all_correct_passes(student_h, student_attempt, admin_h, module_exam):
    """Submit with all-correct answers using admin correct_answer_index. Should pass."""
    # Fetch correct answers via admin
    adm = requests.get(
        f"{BASE_URL}/api/admin/mock-exam-questions?exam_id={module_exam['id']}",
        headers=admin_h, timeout=30,
    )
    assert adm.status_code == 200
    admin_qs = adm.json()["questions"]
    correct_by_id = {q["id"]: q["correct_answer_index"] for q in admin_qs}

    # Fetch student's shuffled/ordered question list
    stu = requests.get(
        f"{BASE_URL}/api/mock-exams/{MODULE_16_MASTER_ID}",
        headers=student_h, timeout=30,
    )
    student_qs = stu.json()["questions"]
    answers = [correct_by_id.get(q["id"], 0) for q in student_qs]

    r = requests.post(
        f"{BASE_URL}/api/mock-exams/{MODULE_16_MASTER_ID}/submit",
        headers=student_h,
        json={"attempt_id": student_attempt["attempt_id"], "answers": answers, "time_taken_seconds": 300},
        timeout=45,
    )
    assert r.status_code == 200, f"submit failed: {r.status_code} {r.text[:400]}"
    body = r.json()
    assert body["score"] == 100.0
    assert body["passed"] is True
    assert "review" in body
    assert len(body["review"]) == len(student_qs)
    # Review must include correct answer index + explanation now
    for item in body["review"]:
        assert "correct_answer_index" in item
        assert "explanation" in item


def test_student_submit_foreign_attempt_forbidden(student_h):
    """Random UUID as attempt_id must return 403."""
    import uuid
    r = requests.post(
        f"{BASE_URL}/api/mock-exams/{MODULE_16_MASTER_ID}/submit",
        headers=student_h,
        json={"attempt_id": str(uuid.uuid4()), "answers": [], "time_taken_seconds": 1},
        timeout=30,
    )
    assert r.status_code == 403


def test_unauthenticated_student_endpoint():
    r = requests.get(f"{BASE_URL}/api/mock-exams/{MODULE_16_MASTER_ID}", timeout=15)
    assert r.status_code in (401, 403)
