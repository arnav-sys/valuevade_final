"""
Wave 4, Full Razorpay payment processing + payout/redemption queue.

Runs in MOCK mode whenever RAZORPAY_KEY_ID is missing/empty. Mock mode is
functionally identical to live mode (same DB rows, same commission flow,
same FE checkout sequence), only difference is the actual SDK call.

Wire into server.py via register_payment_endpoints(api_router, deps={...}).
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json as _json
import logging
import os
import secrets
import urllib.parse as _urlparse
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Injected by register_payment_endpoints
_supabase_get = None
_supabase_post = None
_supabase_patch = None
_supabase_delete = None
_get_supabase_user = None
ADMIN_ALLOWED_EMAILS = {"info@valuevade.com"}

# ---------------------------------------------------------------------------
# Mode / crypto helpers
# ---------------------------------------------------------------------------
def is_mock_mode() -> bool:
    return not (os.environ.get("RAZORPAY_KEY_ID") or "").strip()


def _ensure_admin(user: dict):
    email = (user.get("email") or "").strip().lower()
    if email not in {e.lower() for e in ADMIN_ALLOWED_EMAILS}:
        raise HTTPException(status_code=403, detail="Admin access required.")


# ---------------------------------------------------------------------------
# Razorpay SDK lazy client
# ---------------------------------------------------------------------------
_razor_client = None
def _razor():
    """Lazy-init the Razorpay SDK client. Only valid when not in mock mode."""
    global _razor_client
    if _razor_client is not None:
        return _razor_client
    if is_mock_mode():
        raise RuntimeError("Razorpay client requested in mock mode")
    import razorpay
    _razor_client = razorpay.Client(
        auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"])
    )
    return _razor_client


# ---------------------------------------------------------------------------
# Payment status helpers
# ---------------------------------------------------------------------------
def _ensure_payment_status_row(user_id: str) -> dict:
    rows = _supabase_get(
        f"user_payment_status?user_id=eq.{_urlparse.quote(user_id)}&select=*&limit=1"
    ) or []
    if rows:
        return rows[0]
    try:
        _supabase_post(
            "user_payment_status",
            {"user_id": user_id, "paid": False, "free_session_used": False},
            prefer="resolution=ignore-duplicates",
        )
    except Exception as e:
        logger.warning(f"[payments] init user_payment_status failed: {e}")
    rows = _supabase_get(
        f"user_payment_status?user_id=eq.{_urlparse.quote(user_id)}&select=*&limit=1"
    ) or []
    return rows[0] if rows else {
        "user_id": user_id, "paid": False, "free_session_used": False,
        "paid_amount_inr": 0, "pricing_tier": None, "paid_at": None,
    }


def _is_session_one(session_id: str, user_id: str) -> bool:
    """A session is 'free' only when it is order_index=1 of module order_index=1
    of one of THIS user's enrollments."""
    if not session_id:
        return False
    sess = _supabase_get(
        f"user_sessions?id=eq.{_urlparse.quote(session_id)}"
        "&select=order_index,user_module_id&limit=1"
    ) or []
    if not sess:
        return False
    s = sess[0]
    if (s.get("order_index") or 0) != 1:
        return False
    mod = _supabase_get(
        f"user_modules?id=eq.{_urlparse.quote(s['user_module_id'])}"
        "&select=order_index,enrollment_id&limit=1"
    ) or []
    if not mod:
        return False
    m = mod[0]
    if (m.get("order_index") or 0) != 1:
        return False
    enr = _supabase_get(
        f"user_enrollments?id=eq.{_urlparse.quote(m['enrollment_id'])}"
        f"&user_id=eq.{_urlparse.quote(user_id)}&select=id&limit=1"
    ) or []
    return bool(enr)


