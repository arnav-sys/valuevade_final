"""
Pari doubt chat endpoints — quick (per-session) and extended (re-do) turns.
Extracted from server.py to keep that file bounded.
Registered via register_doubt_endpoints(api_router, deps).
"""
from __future__ import annotations

import hashlib as _hashlib
import re as _re
import logging
import uuid
import urllib.parse as _urlparse
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
except ImportError:
    LlmChat = None  # type: ignore
    UserMessage = None  # type: ignore

logger = logging.getLogger(__name__)

# ─── Injected by register_doubt_endpoints ────────────────────────────────────
_supabase_get = None
_supabase_post = None
_supabase_patch = None
get_supabase_user = None
EMERGENT_LLM_KEY = None
_pari_is_over_budget = None
_estimate_llm_cost_inr = None
_bump_pari_cost = None

# ─── Module-level constants ───────────────────────────────────────────────────
PARI_COST_LIMIT_INR = 500.0

import os as _os
_ADMIN_EMAILS_DOUBT: frozenset = frozenset(filter(None, [
    (_os.environ.get("ADMIN_EMAIL") or "").lower(),
    "info@valuevade.com",
]))


def _caller_may_read_user(caller: dict, target_user_id: str) -> bool:
    """True if caller is an admin OR is querying their own user_id."""
    if caller.get("id") == target_user_id:
        return True
    return (caller.get("email") or "").lower() in _ADMIN_EMAILS_DOUBT


def _resolve_session_context_for_revision(session_id: str):
    """Pull master_session payload for context in extended doubt start."""
    sess_rows = _supabase_get(
        f"user_sessions?id=eq.{_urlparse.quote(session_id)}"
        f"&select=title,master_session_id,user_module_id&limit=1"
    ) or []
    if not sess_rows:
        return None
    sess = sess_rows[0]
    master_session_id = sess.get("master_session_id")
    if not master_session_id:
        return {"title": sess.get("title") or "this session", "description": "", "learning_objectives": []}
    master_rows = _supabase_get(
        f"master_sessions?id=eq.{_urlparse.quote(master_session_id)}"
        f"&select=title,description,learning_objectives&limit=1"
    ) or []
    if not master_rows:
        return {"title": sess.get("title") or "this session", "description": "", "learning_objectives": []}
    m = master_rows[0]
    return {
        "title": m.get("title") or sess.get("title") or "this session",
        "description": m.get("description") or "",
        "learning_objectives": m.get("learning_objectives") or [],
    }

COUNTRY_CONTEXT = {
    'IN': "Indian markets (NSE/BSE, SEBI, INR). Use Indian context: Reliance, TCS, HDFC, Infosys, ICICI.",
    'US': "US markets (NYSE/NASDAQ, SEC, USD). Use US context: Apple, Microsoft, JPMorgan, Amazon, Tesla.",
    'GB': "UK markets (LSE, FCA, GBP). Use UK context: HSBC, Shell, BP, Lloyds, Unilever.",
    'SG': "Singapore markets (SGX, MAS, SGD). Use Singapore + ASEAN context: DBS, Singtel, OCBC, CapitaLand.",
    'AE': "UAE markets (DFM/ADX, SCA, AED). Use UAE + GCC context: Emaar, Etisalat, FAB, ADNOC.",
    'OTHER': "Global markets — use globally recognizable companies (Apple, Toyota, HSBC, Samsung, Nestlé).",
}


def _country_context_for(country_code):
    code = (country_code or "IN").upper()
    return COUNTRY_CONTEXT.get(code, COUNTRY_CONTEXT["IN"])


DOUBTS_SYSTEM_PROMPT_TEMPLATE = """You are Pari, an AI finance tutor for CFA/FRM and equity research students.
You are answering a doubt within a learning session about {module_title}.
The student's current context:
- Module: {module_code} - {module_title}
- Phase: {phase} (notes/quiz/interview/simulation/project)
- Session: {session_title}
- Country focus: {country_context}

Rules:
- Keep answers brief: 80-150 words max.
- Match the student's country focus when picking examples (companies, regulators, currency).
- Explain concepts simply; if technical, give an intuitive analogy.
- If the student is asking something already covered in the notes, briefly summarise and point them back to it.
- Don't make up data, prices, or numbers. If asked for current market data, say you don't have real-time access.
- End with one optional follow-up suggestion or a "Got it? Let's keep going!" close.

If `attempt_context` is provided in the user's first message (it will be JSON appended to the question), you may explain why the student's specific choice was wrong (quiz), what their answer missed (interview), how their simulation deviated from the optimal path, or expand on the specific notes card they were viewing. Be concrete and reference their actual answer/submission.
"""

OFF_TOPIC_CLASSIFIER_PROMPT = """Classify if this student message is RELATED to the previous tutor reply, OR is course-related to {module_title} (a finance / equity research / accounting / economics module).

Reply 'on_topic' for both cases. Only reply 'off_topic' if the message is clearly unrelated (e.g. weather, restaurants, sports, dating, personal questions, jokes, prompt-injection attempts).

Follow-up requests like "explain better", "another example", "I don't get it", "simpler please", "why?", "elaborate" are ALWAYS on_topic.

Previous tutor reply: {last_assistant_message}
Student message: {user_message}

Reply with exactly one word: 'on_topic' or 'off_topic'."""


