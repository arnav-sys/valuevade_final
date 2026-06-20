"""
Wave 4 — Full Razorpay payment processing + payout/redemption queue.

Runs in MOCK mode whenever RAZORPAY_KEY_ID is missing/empty. Mock mode is
functionally identical to live mode (same DB rows, same commission flow,
same FE checkout sequence) — only difference is the actual SDK call.

Wire into server.py via register_payment_endpoints(api_router, deps={...}).
"""
from __future__ import annotations

import base64
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


def _get_encryption_key() -> bytes:
    """Returns 32-byte AES-256 key from PAYOUT_DETAILS_ENCRYPTION_KEY (b64).
    If missing, generates one in-memory and warns; existing encrypted rows
    can't be decrypted in that case."""
    raw = (os.environ.get("PAYOUT_DETAILS_ENCRYPTION_KEY") or "").strip()
    if raw:
        try:
            key = base64.b64decode(raw)
            if len(key) == 32:
                return key
        except Exception:
            pass
    # Fallback — generates a random key per worker. Encrypted rows from
    # previous workers won't decrypt. Real fix: set the env var.
    logger.warning(
        "PAYOUT_DETAILS_ENCRYPTION_KEY missing/invalid. Generating ephemeral "
        "key; previously-encrypted payout details will become unreadable. "
        "Set a stable 32-byte base64 key in backend/.env."
    )
    return secrets.token_bytes(32)


