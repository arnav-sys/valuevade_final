from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
import uuid
import re
import string
import hashlib
import hmac
import time
import jwt
from datetime import datetime, timezone, timedelta
import random

# In-memory brute-force guard for legacy /admin/login
_login_attempts: dict[str, list] = {}

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Fail loudly with a clear message if MONGO_URL or DB_NAME are missing in the
# pod env. A bare KeyError here would crash the worker on import with a
# cryptic trace and the K8s liveness probe would just churn.
_mongo_url = os.environ.get('MONGO_URL')
_db_name = os.environ.get('DB_NAME')
if not _mongo_url:
    raise RuntimeError(
        "MONGO_URL is required but missing. Set it in the pod env "
        "(mongodb+srv://... for Atlas, mongodb://localhost:27017 for dev)."
    )
if not _db_name:
    raise RuntimeError("DB_NAME is required but missing.")
mongo_url = _mongo_url
client = AsyncIOMotorClient(mongo_url)
db = client[_db_name]

ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET')

app = FastAPI(
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


@app.get("/health")
async def _root_health_liveness():
    """Root-level (non-/api) liveness probe for the platform's pod-level
    health check, which hits the container directly and does not go
    through the /api ingress prefix. Mirrors /api/health."""
    return {"status": "ok"}


def generate_referral_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def create_token(email: str):
    return jwt.encode({"email": email, "iat": int(datetime.now(timezone.utc).timestamp())}, ADMIN_SECRET, algorithm="HS256")


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, ADMIN_SECRET, algorithms=["HS256"])
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


class WaitlistCreate(BaseModel):
    first_name: str
    email: str
    ref_code: Optional[str] = None

    @field_validator('email')
    @classmethod
    def validate_email_format(cls, v):
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', v):
            raise ValueError('Invalid email format')
        return v


class WaitlistResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    first_name: str
    email: str
    position: int
    timestamp: str
    referral_code: str
    referral_count: int


class AdminLogin(BaseModel):
    email: str
    password: str


@api_router.get("/")
async def root():
    return {"message": "Valuevade API"}