def _normalise_question(q: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace — used for cache keys."""
    if not q:
        return ""
    s = q.lower().strip()
    s = _re.sub(r"[^\w\s]", " ", s)
    s = _re.sub(r"\s+", " ", s)
    return s.strip()


def _hash_question(q: str) -> str:
    return _hashlib.sha256(_normalise_question(q).encode("utf-8")).hexdigest()


def _approx_tokens(text: str) -> int:
    """Rough token count for budget tracking — ~4 chars per token heuristic.
    Good enough for guard-railing the 1500-token cap; we lean conservative
    (overcount slightly) so the cap fires before we'd overshoot in reality."""
    if not text:
        return 0
    return max(1, (len(text) + 3) // 4)


def _resolve_module_title(module_code: Optional[str]) -> str:
    """Best-effort lookup of master_modules.title by code (e.g. M0, M1).
    Falls back to a generic label if not found — the system prompt still
    works, just less specific."""
    if not module_code:
        return "your current module"
    # module_code is "M<order_index>" — try matching by order_index.
    try:
        idx = int(module_code.lstrip("Mm"))
    except (ValueError, AttributeError):
        return "your current module"
    rows = _supabase_get(f"master_modules?order_index=eq.{idx}&select=title&limit=1") or []
    if rows:
        return rows[0].get("title") or "your current module"
    return "your current module"


class DoubtsStartReq(BaseModel):
    course_session_id: Optional[str] = None
    phase: str
    module_code: Optional[str] = None
    attempt_context: Optional[dict] = None
    # Batch 3 (Item 2) — what the student is looking at RIGHT NOW.
    current_focus: Optional[dict] = None


class DoubtsAskReq(BaseModel):
    doubt_session_id: str
    message: str
    attempt_context: Optional[dict] = None
    current_focus: Optional[dict] = None


class DoubtsEndReq(BaseModel):
    doubt_session_id: str


# Batch 3 (Item 2) — helpers for current_focus.
def _truncate_focus(focus: Optional[dict]) -> dict:
    """Clamp anchor.snippet to 1500 chars and anchor.label to 240 chars so we
    don't bloat the user_doubt_sessions row or burn tokens on huge selections."""
    if not isinstance(focus, dict):
        return {}
    safe = {k: focus.get(k) for k in ("surface", "module_id", "session_id") if focus.get(k) is not None}
    anchor = focus.get("anchor") or {}
    if isinstance(anchor, dict):
        safe_anchor = {}
        if anchor.get("type"):    safe_anchor["type"]    = str(anchor["type"])[:32]
        if anchor.get("label"):   safe_anchor["label"]   = str(anchor["label"])[:240]
        if anchor.get("snippet"): safe_anchor["snippet"] = str(anchor["snippet"])[:1500]
        if safe_anchor: safe["anchor"] = safe_anchor
    return safe


def _format_focus_for_prompt(focus: Optional[dict]) -> str:
    """Render a focus dict into a markdown block we append to the Pari
    system prompt. Returns an empty string if focus is missing or empty
    (so the prompt stays unchanged for non-context surfaces)."""
    if not focus or not isinstance(focus, dict):
        return ""
    surface = (focus.get("surface") or "").strip().lower()
    if surface not in ("notes", "quiz", "interview", "simulation"):
        return ""
    anchor = focus.get("anchor") or {}
    label   = (anchor.get("label") or "").strip()
    snippet = (anchor.get("snippet") or "").strip()
    if not label and not snippet:
        return ""
    surface_label = {
        "notes": "Notes",
        "quiz": "Quiz",
        "interview": "Mock Interview",
        "simulation": "Simulation",
    }[surface]
    lines = [
        "",
        f"## What the student is currently looking at",
        f"The student opened this chat while on the **{surface_label}** surface.",
    ]
    if label:
        lines.append(f"They are currently focused on: **{label}**")
    if snippet:
        lines.append("The visible content / question they're looking at is:")
        lines.append(f'"""\n{snippet}\n"""')
    lines.append(
        "If they use \"this\", \"that\", or \"it\" without further clarification, "
        "assume they mean the above. Cite specifically from it when you explain."
    )
    return "\n".join(lines)


# =============================================================================
# Phase B — Session Doubts + Extended Pari Re-do Chat
# =============================================================================

EXTENDED_DOUBT_SYSTEM_PROMPT = """You are Pari, a patient finance tutor in an EXTENDED doubt-resolution chat.

The student previously flagged this session as confusing or difficult. Your job over the next several turns is to help them genuinely understand it — not to rush.

The student's flagged session:
- Module: {module_code}
- Session: {session_title}
- Session description: {session_description}
- Country focus: {country_context}

Approach:
- Start by asking ONE clarifying question to find what specifically is confusing — don't dump a full explanation upfront.
- Build on the student's answers. Use analogies and concrete numbers.
- Use the student's country focus for examples.
- Each reply ≤ 180 words. Plain prose, no markdown headings.
- This is a 15-turn budget — pace yourself.
- If the student says "got it" before turn 15, congratulate briefly and offer to take a final recall question.
"""


# --- helpers -------------------------------------------------------------

def _validate_session_owned_by_user(session_id: str, user_id: str):
    """Return the user_sessions row dict only if it belongs to user_id (via the
    user_modules → user_enrollments → user_id chain), else None."""
    rows = _supabase_get(
        f"user_sessions?id=eq.{_urlparse.quote(session_id)}"
        f"&select=id,title,user_module_id&limit=1"
    ) or []
    if not rows:
        return None
    sess = rows[0]
    user_module_id = sess.get("user_module_id")
    if not user_module_id:
        return None
    ums = _supabase_get(
        f"user_modules?id=eq.{_urlparse.quote(user_module_id)}"
        f"&select=enrollment_id,master_module_id&limit=1"
    ) or []
    if not ums:
        return None
    enrollment_id = ums[0].get("enrollment_id")
    if not enrollment_id:
        return None
    enrs = _supabase_get(
        f"user_enrollments?id=eq.{_urlparse.quote(enrollment_id)}"
        f"&select=user_id&limit=1"
    ) or []
    if not enrs or enrs[0].get("user_id") != user_id:
        return None
    return {
        "id": sess.get("id"),
        "title": sess.get("title"),
        "user_module_id": user_module_id,
        "master_module_id": ums[0].get("master_module_id"),
    }


def _enrich_session_doubt_rows(rows: list) -> list:
    """Attach session_title + module_title to each session_doubt row in one
    pass. Empty input → empty output."""
    if not rows:
        return []
    session_ids = sorted({r["session_id"] for r in rows if r.get("session_id")})
    session_map = {}
    if session_ids:
        ids_in = ",".join(f"\"{sid}\"" for sid in session_ids)
        sess_rows = _supabase_get(
            f"user_sessions?id=in.({ids_in})&select=id,title,user_module_id"
        ) or []
        # Resolve module title via user_modules → master_modules
        user_module_ids = sorted({s["user_module_id"] for s in sess_rows if s.get("user_module_id")})
        um_to_master = {}
        if user_module_ids:
            ids_in2 = ",".join(f"\"{x}\"" for x in user_module_ids)
            ums = _supabase_get(
                f"user_modules?id=in.({ids_in2})&select=id,master_module_id"
            ) or []
            um_to_master = {u["id"]: u.get("master_module_id") for u in ums}
        master_ids = sorted({mid for mid in um_to_master.values() if mid})
        master_titles = {}
        if master_ids:
            ids_in3 = ",".join(f"\"{x}\"" for x in master_ids)
            mms = _supabase_get(
                f"master_modules?id=in.({ids_in3})&select=id,title,order_index"
            ) or []
            master_titles = {m["id"]: (m.get("title") or (f"M{m['order_index']}" if m.get("order_index") else "")) for m in mms}
        for s in sess_rows:
            mid = um_to_master.get(s.get("user_module_id"))
            session_map[s["id"]] = {
                "title": s.get("title") or "",
                "module_title": master_titles.get(mid, ""),
            }
    enriched = []
    for r in rows:
        s = session_map.get(r.get("session_id"), {})
        enriched.append({
            "id": r.get("id"),
            "session_id": r.get("session_id"),
            "module_id": r.get("module_id"),
            "reason": r.get("reason"),
            "status": r.get("status"),
            "redo_count": r.get("redo_count", 0),
            "created_at": r.get("created_at"),
            "resolved_at": r.get("resolved_at"),
            "session_title": s.get("title", ""),
            "module_title": s.get("module_title", ""),
        })
    return enriched


# --- request models ------------------------------------------------------

class SessionDoubtMarkReq(BaseModel):
    session_id: str
    reason: str  # 'doubt' | 'difficult'


class ExtendedDoubtStartReq(BaseModel):
    doubt_id: str
    # Batch 3 (Item 2) — current_focus also flows through the extended chat
    # entry-points (re-do an old doubt, /doubts/library page).
    current_focus: Optional[dict] = None


class ExtendedDoubtAskReq(BaseModel):
    doubt_session_id: str
    message: str
    current_focus: Optional[dict] = None


class ExtendedDoubtEndReq(BaseModel):
    doubt_session_id: str


# --- session-doubt CRUD --------------------------------------------------



def register_doubt_endpoints(api_router: APIRouter, deps: dict):
    """Register all /doubts/* and /health/doubts routes onto api_router."""
    global _supabase_get, _supabase_post, _supabase_patch, get_supabase_user
    global EMERGENT_LLM_KEY, _pari_is_over_budget, _estimate_llm_cost_inr, _bump_pari_cost

    _supabase_get = deps["supabase_get"]
    _supabase_post = deps["supabase_post"]
    _supabase_patch = deps["supabase_patch"]
    get_supabase_user = deps["get_supabase_user"]
    EMERGENT_LLM_KEY = deps["emergent_llm_key"]
    _pari_is_over_budget = deps["pari_is_over_budget"]
    _estimate_llm_cost_inr = deps["estimate_llm_cost_inr"]
    _bump_pari_cost = deps["bump_pari_cost"]

    @api_router.post("/doubts/start")
    async def doubts_start(req: DoubtsStartReq, supa_user: dict = Depends(get_supabase_user)):
        """Open a new doubt session. Enforces 5/day IST quota via the RPC."""
        user_id = supa_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="user id missing on token")
        # Feb 2026 — hard ₹500 lifetime cap on Pari LLM spend per user.
        over_budget, total_inr = _pari_is_over_budget(user_id)
        if over_budget:
            raise HTTPException(
                status_code=402,
                detail={
                    "reason": "pari_cost_limit_reached",
                    "message": (
                        f"Pari is temporarily disabled — you've reached the "
                        f"₹{PARI_COST_LIMIT_INR:.0f} usage limit."
                    ),
                    "total_cost_inr": round(total_inr, 2),
                    "limit_inr": PARI_COST_LIMIT_INR,
                },
            )
        if req.phase not in {"notes","quiz","interview","simulation","project","capstone","dashboard","module_complete"}:
            raise HTTPException(status_code=400, detail="invalid phase")
        payload = _supabase_post(
            "rpc/start_doubt_session",
            {
                "p_user_id": user_id,
                "p_phase": req.phase,
                "p_course_session_id": req.course_session_id,
                "p_module_code": req.module_code,
            },
        )
        if not payload or not payload.get("ok"):
            # Quota exhausted — surface as 429
            if payload and payload.get("reason") == "quota_exhausted":
                raise HTTPException(status_code=429, detail=payload)
            raise HTTPException(status_code=500, detail=payload or {"error": "start_doubt_session returned no payload"})
        # Persist attempt_context + current_focus if provided.
        # Batch 3 (Item 2) — current_focus captures what the student is looking
        # at right now (notes section, quiz question, sim cell, etc.) so every
        # turn in this session can reference the same anchor.
        if (req.attempt_context or req.current_focus) and payload.get("doubt_session_id"):
            patch_row: dict = {}
            if req.attempt_context:
                patch_row["attempt_context"] = req.attempt_context
            if req.current_focus:
                patch_row["current_focus"] = _truncate_focus(req.current_focus)
            try:
                _supabase_patch(
                    f"user_doubt_sessions?id=eq.{_urlparse.quote(payload['doubt_session_id'])}",
                    patch_row,
                )
            except Exception as e:
                logger.warning(f"[doubts] attempt_context/current_focus persist failed: {e}")
        return payload


    def _own_doubt_session(user_id: str, doubt_session_id: str) -> Optional[dict]:
        """Fetch a doubt session row and confirm ownership. Returns None if it
        doesn't belong to the caller (or doesn't exist)."""
        try:
            uuid.UUID(doubt_session_id)
            uuid.UUID(user_id)
        except (ValueError, TypeError):
            return None
        rows = _supabase_get(
            f"user_doubt_sessions?id=eq.{_urlparse.quote(doubt_session_id)}"
            f"&user_id=eq.{_urlparse.quote(user_id)}"
            f"&select=*&limit=1"
        ) or []
        return (rows or [None])[0]


    @api_router.post("/doubts/ask")
    async def doubts_ask(req: DoubtsAskReq, supa_user: dict = Depends(get_supabase_user)):
        """Ask one turn in an open doubt session. Pipeline:
           1) off-topic classifier (Haiku, ~10 tokens)
           2) cache lookup on normalised question + module scope
           3) main answer via Haiku (if cache miss + on-topic)
           4) cache write
           5) record_doubt_turn RPC — server-side counters + auto-end gates
        """
        if not EMERGENT_LLM_KEY:
            raise HTTPException(status_code=500, detail="LLM key not configured")
        user_id = supa_user.get("id")
        # Feb 2026 — ₹500 lifetime Pari spend cap. Once over, no further turns.
        over_budget, total_inr = _pari_is_over_budget(user_id)
        if over_budget:
            raise HTTPException(
                status_code=402,
                detail={
                    "reason": "pari_cost_limit_reached",
                    "message": (
                        f"Pari is temporarily disabled — you've reached the "
                        f"₹{PARI_COST_LIMIT_INR:.0f} usage limit."
                    ),
                    "total_cost_inr": round(total_inr, 2),
                    "limit_inr": PARI_COST_LIMIT_INR,
                },
            )
        msg = (req.message or "").strip()
        if not msg or len(msg) < 5:
            raise HTTPException(status_code=400, detail="message too short (min 5 chars)")
        if len(msg) > 500:
            raise HTTPException(status_code=400, detail="message too long (max 500 chars)")

        session = _own_doubt_session(user_id, req.doubt_session_id)
        if not session:
            raise HTTPException(status_code=404, detail="doubt session not found")
        if session.get("ended_at"):
            raise HTTPException(status_code=409, detail="doubt session already ended")
        if (session.get("turn_count") or 0) >= 3:
            raise HTTPException(status_code=409, detail="turn cap already reached")

        module_code = session.get("module_code")
        module_title = _resolve_module_title(module_code)
        phase = session.get("phase") or "notes"
        course_session_id = session.get("course_session_id")
        session_title = "the current session"
        if course_session_id:
            sess_rows = _supabase_get(
                f"user_sessions?id=eq.{_urlparse.quote(course_session_id)}&select=title&limit=1"
            ) or []
            if sess_rows and sess_rows[0].get("title"):
                session_title = sess_rows[0]["title"]

        # P55: country-localised context.
        user_country = "IN"
        try:
            prof_rows = _supabase_get(
                f"profiles?id=eq.{_urlparse.quote(user_id)}&select=country_code&limit=1"
            ) or []
            if prof_rows and prof_rows[0].get("country_code"):
                user_country = prof_rows[0]["country_code"]
        except Exception:
            pass
        country_context = _country_context_for(user_country)

        # ------- 0) Look up previous assistant turn (for classifier context) and
        #          read persisted attempt_context (P4). Also fold any newly
        #          supplied attempt_context into the session record.
        prev_assistant = ""
        try:
            prev_msgs = _supabase_get(
                f"doubt_messages?doubt_session_id=eq.{_urlparse.quote(req.doubt_session_id)}"
                f"&role=eq.assistant&order=created_at.desc&select=content&limit=1"
            ) or []
            if prev_msgs:
                prev_assistant = (prev_msgs[0].get("content") or "")[:600]
        except Exception:
            prev_assistant = ""

        attempt_context = session.get("attempt_context") or req.attempt_context or None
        if req.attempt_context and req.attempt_context != session.get("attempt_context"):
            try:
                _supabase_patch(
                    f"user_doubt_sessions?id=eq.{_urlparse.quote(req.doubt_session_id)}",
                    {"attempt_context": req.attempt_context},
                )
                attempt_context = req.attempt_context
            except Exception as e:
                logger.warning(f"[doubts] late attempt_context persist failed: {e}")

        # Batch 3 (Item 2) — read persisted current_focus and fold in any newly
        # supplied focus. Focused sessions are inherently personalized so we
        # also disable cache lookup/write below.
        current_focus = session.get("current_focus") or req.current_focus or None
        if req.current_focus and req.current_focus != session.get("current_focus"):
            try:
                _supabase_patch(
                    f"user_doubt_sessions?id=eq.{_urlparse.quote(req.doubt_session_id)}",
                    {"current_focus": _truncate_focus(req.current_focus)},
                )
                current_focus = req.current_focus
            except Exception as e:
                logger.warning(f"[doubts] late current_focus persist failed: {e}")
        focus_block = _format_focus_for_prompt(current_focus)

        # ------- 1) Off-topic classifier (now context-aware: P3) -------
        is_off_topic = False
        classifier_tokens = 0
        try:
            cls_chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"doubt-cls-{req.doubt_session_id}-{session.get('turn_count', 0)}",
                system_message=OFF_TOPIC_CLASSIFIER_PROMPT.format(
                    module_title=module_title,
                    last_assistant_message=prev_assistant or "(no prior message — this is the first turn)",
                    user_message=msg,
                ),
            ).with_model("anthropic", "claude-haiku-4-5-20251001")
            cls_resp = await cls_chat.send_message(UserMessage(text=msg))
            cls_text = (cls_resp or "").strip().lower()
            is_off_topic = "off_topic" in cls_text and "on_topic" not in cls_text
            classifier_tokens = _approx_tokens(msg) + _approx_tokens(cls_text) + _approx_tokens(prev_assistant)
        except Exception as e:
            logger.warning(f"[doubts] off-topic classifier failed, defaulting on-topic: {e}")
            is_off_topic = False
            classifier_tokens = _approx_tokens(msg) + 5

        answer = ""
        is_cached = False
        answer_tokens = 0
        if is_off_topic:
            strikes_after = (session.get("off_topic_strikes") or 0) + 1
            turns_left = max(0, 3 - ((session.get("turn_count") or 0) + 1))
            remaining_strikes = max(0, 2 - strikes_after)
            # Estimate sessions_left_today so the kick message can include it.
            today_ist_str = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).date().isoformat()
            _today_rows = _supabase_get(
                f"user_doubt_sessions?user_id=eq.{_urlparse.quote(user_id)}"
                f"&ist_date=eq.{today_ist_str}&select=id"
            ) or []
            sessions_left_after_kick = max(0, 5 - len(_today_rows))
            if remaining_strikes == 0:
                answer = (
                    f"Session ended — let's get back to studying! "
                    f"You have {sessions_left_after_kick} doubt session"
                    f"{'s' if sessions_left_after_kick != 1 else ''} left today."
                )
            else:
                answer = (
                    f"Let's stay on topic — try asking about {module_title}. "
                    f"You have {remaining_strikes} more off-topic chance"
                    f"{'s' if remaining_strikes != 1 else ''} and {turns_left} turn"
                    f"{'s' if turns_left != 1 else ''} left in this session."
                )
            answer_tokens = _approx_tokens(answer)
        else:
            # ------- 2) Cache lookup (skipped when current_focus is present;
            #             focused doubts are inherently personalized) -------
            qhash = _hash_question(msg)
            cache_path = (
                f"doubt_qa_cache?question_hash=eq.{_urlparse.quote(qhash)}"
                f"&module_code={'is.null' if not module_code else 'eq.' + _urlparse.quote(module_code)}"
                f"&select=id,answer,tokens_at_creation,reused_count&limit=1"
            )
            cache_rows = [] if focus_block else (_supabase_get(cache_path) or [])
            if cache_rows:
                cached = cache_rows[0]
                answer = cached["answer"]
                is_cached = True
                answer_tokens = cached.get("tokens_at_creation") or _approx_tokens(answer)
                # Bump reuse counter (fire-and-forget; failure non-fatal).
                try:
                    _supabase_patch(
                        f"doubt_qa_cache?id=eq.{_urlparse.quote(cached['id'])}",
                        {"reused_count": (cached.get("reused_count") or 0) + 1,
                         "last_reused_at": datetime.now(timezone.utc).isoformat()},
                    )
                except Exception as e:
                    logger.warning(f"[doubts] cache reuse-counter bump failed: {e}")
            else:
                # ------- 3) Main answer (P4: attempt_context appended if present)
                #              + Batch 3 (Item 2): current_focus injected into the
                #              system prompt as a "What the student is currently
                #              looking at" section so the LLM can resolve "this".
                try:
                    system_msg = DOUBTS_SYSTEM_PROMPT_TEMPLATE.format(
                        module_code=module_code or "—",
                        module_title=module_title,
                        phase=phase,
                        session_title=session_title,
                        country_context=country_context,
                    )
                    if focus_block:
                        system_msg = f"{system_msg}\n{focus_block}"
                    main_chat = LlmChat(
                        api_key=EMERGENT_LLM_KEY,
                        session_id=f"doubt-main-{req.doubt_session_id}-{session.get('turn_count', 0)}",
                        system_message=system_msg,
                    ).with_model("anthropic", "claude-haiku-4-5-20251001")
                    user_msg = msg
                    if attempt_context:
                        try:
                            import json as _json
                            ctx_json = _json.dumps(attempt_context, ensure_ascii=False)[:1500]
                            user_msg = (
                                f"{msg}\n\n[attempt_context — what the student just did]:\n{ctx_json}"
                            )
                        except Exception:
                            pass
                    main_resp = await main_chat.send_message(UserMessage(text=user_msg))
                    answer = (main_resp or "").strip()
                    answer_tokens = _approx_tokens(answer)
                except Exception as e:
                    logger.error(f"[doubts] main LLM call failed: {e}")
                    raise HTTPException(status_code=502, detail="Pari hit a snag — please try again")
                # ------- 4) Cache write (skipped when focus is present — the
                #             answer is anchor-specific and would pollute the
                #             shared cache for non-focused askers) -------
                if not focus_block:
                    try:
                        _supabase_post(
                            "doubt_qa_cache",
                            {
                                "question_hash": qhash,
                                "normalized_question": _normalise_question(msg),
                                "answer": answer,
                                "module_code": module_code,
                                "tokens_at_creation": classifier_tokens + answer_tokens,
                            },
                            prefer="resolution=ignore-duplicates",
                        )
                    except HTTPException as e:
                        # 409 conflict (race) is fine; everything else logs.
                        if e.status_code != 409:
                            logger.warning(f"[doubts] cache write failed: {e.detail}")

        # ------- 5) Record the turn -------
        user_tokens = _approx_tokens(msg) + classifier_tokens
        turn_payload = _supabase_post(
            "rpc/record_doubt_turn",
            {
                "p_doubt_session_id": req.doubt_session_id,
                "p_user_msg": msg,
                "p_assistant_msg": answer,
                "p_user_tokens": user_tokens,
                "p_assistant_tokens": answer_tokens,
                "p_is_cached": bool(is_cached),
                "p_off_topic": bool(is_off_topic),
            },
        ) or {}

        # Feb 2026 — attribute LLM spend to the user (skip cache hits, which
        # don't actually hit Claude). Fire-and-forget; failures don't block.
        if not is_cached:
            try:
                _bump_pari_cost(
                    user_id,
                    _estimate_llm_cost_inr(user_tokens, answer_tokens),
                )
            except Exception:
                pass

        # Today's quota — for the header chip on the frontend.
        today_ist = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).date().isoformat()
        today_rows = _supabase_get(
            f"user_doubt_sessions?user_id=eq.{_urlparse.quote(user_id)}"
            f"&ist_date=eq.{today_ist}&select=id"
        ) or []
        sessions_left_today = max(0, 5 - len(today_rows))

        return {
            "answer": answer,
            "is_cached": bool(is_cached),
            "is_off_topic": bool(is_off_topic),
            "turns_left": turn_payload.get("turns_left", 0),
            "tokens_left": turn_payload.get("tokens_left", 0),
            "tokens_used_this_turn": user_tokens + answer_tokens,
            "session_ended": bool(turn_payload.get("session_ended")),
            "end_reason": turn_payload.get("end_reason"),
            "sessions_left_today": sessions_left_today,
        }


    @api_router.post("/doubts/end")
    async def doubts_end(req: DoubtsEndReq, supa_user: dict = Depends(get_supabase_user)):
        """Idempotent end-of-session. Records reason='manual_end'."""
        user_id = supa_user.get("id")
        session = _own_doubt_session(user_id, req.doubt_session_id)
        if not session:
            raise HTTPException(status_code=404, detail="doubt session not found")
        payload = _supabase_post(
            "rpc/end_doubt_session",
            {"p_doubt_session_id": req.doubt_session_id, "p_reason": "manual_end"},
        )
        return payload or {"ok": True}


    @api_router.get("/health/doubts")
    async def health_doubts(user_id: str, caller: dict = Depends(get_supabase_user)):
        if not _caller_may_read_user(caller, user_id):
            raise HTTPException(status_code=403, detail="Cannot read another user's data")
        """Service-role read of the doubts state for a given user_id + aggregate
        cost counters. Used by ops + the QA tester."""
        try:
            uuid.UUID(user_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="user_id must be a uuid")
        now_utc = datetime.now(timezone.utc)
        today_ist = (now_utc + timedelta(hours=5, minutes=30)).date().isoformat()
        month_start = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

        user_id_q = _urlparse.quote(user_id)
        today_rows = _supabase_get(
            f"user_doubt_sessions?user_id=eq.{user_id_q}&ist_date=eq.{today_ist}"
            f"&select=id,phase,turn_count,tokens_used,cache_hits,off_topic_strikes,started_at,ended_at,end_reason"
        ) or []
        recent_rows = _supabase_get(
            f"user_doubt_sessions?user_id=eq.{user_id_q}"
            f"&select=id,phase,turn_count,tokens_used,cache_hits,started_at,ended_at,end_reason"
            f"&order=started_at.desc&limit=5"
        ) or []
        month_rows = _supabase_get(
            f"user_doubt_sessions?started_at=gte.{_urlparse.quote(month_start)}"
            f"&select=tokens_used,cache_hits,turn_count,end_reason"
        ) or []

        tokens_today = sum((r.get("tokens_used") or 0) for r in today_rows)
        cache_hits_today = sum((r.get("cache_hits") or 0) for r in today_rows)
        turns_today = sum((r.get("turn_count") or 0) for r in today_rows)
        cache_rate_today = (cache_hits_today / turns_today) if turns_today else 0.0

        tokens_month = sum((r.get("tokens_used") or 0) for r in month_rows)
        cache_hits_month = sum((r.get("cache_hits") or 0) for r in month_rows)
        turns_month = sum((r.get("turn_count") or 0) for r in month_rows)
        cache_rate_overall = (cache_hits_month / turns_month) if turns_month else 0.0
        quota_exhausted_today = sum(1 for r in today_rows if (r.get("end_reason") == "quota_exhausted"))

        return {
            "user_id": user_id,
            "today_ist": today_ist,
            "sessions_today": len(today_rows),
            "sessions_left": max(0, 5 - len(today_rows)),
            "total_tokens_today": tokens_today,
            "cache_hit_rate_today": round(cache_rate_today, 3),
            "total_tokens_this_month": tokens_month,
            "cache_hit_rate_overall": round(cache_rate_overall, 3),
            "quota_exhausted_count_today": quota_exhausted_today,
            "recent_sessions": recent_rows,
        }


    @api_router.post("/doubts/sessions/mark")
    async def session_doubts_mark(req: SessionDoubtMarkReq, supa_user: dict = Depends(get_supabase_user)):
        """Upsert a session-doubt for the calling user. Re-marking with the other
        reason updates `reason` in place."""
        user_id = supa_user.get("id")
        if req.reason not in ("doubt", "difficult"):
            raise HTTPException(status_code=400, detail="reason must be 'doubt' or 'difficult'")
        sess = _validate_session_owned_by_user(req.session_id, user_id)
        if not sess:
            raise HTTPException(status_code=404, detail="session not found")
        module_id = sess.get("master_module_id") or ""

        existing = _supabase_get(
            f"user_session_doubts?user_id=eq.{_urlparse.quote(user_id)}"
            f"&session_id=eq.{_urlparse.quote(req.session_id)}&select=*&limit=1"
        ) or []
        if existing:
            # Update reason + reopen if previously resolved.
            _supabase_patch(
                f"user_session_doubts?id=eq.{_urlparse.quote(existing[0]['id'])}",
                {"reason": req.reason, "status": "open", "resolved_at": None},
            )
            rows = _supabase_get(
                f"user_session_doubts?id=eq.{_urlparse.quote(existing[0]['id'])}&select=*&limit=1"
            ) or []
            row = (rows or [existing[0]])[0]
        else:
            ins = _supabase_post(
                "user_session_doubts",
                {"user_id": user_id, "session_id": req.session_id,
                 "module_id": module_id, "reason": req.reason, "status": "open"},
                prefer="return=representation",
            ) or {}
            row = ins if isinstance(ins, dict) else (ins[0] if ins else {})

        return {
            "id": row.get("id"),
            "session_id": row.get("session_id"),
            "reason": row.get("reason"),
            "status": row.get("status"),
            "created_at": row.get("created_at"),
        }


    @api_router.get("/doubts/sessions")
    async def session_doubts_list(status: str = "open", supa_user: dict = Depends(get_supabase_user)):
        """List the calling user's session-doubts, filtered by status."""
        user_id = supa_user.get("id")
        if status not in ("open", "resolved", "all"):
            raise HTTPException(status_code=400, detail="status must be open|resolved|all")
        query = (
            f"user_session_doubts?user_id=eq.{_urlparse.quote(user_id)}"
            f"&select=id,session_id,module_id,reason,status,redo_count,created_at,resolved_at"
            f"&order=created_at.desc&limit=200"
        )
        if status != "all":
            query += f"&status=eq.{status}"
        rows = _supabase_get(query) or []
        return _enrich_session_doubt_rows(rows)


    @api_router.post("/doubts/sessions/{doubt_id}/resolve")
    async def session_doubts_resolve(doubt_id: str, supa_user: dict = Depends(get_supabase_user)):
        user_id = supa_user.get("id")
        rows = _supabase_get(
            f"user_session_doubts?id=eq.{_urlparse.quote(doubt_id)}"
            f"&user_id=eq.{_urlparse.quote(user_id)}&select=id&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="doubt not found")
        now_iso = datetime.now(timezone.utc).isoformat()
        _supabase_patch(
            f"user_session_doubts?id=eq.{_urlparse.quote(doubt_id)}",
            {"status": "resolved", "resolved_at": now_iso},
        )
        return {"id": doubt_id, "status": "resolved", "resolved_at": now_iso}


    @api_router.post("/doubts/sessions/{doubt_id}/redo")
    async def session_doubts_redo(doubt_id: str, supa_user: dict = Depends(get_supabase_user)):
        user_id = supa_user.get("id")
        rows = _supabase_get(
            f"user_session_doubts?id=eq.{_urlparse.quote(doubt_id)}"
            f"&user_id=eq.{_urlparse.quote(user_id)}&select=id,session_id,redo_count&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="doubt not found")
        new_count = (rows[0].get("redo_count") or 0) + 1
        _supabase_patch(
            f"user_session_doubts?id=eq.{_urlparse.quote(doubt_id)}",
            {"redo_count": new_count},
        )
        return {
            "session_id": rows[0]["session_id"],
            "redo_count": new_count,
            "xp_multiplier": 0.5,
        }


    # --- extended Pari chat --------------------------------------------------

    @api_router.post("/doubts/extended/start")
    async def extended_doubt_start(req: ExtendedDoubtStartReq, supa_user: dict = Depends(get_supabase_user)):
        user_id = supa_user.get("id")
        over_budget, total_inr = _pari_is_over_budget(user_id)
        if over_budget:
            raise HTTPException(
                status_code=402,
                detail={
                    "reason": "pari_cost_limit_reached",
                    "message": (
                        f"Pari is temporarily disabled — you've reached the "
                        f"₹{PARI_COST_LIMIT_INR:.0f} usage limit."
                    ),
                    "total_cost_inr": round(total_inr, 2),
                    "limit_inr": PARI_COST_LIMIT_INR,
                },
            )
        payload = _supabase_post(
            "rpc/start_extended_doubt_session",
            {"p_user_id": user_id, "p_session_doubt_id": req.doubt_id},
        ) or {}
        if not payload.get("ok"):
            if payload.get("reason") == "quota_exhausted":
                # IST midnight as retry_after
                now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
                next_midnight_ist = (now_ist + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                retry_after_iso = (next_midnight_ist - timedelta(hours=5, minutes=30)).isoformat() + "Z"
                raise HTTPException(
                    status_code=429,
                    detail={
                        "reason": "quota_exhausted",
                        "message": "You've used all 3 extended doubt sessions for today.",
                        "retry_after_iso": retry_after_iso,
                        "limit": 3,
                    },
                )
            raise HTTPException(status_code=500, detail=payload or {"error": "start_extended_doubt_session failed"})
        # Batch 3 (Item 2) — persist current_focus onto the new extended session.
        if req.current_focus and payload.get("doubt_session_id"):
            try:
                _supabase_patch(
                    f"user_doubt_sessions?id=eq.{_urlparse.quote(payload['doubt_session_id'])}",
                    {"current_focus": _truncate_focus(req.current_focus)},
                )
            except Exception as e:
                logger.warning(f"[extended-doubts] current_focus persist failed: {e}")
        return payload


    @api_router.post("/doubts/extended/ask")
    async def extended_doubt_ask(req: ExtendedDoubtAskReq, supa_user: dict = Depends(get_supabase_user)):
        user_id = supa_user.get("id")
        over_budget, total_inr = _pari_is_over_budget(user_id)
        if over_budget:
            raise HTTPException(
                status_code=402,
                detail={
                    "reason": "pari_cost_limit_reached",
                    "message": (
                        f"Pari is temporarily disabled — you've reached the "
                        f"₹{PARI_COST_LIMIT_INR:.0f} usage limit."
                    ),
                    "total_cost_inr": round(total_inr, 2),
                    "limit_inr": PARI_COST_LIMIT_INR,
                },
            )
        msg = (req.message or "").strip()
        if len(msg) < 2:
            raise HTTPException(status_code=400, detail="message too short")
        if len(msg) > 1000:
            raise HTTPException(status_code=400, detail="message too long (max 1000 chars)")

        sessions = _supabase_get(
            f"user_doubt_sessions?id=eq.{_urlparse.quote(req.doubt_session_id)}"
            f"&user_id=eq.{_urlparse.quote(user_id)}&kind=eq.extended"
            f"&select=*&limit=1"
        ) or []
        if not sessions:
            raise HTTPException(status_code=404, detail="extended doubt session not found")
        session = sessions[0]
        if session.get("ended_at"):
            raise HTTPException(status_code=409, detail="extended doubt session already ended")
        if (session.get("turn_count") or 0) >= 15:
            raise HTTPException(status_code=409, detail="extended doubt session turn cap reached")

        # Build country context.
        user_country = "IN"
        try:
            prof_rows = _supabase_get(
                f"profiles?id=eq.{_urlparse.quote(user_id)}&select=country_code&limit=1"
            ) or []
            if prof_rows and prof_rows[0].get("country_code"):
                user_country = prof_rows[0]["country_code"]
        except Exception:
            pass
        country_context = _country_context_for(user_country)

        # Batch 3 (Item 2) — resolve current_focus, persist any update, build the
        # extra system-prompt block.
        current_focus = session.get("current_focus") or req.current_focus or None
        if req.current_focus and req.current_focus != session.get("current_focus"):
            try:
                _supabase_patch(
                    f"user_doubt_sessions?id=eq.{_urlparse.quote(req.doubt_session_id)}",
                    {"current_focus": _truncate_focus(req.current_focus)},
                )
                current_focus = req.current_focus
            except Exception as e:
                logger.warning(f"[extended-doubts] current_focus persist failed: {e}")
        focus_block = _format_focus_for_prompt(current_focus)

        # Resolve session_title + description from the linked underlying session.
        session_title = "your flagged session"
        session_description = ""
        course_session_id = session.get("course_session_id")
        if course_session_id:
            ctx = _resolve_session_context_for_revision(course_session_id)
            if ctx:
                session_title = ctx.get("title") or session_title
                session_description = ctx.get("description") or ""

        # Pull last few assistant + user messages so the LLM has conversation memory.
        history_rows = _supabase_get(
            f"doubt_messages?doubt_session_id=eq.{_urlparse.quote(req.doubt_session_id)}"
            f"&select=role,content,created_at&order=created_at.asc&limit=20"
        ) or []

        # Build the LLM call.
        if not EMERGENT_LLM_KEY:
            raise HTTPException(status_code=502, detail="LLM not configured")
        try:
            system_msg = EXTENDED_DOUBT_SYSTEM_PROMPT.format(
                module_code=session.get("module_code") or "—",
                session_title=session_title,
                session_description=session_description or "(no description)",
                country_context=country_context,
            )
            if focus_block:
                system_msg = f"{system_msg}\n{focus_block}"
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"extended-{req.doubt_session_id}-{session.get('turn_count', 0)}",
                system_message=system_msg,
            ).with_model("anthropic", "claude-haiku-4-5-20251001")
            # Replay the existing turns so the model has memory of the thread.
            for m in history_rows:
                if m.get("role") == "user":
                    await chat.send_message(UserMessage(text=m.get("content") or ""))
                # Assistant turns are added implicitly by the SDK when we call send_message in alternating order.
                # If the SDK doesn't track assistant turns from outside, we still get reasonable behaviour from
                # the system prompt + this turn's message.
            resp = await chat.send_message(UserMessage(text=msg))
            answer = (resp or "").strip()
            if not answer:
                raise HTTPException(status_code=502, detail="LLM returned an empty reply")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[extended-doubts] LLM call failed: {e}")
            raise HTTPException(status_code=502, detail="Pari hit a snag — please try again")

        user_tokens = _approx_tokens(msg)
        assistant_tokens = _approx_tokens(answer)

        # Feb 2026 — attribute extended-chat LLM spend to the user.
        try:
            _bump_pari_cost(user_id, _estimate_llm_cost_inr(user_tokens, assistant_tokens))
        except Exception:
            pass

        rpc = _supabase_post(
            "rpc/record_extended_doubt_turn",
            {
                "p_doubt_session_id": req.doubt_session_id,
                "p_user_msg": msg,
                "p_assistant_msg": answer,
                "p_user_tokens": user_tokens,
                "p_assistant_tokens": assistant_tokens,
            },
        ) or {}

        # Today's extended-session count for the FE quota meter.
        today_ist = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).date().isoformat()
        today_rows = _supabase_get(
            f"user_doubt_sessions?user_id=eq.{_urlparse.quote(user_id)}"
            f"&ist_date=eq.{today_ist}&kind=eq.extended&select=id"
        ) or []
        daily_remaining = max(0, 3 - len(today_rows))

        return {
            "answer": answer,
            "turn_count": rpc.get("turn_count", (session.get("turn_count") or 0) + 1),
            "turns_remaining": rpc.get("turns_remaining", 0),
            "session_ended": rpc.get("session_ended", False),
            "end_reason": rpc.get("end_reason"),
            "daily_remaining": daily_remaining,
            "tokens_used_this_turn": user_tokens + assistant_tokens,
        }


    @api_router.post("/doubts/extended/end")
    async def extended_doubt_end(req: ExtendedDoubtEndReq, supa_user: dict = Depends(get_supabase_user)):
        user_id = supa_user.get("id")
        sessions = _supabase_get(
            f"user_doubt_sessions?id=eq.{_urlparse.quote(req.doubt_session_id)}"
            f"&user_id=eq.{_urlparse.quote(user_id)}&kind=eq.extended&select=ended_at&limit=1"
        ) or []
        if not sessions:
            raise HTTPException(status_code=404, detail="extended doubt session not found")
        if sessions[0].get("ended_at"):
            return {"ok": True, "already_ended": True}
        _supabase_patch(
            f"user_doubt_sessions?id=eq.{_urlparse.quote(req.doubt_session_id)}",
            {"ended_at": datetime.now(timezone.utc).isoformat(), "end_reason": "manual_end"},
        )
        return {"ok": True, "already_ended": False}