def _lazy_free_session_used(user_id: str, status_row: dict) -> dict:
    """If session #1 is fully completed and free_session_used is false, flip it."""
    if status_row.get("free_session_used"):
        return status_row
    enrs = _supabase_get(
        f"user_enrollments?user_id=eq.{_urlparse.quote(user_id)}&select=id&limit=20"
    ) or []
    if not enrs:
        return status_row
    enr_ids = ",".join(e["id"] for e in enrs)
    m1 = _supabase_get(
        f"user_modules?enrollment_id=in.({enr_ids})&order_index=eq.1"
        "&select=id&limit=5"
    ) or []
    if not m1:
        return status_row
    mod_ids = ",".join(m["id"] for m in m1)
    s1 = _supabase_get(
        f"user_sessions?user_module_id=in.({mod_ids})&order_index=eq.1"
        "&select=is_completed,notes_completed,quiz_completed,interview_completed,simulation_completed&limit=5"
    ) or []
    if not s1:
        return status_row
    # Done if either is_completed=true OR all four phase flags true
    def _done(row):
        if row.get("is_completed"):
            return True
        return all(row.get(f"{p}_completed") for p in ("notes", "quiz", "interview", "simulation"))
    if any(_done(r) for r in s1):
        try:
            _supabase_patch(
                f"user_payment_status?user_id=eq.{_urlparse.quote(user_id)}",
                {"free_session_used": True},
            )
            status_row["free_session_used"] = True
        except Exception as e:
            logger.warning(f"[payments] flip free_session_used failed: {e}")
    return status_row


def _pricing_for_user(status_row: dict) -> tuple[str, int]:
    """Returns (tier_code, amount_inr) for what's available to this user now."""
    if status_row.get("free_session_used"):
        return ("post_trial", 4999)
    return ("upfront", 4999)


def _award_paid_completion_xp(user_id: str):
    """Optional +250 XP when a user goes from free → paid. One-shot per user
    via the reason='paid_upgrade' constraint."""
    try:
        _supabase_post(
            "rpc/award_xp",
            {"p_user_id": user_id, "p_amount": 250, "p_reason": "paid_upgrade",
             "p_source_id": user_id, "p_meta": {}},
        )
    except Exception as e:
        # Most likely the award_xp RPC doesn't whitelist 'paid_upgrade' as a
        # valid reason, non-fatal.
        logger.info(f"[payments] paid_upgrade xp skipped: {e}")


def _mark_paid(user_id: str, amount_inr: int, tier_code: str) -> bool:
    """Idempotently mark user as paid. Returns True only when this call is
    the one that actually flipped paid=false -> true (so callers can fire
    one-shot side-effects like the receipt email)."""
    cur = _ensure_payment_status_row(user_id)
    if cur.get("paid"):
        return False
    _supabase_patch(
        f"user_payment_status?user_id=eq.{_urlparse.quote(user_id)}",
        {
            "paid": True,
            "paid_amount_inr": amount_inr,
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "pricing_tier": tier_code,
        },
    )
    _award_paid_completion_xp(user_id)
    return True