@api_router.get("/health")
async def health_liveness():
    """Lightweight liveness probe. Intentionally does NOT touch Mongo or
    Supabase, a slow upstream must not fail the pod's liveness check.
    Use the read-model endpoints (/api/health/xp, /api/health/badges, etc.)
    when you actually need to validate downstream state."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Gamification (XP), read-only debug endpoint for the testing agent.
# Uses the Supabase service-role key against the PostgREST API to bypass RLS,
# returning a one-shot integrity snapshot of the user's XP state.
# ---------------------------------------------------------------------------
import urllib.request as _urlreq
import urllib.error as _urlerr
import urllib.parse as _urlparse
import json as _json

_SUPABASE_REST = os.environ.get("REACT_APP_SUPABASE_URL") or "https://yuadeybycbfqlkdpxbkv.supabase.co"
_SUPABASE_SR = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


def _supabase_get(path: str):
    """Minimal GET helper against PostgREST using the service-role key."""
    if not _SUPABASE_SR:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY missing on server")
    url = f"{_SUPABASE_REST}/rest/v1/{path}"
    req = _urlreq.Request(
        url,
        headers={
            "apikey": _SUPABASE_SR,
            "Authorization": f"Bearer {_SUPABASE_SR}",
            "Accept": "application/json",
        },
    )
    try:
        with _urlreq.urlopen(req, timeout=15) as r:
            return _json.loads(r.read().decode("utf-8"))
    except _urlerr.HTTPError as e:
        raise HTTPException(status_code=e.code, detail=e.read().decode("utf-8"))


def _supabase_post(path: str, body: dict, *, prefer: Optional[str] = None):
    """POST helper against PostgREST / RPC using the service-role key."""
    if not _SUPABASE_SR:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY missing on server")
    url = f"{_SUPABASE_REST}/rest/v1/{path}"
    headers = {
        "apikey": _SUPABASE_SR,
        "Authorization": f"Bearer {_SUPABASE_SR}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = _json.dumps(body).encode("utf-8")
    req = _urlreq.Request(url, data=data, headers=headers, method="POST")
    try:
        with _urlreq.urlopen(req, timeout=20) as r:
            txt = r.read().decode("utf-8")
            return _json.loads(txt) if txt else None
    except _urlerr.HTTPError as e:
        raise HTTPException(status_code=e.code, detail=e.read().decode("utf-8"))


def _supabase_patch(path: str, body: dict):
    """PATCH helper for updating PostgREST rows by query filter."""
    if not _SUPABASE_SR:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY missing on server")
    url = f"{_SUPABASE_REST}/rest/v1/{path}"
    data = _json.dumps(body).encode("utf-8")
    req = _urlreq.Request(url, data=data, method="PATCH", headers={
        "apikey": _SUPABASE_SR,
        "Authorization": f"Bearer {_SUPABASE_SR}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    })
    try:
        with _urlreq.urlopen(req, timeout=15) as r:
            txt = r.read().decode("utf-8")
            return _json.loads(txt) if txt else None
    except _urlerr.HTTPError as e:
        raise HTTPException(status_code=e.code, detail=e.read().decode("utf-8"))


def _supabase_delete(path: str):
    """DELETE helper for removing PostgREST rows by query filter. Used by
    Phase D2's `/study-plan/rebalance` to clear future day rows before
    re-inserting the recomputed schedule."""
    if not _SUPABASE_SR:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY missing on server")
    url = f"{_SUPABASE_REST}/rest/v1/{path}"
    req = _urlreq.Request(url, method="DELETE", headers={
        "apikey": _SUPABASE_SR,
        "Authorization": f"Bearer {_SUPABASE_SR}",
        "Prefer": "return=representation",
    })
    try:
        with _urlreq.urlopen(req, timeout=15) as r:
            txt = r.read().decode("utf-8")
            return _json.loads(txt) if txt else []
    except _urlerr.HTTPError as e:
        raise HTTPException(status_code=e.code, detail=e.read().decode("utf-8"))


def _supabase_auth_user(access_token: str) -> Optional[dict]:
    """Resolve a Supabase access token to a user dict via Supabase Auth's
    /auth/v1/user endpoint. We use the user's token (NOT the service role) so
    Supabase validates the JWT signature, expiry and aud claim for us, no
    local key wrangling required. Returns None on any failure (caller maps
    to 401)."""
    if not access_token:
        return None
    url = f"{_SUPABASE_REST}/auth/v1/user"
    req = _urlreq.Request(url, headers={
        "apikey": _SUPABASE_SR or "",
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    })
    try:
        with _urlreq.urlopen(req, timeout=8) as r:
            return _json.loads(r.read().decode("utf-8"))
    except (_urlerr.HTTPError, _urlerr.URLError, ValueError):
        return None


def get_supabase_user(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency, extracts the authenticated Supabase user from the
    `Authorization: Bearer <jwt>` header. Raises 401 if the token is missing
    or invalid. Returned dict has at minimum {id, email}."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    user = _supabase_auth_user(token)
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="invalid or expired token")
    return user


# Admin emails that may query any user's diagnostic data
_ADMIN_EMAILS_SERVER: frozenset = frozenset(filter(None, [
    (os.environ.get("ADMIN_EMAIL") or "").lower(),
    "info@valuevade.com",
]))


def _caller_may_read_user(caller: dict, target_user_id: str) -> bool:
    """True if caller is an admin OR is querying their own user_id."""
    if caller.get("id") == target_user_id:
        return True
    return (caller.get("email") or "").lower() in _ADMIN_EMAILS_SERVER


# ──────────────────────────────────────────────────────────────────────
# Per-user LLM limits (Feb 2026)
#
# Two hard limits enforced across every user:
#   (a) `/customize/generate`  → max 4 generations lifetime.
#   (b) All Pari LLM calls     → cumulative INR cost capped at ₹500.
#
# The counters live in `public.profiles` (see migration 0036_llm_limits.sql).
# If the migration hasn't been applied yet, the helpers degrade gracefully:
# they log a warning and treat the user as under-limit so we never lock a
# healthy production user out because of a missing column.
# ──────────────────────────────────────────────────────────────────────

CUSTOMIZE_GENERATION_LIMIT = 4
PARI_COST_LIMIT_INR = 500.0

# Claude Haiku 4.5 pricing (per 1M tokens) → INR (assume USD→INR ~85).
# input: $1.00/M ; output: $5.00/M
_INR_PER_INPUT_TOKEN  = (1.0 / 1_000_000.0) * 85.0
_INR_PER_OUTPUT_TOKEN = (5.0 / 1_000_000.0) * 85.0


def _estimate_llm_cost_inr(input_tokens: int, output_tokens: int) -> float:
    """Convert Claude Haiku token counts to INR."""
    inp = max(0, int(input_tokens or 0))
    out = max(0, int(output_tokens or 0))
    return round(inp * _INR_PER_INPUT_TOKEN + out * _INR_PER_OUTPUT_TOKEN, 4)


def _profile_snapshot(user_id: str) -> dict:
    """Fetch just the LLM-limit columns from profiles. Returns an empty dict
    on any error (missing table/columns → treat as fresh account)."""
    try:
        rows = _supabase_get(
            f"profiles?id=eq.{_urlparse.quote(user_id)}"
            "&select=customize_generations_count,pari_total_cost_inr&limit=1"
        ) or []
        return rows[0] if rows else {}
    except HTTPException as e:
        # 42703 undefined_column (migration 0036 not applied yet), degrade.
        if e.status_code in (400, 404):
            logger.warning(f"[llm-limits] profile snapshot degraded: {e.detail}")
            return {}
        raise


def _pari_is_over_budget(user_id: str) -> tuple[bool, float]:
    snap = _profile_snapshot(user_id)
    total = float(snap.get("pari_total_cost_inr") or 0.0)
    return (total >= PARI_COST_LIMIT_INR, total)


def _bump_pari_cost(user_id: str, cost_inr: float) -> None:
    """Atomically add `cost_inr` to profiles.pari_total_cost_inr via RPC.
    Fire-and-forget: failures are logged, never raised, so an LLM answer is
    never blocked by an accounting hiccup."""
    if not user_id or cost_inr <= 0:
        return
    try:
        _supabase_post(
            "rpc/add_pari_cost",
            {"p_user_id": user_id, "p_cost_inr": round(cost_inr, 4)},
        )
    except Exception as e:
        logger.warning(f"[llm-limits] bump_pari_cost failed for {user_id}: {e}")


def _bump_customize_generations(user_id: str) -> int:
    """Atomically +1 customize_generations_count. Returns the new count, or
    0 on any error (so the FE doesn't lock the user out if the RPC is
    unavailable)."""
    if not user_id:
        return 0
    try:
        payload = _supabase_post(
            "rpc/increment_customize_generations", {"p_user_id": user_id}
        )
        if isinstance(payload, int):
            return payload
        if isinstance(payload, dict):
            return int(payload.get("count") or 0)
        return 0
    except Exception as e:
        logger.warning(f"[llm-limits] increment_customize_generations failed: {e}")
        return 0




@api_router.get("/pari/status")
async def pari_status(supa_user: dict = Depends(get_supabase_user)):
    """Return current LLM-limit state for the authenticated user.
    Used by the FE to show usage meters + gate the Pari widget."""
    user_id = supa_user.get("id")
    snap = _profile_snapshot(user_id)
    cost = float(snap.get("pari_total_cost_inr") or 0.0)
    gens = int(snap.get("customize_generations_count") or 0)
    return {
        "pari": {
            "total_cost_inr": round(cost, 2),
            "limit_inr": PARI_COST_LIMIT_INR,
            "over_budget": cost >= PARI_COST_LIMIT_INR,
            "remaining_inr": max(0.0, round(PARI_COST_LIMIT_INR - cost, 2)),
        },
        "customize": {
            "generations_used": gens,
            "generations_limit": CUSTOMIZE_GENERATION_LIMIT,
            "generations_remaining": max(0, CUSTOMIZE_GENERATION_LIMIT - gens),
            "exhausted": gens >= CUSTOMIZE_GENERATION_LIMIT,
        },
    }




@api_router.get("/health/xp")
async def health_xp(user_id: str, caller: dict = Depends(get_supabase_user)):
    if not _caller_may_read_user(caller, user_id):
        raise HTTPException(status_code=403, detail="Cannot read another user's data")
    """Return the XP state for the given user_id and report whether the
    derived numbers (level, summed ledger XP) match user_stats."""
    try:
        # Defensive UUID validation so we don't shovel garbage at PostgREST.
        uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="user_id must be a uuid")

    stats_rows = _supabase_get(
        f"user_stats?user_id=eq.{_urlparse.quote(user_id)}&select=total_xp,current_level,current_streak_days,longest_streak_days,streak_freeze_tokens,daily_goal_minutes,last_login_at_ist"
    )
    events = _supabase_get(
        f"user_xp_events?user_id=eq.{_urlparse.quote(user_id)}&select=amount,reason&order=created_at.desc"
    )
    levels = _supabase_get("master_levels?select=level_number,xp_threshold,name&order=level_number")

    stats = (stats_rows or [None])[0]
    summed = sum(int(e.get("amount") or 0) for e in (events or []))
    events_count = len(events or [])

    # Derive expected level from summed XP using master_levels thresholds.
    expected_level = 1
    for L in levels or []:
        if summed >= int(L.get("xp_threshold") or 0):
            expected_level = int(L.get("level_number") or 1)

    total_xp = int((stats or {}).get("total_xp") or 0)
    current_level = int((stats or {}).get("current_level") or 1)
    matches = (stats is not None) and (total_xp == summed) and (current_level == expected_level)

    return {
        "user_id": user_id,
        "user_stats_row_exists": stats is not None,
        "total_xp": total_xp,
        "current_level": current_level,
        "events_count": events_count,
        "summed_xp_from_events": summed,
        "expected_level_from_sum": expected_level,
        "matches": matches,
        "stats": stats,
        "ledger_breakdown": _ledger_breakdown(events or []),
    }


def _ledger_breakdown(events):
    counts = {}
    sums = {}
    for e in events:
        r = e.get("reason") or "?"
        counts[r] = counts.get(r, 0) + 1
        sums[r] = sums.get(r, 0) + int(e.get("amount") or 0)
    return {r: {"count": counts[r], "xp": sums[r]} for r in counts}


@api_router.get("/health/streak")
async def health_streak(user_id: str, caller: dict = Depends(get_supabase_user)):
    if not _caller_may_read_user(caller, user_id):
        raise HTTPException(status_code=403, detail="Cannot read another user's data")
    """Return the streak state for the given user_id and the last 5 streak events.
    Read-only; uses service-role to bypass RLS so the tester can verify state."""
    try:
        uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="user_id must be a uuid")

    stats_rows = _supabase_get(
        f"user_stats?user_id=eq.{_urlparse.quote(user_id)}&select=current_streak_days,longest_streak_days,streak_freeze_tokens,last_streak_freeze_earned_at,auto_spend_freeze,last_streak_break_at,last_streak_break_lost_days,daily_goal_minutes,daily_goal_modal_dismissed"
    )
    events = _supabase_get(
        f"user_streak_events?user_id=eq.{_urlparse.quote(user_id)}&select=event_type,streak_days_at_event,freeze_tokens_at_event,meta,created_at&order=created_at.desc&limit=5"
    )
    stats = (stats_rows or [None])[0]

    return {
        "user_id": user_id,
        "user_stats_row_exists": stats is not None,
        "current_streak_days": (stats or {}).get("current_streak_days", 0),
        "longest_streak_days": (stats or {}).get("longest_streak_days", 0),
        "freeze_tokens": (stats or {}).get("streak_freeze_tokens", 0),
        "auto_spend_freeze": (stats or {}).get("auto_spend_freeze", True),
        "daily_goal_minutes": (stats or {}).get("daily_goal_minutes"),
        "last_streak_break_at": (stats or {}).get("last_streak_break_at"),
        "last_streak_break_lost_days": (stats or {}).get("last_streak_break_lost_days", 0),
        "last_streak_event": (events or [None])[0],
        "recent_streak_events": events or [],
        "stats": stats,
    }


@api_router.get("/health/badges")
async def health_badges(user_id: str, caller: dict = Depends(get_supabase_user)):
    if not _caller_may_read_user(caller, user_id):
        raise HTTPException(status_code=403, detail="Cannot read another user's data")
    """Return badge engine state for the given user_id.
    Includes: total master badges, unlocked count by rarity/category, near-miss
    candidates (progress >= 50%), p3_catchup_done flag, and the 10 most-recently
    earned badges. Read-only; uses service-role to bypass RLS so the tester /
    main agent can verify state without auth context."""
    try:
        uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="user_id must be a uuid")

    masters = _supabase_get(
        "master_badges?select=id,code,name,category,rarity,is_secret,progress_target,display_order&order=display_order"
    ) or []
    user_rows = _supabase_get(
        f"user_badges?user_id=eq.{_urlparse.quote(user_id)}&select=badge_id,progress_current,progress_target,is_unlocked,earned_at"
    ) or []
    stats_rows = _supabase_get(
        f"user_stats?user_id=eq.{_urlparse.quote(user_id)}&select=p3_catchup_done,total_xp,current_level"
    ) or []
    stats = (stats_rows or [None])[0]

    by_user = {r["badge_id"]: r for r in user_rows}

    unlocked = []
    near_miss = []
    by_rarity = {"common": 0, "rare": 0, "epic": 0, "legendary": 0}
    by_category = {}
    for m in masters:
        ub = by_user.get(m["id"]) or {}
        # "Unlocked" is the AND of both columns: is_unlocked AND earned_at.
        # Either alone is a drift signal, Phase 45 fix-pass added a backfill
        # migration (0006) to make these move together always.
        is_unlocked = bool(ub.get("is_unlocked")) and ub.get("earned_at") is not None
        target = ub.get("progress_target") or m.get("progress_target") or 1
        current = ub.get("progress_current") or 0
        pct = (current / target * 100.0) if target > 0 else 0.0
        if is_unlocked:
            by_rarity[m["rarity"]] = by_rarity.get(m["rarity"], 0) + 1
            by_category[m["category"]] = by_category.get(m["category"], 0) + 1
            unlocked.append({
                "code": m["code"],
                "name": m["name"],
                "rarity": m["rarity"],
                "category": m["category"],
                "earned_at": ub.get("earned_at"),
            })
        elif not m.get("is_secret") and pct >= 50.0 and current < target:
            near_miss.append({
                "code": m["code"],
                "name": m["name"],
                "rarity": m["rarity"],
                "category": m["category"],
                "progress_current": current,
                "progress_target": target,
                "progress_pct": round(pct, 1),
            })

    unlocked.sort(key=lambda r: (r["earned_at"] or ""), reverse=True)
    near_miss.sort(key=lambda r: r["progress_pct"], reverse=True)

    return {
        "user_id": user_id,
        "user_stats_row_exists": stats is not None,
        "p3_catchup_done": (stats or {}).get("p3_catchup_done", False),
        "total_xp": (stats or {}).get("total_xp", 0),
        "current_level": (stats or {}).get("current_level", 1),
        "master_badges_total": len(masters),
        "unlocked_total": len(unlocked),
        "unlocked_by_rarity": by_rarity,
        "unlocked_by_category": by_category,
        "near_miss_count": len(near_miss),
        "near_miss_top5": near_miss[:5],
        "recent_unlocked_top10": unlocked[:10],
    }


@api_router.get("/health/challenges")
async def health_challenges(user_id: str, caller: dict = Depends(get_supabase_user)):
    if not _caller_may_read_user(caller, user_id):
        raise HTTPException(status_code=403, detail="Cannot read another user's data")
    """Return today's daily-challenge state for the given user_id (Asia/Kolkata
    date), plus the all-time count of IST days where all 3 challenges were
    completed (daily_champion_streak). Read-only via service-role."""
    try:
        uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="user_id must be a uuid")

    # Compute today's IST date the same way Postgres does in the RPC.
    now_utc = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    today_ist = (now_utc + ist_offset).date().isoformat()

    user_id_q = _urlparse.quote(user_id)
    # Today's challenges joined with master metadata.
    today_rows = _supabase_get(
        f"user_daily_challenges?user_id=eq.{user_id_q}"
        f"&challenge_date=eq.{today_ist}"
        f"&select=id,challenge_id,progress_current,target_value,is_completed,completed_at,"
        f"master_daily_challenges(code,title,description,challenge_type,xp_reward)"
    ) or []
    # All-time per-day completed counts (for daily_champion_streak).
    history_rows = _supabase_get(
        f"user_daily_challenges?user_id=eq.{user_id_q}&is_completed=eq.true"
        f"&select=challenge_date"
    ) or []
    # Glow window from user_stats.
    stats_rows = _supabase_get(
        f"user_stats?user_id=eq.{user_id_q}&select=daily_champion_glow_until,total_xp,current_level,p3_catchup_done"
    ) or []
    stats = (stats_rows or [None])[0] or {}

    challenges = []
    for r in today_rows:
        mdc = r.get("master_daily_challenges") or {}
        challenges.append({
            "code": mdc.get("code"),
            "title": mdc.get("title"),
            "description": mdc.get("description"),
            "challenge_type": mdc.get("challenge_type"),
            "progress_current": r.get("progress_current") or 0,
            "target_value": r.get("target_value") or 0,
            "is_completed": bool(r.get("is_completed")),
            "completed_at": r.get("completed_at"),
            "xp_reward": mdc.get("xp_reward") or 0,
        })

    # Count days where the user had >= 3 completed challenges.
    by_date = {}
    for r in history_rows:
        d = r.get("challenge_date")
        if d:
            by_date[d] = by_date.get(d, 0) + 1
    champion_days = sorted([d for d, n in by_date.items() if n >= 3], reverse=True)

    # Consecutive-day streak ending today_ist (or yesterday for tolerance).
    streak = 0
    if champion_days:
        cursor = datetime.fromisoformat(today_ist).date()
        for _ in range(len(champion_days)):
            if cursor.isoformat() in champion_days:
                streak += 1
                cursor = cursor - timedelta(days=1)
            else:
                # Allow today to be unfinished, anchor streak from yesterday.
                if streak == 0 and cursor.isoformat() == today_ist:
                    cursor = cursor - timedelta(days=1)
                    continue
                break

    all_complete = (len(challenges) >= 3) and all(c["is_completed"] for c in challenges)
    glow_until = stats.get("daily_champion_glow_until")
    glow_active = False
    if glow_until:
        try:
            glow_dt = datetime.fromisoformat(glow_until.replace("Z", "+00:00"))
            glow_active = glow_dt > now_utc
        except ValueError:
            glow_active = False

    return {
        "user_id": user_id,
        "today_ist": today_ist,
        "challenges": challenges,
        "all_complete": all_complete,
        "completed_count": sum(1 for c in challenges if c["is_completed"]),
        "daily_champion_glow_until": glow_until,
        "daily_champion_glow_active": glow_active,
        "daily_champion_days_total": len(champion_days),
        "daily_champion_streak": streak,
        "user_stats": {
            "total_xp": stats.get("total_xp", 0),
            "current_level": stats.get("current_level", 1),
            "p3_catchup_done": stats.get("p3_catchup_done", False),
        },
    }


@api_router.get("/health/journey")
async def health_journey(user_id: str, caller: dict = Depends(get_supabase_user)):
    if not _caller_may_read_user(caller, user_id):
        raise HTTPException(status_code=403, detail="Cannot read another user's data")
    """Return the user's full learning-journey snapshot for the
    ModuleConstellationMap + ActivityHeatmap + next-milestone widgets.
    Service-role-backed read."""
    try:
        uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="user_id must be a uuid")

    user_id_q = _urlparse.quote(user_id)
    # Modules: read via the v_module_progress_summary view (RLS bypassed by service role).
    modules_rows = _supabase_get(
        f"v_module_progress_summary?user_id=eq.{user_id_q}"
        f"&select=user_module_id,order_index,module_code,module_title,is_completed,is_unlocked,"
        f"sessions_total,sessions_completed_n,completion_percent,last_activity_at,"
        f"time_spent_minutes,xp_earned_in_module&order=order_index"
    ) or []

    # Heatmap: last 90 days of user_daily_activity.
    now_utc = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    today_ist = (now_utc + ist_offset).date()
    since = (today_ist - timedelta(days=89)).isoformat()
    heatmap_rows = _supabase_get(
        f"user_daily_activity?user_id=eq.{user_id_q}"
        f"&activity_date=gte.{since}"
        f"&select=activity_date,xp_earned,sessions_completed,minutes_spent"
        f"&order=activity_date"
    ) or []

    # Stats for next-milestone calc.
    stats_rows = _supabase_get(
        f"user_stats?user_id=eq.{user_id_q}&select=total_xp,current_level,current_streak_days,longest_streak_days"
    ) or []
    stats = (stats_rows or [None])[0] or {}

    # Next milestone heuristic, pick the smallest absolute delta.
    LEVEL_NAMES = ['Trainee','Equity Apprentice','Equity Analyst','Senior Analyst','Associate','VP','Director','MD','Partner','CIO']
    LEVEL_THRESHOLDS = [0, 250, 600, 1200, 2000, 3200, 5000, 7500, 11000, 16000]
    next_milestone = None
    candidates = []
    cur_level = stats.get("current_level") or 1
    idx = max(0, min(len(LEVEL_THRESHOLDS) - 1, cur_level - 1))
    if idx < len(LEVEL_THRESHOLDS) - 1:
        next_thresh = LEVEL_THRESHOLDS[idx + 1]
        xp_to = max(0, next_thresh - (stats.get("total_xp") or 0))
        if xp_to > 0:
            candidates.append({"type": "level", "label": f"{xp_to} XP to {LEVEL_NAMES[idx + 1]}",
                                "delta": xp_to, "target": next_thresh})
    streak = stats.get("current_streak_days") or 0
    for m in (3, 7, 14, 30, 60, 100):
        if m > streak:
            d = m - streak
            unit = "day" if d == 1 else "days"
            candidates.append({"type": "streak",
                                "label": f"{d} {unit} to {m}-day streak",
                                "delta": d * 100,
                                "target": m})
            break
    if candidates:
        candidates.sort(key=lambda c: c["delta"])
        next_milestone = candidates[0]

    return {
        "user_id": user_id,
        "today_ist": today_ist.isoformat(),
        "modules": [{
            "user_module_id": m["user_module_id"],
            "order_index": m["order_index"],
            "code": m["module_code"],
            "title": m["module_title"],
            "is_completed": bool(m["is_completed"]),
            "is_unlocked": bool(m["is_unlocked"]),
            "sessions_total": m["sessions_total"] or 0,
            "sessions_completed_n": m["sessions_completed_n"] or 0,
            "completion_percent": m["completion_percent"] or 0,
            "last_activity_at": m["last_activity_at"],
            "time_spent_minutes": m["time_spent_minutes"] or 0,
            "xp_earned_in_module": m["xp_earned_in_module"] or 0,
        } for m in modules_rows],
        "heatmap": [{
            "date_ist": r["activity_date"],
            "xp_earned": r["xp_earned"] or 0,
            "sessions_completed": r["sessions_completed"] or 0,
            "minutes_spent": r["minutes_spent"] or 0,
        } for r in heatmap_rows],
        "next_milestone": next_milestone,
    }



# =============================================================================
# Doubts session (Phase 52), student Q&A with Pari
# =============================================================================
# Hard cost rails (locked):
#   - 5 doubt sessions per user per IST day
#   - 3 turns per session
#   - 1500 tokens budget per session (cumulative)
#   - 2 off-topic strikes ends the session
#   - FAQ cache: identical normalised question + module scope → cached answer


# ─── Pari doubt endpoints extracted to doubt_endpoints.py ─────────────────────
# Registered via register_doubt_endpoints() at the bottom of this file.

# Small helpers also used by other routes that stay in server.py
import re as _re

COUNTRY_CONTEXT = {
    'IN': "Indian markets (NSE/BSE, SEBI, INR). Use Indian context: Reliance, TCS, HDFC, Infosys, ICICI.",
    'US': "US markets (NYSE/NASDAQ, SEC, USD). Use US context: Apple, Microsoft, JPMorgan, Amazon, Tesla.",
    'GB': "UK markets (LSE, FCA, GBP). Use UK context: HSBC, Shell, BP, Lloyds, Unilever.",
    'SG': "Singapore markets (SGX, MAS, SGD). Use Singapore + ASEAN context: DBS, Singtel, OCBC, CapitaLand.",
    'AE': "UAE markets (DFM/ADX, SCA, AED). Use UAE + GCC context: Emaar, Etisalat, FAB, ADNOC.",
    'OTHER': "Global markets, use globally recognizable companies (Apple, Toyota, HSBC, Samsung, Nestlé).",
}


def _country_context_for(country_code):
    code = (country_code or "IN").upper()
    return COUNTRY_CONTEXT.get(code, COUNTRY_CONTEXT["IN"])


def _approx_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, (len(text) + 3) // 4)



# =============================================================================
# Pari Welcome + Country (Phase 54 P1 + P7a)
# =============================================================================

class CountryUpdateReq(BaseModel):
    country_code: str


@api_router.get("/me/pari_welcome")
async def pari_welcome_get(supa_user: dict = Depends(get_supabase_user)):
    """Return whether the welcome modal should display for the current user."""
    user_id = supa_user.get("id")
    rows = _supabase_get(
        f"profiles?id=eq.{_urlparse.quote(user_id)}"
        f"&select=pari_welcomed_at,country_code&limit=1"
    ) or []
    p = (rows or [{}])[0]
    return {
        "should_show_welcome": not bool(p.get("pari_welcomed_at")),
        "pari_welcomed_at": p.get("pari_welcomed_at"),
        "country_code": p.get("country_code"),
    }


@api_router.post("/me/pari_welcome/ack")
async def pari_welcome_ack(supa_user: dict = Depends(get_supabase_user)):
    """Mark Pari's welcome as acknowledged for the current user."""
    user_id = supa_user.get("id")
    now_iso = datetime.now(timezone.utc).isoformat()
    _supabase_patch(
        f"profiles?id=eq.{_urlparse.quote(user_id)}",
        {"pari_welcomed_at": now_iso},
    )
    return {"ok": True, "pari_welcomed_at": now_iso}


