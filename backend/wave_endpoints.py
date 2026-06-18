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
import urllib.parse as _urlparse
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# These will be injected by server.py via register_wave_endpoints(...).
_supabase_get = None
_supabase_post = None
_supabase_patch = None
_get_supabase_user = None
_EMERGENT_LLM_KEY = None
ADMIN_ALLOWED_EMAILS = {"info@valuevade.com"}


# ---------------------------------------------------------------------------
# Admin auth helper
# ---------------------------------------------------------------------------
def _ensure_admin(user: dict):
    email = (user.get("email") or "").strip().lower()
    if email not in {e.lower() for e in ADMIN_ALLOWED_EMAILS}:
        raise HTTPException(status_code=403, detail="Admin access required.")


# ---------------------------------------------------------------------------
# Referral code generator (idempotent on first-read of profile)
# ---------------------------------------------------------------------------
def _generate_referral_code():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I confusion
    return "".join(random.choices(alphabet, k=6))


def _ensure_referral_code(user_id: str) -> Optional[str]:
    """Returns the user's referral_code, generating one on first call."""
    rows = _supabase_get(
        f"profiles?id=eq.{_urlparse.quote(user_id)}&select=referral_code&limit=1"
    ) or []
    if rows and rows[0].get("referral_code"):
        return rows[0]["referral_code"]
    # Generate + persist; retry on rare collision
    for _ in range(8):
        code = _generate_referral_code()
        existing = _supabase_get(
            f"profiles?referral_code=eq.{_urlparse.quote(code)}&select=id&limit=1"
        ) or []
        if existing:
            continue
        try:
            _supabase_patch(
                f"profiles?id=eq.{_urlparse.quote(user_id)}",
                {"referral_code": code},
            )
            return code
        except Exception as e:
            logger.warning(f"[referral] code persist failed: {e}")
            return code
    return None


# ===========================================================================
# Pydantic
# ===========================================================================
class ReferralAttachReq(BaseModel):
    ref_code: str = Field(..., min_length=4, max_length=12)


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
    global _supabase_get, _supabase_post, _supabase_patch, _get_supabase_user, _EMERGENT_LLM_KEY
    _supabase_get = deps["supabase_get"]
    _supabase_post = deps["supabase_post"]
    _supabase_patch = deps["supabase_patch"]
    _get_supabase_user = deps["get_supabase_user"]
    _EMERGENT_LLM_KEY = deps.get("emergent_llm_key")

    # ---------------- ADMIN PANEL ----------------
    @api_router.get("/admin/waitlist")
    async def admin_waitlist(user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        from server import db  # local import to avoid circular
        cursor = db.waitlist.find({}, {"_id": 0}).sort("timestamp", -1)
        rows = await cursor.to_list(length=5000)
        return {"total": len(rows), "entries": rows}

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

    # ---------------- REFERRALS ----------------
    @api_router.get("/referrals/me")
    async def referrals_me(user=Depends(_get_supabase_user)):
        user_id = user["id"]
        code = _ensure_referral_code(user_id)
        site_origin = os.environ.get("PUBLIC_SITE_ORIGIN", "https://valuevade.com")
        share_url = f"{site_origin.rstrip('/')}/signup?ref={code or ''}"
        events = _supabase_get(
            f"referral_events?referrer_user_id=eq.{_urlparse.quote(user_id)}"
            f"&select=referred_user_id,signup_xp_awarded,enrollment_xp_awarded,created_at"
            f"&order=created_at.desc&limit=200"
        ) or []
        total_signups = len(events)
        total_enrollments = sum(1 for e in events if e.get("enrollment_xp_awarded"))
        next_threshold = next((t for t in (5, 15, 50) if total_signups < t), None)
        return {
            "code": code,
            "share_url": share_url,
            "total_signups": total_signups,
            "total_enrollments": total_enrollments,
            "next_milestone_at": next_threshold,
            "events": events,
        }

    @api_router.post("/referrals/attach")
    async def referrals_attach(req: ReferralAttachReq, user=Depends(_get_supabase_user)):
        """Called by the SignupPage right after a successful signup when a
        ?ref= code is present in localStorage. Sets profiles.referred_by_user_id
        and creates the referral_events row, awarding +500 XP to the referrer."""
        user_id = user["id"]
        code = (req.ref_code or "").strip().upper()
        if len(code) < 4:
            raise HTTPException(status_code=400, detail="invalid referral code")
        # Find referrer
        rows = _supabase_get(
            f"profiles?referral_code=eq.{_urlparse.quote(code)}&select=id&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="referrer not found")
        referrer_id = rows[0]["id"]
        if referrer_id == user_id:
            raise HTTPException(status_code=400, detail="cannot refer yourself")
        # Don't re-write if already attached
        my_prof = _supabase_get(
            f"profiles?id=eq.{_urlparse.quote(user_id)}&select=referred_by_user_id&limit=1"
        ) or []
        if my_prof and my_prof[0].get("referred_by_user_id"):
            return {"ok": True, "already_attached": True}
        try:
            _supabase_patch(
                f"profiles?id=eq.{_urlparse.quote(user_id)}",
                {"referred_by_user_id": referrer_id},
            )
        except Exception as e:
            logger.warning(f"[referral] attach failed: {e}")
        # Insert event (idempotent via uq_referral_pair)
        try:
            _supabase_post(
                "referral_events",
                {"referrer_user_id": referrer_id, "referred_user_id": user_id,
                 "signup_xp_awarded": True},
                prefer="resolution=ignore-duplicates",
            )
        except Exception as e:
            logger.warning(f"[referral] event write failed: {e}")
        # Award referrer +500 XP (one-shot via reason)
        try:
            _supabase_post(
                "rpc/award_xp",
                {
                    "p_user_id": referrer_id,
                    "p_amount": 500,
                    "p_reason": "referral_signup",
                    "p_source_id": user_id,
                    "p_meta": {"referred_user_id": user_id, "code": code},
                },
            )
        except Exception as e:
            logger.warning(f"[referral] xp award failed: {e}")
        return {"ok": True, "attached_to": referrer_id}

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
