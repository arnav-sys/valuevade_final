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

    def _try_free_trial_write(row: dict) -> tuple[dict | None, str | None]:
        """Best-effort insert into free_mock_trials. Returns (row, error).
        If the table doesn't exist yet, callers fall back to `waitlist`.
        """
        try:
            created = _sb_post("free_mock_trials", row, prefer="return=representation")
            if isinstance(created, list):
                created = created[0] if created else None
            return created, None
        except Exception as exc:
            msg = str(exc)
            return None, msg

    def _add_to_waitlist(email: str, ref: str) -> dict | None:
        """Fallback: add the email to the existing waitlist table. Idempotent.
        `ref` is threaded into `first_name` (via a `[TAG] user` prefix) so
        admins can spot device-blocked or table-missing leads in the same
        waitlist view without a schema change.
        """
        try:
            existing = _sb_get(
                f"waitlist?email=eq.{_urlparse.quote(email)}&select=id&limit=1"
            ) or []
            if existing:
                return {"id": existing[0]["id"], "email": email, "reused": True}
            local = email.split("@")[0][:40]
            if ref and ref.startswith("free-trial-device-blocked"):
                first_name = f"[DEVICE-BLOCKED] {local}"[:60]
            elif ref and ref.startswith("free-trial-fallback"):
                first_name = f"[TABLE-MISSING] {local}"[:60]
            else:
                first_name = local[:60]
            # `waitlist.position` is NOT NULL — compute next position.
            try:
                head = _sb_get("waitlist?select=position&order=position.desc&limit=1") or []
                next_pos = int(((head or [{}])[0] or {}).get("position") or 0) + 1
            except Exception:
                next_pos = 1
            row = {"email": email, "first_name": first_name,
                   "referral_code": f"trial-{local[:20]}",
                   "position": next_pos}
            created = _sb_post("waitlist", row, prefer="return=representation")
            if isinstance(created, list):
                created = created[0] if created else None
            return created
        except Exception as exc:
            logger.warning("[free-trial] waitlist fallback failed: %s", exc)
            return None

    @api_router.post("/free-trial/start")
    async def free_trial_start(body: dict, request: Request):
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

        # Uniqueness check (best-effort — soft-fails when the table is missing).
        # If email matches → resume the existing trial.
        # If ip_hash / fingerprint_hash matches but email is BRAND NEW
        # → still capture the lead to `waitlist` (so admins can see it in
        #   the dashboard) and return a friendly response with a
        #   `waitlisted` flag rather than silently dropping the email.
        table_missing = False
        for field, val in (("email", email), ("ip_hash", ip_hash), ("fingerprint_hash", fp_hash)):
            if not val:
                continue
            try:
                rows = _sb_get(
                    f"free_mock_trials?{field}=eq.{_urlparse.quote(val)}&select=id,email,status,attempt_id&limit=1"
                ) or []
            except Exception as exc:
                if "free_mock_trials" in str(exc) or "PGRST205" in str(exc):
                    table_missing = True
                    break
                raise
            if rows:
                existing = rows[0]
                if field == "email":
                    return {
                        "ok": True, "resumed": True,
                        "trial_id": existing["id"],
                        "attempt_id": existing.get("attempt_id"),
                        "status": existing.get("status"),
                    }
                # Device/fingerprint dedup hit with a NEW email —
                # capture to waitlist before rejecting so no lead is dropped.
                wl = _add_to_waitlist(email, f"free-trial-device-blocked:{ref}")
                return {
                    "ok": False, "waitlisted": True, "device_blocked": True,
                    "trial_id": (wl or {}).get("id") or email,
                    "status": "device_blocked",
                    "message": "Free trial already used on this device. We've added your email — we'll ping you when you can try it on another device or sign up for full access.",
                }

        row = {
            "email": email, "firm_slug": FREE_TRIAL_FIRM,
            "ip_hash": ip_hash, "fingerprint_hash": fp_hash,
            "user_agent": ua, "status": "started", "ref_source": ref,
        }
        if not table_missing:
            created, err = _try_free_trial_write(row)
            if err and ("free_mock_trials" in err or "PGRST205" in err):
                table_missing = True
            elif created:
                return {
                    "ok": True, "resumed": False,
                    "trial_id": created["id"],
                    "attempt_id": created.get("attempt_id"),
                    "status": "started",
                }
            elif err:
                raise HTTPException(status_code=500, detail="Could not start trial.")

        # Table missing → gracefully record on the existing waitlist and let
        # the visitor still go through the signup flow.
        wl = _add_to_waitlist(email, f"free-trial-fallback:{ref}")
        return {
            "ok": True, "resumed": bool(wl and wl.get("reused")),
            "trial_id": (wl or {}).get("id") or email,
            "attempt_id": None, "status": "waitlisted",
            "fallback": True,
            "message": "Added to waitlist — we'll email you when your free simulation is ready.",
        }

    @api_router.post("/free-trial/{trial_id}/provision")
    async def free_trial_provision(trial_id: str, user=Depends(_get_user)):
        """Called right after the trial user signs up. Sets up the JUST-signed-up
        account so the interview hub is unlocked: (a) M20-only user_modules,
        (b) all M20 sessions marked complete, (c) paid status."""
        uid = user["id"]

        # ── Ownership check: the trial_id MUST exist and belong to this caller ──
        trial_rows = _sb_get(
            f"free_mock_trials?id=eq.{_urlparse.quote(trial_id)}&select=id,email,status&limit=1"
        ) or []
        if not trial_rows:
            raise HTTPException(status_code=404, detail="Trial not found")
        trial = trial_rows[0]
        caller_email = (user.get("email") or "").lower().strip()
        trial_email  = (trial.get("email") or "").lower().strip()
        if caller_email != trial_email:
            logger.warning(
                "[free-trial] provision denied: caller=%s trial_email=%s trial_id=%s",
                caller_email, trial_email, trial_id,
            )
            raise HTTPException(status_code=403, detail="Trial does not belong to this account")

        M20 = "755956dd-51e8-47b9-8e22-fbbed253127a"

        # payment_status → paid (best-effort)
        try:
            ps = _sb_get(f"user_payment_status?user_id=eq.{_urlparse.quote(uid)}&select=user_id") or []
            if ps:
                _sb_patch(f"user_payment_status?user_id=eq.{_urlparse.quote(uid)}",
                          {"paid": True, "pricing_tier": "trial"})
            else:
                _sb_post("user_payment_status",
                         {"user_id": uid, "paid": True, "pricing_tier": "trial"},
                         prefer="return=minimal")
        except Exception as exc:
            logger.warning("[free-trial] payment_status skip: %s", exc)

        # Enrollment
        mod_row = (_sb_get(f"master_modules?id=eq.{M20}&select=path_id,title,description,module_number,order_index") or [None])[0]
        if not mod_row:
            raise HTTPException(status_code=500, detail="M20 not found")
        enr = _sb_get(f"user_enrollments?user_id=eq.{_urlparse.quote(uid)}&status=eq.active&select=id") or []
        if enr:
            enr_id = enr[0]["id"]
        else:
            created = _sb_post("user_enrollments", {
                "user_id": uid, "master_path_id": mod_row["path_id"],
                "title": "Free Trial · JPM Mock", "status": "active",
            }, prefer="return=representation")
            enr_id = (created[0] if isinstance(created, list) else created)["id"]

        # user_module for M20
        um = _sb_get(f"user_modules?enrollment_id=eq.{enr_id}&master_module_id=eq.{M20}&select=id") or []
        if um:
            um_id = um[0]["id"]
        else:
            created = _sb_post("user_modules", {
                "enrollment_id": enr_id, "master_module_id": M20,
                "title": mod_row["title"], "description": mod_row.get("description"),
                "module_number": mod_row.get("module_number"),
                "order_index": mod_row.get("order_index"),
                "is_removed": False, "is_completed": False,
            }, prefer="return=representation")
            um_id = (created[0] if isinstance(created, list) else created)["id"]

        # Provision + complete all M20 sessions so the interview hub is unlocked.
        ms = _sb_get(f"master_sessions?module_id=eq.{M20}&select=id,title,description,order_index&order=order_index&limit=3") or []
        have = _sb_get(f"user_sessions?user_module_id=eq.{_urlparse.quote(um_id)}&select=master_session_id") or []
        have_ids = {h["master_session_id"] for h in have}
        for s in ms:
            if s["id"] in have_ids:
                continue
            _sb_post("user_sessions", {
                "user_module_id": um_id, "master_session_id": s["id"],
                "title": s["title"], "description": s.get("description"),
                "order_index": s["order_index"], "is_removed": False,
                "notes_completed": True, "quiz_completed": True,
                "simulation_completed": True, "is_completed": True,
                "completed_at": _now(),
            }, prefer="return=minimal")
        _sb_patch(f"user_sessions?user_module_id=eq.{_urlparse.quote(um_id)}", {
            "notes_completed": True, "quiz_completed": True,
            "simulation_completed": True, "is_completed": True,
        })
        return {"ok": True, "enrollment_id": enr_id, "user_module_id": um_id}

    @api_router.patch("/free-trial/{trial_id}")
    async def free_trial_update(trial_id: str, body: dict, request: Request):
        """Guest endpoint: update trial state (called from the trial player).
        Ownership is verified by requiring the caller to provide their email
        (recorded at trial creation) in the request body.
        """
        b = body or {}

        # Fetch the trial row
        trial_rows = _sb_get(
            f"free_mock_trials?id=eq.{_urlparse.quote(trial_id)}&select=id,email,status&limit=1"
        ) or []
        if not trial_rows:
            raise HTTPException(status_code=404, detail="Trial not found")

        # Ownership check: caller must supply the email used to start the trial.
        caller_email = (b.get("email") or "").strip().lower()
        stored_email = (trial_rows[0].get("email") or "").strip().lower()
        if not caller_email or caller_email != stored_email:
            raise HTTPException(
                status_code=403,
                detail="Trial ownership verification failed. Provide the email used to start this trial.",
            )

        patch: dict = {}
        allowed_keys = {"status", "verdict", "final_score", "stage_data", "attempt_id"}
        for k in allowed_keys:
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