@api_router.post("/me/country")
async def update_country(req: CountryUpdateReq, supa_user: dict = Depends(get_supabase_user)):
    """Update profiles.country_code (ISO-2: IN, US, GB, SG, AE, ...)."""
    user_id = supa_user.get("id")
    code = (req.country_code or "").upper().strip()[:2]
    if not _re.fullmatch(r"[A-Z]{2}", code):
        raise HTTPException(status_code=400, detail="invalid country code (expected ISO-2)")
    _supabase_patch(
        f"profiles?id=eq.{_urlparse.quote(user_id)}",
        {"country_code": code},
    )
    return {"ok": True, "country_code": code}


@api_router.post("/me/send-welcome-email")
async def send_welcome_email(supa_user: dict = Depends(get_supabase_user)):
    """Send a one-time welcome email to a newly signed-up user via Resend.
    Best-effort: if RESEND_API_KEY is unset the call is a no-op (no error).
    Called once from SignupPage.jsx immediately after successful signUp.
    Idempotent, if called again for the same user it just resends (acceptable
    since the frontend only fires it once per session)."""
    user_id = supa_user.get("id")
    api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if not api_key:
        logger.info("[auth] RESEND_API_KEY not set, skipping welcome email")
        return {"ok": True, "skipped": True}
    try:
        profs = _supabase_get(
            f"profiles?id=eq.{_urlparse.quote(user_id)}&select=email,full_name&limit=1"
        ) or []
        if not profs or not profs[0].get("email"):
            return {"ok": True, "skipped": True}
        email = profs[0]["email"]
        first_name = (profs[0].get("full_name") or "").split()[0] or "there"
        import resend as _resend
        _resend.api_key = api_key
        sender = (os.environ.get("SENDER_EMAIL") or "onboarding@resend.dev").strip()
        frontend_url = (os.environ.get("FRONTEND_URL") or "https://valuevade.com").rstrip("/")
        free_session_url = f"{frontend_url}/courses"
        _resend.Emails.send({
            "from": f"Valuevade <{sender}>",
            "to": [email],
            "subject": "You're in, your first session is free",
            "html": _welcome_email_html(first_name, free_session_url),
        })
        logger.info(f"[auth] welcome email sent to {email}")
        return {"ok": True}
    except Exception as e:
        logger.warning(f"[auth] welcome email failed for user {user_id}: {e}")
        return {"ok": True, "skipped": True}


def _welcome_email_html(first_name: str, courses_url: str) -> str:
    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0e0e16;color:#f4f4f8;">
      <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8b8b9e;margin:0 0 20px;">Valuevade · Welcome</p>
      <h1 style="font-size:22px;margin:0 0 12px;color:#ffffff;">Hey {first_name}, welcome.</h1>
      <p style="font-size:15px;line-height:1.7;color:#c9c9d6;margin:0 0 24px;">
        Your account is live. Your first session is completely free, no card, no commitment.
        Just open it and see if the course is right for you.
      </p>
      <a href="{courses_url}" style="display:inline-block;background:#246bfd;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.5px;padding:14px 28px;border-radius:4px;">
        Start your free session &rarr;
      </a>
      <p style="font-size:13px;line-height:1.6;color:#8b8b9e;margin:28px 0 0;">
        The course covers equity research, financial modelling, and valuation, built specifically for
        Indian finance students. ₹4999 lifetime access after the free trial.
      </p>
      <p style="font-size:12px;color:#6b6b7e;margin-top:32px;">
        Valuevade · If you did not sign up, you can safely ignore this email.
      </p>
    </div>
    """


# Daily Finance News feature removed (2026-07-10), endpoints /api/news/today
# and /api/news/mark_read no longer exist. See DashboardPage.jsx for FE cleanup.


# ── Course Catalog ────────────────────────────────────────────────────────────
@api_router.get("/courses/catalog")
async def get_courses_catalog():
    """Public endpoint, returns master_paths + module/session counts in one
    fast server-side call so CoursesPage.jsx never needs to hit Supabase directly.
    No auth required (catalog is public)."""
    paths = _supabase_get("master_paths?is_active=eq.true&order=created_at") or []
    modules = _supabase_get("master_modules?select=id,path_id") or []
    sessions = _supabase_get("master_sessions?select=id,module_id") or []

    module_to_path = {m["id"]: m["path_id"] for m in modules}
    mod_counts: dict = {}
    ses_counts: dict = {}
    for m in modules:
        mod_counts[m["path_id"]] = mod_counts.get(m["path_id"], 0) + 1
    for s in sessions:
        pid = module_to_path.get(s["module_id"])
        if pid:
            ses_counts[pid] = ses_counts.get(pid, 0) + 1

    return {
        "paths": paths,
        "module_counts": mod_counts,
        "session_counts": ses_counts,
    }




# =============================================================================
# Portfolio (Phase 53), aggregated showcase + public share slug
# =============================================================================

import secrets as _secrets


_PORTFOLIO_VIEW_FIELDS = (
    "user_id,full_name,email,avatar_url,member_since,portfolio_public,"
    "portfolio_share_slug,total_xp,current_level,level_name,level_icon_slug,"
    "level_color_hex,next_level_threshold,next_level_name,xp_to_next,"
    "current_streak_days,longest_streak_days,streak_freeze_tokens,"
    "daily_champion_days_total,modules_completed,modules_in_progress,"
    "modules_enrolled,total_xp_in_modules,total_time_minutes,sessions_completed,"
    "sessions_total,avg_quiz_score,avg_interview_score,avg_simulation_score,"
    "module_projects_completed,last_module_project_at,capstone_completed,"
    "capstone_completed_at,capstone_started_at,badges_total,badges_common,"
    "badges_rare,badges_epic,badges_legendary,recent_badges,skills_earned,"
    "modules,active_days_last_90,heatmap_90"
)


def _redact_public_portfolio(row: dict) -> dict:
    """Strip anything that shouldn't be exposed on the public /p/<slug> URL.
    Keeps the showcase-worthy bits; drops email, freeze tokens, exact
    xp_to_next, sensitive cohort signals."""
    if not row:
        return row
    # Member-since → month/year string only (e.g. "May 2026").
    member_since = row.get("member_since")
    member_since_ym = None
    if member_since:
        try:
            dt = datetime.fromisoformat(member_since.replace("Z", "+00:00"))
            member_since_ym = dt.strftime("%B %Y")
        except (ValueError, TypeError):
            member_since_ym = None
    return {
        "full_name": row.get("full_name") or "Valuevade Analyst",
        "avatar_url": row.get("avatar_url"),
        "member_since_ym": member_since_ym,
        # Level
        "total_xp": row.get("total_xp") or 0,
        "current_level": row.get("current_level") or 1,
        "level_name": row.get("level_name"),
        "level_icon_slug": row.get("level_icon_slug"),
        "level_color_hex": row.get("level_color_hex"),
        # Streak
        "current_streak_days": row.get("current_streak_days") or 0,
        "longest_streak_days": row.get("longest_streak_days") or 0,
        # Daily Champion
        "daily_champion_days_total": row.get("daily_champion_days_total") or 0,
        # Modules
        "modules_completed": row.get("modules_completed") or 0,
        "modules_enrolled": row.get("modules_enrolled") or 0,
        "total_time_minutes": row.get("total_time_minutes") or 0,
        # Sessions (just completion count; no avg scores)
        "sessions_completed": row.get("sessions_completed") or 0,
        # Projects
        "module_projects_completed": row.get("module_projects_completed") or 0,
        "capstone_completed": bool(row.get("capstone_completed")),
        "capstone_completed_at": row.get("capstone_completed_at"),
        # Badges (totals only; recent_badges already lists code/name which is
        # fine to expose since badges are public concepts).
        "badges_total": row.get("badges_total") or 0,
        "badges_common": row.get("badges_common") or 0,
        "badges_rare": row.get("badges_rare") or 0,
        "badges_epic": row.get("badges_epic") or 0,
        "badges_legendary": row.get("badges_legendary") or 0,
        "recent_badges": row.get("recent_badges") or [],
        # Skills & modules (public)
        "skills_earned": row.get("skills_earned") or [],
        "modules": [
            {k: v for k, v in m.items() if k in {
                "order_index", "code", "title", "is_completed",
                "completion_percent", "sessions_total", "sessions_completed_n",
            }} for m in (row.get("modules") or [])
        ],
        # Heatmap (public, anonymous activity pattern)
        "active_days_last_90": row.get("active_days_last_90") or 0,
        "heatmap_90": row.get("heatmap_90") or [],
    }


def _generate_share_slug() -> str:
    """8-char lowercase alphanumeric. ~3.6e12 keyspace, collision-free in practice
    but we still retry on conflict at the DB layer."""
    alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
    return "".join(_secrets.choice(alphabet) for _ in range(8))


class PortfolioShareReq(BaseModel):
    enabled: bool


@api_router.get("/portfolio/me")
async def portfolio_me(supa_user: dict = Depends(get_supabase_user)):
    """Aggregated portfolio for the authenticated user."""
    user_id = supa_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="user id missing on token")
    rows = _supabase_get(
        f"v_user_portfolio?user_id=eq.{_urlparse.quote(user_id)}&select={_PORTFOLIO_VIEW_FIELDS}&limit=1"
    ) or []
    if not rows:
        # First-time user without a user_stats row, return a stub so the page
        # still renders with empty states.
        prof = _supabase_get(
            f"profiles?id=eq.{_urlparse.quote(user_id)}&select=full_name,email,avatar_url,created_at,portfolio_public,portfolio_share_slug&limit=1"
        ) or []
        p = (prof or [{}])[0]
        return {
            "user_id": user_id,
            "full_name": p.get("full_name"),
            "email": p.get("email"),
            "avatar_url": p.get("avatar_url"),
            "member_since": p.get("created_at"),
            "portfolio_public": bool(p.get("portfolio_public")),
            "portfolio_share_slug": p.get("portfolio_share_slug"),
            "total_xp": 0, "current_level": 1, "level_name": None,
            "modules_completed": 0, "modules_enrolled": 0, "modules": [],
            "sessions_completed": 0, "sessions_total": 0,
            "skills_earned": [], "recent_badges": [], "badges_total": 0,
            "active_days_last_90": 0, "heatmap_90": [],
        }
    return rows[0]


@api_router.post("/portfolio/share")
async def portfolio_share(req: PortfolioShareReq, supa_user: dict = Depends(get_supabase_user)):
    """Toggle the public-share opt-in. Generates a slug on first opt-in."""
    user_id = supa_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="user id missing on token")

    prof = _supabase_get(
        f"profiles?id=eq.{_urlparse.quote(user_id)}&select=portfolio_share_slug,portfolio_public&limit=1"
    ) or []
    current = (prof or [{}])[0]

    update_body: dict = {"portfolio_public": bool(req.enabled)}
    if req.enabled and not current.get("portfolio_share_slug"):
        # Generate a unique slug; retry up to 5 times on collision.
        for _ in range(5):
            candidate = _generate_share_slug()
            taken = _supabase_get(
                f"profiles?portfolio_share_slug=eq.{candidate}&select=id&limit=1"
            ) or []
            if not taken:
                update_body["portfolio_share_slug"] = candidate
                break
        else:
            raise HTTPException(status_code=500, detail="could not allocate a unique share slug")

    _supabase_patch(
        f"profiles?id=eq.{_urlparse.quote(user_id)}",
        update_body,
    )

    new_prof = _supabase_get(
        f"profiles?id=eq.{_urlparse.quote(user_id)}&select=portfolio_public,portfolio_share_slug&limit=1"
    ) or []
    np = (new_prof or [{}])[0]
    slug = np.get("portfolio_share_slug")

    # Build the public URL, the frontend uses /p/<slug> on its own origin.
    origin = os.environ.get("PUBLIC_APP_ORIGIN") or os.environ.get("REACT_APP_PUBLIC_ORIGIN") or ""
    public_url = f"{origin.rstrip('/')}/p/{slug}" if (origin and slug) else (f"/p/{slug}" if slug else None)

    return {
        "portfolio_public": bool(np.get("portfolio_public")),
        "share_slug": slug,
        "public_url": public_url,
    }


@api_router.get("/portfolio/public/{share_slug}")
async def portfolio_public(share_slug: str):
    """Public, no-auth read of a portfolio by share slug. Returns redacted data.
    404 when slug is unknown or the owner has opted out of public sharing."""
    if not share_slug or len(share_slug) < 6:
        raise HTTPException(status_code=404, detail="portfolio not found")
    # Resolve slug → user_id (service-role read so we don't rely on the anon policy).
    prof_rows = _supabase_get(
        f"profiles?portfolio_share_slug=eq.{_urlparse.quote(share_slug)}"
        f"&portfolio_public=eq.true&select=id&limit=1"
    ) or []
    if not prof_rows:
        raise HTTPException(status_code=404, detail="portfolio not found")
    user_id = prof_rows[0]["id"]
    rows = _supabase_get(
        f"v_user_portfolio?user_id=eq.{_urlparse.quote(user_id)}&select={_PORTFOLIO_VIEW_FIELDS}&limit=1"
    ) or []
    if not rows:
        raise HTTPException(status_code=404, detail="portfolio not found")
    return _redact_public_portfolio(rows[0])


# =============================================================================
# Pari's Review Notes (Phase 57), study cabinet of every Pari answer
# =============================================================================

@api_router.get("/portfolio/review_notes")
async def portfolio_review_notes(
    phase: Optional[str] = None,
    module_code: Optional[str] = None,
    limit: int = 50,
    supa_user: dict = Depends(get_supabase_user),
):
    """Return up to `limit` (max 100) most-recent Pari assistant replies for the
    calling user, with paired user question + best-available topic label."""
    user_id = supa_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="user id missing on token")
    capped_limit = max(1, min(int(limit or 50), 100))
    query_parts = [
        f"user_id=eq.{_urlparse.quote(user_id)}",
        "select=id,doubt_session_id,phase,module_code,topic,user_question,pari_answer,is_cached,created_at",
        "order=created_at.desc",
        f"limit={capped_limit}",
    ]
    if phase:
        valid_phases = {"notes", "quiz", "interview", "simulation", "dashboard", "project", "capstone", "module_complete"}
        if phase not in valid_phases:
            raise HTTPException(status_code=400, detail=f"invalid phase: {phase}")
        query_parts.append(f"phase=eq.{phase}")
    if module_code:
        if not _re.fullmatch(r"[A-Za-z0-9_-]{1,16}", module_code):
            raise HTTPException(status_code=400, detail="invalid module_code")
        query_parts.append(f"module_code=eq.{module_code}")
    rows = _supabase_get(f"v_user_review_notes?{'&'.join(query_parts)}") or []
    # Best-effort stats, cheap counts on the same view, no auth filter needed
    # because v_user_review_notes is security_invoker=true and our service-role
    # call inherits the user filter.
    all_rows = _supabase_get(
        f"v_user_review_notes?user_id=eq.{_urlparse.quote(user_id)}"
        f"&select=topic,created_at&limit=500"
    ) or []
    unique_topics = len({(r.get("topic") or "").lower() for r in all_rows if r.get("topic")})
    return {
        "items": rows,
        "total_count": len(all_rows),
        "unique_topics": unique_topics,
        "most_recent_at": all_rows[0]["created_at"] if all_rows else None,
    }



# =============================================================================
# Phase A, Quick Revision Sheet (session-end AI revision card)
# =============================================================================

REVISION_SHEET_SYSTEM_PROMPT = """You are Pari, a precise finance tutor. Generate a Quick Revision Sheet for a learner who just finished a session.

