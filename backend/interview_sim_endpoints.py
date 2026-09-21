"""Module 20, Full Interview Simulation engine.

Five firm processes (J.P. Morgan, Morgan Stanley, Goldman Sachs, Motilal Oswal,
Kotak Institutional Equities), each a 5-stage pipeline:

    application → aptitude → behavioural → technical → case_study → decision

State machine lives in user_interview_attempts.stage_data (jsonb). All writes
go through service_role; learners read their own rows via RLS.
Claude Haiku powers interviewer turns / per-stage feedback; the final hiring-
committee report uses Sonnet 4.5.
"""
from __future__ import annotations

import asyncio
import base64 as _b64
import hashlib as _hashlib
import time as _time
import json as _json
import logging
import re as _re
import urllib.parse as _urlparse
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)

_supabase_get = None
_supabase_post = None
_supabase_patch = None
_supabase_delete = None
_get_supabase_user = None
_EMERGENT_LLM_KEY = None
ADMIN_ALLOWED_EMAILS = {"info@valuevade.com"}

# ── LLM cost tracking ────────────────────────────────────────────────────────
# Buffer: attempt_id → accumulated INR cost (flushed to profiles at milestones)
_iv_cost_buf: dict[str, float] = {}
_bump_iv_cost_fn = None          # injected via register()

_INR_PER_IN_IV  = (1.0 / 1_000_000.0) * 85.0   # ≈ Claude Haiku input rate
_INR_PER_OUT_IV = (5.0 / 1_000_000.0) * 85.0   # ≈ Claude Haiku output rate

# Sonnet is ~3× more expensive, used only for the final decision report.
_INR_PER_IN_SONNET  = (3.0 / 1_000_000.0) * 85.0   # ≈ Claude Sonnet input rate
_INR_PER_OUT_SONNET = (15.0 / 1_000_000.0) * 85.0  # ≈ Claude Sonnet output rate


