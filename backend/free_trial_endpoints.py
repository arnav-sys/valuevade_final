"""Free landing-page mock interview trial — one attempt per email + browser.

Register via `register_free_trial_endpoints(api_router, deps)`. Reuses the
existing interview_sim endpoints for the actual gameplay — this module only
gates access (email lookup + fingerprint/IP guard) and provides admin views.
"""
from __future__ import annotations

import hashlib
import logging
import re
import urllib.parse as _urlparse
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request

logger = logging.getLogger(__name__)

# Deps injected by register_*
_sb_get = None
_sb_post = None
_sb_patch = None
_sb_delete = None
_get_user = None
_ensure_admin = None

# Fixed JPM slug for the free trial (per product decision).
FREE_TRIAL_FIRM = "jpmorgan"
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:32] if s else ""


def _client_ip(req: Request) -> str:
    xff = req.headers.get("x-forwarded-for") or ""
    if xff:
        return xff.split(",")[0].strip()
    return (req.client.host if req.client else "") or ""


def register_free_trial_endpoints(api_router: APIRouter, deps: Dict[str, Any]) -> None:
    global _sb_get, _sb_post, _sb_patch, _sb_delete, _get_user, _ensure_admin
    _sb_get = deps["supabase_get"]
    _sb_post = deps["supabase_post"]
    _sb_patch = deps["supabase_patch"]
    _sb_delete = deps.get("supabase_delete")
    _get_user = deps["get_supabase_user"]
    _ensure_admin = deps["ensure_admin"]

    @api_router.post("/free-trial/start")
    async def free_trial_start(body: dict, request: Request):
        """Guest endpoint: email + browser fingerprint → returns trial state.
        Blocks repeat attempts from same email, fingerprint, or IP hash."""
        b = body or {}
        email = (b.get("email") or "").strip().lower()
        fingerprint = (b.get("fingerprint") or "").strip()
        ref = (b.get("ref") or "landing")[:80]
        if not EMAIL_RE.match(email):
            raise HTTPException(status_code=400, detail="Please enter a valid email.")

        ip = _client_ip(request)
        ip_hash = _hash(ip)
        fp_hash = _hash(fingerprint) if fingerprint else ""
        ua = (request.headers.get("user-agent") or "")[:400]

        # Uniqueness check — three vectors: email, ip, fingerprint.
        for field, val in (("email", email), ("ip_hash", ip_hash), ("fingerprint_hash", fp_hash)):
            if not val:
                continue
            rows = _sb_get(
                f"free_mock_trials?{field}=eq.{_urlparse.quote(val)}&select=id,email,status,attempt_id&limit=1"
            ) or []
            if rows:
                existing = rows[0]
                # Allow the same email to resume its own trial only.
                if field == "email":
                    return {
                        "ok": True,
                        "resumed": True,
                        "trial_id": existing["id"],
                        "attempt_id": existing.get("attempt_id"),
                        "status": existing.get("status"),
                    }
                # Different email but same laptop/IP = block.
                raise HTTPException(
                    status_code=409,
                    detail="Free trial already used on this device. Sign up for full access.",
                )

        row = {
            "email": email, "firm_slug": FREE_TRIAL_FIRM,
            "ip_hash": ip_hash, "fingerprint_hash": fp_hash,
            "user_agent": ua, "status": "started", "ref_source": ref,
        }
        created = _sb_post("free_mock_trials", row, prefer="return=representation")
        if isinstance(created, list):
            created = created[0] if created else None
        if not created:
            raise HTTPException(status_code=500, detail="Could not start trial.")
        return {
            "ok": True, "resumed": False,
            "trial_id": created["id"], "attempt_id": created.get("attempt_id"),
            "status": "started",
        }

    @api_router.patch("/free-trial/{trial_id}")
    async def free_trial_update(trial_id: str, body: dict):
        """Guest endpoint: update trial state (called from the trial player)."""
        b = body or {}
        patch: dict = {}
        for k in ("status", "verdict", "final_score", "stage_data", "attempt_id"):
            if k in b:
                patch[k] = b[k]
        if b.get("status") == "completed":
            patch["completed_at"] = _now()
        if not patch:
            return {"ok": True}
        _sb_patch(f"free_mock_trials?id=eq.{_urlparse.quote(trial_id)}", patch)
        return {"ok": True}

    # ------------------------------------------------------------------ Admin
    @api_router.get("/admin/free-trials")
    async def admin_list_trials(user=Depends(_get_user)):
        _ensure_admin(user)
        trials = _sb_get(
            "free_mock_trials?select=*&order=created_at.desc&limit=1000"
        ) or []
        waitlist = _sb_get(
            "waitlist?select=id,first_name,email,position,referral_count,timestamp"
            "&order=timestamp.desc&limit=1000"
        ) or []
        return {
            "trials": trials,
            "waitlist": waitlist,
            "counts": {
                "trials_total": len(trials),
                "trials_completed": sum(1 for t in trials if t.get("status") == "completed"),
                "trials_offer": sum(1 for t in trials if t.get("verdict") == "offer"),
                "waitlist_total": len(waitlist),
            },
        }

    logger.info("[free-trial] endpoints registered")