Your output MUST be valid markdown with these four H2 sections IN THIS EXACT ORDER:

## Key Concepts
3-5 short bullets capturing the core ideas, in plain language. Each bullet ≤ 22 words.

## Formulas
2-4 formulas using inline code spans (e.g. `PV = FV / (1 + r)^n`). For each, add a 1-line plain-English note. If the session has no formulas, write a single italic line: *"No new formulas in this session."*

## Common Pitfalls
2-3 bullets, mistakes students typically make on this topic.

## Ask Yourself
3 short recall questions a student should be able to answer to prove they got it.

Constraints:
- Target length: 350-500 words total. Hard ceiling 600 words.
- Match the student's country focus when picking examples: {country_context}
- Do NOT add a heading above "Key Concepts"; do NOT add an intro paragraph; do NOT close with a sign-off.
- Plain markdown only, no tables, no HTML, no emoji.
"""


class RevisionGenerateReq(BaseModel):
    session_id: str
    module_id: Optional[str] = None


def _resolve_session_context_for_revision(session_id: str):
    """Pull the master_session payload (title + description + learning_objectives)
    that's the source of truth for what the revision sheet covers. Falls back
    to the user_sessions.title if the master row can't be resolved."""
    sess_rows = _supabase_get(
        f"user_sessions?id=eq.{_urlparse.quote(session_id)}"
        f"&select=title,master_session_id,user_module_id&limit=1"
    ) or []
    if not sess_rows:
        return None
    sess = sess_rows[0]
    master_session_id = sess.get("master_session_id")
    if not master_session_id:
        return {
            "title": sess.get("title") or "this session",
            "description": "",
            "learning_objectives": [],
        }
    master_rows = _supabase_get(
        f"master_sessions?id=eq.{_urlparse.quote(master_session_id)}"
        f"&select=title,description,learning_objectives&limit=1"
    ) or []
    if not master_rows:
        return {
            "title": sess.get("title") or "this session",
            "description": "",
            "learning_objectives": [],
        }
    m = master_rows[0]
    return {
        "title": m.get("title") or sess.get("title") or "this session",
        "description": m.get("description") or "",
        "learning_objectives": m.get("learning_objectives") or [],
    }


class WorkbookSaveReq(BaseModel):
    master_simulation_id: str
    user_session_id: Optional[str] = None
    workbook_state: dict
    status: Optional[str] = None  # 'in_progress' (default) | 'submitted'
    last_score: Optional[dict] = None


@api_router.post("/simulations/workbook/save")
async def simulation_workbook_save(req: WorkbookSaveReq, supa_user: dict = Depends(get_supabase_user)):
    """Batch 5, Persist (or auto-save) a per-user spreadsheet workbook
    so users can leave and come back. UPSERT on (user_id, master_simulation_id,
    user_session_id). 200 OK with the row id."""
    user_id = supa_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="user id missing on token")
    row = {
        "user_id": user_id,
        "master_simulation_id": req.master_simulation_id,
        "user_session_id": req.user_session_id,
        "workbook_state": req.workbook_state,
        "status": (req.status or "in_progress"),
        "last_score": req.last_score,
    }
    try:
        existing = _supabase_get(
            f"user_simulation_workbooks?user_id=eq.{_urlparse.quote(user_id)}"
            f"&master_simulation_id=eq.{_urlparse.quote(req.master_simulation_id)}"
            + (f"&user_session_id=eq.{_urlparse.quote(req.user_session_id)}" if req.user_session_id
               else "&user_session_id=is.null")
            + "&select=id&limit=1"
        ) or []
        if existing:
            row.pop("user_id", None)  # don't change PK fields on update
            _supabase_patch(
                f"user_simulation_workbooks?id=eq.{_urlparse.quote(existing[0]['id'])}",
                row,
            )
            return {"ok": True, "id": existing[0]["id"], "updated": True}
        result = _supabase_post(
            "user_simulation_workbooks", row, prefer="return=representation"
        )
        # _supabase_post returns the inserted row (or list), handle both shapes.
        new_id = (result[0]["id"] if isinstance(result, list) and result else (result or {}).get("id"))
        return {"ok": True, "id": new_id, "updated": False}
    except Exception as e:
        logger.error(f"[sim-workbook] save failed: {e}")
        raise HTTPException(status_code=500, detail=f"workbook save failed: {e}")


@api_router.get("/simulations/workbook")
async def simulation_workbook_load(
    master_simulation_id: str,
    user_session_id: Optional[str] = None,
    supa_user: dict = Depends(get_supabase_user),
):
    """Batch 5, Fetch the persisted workbook (if any) for this user + sim
    so the FE can restore where they left off."""
    user_id = supa_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="user id missing on token")
    q = (
        f"user_simulation_workbooks?user_id=eq.{_urlparse.quote(user_id)}"
        f"&master_simulation_id=eq.{_urlparse.quote(master_simulation_id)}"
        + (f"&user_session_id=eq.{_urlparse.quote(user_session_id)}" if user_session_id
           else "&user_session_id=is.null")
        + "&select=id,workbook_state,last_score,status,updated_at&limit=1"
    )
    rows = _supabase_get(q) or []
    if not rows:
        return {"found": False}
    return {"found": True, **rows[0]}


@api_router.post("/revision/generate")
async def revision_generate(req: RevisionGenerateReq, supa_user: dict = Depends(get_supabase_user)):
    """Idempotent: returns the cached sheet if one exists for (user, session),
    otherwise calls Haiku once, persists it, and returns it."""
    user_id = supa_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="user id missing on token")
    if not req.session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    # 1) Cache hit?
    cached = _supabase_get(
        f"user_revision_sheets?user_id=eq.{_urlparse.quote(user_id)}"
        f"&session_id=eq.{_urlparse.quote(req.session_id)}"
        f"&select=content_md,generated_at,tokens_used&limit=1"
    ) or []
    if cached:
        return {
            "content_md": cached[0]["content_md"],
            "cached": True,
            "generated_at": cached[0].get("generated_at"),
            "tokens_used": cached[0].get("tokens_used", 0),
        }

    # 2) Build prompt context.
    ctx = _resolve_session_context_for_revision(req.session_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="session not found")

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

    objectives_md = ""
    if ctx["learning_objectives"]:
        objectives_md = "\n".join(f"- {o}" for o in ctx["learning_objectives"][:8])
    else:
        objectives_md = "- (none listed)"

    user_prompt = (
        f"Session title: {ctx['title']}\n"
        f"Session description: {ctx['description'] or '(none)'}\n"
        f"Learning objectives:\n{objectives_md}\n\n"
        "Generate the Quick Revision Sheet now. Return ONLY the markdown described in the system prompt."
    )

    # 3) Call Haiku.
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=502, detail="LLM not configured")
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"revision-{req.session_id}",
            system_message=REVISION_SHEET_SYSTEM_PROMPT.format(country_context=country_context),
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        resp = await chat.send_message(UserMessage(text=user_prompt))
        content_md = (resp or "").strip()
        if content_md.startswith("```"):
            content_md = _re.sub(r"^```(?:markdown|md)?\s*", "", content_md)
            content_md = _re.sub(r"\s*```\s*$", "", content_md)
        if not content_md:
            raise HTTPException(status_code=502, detail="LLM returned an empty sheet. Try again in a moment.")
    except HTTPException:
        raise
    except Exception as e:
        # F1 (Batch 1), Surface a more useful detail string. The user can hit
        # Retry; the FE will show a soft "Try again" CTA. We log the full
        # exception server-side so we can diagnose recurring failures.
        err_msg = str(e) or e.__class__.__name__
        err_lower = err_msg.lower()
        if "rate" in err_lower or "429" in err_lower or "quota" in err_lower or "limit" in err_lower:
            detail = "Pari is busy right now (rate limit). Try again in a few seconds."
        elif "timeout" in err_lower or "timed out" in err_lower:
            detail = "The summary took too long to generate. Try again."
        elif "auth" in err_lower or "invalid" in err_lower and "key" in err_lower:
            detail = "LLM credentials issue, admin has been notified."
        elif "budget" in err_lower or "balance" in err_lower or "insufficient" in err_lower:
            detail = "LLM key budget exhausted. Admin needs to top up."
        else:
            detail = f"Couldn't generate the sheet. {err_msg[:120]}".strip()
        logger.error(f"[revision] LLM call failed for session={req.session_id}: {err_msg}")
        raise HTTPException(status_code=502, detail=detail)

    approx_tokens = max(1, (len(user_prompt) + len(content_md)) // 4)

    # 4) Persist with ignore-duplicates so concurrent generates collapse cleanly.
    try:
        _supabase_post(
            "user_revision_sheets",
            {
                "user_id": user_id,
                "session_id": req.session_id,
                "module_id": req.module_id or "",
                "content_md": content_md,
                "tokens_used": approx_tokens,
            },
            prefer="resolution=ignore-duplicates",
        )
    except Exception as e:
        logger.warning(f"[revision] cache write failed: {e}")

    return {
        "content_md": content_md,
        "cached": False,
        "tokens_used": approx_tokens,
    }


@api_router.get("/revision/{session_id}")
async def revision_get(session_id: str, supa_user: dict = Depends(get_supabase_user)):
    """Return the cached revision sheet for (current user, session_id) or 404."""
    user_id = supa_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="user id missing on token")
    rows = _supabase_get(
        f"user_revision_sheets?user_id=eq.{_urlparse.quote(user_id)}"
        f"&session_id=eq.{_urlparse.quote(session_id)}"
        f"&select=content_md,generated_at,tokens_used&limit=1"
    ) or []
    if not rows:
        raise HTTPException(status_code=404, detail="revision sheet not found")
    return {
        "content_md": rows[0]["content_md"],
        "cached": True,
        "generated_at": rows[0].get("generated_at"),
        "tokens_used": rows[0].get("tokens_used", 0),
    }


