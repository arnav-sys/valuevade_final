"""
Public (no-auth) endpoints that serve content for the two admin-marked free
trial sessions.  These never require a Supabase JWT — they gate on
is_free_session=TRUE or is_preview_session=TRUE in master_sessions.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)


def register_guest_session_endpoints(api_router: APIRouter, deps: dict) -> None:
    _supabase_get   = deps["supabase_get"]
    _urlparse_quote = deps["urlparse_quote"]
    _json           = deps["json"]

    # ── helpers ──────────────────────────────────────────────────────────────

    import re as _re
    _UUID_RE = _re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', _re.I)

    def _is_valid_uuid(val: str) -> bool:
        return bool(_UUID_RE.match(val))

    def _get_free_session(session_id: str) -> dict:
        if not _is_valid_uuid(session_id):
            raise HTTPException(status_code=404, detail="Session not found")
        try:
            rows = _supabase_get(
                f"master_sessions?id=eq.{_urlparse_quote(session_id)}"
                "&select=id,title,description,order_index,module_id,"
                "lecture_url,video_duration_minutes,is_free_session,is_preview_session"
                "&limit=1"
            ) or []
        except Exception:
            rows = _supabase_get(
                f"master_sessions?id=eq.{_urlparse_quote(session_id)}"
                "&select=id,title,description,order_index,module_id,lecture_url"
                "&limit=1"
            ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="Session not found")
        return rows[0]

    def _get_preview_session(session_id: str) -> dict:
        try:
            rows = _supabase_get(
                f"master_sessions?id=eq.{_urlparse_quote(session_id)}"
                "&select=id,title,description,lecture_url,video_duration_minutes,"
                "is_preview_session&limit=1"
            ) or []
        except Exception:
            rows = _supabase_get(
                f"master_sessions?id=eq.{_urlparse_quote(session_id)}"
                "&select=id,title,description,lecture_url&limit=1"
            ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="Session not found")
        return rows[0]

    def _parse_content(raw) -> object:
        """Content may be stored as JSON string or already parsed object."""
        if isinstance(raw, str):
            try: return _json.loads(raw)
            except Exception: return raw
        return raw

    # ── public preview-session listing ───────────────────────────────────────

    @api_router.get("/preview-sessions")
    async def list_preview_sessions():
        """Return all sessions marked is_preview_session=true (public, no auth)."""
        try:
            rows = _supabase_get(
                "master_sessions?is_preview_session=eq.true"
                "&select=id,title,description,lecture_url,video_duration_minutes"
                "&order=order_index&limit=10"
            ) or []
        except Exception:
            rows = []
        return {"sessions": rows}

    @api_router.get("/free-sessions")
    async def list_free_sessions():
        """Return all sessions marked is_free_session=true (public, no auth)."""
        try:
            rows = _supabase_get(
                "master_sessions?is_free_session=eq.true"
                "&select=id,title,description,lecture_url,video_duration_minutes"
                "&order=order_index&limit=5"
            ) or []
        except Exception:
            rows = []
        return {"sessions": rows}

    # ── guest session info ────────────────────────────────────────────────────

    @api_router.get("/free-session/{session_id}")
    async def guest_session_info(session_id: str):
        """Return session metadata for a free-trial session (no auth required)."""
        sess = _get_free_session(session_id)
        if not sess.get("is_free_session"):
            raise HTTPException(status_code=403, detail="This session is not available for free trial.")

        # Fetch module title for display
        module_title = ""
        if sess.get("module_id"):
            mod_rows = _supabase_get(
                f"master_modules?id=eq.{_urlparse_quote(sess['module_id'])}&select=title&limit=1"
            ) or []
            module_title = (mod_rows[0].get("title") or "") if mod_rows else ""

        vd = sess.get("video_duration_minutes")
        video_part = max(1, round(float(vd))) if vd and float(vd) > 0 else 15
        effective_minutes = video_part + 10

        return {
            "id": sess["id"],
            "title": sess["title"],
            "description": sess.get("description") or "",
            "module_title": module_title,
            "lecture_url": sess.get("lecture_url"),
            "has_video": bool(sess.get("lecture_url")),
            "video_duration_minutes": vd,
            "effective_minutes": effective_minutes,
        }

    # ── guest notes cards ─────────────────────────────────────────────────────

    @api_router.get("/free-session/{session_id}/notes")
    async def guest_session_notes(session_id: str):
        """Return notes cards for a free-trial session (no auth required).
        pdf_document cards are excluded (require auth to stream from storage)."""
        sess = _get_free_session(session_id)
        if not sess.get("is_free_session"):
            raise HTTPException(status_code=403, detail="This session is not available for free trial.")

        cards = _supabase_get(
            f"master_notes_cards?session_id=eq.{_urlparse_quote(session_id)}"
            "&select=id,card_type,title,content,order_index"
            "&order=order_index&limit=50"
        ) or []

        parsed = []
        for c in cards:
            if c.get("card_type") == "pdf_document":
                continue  # skip file cards
            content = _parse_content(c.get("content") or "")
            parsed.append({
                "id": c["id"],
                "card_type": c.get("card_type", "concept"),
                "title": c.get("title") or "",
                "content": content,
                "order_index": c.get("order_index") or 0,
            })

        return {"cards": parsed, "total": len(parsed)}

    # ── guest quiz ────────────────────────────────────────────────────────────

    @api_router.get("/free-session/{session_id}/quiz")
    async def guest_session_quiz(session_id: str):
        """Return quiz questions WITH correct_answer_index for the guest experience.
        Grading is done client-side (no persistence required)."""
        sess = _get_free_session(session_id)
        if not sess.get("is_free_session"):
            raise HTTPException(status_code=403, detail="This session is not available for free trial.")

        # Master sessions link to quiz questions via session_id
        try:
            questions = _supabase_get(
                f"master_quiz_questions?session_id=eq.{_urlparse_quote(session_id)}"
                "&select=id,question_text,options,correct_answer_index,explanation,difficulty"
                "&order=order_index&limit=20"
            ) or []
        except Exception:
            questions = _supabase_get(
                f"master_quiz_questions?session_id=eq.{_urlparse_quote(session_id)}"
                "&select=id,question_text,options,correct_answer_index,explanation"
                "&order=order_index&limit=20"
            ) or []

        parsed = []
        for q in questions:
            opts = _parse_content(q.get("options") or [])
            parsed.append({
                "id": q["id"],
                "question_text": q.get("question_text") or "",
                "options": opts if isinstance(opts, list) else [],
                "correct_answer_index": q.get("correct_answer_index"),
                "explanation": q.get("explanation") or "",
                "difficulty": q.get("difficulty") or "medium",
            })

        return {"questions": parsed, "total": len(parsed)}

    # ── guest simulation ──────────────────────────────────────────────────────

    @api_router.get("/free-session/{session_id}/simulation")
    async def guest_session_simulation(session_id: str):
        """Return simulation data for a free-trial session (no auth required).
        Returns sim_type + config so the frontend can render the appropriate sim."""
        sess = _get_free_session(session_id)
        if not sess.get("is_free_session"):
            raise HTTPException(status_code=403, detail="This session is not available for free trial.")

        try:
            sims = _supabase_get(
                f"master_simulations?session_id=eq.{_urlparse_quote(session_id)}"
                "&select=id,sim_type,title,config,difficulty"
                "&order=order_index&limit=1"
            ) or []
        except Exception:
            sims = _supabase_get(
                f"master_simulations?session_id=eq.{_urlparse_quote(session_id)}"
                "&select=id,sim_type,title,config"
                "&order=order_index&limit=1"
            ) or []

        if not sims:
            return {"has_simulation": False}

        sim = sims[0]
        config = _parse_content(sim.get("config") or {})

        return {
            "has_simulation": True,
            "id": sim["id"],
            "sim_type": sim.get("sim_type") or "decision_making",
            "title": sim.get("title") or "",
            "difficulty": sim.get("difficulty") or "medium",
            "config": config,
        }
