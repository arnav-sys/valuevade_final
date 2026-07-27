"""
Wave 1 + Wave 2 — Admin panel, Referrals, Mock Interview backend module.

This file is included from server.py via `from backend.wave_endpoints import register_wave_endpoints`
and adds all new /api/* routes onto the shared api_router.

Decoupling here keeps the server.py file from growing past its current 4951 lines.
"""
from __future__ import annotations

import asyncio
import json as _json
import logging
import os
import random
import re as _re
import string
import urllib.error
import urllib.parse as _urlparse
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# These will be injected by server.py via register_wave_endpoints(...).
_supabase_get = None
_supabase_post = None
_supabase_patch = None
_supabase_delete = None
_get_supabase_user = None
_EMERGENT_LLM_KEY = None
ADMIN_ALLOWED_EMAILS = {"info@valuevade.com"}


class _AdminCreateUserBody(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None
    role: Optional[str] = "user"          # "user" | "admin"
    auto_enroll: Optional[bool] = True    # default-enroll in Equity Research


# ---------------------------------------------------------------------------
# Admin auth helper
# ---------------------------------------------------------------------------
def _ensure_admin(user: dict):
    email = (user.get("email") or "").strip().lower()
    if email not in {e.lower() for e in ADMIN_ALLOWED_EMAILS}:
        raise HTTPException(status_code=403, detail="Admin access required.")


# ===========================================================================
# Pydantic
# ===========================================================================
class _AdminVideoUrlBody(BaseModel):
    public_url: str


class _AdminTusCreateBody(BaseModel):
    upload_length: int = Field(..., ge=1, le=53_687_091_200)
    content_type: str = "video/mp4"


# --- Admin curriculum CRUD (Phase A: modules + sessions) ------------------
class _AdminModuleBody(BaseModel):
    path_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    module_number: Optional[int] = None
    order_index: Optional[int] = None


class _AdminSessionBody(BaseModel):
    module_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None
    estimated_minutes: Optional[int] = None
    lecture_url: Optional[str] = None


class _AdminNotesCardBody(BaseModel):
    session_id: Optional[str] = None
    card_type: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    order_index: Optional[int] = None


class _AdminReorderBody(BaseModel):
    ids: List[str]  # ordered list of card ids — new order_index = position+1


class _AdminQuizItemBody(BaseModel):
    session_id: Optional[str] = None
    question: Optional[str] = None
    options: Optional[List[Any]] = None            # list[str] (or list[obj])
    correct_answer_index: Optional[int] = None
    explanation: Optional[str] = None
    difficulty: Optional[str] = None               # 'easy'|'medium'|'hard'
    order_index: Optional[int] = None


class _AdminInterviewQuestionBody(BaseModel):
    session_id: Optional[str] = None
    question: Optional[str] = None
    context: Optional[str] = None
    sample_strong_answer: Optional[str] = None
    evaluation_criteria: Optional[Any] = None      # dict/json blob
    order_index: Optional[int] = None


# --- Phase C bodies ---------------------------------------------------------
class _AdminCapstoneBody(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deliverable_description: Optional[str] = None
    estimated_hours: Optional[int] = None
    phases: Optional[Any] = None                   # full phases jsonb blob


class _AdminModuleProjectBody(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deliverable_description: Optional[str] = None
    estimated_hours: Optional[int] = None
    tasks: Optional[Any] = None                    # jsonb blob


class _ErrorReportBody(BaseModel):
    signature: str
    error_message: str
    error_stack: Optional[str] = None
    error_type: Optional[str] = "runtime"          # runtime|promise|react_boundary|user_report
    url: Optional[str] = None
    user_agent: Optional[str] = None
    user_id: Optional[str] = None
    user_description: Optional[str] = None         # optional colour from the learner


class _ErrorActionBody(BaseModel):
    action: str                                     # resolve|silence|reopen
    resolution_notes: Optional[str] = None


class MockInterviewAnswerReq(BaseModel):
    content: str
    input_method: Optional[str] = None  # 'voice' | 'text'
    round: int


# ===========================================================================
# Mock Interview LLM prompts
# ===========================================================================
INTERVIEWER_SYSTEM_BASE = """You are conducting a {round_name} round interview for an Associate Equity Research Analyst position at a top Indian firm (Motilal Oswal, ICICI Securities, or a global bank's Mumbai desk).

The candidate has completed structured prep covering financial modeling, ratio analysis, valuation, and Indian markets. Push them. Be polite but probing.

This is round {round} of 3. Ask ONE question at a time. After their answer, evaluate it silently and either:
- Ask a logical follow-up (drill deeper into a weak answer, or push to advanced if strong)
- Move to the next thematic area

Maximum 6 questions in this round. After the 6th candidate answer, end the round with a short transition: "Thank you. Let's move to the next round."

Round 1 — TECHNICAL: DCF mechanics, comparable companies, financial statement analysis, current market knowledge of Nifty/Sensex/RBI policy, specific Indian company case (Reliance/HDFC/Infosys), modeling judgement.
Round 2 — BEHAVIORAL: STAR-method probes. Times you've worked under pressure, dealt with conflict, made a difficult call, learned from failure. Force concrete examples.
Round 3 — FIT: Why equity research, why this firm (let them pick any firm), career trajectory, their best stock pitch, questions for us.

Use Indian context. Reference real companies. INR for currency. Don't be sycophantic — challenge weak answers.

Respond with ONLY your next utterance (your question, follow-up, or transition). No meta-commentary, no JSON, no role labels."""

SCORING_PROMPT = """Score this {round_name} round of a mock equity-research interview on a 0-100 scale. Be honest. Most candidates land 50-75. Score above 85 only for genuinely strong responses.

Return ONLY a JSON object (no markdown fences) with EXACTLY these keys:
{{
  "score": <number 0-100>,
  "strengths": ["...", "..."],
  "gaps": ["...", "..."],
  "feedback_bullets": ["...", "...", "..."]
}}

Transcript:
{transcript}"""

FINAL_VERDICT_PROMPT = """Based on the 3 round scores below, determine the verdict and write a ~200-word personalized feedback summary in markdown.

Round scores: Technical={t}, Behavioral={b}, Fit={f}, Average={avg}

Verdict thresholds:
- "strong_pass": avg >= 80
- "pass":        avg >= 70
- "marginal":    avg >= 55 (would invite for second-round in real life)
- "fail":        avg < 55

In your feedback, give them ONE specific thing to work on most urgently. Be direct. Reference their actual answers (excerpts in the transcript below). End with one encouraging sentence calibrated to their actual performance — don't over-praise marginal candidates.

Transcript excerpts:
{transcript_excerpts}

Return ONLY JSON: {{"verdict": "...", "feedback_md": "..."}}"""

ROUND_NAMES = {1: "technical", 2: "behavioral", 3: "fit"}
MAX_TURNS_PER_ROUND = 12  # 6 question/answer pairs


async def _llm_chat(system_message: str, user_text: str, session_tag: str, max_tokens: int = 700) -> str:
    """Wrapper around emergentintegrations LlmChat. Returns plain text."""
    if not _EMERGENT_LLM_KEY:
        return ""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = (
        LlmChat(api_key=_EMERGENT_LLM_KEY, session_id=session_tag,
                system_message=system_message)
        .with_model("anthropic", "claude-haiku-4-5-20251001")
        .with_params(max_tokens=max_tokens)
    )
    try:
        resp = await chat.send_message(UserMessage(text=user_text))
        return (resp or "").strip()
    except Exception as e:
        logger.warning(f"[mock-interview] LLM failed [{session_tag}]: {e}")
        return ""


def _strip_json_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = _re.sub(r"^```(?:json)?\s*", "", t)
        t = _re.sub(r"\s*```\s*$", "", t)
    return t.strip()


# ===========================================================================
# Mock Interview helpers
# ===========================================================================
def _get_interview_owned(interview_id: str, user_id: str) -> dict:
    rows = _supabase_get(
        f"user_mock_interviews?id=eq.{_urlparse.quote(interview_id)}"
        f"&user_id=eq.{_urlparse.quote(user_id)}&select=*&limit=1"
    ) or []
    if not rows:
        raise HTTPException(status_code=404, detail="interview not found")
    return rows[0]


def _get_turns(interview_id: str, round_num: Optional[int] = None) -> list[dict]:
    qs = f"interview_id=eq.{_urlparse.quote(interview_id)}"
    if round_num:
        qs += f"&round=eq.{round_num}"
    qs += "&select=*&order=round.asc,turn_idx.asc"
    return _supabase_get(f"mock_interview_turns?{qs}") or []


def _format_transcript(turns: list[dict]) -> str:
    parts = []
    for t in turns:
        role = "Interviewer" if t["role"] == "interviewer" else "Candidate"
        parts.append(f"{role}: {t['content']}")
    return "\n\n".join(parts)


async def _generate_first_question(round_num: int) -> tuple[str, str]:
    """Returns (interviewer_intro, first_question)."""
    round_name = ROUND_NAMES[round_num]
    system = INTERVIEWER_SYSTEM_BASE.format(round=round_num, round_name=round_name)
    user_text = f"Start the {round_name} round. First, write a one-sentence warm intro (e.g. 'Welcome — let's start with technicals.'). Then immediately on a new line, ask your first question. Output EXACTLY:\n\nINTRO: <one sentence>\nQUESTION: <your first question>"
    text = await _llm_chat(system, user_text, f"mi-r{round_num}-start", max_tokens=400)
    intro = ""
    question = ""
    for line in text.splitlines():
        if line.startswith("INTRO:"):
            intro = line[6:].strip()
        elif line.startswith("QUESTION:"):
            question = line[9:].strip()
    if not intro:
        intro = {
            1: "Welcome — let's start with technicals.",
            2: "Now I'd like to learn about how you work.",
            3: "Last round — let's talk about fit.",
        }[round_num]
    if not question:
        question = {
            1: "Walk me through the steps of building a DCF model for an Indian company like Reliance Industries.",
            2: "Tell me about a time you had to deliver a difficult result under tight deadline pressure. Use the STAR format.",
            3: "Why do you want a career in equity research, specifically at an Indian firm?",
        }[round_num]
    return intro, question


async def _generate_next_question(interview_id: str, round_num: int) -> tuple[str, bool]:
    """Returns (next_question_or_transition, round_complete_flag)."""
    turns = _get_turns(interview_id, round_num)
    candidate_count = sum(1 for t in turns if t["role"] == "candidate")
    if candidate_count >= 6:
        return ("Thank you. Let's move to the next round.", True)
    round_name = ROUND_NAMES[round_num]
    system = INTERVIEWER_SYSTEM_BASE.format(round=round_num, round_name=round_name)
    transcript = _format_transcript(turns)
    user_text = (
        f"Here is the conversation so far in this {round_name} round:\n\n{transcript}\n\n"
        f"The candidate has answered {candidate_count} time(s) so far. Continue the interview. "
        f"Ask your next question OR a follow-up to their last answer. Keep it ONE question. "
        f"If you've already covered enough ground for a typical {round_name} round AND candidate_count >= 5, "
        f"you may end with: 'Thank you. Let's move to the next round.'"
    )
    next_q = await _llm_chat(system, user_text, f"mi-{interview_id}-r{round_num}-q{candidate_count+1}", max_tokens=500)
    if not next_q:
        next_q = "Can you elaborate on that with a specific example or number?"
    is_end = "next round" in next_q.lower() and candidate_count >= 4
    return (next_q, is_end)


async def _score_round(interview_id: str, round_num: int) -> dict:
    round_name = ROUND_NAMES[round_num]
    turns = _get_turns(interview_id, round_num)
    transcript = _format_transcript(turns)
    user_text = SCORING_PROMPT.format(round_name=round_name, transcript=transcript[:6000])
    raw = await _llm_chat(
        "You are a senior interview coach evaluating mock equity-research interview rounds.",
        user_text,
        f"mi-{interview_id}-score-r{round_num}",
        max_tokens=700,
    )
    raw = _strip_json_fence(raw)
    try:
        data = _json.loads(raw)
    except Exception:
        data = {
            "score": 60,
            "strengths": ["Engaged with the prompts"],
            "gaps": ["Answers could be more specific"],
            "feedback_bullets": ["Practice quantifying your impact", "Use real Indian company examples", "Tighten structure with STAR"],
        }
    score_val = float(data.get("score", 60) or 60)
    score_val = max(0.0, min(100.0, score_val))
    row = {
        "interview_id": interview_id,
        "round": round_num,
        "round_name": round_name,
        "score": round(score_val, 2),
        "strengths": data.get("strengths") or [],
        "gaps": data.get("gaps") or [],
        "feedback_bullets": data.get("feedback_bullets") or [],
    }
    try:
        _supabase_post(
            "user_mock_interview_scores",
            row,
            prefer="resolution=merge-duplicates",
        )
    except Exception as e:
        logger.warning(f"[mock-interview] score persist failed: {e}")
    return row


async def _finalize_verdict(interview_id: str) -> dict:
    scores = _supabase_get(
        f"user_mock_interview_scores?interview_id=eq.{_urlparse.quote(interview_id)}"
        f"&select=round,round_name,score,feedback_bullets,strengths,gaps&order=round.asc"
    ) or []
    by_round = {s["round"]: s for s in scores}
    t = float(by_round.get(1, {}).get("score") or 0)
    b = float(by_round.get(2, {}).get("score") or 0)
    f = float(by_round.get(3, {}).get("score") or 0)
    avg = round((t + b + f) / 3.0, 2)
    # Excerpts for the LLM
    all_turns = _get_turns(interview_id)
    candidate_turns = [x for x in all_turns if x["role"] == "candidate"]
    excerpts = "\n".join(f"- (Round {x['round']}) {x['content'][:240]}" for x in candidate_turns[:9])
    user_text = FINAL_VERDICT_PROMPT.format(t=t, b=b, f=f, avg=avg, transcript_excerpts=excerpts)
    raw = await _llm_chat(
        "You are a senior interview coach delivering a final verdict on a 3-round mock equity-research interview.",
        user_text,
        f"mi-{interview_id}-verdict",
        max_tokens=900,
    )
    raw = _strip_json_fence(raw)
    try:
        data = _json.loads(raw)
        verdict = (data.get("verdict") or "").strip().lower()
        feedback_md = (data.get("feedback_md") or "").strip()
    except Exception:
        verdict = ""
        feedback_md = ""
    if verdict not in {"strong_pass", "pass", "marginal", "fail"}:
        if avg >= 80:
            verdict = "strong_pass"
        elif avg >= 70:
            verdict = "pass"
        elif avg >= 55:
            verdict = "marginal"
        else:
            verdict = "fail"
    if not feedback_md:
        feedback_md = (
            f"Your final average was **{avg}/100** ({verdict.replace('_',' ')}). "
            f"Round scores: Technical {t}, Behavioral {b}, Fit {f}. "
            "Keep building specificity in your answers with concrete numbers and Indian-market examples."
        )
    return {
        "final_score": avg,
        "verdict": verdict,
        "feedback_md": feedback_md,
        "per_round_scores": [by_round.get(r) for r in (1, 2, 3) if by_round.get(r)],
    }


# ===========================================================================
# Router
# ===========================================================================
def register_wave_endpoints(api_router: APIRouter, deps: dict):
    """Inject helpers from server.py and register the new routes."""
    global _supabase_get, _supabase_post, _supabase_patch, _supabase_delete, _get_supabase_user, _EMERGENT_LLM_KEY
    _supabase_get = deps["supabase_get"]
    _supabase_post = deps["supabase_post"]
    _supabase_patch = deps["supabase_patch"]
    _supabase_delete = deps.get("supabase_delete")
    _get_supabase_user = deps["get_supabase_user"]
    _EMERGENT_LLM_KEY = deps.get("emergent_llm_key")

    # ---------------- SESSION FEEDBACK (student → admin) ----------------
    _FEEDBACK_CATEGORIES = {"content_issue", "quality_issue", "other"}

    @api_router.post("/sessions/{session_id}/feedback")
    async def submit_session_feedback(session_id: str, body: dict,
                                       user=Depends(_get_supabase_user)):
        """Student-submitted feedback on a session lecture. Categories:
        content_issue | quality_issue | other. Requires message (>=5 chars).
        Rate-limited at the DB via a soft app-level check — a user can't
        spam more than 5 feedback rows per session."""
        category = (body.get("category") or "").strip().lower()
        message = (body.get("message") or "").strip()
        if category not in _FEEDBACK_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"category must be one of {sorted(_FEEDBACK_CATEGORIES)}")
        if len(message) < 5:
            raise HTTPException(status_code=400, detail="message must be at least 5 characters")
        if len(message) > 2000:
            raise HTTPException(status_code=400, detail="message must be under 2000 characters")
        # Soft rate-limit: cap at 5 rows per (user, session)
        existing = _supabase_get(
            f"session_feedback?user_id=eq.{_urlparse.quote(user['id'])}"
            f"&session_id=eq.{_urlparse.quote(session_id)}"
            f"&select=id"
        ) or []
        if len(existing) >= 5:
            raise HTTPException(status_code=429, detail="You've already submitted the max 5 feedback entries for this session.")
        row = _supabase_post(
            "session_feedback",
            {
                "user_id": user["id"],
                "session_id": session_id,
                "category": category,
                "message": message,
            },
            prefer="return=representation",
        )
        if isinstance(row, list):
            row = row[0] if row else None
        return {"ok": True, "feedback": row}

    @api_router.get("/admin/session-feedback")
    async def admin_session_feedback_list(
        resolved: Optional[bool] = None,
        category: Optional[str] = None,
        user=Depends(_get_supabase_user),
    ):
        _ensure_admin(user)
        filters = ["select=id,user_id,session_id,category,message,resolved,admin_notes,created_at,resolved_at"]
        if resolved is not None:
            filters.append(f"resolved=eq.{'true' if resolved else 'false'}")
        if category and category in _FEEDBACK_CATEGORIES:
            filters.append(f"category=eq.{_urlparse.quote(category)}")
        filters.append("order=created_at.desc")
        filters.append("limit=1000")
        try:
            rows = _supabase_get("session_feedback?" + "&".join(filters)) or []
        except HTTPException as e:
            detail = str(e.detail or "")
            if "PGRST205" in detail and "session_feedback" in detail:
                return {"total": 0, "feedback": [], "table_ready": False}
            raise
        # Best-effort enrich with user + session names (small N of admin views)
        user_ids = list({r["user_id"] for r in rows if r.get("user_id")})
        session_ids = list({r["session_id"] for r in rows if r.get("session_id")})
        users_map = {}
        sessions_map = {}
        if user_ids:
            profs = _supabase_get(
                f"profiles?id=in.({','.join(user_ids)})&select=id,full_name,email"
            ) or []
            users_map = {p["id"]: p for p in profs}
        if session_ids:
            sess = _supabase_get(
                f"master_sessions?id=in.({','.join(session_ids)})&select=id,title,module_id"
            ) or []
            sessions_map = {s["id"]: s for s in sess}
        for r in rows:
            u = users_map.get(r.get("user_id") or "", {})
            s = sessions_map.get(r.get("session_id") or "", {})
            r["user_full_name"] = u.get("full_name")
            r["user_email"] = u.get("email")
            r["session_title"] = s.get("title")
            r["module_id"] = s.get("module_id")
        return {
            "total": len(rows),
            "feedback": rows,
            "counts": {
                "open": sum(1 for r in rows if not r.get("resolved")),
                "resolved": sum(1 for r in rows if r.get("resolved")),
            },
            "table_ready": True,
        }

    @api_router.patch("/admin/session-feedback/{fid}/resolve")
    async def admin_resolve_feedback(fid: str, body: dict,
                                      user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        resolved = bool(body.get("resolved", True))
        notes = (body.get("admin_notes") or "").strip() or None
        patch = {
            "resolved": resolved,
            "admin_notes": notes,
            "resolved_at": datetime.now(timezone.utc).isoformat() if resolved else None,
        }
        _supabase_patch(
            f"session_feedback?id=eq.{_urlparse.quote(fid)}", patch,
        )
        return {"ok": True}

    @api_router.delete("/admin/session-feedback/{fid}")
    async def admin_delete_feedback(fid: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        deleted = _supabase_delete(
            f"session_feedback?id=eq.{_urlparse.quote(fid)}"
        ) or []
        if not deleted:
            raise HTTPException(status_code=404, detail="Feedback not found")
        return {"ok": True}

    # ---------------- ADMIN PANEL ----------------
    # ---- AI Customisation mode + questions (admin CRUD) ----------------
    _AI_MODE_KEY = "ai_customization_mode"
    _VALID_MODES = {"off", "optional", "mandatory"}

    @api_router.get("/app-settings/ai-customization")
    async def public_ai_customization_mode():
        """Public — the enrolment page reads this to decide whether to show
        the 'Customise with AI' button. Defaults to 'off' if the row/table
        is missing (safe default)."""
        try:
            rows = _supabase_get(
                f"app_settings?key=eq.{_AI_MODE_KEY}&select=value_json&limit=1"
            ) or []
            mode = (rows[0].get("value_json") or {}).get("mode", "off") if rows else "off"
        except HTTPException:
            mode = "off"
        if mode not in _VALID_MODES:
            mode = "off"
        return {"mode": mode}

    @api_router.patch("/admin/app-settings/ai-customization")
    async def admin_set_ai_customization_mode(body: dict, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        mode = (body.get("mode") or "").strip().lower()
        if mode not in _VALID_MODES:
            raise HTTPException(status_code=400, detail=f"mode must be one of {sorted(_VALID_MODES)}")
        # Upsert
        try:
            _supabase_post(
                "app_settings?on_conflict=key",
                {"key": _AI_MODE_KEY, "value_json": {"mode": mode},
                 "updated_at": datetime.now(timezone.utc).isoformat()},
                prefer="resolution=merge-duplicates,return=representation",
            )
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=f"Failed to persist mode: {e.detail}")
        return {"mode": mode}

    def _is_cust_table_missing(exc: HTTPException) -> bool:
        try:
            detail = str(exc.detail or "")
        except Exception:
            return False
        return "PGRST205" in detail and "master_customization_questions" in detail

    _CUST_QS_ALLOWED_TYPES = {"single_select", "multi_select", "text", "number"}

    @api_router.get("/customization-questions")
    async def public_customization_questions(path_id: Optional[str] = None):
        """Powers the customisation wizard. Filters by path_id when given."""
        path_filter = f"&path_id=eq.{_urlparse.quote(path_id)}" if path_id else ""
        try:
            rows = _supabase_get(
                "master_customization_questions?select=id,path_id,question_text,"
                "question_type,options,order_index,is_required,purpose"
                f"{path_filter}&order=order_index.asc&limit=200"
            ) or []
            return {"questions": rows}
        except HTTPException as e:
            if _is_cust_table_missing(e):
                return {"questions": []}
            raise

    @api_router.get("/admin/customization-questions")
    async def admin_customization_questions(user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        try:
            rows = _supabase_get(
                "master_customization_questions?select=id,path_id,question_text,"
                "question_type,options,order_index,is_required,purpose"
                "&order=order_index.asc&limit=500"
            ) or []
            return {"total": len(rows), "questions": rows}
        except HTTPException as e:
            if _is_cust_table_missing(e):
                return {"total": 0, "questions": [], "table_ready": False}
            raise

    def _validate_cust_q_body(body: dict) -> dict:
        question_text = (body.get("question_text") or "").strip()
        qtype = (body.get("question_type") or "").strip().lower()
        if not question_text:
            raise HTTPException(status_code=400, detail="question_text is required")
        if qtype not in _CUST_QS_ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail=f"question_type must be one of {sorted(_CUST_QS_ALLOWED_TYPES)}")
        # options: JSON list for select types, ignored for text/number
        options = body.get("options") or []
        if qtype in {"single_select", "multi_select"}:
            if not isinstance(options, list) or len(options) < 2:
                raise HTTPException(status_code=400, detail="Select-type questions need at least 2 options")
            for i, opt in enumerate(options):
                if not isinstance(opt, dict) or not opt.get("value") or not opt.get("label"):
                    raise HTTPException(status_code=400, detail=f"Option #{i+1} must have both `value` and `label`")
        else:
            options = []
        return {
            "question_text": question_text,
            "question_type": qtype,
            "options": options,
            "order_index": int(body.get("order_index") or 100),
            "is_required": bool(body.get("is_required", True)),
            "purpose": (body.get("purpose") or "").strip() or None,
            "path_id": body.get("path_id") or None,
        }

    @api_router.post("/admin/customization-questions")
    async def admin_customization_create(body: dict, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        payload = _validate_cust_q_body(body)
        if not payload.get("path_id"):
            raise HTTPException(status_code=400, detail="path_id is required (which course does this apply to?)")
        row = _supabase_post(
            "master_customization_questions", payload,
            prefer="return=representation",
        )
        if isinstance(row, list):
            row = row[0] if row else None
        return {"question": row}

    @api_router.patch("/admin/customization-questions/{qid}")
    async def admin_customization_update(qid: str, body: dict, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        # Only validate fields the caller actually provided
        allowed = {"question_text", "question_type", "options", "order_index",
                   "is_required", "purpose", "path_id"}
        supplied = {k: v for k, v in body.items() if k in allowed and v is not None}
        if not supplied:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        # If question_type is changing OR options are provided for a select-type,
        # re-validate the shape.
        if "question_type" in supplied or "options" in supplied:
            merged = {**body}
            # Pull the current row for a safe merge
            cur = _supabase_get(
                f"master_customization_questions?id=eq.{_urlparse.quote(qid)}&select=*&limit=1"
            ) or []
            if not cur:
                raise HTTPException(status_code=404, detail="Question not found")
            for k in ("question_text", "question_type", "options"):
                merged.setdefault(k, cur[0].get(k))
            _validate_cust_q_body(merged)
        _supabase_patch(
            f"master_customization_questions?id=eq.{_urlparse.quote(qid)}", supplied,
        )
        rows = _supabase_get(
            f"master_customization_questions?id=eq.{_urlparse.quote(qid)}&select=*&limit=1"
        ) or []
        return {"question": rows[0] if rows else None}

    @api_router.delete("/admin/customization-questions/{qid}")
    async def admin_customization_delete(qid: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        deleted = _supabase_delete(
            f"master_customization_questions?id=eq.{_urlparse.quote(qid)}"
        ) or []
        if not deleted:
            raise HTTPException(status_code=404, detail="Question not found")
        return {"ok": True}

    # ---- FAQs (public read + admin CRUD) -------------------------------
    #
    # Gracefully degrade when the `faqs` table hasn't been created yet in
    # Supabase (migration 0033_faqs.sql not yet applied). The frontend then
    # falls back to the static 22-item list from `/app/frontend/src/data/faqs.js`.
    _FAQ_TABLE_MISSING_HINT = (
        "The `faqs` table isn't present in Supabase yet. Run "
        "`/app/scripts/migrations/0033_faqs.sql` in the Supabase SQL editor. "
        "The public site keeps working via the static fallback until then."
    )

    def _is_faq_table_missing(exc: HTTPException) -> bool:
        try:
            detail = str(exc.detail or "")
        except Exception:
            return False
        return "PGRST205" in detail or "Could not find the table 'public.faqs'" in detail

    @api_router.get("/faqs")
    async def public_faqs():
        """Public — powers the landing accordion + help chatbot. Returns an
        empty list if the table hasn't been provisioned yet so the FE's
        static fallback engages cleanly."""
        try:
            rows = _supabase_get(
                "faqs?select=id,category,question,answer,tags,order_index"
                "&is_published=eq.true&order=order_index.asc&limit=500"
            ) or []
            return {"faqs": rows}
        except HTTPException as e:
            if _is_faq_table_missing(e):
                return {"faqs": [], "table_ready": False}
            raise

    @api_router.get("/admin/faqs")
    async def admin_faqs_list(user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        try:
            rows = _supabase_get(
                "faqs?select=id,category,question,answer,tags,order_index,is_published,updated_at"
                "&order=order_index.asc&limit=500"
            ) or []
            return {"total": len(rows), "faqs": rows, "table_ready": True}
        except HTTPException as e:
            if _is_faq_table_missing(e):
                # Return an empty state + a machine-readable flag so the
                # admin FE can render a "Run migration first" banner instead
                # of a scary error page.
                return {
                    "total": 0,
                    "faqs": [],
                    "table_ready": False,
                    "hint": _FAQ_TABLE_MISSING_HINT,
                }
            raise

    @api_router.post("/admin/faqs")
    async def admin_faqs_create(body: dict, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        category = (body.get("category") or "").strip()
        question = (body.get("question") or "").strip()
        answer = (body.get("answer") or "").strip()
        if not category or not question or not answer:
            raise HTTPException(status_code=400, detail="category, question, and answer are required")
        tags = body.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]
        try:
            row = _supabase_post(
                "faqs",
                {
                    "category": category,
                    "question": question,
                    "answer": answer,
                    "tags": tags,
                    "order_index": int(body.get("order_index") or 100),
                    "is_published": bool(body.get("is_published", True)),
                },
                prefer="return=representation",
            )
        except HTTPException as e:
            if _is_faq_table_missing(e):
                raise HTTPException(status_code=503, detail=_FAQ_TABLE_MISSING_HINT)
            raise
        if isinstance(row, list):
            row = row[0] if row else None
        return {"faq": row}

    @api_router.patch("/admin/faqs/{faq_id}")
    async def admin_faqs_update(faq_id: str, body: dict, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        allowed = {"category", "question", "answer", "tags", "order_index", "is_published"}
        patch = {k: v for k, v in body.items() if k in allowed and v is not None}
        if "tags" in patch and isinstance(patch["tags"], str):
            patch["tags"] = [t.strip() for t in patch["tags"].split(",") if t.strip()]
        if not patch:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        patch["updated_at"] = datetime.now(timezone.utc).isoformat()
        try:
            _supabase_patch(f"faqs?id=eq.{_urlparse.quote(faq_id)}", patch)
            rows = _supabase_get(
                f"faqs?id=eq.{_urlparse.quote(faq_id)}&select=*&limit=1"
            ) or []
        except HTTPException as e:
            if _is_faq_table_missing(e):
                raise HTTPException(status_code=503, detail=_FAQ_TABLE_MISSING_HINT)
            raise
        return {"faq": rows[0] if rows else None}

    @api_router.delete("/admin/faqs/{faq_id}")
    async def admin_faqs_delete(faq_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        try:
            deleted = _supabase_delete(f"faqs?id=eq.{_urlparse.quote(faq_id)}") or []
        except HTTPException as e:
            if _is_faq_table_missing(e):
                raise HTTPException(status_code=503, detail=_FAQ_TABLE_MISSING_HINT)
            raise
        if not deleted:
            raise HTTPException(status_code=404, detail="FAQ not found")
        return {"ok": True}

    @api_router.get("/admin/waitlist")
    async def admin_waitlist(user=Depends(_get_supabase_user)):
        """Read all waitlist signups from Supabase (persistent). Was Mongo
        pre-Feb 2026 but that got wiped on production redeploys — see
        scripts/migrations/0031_waitlist.sql."""
        _ensure_admin(user)
        rows = _supabase_get(
            "waitlist?select=id,first_name,email,position,referral_code,"
            "referral_count,referred_by,timestamp"
            "&order=timestamp.desc&limit=5000"
        ) or []
        return {"total": len(rows), "entries": rows}

    @api_router.post("/admin/waitlist/import")
    async def admin_waitlist_import(body: dict, user=Depends(_get_supabase_user)):
        """Bulk-import waitlist rows from a CSV the admin exported from
        production Mongo (post Feb-2026 migration). Body shape:

            { "csv": "first_name,email,timestamp,referral_code\\n..." }

        - `email` is required; other fields optional (defaulted).
        - The trailing header row is auto-detected.
        - Existing emails are skipped (not overwritten). Referral codes that
          collide with existing rows are regenerated.
        - Returns a per-row summary: {inserted, skipped_existing, errors[]}.

        Only admins (via _ensure_admin) can call this endpoint.
        """
        import csv as _csv
        import io as _io
        import random as _random
        import string as _string
        import uuid as _uuid
        from datetime import datetime as _dt, timezone as _tz

        _ensure_admin(user)
        raw = (body or {}).get("csv") or ""
        if not raw.strip():
            raise HTTPException(status_code=400, detail="csv field is empty")

        reader = _csv.DictReader(_io.StringIO(raw))
        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="CSV has no header row")

        # Normalise header lookup (case + whitespace insensitive)
        def _norm(k):
            return (k or "").strip().lower().replace(" ", "_")
        headers_map = { _norm(h): h for h in reader.fieldnames }
        if "email" not in headers_map:
            raise HTTPException(status_code=400, detail="CSV must have an 'email' column")

        # Pull existing emails + referral codes in one shot to avoid N round-trips
        existing_rows = _supabase_get(
            "waitlist?select=email,referral_code&limit=100000"
        ) or []
        existing_emails = {(r.get("email") or "").lower() for r in existing_rows}
        existing_codes = {r.get("referral_code") for r in existing_rows if r.get("referral_code")}

        def _gen_code():
            for _ in range(10):
                c = "".join(_random.choices(_string.ascii_uppercase + _string.digits, k=6))
                if c not in existing_codes:
                    existing_codes.add(c)
                    return c
            return "".join(_random.choices(_string.ascii_uppercase + _string.digits, k=8))

        to_insert = []
        skipped = 0
        errors = []
        for i, row in enumerate(reader, start=1):
            email_raw = (row.get(headers_map["email"]) or "").strip().lower()
            if not email_raw or "@" not in email_raw:
                errors.append({"row": i, "reason": f"invalid email: {email_raw!r}"})
                continue
            if email_raw in existing_emails:
                skipped += 1
                continue
            existing_emails.add(email_raw)

            first_name = (row.get(headers_map.get("first_name", "")) or "").strip() or "Friend"
            ts_raw = (row.get(headers_map.get("timestamp", "")) or "").strip()
            try:
                # Accept either ISO8601 or common formats; fall back to now.
                if ts_raw:
                    # If bare date, promote to midnight UTC.
                    if len(ts_raw) == 10 and ts_raw.count("-") == 2:
                        ts_iso = ts_raw + "T00:00:00+00:00"
                    else:
                        ts_iso = ts_raw
                    # Validate by parsing
                    _dt.fromisoformat(ts_iso.replace("Z", "+00:00"))
                else:
                    ts_iso = _dt.now(_tz.utc).isoformat()
            except Exception:
                ts_iso = _dt.now(_tz.utc).isoformat()

            pos_raw = (row.get(headers_map.get("position", "")) or "").strip()
            try:
                position = int(pos_raw) if pos_raw else _random.randint(200, 350)
            except ValueError:
                position = _random.randint(200, 350)

            code = (row.get(headers_map.get("referral_code", "")) or "").strip().upper()
            if not code or code in existing_codes:
                code = _gen_code()
            else:
                existing_codes.add(code)

            try:
                ref_count = int((row.get(headers_map.get("referral_count", "")) or "0").strip() or 0)
            except ValueError:
                ref_count = 0

            to_insert.append({
                "id": str(_uuid.uuid4()),
                "first_name": first_name,
                "email": email_raw,
                "position": position,
                "timestamp": ts_iso,
                "referral_code": code,
                "referral_count": ref_count,
                "referred_by": (row.get(headers_map.get("referred_by", "")) or "").strip() or None,
            })

        inserted = 0
        # Batch insert in chunks of 500
        for i in range(0, len(to_insert), 500):
            batch = to_insert[i:i + 500]
            try:
                _supabase_post("waitlist", batch, prefer="return=minimal")
                inserted += len(batch)
            except HTTPException as e:
                errors.append({"batch_start": i, "reason": str(e.detail)[:400]})

        return {
            "inserted": inserted,
            "skipped_existing": skipped,
            "errors": errors,
            "parsed_rows": inserted + skipped + len(errors),
        }

    @api_router.get("/admin/users")
    async def admin_users(user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        profiles = _supabase_get(
            "profiles?select=id,full_name,email,country_code,created_at&order=created_at.desc&limit=2000"
        ) or []
        enrollments = _supabase_get(
            "user_enrollments?select=user_id,status,title,master_path_id,enrolled_at&order=enrolled_at.desc&limit=5000"
        ) or []
        plans = _supabase_get(
            "user_study_plans?status=eq.active&select=user_id&limit=5000"
        ) or []
        activity = _supabase_get(
            "user_daily_activity?select=user_id,activity_date&order=activity_date.desc&limit=10000"
        ) or []
        active_plan_ids = {p["user_id"] for p in plans}
        last_active_by = {}
        for a in activity:
            uid = a["user_id"]
            if uid not in last_active_by:
                last_active_by[uid] = a.get("activity_date")
        enrollment_by_user = {}
        for e in enrollments:
            if e["user_id"] not in enrollment_by_user:
                enrollment_by_user[e["user_id"]] = e
        out = []
        for p in profiles:
            uid = p["id"]
            e = enrollment_by_user.get(uid)
            out.append({
                "user_id": uid,
                "full_name": p.get("full_name") or "",
                "email": p.get("email") or "",
                "country_code": p.get("country_code") or "",
                "signup_at": p.get("created_at"),
                "enrolled": bool(e),
                "enrollment_at": e.get("enrolled_at") if e else None,
                "enrollment_status": e.get("status") if e else None,
                "course_title": e.get("title") if e else None,
                "last_active": last_active_by.get(uid),
                "active_plan": uid in active_plan_ids,
            })
        return {"total": len(out), "users": out}

    @api_router.post("/admin/users/create")
    async def admin_create_user(body: _AdminCreateUserBody, user=Depends(_get_supabase_user)):
        """Admin-only manual user creation. Uses Supabase Admin API to create the
        auth user (email_confirm=true so they can log in immediately), inserts a
        `profiles` row, and optionally seeds the standard Equity Research
        enrollment (all 22 modules + all sessions) via the same helper used by
        the frontend `enrollDirect` flow."""
        _ensure_admin(user)
        if not _SUPABASE_SR:
            raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY missing on server")
        # Basic validation
        email = (body.email or "").strip().lower()
        pwd = body.password or ""
        if not email or "@" not in email:
            raise HTTPException(status_code=400, detail="Invalid email.")
        if len(pwd) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
        role = (body.role or "user").strip().lower()
        if role not in ("user", "admin"):
            role = "user"
        display_name = (body.display_name or "").strip()

        import urllib.request as _ur
        # 1. Create the auth user via Supabase Admin API
        admin_url = f"{_SUPABASE_REST_URL}/auth/v1/admin/users"
        payload = {
            "email": email,
            "password": pwd,
            "email_confirm": True,
            "user_metadata": {"full_name": display_name or None},
        }
        req = _ur.Request(
            admin_url, method="POST",
            data=_json.dumps(payload).encode(),
            headers={
                "apikey": _SUPABASE_SR,
                "Authorization": f"Bearer {_SUPABASE_SR}",
                "Content-Type": "application/json",
            },
        )
        try:
            with _ur.urlopen(req, timeout=15) as r:
                created_auth = _json.loads(r.read())
        except urllib.error.HTTPError as e:
            body_err = e.read().decode("utf-8", errors="replace")
            # Duplicate-email surfaces as 422 or 400 from Supabase
            if e.code in (400, 422) and ("already" in body_err.lower() or "exists" in body_err.lower()):
                raise HTTPException(status_code=409, detail="A user with that email already exists.")
            logger.error("admin_create_user auth failed: %s", body_err[:400])
            raise HTTPException(status_code=500, detail=f"Supabase auth create failed: {body_err[:200]}")

        new_user_id = created_auth.get("id") or (created_auth.get("user") or {}).get("id")
        if not new_user_id:
            raise HTTPException(status_code=500, detail="Supabase did not return a user id.")

        # 2. Upsert profiles row. `role` isn't a column on profiles today, so we
        # only write the fields the schema actually has. Role is still surfaced
        # in the response for admin visibility.
        try:
            _supabase_post(
                "profiles",
                {"id": new_user_id, "email": email, "full_name": display_name},
                prefer="resolution=merge-duplicates,return=minimal",
            )
        except Exception as e:
            logger.warning("admin_create_user profile upsert failed: %s", e)

        # 3. Optional auto-enrollment in Equity Research
        enrollment_id = None
        if body.auto_enroll:
            try:
                enrollment_id = _seed_default_enrollment(new_user_id)
            except Exception as e:
                logger.warning("admin_create_user seed_enrollment failed: %s", e)

        return {
            "user_id": new_user_id,
            "email": email,
            "password": pwd,     # returned ONCE so the admin can copy + share
            "display_name": display_name,
            "role": role,
            "enrolled": bool(enrollment_id),
            "enrollment_id": enrollment_id,
        }

    def _seed_default_enrollment(user_id: str) -> Optional[str]:
        """Mirrors frontend enrollDirect() — insert user_enrollments +
        user_modules + user_sessions for the Equity Research career path.
        Returns enrollment_id or None if the path/data is missing."""
        # Find the Equity Research master_path
        paths = _supabase_get("master_paths?select=id,title&is_active=eq.true&limit=5") or []
        if not paths:
            return None
        path = paths[0]  # only one active career path today
        # Idempotent — reuse existing enrollment if present
        existing = _supabase_get(
            f"user_enrollments?user_id=eq.{_urlparse.quote(user_id)}"
            f"&master_path_id=eq.{_urlparse.quote(path['id'])}&select=id&limit=1"
        ) or []
        if existing:
            return existing[0]["id"]
        enrollment = _supabase_post(
            "user_enrollments",
            {"user_id": user_id, "master_path_id": path["id"],
             "title": path.get("title"), "status": "active"},
            prefer="return=representation",
        )
        if isinstance(enrollment, list) and enrollment:
            enrollment_id = enrollment[0]["id"]
        elif isinstance(enrollment, dict):
            enrollment_id = enrollment.get("id")
        else:
            return None

        modules = _supabase_get(
            f"master_modules?path_id=eq.{_urlparse.quote(path['id'])}"
            "&select=id,title,order_index,module_number&order=order_index&limit=100"
        ) or []
        if not modules:
            return enrollment_id
        module_rows = [{
            "enrollment_id": enrollment_id,
            "master_module_id": m["id"],
            "title": m.get("title"),
            "order_index": m.get("order_index"),
            "module_number": m.get("module_number") or m.get("order_index"),
            "is_removed": False,
        } for m in modules]
        inserted_mods = _supabase_post(
            "user_modules", module_rows,
            prefer="return=representation",
        ) or []
        um_by_master = {r["master_module_id"]: r["id"] for r in inserted_mods if r.get("master_module_id")}
        # Sessions
        master_module_ids = ",".join(_urlparse.quote(m["id"]) for m in modules)
        sessions = _supabase_get(
            f"master_sessions?module_id=in.({master_module_ids})"
            "&select=id,module_id,title,order_index&order=order_index&limit=500"
        ) or []
        sess_rows = []
        for s in sessions:
            umid = um_by_master.get(s["module_id"])
            if not umid:
                continue
            sess_rows.append({
                "user_module_id": umid,
                "master_session_id": s["id"],
                "title": s.get("title"),
                "order_index": s.get("order_index") or 0,
                "is_removed": False,
                "is_added_by_ai": False,
            })
        if sess_rows:
            _supabase_post("user_sessions", sess_rows)
        return enrollment_id


    @api_router.get("/admin/users/{user_id}/progress")
    async def admin_user_progress(user_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        stats = (_supabase_get(
            f"user_stats?user_id=eq.{_urlparse.quote(user_id)}&select=total_xp,current_level,current_streak_days,longest_streak_days&limit=1"
        ) or [{}])[0]
        plan = _supabase_get(
            f"user_plan_adherence?user_id=eq.{_urlparse.quote(user_id)}&select=on_schedule_streak_days,longest_on_schedule_streak,last_on_track_date&limit=1"
        ) or [{}]
        plan = plan[0] if plan else {}
        # user_sessions has no direct user_id; must join via user_modules → enrollment_id
        modules = _supabase_get(
            f"user_modules?select=id,order_index,title,is_completed,master_module_id,enrollment_id"
            f"&enrollment_id=in.({','.join([_urlparse.quote(e['id']) for e in (_supabase_get(f'user_enrollments?user_id=eq.{_urlparse.quote(user_id)}&select=id&limit=20') or [])]) or 'none'})"
            f"&order=order_index.asc&limit=50"
        ) or []
        # Now fetch sessions for those modules
        module_ids = [m["id"] for m in modules]
        sessions = []
        if module_ids:
            id_list = ",".join(module_ids)
            sessions = _supabase_get(
                f"user_sessions?user_module_id=in.({id_list})&select=user_module_id,is_completed&limit=2000"
            ) or []
        sess_by_mod: dict[str, dict] = {}
        for s in sessions:
            m = sess_by_mod.setdefault(s["user_module_id"], {"total": 0, "done": 0})
            m["total"] += 1
            if s.get("is_completed"):
                m["done"] += 1
        modules_out = []
        total_done = total_all = 0
        for m in modules:
            agg = sess_by_mod.get(m["id"], {"total": 0, "done": 0})
            total_done += agg["done"]
            total_all += agg["total"]
            modules_out.append({
                "id": m["id"], "order_index": m["order_index"], "title": m["title"],
                "is_completed": m["is_completed"],
                "sessions_done": agg["done"], "sessions_total": agg["total"],
            })
        return {
            "user_id": user_id,
            "stats": {
                "total_xp": stats.get("total_xp") or 0,
                "current_level": stats.get("current_level") or 1,
                "current_streak_days": stats.get("current_streak_days") or 0,
                "longest_streak_days": stats.get("longest_streak_days") or 0,
                "on_schedule_streak": plan.get("on_schedule_streak_days") or 0,
                "longest_on_schedule_streak": plan.get("longest_on_schedule_streak") or 0,
                "last_on_track_date": plan.get("last_on_track_date"),
            },
            "modules": modules_out,
            "sessions_done": total_done,
            "sessions_total": total_all,
            "modules_done": sum(1 for m in modules_out if m["is_completed"]),
            "modules_total": len(modules_out),
        }

    # ---------------- ADMIN · SESSION VIDEOS ----------------
    _SUPABASE_REST_URL = (
        os.environ.get("REACT_APP_SUPABASE_URL")
        or "https://yuadeybycbfqlkdpxbkv.supabase.co"
    ).rstrip("/")
    _SUPABASE_SR = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    _VIDEO_BUCKET = "session-videos"
    _MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024   # 5 GB — matches Supabase Pro tier ceiling

    def _bucket_public_url(key: str) -> str:
        return f"{_SUPABASE_REST_URL}/storage/v1/object/public/{_VIDEO_BUCKET}/{key}"

    def _bucket_key_for(module_number: int, order_index: int) -> str:
        return f"m{module_number}/s{module_number}-{order_index}.mp4"

    @api_router.get("/admin/sessions/videos")
    async def admin_sessions_videos(user=Depends(_get_supabase_user)):
        """Returns every module + its sessions with current lecture_url state."""
        _ensure_admin(user)
        modules = _supabase_get(
            "master_modules?select=id,module_number,title,order_index&order=order_index.asc&limit=100"
        ) or []
        sessions = _supabase_get(
            "master_sessions?select=id,module_id,order_index,title,lecture_url"
            "&order=module_id,order_index&limit=1000"
        ) or []
        by_mod: dict[str, list] = {}
        for s in sessions:
            by_mod.setdefault(s["module_id"], []).append(s)
        out = []
        for m in modules:
            rows = sorted(by_mod.get(m["id"], []), key=lambda r: r.get("order_index") or 0)
            out.append({
                "module_id":     m["id"],
                "module_number": m.get("module_number"),
                "module_title":  m.get("title") or "",
                "sessions": [{
                    "id":           s["id"],
                    "order_index":  s.get("order_index"),
                    "title":        s.get("title") or "",
                    "lecture_url":  s.get("lecture_url"),
                    "has_video":    bool(s.get("lecture_url")),
                } for s in rows],
            })
        return {"modules": out}

    @api_router.post("/admin/sessions/{session_id}/video")
    async def admin_upload_session_video(session_id: str, file: UploadFile = File(...),
                                         user=Depends(_get_supabase_user)):
        """Uploads a video to Supabase Storage and PATCHes master_sessions.lecture_url."""
        _ensure_admin(user)
        if not _SUPABASE_SR:
            raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY missing on server")
        allowed_ct = {"video/mp4", "video/webm", "video/quicktime", "application/octet-stream"}
        if (file.content_type or "").lower() not in allowed_ct:
            raise HTTPException(status_code=400,
                detail=f"Unsupported content type {file.content_type!r} — mp4/webm only.")

        # Resolve session → module_number + order_index so we can pick a clean key.
        sess_rows = _supabase_get(
            f"master_sessions?id=eq.{_urlparse.quote(session_id)}"
            "&select=id,order_index,module_id&limit=1"
        ) or []
        if not sess_rows:
            raise HTTPException(status_code=404, detail="Session not found.")
        sess = sess_rows[0]
        mod_rows = _supabase_get(
            f"master_modules?id=eq.{_urlparse.quote(sess['module_id'])}"
            "&select=module_number&limit=1"
        ) or []
        if not mod_rows or mod_rows[0].get("module_number") is None:
            raise HTTPException(status_code=404, detail="Module not found or has no module_number.")
        module_number = int(mod_rows[0]["module_number"])
        order_index = int(sess.get("order_index") or 1)

        # Read stream — cap at 500MB
        blob = await file.read()
        if len(blob) > _MAX_VIDEO_BYTES:
            raise HTTPException(status_code=413,
                detail=f"File too large ({len(blob)/1048576:.1f} MB). Max 500 MB.")
        if len(blob) < 1024:
            raise HTTPException(status_code=400, detail="File is empty or too small.")

        key = _bucket_key_for(module_number, order_index)
        import urllib.request
        req = urllib.request.Request(
            f"{_SUPABASE_REST_URL}/storage/v1/object/{_VIDEO_BUCKET}/{key}",
            data=blob, method="POST",
            headers={
                "apikey": _SUPABASE_SR,
                "Authorization": f"Bearer {_SUPABASE_SR}",
                "Content-Type": (file.content_type or "video/mp4"),
                "x-upsert": "true",
                "cache-control": "public, max-age=31536000, immutable",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                resp.read()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Storage upload failed: {e}")

        public_url = _bucket_public_url(key)
        _supabase_patch(
            f"master_sessions?id=eq.{_urlparse.quote(session_id)}",
            {"lecture_url": public_url},
        )
        return {"ok": True, "lecture_url": public_url, "bytes": len(blob), "key": key}

    @api_router.delete("/admin/sessions/{session_id}/video")
    async def admin_delete_session_video(session_id: str, user=Depends(_get_supabase_user)):
        """Removes video from Supabase Storage AND nulls master_sessions.lecture_url."""
        _ensure_admin(user)
        if not _SUPABASE_SR:
            raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY missing on server")
        sess_rows = _supabase_get(
            f"master_sessions?id=eq.{_urlparse.quote(session_id)}"
            "&select=id,order_index,module_id,lecture_url&limit=1"
        ) or []
        if not sess_rows:
            raise HTTPException(status_code=404, detail="Session not found.")
        sess = sess_rows[0]
        if not sess.get("lecture_url"):
            return {"ok": True, "already_empty": True}
        mod_rows = _supabase_get(
            f"master_modules?id=eq.{_urlparse.quote(sess['module_id'])}"
            "&select=module_number&limit=1"
        ) or []
        module_number = int((mod_rows or [{}])[0].get("module_number") or 0)
        order_index = int(sess.get("order_index") or 1)
        key = _bucket_key_for(module_number, order_index)

        import urllib.request
        req = urllib.request.Request(
            f"{_SUPABASE_REST_URL}/storage/v1/object/{_VIDEO_BUCKET}/{key}",
            method="DELETE",
            headers={
                "apikey": _SUPABASE_SR,
                "Authorization": f"Bearer {_SUPABASE_SR}",
            },
        )
        # Best-effort delete from bucket — swallow 404 (file may already be gone).
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp.read()
        except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
            if e.code not in (404,):
                logger.warning("Video bucket delete failed for %s: %s", key, e)
        except Exception as e:
            logger.warning("Video bucket delete failed for %s: %s", key, e)

        _supabase_patch(
            f"master_sessions?id=eq.{_urlparse.quote(session_id)}",
            {"lecture_url": None},
        )
        return {"ok": True}

    @api_router.post("/admin/sessions/{session_id}/video-signed-url")
    async def admin_video_signed_url(session_id: str, user=Depends(_get_supabase_user)):
        """Returns a signed upload URL that the browser can PUT the file to
        directly, bypassing nginx (which caps FastAPI bodies at 1 MB → 413).
        The signed URL is scoped to a single object and expires quickly, so
        the anon client can upload without needing service-role or RLS write
        permissions on the bucket."""
        _ensure_admin(user)
        if not _SUPABASE_SR:
            raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY missing")
        # Resolve session → module_number + order_index → object key
        sess_rows = _supabase_get(
            f"master_sessions?id=eq.{_urlparse.quote(session_id)}"
            "&select=id,order_index,module_id&limit=1"
        ) or []
        if not sess_rows:
            raise HTTPException(status_code=404, detail="Session not found.")
        sess = sess_rows[0]
        mod_rows = _supabase_get(
            f"master_modules?id=eq.{_urlparse.quote(sess['module_id'])}"
            "&select=module_number&limit=1"
        ) or []
        if not mod_rows or mod_rows[0].get("module_number") is None:
            raise HTTPException(status_code=404, detail="Module not found.")
        module_number = int(mod_rows[0]["module_number"])
        order_index = int(sess.get("order_index") or 1)
        key = _bucket_key_for(module_number, order_index)

        # Ask Supabase Storage for a signed upload URL. `upsert:true` so
        # replace-uploads succeed even when the deterministic object key
        # (m{module}/s{module}-{order}.mp4) already exists in the bucket.
        import urllib.request as _ur
        try:
            req = _ur.Request(
                f"{_SUPABASE_REST_URL}/storage/v1/object/upload/sign/{_VIDEO_BUCKET}/{key}",
                method="POST",
                data=b'{"upsert":true}',
                headers={
                    "apikey": _SUPABASE_SR,
                    "Authorization": f"Bearer {_SUPABASE_SR}",
                    "Content-Type": "application/json",
                    "x-upsert": "true",
                },
            )
            with _ur.urlopen(req, timeout=20) as resp:
                signed = _json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            logger.error("signed_upload_url failed: %s", body[:400])
            raise HTTPException(status_code=502, detail=f"Storage signed-url failed: {body[:200]}")

        # Supabase returns {"url":"/object/upload/sign/{bucket}/{path}?token=…","token":"…"}
        rel = signed.get("url") or ""
        upload_url = f"{_SUPABASE_REST_URL}/storage/v1{rel}"
        return {
            "upload_url": upload_url,
            "token": signed.get("token"),
            "key": key,
            "bucket": _VIDEO_BUCKET,
            "public_url": _bucket_public_url(key),
            "max_bytes": _MAX_VIDEO_BYTES,
        }

    class _AdminTusCreateBody(BaseModel):
        upload_length: int = Field(..., ge=1, le=53_687_091_200)
        content_type: str = "video/mp4"

    @api_router.post("/admin/tus-patch-chunk")
    async def admin_tus_patch_chunk(
        location: str = Form(...),
        offset: int = Form(...),
        chunk: UploadFile = File(...),
        user=Depends(_get_supabase_user),
    ):
        """Forwards a single TUS chunk from the browser to Supabase Storage's
        TUS Location URL, authenticated with service_role so RLS on
        storage.objects is bypassed. FE splits the file into ≤10 MB chunks
        (well under our ingress body cap of ~100 MB) and calls this once per
        chunk. Returns the new upload offset.

        We do it this way because Supabase RLS on `storage.objects` blocks
        admin JWTs on TUS PATCH — the only clean bypass is service_role,
        which we do NOT expose to the browser."""
        _ensure_admin(user)
        if not _SUPABASE_SR:
            raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY missing")

        # Guard against arbitrary URL forwarding
        if not location.startswith(f"{_SUPABASE_REST_URL}/storage/v1/upload/resumable/"):
            raise HTTPException(status_code=400, detail="Invalid TUS location URL.")

        raw = await chunk.read()
        if not raw:
            raise HTTPException(status_code=400, detail="Empty chunk.")

        import urllib.request as _ur
        try:
            req = _ur.Request(
                location,
                method="PATCH",
                data=raw,
                headers={
                    "Authorization": f"Bearer {_SUPABASE_SR}",
                    "Tus-Resumable": "1.0.0",
                    "Upload-Offset": str(offset),
                    "Content-Type": "application/offset+octet-stream",
                    "Content-Length": str(len(raw)),
                },
            )
            with _ur.urlopen(req, timeout=120) as resp:
                new_offset = int(resp.headers.get("Upload-Offset") or (offset + len(raw)))
                return {"upload_offset": new_offset}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            logger.error("tus patch chunk failed [%s]: %s", e.code, err_body[:400])
            raise HTTPException(status_code=502, detail=f"Storage TUS patch failed [{e.code}]: {err_body[:200]}")

    @api_router.post("/admin/sessions/{session_id}/tus-create-upload")
    async def admin_tus_create_upload(session_id: str, body: _AdminTusCreateBody,
                                       user=Depends(_get_supabase_user)):
        """Pre-creates a TUS resumable-upload session using the service_role
        key so RLS on storage.objects is bypassed. Returns the Location URL
        the FE then streams chunks to via /admin/tus-patch-chunk (which also
        proxies with service_role — needed because Supabase RLS blocks admin
        JWTs on TUS PATCH as of 2026).

        Any existing object at the deterministic key is DELETED first so
        the completing INSERT into storage.objects doesn't 409.
        This unblocks large (>50 MB) video uploads on Pro plan without
        requiring the user to add custom RLS INSERT policies for admins."""
        _ensure_admin(user)
        if not _SUPABASE_SR:
            raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY missing")

        # Resolve session → deterministic object key
        sess_rows = _supabase_get(
            f"master_sessions?id=eq.{_urlparse.quote(session_id)}"
            "&select=id,order_index,module_id&limit=1"
        ) or []
        if not sess_rows:
            raise HTTPException(status_code=404, detail="Session not found.")
        sess = sess_rows[0]
        mod_rows = _supabase_get(
            f"master_modules?id=eq.{_urlparse.quote(sess['module_id'])}"
            "&select=module_number&limit=1"
        ) or []
        if not mod_rows or mod_rows[0].get("module_number") is None:
            raise HTTPException(status_code=404, detail="Module not found.")
        module_number = int(mod_rows[0]["module_number"])
        order_index = int(sess.get("order_index") or 1)
        key = _bucket_key_for(module_number, order_index)

        import urllib.request as _ur
        # 1) Delete any existing object at this key so the TUS completion
        #    INSERT doesn't collide (Supabase TUS returns 409 otherwise).
        try:
            del_req = _ur.Request(
                f"{_SUPABASE_REST_URL}/storage/v1/object/{_VIDEO_BUCKET}/{key}",
                method="DELETE",
                headers={
                    "apikey": _SUPABASE_SR,
                    "Authorization": f"Bearer {_SUPABASE_SR}",
                },
            )
            with _ur.urlopen(del_req, timeout=20) as resp:
                _ = resp.read()
        except urllib.error.HTTPError as e:
            # 404 is fine (no prior object); anything else we log but don't fail hard.
            if e.code != 404:
                logger.warning("pre-delete of %s returned %s", key, e.code)

        # 2) TUS Upload-Metadata is `key1 base64value1,key2 base64value2,...`
        def b64(s: str) -> str:
            import base64 as _b64
            return _b64.b64encode(s.encode("utf-8")).decode("ascii")
        meta = ",".join([
            f"bucketName {b64(_VIDEO_BUCKET)}",
            f"objectName {b64(key)}",
            f"contentType {b64(body.content_type or 'video/mp4')}",
            f"cacheControl {b64('3600')}",
        ])

        try:
            req = _ur.Request(
                f"{_SUPABASE_REST_URL}/storage/v1/upload/resumable",
                method="POST",
                data=b"",
                headers={
                    "apikey": _SUPABASE_SR,
                    "Authorization": f"Bearer {_SUPABASE_SR}",
                    "Tus-Resumable": "1.0.0",
                    "Upload-Length": str(body.upload_length),
                    "Upload-Metadata": meta,
                    "x-upsert": "true",
                },
            )
            with _ur.urlopen(req, timeout=30) as resp:
                location = resp.headers.get("Location") or resp.headers.get("location") or ""
                if not location:
                    raise HTTPException(status_code=502, detail="Storage TUS create returned no Location.")
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            logger.error("tus create failed: %s", err_body[:400])
            raise HTTPException(status_code=502, detail=f"Storage TUS create failed: {err_body[:200]}")

        return {
            "location": location,
            "key": key,
            "bucket": _VIDEO_BUCKET,
            "public_url": _bucket_public_url(key),
            "max_bytes": _MAX_VIDEO_BYTES,
        }

    @api_router.post("/admin/sessions/{session_id}/video-url")
    async def admin_save_video_url(session_id: str, body: _AdminVideoUrlBody,
                                    user=Depends(_get_supabase_user)):
        """Small JSON payload — safely under any nginx cap. Called by the FE
        after a successful direct-to-Supabase upload OR when an admin pastes
        an external video URL (e.g. YouTube, Vimeo, Cloudflare Stream, Mux,
        BunnyCDN) — used when the file is larger than the Supabase Storage
        global upload cap (50 MB on Free tier, up to 50 GB on Pro+)."""
        _ensure_admin(user)
        url = (body.public_url or "").strip()
        if not url or not url.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="Invalid public_url.")
        # Post-upload sanity guard — if this is a Supabase-hosted URL, HEAD it
        # to confirm the file is actually a real video, not a truncated stub.
        # Some TUS uploads have historically silently finalized at 0-1 KB when
        # the browser tab was closed or the network hiccuped, leaving admins
        # with a black video player. External URLs (YouTube/Vimeo/etc.) are
        # skipped since we can't HEAD them reliably.
        if _SUPABASE_REST_URL and url.startswith(_SUPABASE_REST_URL):
            import urllib.request as _ur
            try:
                req = _ur.Request(url, method="HEAD")
                with _ur.urlopen(req, timeout=10) as resp:
                    size = int(resp.headers.get("content-length") or 0)
                    if size < 100_000:  # <100 KB → definitely a broken stub
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"Upload appears corrupted (only {size} bytes on Supabase). "
                                "Retry the upload — a real lecture video should be several MB. "
                                "Nothing has been saved."
                            ),
                        )
            except urllib.error.HTTPError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Uploaded video is not readable (HTTP {e.code}). Retry the upload.",
                )
            except HTTPException:
                raise
            except Exception as e:
                # Network flakiness — log but don't block the save; the admin
                # can always re-check the video plays.
                logger.warning("Post-upload HEAD check failed for %s: %s", url, e)
        _supabase_patch(
            f"master_sessions?id=eq.{_urlparse.quote(session_id)}",
            {"lecture_url": url},
        )
        return {"ok": True, "lecture_url": url}

    # ═══════════════════════════════════════════════════════════════════════
    # Admin curriculum CRUD — Phase A: modules + sessions
    # ═══════════════════════════════════════════════════════════════════════
    @api_router.get("/admin/curriculum/modules")
    async def admin_curr_modules(user=Depends(_get_supabase_user)):
        """List every module (with session counts) for the AdminPanel curriculum tab."""
        _ensure_admin(user)
        paths = _supabase_get("master_paths?select=id,title&limit=5") or []
        path_id = paths[0]["id"] if paths else None
        if not path_id:
            return {"path_id": None, "modules": []}
        # PostgREST embed — single request returns modules with their session
        # counts, avoiding an N+1 loop that scaled to ~30-90s at 23 modules.
        mods = _supabase_get(
            f"master_modules?path_id=eq.{_urlparse.quote(path_id)}"
            "&select=id,path_id,title,description,module_number,order_index,master_sessions(count)"
            "&order=order_index&limit=100"
        ) or []
        out = []
        for m in mods:
            sess_agg = m.get("master_sessions") or []
            count = sess_agg[0]["count"] if sess_agg else 0
            m2 = {k: v for k, v in m.items() if k != "master_sessions"}
            m2["session_count"] = count
            out.append(m2)
        return {"path_id": path_id, "modules": out}

    @api_router.get("/admin/curriculum/sessions")
    async def admin_curr_sessions(module_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            f"master_sessions?module_id=eq.{_urlparse.quote(module_id)}"
            "&select=id,module_id,title,description,order_index,estimated_minutes,lecture_url"
            "&order=order_index&limit=200"
        ) or []
        return {"sessions": rows}

    @api_router.get("/admin/curriculum/export")
    async def admin_curriculum_export(user=Depends(_get_supabase_user)):
        """Return the full curriculum tree — every module, every session,
        every module-project, every capstone — for a single 'Download full
        curriculum' click on the admin View Course tab.

        Response shape (large but flat + serialisable):
            {
              path: { id, title },
              modules: [
                { id, title, description, module_number, order_index,
                  sessions: [ { id, title, description, order_index,
                                estimated_minutes, has_video: bool } ],
                  projects: [ { id, title, brief, order_index } ]
                }
              ],
              capstones: [
                { id, code, title, order_index, meta, learning_outcomes,
                  required_structure, tasks_raw }
              ],
              generated_at: iso8601,
              summary: { module_count, session_count, project_count, capstone_count }
            }
        """
        _ensure_admin(user)
        # 1) Path (we ship a single-path product today).
        paths = _supabase_get("master_paths?select=id,title&limit=5") or []
        if not paths:
            raise HTTPException(status_code=404, detail="No master path found.")
        p = paths[0]
        path_id = p["id"]
        path_id_q = _urlparse.quote(path_id)

        # 2) Modules + embedded sessions + embedded projects — one round-trip.
        mods = _supabase_get(
            f"master_modules?path_id=eq.{path_id_q}"
            "&select=id,path_id,title,description,module_number,order_index,"
            "master_sessions(id,title,description,order_index,estimated_minutes,lecture_url),"
            "master_module_projects(id,title,description,deliverable_description,estimated_hours)"
            "&order=order_index&limit=500"
        ) or []

        module_out = []
        session_count = 0
        project_count = 0
        for m in mods:
            sessions = m.get("master_sessions") or []
            projects = m.get("master_module_projects") or []
            sessions.sort(key=lambda s: (s.get("order_index") or 0))
            sess_clean = [{
                "id": s["id"],
                "title": s.get("title") or "",
                "description": s.get("description") or "",
                "order_index": s.get("order_index"),
                "estimated_minutes": s.get("estimated_minutes"),
                "has_video": bool(s.get("lecture_url")),
            } for s in sessions]
            proj_clean = [{
                "id": p["id"],
                "title": p.get("title") or "",
                "description": p.get("description") or "",
                "deliverable": p.get("deliverable_description") or "",
                "estimated_hours": p.get("estimated_hours"),
            } for p in projects]
            session_count += len(sess_clean)
            project_count += len(proj_clean)
            module_out.append({
                "id": m["id"],
                "title": m.get("title") or "",
                "description": m.get("description") or "",
                "module_number": m.get("module_number"),
                "order_index": m.get("order_index"),
                "sessions": sess_clean,
                "projects": proj_clean,
            })

        # 3) Capstones (may reference path_id; fall back to all if none matched).
        # `code` lives inside the JSONB `phases.code`, not as a column.
        caps = _supabase_get(
            f"master_capstone_projects?path_id=eq.{path_id_q}"
            "&select=id,title,phases&limit=100"
        ) or []
        if not caps:
            caps = _supabase_get(
                "master_capstone_projects?select=id,title,phases&limit=100"
            ) or []
        cap_out = []
        for c in caps:
            ph = c.get("phases") or {}
            cap_out.append({
                "id": c["id"],
                "code": ph.get("code") if isinstance(ph, dict) else None,
                "title": c.get("title") or "",
                "meta": ph.get("meta") if isinstance(ph, dict) else None,
                "learning_outcomes": ph.get("learning_outcomes") if isinstance(ph, dict) else None,
                "required_structure": ph.get("required_structure") if isinstance(ph, dict) else None,
                "tasks_raw": ph.get("tasks_raw") if isinstance(ph, dict) else None,
            })
        cap_out.sort(key=lambda c: (c.get("code") or ""))

        return {
            "path": {"id": path_id, "title": p.get("title") or ""},
            "modules": module_out,
            "capstones": cap_out,
            "summary": {
                "module_count": len(module_out),
                "session_count": session_count,
                "project_count": project_count,
                "capstone_count": len(cap_out),
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    @api_router.post("/admin/modules")
    async def admin_create_module(body: _AdminModuleBody, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        if not body.title or not body.path_id:
            raise HTTPException(status_code=400, detail="path_id and title required.")
        # Next order_index defaults to (max+1) for the path
        existing = _supabase_get(
            f"master_modules?path_id=eq.{_urlparse.quote(body.path_id)}"
            "&select=order_index,module_number&order=order_index.desc&limit=1"
        ) or []
        next_order = (existing[0]["order_index"] + 1) if existing else 1
        next_num   = (existing[0].get("module_number") or existing[0]["order_index"]) + 1 if existing else 1
        payload = {
            "path_id": body.path_id,
            "title": body.title,
            "description": body.description or "",
            "module_number": body.module_number if body.module_number is not None else next_num,
            "order_index":   body.order_index   if body.order_index   is not None else next_order,
        }
        row = _supabase_post("master_modules", payload, prefer="return=representation")
        if isinstance(row, list):
            row = row[0] if row else None
        return {"module": row}

    @api_router.patch("/admin/modules/{module_id}")
    async def admin_update_module(module_id: str, body: _AdminModuleBody, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        patch = {k: v for k, v in body.model_dump().items() if v is not None and k != "path_id"}
        if not patch:
            raise HTTPException(status_code=400, detail="No fields to update.")
        _supabase_patch(f"master_modules?id=eq.{_urlparse.quote(module_id)}", patch)
        # Return the updated row
        rows = _supabase_get(
            f"master_modules?id=eq.{_urlparse.quote(module_id)}"
            "&select=id,path_id,title,description,module_number,order_index&limit=1"
        ) or []
        return {"module": rows[0] if rows else None}

    @api_router.get("/admin/modules/{module_id}/impact")
    async def admin_module_impact(module_id: str, user=Depends(_get_supabase_user)):
        """Preview counts of dependent rows before a delete cascade so the admin
        knows what they're nuking."""
        _ensure_admin(user)
        sessions = _supabase_get(
            f"master_sessions?module_id=eq.{_urlparse.quote(module_id)}&select=id&limit=200"
        ) or []
        sess_ids = ",".join(_urlparse.quote(s["id"]) for s in sessions) if sessions else ""
        notes = quiz = iq = 0
        if sess_ids:
            n = _supabase_get(f"master_notes_cards?session_id=in.({sess_ids})&select=id&limit=1000") or []
            q = _supabase_get(f"master_quiz_questions?session_id=in.({sess_ids})&select=id&limit=1000") or []
            i = _supabase_get(f"master_interview_questions?session_id=in.({sess_ids})&select=id&limit=1000") or []
            notes, quiz, iq = len(n), len(q), len(i)
        return {"sessions": len(sessions), "notes_cards": notes, "quiz_items": quiz, "interview_questions": iq}

    @api_router.delete("/admin/modules/{module_id}")
    async def admin_delete_module(module_id: str, user=Depends(_get_supabase_user)):
        """Cascade-delete a module. Supabase FKs on user_modules /
        user_sessions / master_sessions don't have ON DELETE CASCADE, so we
        clean dependents explicitly in dependency order:

            user_sessions → master_notes_cards / master_quiz_questions /
            master_interview_questions / master_simulations →
            master_sessions → user_modules → master_module_projects →
            master_modules
        """
        _ensure_admin(user)
        mid_q = _urlparse.quote(module_id)

        # 1) Collect session ids belonging to this module.
        sessions = _supabase_get(
            f"master_sessions?module_id=eq.{mid_q}&select=id&limit=1000"
        ) or []
        session_ids = [s["id"] for s in sessions]

        # 2) Collect user_module ids that reference this master module.
        user_mods = _supabase_get(
            f"user_modules?master_module_id=eq.{mid_q}&select=id&limit=10000"
        ) or []
        user_module_ids = [u["id"] for u in user_mods]

        def _in_list(vals):
            return "(" + ",".join(_urlparse.quote(v) for v in vals) + ")"

        # 3) Delete user_sessions in TWO passes to catch both FK columns.
        if session_ids:
            for i in range(0, len(session_ids), 100):
                chunk = session_ids[i:i + 100]
                try:
                    _supabase_delete(
                        f"user_sessions?master_session_id=in.{_in_list(chunk)}"
                    )
                except HTTPException as e:
                    logger.warning(f"[delete-module] user_sessions by session_id failed: {e.detail}")
        if user_module_ids:
            for i in range(0, len(user_module_ids), 100):
                chunk = user_module_ids[i:i + 100]
                try:
                    _supabase_delete(
                        f"user_sessions?user_module_id=in.{_in_list(chunk)}"
                    )
                except HTTPException as e:
                    logger.warning(f"[delete-module] user_sessions by user_module_id failed: {e.detail}")

        # 4) Delete master content items for these sessions.
        if session_ids:
            for tbl in ("master_notes_cards", "master_quiz_questions",
                        "master_interview_questions", "master_simulations"):
                for i in range(0, len(session_ids), 100):
                    chunk = session_ids[i:i + 100]
                    try:
                        _supabase_delete(
                            f"{tbl}?session_id=in.{_in_list(chunk)}"
                        )
                    except HTTPException as e:
                        logger.warning(f"[delete-module] {tbl} sweep failed: {e.detail}")

        # 5) Delete master_sessions for this module.
        try:
            _supabase_delete(f"master_sessions?module_id=eq.{mid_q}")
        except HTTPException as e:
            logger.warning(f"[delete-module] master_sessions delete failed: {e.detail}")

        # 6) Delete user_modules referencing this master module.
        try:
            _supabase_delete(f"user_modules?master_module_id=eq.{mid_q}")
        except HTTPException as e:
            logger.warning(f"[delete-module] user_modules delete failed: {e.detail}")

        # 7) Delete module-level projects (best-effort — table may not exist
        #    or column name may vary).
        for tbl_query in (
            f"master_module_projects?module_id=eq.{mid_q}",
            f"master_module_projects?master_module_id=eq.{mid_q}",
        ):
            try:
                _supabase_delete(tbl_query)
                break
            except HTTPException:
                continue

        # 8) Finally, drop the module itself. If this still fails, bubble the
        #    Postgres FK error to the admin so they know what else references
        #    the module (e.g. XP events, milestones, badges, plan days).
        try:
            _supabase_delete(f"master_modules?id=eq.{mid_q}")
        except HTTPException as e:
            raise HTTPException(
                status_code=e.status_code or 409,
                detail=f"Module delete blocked by remaining references: {e.detail}",
            )
        return {"ok": True, "cleaned": {
            "master_sessions": len(session_ids),
            "user_modules":    len(user_module_ids),
        }}

    @api_router.post("/admin/sessions")
    async def admin_create_session(body: _AdminSessionBody, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        if not body.title or not body.module_id:
            raise HTTPException(status_code=400, detail="module_id and title required.")
        existing = _supabase_get(
            f"master_sessions?module_id=eq.{_urlparse.quote(body.module_id)}"
            "&select=order_index&order=order_index.desc&limit=1"
        ) or []
        next_order = (existing[0]["order_index"] + 1) if existing else 1
        payload = {
            "module_id": body.module_id,
            "title": body.title,
            "description": body.description or "",
            "order_index":       body.order_index       if body.order_index       is not None else next_order,
            "estimated_minutes": body.estimated_minutes if body.estimated_minutes is not None else 30,
        }
        if body.lecture_url:
            payload["lecture_url"] = body.lecture_url
        row = _supabase_post("master_sessions", payload, prefer="return=representation")
        if isinstance(row, list):
            row = row[0] if row else None
        return {"session": row}

    @api_router.patch("/admin/sessions/{session_id}")
    async def admin_update_session(session_id: str, body: _AdminSessionBody, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        patch = {k: v for k, v in body.model_dump().items() if v is not None and k != "module_id"}
        if not patch:
            raise HTTPException(status_code=400, detail="No fields to update.")
        _supabase_patch(f"master_sessions?id=eq.{_urlparse.quote(session_id)}", patch)
        rows = _supabase_get(
            f"master_sessions?id=eq.{_urlparse.quote(session_id)}"
            "&select=id,module_id,title,description,order_index,estimated_minutes,lecture_url&limit=1"
        ) or []
        return {"session": rows[0] if rows else None}

    @api_router.delete("/admin/sessions/{session_id}")
    async def admin_delete_session(session_id: str, user=Depends(_get_supabase_user)):
        """Cascade-delete a session. Cleans dependent rows in order:
        user_sessions → master_notes_cards / master_quiz_questions /
        master_interview_questions / master_simulations → master_sessions."""
        _ensure_admin(user)
        sid_q = _urlparse.quote(session_id)
        # 1) User progress rows for this session
        try:
            _supabase_delete(f"user_sessions?master_session_id=eq.{sid_q}")
        except HTTPException as e:
            logger.warning(f"[delete-session] user_sessions failed: {e.detail}")
        # 2) All master content items for this session
        for tbl in ("master_notes_cards", "master_quiz_questions",
                    "master_interview_questions", "master_simulations"):
            try:
                _supabase_delete(f"{tbl}?session_id=eq.{sid_q}")
            except HTTPException as e:
                logger.warning(f"[delete-session] {tbl} failed: {e.detail}")
        # 3) The session itself
        try:
            _supabase_delete(f"master_sessions?id=eq.{sid_q}")
        except HTTPException as e:
            raise HTTPException(
                status_code=e.status_code or 409,
                detail=f"Session delete blocked by remaining references: {e.detail}",
            )
        return {"ok": True}

    # ─── Notes cards CRUD (Phase B.1) ────────────────────────────────────
    @api_router.get("/admin/notes-cards")
    async def admin_notes_list(session_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            f"master_notes_cards?session_id=eq.{_urlparse.quote(session_id)}"
            "&select=id,session_id,card_type,title,content,order_index"
            "&order=order_index&limit=200"
        ) or []
        return {"cards": rows}

    @api_router.post("/admin/notes-cards")
    async def admin_notes_create(body: _AdminNotesCardBody, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        if not body.session_id or not body.card_type:
            raise HTTPException(status_code=400, detail="session_id and card_type required.")
        existing = _supabase_get(
            f"master_notes_cards?session_id=eq.{_urlparse.quote(body.session_id)}"
            "&select=order_index&order=order_index.desc&limit=1"
        ) or []
        next_order = (existing[0]["order_index"] + 1) if existing else 1
        payload = {
            "session_id": body.session_id,
            "card_type": body.card_type,
            "title": body.title or "",
            "content": body.content or "",
            "order_index": body.order_index if body.order_index is not None else next_order,
        }
        row = _supabase_post("master_notes_cards", payload, prefer="return=representation")
        if isinstance(row, list): row = row[0] if row else None
        return {"card": row}

    @api_router.patch("/admin/notes-cards/{card_id}")
    async def admin_notes_update(card_id: str, body: _AdminNotesCardBody, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        patch = {k: v for k, v in body.model_dump().items() if v is not None and k != "session_id"}
        if not patch:
            raise HTTPException(status_code=400, detail="No fields to update.")
        _supabase_patch(f"master_notes_cards?id=eq.{_urlparse.quote(card_id)}", patch)
        rows = _supabase_get(
            f"master_notes_cards?id=eq.{_urlparse.quote(card_id)}"
            "&select=id,session_id,card_type,title,content,order_index&limit=1"
        ) or []
        return {"card": rows[0] if rows else None}

    @api_router.delete("/admin/notes-cards/{card_id}")
    async def admin_notes_delete(card_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        _supabase_delete(f"master_notes_cards?id=eq.{_urlparse.quote(card_id)}")
        return {"ok": True}

    @api_router.post("/admin/notes-cards/reorder")
    async def admin_notes_reorder(body: _AdminReorderBody, user=Depends(_get_supabase_user)):
        """Rewrite order_index for a batch of cards. `ids` is the new order —
        position 0 → order_index 1, position 1 → order_index 2, ..."""
        _ensure_admin(user)
        for i, cid in enumerate(body.ids):
            _supabase_patch(
                f"master_notes_cards?id=eq.{_urlparse.quote(cid)}",
                {"order_index": i + 1},
            )
        return {"ok": True, "reordered": len(body.ids)}

    # ─── Quiz items CRUD (Phase B.2) ─────────────────────────────────────
    @api_router.get("/admin/quiz-items")
    async def admin_quiz_list(session_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            f"master_quiz_questions?session_id=eq.{_urlparse.quote(session_id)}"
            "&select=id,session_id,question,options,correct_answer_index,explanation,difficulty,order_index"
            "&order=order_index&limit=200"
        ) or []
        return {"items": rows}

    @api_router.post("/admin/quiz-items")
    async def admin_quiz_create(body: _AdminQuizItemBody, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        if not body.session_id:
            raise HTTPException(status_code=400, detail="session_id required.")
        existing = _supabase_get(
            f"master_quiz_questions?session_id=eq.{_urlparse.quote(body.session_id)}"
            "&select=order_index&order=order_index.desc&limit=1"
        ) or []
        next_order = (existing[0]["order_index"] + 1) if existing else 1
        payload = {
            "session_id": body.session_id,
            "question": body.question or "",
            "options": body.options if body.options is not None else ["", "", "", ""],
            "correct_answer_index": body.correct_answer_index if body.correct_answer_index is not None else 0,
            "explanation": body.explanation or "",
            "difficulty": body.difficulty or "medium",
            "order_index": body.order_index if body.order_index is not None else next_order,
        }
        row = _supabase_post("master_quiz_questions", payload, prefer="return=representation")
        if isinstance(row, list): row = row[0] if row else None
        return {"item": row}

    @api_router.patch("/admin/quiz-items/{item_id}")
    async def admin_quiz_update(item_id: str, body: _AdminQuizItemBody, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        patch = {k: v for k, v in body.model_dump().items() if v is not None and k != "session_id"}
        if not patch:
            raise HTTPException(status_code=400, detail="No fields to update.")
        _supabase_patch(f"master_quiz_questions?id=eq.{_urlparse.quote(item_id)}", patch)
        rows = _supabase_get(
            f"master_quiz_questions?id=eq.{_urlparse.quote(item_id)}"
            "&select=id,session_id,question,options,correct_answer_index,explanation,difficulty,order_index&limit=1"
        ) or []
        return {"item": rows[0] if rows else None}

    @api_router.delete("/admin/quiz-items/{item_id}")
    async def admin_quiz_delete(item_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        _supabase_delete(f"master_quiz_questions?id=eq.{_urlparse.quote(item_id)}")
        return {"ok": True}

    # ─── Interview questions CRUD (Phase B.2) ────────────────────────────
    @api_router.get("/admin/interview-questions")
    async def admin_iq_list(session_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            f"master_interview_questions?session_id=eq.{_urlparse.quote(session_id)}"
            "&select=id,session_id,question,context,sample_strong_answer,evaluation_criteria,order_index"
            "&order=order_index&limit=200"
        ) or []
        return {"items": rows}

    @api_router.post("/admin/interview-questions")
    async def admin_iq_create(body: _AdminInterviewQuestionBody, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        if not body.session_id:
            raise HTTPException(status_code=400, detail="session_id required.")
        existing = _supabase_get(
            f"master_interview_questions?session_id=eq.{_urlparse.quote(body.session_id)}"
            "&select=order_index&order=order_index.desc&limit=1"
        ) or []
        next_order = (existing[0]["order_index"] + 1) if existing else 1
        payload = {
            "session_id": body.session_id,
            "question": body.question or "",
            "context": body.context or "",
            "sample_strong_answer": body.sample_strong_answer or "",
            "evaluation_criteria": body.evaluation_criteria if body.evaluation_criteria is not None else {},
            "order_index": body.order_index if body.order_index is not None else next_order,
        }
        row = _supabase_post("master_interview_questions", payload, prefer="return=representation")
        if isinstance(row, list): row = row[0] if row else None
        return {"item": row}

    @api_router.patch("/admin/interview-questions/{item_id}")
    async def admin_iq_update(item_id: str, body: _AdminInterviewQuestionBody, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        patch = {k: v for k, v in body.model_dump().items() if v is not None and k != "session_id"}
        if not patch:
            raise HTTPException(status_code=400, detail="No fields to update.")
        _supabase_patch(f"master_interview_questions?id=eq.{_urlparse.quote(item_id)}", patch)
        rows = _supabase_get(
            f"master_interview_questions?id=eq.{_urlparse.quote(item_id)}"
            "&select=id,session_id,question,context,sample_strong_answer,evaluation_criteria,order_index&limit=1"
        ) or []
        return {"item": rows[0] if rows else None}

    @api_router.delete("/admin/interview-questions/{item_id}")
    async def admin_iq_delete(item_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        _supabase_delete(f"master_interview_questions?id=eq.{_urlparse.quote(item_id)}")
        return {"ok": True}

    # ─── Capstones CRUD (Phase C) ────────────────────────────────────────
    @api_router.get("/admin/capstones")
    async def admin_capstones_list(user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            "master_capstone_projects?select=id,path_id,title,description,"
            "estimated_hours,deliverable_description,phases"
            "&order=phases-%3E%3Ecode&limit=50"
        ) or []
        # Enrich with the code pulled from phases for convenient FE routing
        for r in rows:
            r["code"] = (r.get("phases") or {}).get("code")
        return {"capstones": rows}

    @api_router.patch("/admin/capstones/{code}")
    async def admin_capstone_update(code: str, body: _AdminCapstoneBody,
                                    user=Depends(_get_supabase_user)):
        """Route by phases->>code. Accepts scalar updates + optional full
        phases blob replacement."""
        _ensure_admin(user)
        # Find the row (need id for a stable PATCH filter — jsonb filter is fine but slower)
        rows = _supabase_get(
            f"master_capstone_projects?phases-%3E%3Ecode=eq.{_urlparse.quote(code)}"
            "&select=id&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail=f"Capstone {code} not found.")
        row_id = rows[0]["id"]
        patch = {k: v for k, v in body.model_dump().items() if v is not None}
        if not patch:
            raise HTTPException(status_code=400, detail="No fields to update.")
        # If phases is provided, make sure it retains a `code` (else FE won't be able to find it)
        if "phases" in patch:
            ph = patch["phases"]
            if not isinstance(ph, dict) or not ph.get("code"):
                raise HTTPException(status_code=400, detail="phases must be an object containing 'code'.")
        _supabase_patch(f"master_capstone_projects?id=eq.{_urlparse.quote(row_id)}", patch)
        updated = _supabase_get(
            f"master_capstone_projects?id=eq.{_urlparse.quote(row_id)}"
            "&select=id,title,description,estimated_hours,deliverable_description,phases&limit=1"
        ) or []
        out = updated[0] if updated else None
        if out: out["code"] = (out.get("phases") or {}).get("code")
        return {"capstone": out}

    # ─── Module projects CRUD (Phase C) ──────────────────────────────────
    @api_router.get("/admin/module-projects/{module_id}")
    async def admin_module_project_get(module_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            f"master_module_projects?module_id=eq.{_urlparse.quote(module_id)}"
            "&select=id,module_id,title,description,estimated_hours,deliverable_description,tasks"
            "&limit=1"
        ) or []
        return {"project": rows[0] if rows else None}

    @api_router.patch("/admin/module-projects/{module_id}")
    async def admin_module_project_upsert(module_id: str, body: _AdminModuleProjectBody,
                                          user=Depends(_get_supabase_user)):
        """Upsert by module_id. If no row exists, create; otherwise patch."""
        _ensure_admin(user)
        patch = {k: v for k, v in body.model_dump().items() if v is not None}
        existing = _supabase_get(
            f"master_module_projects?module_id=eq.{_urlparse.quote(module_id)}"
            "&select=id&limit=1"
        ) or []
        if existing:
            if not patch:
                raise HTTPException(status_code=400, detail="No fields to update.")
            _supabase_patch(
                f"master_module_projects?id=eq.{_urlparse.quote(existing[0]['id'])}",
                patch,
            )
        else:
            # Create with sensible defaults for required-ish columns
            payload = {
                "module_id": module_id,
                "title": patch.get("title") or "Untitled project",
                "description": patch.get("description") or "",
                "deliverable_description": patch.get("deliverable_description") or "",
                "estimated_hours": patch.get("estimated_hours") if patch.get("estimated_hours") is not None else 5,
                "tasks": patch.get("tasks") if patch.get("tasks") is not None else {"todo": []},
            }
            _supabase_post("master_module_projects", payload, prefer="return=representation")
        rows = _supabase_get(
            f"master_module_projects?module_id=eq.{_urlparse.quote(module_id)}"
            "&select=id,module_id,title,description,estimated_hours,deliverable_description,tasks"
            "&limit=1"
        ) or []
        return {"project": rows[0] if rows else None}

    @api_router.delete("/admin/module-projects/{module_id}")
    async def admin_module_project_delete(module_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        try:
            _supabase_delete(
                f"master_module_projects?module_id=eq.{_urlparse.quote(module_id)}"
            )
        except Exception as e:
            msg = str(e)
            if "user_module_projects" in msg or "foreign key" in msg.lower():
                raise HTTPException(
                    status_code=409,
                    detail="Cannot delete — one or more users have progress on this project. "
                           "Unlink or clear their progress first.",
                )
            raise HTTPException(status_code=500, detail=f"delete failed: {msg[:200]}")
        return {"ok": True}

    # ─── Error tracking (public ingest + admin read/action) ──────────────
    @api_router.post("/errors/report")
    async def report_error(body: _ErrorReportBody):
        """Public error-ingest endpoint. Upserts by `signature`. Silenced rows
        are dropped silently. Resolved rows regressing get `regressed_at` set.

        Also accepts `user_description` — free-text detail the learner adds
        from the crash screen or the site-wide "Report a bug" button — and
        appends it to whichever row we ended up (append, not overwrite, so we
        keep every learner's context across duplicates)."""
        sig = (body.signature or "").strip()[:128]
        if not sig or not body.error_message:
            raise HTTPException(status_code=400, detail="signature + error_message required.")
        now_iso = datetime.now(timezone.utc).isoformat()
        user_desc = (body.user_description or "").strip()[:2000] or None
        existing = _supabase_get(
            f"error_reports?signature=eq.{_urlparse.quote(sig)}"
            "&select=id,is_silenced,resolved_at,occurrence_count,user_description&limit=1"
        ) or []
        if existing:
            row = existing[0]
            if row.get("is_silenced"):
                return {"ok": True, "dropped": "silenced"}
            patch = {
                "last_seen_at": now_iso,
                "occurrence_count": (row.get("occurrence_count") or 0) + 1,
            }
            # Regression path — was resolved, now firing again
            if row.get("resolved_at"):
                patch["resolved_at"] = None
                patch["regressed_at"] = now_iso
            # Merge new user description into the aggregate row (chronological
            # ledger). Keep newest at the top; cap at 8k chars.
            if user_desc:
                prev = (row.get("user_description") or "").strip()
                stamped = f"[{now_iso}] {user_desc}"
                merged = (stamped + "\n\n---\n\n" + prev) if prev else stamped
                patch["user_description"] = merged[:8000]
            _supabase_patch(f"error_reports?id=eq.{_urlparse.quote(row['id'])}", patch)
            report_id = row["id"]
        else:
            payload = {
                "signature": sig,
                "error_message": (body.error_message or "")[:4000],
                "error_stack": (body.error_stack or "")[:16000] if body.error_stack else None,
                "error_type": body.error_type if body.error_type in ("runtime", "promise", "react_boundary", "user_report") else "runtime",
                "url": (body.url or "")[:2048] or None,
                "user_agent": (body.user_agent or "")[:512] or None,
                "user_id": body.user_id or None,
                "user_description": user_desc,
            }
            created = _supabase_post("error_reports", payload, prefer="return=representation")
            if isinstance(created, list): created = created[0] if created else None
            if not created:
                return {"ok": False}
            report_id = created["id"]
        # Ledger — trimmed rolling event log (best-effort, don't fail parent on error)
        try:
            _supabase_post("error_report_events", {
                "report_id": report_id,
                "user_id": body.user_id or None,
                "url": (body.url or "")[:2048] or None,
                "user_agent": (body.user_agent or "")[:512] or None,
                "user_description": user_desc,
            })
        except Exception:
            pass
        return {"ok": True, "id": report_id}

    @api_router.get("/admin/errors")
    async def admin_errors_list(status: str = "new", user=Depends(_get_supabase_user)):
        """`status`: new | resolved | regressed | silenced | all"""
        _ensure_admin(user)
        filt = ""
        if status == "new":
            filt = "&is_silenced=eq.false&resolved_at=is.null&regressed_at=is.null"
        elif status == "resolved":
            filt = "&resolved_at=not.is.null&is_silenced=eq.false"
        elif status == "regressed":
            filt = "&regressed_at=not.is.null&resolved_at=is.null&is_silenced=eq.false"
        elif status == "silenced":
            filt = "&is_silenced=eq.true"
        rows = _supabase_get(
            "error_reports?select=id,signature,error_message,error_stack,error_type,url,user_agent,"
            "first_seen_at,last_seen_at,occurrence_count,unique_users,is_silenced,"
            "resolved_at,resolution_notes,regressed_at,user_description"
            f"{filt}&order=last_seen_at.desc&limit=200"
        ) or []
        return {"errors": rows}

    @api_router.patch("/admin/errors/{report_id}")
    async def admin_error_action(report_id: str, body: _ErrorActionBody, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        now_iso = datetime.now(timezone.utc).isoformat()
        admin_id = user.get("id") if isinstance(user, dict) else None
        action = (body.action or "").lower()
        if action == "resolve":
            patch = {
                "resolved_at": now_iso,
                "resolved_by": admin_id,
                "resolution_notes": body.resolution_notes,
                "regressed_at": None,
            }
        elif action == "silence":
            patch = {
                "is_silenced": True,
                "resolution_notes": body.resolution_notes,
            }
        elif action == "reopen":
            patch = {
                "resolved_at": None,
                "resolved_by": None,
                "is_silenced": False,
                "regressed_at": None,
            }
        else:
            raise HTTPException(status_code=400, detail="action must be resolve|silence|reopen.")
        _supabase_patch(f"error_reports?id=eq.{_urlparse.quote(report_id)}", patch)
        rows = _supabase_get(
            f"error_reports?id=eq.{_urlparse.quote(report_id)}"
            "&select=id,signature,error_message,is_silenced,resolved_at,resolution_notes,regressed_at&limit=1"
        ) or []
        return {"error": rows[0] if rows else None}

    @api_router.get("/admin/errors/{report_id}/events")
    async def admin_error_events(report_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            f"error_report_events?report_id=eq.{_urlparse.quote(report_id)}"
            "&select=id,user_id,url,user_agent,user_description,occurred_at&order=occurred_at.desc&limit=50"
        ) or []
        return {"events": rows}

    # ---------------- MOCK INTERVIEW ----------------
    def _eligibility_state(user_id: str) -> dict:
        # 1. M14 project gate — user_modules has no direct user_id, join via
        # user_enrollments. A user's M14 is "done" if any of their enrolled
        # M14 modules has is_completed=true.
        enrolls = _supabase_get(
            f"user_enrollments?user_id=eq.{_urlparse.quote(user_id)}&select=id&limit=20"
        ) or []
        enrollment_ids = [e["id"] for e in enrolls]
        m14_done = False
        if enrollment_ids:
            id_list = ",".join(enrollment_ids)
            m14 = _supabase_get(
                f"user_modules?enrollment_id=in.({id_list})&order_index=eq.14"
                f"&select=is_completed&limit=5"
            ) or []
            m14_done = any(m.get("is_completed") for m in m14)
        # 2. Weekly limit
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        recent = _supabase_get(
            f"user_mock_interviews?user_id=eq.{_urlparse.quote(user_id)}"
            f"&completed_at=gte.{_urlparse.quote(since)}&status=eq.completed&select=id&limit=5"
        ) or []
        weekly_count = len(recent)
        if not m14_done:
            return {"eligible": False, "reason": "m14_project_pending", "m14_done": False, "weekly_count": weekly_count}
        if weekly_count >= 3:
            return {"eligible": False, "reason": "weekly_limit", "m14_done": True, "weekly_count": weekly_count}
        return {"eligible": True, "reason": "ok", "m14_done": True, "weekly_count": weekly_count}

    @api_router.get("/mock-interview/eligible")
    async def mi_eligible(user=Depends(_get_supabase_user)):
        return _eligibility_state(user["id"])

    @api_router.get("/mock-interview/history")
    async def mi_history(user=Depends(_get_supabase_user)):
        rows = _supabase_get(
            f"user_mock_interviews?user_id=eq.{_urlparse.quote(user['id'])}"
            f"&select=id,started_at,completed_at,status,current_round,final_score,verdict,attempt_number"
            f"&order=started_at.desc&limit=50"
        ) or []
        return rows

    @api_router.get("/mock-interview/{interview_id}")
    async def mi_get(interview_id: str, user=Depends(_get_supabase_user)):
        iv = _get_interview_owned(interview_id, user["id"])
        turns = _get_turns(interview_id)
        scores = _supabase_get(
            f"user_mock_interview_scores?interview_id=eq.{_urlparse.quote(interview_id)}"
            f"&select=round,round_name,score,feedback_bullets,strengths,gaps&order=round.asc"
        ) or []
        return {"interview": iv, "turns": turns, "scores": scores}

    @api_router.post("/mock-interview/start")
    async def mi_start(user=Depends(_get_supabase_user)):
        elig = _eligibility_state(user["id"])
        if not elig["eligible"]:
            raise HTTPException(status_code=403, detail=elig)
        # attempt number
        prev = _supabase_get(
            f"user_mock_interviews?user_id=eq.{_urlparse.quote(user['id'])}"
            f"&select=attempt_number&order=attempt_number.desc&limit=1"
        ) or []
        attempt = (prev[0]["attempt_number"] + 1) if prev else 1
        # Create interview row
        created = _supabase_post(
            "user_mock_interviews",
            {"user_id": user["id"], "current_round": 1, "attempt_number": attempt},
            prefer="return=representation",
        )
        if isinstance(created, list):
            created = created[0]
        interview_id = created["id"]
        intro, first_q = await _generate_first_question(1)
        # Persist interviewer's combined opening as one turn
        opener = f"{intro}\n\n{first_q}"
        _supabase_post(
            "mock_interview_turns",
            {"interview_id": interview_id, "round": 1, "turn_idx": 0,
             "role": "interviewer", "content": opener},
        )
        return {
            "interview_id": interview_id,
            "round": 1,
            "round_name": "technical",
            "interviewer_intro": intro,
            "first_question": first_q,
            "opener": opener,
        }

    @api_router.post("/mock-interview/{interview_id}/answer")
    async def mi_answer(interview_id: str, req: MockInterviewAnswerReq, user=Depends(_get_supabase_user)):
        iv = _get_interview_owned(interview_id, user["id"])
        if iv["status"] != "in_progress":
            raise HTTPException(status_code=400, detail="interview not in progress")
        round_num = int(req.round or iv["current_round"])
        existing = _get_turns(interview_id, round_num)
        next_idx = (existing[-1]["turn_idx"] if existing else -1) + 1
        # Persist candidate turn
        _supabase_post(
            "mock_interview_turns",
            {"interview_id": interview_id, "round": round_num,
             "turn_idx": next_idx, "role": "candidate",
             "content": req.content[:4000],
             "input_method": req.input_method or "text"},
        )
        next_q, round_done = await _generate_next_question(interview_id, round_num)
        _supabase_post(
            "mock_interview_turns",
            {"interview_id": interview_id, "round": round_num,
             "turn_idx": next_idx + 1, "role": "interviewer",
             "content": next_q},
        )
        if round_done:
            # Score this round async (don't block)
            try:
                await _score_round(interview_id, round_num)
            except Exception as e:
                logger.warning(f"[mock-interview] round score failed: {e}")
            return {
                "round_complete": True,
                "round_end_message": next_q,
                "round": round_num,
                "is_final_round": round_num == 3,
            }
        return {"next_question": next_q, "round_complete": False, "round": round_num}

    @api_router.post("/mock-interview/{interview_id}/next-round")
    async def mi_next_round(interview_id: str, user=Depends(_get_supabase_user)):
        iv = _get_interview_owned(interview_id, user["id"])
        next_r = iv["current_round"] + 1
        if next_r > 3:
            raise HTTPException(status_code=400, detail="already at final round")
        _supabase_patch(
            f"user_mock_interviews?id=eq.{_urlparse.quote(interview_id)}",
            {"current_round": next_r},
        )
        intro, first_q = await _generate_first_question(next_r)
        opener = f"{intro}\n\n{first_q}"
        existing = _get_turns(interview_id, next_r)
        next_idx = (existing[-1]["turn_idx"] if existing else -1) + 1
        _supabase_post(
            "mock_interview_turns",
            {"interview_id": interview_id, "round": next_r, "turn_idx": next_idx,
             "role": "interviewer", "content": opener},
        )
        return {
            "round": next_r,
            "round_name": ROUND_NAMES[next_r],
            "interviewer_intro": intro,
            "first_question": first_q,
            "opener": opener,
        }

    @api_router.post("/mock-interview/{interview_id}/finalize")
    async def mi_finalize(interview_id: str, user=Depends(_get_supabase_user)):
        iv = _get_interview_owned(interview_id, user["id"])
        # Score any rounds that haven't been scored yet
        scored = _supabase_get(
            f"user_mock_interview_scores?interview_id=eq.{_urlparse.quote(interview_id)}&select=round"
        ) or []
        done_rounds = {s["round"] for s in scored}
        for r in (1, 2, 3):
            if r not in done_rounds:
                try:
                    await _score_round(interview_id, r)
                except Exception as e:
                    logger.warning(f"[mock-interview] late-score r{r} failed: {e}")
        verdict = await _finalize_verdict(interview_id)
        _supabase_patch(
            f"user_mock_interviews?id=eq.{_urlparse.quote(interview_id)}",
            {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "final_score": verdict["final_score"],
                "verdict": verdict["verdict"],
                "feedback_md": verdict["feedback_md"],
            },
        )
        # XP reward — flat 600 for completion + bonus on strong_pass
        bonus = {"strong_pass": 600, "pass": 400, "marginal": 200, "fail": 100}.get(verdict["verdict"], 100)
        try:
            _supabase_post(
                "rpc/award_xp",
                {"p_user_id": user["id"], "p_amount": bonus,
                 "p_reason": "mock_interview_complete",
                 "p_source_id": interview_id,
                 "p_meta": {"verdict": verdict["verdict"], "score": verdict["final_score"]}},
            )
        except Exception as e:
            logger.warning(f"[mock-interview] xp award failed: {e}")
        return verdict


    # =========================================================================
    # REWARDS — LinkedIn share → free resource unlock (Feb 2026)
    # =========================================================================
    # Data lives in `master_rewards` + `user_reward_claims` (migration 0037).
    # Files sit in a private Supabase Storage bucket called `rewards`; the
    # backend generates signed download URLs after a claim is recorded.
    # =========================================================================
    _REWARDS_BUCKET = "rewards"
    _REWARDS_MAX_BYTES = 25 * 1024 * 1024  # 25MB per the spec
    _REWARDS_ALLOWED_MIME = {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
        "application/x-zip-compressed",
    }
    _REWARDS_TABLE_HINT = (
        "master_rewards table is missing. Apply "
        "/app/scripts/migrations/0037_rewards.sql via Supabase Studio → SQL Editor."
    )

    def _is_rewards_missing(err: HTTPException) -> bool:
        try:
            detail = str(err.detail or "")
            return err.status_code in (400, 404) and (
                "master_rewards" in detail or "user_reward_claims" in detail
                or "relation" in detail.lower()
            )
        except Exception:
            return False

    def _reward_signed_download_url(path: str, ttl_seconds: int = 3600) -> Optional[str]:
        """Ask Supabase Storage for a short-lived signed URL for a rewards file."""
        if not path or not _SUPABASE_SR:
            return None
        try:
            import urllib.request
            req = urllib.request.Request(
                f"{_SUPABASE_REST_URL}/storage/v1/object/sign/{_REWARDS_BUCKET}/{path}",
                method="POST",
                headers={
                    "Authorization": f"Bearer {_SUPABASE_SR}",
                    "apikey": _SUPABASE_SR,
                    "Content-Type": "application/json",
                },
                data=_json.dumps({"expiresIn": ttl_seconds}).encode(),
            )
            with urllib.request.urlopen(req, timeout=8) as r:
                body = _json.loads(r.read())
            rel = body.get("signedURL") or body.get("signedUrl")
            if not rel:
                return None
            return f"{_SUPABASE_REST_URL}/storage/v1{rel}"
        except Exception as e:
            logger.warning(f"[rewards] sign URL failed for {path}: {e}")
            return None

    # ---- LEARNER-FACING ------------------------------------------------------

    @api_router.get("/rewards/eligible")
    async def rewards_eligible(user=Depends(_get_supabase_user)):
        """Return the rewards this user has unlocked (trigger event completed)
        plus each reward's claim state so the FE can decide whether to show
        the 'Share on LinkedIn' CTA vs the download button."""
        user_id = user["id"]
        try:
            rewards = _supabase_get(
                "master_rewards?is_active=eq.true"
                "&select=id,title,description,linkedin_message,trigger_type,trigger_ref_id,"
                "resource_file_name,resource_mime,resource_size_bytes,order_index"
                "&order=order_index.asc"
            ) or []
            claims = _supabase_get(
                f"user_reward_claims?user_id=eq.{_urlparse.quote(user_id)}"
                "&select=reward_id,shared_at,claimed_at,linkedin_post_url"
            ) or []
        except HTTPException as e:
            if _is_rewards_missing(e):
                return {"table_ready": False, "hint": _REWARDS_TABLE_HINT, "rewards": []}
            raise
        claim_map = {c["reward_id"]: c for c in claims}

        # Which trigger events has this user completed?
        # (a) Module completions: user_modules where is_completed=true AND
        #     the underlying master_module_id matches a reward's trigger_ref_id.
        module_ref_ids = [r["trigger_ref_id"] for r in rewards if r["trigger_type"] == "module_complete"]
        capstone_ref_ids = [r["trigger_ref_id"] for r in rewards if r["trigger_type"] == "capstone_complete"]

        completed_module_master_ids = set()
        if module_ref_ids:
            in_clause = ",".join([f"\"{i}\"" for i in module_ref_ids])
            done = _supabase_get(
                f"user_modules?user_id=eq.{_urlparse.quote(user_id)}"
                f"&is_completed=eq.true"
                f"&master_module_id=in.({in_clause})"
                "&select=master_module_id&limit=500"
            ) or []
            completed_module_master_ids = {r["master_module_id"] for r in done}

        completed_capstone_master_ids = set()
        if capstone_ref_ids:
            in_clause = ",".join([f"\"{i}\"" for i in capstone_ref_ids])
            done = _supabase_get(
                f"user_capstone_projects?is_completed=eq.true"
                f"&master_capstone_id=in.({in_clause})"
                "&select=master_capstone_id,enrollment_id&limit=500"
            ) or []
            # Scope to this user via enrollment
            if done:
                enr_ids = list({r["enrollment_id"] for r in done})
                in_enr = ",".join([f"\"{i}\"" for i in enr_ids])
                my_enrs = _supabase_get(
                    f"user_enrollments?user_id=eq.{_urlparse.quote(user_id)}"
                    f"&id=in.({in_enr})&select=id"
                ) or []
                my_enr_ids = {r["id"] for r in my_enrs}
                completed_capstone_master_ids = {
                    r["master_capstone_id"] for r in done if r["enrollment_id"] in my_enr_ids
                }

        out = []
        for r in rewards:
            eligible = False
            if r["trigger_type"] == "module_complete":
                eligible = r["trigger_ref_id"] in completed_module_master_ids
            elif r["trigger_type"] == "capstone_complete":
                eligible = r["trigger_ref_id"] in completed_capstone_master_ids
            claim = claim_map.get(r["id"])
            r_out = dict(r)
            r_out.pop("resource_file_path", None)  # never leak storage path
            r_out["eligible"] = bool(eligible)
            r_out["claimed"] = bool(claim)
            r_out["claimed_at"] = (claim or {}).get("claimed_at")
            r_out["linkedin_post_url"] = (claim or {}).get("linkedin_post_url")
            r_out["has_file"] = True  # FE doesn't need path — download comes from /rewards/{id}/download
            out.append(r_out)
        return {"table_ready": True, "rewards": out}

    # Accept LinkedIn post URLs from:
    #   https://www.linkedin.com/posts/<slug>-activity-<id>-xxxx
    #   https://www.linkedin.com/feed/update/urn:li:activity:...
    #   https://www.linkedin.com/pulse/<slug>
    # (also `linkedin.com/...` without `www.`)
    _LINKEDIN_POST_RE = _re.compile(
        r"^https?://(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com/"
        r"(?:posts/|feed/update/|pulse/|embed/feed/update/)[^\s]+$",
        _re.IGNORECASE,
    )

    def _validate_linkedin_post_url(raw: str) -> str:
        url = (raw or "").strip()
        if not url:
            raise HTTPException(
                status_code=400,
                detail={
                    "reason": "linkedin_post_url_required",
                    "message": "Paste the URL of your LinkedIn post to claim this reward.",
                },
            )
        if len(url) > 500:
            raise HTTPException(status_code=400, detail="LinkedIn post URL is too long")
        if not _LINKEDIN_POST_RE.match(url):
            raise HTTPException(
                status_code=400,
                detail={
                    "reason": "linkedin_post_url_invalid",
                    "message": (
                        "That doesn't look like a LinkedIn post URL. Open your post on LinkedIn, "
                        "click the ⋯ menu → 'Copy link to post', and paste that URL here."
                    ),
                },
            )
        return url

    # Sanity-check the pasted LinkedIn URL by fetching it with a bot User-Agent
    # (LinkedIn returns OpenGraph tags to bots without a login wall) and looking
    # for the expected brand/hashtag in the response body.
    #
    # Return value semantics:
    #   {"verified": True,  "reason": "ok"}                 → OK, mark verified.
    #   {"verified": False, "reason": "content_mismatch"}   → HTTP 200 but body
    #                                                          did not mention
    #                                                          any expected
    #                                                          hashtag → REJECT
    #                                                          the claim.
    #   {"verified": False, "reason": "unreachable"}        → LinkedIn was 4xx
    #                                                          (login wall) /
    #                                                          5xx / timeout →
    #                                                          allow but mark
    #                                                          verified=false
    #                                                          for admin review.
    _LINKEDIN_VERIFY_UA = (
        "Mozilla/5.0 (compatible; ValuevadeRewardsBot/1.0; +https://valuevade.com/rewards) "
        "facebookexternalhit/1.1"
    )

    def _verify_linkedin_post_content(url: str, expected_keywords: list) -> dict:
        try:
            import urllib.request as _ureq
            req = _ureq.Request(
                url,
                headers={
                    "User-Agent": _LINKEDIN_VERIFY_UA,
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
            with _ureq.urlopen(req, timeout=6) as resp:
                # LinkedIn public posts serve the OG bundle to bots (~30-80KB).
                # Guard against a runaway response.
                raw = resp.read(300_000)
                body = raw.decode("utf-8", errors="ignore").lower()
        except Exception as e:
            logger.info(f"[rewards] linkedin verify unreachable for {url}: {e}")
            return {"verified": False, "reason": "unreachable"}

        # Look for at least one of the expected keywords/hashtags.
        # `expected_keywords` are pre-lowered by the caller.
        for kw in expected_keywords:
            if kw and kw in body:
                return {"verified": True, "reason": "ok"}
        return {"verified": False, "reason": "content_mismatch"}

    def _reward_expected_keywords(reward: dict) -> list:
        """Extract hashtags from the reward's linkedin_message (if any) plus
        a hard-coded brand fallback so we always have at least one signal."""
        keywords = {"valuevade"}
        msg = (reward.get("linkedin_message") or "")
        for m in _re.findall(r"#([A-Za-z0-9_]{3,40})", msg):
            keywords.add(m.lower())
        return sorted(keywords)

    @api_router.post("/rewards/claim")
    async def rewards_claim(body: dict, user=Depends(_get_supabase_user)):
        """Called after the learner clicks 'I've shared on LinkedIn'. Verifies
        eligibility server-side, upserts the claim row (with the mandatory
        LinkedIn post URL + a `linkedin_post_verified` flag from the content
        check) and returns a signed download URL for the resource file."""
        user_id = user["id"]
        reward_id = (body or {}).get("reward_id") or ""
        if not reward_id:
            raise HTTPException(status_code=400, detail="reward_id required")
        linkedin_post_url = _validate_linkedin_post_url((body or {}).get("linkedin_post_url"))
        try:
            reward_rows = _supabase_get(
                f"master_rewards?id=eq.{_urlparse.quote(reward_id)}"
                "&is_active=eq.true&select=*&limit=1"
            ) or []
        except HTTPException as e:
            if _is_rewards_missing(e):
                raise HTTPException(status_code=503, detail=_REWARDS_TABLE_HINT)
            raise
        if not reward_rows:
            raise HTTPException(status_code=404, detail="Reward not found or inactive")
        reward = reward_rows[0]

        # Server-side eligibility check (never trust the FE).
        eligible = False
        if reward["trigger_type"] == "module_complete":
            done = _supabase_get(
                f"user_modules?user_id=eq.{_urlparse.quote(user_id)}"
                f"&master_module_id=eq.{_urlparse.quote(reward['trigger_ref_id'])}"
                "&is_completed=eq.true&select=id&limit=1"
            ) or []
            eligible = bool(done)
        elif reward["trigger_type"] == "capstone_complete":
            done = _supabase_get(
                f"user_capstone_projects?master_capstone_id=eq.{_urlparse.quote(reward['trigger_ref_id'])}"
                "&is_completed=eq.true&select=enrollment_id&limit=5"
            ) or []
            if done:
                enr_ids = list({r["enrollment_id"] for r in done})
                in_enr = ",".join([f"\"{i}\"" for i in enr_ids])
                my_enrs = _supabase_get(
                    f"user_enrollments?user_id=eq.{_urlparse.quote(user_id)}"
                    f"&id=in.({in_enr})&select=id"
                ) or []
                eligible = bool(my_enrs)

        if not eligible:
            raise HTTPException(
                status_code=403,
                detail={
                    "reason": "reward_not_eligible",
                    "message": "Complete the required module or capstone before claiming this reward.",
                },
            )

        # Content sanity-check: fetch the pasted LinkedIn URL and confirm it
        # mentions Valuevade / the reward's specific hashtag. This blocks
        # learners from pasting a random public post to farm the reward.
        # Wrapped in `to_thread` because the verifier uses blocking urllib.
        expected_kws = _reward_expected_keywords(reward)
        verify_res = await asyncio.to_thread(
            _verify_linkedin_post_content, linkedin_post_url, expected_kws
        )
        if verify_res.get("reason") == "content_mismatch":
            raise HTTPException(
                status_code=403,
                detail={
                    "reason": "linkedin_post_content_mismatch",
                    "message": (
                        "We opened your LinkedIn post but couldn't find any Valuevade-related content. "
                        "Please make sure the post is public and mentions Valuevade (or a hashtag from "
                        "the suggested post text above), then paste the URL again."
                    ),
                },
            )
        # `unreachable` → we allow the claim but mark it as not-verified so
        # admin can spot-check. Real users behind LinkedIn's login wall or
        # brief LinkedIn outages should not get blocked.
        is_verified = verify_res.get("verified") is True

        # Idempotent upsert — unique(user_id, reward_id) makes the second call a no-op.
        # We ALSO update linkedin_post_url on conflict so a learner can correct
        # a mis-pasted URL by re-submitting (still requires eligibility above).
        # `on_conflict` targets the composite unique constraint, not the PK.
        try:
            _supabase_post(
                "user_reward_claims?on_conflict=user_id,reward_id",
                {
                    "user_id": user_id,
                    "reward_id": reward_id,
                    "linkedin_post_url": linkedin_post_url,
                    "linkedin_post_verified": is_verified,
                },
                prefer="return=minimal,resolution=merge-duplicates",
            )
        except Exception as e:
            # merge-duplicates should swallow uniqueness violations, but log if not.
            logger.warning(f"[rewards] claim upsert warn: {e}")

        download_url = _reward_signed_download_url(reward.get("resource_file_path") or "")
        return {
            "ok": True,
            "download_url": download_url,
            "resource_file_name": reward.get("resource_file_name"),
        }

    @api_router.get("/rewards/{reward_id}/download")
    async def rewards_download(reward_id: str, user=Depends(_get_supabase_user)):
        """Re-issue a fresh signed URL for a reward the user already claimed
        (so they can re-download if the previous URL expired)."""
        user_id = user["id"]
        try:
            claim = _supabase_get(
                f"user_reward_claims?user_id=eq.{_urlparse.quote(user_id)}"
                f"&reward_id=eq.{_urlparse.quote(reward_id)}&select=id&limit=1"
            ) or []
        except HTTPException as e:
            if _is_rewards_missing(e):
                raise HTTPException(status_code=503, detail=_REWARDS_TABLE_HINT)
            raise
        if not claim:
            raise HTTPException(status_code=403, detail="You haven't claimed this reward yet")
        reward = (_supabase_get(
            f"master_rewards?id=eq.{_urlparse.quote(reward_id)}&select=*&limit=1"
        ) or [None])[0]
        if not reward or not reward.get("resource_file_path"):
            raise HTTPException(status_code=404, detail="Reward file not available")
        url = _reward_signed_download_url(reward["resource_file_path"])
        if not url:
            raise HTTPException(status_code=502, detail="Failed to generate download URL")
        return {"download_url": url, "resource_file_name": reward.get("resource_file_name")}

    # ---- ADMIN ---------------------------------------------------------------

    @api_router.get("/admin/rewards")
    async def admin_rewards_list(user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        try:
            rewards = _supabase_get(
                "master_rewards?select=*&order=order_index.asc&limit=500"
            ) or []
        except HTTPException as e:
            if _is_rewards_missing(e):
                return {"table_ready": False, "hint": _REWARDS_TABLE_HINT, "rewards": []}
            raise
        # Resolve trigger_ref names (module/capstone titles) for a nicer admin UI.
        module_ids = list({r["trigger_ref_id"] for r in rewards if r["trigger_type"] == "module_complete"})
        cap_ids = list({r["trigger_ref_id"] for r in rewards if r["trigger_type"] == "capstone_complete"})
        module_map, cap_map = {}, {}
        if module_ids:
            in_clause = ",".join([f"\"{i}\"" for i in module_ids])
            mods = _supabase_get(f"master_modules?id=in.({in_clause})&select=id,title,module_number") or []
            module_map = {m["id"]: m for m in mods}
        if cap_ids:
            in_clause = ",".join([f"\"{i}\"" for i in cap_ids])
            caps = _supabase_get(f"master_capstone_projects?id=in.({in_clause})&select=id,title,phases") or []
            cap_map = {c["id"]: c for c in caps}

        # Aggregate claim counts per reward for the admin overview.
        reward_ids = [r["id"] for r in rewards]
        claim_count_map = {}
        if reward_ids:
            in_clause = ",".join([f"\"{i}\"" for i in reward_ids])
            claim_rows = _supabase_get(
                f"user_reward_claims?reward_id=in.({in_clause})&select=reward_id"
            ) or []
            for row in claim_rows:
                rid = row.get("reward_id")
                if rid:
                    claim_count_map[rid] = claim_count_map.get(rid, 0) + 1

        for r in rewards:
            r["claim_count"] = claim_count_map.get(r["id"], 0)
        for r in rewards:
            if r["trigger_type"] == "module_complete":
                m = module_map.get(r["trigger_ref_id"])
                r["trigger_label"] = f"Module {m['module_number']} — {m['title']}" if m else "(module deleted)"
            else:
                c = cap_map.get(r["trigger_ref_id"])
                phases = c.get("phases") if c else None
                if isinstance(phases, str):
                    try: phases = _json.loads(phases)
                    except Exception: phases = {}
                code = (phases or {}).get("code") if isinstance(phases, dict) else None
                r["trigger_label"] = f"{code or 'Capstone'} — {c['title']}" if c else "(capstone deleted)"
        return {"table_ready": True, "rewards": rewards}

    @api_router.get("/admin/rewards/triggers")
    async def admin_rewards_triggers(user=Depends(_get_supabase_user)):
        """Return the available module + capstone options so the admin form
        can render a dropdown instead of asking for a raw UUID."""
        _ensure_admin(user)
        modules = _supabase_get(
            "master_modules?select=id,title,module_number,path_id"
            "&order=module_number.asc&limit=500"
        ) or []
        capstones = _supabase_get(
            "master_capstone_projects?select=id,title,phases,path_id&limit=200"
        ) or []
        # Decorate capstones with code
        for c in capstones:
            phases = c.get("phases")
            if isinstance(phases, str):
                try: phases = _json.loads(phases)
                except Exception: phases = {}
            c["code"] = (phases or {}).get("code") if isinstance(phases, dict) else None
        return {"modules": modules, "capstones": capstones}

    @api_router.post("/admin/rewards")
    async def admin_rewards_create(body: dict, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        title = (body.get("title") or "").strip()
        trigger_type = (body.get("trigger_type") or "").strip()
        trigger_ref_id = (body.get("trigger_ref_id") or "").strip()
        if not title or trigger_type not in ("module_complete", "capstone_complete") or not trigger_ref_id:
            raise HTTPException(status_code=400, detail="title, trigger_type, trigger_ref_id are required")
        try:
            row = _supabase_post("master_rewards", {
                "title": title,
                "description": (body.get("description") or "").strip() or None,
                "linkedin_message": (body.get("linkedin_message") or "").strip() or None,
                "trigger_type": trigger_type,
                "trigger_ref_id": trigger_ref_id,
                "resource_file_path": body.get("resource_file_path") or None,
                "resource_file_name": body.get("resource_file_name") or None,
                "resource_mime": body.get("resource_mime") or None,
                "resource_size_bytes": body.get("resource_size_bytes") or None,
                "order_index": int(body.get("order_index") or 100),
                "is_active": bool(body.get("is_active", True)),
            }, prefer="return=representation")
        except HTTPException as e:
            if _is_rewards_missing(e):
                raise HTTPException(status_code=503, detail=_REWARDS_TABLE_HINT)
            raise
        if isinstance(row, list):
            row = row[0] if row else None
        return {"reward": row}

    @api_router.get("/admin/rewards/{reward_id}/claims")
    async def admin_rewards_claims(reward_id: str, user=Depends(_get_supabase_user)):
        """Return the LinkedIn share submissions for a specific reward so an
        admin can audit / spot-check the URLs learners posted."""
        _ensure_admin(user)
        try:
            claims = _supabase_get(
                f"user_reward_claims?reward_id=eq.{_urlparse.quote(reward_id)}"
                "&select=id,user_id,linkedin_post_url,linkedin_post_verified,shared_at,claimed_at"
                "&order=claimed_at.desc&limit=500"
            ) or []
        except HTTPException as e:
            if _is_rewards_missing(e):
                return {"table_ready": False, "hint": _REWARDS_TABLE_HINT, "claims": []}
            raise
        # Resolve user email/name for the admin view.
        user_ids = list({c["user_id"] for c in claims if c.get("user_id")})
        profile_map = {}
        if user_ids:
            in_clause = ",".join([f"\"{i}\"" for i in user_ids])
            profs = _supabase_get(
                f"profiles?id=in.({in_clause})&select=id,email,full_name"
            ) or []
            profile_map = {p["id"]: p for p in profs}
        for c in claims:
            p = profile_map.get(c.get("user_id")) or {}
            c["user_email"] = p.get("email")
            c["user_name"] = p.get("full_name")
        return {"table_ready": True, "claims": claims}

    @api_router.patch("/admin/rewards/{reward_id}")
    async def admin_rewards_update(reward_id: str, body: dict, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        allowed = {
            "title", "description", "linkedin_message",
            "trigger_type", "trigger_ref_id",
            "resource_file_path", "resource_file_name", "resource_mime", "resource_size_bytes",
            "order_index", "is_active",
        }
        patch = {k: v for k, v in body.items() if k in allowed and v is not None}
        if "trigger_type" in patch and patch["trigger_type"] not in ("module_complete", "capstone_complete"):
            raise HTTPException(status_code=400, detail="invalid trigger_type")
        if not patch:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        patch["updated_at"] = datetime.now(timezone.utc).isoformat()
        try:
            _supabase_patch(f"master_rewards?id=eq.{_urlparse.quote(reward_id)}", patch)
            rows = _supabase_get(
                f"master_rewards?id=eq.{_urlparse.quote(reward_id)}&select=*&limit=1"
            ) or []
        except HTTPException as e:
            if _is_rewards_missing(e):
                raise HTTPException(status_code=503, detail=_REWARDS_TABLE_HINT)
            raise
        return {"reward": rows[0] if rows else None}

    @api_router.delete("/admin/rewards/{reward_id}")
    async def admin_rewards_delete(reward_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        # Fetch file path first so we can also purge the storage object.
        try:
            existing = _supabase_get(
                f"master_rewards?id=eq.{_urlparse.quote(reward_id)}&select=resource_file_path&limit=1"
            ) or []
        except HTTPException as e:
            if _is_rewards_missing(e):
                raise HTTPException(status_code=503, detail=_REWARDS_TABLE_HINT)
            raise
        if not existing:
            raise HTTPException(status_code=404, detail="Reward not found")
        file_path = (existing[0] or {}).get("resource_file_path")
        _supabase_delete(f"master_rewards?id=eq.{_urlparse.quote(reward_id)}")
        if file_path and _SUPABASE_SR:
            try:
                import urllib.request
                req = urllib.request.Request(
                    f"{_SUPABASE_REST_URL}/storage/v1/object/{_REWARDS_BUCKET}/{file_path}",
                    method="DELETE",
                    headers={"Authorization": f"Bearer {_SUPABASE_SR}", "apikey": _SUPABASE_SR},
                )
                urllib.request.urlopen(req, timeout=8).read()
            except Exception as e:
                logger.warning(f"[rewards] failed to delete storage file {file_path}: {e}")
        return {"ok": True}

    @api_router.post("/admin/rewards/upload")
    async def admin_rewards_upload(
        file: UploadFile = File(...),
        user=Depends(_get_supabase_user),
    ):
        """Multipart file upload → Supabase Storage. Returns the object path
        + metadata to plug into `POST /admin/rewards` (or a subsequent PATCH)."""
        _ensure_admin(user)
        if not _SUPABASE_SR:
            raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY missing on server")
        raw = await file.read()
        if len(raw) > _REWARDS_MAX_BYTES:
            raise HTTPException(status_code=413, detail=f"File exceeds {_REWARDS_MAX_BYTES // (1024*1024)}MB limit")
        mime = (file.content_type or "").lower()
        if mime and _REWARDS_ALLOWED_MIME and mime not in _REWARDS_ALLOWED_MIME:
            # Some clients send generic octet-stream — accept those; only
            # hard-reject known bad types (e.g. images/executables).
            if not mime.startswith("application/") and mime != "text/csv":
                raise HTTPException(status_code=415, detail=f"MIME type {mime} not allowed for rewards")
        # Sanitize filename → keep original for display, prefix with uuid for
        # dedupe + safety.
        import uuid as _uuid
        safe_name = _re.sub(r"[^A-Za-z0-9._-]", "_", (file.filename or "reward.bin"))[:80]
        key = f"{_uuid.uuid4().hex}_{safe_name}"

        import urllib.request
        try:
            req = urllib.request.Request(
                f"{_SUPABASE_REST_URL}/storage/v1/object/{_REWARDS_BUCKET}/{key}",
                method="POST",
                data=raw,
                headers={
                    "Authorization": f"Bearer {_SUPABASE_SR}",
                    "apikey": _SUPABASE_SR,
                    "Content-Type": mime or "application/octet-stream",
                    "x-upsert": "true",
                    "cache-control": "3600",
                },
            )
            urllib.request.urlopen(req, timeout=60).read()
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="ignore")[:250]
            raise HTTPException(status_code=502, detail=f"Storage upload failed [{e.code}]: {body}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Storage upload failed: {e}")

        return {
            "resource_file_path": key,
            "resource_file_name": file.filename or safe_name,
            "resource_mime": mime or None,
            "resource_size_bytes": len(raw),
        }