# ─── Session/extended doubt endpoints extracted to doubt_endpoints.py ─────────
# Registered via register_doubt_endpoints() at the bottom of this file.


# --- Phase C: milestones -------------------------------------------------
#
# Hybrid milestone system. Module milestones (`m1_foundations`, `m4_modelling`,
# etc.) fire when a user finishes the last session of a master_module, i.e.
# every user_session in their user_module is `is_completed=true`. Count
# milestones (`count_3`, `count_7`, …, `count_100`) are the fallback and fire
# on the user's Nth completed session.
#
# When BOTH would fire in the same call, the module milestone wins (we never
# grant two milestones in a single check). The unique key
# `user_milestones (user_id, milestone_code)` makes the helper idempotent so
# a Phase B redo session that re-completes the same module does NOT
# re-trigger an already-earned milestone.

class MilestoneCheckReq(BaseModel):
    session_id: str


def check_and_grant_milestones(user_id: str, just_completed_session_id: Optional[str]) -> list:
    """Grant at most ONE milestone per call. Returns newly-granted codes.

    Strategy:
      1. If the just-completed session was the LAST session of its module
         (all user_sessions in that user_module are is_completed=true), try
         to grant that module's milestone (lookup by master_module_id).
      2. Otherwise, count the user's total completed sessions and try to
         grant the count milestone that exactly matches.

    The unique constraint user_milestones_user_code_unique handles the
    "already earned" case, we just swallow the 409.
    """
    granted: list = []

    # --- (1) Module milestone check ---
    if just_completed_session_id:
        sess_rows = _supabase_get(
            f"user_sessions?id=eq.{_urlparse.quote(just_completed_session_id)}"
            f"&select=id,user_module_id,is_completed&limit=1"
        ) or []
        if sess_rows and sess_rows[0].get("is_completed") and sess_rows[0].get("user_module_id"):
            user_module_id = sess_rows[0]["user_module_id"]
            # All sessions in this user_module complete?
            siblings = _supabase_get(
                f"user_sessions?user_module_id=eq.{_urlparse.quote(user_module_id)}"
                f"&is_removed=eq.false&select=is_completed"
            ) or []
            if siblings and all(s.get("is_completed") for s in siblings):
                # Get the master_module_id for the milestone lookup
                um_rows = _supabase_get(
                    f"user_modules?id=eq.{_urlparse.quote(user_module_id)}"
                    f"&select=master_module_id&limit=1"
                ) or []
                if um_rows and um_rows[0].get("master_module_id"):
                    master_module_id = um_rows[0]["master_module_id"]
                    ms_rows = _supabase_get(
                        f"master_milestones?trigger_module_id=eq.{_urlparse.quote(master_module_id)}"
                        f"&select=code&limit=1"
                    ) or []
                    if ms_rows:
                        code = ms_rows[0]["code"]
                        try:
                            inserted = _supabase_post(
                                "user_milestones",
                                {"user_id": user_id, "milestone_code": code},
                                prefer="return=representation",
                            )
                            if inserted:
                                granted.append(code)
                                return granted   # module wins, skip count check
                        except HTTPException as e:
                            # 409 == unique violation == already earned; fall through to count check
                            if e.status_code != 409:
                                logger.warning(f"[milestones] module insert failed: {e.detail}")

    # --- (2) Count milestone fallback ---
    # Two-step count: enrollment_ids → user_module_ids → completed sessions
    # count. PostgREST does not support nested subqueries via the REST query
    # string, so we run two simple GETs and count Python-side.
    try:
        enrollments = _supabase_get(
            f"user_enrollments?user_id=eq.{_urlparse.quote(user_id)}&select=id"
        ) or []
        enrollment_ids = [e["id"] for e in enrollments]
        if not enrollment_ids:
            return granted

        enr_filter = ",".join(enrollment_ids)
        user_modules_rows = _supabase_get(
            f"user_modules?enrollment_id=in.({enr_filter})&select=id"
        ) or []
        um_ids = [um["id"] for um in user_modules_rows]
        if not um_ids:
            return granted

        # Chunk to keep URL bounded; in practice users have <30 modules.
        completed_count = 0
        chunk_size = 50
        for i in range(0, len(um_ids), chunk_size):
            chunk = um_ids[i:i + chunk_size]
            filter_str = ",".join(chunk)
            # `count=exact` with Prefer header is tricky over our helper; instead
            # fetch ids and count Python-side. Lightweight (one id per row).
            rows = _supabase_get(
                f"user_sessions?user_module_id=in.({filter_str})"
                f"&is_completed=eq.true&is_removed=eq.false&select=id"
            ) or []
            completed_count += len(rows)

        # Match against a count milestone (exact equality, never >=).
        cm_rows = _supabase_get(
            f"master_milestones?kind=eq.count&trigger_count=eq.{completed_count}&select=code&limit=1"
        ) or []
        if cm_rows:
            code = cm_rows[0]["code"]
            try:
                inserted = _supabase_post(
                    "user_milestones",
                    {"user_id": user_id, "milestone_code": code},
                    prefer="return=representation",
                )
                if inserted:
                    granted.append(code)
            except HTTPException as e:
                if e.status_code != 409:
                    logger.warning(f"[milestones] count insert failed: {e.detail}")
    except Exception as e:
        logger.warning(f"[milestones] count check failed: {e}")

    return granted


@api_router.get("/milestones/pending")
async def milestones_pending(supa_user: dict = Depends(get_supabase_user)):
    """Returns earned-but-not-dismissed milestones for the current user,
    oldest first (so the overlay shows them in the order they were earned)."""
    user_id = supa_user.get("id")
    rows = _supabase_get(
        f"user_milestones?user_id=eq.{_urlparse.quote(user_id)}"
        f"&dismissed_at=is.null&order=earned_at.asc"
        f"&select=milestone_code,earned_at"
    ) or []
    if not rows:
        return []
    codes = [r["milestone_code"] for r in rows]
    code_filter = ",".join([f'"{c}"' for c in codes])
    master = _supabase_get(
        f"master_milestones?code=in.({code_filter})"
        f"&select=code,title,body,icon,rarity,kind"
    ) or []
    master_by_code = {m["code"]: m for m in master}
    out = []
    for r in rows:
        m = master_by_code.get(r["milestone_code"])
        if not m:
            continue
        out.append({
            "code": m["code"],
            "title": m["title"],
            "body": m["body"],
            "icon": m["icon"],
            "rarity": m["rarity"],
            "kind": m["kind"],
            "earned_at": r["earned_at"],
        })
    return out


@api_router.post("/milestones/{code}/dismiss")
async def milestone_dismiss(code: str, supa_user: dict = Depends(get_supabase_user)):
    user_id = supa_user.get("id")
    rows = _supabase_patch(
        f"user_milestones?user_id=eq.{_urlparse.quote(user_id)}"
        f"&milestone_code=eq.{_urlparse.quote(code)}",
        {"dismissed_at": datetime.now(timezone.utc).isoformat()},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="milestone not earned by this user")
    return {"code": code, "dismissed_at": rows[0].get("dismissed_at")}


@api_router.post("/milestones/check")
async def milestones_check(req: MilestoneCheckReq, supa_user: dict = Depends(get_supabase_user)):
    """Called by the FE right after a session-complete + XP write. Grants
    at most one new milestone and returns its code so the FE can poll
    /pending and surface the celebration overlay."""
    user_id = supa_user.get("id")
    # Sanity: confirm the session actually belongs to the caller (and is
    # complete). We don't fully reject if not, just skip the module check.
    granted = check_and_grant_milestones(user_id, req.session_id)
    return {"newly_granted": granted}


# --- end Phase C ---------------------------------------------------------


# ─── Study plan endpoints extracted to study_plan_endpoints.py ─────────────────
# Registered via register_study_plan_endpoints() at the bottom of this file.

















@api_router.post("/admin/login")
async def admin_login(creds: AdminLogin, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    # Simple in-memory brute-force guard (resets on process restart; good enough for legacy endpoint)
    _key = f"admin_login:{client_ip}"
    now = time.time()
    _login_attempts[_key] = [t for t in _login_attempts.get(_key, []) if now - t < 300]
    if len(_login_attempts.get(_key, [])) >= 10:
        raise HTTPException(status_code=429, detail="Too many login attempts, try again later")
    _login_attempts.setdefault(_key, []).append(now)
    email_ok    = hmac.compare_digest((creds.email or ""), (ADMIN_EMAIL or ""))
    password_ok = hmac.compare_digest((creds.password or ""), (ADMIN_PASSWORD or ""))
    if email_ok and password_ok:
        _login_attempts.pop(_key, None)   # reset on success
        token = create_token(creds.email)
        return {"token": token}
    raise HTTPException(status_code=401, detail="Invalid credentials")


@api_router.get("/waitlist/all")
async def get_all_waitlist(payload=Depends(verify_token)):
    """Legacy JWT-protected endpoint. Now reads from Supabase (persistent)
    instead of the ephemeral pod Mongo. See 0031_waitlist.sql."""
    rows = _supabase_get(
        'waitlist?select=id,first_name,email,position,referral_code,referral_count,referred_by,timestamp'
        '&order=timestamp.desc&limit=1000'
    ) or []
    return rows


@api_router.post("/waitlist", response_model=WaitlistResponse)
async def join_waitlist(entry: WaitlistCreate):
    """Persist a waitlist signup to Supabase. Idempotent on email (returns the
    existing row). Migrated Feb 2026 from Mongo → Supabase because production
    deploy containers have ephemeral Mongo that wiped older signups."""
    email_norm = entry.email.strip().lower()
    # 1) Existing?
    existing = _supabase_get(
        f'waitlist?email=eq.{_urlparse.quote(email_norm)}&limit=1'
    ) or []
    if existing:
        return existing[0]

    # 2) Fresh referral code
    referral_code = generate_referral_code()
    # Loop until unique (collision probability is tiny with 6 chars alnum,
    # but the DB unique index will 409 if we're unlucky, so retry).
    for _ in range(6):
        clash = _supabase_get(
            f'waitlist?referral_code=eq.{_urlparse.quote(referral_code)}&limit=1'
        ) or []
        if not clash:
            break
        referral_code = generate_referral_code()

    position = random.randint(200, 350)
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "first_name": entry.first_name,
        "email": email_norm,
        "position": position,
        "timestamp": now_iso,
        "referral_code": referral_code,
        "referral_count": 0,
        "referred_by": entry.ref_code or None,
    }
    try:
        inserted = _supabase_post(
            "waitlist",
            doc,
            prefer="return=representation",
        )
    except HTTPException as e:
        # Race on unique email → re-fetch and return.
        if e.status_code in (409, 400):
            re_read = _supabase_get(
                f'waitlist?email=eq.{_urlparse.quote(email_norm)}&limit=1'
            ) or []
            if re_read:
                return re_read[0]
        raise

    row = inserted[0] if isinstance(inserted, list) and inserted else doc

    # 3) Referral bump, the referrer moves up 5 spots and their count +1.
    if entry.ref_code:
        refs = _supabase_get(
            f'waitlist?referral_code=eq.{_urlparse.quote(entry.ref_code)}&select=id,position,referral_count&limit=1'
        ) or []
        if refs:
            r = refs[0]
            _supabase_patch(
                f'waitlist?id=eq.{r["id"]}',
                {
                    "position": max(1, int(r.get("position") or 250) - 5),
                    "referral_count": int(r.get("referral_count") or 0) + 1,
                },
            )

    return row


@api_router.get("/waitlist/count")
async def get_waitlist_count():
    """Public count endpoint. Reads from Supabase with a HEAD request so we
    don't ship the full row list back to every landing page hit."""
    if not _SUPABASE_SR:
        return {"count": 500}
    url = f"{_SUPABASE_REST}/rest/v1/waitlist?select=id"
    req = _urlreq.Request(
        url,
        method="HEAD",
        headers={
            "apikey": _SUPABASE_SR,
            "Authorization": f"Bearer {_SUPABASE_SR}",
            "Prefer": "count=exact",
            "Range-Unit": "items",
            "Range": "0-0",
        },
    )
    try:
        with _urlreq.urlopen(req, timeout=8) as r:
            cr = r.headers.get("content-range") or ""
            # Format: "0-0/N" or "*/N"
            if "/" in cr:
                total = cr.split("/", 1)[1].strip()
                if total.isdigit():
                    return {"count": int(total) + 500}
    except Exception:
        pass
    return {"count": 500}


from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText
import json as json_module

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')


class CustomizeRequest(BaseModel):
    answers: List[dict]
    free_text: str = ''
    course_structure: List[dict]
    course_title: str = ''


