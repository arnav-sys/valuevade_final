"""
Public (no-auth) endpoints that serve content for the two admin-marked free
trial sessions.  These never require a Supabase JWT.

Migration-resilient: every query falls back to base columns when the
is_free_session / is_preview_session / video_duration_minutes / difficulty
columns don't exist yet in the DB.
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

    import re as _re
    _UUID_RE = _re.compile(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', _re.I
    )

    def _is_valid_uuid(val: str) -> bool:
        return bool(_UUID_RE.match(val))

    def _get_free_session(session_id: str) -> dict:
        """Fetch a session row. Falls back to base columns if new ones are missing."""
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
            # Columns from migration 0041 don't exist yet — use base select
            rows = _supabase_get(
                f"master_sessions?id=eq.{_urlparse_quote(session_id)}"
                "&select=id,title,description,order_index,module_id,lecture_url"
                "&limit=1"
            ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="Session not found")
        return rows[0]

    def _check_free(sess: dict) -> None:
        """
        Guard: block if the DB has the is_free_session column AND it is
        explicitly False.  When the column is absent (migration not applied),
        allow through so the free-trial UX still works.
        """
        if "is_free_session" in sess and not sess["is_free_session"]:
            raise HTTPException(
                status_code=403,
                detail="This session is not available for free trial."
            )

    def _parse_content(raw) -> object:
        if isinstance(raw, str):
            try:
                return _json.loads(raw)
            except Exception:
                return raw
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
        sess = _get_free_session(session_id)
        _check_free(sess)

        module_title = ""
        if sess.get("module_id"):
            mod_rows = _supabase_get(
                f"master_modules?id=eq.{_urlparse_quote(sess['module_id'])}"
                "&select=title&limit=1"
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
        sess = _get_free_session(session_id)
        _check_free(sess)

        cards = _supabase_get(
            f"master_notes_cards?session_id=eq.{_urlparse_quote(session_id)}"
            "&select=id,card_type,title,content,order_index"
            "&order=order_index&limit=50"
        ) or []

        parsed = []
        for c in cards:
            if c.get("card_type") == "pdf_document":
                continue
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
        sess = _get_free_session(session_id)
        _check_free(sess)

        try:
            questions = _supabase_get(
                f"master_quiz_questions?session_id=eq.{_urlparse_quote(session_id)}"
                "&select=id,question,options,correct_answer_index,explanation,difficulty"
                "&order=order_index&limit=20"
            ) or []
        except Exception:
            questions = _supabase_get(
                f"master_quiz_questions?session_id=eq.{_urlparse_quote(session_id)}"
                "&select=id,question,options,correct_answer_index,explanation"
                "&limit=20"
            ) or []

        parsed = []
        for q in questions:
            opts = _parse_content(q.get("options") or [])
            parsed.append({
                "id": q["id"],
                "question_text": q.get("question") or q.get("question_text") or "",
                "options": opts if isinstance(opts, list) else [],
                "correct_answer_index": q.get("correct_answer_index"),
                "explanation": q.get("explanation") or "",
                "difficulty": q.get("difficulty") or "medium",
            })

        return {"questions": parsed, "total": len(parsed)}

    # ── guest simulation ──────────────────────────────────────────────────────

    @api_router.get("/free-session/{session_id}/simulation")
    async def guest_session_simulation(session_id: str):
        sess = _get_free_session(session_id)
        _check_free(sess)

        try:
            sims = _supabase_get(
                f"master_simulations?session_id=eq.{_urlparse_quote(session_id)}"
                "&select=id,sim_type,title,config,difficulty"
                "&limit=1"
            ) or []
        except Exception:
            sims = _supabase_get(
                f"master_simulations?session_id=eq.{_urlparse_quote(session_id)}"
                "&select=id,sim_type,title,config"
                "&limit=1"
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