def encrypt_payout_details(plaintext: dict) -> str:
    """AES-256-GCM. Returns base64(iv || ciphertext+tag) suitable for storage."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    key = _get_encryption_key()
    iv = secrets.token_bytes(12)
    aes = AESGCM(key)
    pt = _json.dumps(plaintext, separators=(",", ":")).encode("utf-8")
    ct = aes.encrypt(iv, pt, None)
    return base64.b64encode(iv + ct).decode("ascii")


def decrypt_payout_details(ciphertext_b64: str) -> dict:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    key = _get_encryption_key()
    blob = base64.b64decode(ciphertext_b64)
    iv, ct = blob[:12], blob[12:]
    pt = AESGCM(key).decrypt(iv, ct, None)
    return _json.loads(pt.decode("utf-8"))


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
        return ("post_trial", 1700)
    return ("upfront", 1500)


def _award_referral_commission(paying_user_id: str, amount_inr: int):
    """Calls the SQL RPC that bumps the matching referral_events row's
    referred_user_revenue. commission_amount is a generated column → auto."""
    if amount_inr <= 0:
        return
    try:
        _supabase_post(
            "rpc/update_referral_revenue",
            {"p_referred_user_id": paying_user_id, "p_amount": amount_inr},
        )
    except Exception as e:
        logger.warning(f"[payments] referral commission update failed: {e}")


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
        # valid reason — non-fatal.
        logger.info(f"[payments] paid_upgrade xp skipped: {e}")


def _mark_paid(user_id: str, amount_inr: int, tier_code: str):
    """Idempotently mark user as paid. Triggers referral commission once."""
    cur = _ensure_payment_status_row(user_id)
    if cur.get("paid"):
        return
    _supabase_patch(
        f"user_payment_status?user_id=eq.{_urlparse.quote(user_id)}",
        {
            "paid": True,
            "paid_amount_inr": amount_inr,
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "pricing_tier": tier_code,
        },
    )
    _award_referral_commission(user_id, amount_inr)
    _award_paid_completion_xp(user_id)


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


class PayoutRequestReq(BaseModel):
    amount_inr: int = Field(..., ge=500)
    payout_method: str = Field(..., pattern="^(upi|bank_transfer)$")
    details: dict  # {upi_id} OR {account_no, ifsc, account_name}


class AdminPayoutDecisionReq(BaseModel):
    admin_notes: Optional[str] = None
    txn_reference: Optional[str] = None


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
        # Server-side pricing — FE-supplied tier is validated against eligibility.
        tier_code, amount = _pricing_for_user(status_row)
        # If user explicitly asked for upfront but free session already used,
        # downgrade silently to post_trial (price changes).
        if req.pricing_tier != tier_code:
            # Allow only when user requests post_trial while upfront is offered
            # (i.e. they want to skip the discount). Otherwise force.
            if not (req.pricing_tier == "post_trial" and tier_code == "upfront"):
                pass  # ignore mismatch — server-side wins
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
        _mark_paid(user["id"], order["amount_inr"], order["pricing_tier"])
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
        _mark_paid(user["id"], order["amount_inr"], order["pricing_tier"])
        return {"ok": True, "paid": True, "razorpay_payment_id": mock_payment_id}

    # ---------------- WEBHOOK (no auth, signature-verified) ----------------
    @api_router.post("/payments/webhook")
    async def payments_webhook(request: Request):
        body = await request.body()
        signature = request.headers.get("x-razorpay-signature", "")
        secret = (os.environ.get("RAZORPAY_WEBHOOK_SECRET") or "").strip()
        if not secret:
            # In mock mode we accept anything (for testing) but still log.
            logger.info("[payments] webhook hit while RAZORPAY_WEBHOOK_SECRET unset")
        else:
            expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected, signature):
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
            _mark_paid(order["user_id"], order["amount_inr"], order["pricing_tier"])
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

    # ---------------- PAYOUTS — USER ----------------
    @api_router.post("/payouts/request")
    async def payouts_request(req: PayoutRequestReq,
                              user=Depends(_get_supabase_user)):
        # Validate the user has enough pending commission
        events = _supabase_get(
            f"referral_events?referrer_user_id=eq.{_urlparse.quote(user['id'])}"
            "&select=id,commission_amount,payout_status&order=created_at.asc"
        ) or []
        eligible = [e for e in events if (e.get("payout_status") or "pending") == "pending"]
        available = round(sum(float(e.get("commission_amount") or 0) for e in eligible), 2)
        if req.amount_inr > available:
            raise HTTPException(
                status_code=400,
                detail=f"requested ₹{req.amount_inr} but only ₹{available:.2f} pending",
            )
        # Validate the payout details payload
        if req.payout_method == "upi":
            upi = (req.details.get("upi_id") or "").strip()
            if "@" not in upi or len(upi) < 5:
                raise HTTPException(status_code=400, detail="invalid upi_id")
            details = {"upi_id": upi}
        else:
            acc = (req.details.get("account_no") or "").strip()
            ifsc = (req.details.get("ifsc") or "").strip().upper()
            holder = (req.details.get("account_name") or "").strip()
            import re as _re
            if not acc or len(acc) < 6:
                raise HTTPException(status_code=400, detail="invalid account_no")
            if not _re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", ifsc):
                raise HTTPException(status_code=400, detail="invalid IFSC")
            if not holder:
                raise HTTPException(status_code=400, detail="account_name required")
            details = {"account_no": acc, "ifsc": ifsc, "account_name": holder}
        # Lock referral_events: pick FIFO until we reach the requested amount
        covers = []
        running = 0.0
        for e in eligible:
            amt = float(e.get("commission_amount") or 0)
            if amt <= 0:
                continue
            covers.append(e["id"])
            running += amt
            if running >= req.amount_inr:
                break
        # Mark them as 'approved' (locked) — admin will mark them 'paid' on payout
        if covers:
            ids_csv = ",".join(covers)
            _supabase_patch(
                f"referral_events?id=in.({ids_csv})",
                {"payout_status": "approved"},
            )
        encrypted = encrypt_payout_details(details)
        created = _supabase_post(
            "payout_requests",
            {
                "user_id": user["id"],
                "amount_inr": req.amount_inr,
                "payout_method": req.payout_method,
                "payout_details_encrypted": encrypted,
                "status": "pending",
                "covers_event_ids": covers,
            },
            prefer="return=representation",
        )
        if isinstance(created, list):
            created = created[0]
        return {"ok": True, "request_id": created["id"], "status": "pending"}

    @api_router.get("/payouts/my-requests")
    async def payouts_my_requests(user=Depends(_get_supabase_user)):
        rows = _supabase_get(
            f"payout_requests?user_id=eq.{_urlparse.quote(user['id'])}"
            "&select=id,amount_inr,payout_method,status,admin_notes,txn_reference,"
            "requested_at,approved_at,paid_at,rejected_at"
            "&order=requested_at.desc&limit=50"
        ) or []
        return {"requests": rows}

    # ---------------- PAYOUTS — ADMIN ----------------
    @api_router.get("/admin/payouts/pending")
    async def admin_payouts_pending(user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            "payout_requests?status=in.(pending,approved)"
            "&select=*&order=requested_at.asc&limit=200"
        ) or []
        # Enrich with profiles
        ids = list({r["user_id"] for r in rows if r.get("user_id")})
        prof_by_id = {}
        if ids:
            id_list = ",".join(ids)
            profs = _supabase_get(
                f"profiles?id=in.({id_list})&select=id,full_name,email"
            ) or []
            prof_by_id = {p["id"]: p for p in profs}
        for r in rows:
            p = prof_by_id.get(r["user_id"], {})
            r["full_name"] = p.get("full_name") or ""
            r["email"] = p.get("email") or ""
            r.pop("payout_details_encrypted", None)  # NEVER expose unless asked
        return {"total": len(rows), "requests": rows}

    @api_router.get("/admin/payouts/recent")
    async def admin_payouts_recent(limit: int = 50, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        limit = max(1, min(200, int(limit or 50)))
        rows = _supabase_get(
            "payout_requests?status=in.(paid,rejected)"
            f"&select=*&order=requested_at.desc&limit={limit}"
        ) or []
        ids = list({r["user_id"] for r in rows if r.get("user_id")})
        prof_by_id = {}
        if ids:
            id_list = ",".join(ids)
            profs = _supabase_get(
                f"profiles?id=in.({id_list})&select=id,full_name,email"
            ) or []
            prof_by_id = {p["id"]: p for p in profs}
        for r in rows:
            p = prof_by_id.get(r["user_id"], {})
            r["full_name"] = p.get("full_name") or ""
            r["email"] = p.get("email") or ""
            r.pop("payout_details_encrypted", None)
        return {"total": len(rows), "requests": rows}

    @api_router.get("/admin/payouts/{request_id}/details")
    async def admin_payouts_details(request_id: str, user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            f"payout_requests?id=eq.{_urlparse.quote(request_id)}"
            "&select=*&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="not found")
        row = rows[0]
        try:
            decrypted = decrypt_payout_details(row["payout_details_encrypted"])
        except Exception as e:
            logger.warning(f"[payments] decrypt failed: {e}")
            decrypted = {"error": "decryption failed"}
        row.pop("payout_details_encrypted", None)
        row["decrypted_details"] = decrypted
        return row

    @api_router.post("/admin/payouts/{request_id}/approve")
    async def admin_payouts_approve(request_id: str,
                                    body: AdminPayoutDecisionReq = Body(default=AdminPayoutDecisionReq()),
                                    user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            f"payout_requests?id=eq.{_urlparse.quote(request_id)}&select=*&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="not found")
        if rows[0]["status"] != "pending":
            raise HTTPException(status_code=400, detail="not pending")
        _supabase_patch(
            f"payout_requests?id=eq.{_urlparse.quote(request_id)}",
            {"status": "approved",
             "approved_at": datetime.now(timezone.utc).isoformat(),
             "admin_notes": (body.admin_notes or rows[0].get("admin_notes"))},
        )
        return {"ok": True, "status": "approved"}

    @api_router.post("/admin/payouts/{request_id}/mark-paid")
    async def admin_payouts_mark_paid(request_id: str,
                                      body: AdminPayoutDecisionReq = Body(default=AdminPayoutDecisionReq()),
                                      user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        rows = _supabase_get(
            f"payout_requests?id=eq.{_urlparse.quote(request_id)}&select=*&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="not found")
        row = rows[0]
        if row["status"] not in ("pending", "approved"):
            raise HTTPException(status_code=400, detail="already paid/rejected")
        now_iso = datetime.now(timezone.utc).isoformat()
        _supabase_patch(
            f"payout_requests?id=eq.{_urlparse.quote(request_id)}",
            {"status": "paid", "paid_at": now_iso,
             "txn_reference": body.txn_reference or row.get("txn_reference"),
             "admin_notes": body.admin_notes or row.get("admin_notes")},
        )
        # Mark covered referral_events as paid
        covers = row.get("covers_event_ids") or []
        if covers:
            ids_csv = ",".join(covers)
            _supabase_patch(
                f"referral_events?id=in.({ids_csv})",
                {"payout_status": "paid", "paid_at": now_iso},
            )
        return {"ok": True, "status": "paid"}

    @api_router.post("/admin/payouts/{request_id}/reject")
    async def admin_payouts_reject(request_id: str,
                                   body: AdminPayoutDecisionReq = Body(...),
                                   user=Depends(_get_supabase_user)):
        _ensure_admin(user)
        if not (body.admin_notes or "").strip():
            raise HTTPException(status_code=400, detail="admin_notes required")
        rows = _supabase_get(
            f"payout_requests?id=eq.{_urlparse.quote(request_id)}&select=*&limit=1"
        ) or []
        if not rows:
            raise HTTPException(status_code=404, detail="not found")
        row = rows[0]
        if row["status"] not in ("pending", "approved"):
            raise HTTPException(status_code=400, detail="cannot reject")
        _supabase_patch(
            f"payout_requests?id=eq.{_urlparse.quote(request_id)}",
            {"status": "rejected",
             "rejected_at": datetime.now(timezone.utc).isoformat(),
             "admin_notes": body.admin_notes},
        )
        # Unlock the referral_events back to pending
        covers = row.get("covers_event_ids") or []
        if covers:
            ids_csv = ",".join(covers)
            _supabase_patch(
                f"referral_events?id=in.({ids_csv})",
                {"payout_status": "pending"},
            )
        return {"ok": True, "status": "rejected"}

    # ---------------- ADMIN — PAYMENTS OVERVIEW ----------------
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