CUSTOMIZE_SYSTEM_PROMPT = """You are a curriculum design AI for Valuevade, an AI-powered finance career platform for Indian finance students. Your job is to take a fixed 15-module / 173-session Equity Research Analyst course and a set of user profiling answers, then output a personalised customisation plan as structured JSON.

Your goal: aggressively REMOVE sessions/modules the user has already mastered, and preserve only what genuinely adds value to THIS user. Prefer session-level surgery over whole-module removal when a module is partially redundant.

---

COURSE STRUCTURE

You will receive the full course as a JSON array of modules. Each module has:
- module_number (integer)
- module_title (string)
- sessions (array, each with session_number, session_title, session_id)

MODULE INDEX (use these numbers in your reasoning):
- M1 Foundations of Finance, Accounting & Economics (15 sessions)
- M2 How Markets Actually Work (7 sessions)
- M3 Excel Fundamentals for Analysts (13 sessions)
- M4 Financial Modelling, 3-Statement (8 sessions)
- M5 Corporate Governance & Quality of Management (7 sessions)
- M6 Reading Annual Reports & Concalls (12 sessions)
- M7 Financial Statement Analysis (13 sessions)
- M8 Red Flag Analysis & Forensic Accounting (14 sessions)
- M9 Advanced Ratio Analysis (13 sessions)
- M10 Economy & Macro Analysis (10 sessions)
- M11 Sector Analysis (12 sessions)
- M12 Valuation in Equity Research (14 sessions)
- M13 PowerPoint & Report Writing (12 sessions)
- M14 Resume, LinkedIn & Networking (13 sessions) , LOCKED
- M15 Basics of AI & Prompt Engineering (10 sessions), LOCKED

The last 2 modules (M14, M15) are ALWAYS locked. Never remove or reorder them.

---

USER ANSWERS

You will receive an array of answered questions, each with: question_text, selected_value, purpose.
The user's answers map to these keys (selected_value will be one of the listed option values, or for multi_select a comma-separated string, or for rating_grid a JSON object of item_key→rating 1-5):

- q1_background: beginner | commerce | fin_grad | professional
- q2_goal: er_sell | er_buy | ib | credit | personal | explore
- q3_statements: never | heard | read_no_link | confident
- q4_excel: basic | intermediate | advanced | expert
- q5_modelling: never | tutorial | basic | confident
- q6_accounting: basic | comfortable | advanced | expert
- q7_ratios: heard | basic | comfortable | advanced
- q8_valuation: multi-select of [none, dcf, comps, precedent, sotp, sector_specific]
- q9_annual_reports: never | chairman | mda | analyst
- q10_markets: none | basic | moderate | deep
- q11_sectors: multi-select of [banking, it, fmcg, auto, pharma, energy, infra, all]
- q12_certs: multi-select of [none, cfa, frm, ca]
- q13_emphasis: rating object with keys [governance, sectors, valuation, reports, jobs, ai], each rated 1-5

You should match answers to keys by question_text or purpose, both will reference the key (e.g. "q1_background" or "background").

Free-text is a soft signal, use it only to refine decisions already implied by structured answers.

---

DECISION LOGIC

Apply rules in this exact order. Later rules can override earlier ones via certifications.

A) MODULE-LEVEL REMOVALS

- q1_background = fin_grad OR professional → REMOVE M1 entirely.
- q1_background = professional → REMOVE M2 entirely.
- q4_excel = expert → REMOVE M3 entirely.
- q5_modelling = confident → REMOVE M4 entirely.
- q9_annual_reports = analyst → REMOVE M6 entirely.
- q10_markets = deep → REMOVE M2 entirely AND REMOVE M10 entirely.
- q13_emphasis.governance ≤ 2 → REMOVE M5 entirely.
- q13_emphasis.reports ≤ 2 → REMOVE M13 entirely.
- q13_emphasis.sectors ≤ 2 AND q2_goal NOT IN (er_sell, er_buy) → REMOVE M11 entirely.

B) SESSION-LEVEL REMOVALS  (apply ONLY when the parent module is NOT being removed)

M1 sessions (when M1 is kept):
- q1_background = commerce → remove_session S5 "Accounting Principles & Accrual Concepts".
- q3_statements = confident → remove_session S4, S6, S7, S8, S9 (keep S5 accounting if commerce, keep TVM and Risk-Return).
- q3_statements = read_no_link → remove_session S4, S6, S7, S8 but KEEP S9 (Linking).
- q6_accounting = comfortable OR advanced OR expert → remove_session S5 if not already removed.
- q10_markets = deep → remove_session S12 "Interest Rates, Bonds & Yield Curve" AND S15 "Macroeconomics for Equity Analysts".

M2 sessions (when M2 is kept):
- q10_markets = basic → remove_session S4 "Market Indices".
- q10_markets = moderate → remove_session S1, S2, S3, S4, S5 (keep S6 Regulation + S7 Psychology).

M3 sessions (when M3 is kept):
- q4_excel = intermediate → remove_session S1, S2, S3, S4, S5.
- q4_excel = advanced → remove_session S1, S2, S3, S4, S5, S6, S7, S8 (keep S9-S13).

M4 sessions (when M4 is kept):
- q5_modelling = tutorial → remove_session S1, S2.
- q5_modelling = basic → remove_session S1, S2, S3.

M6 sessions (when M6 is kept):
- q9_annual_reports = chairman → remove_session S1, S2, S3.
- q9_annual_reports = mda → remove_session S1, S2, S3, S4, S5.

M7 sessions (always kept unless overridden):
- q6_accounting = advanced → remove_session S1, S2 (intro framework + income stmt deep-dive).
- q6_accounting = expert → remove_session S1, S2, S3, S4, S5.
- q3_statements = confident AND M1 kept → remove_session S5 (Balance Sheet Analysis), S7 (Cash Flow Analysis).

M9 sessions (when M9 is kept):
- q7_ratios = comfortable → remove_session S1, S2, S3.
- q7_ratios = advanced → remove_session S1, S2, S3, S4, S5.

M10 sessions (when M10 is kept):
- q10_markets = moderate → remove_session S1, S2, S3.

M11 sessions (when M11 is kept):
- q11_sectors does NOT include 'all' → KEEP only the selected sector sessions, REMOVE the rest. Mapping: banking→S4, it→S5, fmcg→S6, auto→S7, pharma→S8, energy→S9, infra→S10. ALWAYS keep S1, S2, S3 (frameworks), S11 (rotation), S12 (initiation note).
- q11_sectors includes 'all' OR is empty → keep every M11 session.

M12 sessions (always kept):
- q8_valuation includes 'dcf' → remove_session S6, S7, S8 (DCF Parts 1-3).
- q8_valuation includes 'comps' → remove_session S10.
- q8_valuation includes 'precedent' → remove_session S11.
- q8_valuation includes 'sotp' → remove_session S12.
- q8_valuation includes 'sector_specific' → remove_session S13.
- ALWAYS keep M12 S1, S2, S3, S4, S5 (foundations) and S14 (Football Field & Recommendation).

C) CERTIFICATION OVERRIDE (applied AFTER all removal logic above)

- q12_certs includes 'cfa' → force-keep (un-remove) M7, M9, M10, M12 if they were scheduled for removal.
- q12_certs includes 'frm' → force-keep M8, M10.
- q12_certs includes 'ca' → force-keep M1, M7.
NOTE: certification override applies to MODULE-level removals only. Session-level removals within a kept module are preserved.

D) REORDER LOGIC

- q2_goal = ib → reorder_module M12 to position 5 (if kept).
- q2_goal IN (er_sell, er_buy) AND M11 kept AND M10 kept → reorder M11 to come immediately after M10.
- q13_emphasis.jobs ≥ 4 → reorder M14 to position 3 (M14 is locked but can be MOVED).
- Apply at most 2 reorders. Skip reorders that don't meaningfully change the learning journey.

E) CONSERVATIVE RULES (non-negotiable)

1. If q1_background = beginner: SUPPRESS all session-level removals from M1, M7, M9, M10. A beginner needs the full foundations. Module-level removals from q4_excel/q5_modelling still apply.
2. Final total session count must be ≥ 60. If your plan would drop below 60, back off the last session-level removal until you're above 60.
3. NEVER remove M14 or M15. NEVER remove all sessions from any kept module.
4. When in doubt, keep. Only remove on a confident, exact trigger match above.

---

OUTPUT FORMAT

Return a single JSON object. Output raw JSON only, no markdown, no preamble.

{
"user_profile_summary": "2-3 sentence plain-English summary of who this user is based on their answers",
"total_modules_final": <integer>,
"total_sessions_final": <integer>,
"customisation_plan": [
{
"action": "remove_module",
"module_number": <integer>,
"module_title": "<string>",
"reason": "<one sentence referencing the specific answer that triggered this>"
},
{
"action": "remove_session",
"module_number": <integer>,
"module_title": "<string>",
"session_id": "<uuid from input>",
"session_title": "<string>",
"reason": "<one sentence>"
},
{
"action": "reorder_module",
"module_number": <integer>,
"module_title": "<string>",
"new_position": <integer>,
"reason": "<one sentence>"
}
],
"final_modules": [
{
"position": <integer>,
"module_number": <integer>,
"module_title": "<string>",
"status": "kept" | "removed" | "reordered" | "locked",
"sessions_removed": <integer>,
"final_session_count": <integer>
}
],
"locked_modules": [14, 15],
"conservative_flags": ["<any rule that triggered, e.g. 'beginner_suppress' or 'min_session_floor'>"]
}"""


# ─────────────────────────────────────────────────────────────────────────────
# Input-side validation: deterministically enforces the rules from the prompt
# AFTER the LLM responds. Guards against hallucination, missed removals, and
# illegal actions (e.g. removing locked M14/M15).
# ─────────────────────────────────────────────────────────────────────────────
def _extract_answers(req_answers):
    """Map req.answers → dict of question keys (q1..q13) → normalized value."""
    keymap = [
        ("q1_background", "finance background"),
        ("q2_goal", "career goal"),
        ("q3_statements", "3 financial statements"),
        ("q4_excel", "excel skill"),
        ("q5_modelling", "model from scratch"),
        ("q6_accounting", "accounting & accrual"),
        ("q7_ratios", "ratio & fsa"),
        ("q8_valuation", "valuation methods"),
        ("q9_annual_reports", "annual reports & concalls"),
        ("q10_markets", "indian markets"),
        ("q11_sectors", "sectors do you want"),
        ("q12_certs", "certifications"),
        ("q13_emphasis", "emphasis"),
    ]
    out = {}
    for a in req_answers or []:
        text = (a.get("question_text") or "").lower()
        val = a.get("answer")
        for key, needle in keymap:
            if needle in text:
                out[key] = val
                break
    return out


def _compute_required_actions(ans, course):
    """Apply rule set deterministically. Returns:
       (required_remove_modules: set[int], cert_force_keep: set[int],
        required_remove_sessions: dict[mod_num] -> set[session_number],
        flags: list[str])"""
    flags = []
    # Beginner suppression: skip session-level removals from M1/M7/M9/M10
    beginner = ans.get("q1_background") == "beginner"
    if beginner:
        flags.append("beginner_suppress")

    rm_mods = set()
    rm_sess = {}  # mod_num -> set of session_numbers (1-indexed)

    def add_sess(mod_num, *sess_nums):
        rm_sess.setdefault(mod_num, set()).update(sess_nums)

    # ── A) Module-level removals
    if ans.get("q1_background") in ("fin_grad", "professional"):
        rm_mods.add(1)
    if ans.get("q1_background") == "professional":
        rm_mods.add(2)
    if ans.get("q4_excel") == "expert":
        rm_mods.add(3)
    if ans.get("q5_modelling") == "confident":
        rm_mods.add(4)
    if ans.get("q9_annual_reports") == "analyst":
        rm_mods.add(6)
    if ans.get("q10_markets") == "deep":
        rm_mods.update({2, 10})

    emphasis = ans.get("q13_emphasis") or {}
    if isinstance(emphasis, dict):
        if (emphasis.get("governance") or 3) <= 2:
            rm_mods.add(5)
        if (emphasis.get("reports") or 3) <= 2:
            rm_mods.add(13)
        if (emphasis.get("sectors") or 3) <= 2 and ans.get("q2_goal") not in ("er_sell", "er_buy"):
            rm_mods.add(11)

    # ── B) Session-level removals (only when parent module is NOT being removed)
    if 1 not in rm_mods and not beginner:
        if ans.get("q1_background") == "commerce":
            add_sess(1, 5)
        q3 = ans.get("q3_statements")
        if q3 == "confident":
            add_sess(1, 4, 6, 7, 8, 9)
        elif q3 == "read_no_link":
            add_sess(1, 4, 6, 7, 8)  # keep S9
        if ans.get("q6_accounting") in ("comfortable", "advanced", "expert"):
            add_sess(1, 5)
        if ans.get("q10_markets") == "deep":
            add_sess(1, 12, 15)

    if 2 not in rm_mods:
        if ans.get("q10_markets") == "basic":
            add_sess(2, 4)
        elif ans.get("q10_markets") == "moderate":
            add_sess(2, 1, 2, 3, 4, 5)

    if 3 not in rm_mods:
        if ans.get("q4_excel") == "intermediate":
            add_sess(3, 1, 2, 3, 4, 5)
        elif ans.get("q4_excel") == "advanced":
            add_sess(3, 1, 2, 3, 4, 5, 6, 7, 8)

    if 4 not in rm_mods:
        if ans.get("q5_modelling") == "tutorial":
            add_sess(4, 1, 2)
        elif ans.get("q5_modelling") == "basic":
            add_sess(4, 1, 2, 3)

    if 6 not in rm_mods:
        if ans.get("q9_annual_reports") == "chairman":
            add_sess(6, 1, 2, 3)
        elif ans.get("q9_annual_reports") == "mda":
            add_sess(6, 1, 2, 3, 4, 5)

    if 7 not in rm_mods and not beginner:
        if ans.get("q6_accounting") == "advanced":
            add_sess(7, 1, 2)
        elif ans.get("q6_accounting") == "expert":
            add_sess(7, 1, 2, 3, 4, 5)

    if 9 not in rm_mods and not beginner:
        if ans.get("q7_ratios") == "comfortable":
            add_sess(9, 1, 2, 3)
        elif ans.get("q7_ratios") == "advanced":
            add_sess(9, 1, 2, 3, 4, 5)

    if 10 not in rm_mods and not beginner:
        if ans.get("q10_markets") == "moderate":
            add_sess(10, 1, 2, 3)

    # M11 sector pick: keep only selected sectors
    if 11 not in rm_mods:
        sectors = ans.get("q11_sectors") or []
        if isinstance(sectors, str):
            sectors = [s.strip() for s in sectors.split(",") if s.strip()]
        if sectors and "all" not in sectors:
            # Mapping: banking→S4, it→S5, fmcg→S6, auto→S7, pharma→S8, energy→S9, infra→S10
            sector_to_sess = {"banking": 4, "it": 5, "fmcg": 6, "auto": 7, "pharma": 8, "energy": 9, "infra": 10}
            kept = {sector_to_sess[s] for s in sectors if s in sector_to_sess}
            for sess_num in (4, 5, 6, 7, 8, 9, 10):
                if sess_num not in kept:
                    add_sess(11, sess_num)

    # M12 valuation methods
    if 12 not in rm_mods:
        vmethods = ans.get("q8_valuation") or []
        if isinstance(vmethods, str):
            vmethods = [v.strip() for v in vmethods.split(",") if v.strip()]
        if "dcf" in vmethods:
            add_sess(12, 6, 7, 8)
        if "comps" in vmethods:
            add_sess(12, 10)
        if "precedent" in vmethods:
            add_sess(12, 11)
        if "sotp" in vmethods:
            add_sess(12, 12)
        if "sector_specific" in vmethods:
            add_sess(12, 13)

    # ── C) Certification override, force-keep modules
    cert_keep = set()
    certs = ans.get("q12_certs") or []
    if isinstance(certs, str):
        certs = [c.strip() for c in certs.split(",") if c.strip()]
    if "cfa" in certs:
        cert_keep.update({7, 9, 10, 12})
    if "frm" in certs:
        cert_keep.update({8, 10})
    if "ca" in certs:
        cert_keep.update({1, 7})

    # Apply cert override at module level
    if cert_keep & rm_mods:
        flags.append("cert_override")
        rm_mods -= cert_keep

    # Never remove locked modules
    if rm_mods & {14, 15}:
        flags.append("locked_violation_prevented")
        rm_mods -= {14, 15}

    return rm_mods, cert_keep, rm_sess, flags