def _iv_tok(text: str) -> int:
    """Approximate token count from text length (same formula as server.py)."""
    return max(1, len(text) // 4)


def _flush_iv_cost(att_id: str, user_id: str) -> None:
    """Write accumulated interview LLM spend for this attempt to profiles."""
    if not att_id or not user_id or not _bump_iv_cost_fn:
        return
    cost = _iv_cost_buf.pop(att_id, 0.0)
    if cost > 0.0:
        try:
            _bump_iv_cost_fn(user_id, round(cost, 6))
        except Exception as e:
            logger.warning("[interview-sim] cost flush failed: %s", e)
    # Safety cap: evict oldest entries if buffer grows unexpectedly large
    if len(_iv_cost_buf) > 500:
        oldest = list(_iv_cost_buf.keys())[:200]
        for k in oldest:
            _iv_cost_buf.pop(k, None)


def _ensure_admin(user: dict):
    email = (user.get("email") or "").strip().lower()
    if email not in {e.lower() for e in ADMIN_ALLOWED_EMAILS}:
        raise HTTPException(status_code=403, detail="Admin access required.")

HAIKU = ("anthropic", "claude-haiku-4-5-20251001")
SONNET = ("anthropic", "claude-sonnet-4-5-20250929")

STAGE_ORDER = ["application", "aptitude", "behavioural", "technical", "case_study", "decision"]
STAGE_WEIGHTS = {"aptitude": 0.15, "behavioural": 0.25, "technical": 0.30, "case_study": 0.30}
OFFER_THRESHOLD = 65.0
MAX_ATTEMPTS = 2


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _llm(system: str, text: str, tag: str, model=HAIKU, max_tokens: int = 900,
               _att_id: str = "",
               _cost_in: float = 0.0, _cost_out: float = 0.0) -> str:
    if not _EMERGENT_LLM_KEY:
        return ""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = (
        LlmChat(api_key=_EMERGENT_LLM_KEY, session_id=tag, system_message=system)
        .with_model(model[0], model[1])
        .with_params(max_tokens=max_tokens)
    )
    try:
        resp = await chat.send_message(UserMessage(text=text))
        text_out = (resp or "").strip()
        if _att_id:
            in_tok  = _iv_tok(system + text)
            out_tok = _iv_tok(text_out)
            # Use caller-supplied rates if provided; fall back to Haiku defaults.
            rate_in  = _cost_in  if _cost_in  > 0 else _INR_PER_IN_IV
            rate_out = _cost_out if _cost_out > 0 else _INR_PER_OUT_IV
            cost = in_tok * rate_in + out_tok * rate_out
            _iv_cost_buf[_att_id] = _iv_cost_buf.get(_att_id, 0.0) + cost
        return text_out
    except Exception as e:
        logger.warning(f"[interview-sim] LLM failed [{tag}]: {e}")
        return ""


def _strip_fence(text: str) -> str:
    t = (text or "").strip()
    if t.startswith("```"):
        t = _re.sub(r"^```(?:json)?\s*", "", t)
        t = _re.sub(r"\s*```\s*$", "", t)
    return t.strip()


def _parse_json(text: str, fallback):
    try:
        return _json.loads(_strip_fence(text))
    except Exception:
        return fallback


# ---------------------------------------------------------------------------
# Data access helpers
# ---------------------------------------------------------------------------
def _get_sims() -> list[dict]:
    return _supabase_get(
        "master_interview_sims?is_active=eq.true&select=*&order=order_index.asc"
    ) or []


def _get_sim(sim_id: str) -> Optional[dict]:
    rows = _supabase_get(
        f"master_interview_sims?id=eq.{_urlparse.quote(sim_id)}&select=*&limit=1"
    ) or []
    return rows[0] if rows else None


def _get_attempt_owned(attempt_id: str, user_id: str) -> dict:
    rows = _supabase_get(
        f"user_interview_attempts?id=eq.{_urlparse.quote(attempt_id)}"
        f"&user_id=eq.{_urlparse.quote(user_id)}&select=*&limit=1"
    ) or []
    if not rows:
        raise HTTPException(status_code=404, detail="attempt not found")
    return rows[0]


def _patch_attempt(attempt_id: str, patch: dict):
    _supabase_patch(f"user_interview_attempts?id=eq.{_urlparse.quote(attempt_id)}", patch)


def _get_attempt(attempt_id: str) -> dict:
    rows = _supabase_get(
        f"user_interview_attempts?id=eq.{_urlparse.quote(attempt_id)}&select=*&limit=1"
    ) or []
    return rows[0] if rows else {}


def _interview_module_gate(user_id: str) -> dict:
    """Are all sessions (video+notes) of the interview module done for this user?"""
    mods = _supabase_get(
        "master_modules?is_interview_module=eq.true"
        "&select=id,title,module_number&order=order_index.asc&limit=5"
    ) or []
    if not mods:
        return {"module": None, "unlocked": False, "videos_done": 0, "videos_total": 0, "user_module_id": None}
    master = mods[0]
    ums = _supabase_get(
        f"user_modules?master_module_id=eq.{_urlparse.quote(master['id'])}"
        "&is_removed=eq.false&select=id,enrollment_id,is_completed,"
        "user_enrollments!inner(user_id)"
        f"&user_enrollments.user_id=eq.{_urlparse.quote(user_id)}&limit=1"
    ) or []
    if not ums:
        return {"module": master, "unlocked": False, "videos_done": 0, "videos_total": 0, "user_module_id": None}
    um = ums[0]
    sessions = _supabase_get(
        f"user_sessions?user_module_id=eq.{_urlparse.quote(um['id'])}"
        "&is_removed=eq.false&select=id,notes_completed&limit=100"
    ) or []
    done = sum(1 for s in sessions if s.get("notes_completed"))
    total = len(sessions)
    return {
        "module": master,
        "unlocked": total > 0 and done == total,
        "videos_done": done,
        "videos_total": total,
        "user_module_id": um["id"],
        "module_completed": bool(um.get("is_completed")),
    }


def _maybe_complete_module(user_id: str):
    """Flip user_modules.is_completed once every active sim has a completed attempt."""
    gate = _interview_module_gate(user_id)
    if not gate.get("user_module_id") or gate.get("module_completed"):
        return False
    if not gate["unlocked"]:
        return False
    sims = _get_sims()
    if not sims:
        return False
    attempts = _supabase_get(
        f"user_interview_attempts?user_id=eq.{_urlparse.quote(user_id)}"
        "&status=eq.completed&select=sim_id"
    ) or []
    done_sim_ids = {a["sim_id"] for a in attempts}
    if not all(s["id"] in done_sim_ids for s in sims):
        return False
    _supabase_patch(
        f"user_modules?id=eq.{_urlparse.quote(gate['user_module_id'])}",
        {"is_completed": True, "completed_at": _now_iso()},
    )
    return True


# ---------------------------------------------------------------------------
# Sanitizers, never leak answers to the client mid-stage
# ---------------------------------------------------------------------------
def _public_sim(sim: dict, include_case: bool = False) -> dict:
    out = {k: sim.get(k) for k in (
        "id", "firm_slug", "firm_name", "firm_type", "role_title", "location",
        "salary_band", "about_md", "brand", "order_index")}
    proc = sim.get("process") or {}
    out["process_meta"] = {
        "aptitude": {k: (proc.get("aptitude") or {}).get(k) for k in ("num_questions", "time_limit_minutes", "pass_pct")},
        "behavioural": {"num_questions": (proc.get("behavioural") or {}).get("num_questions")},
        "technical": {"num_questions": (proc.get("technical") or {}).get("num_questions")},
        "case": {k: (proc.get("case") or {}).get(k) for k in ("time_limit_minutes", "company_blurb")},
    }
    if include_case:
        out["case_config"] = sim.get("case_config") or {}
    return out


def _public_stage_data(sd: dict) -> dict:
    out = _json.loads(_json.dumps(sd or {}))
    apt = out.get("aptitude") or {}
    if apt.get("questions") and not apt.get("completed_at"):
        apt["questions"] = [
            {k: v for k, v in q.items() if k not in ("correct_index", "explanation")}
            for q in apt["questions"]
        ]
        out["aptitude"] = apt
    return out


def _attempt_payload(att: dict, sim: dict) -> dict:
    include_case = att["current_stage"] in ("case_study", "decision")
    return {
        "attempt": {
            "id": att["id"],
            "sim_id": att["sim_id"],
            "attempt_number": att["attempt_number"],
            "status": att["status"],
            "current_stage": att["current_stage"],
            "stage_data": _public_stage_data(att.get("stage_data")),
            "final_score": att.get("final_score"),
            "verdict": att.get("verdict"),
            "started_at": att.get("started_at"),
            "completed_at": att.get("completed_at"),
        },
        "sim": _public_sim(sim, include_case=include_case),
    }


# ---------------------------------------------------------------------------
# Aptitude test generation (Haiku, with a static fallback bank)
# ---------------------------------------------------------------------------
FALLBACK_APTITUDE = [
    {"q": "A stock falls 20% and then rises 20%. The net change is:", "options": ["0%", "-4%", "+4%", "-2%"], "correct_index": 1, "topic": "numerical reasoning", "explanation": "0.8 × 1.2 = 0.96 → -4%."},
    {"q": "Revenue grows from ₹400 Cr to ₹484 Cr in 2 years. The CAGR is:", "options": ["9%", "10%", "11%", "21%"], "correct_index": 1, "topic": "numerical reasoning", "explanation": "√(484/400) = 1.10 → 10%."},
    {"q": "If EBITDA margin is 25% and revenue is ₹1,200 Cr, EBITDA is:", "options": ["₹250 Cr", "₹300 Cr", "₹325 Cr", "₹480 Cr"], "correct_index": 1, "topic": "numerical reasoning", "explanation": "1200 × 0.25 = 300."},
    {"q": "A company's P/E is 20x and EPS is ₹15. The share price is:", "options": ["₹200", "₹300", "₹350", "₹150"], "correct_index": 1, "topic": "numerical reasoning", "explanation": "20 × 15 = 300."},
    {"q": "Table: Q1 sales 120, Q2 sales 150, Q3 sales 135. The Q2→Q3 change is:", "options": ["+10%", "-10%", "-15%", "+12.5%"], "correct_index": 1, "topic": "data interpretation", "explanation": "(135-150)/150 = -10%."},
    {"q": "Segment A is 40% of revenue and grows 10%; Segment B (60%) grows 5%. Blended growth is:", "options": ["7.5%", "7%", "8%", "6.5%"], "correct_index": 1, "topic": "data interpretation", "explanation": "0.4×10 + 0.6×5 = 7%."},
    {"q": "All analysts are readers. Some readers are writers. Which MUST be true?", "options": ["All analysts are writers", "Some writers are analysts", "Some readers are analysts", "No analysts are writers"], "correct_index": 2, "topic": "logical reasoning", "explanation": "All analysts ⊆ readers ⇒ some readers are analysts."},
    {"q": "Complete the series: 3, 6, 12, 24, __", "options": ["36", "40", "48", "30"], "correct_index": 2, "topic": "logical reasoning", "explanation": "Each term doubles."},
    {"q": "If today is Wednesday, what day is it 100 days later?", "options": ["Thursday", "Friday", "Saturday", "Sunday"], "correct_index": 1, "topic": "logical reasoning", "explanation": "100 mod 7 = 2 → Friday."},
    {"q": "Pick the word closest in meaning to 'prudent':", "options": ["reckless", "cautious", "generous", "verbose"], "correct_index": 1, "topic": "verbal reasoning", "explanation": "Prudent ≈ cautious/careful."},
    {"q": "'The results were ___ expectations, so the stock rallied.' Choose the best fill:", "options": ["below", "ahead of", "in line with", "despite"], "correct_index": 1, "topic": "verbal reasoning", "explanation": "A beat → 'ahead of expectations'."},
    {"q": "A machine loses 10% of its value each year. After 2 years, ₹1,00,000 becomes:", "options": ["₹80,000", "₹81,000", "₹82,000", "₹90,000"], "correct_index": 1, "topic": "numerical reasoning", "explanation": "1,00,000 × 0.9² = 81,000."},
]

APTITUDE_GEN_PROMPT = """Generate {n} multiple-choice aptitude test questions for an entry-level equity research analyst hiring test at {firm}.

Mix: ~4 numerical reasoning (percentages, CAGR, ratios, quick mental math with Indian ₹ Cr figures), ~3 data interpretation (describe a tiny table inline in the question), ~3 logical reasoning (series, syllogisms, arrangements), ~2 verbal reasoning (vocabulary, sentence completion in a business context).

Difficulty: solvable in 60-75 seconds each without a calculator. Exactly 4 options each, ONE correct.

Return ONLY a JSON array (no markdown fences) of {n} objects with EXACTLY these keys:
[{{"q": "...", "options": ["...","...","...","..."], "correct_index": 0-3, "topic": "numerical reasoning|data interpretation|logical reasoning|verbal reasoning", "explanation": "one-line why"}}]"""


async def _generate_aptitude(sim: dict, attempt_id: str) -> list[dict]:
    proc = (sim.get("process") or {}).get("aptitude") or {}
    n = int(proc.get("num_questions") or 12)
    raw = await _llm(
        "You write rigorous but fair aptitude test questions for finance hiring. Output strict JSON only.",
        APTITUDE_GEN_PROMPT.format(n=n, firm=sim["firm_name"]),
        f"ivs-{attempt_id}-apt-gen",
        max_tokens=3500,
        _att_id=attempt_id,
    )
    qs = _parse_json(raw, None)
    valid = []
    if isinstance(qs, list):
        for q in qs:
            try:
                if (isinstance(q.get("q"), str) and isinstance(q.get("options"), list)
                        and len(q["options"]) == 4 and 0 <= int(q.get("correct_index", -1)) <= 3):
                    valid.append({
                        "q": q["q"], "options": [str(o) for o in q["options"]],
                        "correct_index": int(q["correct_index"]),
                        "topic": q.get("topic") or "numerical reasoning",
                        "explanation": q.get("explanation") or "",
                    })
            except Exception:
                continue
    if len(valid) < n:
        for fb in FALLBACK_APTITUDE:
            if len(valid) >= n:
                break
            valid.append(dict(fb))
    return valid[:n]


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
APPLICATION_FEEDBACK_PROMPT = """You are a recruiter at {firm} screening applications for the "{role}" position ({location}).

The candidate has completed Valuevade's equity research program (financial modelling, valuation, ratio analysis, Indian markets). Here is their application:

Why {firm}: {why_firm}
Why equity research: {why_er}
Proudest achievement: {achievement}
Cover note: {cover_note}

Score the application 0-100 (most candidates land 55-80; above 85 only for genuinely compelling, specific applications) and give personalised feedback.

Return ONLY JSON (no fences): {{"score": <0-100>, "feedback_md": "<120-180 words of markdown feedback: 2 things that worked, 2 concrete improvements, written like a helpful recruiter>", "screening_note": "<one internal-memo style sentence a recruiter would write when shortlisting this candidate>"}}"""

INTERVIEWER_SYSTEM = """You are conducting the {stage_label} interview round for the "{role}" position at {firm} ({location}).

Interviewer persona: {persona}

Round focus: {focus}

Rules:
- Ask ONE question at a time. After each candidate answer, either drill deeper with a follow-up (if the answer was weak or interesting) or move to a new area from the round focus.
- Use Indian market context and INR. Reference real Indian companies where natural.
- Be professional and realistic, never sycophantic. Challenge vague answers.
- Ask a maximum of {n} questions total in this round.
- Respond with ONLY your next utterance (question or follow-up). No meta-commentary, no JSON, no role labels."""

ROUND_SCORE_PROMPT = """Score this {stage_label} interview round for the "{role}" role at {firm} on a 0-100 scale. Be honest, most candidates land 50-75; above 85 only for genuinely strong performances.

Return ONLY JSON (no fences) with EXACTLY these keys:
{{"score": <0-100>, "strengths": ["...","..."], "gaps": ["...","..."], "feedback_bullets": ["...","...","..."], "per_question": [{{"q": "<first 10 words of the question>", "verdict": "strong|okay|weak", "tip": "<one-line specific tip>"}}]}}

Transcript:
{transcript}"""

CASE_FEEDBACK_PROMPT = """You are a senior equity research analyst at {firm} evaluating a candidate's case-study round for the "{role}" role.

The modelling task (auto-graded spreadsheet) scored {excel_score}/100. Model context: {case_summary}

The candidate's written investment recommendation:
---
{recommendation}
---

Score the WRITTEN recommendation 0-100 on: clear BUY/HOLD/SELL call with target price (30%), thesis quality & use of the model's numbers (40%), risk awareness (15%), structure & professional tone (15%).

Return ONLY JSON (no fences): {{"written_score": <0-100>, "feedback_md": "<150-220 words markdown: what a real senior analyst would say, specific praise, specific gaps, reference their actual numbers/claims>"}}"""

FINAL_REPORT_PROMPT = """You are the hiring committee chair at {firm} deciding on a candidate for "{role}" ({location}, {salary_band}).

Stage results:
{stage_summary}

Weighted final score: {final_score}/100. Decision (already made): {verdict_word}.

Candidate answer excerpts:
{excerpts}

Write TWO markdown documents and return ONLY JSON (no fences):
{{"letter_md": "<the official {letter_kind} letter from {firm} HR, ~120 words, realistic corporate tone, addressed to the candidate{letter_extra}>",
"report_md": "<a ~300-word personalised hiring-committee debrief: per-stage assessment referencing their ACTUAL answers, the 3 most urgent things to improve ranked by impact, and one genuinely encouraging closing line calibrated to their performance>"}}"""


def _stage_cfg(sim: dict, stage: str) -> dict:
    return (sim.get("process") or {}).get(stage) or {}


def _transcript(turns: list[dict]) -> str:
    return "\n\n".join(
        f"{'Interviewer' if t['role'] == 'interviewer' else 'Candidate'}: {t['content']}"
        for t in turns
    )


async def _score_round(sim: dict, attempt_id: str, stage: str, turns: list[dict]) -> dict:
    label = "behavioural" if stage == "behavioural" else "technical"
    raw = await _llm(
        "You are a senior interview coach scoring mock finance interview rounds. Output strict JSON only.",
        ROUND_SCORE_PROMPT.format(stage_label=label, role=sim["role_title"], firm=sim["firm_name"],
                                  transcript=_transcript(turns)[:7000]),
        f"ivs-{attempt_id}-{stage}-score",
        max_tokens=1200,
        _att_id=attempt_id,
    )
    data = _parse_json(raw, {})
    score = max(0.0, min(100.0, float(data.get("score", 60) or 60)))
    return {
        "score": round(score, 1),
        "strengths": data.get("strengths") or ["Engaged with every question"],
        "gaps": data.get("gaps") or ["Answers could be more specific"],
        "feedback_bullets": data.get("feedback_bullets") or ["Quantify your impact", "Use real Indian company examples", "Tighten structure"],
        "per_question": data.get("per_question") or [],
    }


async def _finalize_attempt(att: dict, sim: dict, sd: dict, rejected_at: Optional[str] = None) -> dict:
    """Compute verdict + Sonnet report, mark attempt completed, maybe flip module."""
    scores = {
        "aptitude": (sd.get("aptitude") or {}).get("score_pct"),
        "behavioural": (sd.get("behavioural") or {}).get("score"),
        "technical": (sd.get("technical") or {}).get("score"),
        "case_study": (sd.get("case_study") or {}).get("score"),
    }
    if rejected_at:
        final_score = round(float(scores.get("aptitude") or 0), 1)
        verdict = "rejected"
    else:
        total_w = sum(w for k, w in STAGE_WEIGHTS.items() if scores.get(k) is not None)
        final_score = round(
            sum(float(scores[k]) * w for k, w in STAGE_WEIGHTS.items() if scores.get(k) is not None)
            / (total_w or 1.0), 1)
        verdict = "offer" if final_score >= OFFER_THRESHOLD else "rejected"

    stage_summary = "\n".join(
        f"- {k}: {scores[k] if scores[k] is not None else 'not reached (rejected earlier)'}"
        f"{' /100' if scores[k] is not None else ''}"
        for k in ("aptitude", "behavioural", "technical", "case_study")
    )
    if rejected_at == "aptitude":
        stage_summary += "\n- NOTE: candidate was cut at the online aptitude test (below cutoff)."

    excerpts = []
    for st in ("behavioural", "technical"):
        for t in ((sd.get(st) or {}).get("turns") or []):
            if t["role"] == "candidate":
                excerpts.append(f"({st}) {t['content'][:220]}")
    rec = (sd.get("case_study") or {}).get("recommendation")
    if rec:
        excerpts.append(f"(case recommendation) {rec[:400]}")
    if (sd.get("application") or {}).get("responses"):
        excerpts.insert(0, f"(application, why firm) {sd['application']['responses'].get('why_firm', '')[:200]}")

    letter_kind = "offer" if verdict == "offer" else "rejection"
    letter_extra = f", mentioning the compensation band {sim.get('salary_band')}" if verdict == "offer" else ", polite and encouraging, inviting them to reapply"
    raw = await _llm(
        "You are a hiring committee chair writing realistic hiring documents. Output strict JSON only.",
        FINAL_REPORT_PROMPT.format(
            firm=sim["firm_name"], role=sim["role_title"], location=sim.get("location") or "Mumbai",
            salary_band=sim.get("salary_band") or "competitive", stage_summary=stage_summary,
            final_score=final_score, verdict_word="OFFER EXTENDED" if verdict == "offer" else "NOT SELECTED",
            excerpts="\n".join(excerpts[:12]) or "(none)", letter_kind=letter_kind, letter_extra=letter_extra,
        ),
        f"ivs-{att['id']}-final",
        model=SONNET,
        max_tokens=1800,
        _att_id=att["id"],
        _cost_in=_INR_PER_IN_SONNET,
        _cost_out=_INR_PER_OUT_SONNET,
    )
    data = _parse_json(raw, {})
    letter_md = data.get("letter_md") or (
        f"**{sim['firm_name']}, Talent Acquisition**\n\nDear Candidate,\n\n"
        + ("We are delighted to extend you an offer for the role of "
           f"{sim['role_title']} ({sim.get('salary_band')}). Congratulations, we look forward to welcoming you to the team."
           if verdict == "offer" else
           f"Thank you for interviewing for the {sim['role_title']} role. After careful consideration we will not be "
           "moving forward at this time. We encourage you to apply again, many successful hires joined on their second attempt.")
    )
    report_md = data.get("report_md") or (
        f"Final weighted score: **{final_score}/100**. "
        "Focus on adding specific numbers and Indian-market examples to every answer, and tighten your written recommendation structure."
    )

    sd["decision"] = {
        "final_score": final_score,
        "verdict": verdict,
        "stage_scores": scores,
        "rejected_at": rejected_at,
        "letter_md": letter_md,
        "report_md": report_md,
        "completed_at": _now_iso(),
    }
    _patch_attempt(att["id"], {
        "stage_data": sd,
        "current_stage": "decision",
        "status": "completed",
        "final_score": final_score,
        "verdict": verdict,
        "completed_at": _now_iso(),
    })
    module_completed = False
    try:
        module_completed = _maybe_complete_module(att["user_id"])
    except Exception as e:
        logger.warning(f"[interview-sim] module flip failed: {e}")
    # Flush all LLM costs accumulated for this attempt to the user's profile
    _flush_iv_cost(att["id"], att["user_id"])
    return {"decision": sd["decision"], "module_completed": module_completed}


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------
def register_interview_sim_endpoints(api_router: APIRouter, deps: dict):
    global _supabase_get, _supabase_post, _supabase_patch, _supabase_delete, _get_supabase_user, _EMERGENT_LLM_KEY, _bump_iv_cost_fn
    _supabase_get = deps["supabase_get"]
    _supabase_post = deps["supabase_post"]
    _supabase_patch = deps["supabase_patch"]
    _supabase_delete = deps.get("supabase_delete")
    _get_supabase_user = deps["get_supabase_user"]
    _EMERGENT_LLM_KEY  = deps.get("emergent_llm_key")
    _bump_iv_cost_fn   = deps.get("bump_pari_cost")  # reuses same profiles column

    # ------------------------------------------------------------------ hub
    @api_router.get("/interview-sim/overview")
    async def interview_sim_overview(user=Depends(_get_supabase_user)):
        gate = _interview_module_gate(user["id"])
        sims = _get_sims()
        attempts = _supabase_get(
            f"user_interview_attempts?user_id=eq.{_urlparse.quote(user['id'])}"
            "&select=id,sim_id,attempt_number,status,current_stage,final_score,verdict,started_at,completed_at"
            "&order=attempt_number.asc"
        ) or []
        by_sim = {}
        for a in attempts:
            by_sim.setdefault(a["sim_id"], []).append(a)
        firms = []
        for s in sims:
            mine = by_sim.get(s["id"], [])
            in_progress = next((a for a in mine if a["status"] == "in_progress"), None)
            completed = [a for a in mine if a["status"] == "completed"]
            firms.append({
                **_public_sim(s),
                "my_attempts": mine,
                "in_progress_attempt_id": in_progress["id"] if in_progress else None,
                "best_verdict": ("offer" if any(a["verdict"] == "offer" for a in completed)
                                  else ("rejected" if completed else None)),
                "attempts_used": len(mine),
                "attempts_left": max(0, MAX_ATTEMPTS - len(mine)),
                "is_done": bool(completed),
            })
        sims_completed = sum(1 for f in firms if f["is_done"])
        return {
            "module": gate["module"],
            "unlocked": gate["unlocked"],
            "videos_done": gate["videos_done"],
            "videos_total": gate["videos_total"],
            "module_completed": gate.get("module_completed", False),
            "sims_completed": sims_completed,
            "sims_total": len(firms),
            "firms": firms,
        }

    # ---------------------------------------------------------------- start
    @api_router.post("/interview-sim/start")
    async def interview_sim_start(body: dict, user=Depends(_get_supabase_user)):
        sim_id = (body or {}).get("sim_id")
        if not sim_id:
            raise HTTPException(status_code=400, detail="sim_id required")
        sim = _get_sim(sim_id)
        if not sim:
            raise HTTPException(status_code=404, detail="simulation not found")
        gate = _interview_module_gate(user["id"])
        if not gate["unlocked"]:
            raise HTTPException(status_code=403, detail={
                "reason": "videos_incomplete",
                "message": f"Finish all module videos first ({gate['videos_done']}/{gate['videos_total']} done).",
            })
        mine = _supabase_get(
            f"user_interview_attempts?user_id=eq.{_urlparse.quote(user['id'])}"
            f"&sim_id=eq.{_urlparse.quote(sim_id)}&select=id,attempt_number,status"
            "&order=attempt_number.asc"
        ) or []
        in_progress = next((a for a in mine if a["status"] == "in_progress"), None)
        if in_progress:
            return {"attempt_id": in_progress["id"], "resumed": True}
        if len(mine) >= MAX_ATTEMPTS:
            raise HTTPException(status_code=409, detail={
                "reason": "attempts_exhausted",
                "message": f"You have used both attempts for {sim['firm_name']}.",
            })
        row = _supabase_post("user_interview_attempts", {
            "user_id": user["id"],
            "sim_id": sim_id,
            "attempt_number": len(mine) + 1,
            "status": "in_progress",
            "current_stage": "application",
            "stage_data": {},
        }, prefer="return=representation")
        if isinstance(row, list):
            row = row[0] if row else None
        if not row:
            raise HTTPException(status_code=500, detail="could not create attempt")
        return {"attempt_id": row["id"], "resumed": False}

    # ----------------------------------------------------------------- read
    @api_router.get("/interview-sim/attempt/{attempt_id}")
    async def interview_sim_attempt(attempt_id: str, user=Depends(_get_supabase_user)):
        att = _get_attempt_owned(attempt_id, user["id"])
        sim = _get_sim(att["sim_id"])
        if not sim:
            raise HTTPException(status_code=404, detail="simulation not found")
        return _attempt_payload(att, sim)

    # ---------------------------------------------------------- application
    @api_router.post("/interview-sim/attempt/{attempt_id}/application")
    async def interview_sim_application(attempt_id: str, body: dict, user=Depends(_get_supabase_user)):
        att = _get_attempt_owned(attempt_id, user["id"])
        if att["current_stage"] != "application" or att["status"] != "in_progress":
            raise HTTPException(status_code=409, detail="application stage is not active")
        sim = _get_sim(att["sim_id"])
        responses = (body or {}).get("responses") or {}
        required = ["why_firm", "why_er", "achievement"]
        for f in required:
            if not str(responses.get(f) or "").strip():
                raise HTTPException(status_code=400, detail=f"'{f}' is required")
            if len(str(responses.get(f))) > 2500:
                raise HTTPException(status_code=400, detail=f"'{f}' too long (max 2500 chars)")

        raw = await _llm(
            "You are a realistic finance recruiter. Output strict JSON only.",
            APPLICATION_FEEDBACK_PROMPT.format(
                firm=sim["firm_name"], role=sim["role_title"], location=sim.get("location") or "Mumbai",
                why_firm=responses.get("why_firm", "")[:1200],
                why_er=responses.get("why_er", "")[:1200],
                achievement=responses.get("achievement", "")[:1200],
                cover_note=responses.get("cover_note", "(none)")[:1200],
            ),
            f"ivs-{attempt_id}-application",
            max_tokens=900,
            _att_id=attempt_id,
        )
        data = _parse_json(raw, {})
        score = max(0.0, min(100.0, float(data.get("score", 65) or 65)))
        sd = att.get("stage_data") or {}
        sd["application"] = {
            "responses": responses,
            "score": round(score, 1),
            "feedback_md": data.get("feedback_md") or "Your application was reviewed and shortlisted. Add more specific, quantified achievements next time.",
            "screening_note": data.get("screening_note") or "Shortlisted for online assessment.",
            "completed_at": _now_iso(),
        }
        _patch_attempt(attempt_id, {"stage_data": sd, "current_stage": "aptitude"})
        return {"ok": True, "application": sd["application"], "next_stage": "aptitude"}

    # ------------------------------------------------------------- aptitude
    @api_router.post("/interview-sim/attempt/{attempt_id}/aptitude/start")
    async def interview_sim_aptitude_start(attempt_id: str, user=Depends(_get_supabase_user)):
        att = _get_attempt_owned(attempt_id, user["id"])
        if att["current_stage"] != "aptitude" or att["status"] != "in_progress":
            raise HTTPException(status_code=409, detail="aptitude stage is not active")
        sim = _get_sim(att["sim_id"])
        cfg = _stage_cfg(sim, "aptitude")
        sd = att.get("stage_data") or {}
        apt = sd.get("aptitude") or {}

        # Fast path: questions already generated.
        if apt.get("questions"):
            public_qs = [{k: v for k, v in q.items() if k not in ("correct_index", "explanation")}
                         for q in apt["questions"]]
            return {
                "questions": public_qs,
                "started_at": apt["started_at"],
                "time_limit_minutes": int(cfg.get("time_limit_minutes") or 15),
                "pass_pct": int(cfg.get("pass_pct") or 40),
            }

        # Slow path: LLM generation takes ~30-45s which trips the ingress 30s
        # timeout (520 error). Fire the work in a background task and let the
        # frontend poll this same endpoint every few seconds.
        gen_started_at = apt.get("_gen_started_at")
        now_ts = _time.time()
        # Restart the task if the previous one stalled for >120s
        should_start = not gen_started_at or (now_ts - float(gen_started_at)) > 120

        if should_start:
            apt["_gen_started_at"] = now_ts
            sd["aptitude"] = apt
            _patch_attempt(attempt_id, {"stage_data": sd})

            async def _bg_generate():
                try:
                    questions = await _generate_aptitude(sim, attempt_id)
                    # Re-fetch to avoid clobbering concurrent writes.
                    fresh = _get_attempt(attempt_id)
                    fsd = fresh.get("stage_data") or {}
                    fapt = fsd.get("aptitude") or {}
                    fapt["questions"] = questions
                    fapt["started_at"] = _now_iso()
                    fapt.pop("_gen_started_at", None)
                    fsd["aptitude"] = fapt
                    _patch_attempt(attempt_id, {"stage_data": fsd})
                except Exception as exc:
                    logger.exception("[interview-sim] background aptitude gen failed: %s", exc)
                    fresh = _get_attempt(attempt_id) or {}
                    fsd = fresh.get("stage_data") or {}
                    fapt = fsd.get("aptitude") or {}
                    fapt.pop("_gen_started_at", None)
                    fapt["_gen_error"] = str(exc)[:200]
                    fsd["aptitude"] = fapt
                    try:
                        _patch_attempt(attempt_id, {"stage_data": fsd})
                    except Exception:
                        pass

            asyncio.create_task(_bg_generate())

        return {
            "pending": True,
            "poll_seconds": 3,
            "time_limit_minutes": int(cfg.get("time_limit_minutes") or 15),
            "pass_pct": int(cfg.get("pass_pct") or 40),
        }

    @api_router.post("/interview-sim/attempt/{attempt_id}/aptitude/submit")
    async def interview_sim_aptitude_submit(attempt_id: str, body: dict, user=Depends(_get_supabase_user)):
        att = _get_attempt_owned(attempt_id, user["id"])
        if att["current_stage"] != "aptitude" or att["status"] != "in_progress":
            raise HTTPException(status_code=409, detail="aptitude stage is not active")
        sim = _get_sim(att["sim_id"])
        cfg = _stage_cfg(sim, "aptitude")
        sd = att.get("stage_data") or {}
        apt = sd.get("aptitude") or {}
        questions = apt.get("questions") or []
        if not questions:
            raise HTTPException(status_code=409, detail="test not started")
        if apt.get("completed_at"):
            raise HTTPException(status_code=409, detail="test already submitted")
        answers = (body or {}).get("answers")
        if not isinstance(answers, list):
            raise HTTPException(status_code=400, detail="answers must be a list")

        correct = 0
        review = []
        for i, q in enumerate(questions):
            given = answers[i] if i < len(answers) else None
            ok = isinstance(given, int) and given == q["correct_index"]
            if ok:
                correct += 1
            review.append({
                "q": q["q"], "options": q["options"], "topic": q.get("topic"),
                "given_index": given if isinstance(given, int) else None,
                "correct_index": q["correct_index"],
                "correct": ok, "explanation": q.get("explanation") or "",
            })
        pct = round(correct / max(1, len(questions)) * 100.0, 1)
        pass_pct = float(cfg.get("pass_pct") or 40)
        passed = pct >= pass_pct

        by_topic = {}
        for r in review:
            t = r.get("topic") or "other"
            by_topic.setdefault(t, [0, 0])
            by_topic[t][1] += 1
            if r["correct"]:
                by_topic[t][0] += 1
        topic_lines = ", ".join(f"{t}: {c}/{n}" for t, (c, n) in by_topic.items())
        raw = await _llm(
            "You are an assessment coach. Be specific and concise.",
            f"A candidate scored {pct}% ({correct}/{len(questions)}) on {sim['firm_name']}'s online aptitude test "
            f"(reference cutoff {pass_pct}%). Topic breakdown, {topic_lines}. "
            f"They are advancing to the interview rounds regardless of this score (the final verdict is decided after all rounds). "
            "Write 90-130 words of markdown feedback: their strongest area, their weakest area with ONE concrete practice tip, and one line on pacing for timed tests.",
            f"ivs-{attempt_id}-apt-fb",
            max_tokens=500,
            _att_id=attempt_id,
        )
        apt.update({
            "answers": answers,
            "score_pct": pct,
            "correct": correct,
            "total": len(questions),
            "passed": passed,  # informational only, no longer gates progression
            "by_topic": {t: {"correct": c, "total": n} for t, (c, n) in by_topic.items()},
            "review": review,
            "feedback_md": raw or f"You scored {pct}% against a {pass_pct}% reference cutoff.",
            "completed_at": _now_iso(),
        })
        sd["aptitude"] = apt

        # Always advance, no early termination. The final selection decision
        # is revealed only at the end (in _finalize_attempt).
        _patch_attempt(attempt_id, {"stage_data": sd, "current_stage": "behavioural"})
        _flush_iv_cost(attempt_id, user["id"])   # flush aptitude-stage LLM spend
        return {"ok": True, "aptitude": apt, "passed": passed, "next_stage": "behavioural"}

    # ------------------------------------------------------ interview rounds
    def _interview_stage_or_409(att: dict, stage: str):
        if stage not in ("behavioural", "technical"):
            raise HTTPException(status_code=400, detail="stage must be behavioural or technical")
        if att["current_stage"] != stage or att["status"] != "in_progress":
            raise HTTPException(status_code=409, detail=f"{stage} stage is not active")

    def _interviewer_system(sim: dict, stage: str) -> str:
        cfg = _stage_cfg(sim, stage)
        return INTERVIEWER_SYSTEM.format(
            stage_label="behavioural (HR)" if stage == "behavioural" else "technical",
            role=sim["role_title"], firm=sim["firm_name"], location=sim.get("location") or "Mumbai",
            persona=(sim.get("process") or {}).get("persona") or "A professional, probing interviewer.",
            focus=cfg.get("focus") or "General equity research readiness.",
            n=int(cfg.get("num_questions") or 5),
        )

    @api_router.post("/interview-sim/attempt/{attempt_id}/interview/begin")
    async def interview_sim_round_begin(attempt_id: str, body: dict, user=Depends(_get_supabase_user)):
        stage = (body or {}).get("stage")
        att = _get_attempt_owned(attempt_id, user["id"])
        _interview_stage_or_409(att, stage)
        sim = _get_sim(att["sim_id"])
        sd = att.get("stage_data") or {}
        st = sd.get(stage) or {}
        if st.get("turns"):
            return {"turns": st["turns"], "num_questions": int(_stage_cfg(sim, stage).get("num_questions") or 5)}
        first = await _llm(
            _interviewer_system(sim, stage),
            "Start the round now. Give a one-sentence warm, realistic greeting introducing yourself by role "
            "(no personal names), then ask your FIRST question. Keep both together in one message.",
            f"ivs-{attempt_id}-{stage}-q1",
            max_tokens=400,
            _att_id=attempt_id,
        ) or ("Welcome, let's begin. Tell me about a time you worked under real pressure. Walk me through it using the STAR structure."
              if stage == "behavioural" else
              "Welcome, let's get into technicals. Walk me through how you would build a DCF for an Indian consumer company.")
        st = {"turns": [{"role": "interviewer", "content": first, "at": _now_iso()}]}
        sd[stage] = st
        _patch_attempt(attempt_id, {"stage_data": sd})
        return {"turns": st["turns"], "num_questions": int(_stage_cfg(sim, stage).get("num_questions") or 5)}

    @api_router.post("/interview-sim/attempt/{attempt_id}/interview/answer")
    async def interview_sim_round_answer(attempt_id: str, body: dict, user=Depends(_get_supabase_user)):
        stage = (body or {}).get("stage")
        answer = str((body or {}).get("answer") or "").strip()
        input_method = (body or {}).get("input_method") or "text"
        if not answer:
            raise HTTPException(status_code=400, detail="answer required")
        if len(answer) > 6000:
            raise HTTPException(status_code=400, detail="answer too long (max 6000 chars)")
        att = _get_attempt_owned(attempt_id, user["id"])
        _interview_stage_or_409(att, stage)
        sim = _get_sim(att["sim_id"])
        cfg = _stage_cfg(sim, stage)
        n_questions = int(cfg.get("num_questions") or 5)
        sd = att.get("stage_data") or {}
        st = sd.get(stage) or {"turns": []}
        turns = st.get("turns") or []
        if not turns:
            raise HTTPException(status_code=409, detail="round not started, call /interview/begin first")

        turns.append({"role": "candidate", "content": answer, "input_method": input_method, "at": _now_iso()})
        answered = sum(1 for t in turns if t["role"] == "candidate")

        if answered >= n_questions:
            closing = "Thank you, that wraps up this round. The team will review your responses."
            turns.append({"role": "interviewer", "content": closing, "at": _now_iso()})
            st["turns"] = turns
            result = await _score_round(sim, attempt_id, stage, turns)
            st.update(result)
            st["completed_at"] = _now_iso()
            sd[stage] = st
            next_stage = "technical" if stage == "behavioural" else "case_study"
            _patch_attempt(attempt_id, {"stage_data": sd, "current_stage": next_stage})
            return {"round_complete": True, "closing": closing, "result": result, "next_stage": next_stage}

        next_q = await _llm(
            _interviewer_system(sim, stage),
            f"Conversation so far:\n\n{_transcript(turns)[:7000]}\n\n"
            f"The candidate has answered {answered} of {n_questions} questions. "
            "Continue the interview with ONE next question or follow-up.",
            f"ivs-{attempt_id}-{stage}-q{answered + 1}",
            max_tokens=400,
            _att_id=attempt_id,
        ) or "Interesting. Can you make that concrete, give me a specific example with numbers?"
        turns.append({"role": "interviewer", "content": next_q, "at": _now_iso()})
        st["turns"] = turns
        sd[stage] = st
        _patch_attempt(attempt_id, {"stage_data": sd})
        _flush_iv_cost(attempt_id, user["id"])   # flush per-turn spend immediately
        return {"round_complete": False, "next_question": next_q,
                "answered": answered, "num_questions": n_questions}

    # ------------------------------------------------------------ case study
    @api_router.post("/interview-sim/attempt/{attempt_id}/case/submit")
    async def interview_sim_case_submit(attempt_id: str, body: dict, user=Depends(_get_supabase_user)):
        att = _get_attempt_owned(attempt_id, user["id"])
        if att["current_stage"] != "case_study" or att["status"] != "in_progress":
            raise HTTPException(status_code=409, detail="case stage is not active")
        sim = _get_sim(att["sim_id"])
        recommendation = str((body or {}).get("recommendation") or "").strip()
        excel = (body or {}).get("excel_score") or {}
        if len(recommendation) < 120:
            raise HTTPException(status_code=400, detail="recommendation too short, write at least ~150 words")
        if len(recommendation) > 6000:
            raise HTTPException(status_code=400, detail="recommendation too long")
        try:
            excel_total = max(0.0, min(100.0, float(excel.get("total", 0) or 0)))
        except Exception:
            excel_total = 0.0

        case_summary = _json.dumps((sim.get("case_config") or {}).get("expected_summary") or {})
        raw = await _llm(
            "You are a senior equity research analyst evaluating case rounds. Output strict JSON only.",
            CASE_FEEDBACK_PROMPT.format(
                firm=sim["firm_name"], role=sim["role_title"], excel_score=round(excel_total),
                case_summary=case_summary, recommendation=recommendation[:4500],
            ),
            f"ivs-{attempt_id}-case",
            max_tokens=1000,
            _att_id=attempt_id,
        )
        data = _parse_json(raw, {})
        written = max(0.0, min(100.0, float(data.get("written_score", 60) or 60)))
        combined = round(excel_total * 0.5 + written * 0.5, 1)
        sd = att.get("stage_data") or {}
        sd["case_study"] = {
            "excel_score": {"total": excel_total, "per_cell": excel.get("per_cell") or {}},
            "recommendation": recommendation,
            "written_score": round(written, 1),
            "score": combined,
            "feedback_md": data.get("feedback_md") or "Your recommendation was reviewed. Anchor the call more explicitly to your model's output next time.",
            "completed_at": _now_iso(),
        }
        result = await _finalize_attempt({**att, "stage_data": sd}, sim, sd)
        return {"ok": True, "case_study": sd["case_study"], "next_stage": "decision", **result}

    # =========================================================================
    # ADMIN CRUD, manage the 5 mock interview firms + their content
    # =========================================================================
    def _module_id_for_admin() -> str:
        rows = _supabase_get(
            "master_modules?is_interview_module=eq.true&select=id&order=order_index.asc&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="No interview module found (set master_modules.is_interview_module=true).")
        return rows[0]["id"]

    def _admin_sim_full(row: dict) -> dict:
        return {
            "id": row.get("id"),
            "module_id": row.get("module_id"),
            "firm_slug": row.get("firm_slug"),
            "firm_name": row.get("firm_name"),
            "firm_type": row.get("firm_type") or "global",
            "role_title": row.get("role_title"),
            "location": row.get("location"),
            "salary_band": row.get("salary_band"),
            "about_md": row.get("about_md"),
            "brand": row.get("brand") or {},
            "process": row.get("process") or {},
            "case_config": row.get("case_config") or {},
            "order_index": row.get("order_index") or 1,
            "is_active": bool(row.get("is_active", True)),
            "created_at": row.get("created_at"),
        }

    def _slug_ok(s: str) -> str:
        s = (s or "").strip().lower()
        if not _re.fullmatch(r"[a-z0-9][a-z0-9-]{1,63}", s or ""):
            raise HTTPException(status_code=400, detail="firm_slug must be lowercase letters/digits/dashes (2-64 chars)")
        return s

    @api_router.get("/admin/interview-sims")
    async def admin_interview_sims_list(user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            "master_interview_sims?select=*&order=order_index.asc&limit=100"
        ) or []
        # attach attempt count per sim (for delete-safety warnings)
        counts = _supabase_get("user_interview_attempts?select=sim_id&limit=10000") or []
        by_sim: dict[str, int] = {}
        for c in counts:
            by_sim[c["sim_id"]] = by_sim.get(c["sim_id"], 0) + 1
        out = []
        for r in rows:
            item = _admin_sim_full(r)
            item["attempts_count"] = by_sim.get(r["id"], 0)
            out.append(item)
        return {"sims": out}

    @api_router.get("/admin/interview-sims/{sim_id}")
    async def admin_interview_sim_get(sim_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            f"master_interview_sims?id=eq.{_urlparse.quote(sim_id)}&select=*&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="simulation not found")
        return {"sim": _admin_sim_full(rows[0])}

    @api_router.post("/admin/interview-sims")
    async def admin_interview_sim_create(body: dict, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        body = body or {}
        firm_slug = _slug_ok(body.get("firm_slug"))
        firm_name = (body.get("firm_name") or "").strip()
        role_title = (body.get("role_title") or "").strip()
        if not firm_name or not role_title:
            raise HTTPException(status_code=400, detail="firm_name and role_title are required")

        # unique slug check
        existing = _supabase_get(
            f"master_interview_sims?firm_slug=eq.{_urlparse.quote(firm_slug)}&select=id&limit=1"
        ) or []
        if existing:
            raise HTTPException(status_code=409, detail=f"firm_slug '{firm_slug}' is already taken")

        # compute next order_index
        all_rows = _supabase_get("master_interview_sims?select=order_index&order=order_index.desc&limit=1") or []
        next_order = int(body.get("order_index") or ((all_rows[0]["order_index"] + 1) if all_rows else 1))

        payload = {
            "module_id": body.get("module_id") or _module_id_for_admin(),
            "firm_slug": firm_slug,
            "firm_name": firm_name,
            "firm_type": body.get("firm_type") if body.get("firm_type") in ("global", "india") else "global",
            "role_title": role_title,
            "location": body.get("location") or None,
            "salary_band": body.get("salary_band") or None,
            "about_md": body.get("about_md") or None,
            "brand": body.get("brand") or {},
            "process": body.get("process") or {},
            "case_config": body.get("case_config") or {},
            "order_index": next_order,
            "is_active": bool(body.get("is_active", True)),
        }
        row = _supabase_post("master_interview_sims", payload, prefer="return=representation")
        if isinstance(row, list):
            row = row[0] if row else None
        if not row:
            raise HTTPException(status_code=500, detail="could not create simulation")
        return {"sim": _admin_sim_full(row)}

    @api_router.patch("/admin/interview-sims/{sim_id}")
    async def admin_interview_sim_update(sim_id: str, body: dict, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        body = body or {}
        rows = _supabase_get(
            f"master_interview_sims?id=eq.{_urlparse.quote(sim_id)}&select=id,firm_slug&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="simulation not found")

        allowed = ("firm_slug", "firm_name", "firm_type", "role_title", "location",
                   "salary_band", "about_md", "brand", "process", "case_config",
                   "order_index", "is_active", "module_id")
        patch: dict = {}
        for k in allowed:
            if k in body:
                patch[k] = body[k]

        if "firm_slug" in patch:
            new_slug = _slug_ok(patch["firm_slug"])
            if new_slug != rows[0]["firm_slug"]:
                dup = _supabase_get(
                    f"master_interview_sims?firm_slug=eq.{_urlparse.quote(new_slug)}"
                    f"&id=neq.{_urlparse.quote(sim_id)}&select=id&limit=1"
                ) or []
                if dup:
                    raise HTTPException(status_code=409, detail=f"firm_slug '{new_slug}' is already taken")
            patch["firm_slug"] = new_slug

        if "firm_type" in patch and patch["firm_type"] not in ("global", "india"):
            raise HTTPException(status_code=400, detail="firm_type must be 'global' or 'india'")
        if not patch:
            raise HTTPException(status_code=400, detail="no fields to update")

        _supabase_patch(f"master_interview_sims?id=eq.{_urlparse.quote(sim_id)}", patch)
        updated = _supabase_get(
            f"master_interview_sims?id=eq.{_urlparse.quote(sim_id)}&select=*&limit=1"
        ) or []
        return {"sim": _admin_sim_full(updated[0]) if updated else None}

    @api_router.delete("/admin/interview-sims/{sim_id}")
    async def admin_interview_sim_delete(sim_id: str, hard: bool = False, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            f"master_interview_sims?id=eq.{_urlparse.quote(sim_id)}&select=id&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="simulation not found")
        if hard:
            if not _supabase_delete:
                raise HTTPException(status_code=500, detail="delete not available")
            _supabase_delete(f"master_interview_sims?id=eq.{_urlparse.quote(sim_id)}")
            return {"ok": True, "deleted": True}
        # soft: deactivate (preserves user attempts)
        _supabase_patch(f"master_interview_sims?id=eq.{_urlparse.quote(sim_id)}",
                        {"is_active": False})
        return {"ok": True, "deactivated": True}

    @api_router.post("/admin/interview-sims/{sim_id}/duplicate")
    async def admin_interview_sim_duplicate(sim_id: str, body: dict, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            f"master_interview_sims?id=eq.{_urlparse.quote(sim_id)}&select=*&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="simulation not found")
        src = rows[0]
        new_slug = _slug_ok((body or {}).get("firm_slug") or f"{src['firm_slug']}-copy")
        dup = _supabase_get(
            f"master_interview_sims?firm_slug=eq.{_urlparse.quote(new_slug)}&select=id&limit=1"
        ) or []
        if dup:
            raise HTTPException(status_code=409, detail=f"firm_slug '{new_slug}' already exists")
        all_rows = _supabase_get("master_interview_sims?select=order_index&order=order_index.desc&limit=1") or []
        next_order = (all_rows[0]["order_index"] + 1) if all_rows else 1
        payload = {
            "module_id": src["module_id"],
            "firm_slug": new_slug,
            "firm_name": (body or {}).get("firm_name") or f"{src['firm_name']} (copy)",
            "firm_type": src.get("firm_type") or "global",
            "role_title": src.get("role_title"),
            "location": src.get("location"),
            "salary_band": src.get("salary_band"),
            "about_md": src.get("about_md"),
            "brand": src.get("brand") or {},
            "process": src.get("process") or {},
            "case_config": src.get("case_config") or {},
            "order_index": next_order,
            "is_active": True,
        }
        row = _supabase_post("master_interview_sims", payload, prefer="return=representation")
        if isinstance(row, list):
            row = row[0] if row else None
        return {"sim": _admin_sim_full(row) if row else None}

    @api_router.post("/admin/interview-sims/reorder")
    async def admin_interview_sim_reorder(body: dict, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        ids = (body or {}).get("ids") or []
        if not isinstance(ids, list) or not ids:
            raise HTTPException(status_code=400, detail="ids (list) required")
        for i, sim_id in enumerate(ids, start=1):
            _supabase_patch(f"master_interview_sims?id=eq.{_urlparse.quote(sim_id)}",
                            {"order_index": i})
        return {"ok": True, "count": len(ids)}

    @api_router.post("/admin/interview-sims/rebuild-workbook")
    async def admin_rebuild_workbook(body: dict, user=Depends(_get_supabase_user)):
        """Rebuild the Excel case workbook from friendly input params.
        Body: { rev0, growth:[g1,g2,g3], ebitda_margin, dna, interest, tax, shares, exit_pe, company, firm, role }
        Returns { workbook, expected_summary }, the same shape as the seed script.
        Admin can preview then save via PATCH."""
        _ensure_admin(user)
        b = body or {}
        try:
            rev0 = float(b.get("rev0"))
            growth = [float(g) for g in (b.get("growth") or [])]
            ebitda_margin = float(b.get("ebitda_margin"))
            dna = float(b.get("dna"))
            interest = float(b.get("interest"))
            tax = float(b.get("tax"))
            shares = float(b.get("shares"))
            exit_pe = float(b.get("exit_pe"))
        except Exception:
            raise HTTPException(status_code=400, detail="numeric fields required: rev0, growth[3], ebitda_margin, dna, interest, tax, shares, exit_pe")
        if len(growth) != 3:
            raise HTTPException(status_code=400, detail="growth must be a 3-item list")
        firm = (b.get("firm") or "").strip() or "Firm"
        role = (b.get("role") or "").strip() or "Analyst"
        company = (b.get("company") or "").strip() or "Company"

        rev = [rev0]
        for g in growth:
            rev.append(round(rev[-1] * (1 + g / 100.0), 1))
        r25, r26, r27 = rev[1], rev[2], rev[3]
        ebitda27 = round(r27 * ebitda_margin / 100.0, 1)
        ebit27 = round(ebitda27 - dna, 1)
        pbt27 = round(ebit27 - interest, 1)
        pat27 = round(pbt27 * (1 - tax / 100.0), 1)
        eps27 = round(pat27 / max(shares, 0.0001), 2)
        tp = round(eps27 * exit_pe, 0)

        ro = {"readOnly": True}
        rob = {"readOnly": True, "bold": True}
        cells = {
            "A1": {"value": f"{company}, FY25E-FY27E Earnings Model", **rob},
            "A2": {"value": "All figures in ₹ Cr unless stated. Fill the amber cells (use formulas).", **ro},
            "B4": {"value": "FY24A", **rob}, "C4": {"value": "FY25E", **rob},
            "D4": {"value": "FY26E", **rob}, "E4": {"value": "FY27E", **rob},
            "A5": {"value": "Revenue", **rob},
            "B5": {"value": rev0, **ro},
            "C5": {"value": "", "expected": r25, "tolerance": 2, "points": 10},
            "D5": {"value": "", "expected": r26, "tolerance": 2, "points": 10},
            "E5": {"value": "", "expected": r27, "tolerance": 3, "points": 10},
            "A6": {"value": "Revenue growth (%)", **ro},
            "C6": {"value": growth[0], **ro}, "D6": {"value": growth[1], **ro}, "E6": {"value": growth[2], **ro},
            "A7": {"value": f"EBITDA (@ {ebitda_margin}% margin)", **rob},
            "E7": {"value": "", "expected": ebitda27, "tolerance": 3, "points": 15},
            "A8": {"value": "Less: D&A", **ro}, "E8": {"value": dna, **ro},
            "A9": {"value": "EBIT", **ro},
            "A10": {"value": "Less: Interest", **ro}, "E10": {"value": interest, **ro},
            "A11": {"value": "PBT", **ro},
            "A12": {"value": f"Tax @ {tax}%", **ro},
            "A13": {"value": "PAT", **rob},
            "E13": {"value": "", "expected": pat27, "tolerance": 3, "points": 20},
            "A15": {"value": "Shares outstanding (Cr)", **ro}, "E15": {"value": shares, **ro},
            "A16": {"value": "FY27E EPS (₹)", **rob},
            "E16": {"value": "", "expected": eps27, "tolerance": 0.3, "points": 15},
            "A17": {"value": "Exit P/E multiple (x)", **ro}, "E17": {"value": exit_pe, **ro},
            "A18": {"value": "Target Price (₹)", **rob},
            "E18": {"value": "", "expected": tp, "tolerance": 8, "points": 20},
        }
        workbook = {
            "header": {
                "firm": firm, "role": role, "category": "Live Modelling Test",
                "instructions": (
                    f"Build the FY25E-FY27E earnings model for {company}. Amber cells are graded. "
                    "Use formulas (e.g. =B5*1.12), the grader checks computed values."
                ),
            },
            "scoring": {"mode": "auto"},
            "sheets": [{"name": "Model", "rowCount": 26, "colCount": 8, "cells": cells}],
        }
        expected_summary = {
            "rev_fy27": r27, "ebitda_fy27": ebitda27, "pat_fy27": pat27,
            "eps_fy27": eps27, "target_price": tp, "exit_pe": exit_pe,
        }
        return {"workbook": workbook, "expected_summary": expected_summary,
                "case_params": {
                    "rev0": rev0, "growth": growth, "ebitda_margin": ebitda_margin,
                    "dna": dna, "interest": interest, "tax": tax,
                    "shares": shares, "exit_pe": exit_pe,
                    "company": company, "firm": firm, "role": role,
                }}

    # ----------------------------------------------------------------------
    # TTS, Pari's voice for HR + Technical interview questions.
    # Uses OpenAI tts-1 via the Emergent LLM key. Responses are cached
    # in-memory by (text, voice, model) hash so re-plays don't re-bill.
    # ----------------------------------------------------------------------
    _TTS_CACHE: dict[str, str] = {}
    _TTS_CACHE_MAX = 500  # simple FIFO cap

    @api_router.post("/interview-sim/tts")
    async def interview_sim_tts(body: dict, user=Depends(_get_supabase_user)):
        text = (body or {}).get("text") or ""
        text = text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="text is required")
        # Guard: keep within OpenAI's 4096-char limit and clip runaway inputs.
        if len(text) > 3800:
            text = text[:3800]
        voice = (body or {}).get("voice") or "nova"
        if voice not in {"alloy", "ash", "coral", "echo", "fable",
                          "nova", "onyx", "sage", "shimmer"}:
            voice = "nova"
        model = "tts-1"

        key = _hashlib.sha1(f"{model}|{voice}|{text}".encode("utf-8")).hexdigest()
        cached = _TTS_CACHE.get(key)
        if cached:
            return {"audio_base64": cached, "mime": "audio/mpeg", "cached": True}

        if not _EMERGENT_LLM_KEY:
            raise HTTPException(status_code=500, detail="TTS is not configured")
        try:
            from emergentintegrations.llm.openai import OpenAITextToSpeech
            tts = OpenAITextToSpeech(api_key=_EMERGENT_LLM_KEY)
            audio_bytes = await tts.generate_speech(
                text=text, model=model, voice=voice, response_format="mp3",
            )
        except Exception as exc:
            logger.warning("[interview-sim] tts failed: %s", exc)
            raise HTTPException(status_code=502, detail=f"tts failed: {exc}")

        b64 = _b64.b64encode(audio_bytes).decode("ascii")
        if len(_TTS_CACHE) >= _TTS_CACHE_MAX:
            # drop the oldest entry (dict preserves insertion order in py3.7+)
            _TTS_CACHE.pop(next(iter(_TTS_CACHE)))
        _TTS_CACHE[key] = b64
        return {"audio_base64": b64, "mime": "audio/mpeg", "cached": False}

    logger.info("[interview-sim] endpoints registered")