def _receipt_email_html(name: str, amount_inr: int, tier_code: str, paid_at: str) -> str:
    tier_label = "Lifetime access (upfront)" if tier_code == "upfront" else "Lifetime access (post-trial)"
    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0e0e16;color:#f4f4f8;">
      <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8b8b9e;margin:0 0 20px;">Valuevade · Payment Receipt</p>
      <h1 style="font-size:22px;margin:0 0 16px;color:#ffffff;">Thanks, {name}, you're in.</h1>
      <p style="font-size:14px;line-height:1.6;color:#c9c9d6;margin:0 0 24px;">
        Your payment was successful and your lifetime access to the Equity Research &amp;
        Financial Modelling course is now unlocked. Here's your receipt:
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #2a2a3a;font-size:13px;color:#8b8b9e;">Plan</td>
          <td style="padding:10px 0;border-bottom:1px solid #2a2a3a;font-size:13px;text-align:right;color:#ffffff;">{tier_label}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #2a2a3a;font-size:13px;color:#8b8b9e;">Amount paid</td>
          <td style="padding:10px 0;border-bottom:1px solid #2a2a3a;font-size:13px;text-align:right;color:#ffffff;">₹{amount_inr:,}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-size:13px;color:#8b8b9e;">Date</td>
          <td style="padding:10px 0;font-size:13px;text-align:right;color:#ffffff;">{paid_at}</td>
        </tr>
      </table>
      <p style="font-size:13px;line-height:1.6;color:#c9c9d6;margin:0 0 8px;">
        Head back to your dashboard to pick up where you left off. No subscription, no renewals,
        this access is yours for life.
      </p>
      <p style="font-size:12px;color:#6b6b7e;margin-top:32px;">
        Valuevade · This is an automated receipt, no reply needed.
      </p>
    </div>
    """


def _send_payment_receipt_email_sync(user_id: str, amount_inr: int, tier_code: str):
    api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if not api_key:
        logger.info("[payments] RESEND_API_KEY not set, skipping receipt email")
        return
    try:
        profs = _supabase_get(
            f"profiles?id=eq.{_urlparse.quote(user_id)}&select=email,full_name&limit=1"
        ) or []
        if not profs or not profs[0].get("email"):
            return
        email = profs[0]["email"]
        name = (profs[0].get("full_name") or "there").strip() or "there"
        import resend
        resend.api_key = api_key
        sender = (os.environ.get("SENDER_EMAIL") or "onboarding@resend.dev").strip()
        paid_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
        resend.Emails.send({
            "from": f"Valuevade <{sender}>",
            "to": [email],
            "subject": "Your Valuevade payment receipt, lifetime access unlocked",
            "html": _receipt_email_html(name, amount_inr, tier_code, paid_at),
        })
        logger.info(f"[payments] receipt email sent to {email}")
    except Exception as e:
        logger.warning(f"[payments] receipt email failed for user {user_id}: {e}")


async def _send_payment_receipt_email(user_id: str, amount_inr: int, tier_code: str):
    """Non-blocking (thread-offloaded) receipt email. Failures never affect
    the payment flow, this is a best-effort notification only."""
    try:
        await asyncio.to_thread(_send_payment_receipt_email_sync, user_id, amount_inr, tier_code)
    except Exception as e:
        logger.warning(f"[payments] receipt email dispatch failed for user {user_id}: {e}")


# ===========================================================================
# Pydantic
# ===========================================================================
class CreateOrderReq(BaseModel):
    pricing_tier: str = Field(..., min_length=3, max_length=20)


class VerifyPaymentReq(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class MockSuccessReq(BaseModel):
    order_id: str  # our internal razorpay_orders.id


# ===========================================================================
# Router
# ===========================================================================
def register_payment_endpoints(api_router: APIRouter, deps: dict):
    global _supabase_get, _supabase_post, _supabase_patch, _supabase_delete, _get_supabase_user
    _supabase_get = deps["supabase_get"]
    _supabase_post = deps["supabase_post"]
    _supabase_patch = deps["supabase_patch"]
    _supabase_delete = deps.get("supabase_delete")
    _get_supabase_user = deps["get_supabase_user"]

    # ---------------- ENROLLMENT-STATUS GATE ----------------
    @api_router.get("/me/enrollment-status")
    async def me_enrollment_status(user=Depends(_get_supabase_user)):
        """Drives the front-end EnrollmentGate. Read-only, idempotent."""
        uid = user["id"]
        # 1) user_payment_status row?
        ps_rows = _supabase_get(
            f"user_payment_status?user_id=eq.{_urlparse.quote(uid)}"
            "&select=user_id,paid,free_session_used&limit=1"
        ) or []
        has_payment_status = bool(ps_rows)
        paid = bool(ps_rows[0].get("paid")) if ps_rows else False
        # 2) active or completed enrollment?
        enr_rows = _supabase_get(
            f"user_enrollments?user_id=eq.{_urlparse.quote(uid)}"
            "&status=in.(active,completed)&select=id&limit=1"
        ) or []
        has_enrollment = bool(enr_rows)
        # Routing intent
        needs_start_choice = not has_payment_status
        needs_customize = has_payment_status and not has_enrollment
        needs_dashboard = has_enrollment
        return {
            "has_payment_status": has_payment_status,
            "has_enrollment": has_enrollment,
            "paid": paid,
            "free_session_used": bool(ps_rows[0].get("free_session_used")) if ps_rows else False,
            "needs_start_choice": needs_start_choice,
            "needs_customize": needs_customize,
            "needs_dashboard": needs_dashboard,
        }

    # ---------------- START FREE TRIAL ----------------
    @api_router.post("/payments/start-free-trial")
    async def payments_start_free_trial(user=Depends(_get_supabase_user)):
        """Idempotent: ensures user_payment_status row exists with paid=false.
        Lets a new user signal they've chosen the trial path so EnrollmentGate
        stops blocking them on /start."""
        _ensure_payment_status_row(user["id"])
        return {"ok": True, "paid": False, "free_session_used": False}

    # ---------------- ELIGIBILITY ----------------
    @api_router.get("/payments/eligibility")
    async def payments_eligibility(session_id: Optional[str] = None,
                                   user=Depends(_get_supabase_user)):
        status_row = _ensure_payment_status_row(user["id"])
        status_row = _lazy_free_session_used(user["id"], status_row)
        tier_code, amount = _pricing_for_user(status_row)
        is_free = _is_session_one(session_id, user["id"]) if session_id else False
        paid = bool(status_row.get("paid"))
        session_allowed = paid or is_free or not session_id
        return {
            "paid": paid,
            "free_session_used": bool(status_row.get("free_session_used")),
            "is_free_session": is_free,
            "session_allowed": session_allowed,
            "pricing_tier_available": tier_code,
            "amount_inr": amount,
            "mock_mode": is_mock_mode(),
            "key_id": (os.environ.get("RAZORPAY_KEY_ID") or "") if not is_mock_mode() else "mock",
        }

    # ---------------- CREATE ORDER ----------------
    @api_router.post("/payments/create-order")
    async def payments_create_order(req: CreateOrderReq,
                                    user=Depends(_get_supabase_user)):
        status_row = _ensure_payment_status_row(user["id"])
        status_row = _lazy_free_session_used(user["id"], status_row)
        if status_row.get("paid"):
            raise HTTPException(status_code=400, detail="already paid")
        # Server-side pricing, FE-supplied tier is validated against eligibility.
        tier_code, amount = _pricing_for_user(status_row)
        # If user explicitly asked for upfront but free session already used,
        # downgrade silently to post_trial (price changes).
        if req.pricing_tier != tier_code:
            # Allow only when user requests post_trial while upfront is offered
            # (i.e. they want to skip the discount). Otherwise force.
            if not (req.pricing_tier == "post_trial" and tier_code == "upfront"):
                pass  # ignore mismatch, server-side wins
            else:
                tier_code, amount = "post_trial", 1700
        mock = is_mock_mode()
        if mock:
            razorpay_order_id = f"mock_order_{secrets.token_hex(8)}"
        else:
            try:
                ord_resp = _razor().order.create({
                    "amount": amount * 100,  # paise
                    "currency": "INR",
                    "receipt": f"vv_{user['id'][:8]}_{int(datetime.now().timestamp())}",
                    "payment_capture": 1,
                })
                razorpay_order_id = ord_resp["id"]
            except Exception as e:
                logger.error(f"[payments] razorpay create failed: {e}")
                raise HTTPException(status_code=502, detail=f"razorpay error: {e}")
        # Persist the order
        created = _supabase_post(
            "razorpay_orders",
            {
                "razorpay_order_id": razorpay_order_id,
                "user_id": user["id"],
                "amount_inr": amount,
                "pricing_tier": tier_code,
                "status": "created",
                "mock_mode": mock,
            },
            prefer="return=representation",
        )
        if isinstance(created, list):
            created = created[0]
        return {
            "order_id": created["id"],
            "razorpay_order_id": razorpay_order_id,
            "amount_inr": amount,
            "amount_paise": amount * 100,
            "pricing_tier": tier_code,
            "key_id": (os.environ.get("RAZORPAY_KEY_ID") or "") if not mock else "mock",
            "mock_mode": mock,
        }

    # ---------------- VERIFY PAYMENT (signature → mark paid) ----------------
    @api_router.post("/payments/verify")
    async def payments_verify(req: VerifyPaymentReq,
                              user=Depends(_get_supabase_user)):
        rows = _supabase_get(
            f"razorpay_orders?razorpay_order_id=eq.{_urlparse.quote(req.razorpay_order_id)}"
            f"&user_id=eq.{_urlparse.quote(user['id'])}&select=*&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="order not found")
        order = rows[0]
        mock = bool(order.get("mock_mode")) or is_mock_mode()
        if not mock:
            try:
                _razor().utility.verify_payment_signature({
                    "razorpay_order_id": req.razorpay_order_id,
                    "razorpay_payment_id": req.razorpay_payment_id,
                    "razorpay_signature": req.razorpay_signature,
                })
            except Exception as e:
                logger.warning(f"[payments] signature verify failed: {e}")
                raise HTTPException(status_code=400, detail="signature mismatch")
        # Idempotent write
        try:
            _supabase_post(
                "razorpay_payments",
                {
                    "razorpay_payment_id": req.razorpay_payment_id,
                    "razorpay_order_id": req.razorpay_order_id,
                    "user_id": user["id"],
                    "amount_inr": order["amount_inr"],
                    "method": "mock" if mock else "checkout",
                    "status": "captured",
                    "webhook_signature": req.razorpay_signature or "",
                },
                prefer="resolution=ignore-duplicates",
            )
        except Exception as e:
            logger.warning(f"[payments] payment row insert failed: {e}")
        try:
            _supabase_patch(
                f"razorpay_orders?id=eq.{_urlparse.quote(order['id'])}",
                {"status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()},
            )
        except Exception:
            pass
        just_paid = _mark_paid(user["id"], order["amount_inr"], order["pricing_tier"])
        if just_paid:
            await _send_payment_receipt_email(user["id"], order["amount_inr"], order["pricing_tier"])
        return {"ok": True, "paid": True}

    # ---------------- MOCK SUCCESS (mock mode only) ----------------
    @api_router.post("/payments/mock-success")
    async def payments_mock_success(req: MockSuccessReq,
                                    user=Depends(_get_supabase_user)):
        if not is_mock_mode():
            raise HTTPException(status_code=404, detail="mock mode disabled")
        rows = _supabase_get(
            f"razorpay_orders?id=eq.{_urlparse.quote(req.order_id)}"
            f"&user_id=eq.{_urlparse.quote(user['id'])}&select=*&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="order not found")
        order = rows[0]
        if order["status"] == "paid":
            return {"ok": True, "already_paid": True}
        mock_payment_id = f"mock_payment_{secrets.token_hex(8)}"
        try:
            _supabase_post(
                "razorpay_payments",
                {
                    "razorpay_payment_id": mock_payment_id,
                    "razorpay_order_id": order["razorpay_order_id"],
                    "user_id": user["id"],
                    "amount_inr": order["amount_inr"],
                    "method": "mock",
                    "status": "captured",
                    "webhook_signature": "mock",
                    "raw_payload": {"mock": True, "tier": order["pricing_tier"]},
                },
                prefer="resolution=ignore-duplicates",
            )
        except Exception as e:
            logger.warning(f"[payments] mock payment insert failed: {e}")
        _supabase_patch(
            f"razorpay_orders?id=eq.{_urlparse.quote(order['id'])}",
            {"status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()},
        )
        just_paid = _mark_paid(user["id"], order["amount_inr"], order["pricing_tier"])
        if just_paid:
            await _send_payment_receipt_email(user["id"], order["amount_inr"], order["pricing_tier"])
        return {"ok": True, "paid": True, "razorpay_payment_id": mock_payment_id}

    # ---------------- WEBHOOK (no auth, signature-verified) ----------------
    @api_router.post("/payments/webhook")
    async def payments_webhook(request: Request):
        body = await request.body()
        signature = request.headers.get("x-razorpay-signature", "")
        secret = (os.environ.get("RAZORPAY_WEBHOOK_SECRET") or "").strip()
        if not secret:
            # Hard reject, never process unsigned webhook events in production.
            # Set RAZORPAY_WEBHOOK_SECRET in backend/.env (Razorpay Dashboard → Webhooks).
            logger.critical(
                "[payments] RAZORPAY_WEBHOOK_SECRET is unset, rejecting webhook to prevent "
                "unauthenticated payment confirmation. Set the secret to enable webhooks."
            )
            raise HTTPException(status_code=503, detail="Webhook not configured on this server")
        expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            logger.warning("[payments] webhook signature mismatch, rejected")
            raise HTTPException(status_code=400, detail="bad signature")
        try:
            evt = _json.loads(body.decode("utf-8"))
        except Exception:
            raise HTTPException(status_code=400, detail="invalid json")
        evt_type = evt.get("event") or ""
        payment_payload = (evt.get("payload") or {}).get("payment", {}).get("entity", {})
        if not payment_payload:
            return {"ok": True, "skipped": "no payment entity"}
        rp_payment_id = payment_payload.get("id")
        rp_order_id = payment_payload.get("order_id")
        amount_paise = int(payment_payload.get("amount") or 0)
        amount_inr = amount_paise // 100
        method = payment_payload.get("method") or ""
        # Find owning user via the order row
        ord_rows = _supabase_get(
            f"razorpay_orders?razorpay_order_id=eq.{_urlparse.quote(rp_order_id or '')}"
            "&select=*&limit=1"
        ) or [] if rp_order_id else []
        if not ord_rows:
            logger.warning(f"[payments] webhook for unknown order {rp_order_id}")
            return {"ok": True, "skipped": "unknown order"}
        order = ord_rows[0]
        if evt_type == "payment.captured":
            try:
                _supabase_post(
                    "razorpay_payments",
                    {
                        "razorpay_payment_id": rp_payment_id,
                        "razorpay_order_id": rp_order_id,
                        "user_id": order["user_id"],
                        "amount_inr": amount_inr or order["amount_inr"],
                        "method": method,
                        "status": "captured",
                        "webhook_signature": signature,
                        "raw_payload": evt,
                    },
                    prefer="resolution=ignore-duplicates",
                )
            except Exception as e:
                logger.warning(f"[payments] webhook payment insert failed: {e}")
            _supabase_patch(
                f"razorpay_orders?id=eq.{_urlparse.quote(order['id'])}",
                {"status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()},
            )
            just_paid = _mark_paid(order["user_id"], order["amount_inr"], order["pricing_tier"])
            if just_paid:
                await _send_payment_receipt_email(order["user_id"], order["amount_inr"], order["pricing_tier"])
            return {"ok": True, "handled": "payment.captured"}
        elif evt_type == "payment.failed":
            _supabase_patch(
                f"razorpay_orders?id=eq.{_urlparse.quote(order['id'])}",
                {"status": "failed", "updated_at": datetime.now(timezone.utc).isoformat()},
            )
            return {"ok": True, "handled": "payment.failed"}
        return {"ok": True, "skipped": f"event {evt_type}"}

    # ---------------- HISTORY ----------------
    @api_router.get("/payments/my-history")
    async def payments_my_history(user=Depends(_get_supabase_user)):
        orders = _supabase_get(
            f"razorpay_orders?user_id=eq.{_urlparse.quote(user['id'])}"
            "&select=id,razorpay_order_id,amount_inr,pricing_tier,status,mock_mode,created_at"
            "&order=created_at.desc&limit=50"
        ) or []
        payments = _supabase_get(
            f"razorpay_payments?user_id=eq.{_urlparse.quote(user['id'])}"
            "&select=razorpay_payment_id,razorpay_order_id,amount_inr,method,status,created_at"
            "&order=created_at.desc&limit=50"
        ) or []
        status_row = _ensure_payment_status_row(user["id"])
        return {"orders": orders, "payments": payments, "status": {
            "paid": bool(status_row.get("paid")),
            "paid_amount_inr": int(status_row.get("paid_amount_inr") or 0),
            "paid_at": status_row.get("paid_at"),
            "pricing_tier": status_row.get("pricing_tier"),
            "free_session_used": bool(status_row.get("free_session_used")),
        }}


    # ---------------- ADMIN, PAYMENTS OVERVIEW ----------------
    @api_router.get("/admin/payments/overview")
    async def admin_payments_overview(user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        statuses = _supabase_get(
            "user_payment_status?select=user_id,paid,paid_amount_inr,paid_at,pricing_tier&limit=10000"
        ) or []
        paid_rows = [s for s in statuses if s.get("paid")]
        total_revenue = sum(int(s.get("paid_amount_inr") or 0) for s in paid_rows)
        avg_txn = int(total_revenue / max(len(paid_rows), 1)) if paid_rows else 0
        profiles_count = (_supabase_get("profiles?select=id&limit=10000") or [])
        free_users = max(len(profiles_count) - len(paid_rows), 0)
        # Per-user paid table (enrich)
        ids = [s["user_id"] for s in paid_rows]
        prof_by_id = {}
        if ids:
            id_list = ",".join(ids)
            profs = _supabase_get(
                f"profiles?id=in.({id_list})&select=id,full_name,email"
            ) or []
            prof_by_id = {p["id"]: p for p in profs}
        # Get payment method
        rp_pmt = _supabase_get(
            f"razorpay_payments?user_id=in.({','.join(ids)})&select=user_id,method&order=created_at.desc&limit=2000"
            if ids else "razorpay_payments?select=user_id,method&limit=1"
        ) or []
        method_by_user = {}
        for p in rp_pmt:
            method_by_user.setdefault(p["user_id"], p.get("method") or "")
        users_out = []
        for s in sorted(paid_rows, key=lambda x: (x.get("paid_at") or ""), reverse=True):
            p = prof_by_id.get(s["user_id"], {})
            users_out.append({
                "user_id": s["user_id"],
                "full_name": p.get("full_name") or "",
                "email": p.get("email") or "",
                "amount_inr": int(s.get("paid_amount_inr") or 0),
                "pricing_tier": s.get("pricing_tier"),
                "paid_at": s.get("paid_at"),
                "method": method_by_user.get(s["user_id"]) or "",
            })
        return {
            "stats": {
                "total_revenue_inr": total_revenue,
                "paid_users": len(paid_rows),
                "free_users": free_users,
                "avg_txn_inr": avg_txn,
            },
            "users": users_out,
            "mock_mode": is_mock_mode(),
        }

    @api_router.get("/admin/payments/recent")
    async def admin_payments_recent(limit: int = 20, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        limit = max(1, min(100, int(limit or 20)))
        pmts = _supabase_get(
            "razorpay_payments?select=razorpay_payment_id,razorpay_order_id,user_id,"
            "amount_inr,method,status,created_at"
            f"&order=created_at.desc&limit={limit}"
        ) or []
        ids = list({p["user_id"] for p in pmts if p.get("user_id")})
        prof_by_id = {}
        if ids:
            id_list = ",".join(ids)
            profs = _supabase_get(
                f"profiles?id=in.({id_list})&select=id,full_name,email"
            ) or []
            prof_by_id = {p["id"]: p for p in profs}
        out = []
        for p in pmts:
            pr = prof_by_id.get(p["user_id"], {})
            out.append({
                **p,
                "full_name": pr.get("full_name") or "",
                "email": pr.get("email") or "",
            })
        return {"total": len(out), "payments": out}

    @api_router.get("/admin/payments/export")
    async def admin_payments_export(user=Depends(_get_supabase_user)):
        """Return all paid users as a downloadable CSV file for Google Sheets import."""
        import csv as _csv
        import io as _io
        from fastapi.responses import StreamingResponse
        _ensure_admin(user)

        statuses = _supabase_get(
            "user_payment_status?select=user_id,paid,paid_amount_inr,paid_at,pricing_tier&limit=10000"
        ) or []
        paid_rows = [s for s in statuses if s.get("paid")]

        ids = [s["user_id"] for s in paid_rows]
        prof_by_id = {}
        if ids:
            profs = _supabase_get(
                f"profiles?id=in.({','.join(ids)})&select=id,full_name,email"
            ) or []
            prof_by_id = {p["id"]: p for p in profs}

        rp_pmt = _supabase_get(
            f"razorpay_payments?user_id=in.({','.join(ids)})&select=user_id,method&order=created_at.desc&limit=2000"
            if ids else "razorpay_payments?select=user_id,method&limit=1"
        ) or []
        method_by_user = {}
        for p in rp_pmt:
            method_by_user.setdefault(p["user_id"], p.get("method") or "")

        output = _io.StringIO()
        writer = _csv.writer(output)
        writer.writerow(["Name", "Email", "Pricing Tier", "Amount (INR)", "Payment Method", "Date Paid"])
        for s in sorted(paid_rows, key=lambda x: (x.get("paid_at") or ""), reverse=True):
            p = prof_by_id.get(s["user_id"], {})
            writer.writerow([
                p.get("full_name") or "",
                p.get("email") or "",
                s.get("pricing_tier") or "",
                int(s.get("paid_amount_inr") or 0),
                method_by_user.get(s["user_id"]) or "",
                (s.get("paid_at") or "")[:19].replace("T", " "),  # human readable
            ])

        csv_bytes = output.getvalue().encode("utf-8")
        return StreamingResponse(
            iter([csv_bytes]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=\"valuevade_payments.csv\""},
        )