def _validate_and_normalize_plan(plan, req):
    """Reconcile Claude's plan with deterministic rules. Mutates and returns plan."""
    ans = _extract_answers(req.answers)
    course = req.course_structure or []
    # Build session_id lookup: (mod_num, sess_num) -> {id, title}
    sess_lookup = {}
    mod_titles = {}
    for i, mod in enumerate(course, 1):
        mod_titles[i] = mod.get("title", "")
        for j, s in enumerate(mod.get("master_sessions", []) or [], 1):
            sess_lookup[(i, j)] = {"id": s.get("id", ""), "title": s.get("title", "")}

    required_rm_mods, cert_keep, required_rm_sess, flags = _compute_required_actions(ans, course)

    # Start from LLM-provided plan
    actions = list(plan.get("customisation_plan") or [])

    # 1) Strip any actions targeting locked modules (M14, M15), sessions or modules
    cleaned = []
    for a in actions:
        if a.get("module_number") in (14, 15):
            flags.append("dropped_locked_action")
            continue
        cleaned.append(a)
    actions = cleaned

    # 2) Strip module-level removals that conflict with cert_keep
    actions = [a for a in actions if not (a.get("action") == "remove_module" and a.get("module_number") in cert_keep)]

    # 3) Add MISSING module-level removals
    have_rm_mods = {a.get("module_number") for a in actions if a.get("action") == "remove_module"}
    for m in required_rm_mods:
        if m not in have_rm_mods:
            actions.append({
                "action": "remove_module",
                "module_number": m,
                "module_title": mod_titles.get(m, ""),
                "reason": "Enforced by deterministic validator (rule trigger matched).",
            })
            flags.append(f"added_remove_module_M{m}")

    # 4) Drop session-level removals targeting modules that are now being removed (redundant)
    final_rm_mods = {a.get("module_number") for a in actions if a.get("action") == "remove_module"}
    actions = [a for a in actions if not (a.get("action") == "remove_session" and a.get("module_number") in final_rm_mods)]

    # 5) Add MISSING session-level removals
    have_rm_sess = set()
    for a in actions:
        if a.get("action") == "remove_session":
            sid = a.get("session_id")
            if sid:
                have_rm_sess.add(sid)
    for mod_num, sess_nums in required_rm_sess.items():
        if mod_num in final_rm_mods:
            continue
        for sess_num in sess_nums:
            entry = sess_lookup.get((mod_num, sess_num))
            if not entry or not entry["id"]:
                continue
            if entry["id"] in have_rm_sess:
                continue
            actions.append({
                "action": "remove_session",
                "module_number": mod_num,
                "module_title": mod_titles.get(mod_num, ""),
                "session_id": entry["id"],
                "session_title": entry["title"],
                "reason": "Enforced by deterministic validator (already covered by user's answers).",
            })
            flags.append(f"added_remove_session_M{mod_num}S{sess_num}")

    # 6) Enforce min-session floor (≥60): if we'd fall below, back off session-level removals (newest first)
    total_sessions_in_course = sum(len(m.get("master_sessions") or []) for m in course)
    removed_sessions_count = sum(len((m.get("master_sessions") or [])) for i, m in enumerate(course, 1) if i in final_rm_mods)
    removed_sessions_count += sum(1 for a in actions if a.get("action") == "remove_session")
    remaining = total_sessions_in_course - removed_sessions_count
    if remaining < 60:
        flags.append("min_session_floor_triggered")
        # Drop trailing remove_session actions until we're back at >=60
        kept = []
        # Walk actions in reverse and drop remove_session entries one by one
        for a in reversed(actions):
            if a.get("action") == "remove_session" and remaining < 60:
                remaining += 1
                continue  # skip this removal (drop it)
            kept.append(a)
        actions = list(reversed(kept))

    plan["customisation_plan"] = actions

    # 7) Rebuild final_modules summary deterministically (more reliable than trusting LLM)
    final_modules = []
    final_rm_mods = {a.get("module_number") for a in actions if a.get("action") == "remove_module"}
    sess_removed_count_by_mod = {}
    for a in actions:
        if a.get("action") == "remove_session":
            sess_removed_count_by_mod[a.get("module_number")] = sess_removed_count_by_mod.get(a.get("module_number"), 0) + 1
    position = 0
    total_final_sessions = 0
    for i, mod in enumerate(course, 1):
        total_in_mod = len(mod.get("master_sessions") or [])
        if i in final_rm_mods:
            status = "removed"
            final_count = 0
            sess_removed = total_in_mod
        else:
            position += 1
            status = "locked" if i in (14, 15) else "kept"
            sess_removed = sess_removed_count_by_mod.get(i, 0)
            final_count = max(0, total_in_mod - sess_removed)
            total_final_sessions += final_count
        final_modules.append({
            "position": position if status != "removed" else None,
            "module_number": i,
            "module_title": mod.get("title", ""),
            "status": status,
            "sessions_removed": sess_removed,
            "final_session_count": final_count,
        })
    plan["final_modules"] = final_modules
    plan["total_modules_final"] = sum(1 for m in final_modules if m["status"] != "removed")
    plan["total_sessions_final"] = total_final_sessions
    plan["locked_modules"] = [14, 15]
    existing_flags = list(plan.get("conservative_flags") or [])
    plan["conservative_flags"] = existing_flags + flags
    return plan


@api_router.post("/customize/generate")
async def generate_customization(req: CustomizeRequest, supa_user: dict = Depends(get_supabase_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    user_id = supa_user.get("id")
    # Feb 2026, lifetime cap of 4 personalised-path generations per user.
    snap = _profile_snapshot(user_id)
    used = int(snap.get("customize_generations_count") or 0)
    if used >= CUSTOMIZE_GENERATION_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "reason": "customize_generation_limit_reached",
                "message": (
                    f"You've already generated a personalised path "
                    f"{CUSTOMIZE_GENERATION_LIMIT} times. Please stick with your "
                    "current plan or contact support if you need another regenerate."
                ),
                "generations_used": used,
                "generations_limit": CUSTOMIZE_GENERATION_LIMIT,
            },
        )

    # Build course structure for the prompt
    modules_for_prompt = []
    for i, mod in enumerate(req.course_structure):
        sessions = mod.get('master_sessions', [])
        sess_list = []
        for j, s in enumerate(sessions):
            sess_list.append({
                "session_number": j + 1,
                "session_title": s.get('title', ''),
                "session_id": s.get('id', ''),
            })
        modules_for_prompt.append({
            "module_number": i + 1,
            "module_title": mod.get('title', ''),
            "sessions": sess_list,
        })

    # Build answers for the prompt
    answers_for_prompt = []
    for a in req.answers:
        answer_val = a.get('answer')
        if isinstance(answer_val, list):
            answer_val = ', '.join(str(v) for v in answer_val)
        elif isinstance(answer_val, dict):
            answer_val = json_module.dumps(answer_val)
        answers_for_prompt.append({
            "question_text": a.get('question_text', ''),
            "selected_value": str(answer_val) if answer_val is not None else 'not answered',
            "purpose": a.get('purpose', ''),
        })

    user_message_text = json_module.dumps({
        "course_title": req.course_title,
        "course_structure": modules_for_prompt,
        "user_answers": answers_for_prompt,
        "free_text": req.free_text or "",
    }, indent=2)

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"customize-{uuid.uuid4()}",
            system_message=CUSTOMIZE_SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-haiku-4-5-20251001")

        response = await chat.send_message(UserMessage(text=user_message_text))

        # Parse JSON from response (strip markdown fences if present)
        response_text = response.strip()
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            lines = [l for l in lines if not l.strip().startswith('```')]
            response_text = '\n'.join(lines)

        plan = json_module.loads(response_text)
        plan = _validate_and_normalize_plan(plan, req)
        _bump_customize_generations(user_id)
        # Estimate LLM cost so the ₹500 pool also reflects customize spend.
        try:
            _bump_pari_cost(user_id, _estimate_llm_cost_inr(
                _approx_tokens(user_message_text) + _approx_tokens(CUSTOMIZE_SYSTEM_PROMPT),
                _approx_tokens(response or ""),
            ))
        except Exception:
            pass
        return plan

    except json_module.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response: {e}")
        logger.error(f"Raw response: {response_text[:500]}")
        # Fall back to a deterministic plan, validator can build a complete plan
        # from an empty Claude response.
        fallback = _validate_and_normalize_plan({
            "user_profile_summary": "Generated from your answers (AI summariser unavailable). Path personalised by rule engine.",
            "customisation_plan": [],
            "final_modules": [],
            "conservative_flags": ["llm_parse_failed_fallback"],
        }, req)
        _bump_customize_generations(user_id)
        return fallback
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        # Same fallback for any LLM error (502, budget exceeded, timeout, etc.)
        fallback = _validate_and_normalize_plan({
            "user_profile_summary": "Generated from your answers (AI summariser unavailable). Path personalised by rule engine.",
            "customisation_plan": [],
            "final_modules": [],
            "conservative_flags": ["llm_unavailable_fallback"],
        }, req)
        _bump_customize_generations(user_id)
        return fallback


# ---------------- Visual Card Image Generation ----------------
class VisualGenRequest(BaseModel):
    card_id: str
    title: str = ''
    description: str = ''


VISUAL_STYLE_PROMPT = (
    "Ultra-clean minimal vector illustration for a premium finance education app called Valuevade. "
    "Aesthetic: soft pastel pink background (#F2E6EE or #EAD9E5), elegant modern flat design, "
    "thin geometric lines, rounded corners, subtle depth, lots of whitespace. "
    "Strict color palette: primary blue #246BFD, purple accent #6A5CFF, pink accent #FF6AC1, "
    "success green #10B981, dark text #1A1A2E. "
    "Style is editorial and calm, like a high-end finance textbook. "
    "No photographs, no realistic people, no busy backgrounds, no cluttered text, no logos. "
    "Focus: a single clear visual metaphor with minimal annotations. "
    "Square 1024x1024 composition."
)


@api_router.post("/visual/generate")
async def generate_visual(req: VisualGenRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    prompt_subject = req.title.strip() or 'Finance concept'
    if req.description:
        prompt_subject += f". Context: {req.description.strip()[:400]}"

    full_prompt = (
        f"Create a conceptual diagram illustrating: {prompt_subject}. "
        f"{VISUAL_STYLE_PROMPT}"
    )

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"visual-{req.card_id}-{uuid.uuid4()}",
            system_message="You are an expert visual designer creating educational illustrations for a premium finance learning app.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

        _text, images = await chat.send_message_multimodal_response(
            UserMessage(text=full_prompt)
        )

        if not images:
            raise HTTPException(status_code=500, detail="No image generated")

        img = images[0]
        mime = img.get('mime_type') or 'image/png'
        data = img.get('data') or ''
        data_url = f"data:{mime};base64,{data}"

        logger.info(f"Generated visual for card {req.card_id} ({len(data)} b64 chars)")
        return {"image_url": data_url, "card_id": req.card_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Visual generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")


@api_router.delete("/waitlist/{entry_id}")
async def delete_waitlist_entry(entry_id: str, payload=Depends(verify_token)):
    deleted = _supabase_delete(
        f"waitlist?id=eq.{_urlparse.quote(entry_id)}"
    ) or []
    if not deleted:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"deleted": True}


# ---------------- Interview Response Evaluation ----------------
class InterviewEvalRequest(BaseModel):
    question: str
    response: str
    context: Optional[str] = ''
    evaluation_criteria: Optional[dict] = None
    model_answer: Optional[str] = ''
    session_title: Optional[str] = ''
    question_id: Optional[str] = None  # used for cache key


INTERVIEW_EVAL_SYSTEM_PROMPT = """You are a Senior Analyst at a top investment firm conducting a mock interview for a finance student at Valuevade. Your job is to evaluate the candidate's spoken/typed response to an interview question.

You will receive:
- The interview question
- The candidate's response
- Optional setup/context for the question
- Evaluation criteria (a JSONB object, may contain any of: must_cover, key_points, keywords, bonus_points, red_flags, or arbitrary fields that describe what a strong answer looks like)
- Optional sample strong answer

You MUST evaluate the candidate's response and return STRICT JSON in this exact shape (no markdown, no prose):

{
  "scores": {
    "technical": <integer 1-5>,
    "communication": <integer 1-5>,
    "structure": <integer 1-5>,
    "overall": <integer 1-5>
  },
  "feedback": {
    "strengths": ["<2-4 specific bullet points referring to THIS exact answer>"],
    "improvements": ["<2-4 specific bullet points referring to THIS exact answer>"]
  }
}

SCORING RUBRIC (1-5):
- technical: Accuracy of finance concepts, coverage of the must_cover / key_points from evaluation_criteria, correct formulas/numbers. 5 = mastery; 3 = mostly correct with gaps; 1 = fundamentally wrong.
- communication: Clarity, conciseness, use of plain language, avoidance of filler. 5 = interview-ready; 1 = confusing or sparse.
- structure: Logical flow (conclusion-first, clear reasoning, transitions). 5 = textbook structure; 1 = rambling or one-dimensional.
- overall: Holistic judgement, not a strict average. Round to integer.

FEEDBACK RULES (CRITICAL, this is what makes the feedback useful):
1. Every bullet MUST reference something specific the candidate actually said or omitted. Quote short phrases or call out concrete numbers/concepts.
2. NEVER produce generic feedback like "Good answer" or "Add more detail". Always say what specifically was good and what specifically to improve.
3. If the response is very short or off-topic, say so plainly.
4. Keep bullets under 25 words each. Crisp, like a real interviewer.
5. Calibrate tone to the finance domain, you're mentoring, not grading.
6. If evaluation_criteria.red_flags triggered, surface them in improvements.
7. If evaluation_criteria.bonus_points achieved, highlight in strengths.
8. Use the sample_strong_answer only as a reference, do NOT ask the candidate to memorize it.

Return ONLY the JSON object. No code fences. No preamble."""


@api_router.post("/interview/evaluate")
async def evaluate_interview_response(req: InterviewEvalRequest):
    # Feb 2026, session-level interview practice disabled to cut per-user
    # AI cost (~40% reduction). This was the platform's only Claude Sonnet
    # 4.5 call path. Users now get their interview practice through the
    # dedicated /mock-interview flow (Haiku, much cheaper). Return 410 Gone
    # so any stale FE still on old code fails loudly instead of billing us.
    raise HTTPException(
        status_code=410,
        detail={
            "reason": "session_interview_disabled",
            "message": "Session-level interview practice is no longer available. Use Mock Interview instead.",
        },
    )
    # ---- legacy body preserved below; unreachable ----
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    resp_text = (req.response or '').strip()
    if len(resp_text) < 10:
        raise HTTPException(status_code=400, detail="Response too short to evaluate")

    # Build normalised response hash for caching: whitespace-collapsed, lowercased.
    normalised = re.sub(r'\s+', ' ', resp_text.lower()).strip()
    response_hash = hashlib.sha256(normalised.encode('utf-8')).hexdigest()

    # Cache lookup, only when we have a question_id to scope the key.
    if req.question_id:
        cached = await db.interview_eval_cache.find_one(
            {"question_id": req.question_id, "response_hash": response_hash},
            {"_id": 0, "scores": 1, "feedback": 1},
        )
        if cached and cached.get('scores') and cached.get('feedback'):
            logger.info(f"[interview-eval] cache hit q={req.question_id} h={response_hash[:8]}")
            return {
                "scores": cached['scores'],
                "feedback": cached['feedback'],
                "cached": True,
            }

    payload = {
        "session_title": req.session_title or '',
        "question": req.question or '',
        "context": req.context or '',
        "candidate_response": resp_text,
        "evaluation_criteria": req.evaluation_criteria or {},
        "sample_strong_answer": (req.model_answer or '')[:1200],
    }

    user_message_text = json_module.dumps(payload, indent=2)

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"interview-eval-{uuid.uuid4()}",
            system_message=INTERVIEW_EVAL_SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        response = await chat.send_message(UserMessage(text=user_message_text))

        # Strip markdown fences if the model added any
        response_text = (response or '').strip()
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            lines = [l for l in lines if not l.strip().startswith('```')]
            response_text = '\n'.join(lines)

        result = json_module.loads(response_text)

        # Minimal validation + sanitisation
        scores = result.get('scores') or {}
        feedback = result.get('feedback') or {}

        def clamp(v, lo=1, hi=5):
            try:
                n = int(round(float(v)))
            except (TypeError, ValueError):
                n = lo
            return max(lo, min(hi, n))

        def str_list(v):
            if not isinstance(v, list):
                return []
            out = []
            for item in v:
                if isinstance(item, str) and item.strip():
                    out.append(item.strip())
                elif isinstance(item, dict):
                    txt = item.get('text') or item.get('point') or ''
                    if txt:
                        out.append(str(txt).strip())
            return out[:6]

        clean = {
            "scores": {
                "technical": clamp(scores.get('technical')),
                "communication": clamp(scores.get('communication')),
                "structure": clamp(scores.get('structure')),
                "overall": clamp(scores.get('overall')),
            },
            "feedback": {
                "strengths": str_list(feedback.get('strengths')) or ["You took a clear stance, good starting point"],
                "improvements": str_list(feedback.get('improvements')) or ["Try leading with the conclusion for extra impact"],
            },
        }

        # Persist to cache (best-effort; ignore Mongo write errors).
        if req.question_id:
            try:
                await db.interview_eval_cache.update_one(
                    {"question_id": req.question_id, "response_hash": response_hash},
                    {
                        "$set": {
                            "question_id": req.question_id,
                            "response_hash": response_hash,
                            "scores": clean["scores"],
                            "feedback": clean["feedback"],
                            "response_preview": resp_text[:240],
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        },
                        "$setOnInsert": {
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        },
                    },
                    upsert=True,
                )
                logger.info(f"[interview-eval] cache store q={req.question_id} h={response_hash[:8]}")
            except Exception as cache_err:
                logger.warning(f"[interview-eval] cache write failed: {cache_err}")

        return {**clean, "cached": False}

    except json_module.JSONDecodeError as e:
        logger.error(f"Failed to parse interview eval response: {e}")
        logger.error(f"Raw response: {(response_text or '')[:500]}")
        raise HTTPException(status_code=502, detail="AI returned invalid response format")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Interview evaluation failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI evaluation failed: {str(e)}")


# ----------------------- Voice transcription (Whisper) ----------------------

# Allowed audio mime/extension hints, Whisper accepts mp3, mp4, mpeg, mpga,
# m4a, wav, webm. Browser MediaRecorder typically produces audio/webm.
_ALLOWED_AUDIO_EXTS = {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "ogg"}
_MAX_AUDIO_BYTES = 25 * 1024 * 1024  # Whisper hard limit


@api_router.post("/voice/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(default="en"),
    prompt: Optional[str] = Form(default=None),
):
    """
    Transcribe a short audio clip recorded in the browser to text using
    OpenAI Whisper (whisper-1) via the Emergent LLM key. Used by the
    Interview practice flow so users can speak their answer instead of
    typing it.
    """
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="Speech-to-text service is not configured")

    # Validate extension
    filename = audio.filename or "audio.webm"
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'webm'
    if ext not in _ALLOWED_AUDIO_EXTS:
        # MediaRecorder sometimes sends 'blob' as filename, fall back to webm
        ext = 'webm'
        filename = 'audio.webm'

    # Read into memory and validate size (Whisper limit is 25MB)
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio upload")
    if len(data) > _MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file exceeds 25MB limit")

    # Whisper SDK expects a file-like object with a name attribute
    import io
    buf = io.BytesIO(data)
    buf.name = filename

    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        kwargs = {
            "file": buf,
            "model": "whisper-1",
            "response_format": "json",
        }
        if language:
            kwargs["language"] = language
        if prompt:
            kwargs["prompt"] = prompt[:1024]
        response = await stt.transcribe(**kwargs)
        text = getattr(response, "text", None)
        if text is None and isinstance(response, dict):
            text = response.get("text")
        if not text:
            raise HTTPException(status_code=500, detail="Transcription returned empty result")
        return {"text": text.strip()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# ----------------------- Wave 1 + Wave 2 endpoints --------------------------
# Admin panel, referrals, mock interview. Kept in a separate module so
# server.py stays bounded. MUST run BEFORE include_router so routes are picked up.
try:
    from wave_endpoints import register_wave_endpoints
    register_wave_endpoints(api_router, {
        "supabase_get": _supabase_get,
        "supabase_post": _supabase_post,
        "supabase_patch": _supabase_patch,
        "supabase_delete": _supabase_delete,
        "get_supabase_user": get_supabase_user,
        "emergent_llm_key": EMERGENT_LLM_KEY,
    })
except Exception as _e:
    logging.warning("[wave_endpoints] failed to register: %s", _e)

# ----------------------- Module 20 full interview simulations ----------------
try:
    from interview_sim_endpoints import register_interview_sim_endpoints, _ensure_admin as _ivsim_ensure_admin
    register_interview_sim_endpoints(api_router, {
        "supabase_get": _supabase_get,
        "supabase_post": _supabase_post,
        "supabase_patch": _supabase_patch,
        "supabase_delete": _supabase_delete,
        "get_supabase_user": get_supabase_user,
        "emergent_llm_key": EMERGENT_LLM_KEY,
        "bump_pari_cost": _bump_pari_cost,   # for exact interview LLM cost tracking
    })
    from free_trial_endpoints import register_free_trial_endpoints
    register_free_trial_endpoints(api_router, {
        "supabase_get": _supabase_get,
        "supabase_post": _supabase_post,
        "supabase_patch": _supabase_patch,
        "supabase_delete": _supabase_delete,
        "get_supabase_user": get_supabase_user,
        "ensure_admin": _ivsim_ensure_admin,
    })
    from guest_interview_sim_endpoints import register_guest_interview_sim_endpoints
    register_guest_interview_sim_endpoints(api_router, {
        "supabase_get": _supabase_get,
        "emergent_llm_key": EMERGENT_LLM_KEY,
    })
except Exception as _e:
    logging.warning("[interview_sim_endpoints] failed to register: %s", _e)

# ----------------------- Guest session (free trial) endpoints ---------------
try:
    import json as _json_mod
    import urllib.parse as _urlparse_mod
    from guest_session_endpoints import register_guest_session_endpoints
    register_guest_session_endpoints(api_router, {
        "supabase_get": _supabase_get,
        "urlparse_quote": _urlparse_mod.quote,
        "json": _json_mod,
    })
except Exception as _e:
    logging.warning("[guest_session_endpoints] failed to register: %s", _e)

# ----------------------- Wave 4 endpoints (payments + payouts) --------------
try:
    from payment_endpoints import register_payment_endpoints
    register_payment_endpoints(api_router, {
        "supabase_get": _supabase_get,
        "supabase_post": _supabase_post,
        "supabase_patch": _supabase_patch,
        "supabase_delete": _supabase_delete,
        "get_supabase_user": get_supabase_user,
    })
except Exception as _e:
    logging.warning("[payment_endpoints] failed to register: %s", _e)

# ─── Doubt chat endpoints (Pari quick + extended turns) ─────────────────────
try:
    from doubt_endpoints import register_doubt_endpoints
    register_doubt_endpoints(api_router, {
        "supabase_get": _supabase_get,
        "supabase_post": _supabase_post,
        "supabase_patch": _supabase_patch,
        "get_supabase_user": get_supabase_user,
        "emergent_llm_key": EMERGENT_LLM_KEY,
        "pari_is_over_budget": _pari_is_over_budget,
        "estimate_llm_cost_inr": _estimate_llm_cost_inr,
        "bump_pari_cost": _bump_pari_cost,
    })
except Exception as _e:
    logging.warning("[doubt_endpoints] failed to register: %s", _e)

# ─── Study plan endpoints ────────────────────────────────────────────────────
try:
    from study_plan_endpoints import register_study_plan_endpoints
    register_study_plan_endpoints(api_router, {
        "supabase_get": _supabase_get,
        "supabase_post": _supabase_post,
        "supabase_patch": _supabase_patch,
        "supabase_delete": _supabase_delete,
        "get_supabase_user": get_supabase_user,
    })
except Exception as _e:
    logging.warning("[study_plan_endpoints] failed to register: %s", _e)


from enterprise_endpoints import register_enterprise_endpoints
from resource_endpoints import register_resource_endpoints
register_enterprise_endpoints(api_router, get_supabase_user)
register_resource_endpoints(api_router, get_supabase_user)

app.include_router(api_router)

# CORS, the FastAPI/Starlette middleware (per CORS spec) rejects the combo
# of allow_credentials=True with origins=["*"]: the browser ignores the
# response. In production set CORS_ORIGINS to a comma-separated list of
# trusted origins (e.g. "https://app.valuevade.com,https://valuevade.com").
# For local dev the default "*" is fine; we degrade to credentials=False
# when wildcards are present so the response is still spec-compliant.
_cors_origins_env = (os.environ.get('CORS_ORIGINS') or '*').strip()
_cors_origins = [o.strip() for o in _cors_origins_env.split(',') if o.strip()] or ['*']
_cors_allow_credentials = '*' not in _cors_origins
if '*' in _cors_origins:
    import logging as _cors_log
    _cors_log.getLogger(__name__).warning(
        "CORS_ORIGINS not set, defaulting to '*' (allow all origins). "
        "Set CORS_ORIGINS in backend/.env for production."
    )

app.add_middleware(
    CORSMiddleware,
    allow_credentials=_cors_allow_credentials,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
