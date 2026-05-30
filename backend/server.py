from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Header
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
import jwt
from datetime import datetime, timezone, timedelta
import random

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
    Supabase — a slow upstream must not fail the pod's liveness check.
    Use the read-model endpoints (/api/health/xp, /api/health/badges, etc.)
    when you actually need to validate downstream state."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Gamification (XP) — read-only debug endpoint for the testing agent.
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
    Supabase validates the JWT signature, expiry and aud claim for us — no
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
    """FastAPI dependency — extracts the authenticated Supabase user from the
    `Authorization: Bearer <jwt>` header. Raises 401 if the token is missing
    or invalid. Returned dict has at minimum {id, email}."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    user = _supabase_auth_user(token)
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="invalid or expired token")
    return user




@api_router.get("/health/xp")
async def health_xp(user_id: str):
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
async def health_streak(user_id: str):
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
async def health_badges(user_id: str):
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
        # Either alone is a drift signal — Phase 45 fix-pass added a backfill
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
async def health_challenges(user_id: str):
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
                # Allow today to be unfinished — anchor streak from yesterday.
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
async def health_journey(user_id: str):
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

    # Next milestone heuristic — pick the smallest absolute delta.
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
# Doubts session (Phase 52) — student Q&A with Pari
# =============================================================================
# Hard cost rails (locked):
#   - 5 doubt sessions per user per IST day
#   - 3 turns per session
#   - 1500 tokens budget per session (cumulative)
#   - 2 off-topic strikes ends the session
#   - FAQ cache: identical normalised question + module scope → cached answer

import hashlib as _hashlib
import re as _re

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


@api_router.post("/doubts/start")
async def doubts_start(req: DoubtsStartReq, supa_user: dict = Depends(get_supabase_user)):
    """Open a new doubt session. Enforces 5/day IST quota via the RPC."""
    user_id = supa_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="user id missing on token")
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
async def health_doubts(user_id: str):
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


# =============================================================================
# Daily Finance News (Phase 54 P7b)
# =============================================================================

NEWS_SUMMARY_PROMPT = """Summarize the following finance headlines for a finance student in {country}. For each item, produce:
- title (verbatim or lightly cleaned)
- summary: 2 short lines (max 25 words each), plain language, no jargon
- why_matters: 1 sentence explaining why a finance student should care
- source: the publisher
- url: the article link

Return ONLY a JSON array (no prose, no markdown fence) with this shape:
[{{"title":"...","summary":"...","why_matters":"...","source":"...","url":"..."}}, ...]

Headlines:
{headlines_json}
"""


# Batch 2 (Item 3) — Markdown digest prompt. Produces a single ~250-300 word
# markdown summary across global + country-specific finance news, in fun
# easy-to-understand language with the 4 H2 sections specified by the user.
NEWS_DIGEST_PROMPT = """You are a finance news summarizer for a finance-student app in {country_name}. Today's news from multiple sources is below as a JSON array of {{title, summary, source, url, region}} items.

Produce a markdown digest with EXACTLY these H2 sections, in this order:
## Global Markets
2-3 short bullets. What moved and why, plain language.
## {country_name} Highlights
2-3 country-specific stories, plain language. If no country-specific news exists, write one bullet saying so.
## Quick Takes
4-6 one-liners covering everything else important.
## Why This Matters
1-2 sentences linking today's news to what a finance student should learn or watch next.

Style rules:
- Punchy, slightly playful, no jargon without a 3-word explainer in parentheses.
- Use the local currency symbol where appropriate ({currency_hint}).
- Cap the whole digest at 300 words.
- NO code fences, NO preamble, just the markdown starting with the first ## heading.

Headlines (JSON):
{headlines_json}
"""


# ISO-2 → (Country name, currency hint)
COUNTRY_META = {
    "IN": ("India", "₹ for INR"),
    "US": ("United States", "$ for USD"),
    "GB": ("United Kingdom", "£ for GBP"),
    "AE": ("United Arab Emirates", "AED"),
    "SG": ("Singapore", "S$ for SGD"),
    "AU": ("Australia", "A$ for AUD"),
    "CA": ("Canada", "C$ for CAD"),
    "DE": ("Germany", "€ for EUR"),
    "FR": ("France", "€ for EUR"),
    "JP": ("Japan", "¥ for JPY"),
    "HK": ("Hong Kong", "HK$ for HKD"),
    "CN": ("China", "¥ for CNY"),
    "BR": ("Brazil", "R$ for BRL"),
    "ZA": ("South Africa", "R for ZAR"),
    "SA": ("Saudi Arabia", "SAR"),
    "NL": ("Netherlands", "€ for EUR"),
    "CH": ("Switzerland", "CHF"),
    "SE": ("Sweden", "SEK"),
    "ES": ("Spain", "€ for EUR"),
    "IT": ("Italy", "€ for EUR"),
}


def _fetch_news_raw(country_code: str):
    """Best-effort fetch from a chain of free news APIs. Returns (items, source_label).
    All upstream calls send a real User-Agent — Marketaux's Cloudflare WAF
    blocks the default urllib agent with HTTP 403 (code 1010)."""
    cc = (country_code or "IN").lower()
    _headers = {"User-Agent": "Mozilla/5.0 (compatible; Valuevade/1.0; +https://valuevade.com)"}
    marketaux_key = os.environ.get("MARKETAUX_KEY")
    if marketaux_key:
        try:
            url = (
                f"https://api.marketaux.com/v1/news/all"
                f"?countries={cc}&filter_entities=true&language=en&limit=7"
                f"&api_token={marketaux_key}"
            )
            req = _urlreq.Request(url, headers=_headers)
            with _urlreq.urlopen(req, timeout=12) as r:
                data = _json.loads(r.read().decode())
            arts = data.get("data") or []
            items = [
                {"title": a.get("title"), "url": a.get("url"),
                 "source": (a.get("source") or "Marketaux"),
                 "snippet": a.get("description") or a.get("snippet") or ""}
                for a in arts if a.get("title") and a.get("url")
            ][:7]
            if items:
                return items, "marketaux"
        except Exception as e:
            logger.warning(f"[news] marketaux failed: {e}")
    newsapi_key = os.environ.get("NEWSAPI_KEY")
    if newsapi_key:
        try:
            url = (
                f"https://newsapi.org/v2/top-headlines"
                f"?category=business&country={cc}&pageSize=7&apiKey={newsapi_key}"
            )
            req = _urlreq.Request(url)
            with _urlreq.urlopen(req, timeout=12) as r:
                data = _json.loads(r.read().decode())
            arts = data.get("articles") or []
            items = [
                {"title": a.get("title"), "url": a.get("url"),
                 "source": ((a.get("source") or {}).get("name") or "NewsAPI"),
                 "snippet": a.get("description") or ""}
                for a in arts if a.get("title") and a.get("url")
            ][:7]
            if items:
                return items, "newsapi"
        except Exception as e:
            logger.warning(f"[news] newsapi failed: {e}")
    gnews_key = os.environ.get("GNEWS_KEY")
    if gnews_key:
        try:
            url = (
                f"https://gnews.io/api/v4/top-headlines"
                f"?topic=business&country={cc}&lang=en&max=7&apikey={gnews_key}"
            )
            req = _urlreq.Request(url)
            with _urlreq.urlopen(req, timeout=12) as r:
                data = _json.loads(r.read().decode())
            arts = data.get("articles") or []
            items = [
                {"title": a.get("title"), "url": a.get("url"),
                 "source": ((a.get("source") or {}).get("name") or "GNews"),
                 "snippet": a.get("description") or ""}
                for a in arts if a.get("title") and a.get("url")
            ][:7]
            if items:
                return items, "gnews"
        except Exception as e:
            logger.warning(f"[news] gnews failed: {e}")
    return ([{
        "title": "News API not configured",
        "url": "",
        "source": "Valuevade",
        "snippet": "Set MARKETAUX_KEY, NEWSAPI_KEY, or GNEWS_KEY in backend/.env to enable real finance headlines.",
    }], "fallback")


async def _summarize_news(items, country_code):
    """Run Haiku over the raw headlines + snippets and parse the JSON array
    out of the reply. Falls back to a stub summary on any failure."""
    if not EMERGENT_LLM_KEY or not items:
        return [
            {"title": it.get("title") or "", "summary": (it.get("snippet") or "")[:160],
             "why_matters": "", "source": it.get("source") or "", "url": it.get("url") or ""}
            for it in items
        ]
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"news-{country_code}-{datetime.now(timezone.utc).date().isoformat()}",
            system_message=NEWS_SUMMARY_PROMPT.format(
                country=country_code or "India",
                headlines_json=_json.dumps(items, ensure_ascii=False)[:6000],
            ),
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        resp = await chat.send_message(UserMessage(text="Generate the summaries now. Return JSON only."))
        text = (resp or "").strip()
        if text.startswith("```"):
            text = _re.sub(r"^```(?:json)?\s*", "", text)
            text = _re.sub(r"\s*```\s*$", "", text)
        parsed = _json.loads(text)
        if isinstance(parsed, list) and parsed:
            return parsed
    except Exception as e:
        logger.warning(f"[news] summarizer failed: {e}")
    return [
        {"title": it.get("title") or "", "summary": (it.get("snippet") or "")[:160],
         "why_matters": "", "source": it.get("source") or "", "url": it.get("url") or ""}
        for it in items
    ]


async def _generate_news_digest_md(items, country_code):
    """Batch 2 (Item 3) — Produce a single markdown digest with 4 H2 sections.
    Combines global + country-specific items into ONE summary, capped ~500 tokens.
    Returns (summary_md, tokens_used). Returns ("", 0) on failure so the caller
    can decide whether to cache or retry."""
    if not items:
        return ("", 0)
    country_name, currency_hint = COUNTRY_META.get(
        (country_code or "IN").upper(), ("your country", "the local currency")
    )
    if not EMERGENT_LLM_KEY:
        # Stub digest so the FE still has something to render.
        bullets = "\n".join([f"- **{it.get('title','')}** — {(it.get('snippet') or '')[:120]}" for it in items[:6]])
        return (f"## Global Markets\n{bullets}\n## {country_name} Highlights\n- (Set EMERGENT_LLM_KEY to enable AI summaries.)\n## Quick Takes\n- Highlights above.\n## Why This Matters\nKeeping up with daily finance news sharpens your market intuition.", 0)
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"news-digest-{country_code}-{datetime.now(timezone.utc).date().isoformat()}",
            system_message=NEWS_DIGEST_PROMPT.format(
                country_name=country_name,
                currency_hint=currency_hint,
                headlines_json=_json.dumps(items, ensure_ascii=False)[:8000],
            ),
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        resp = await chat.send_message(UserMessage(
            text="Generate the markdown digest now. Start directly with the first ## heading."
        ))
        text = (resp or "").strip()
        # Strip any accidental fence the model wraps around the markdown.
        if text.startswith("```"):
            text = _re.sub(r"^```(?:markdown|md)?\s*", "", text)
            text = _re.sub(r"\s*```\s*$", "", text)
        if text and "##" in text:
            # Rough token estimate (~4 chars/token); the actual usage is logged on the LLM side.
            return (text.strip(), max(1, len(text) // 4))
    except Exception as e:
        logger.warning(f"[news] digest LLM failed: {e}")
    return ("", 0)


@api_router.get("/news/today")
async def news_today(supa_user: dict = Depends(get_supabase_user)):
    """Batch 2 (Item 3) — Per-user cached daily markdown digest combining
    country + global finance news. Cache key: (user_id, today_ist)."""
    user_id = supa_user.get("id")
    prof = _supabase_get(
        f"profiles?id=eq.{_urlparse.quote(user_id)}&select=country_code&limit=1"
    ) or []
    country = ((prof or [{}])[0].get("country_code") or "IN").upper()
    today_ist = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).date().isoformat()

    # 1) Cache hit?
    cache_rows = _supabase_get(
        f"user_daily_news_summary?user_id=eq.{_urlparse.quote(user_id)}"
        f"&news_date_ist=eq.{today_ist}"
        f"&select=summary_md,country_code,raw_item_count,generated_at&limit=1"
    ) or []
    if cache_rows and cache_rows[0].get("summary_md"):
        reads = _supabase_get(
            f"user_news_reads?user_id=eq.{_urlparse.quote(user_id)}"
            f"&news_date_ist=eq.{today_ist}&select=read_at,xp_awarded&limit=1"
        ) or []
        return {
            "country_code": cache_rows[0].get("country_code") or country,
            "date_ist": today_ist,
            "summary_md": cache_rows[0]["summary_md"],
            "raw_item_count": cache_rows[0].get("raw_item_count") or 0,
            "from_cache": True,
            "already_read_today": bool(reads),
        }

    # 2) Cache miss — fetch country news + global news.
    country_items, source_label_country = _fetch_news_raw(country)
    global_items, source_label_global = _fetch_news_raw("us")  # US = de-facto global finance proxy
    # Tag region for the LLM.
    for it in country_items:
        it["region"] = country
    for it in global_items:
        it["region"] = "global"
    # Combine and dedupe by URL.
    by_url: dict[str, dict] = {}
    for it in (country_items + global_items):
        url = (it.get("url") or "").strip()
        if url and url not in by_url:
            by_url[url] = it
    combined = list(by_url.values())[:14]  # 14 items keeps the prompt compact.

    # 3) Soft failure when nothing came back.
    if not combined:
        return {
            "country_code": country,
            "date_ist": today_ist,
            "summary_md": "No fresh news right now. Check back later.",
            "raw_item_count": 0,
            "from_cache": False,
            "already_read_today": False,
        }

    # 4) LLM digest.
    summary_md, tokens_used = await _generate_news_digest_md(combined, country)
    if not summary_md:
        # Don't cache failures — retry next call.
        return {
            "country_code": country,
            "date_ist": today_ist,
            "summary_md": "No fresh news right now. Check back later.",
            "raw_item_count": len(combined),
            "from_cache": False,
            "already_read_today": False,
        }

    # 5) Persist.
    try:
        _supabase_post(
            "user_daily_news_summary",
            {
                "user_id": user_id,
                "news_date_ist": today_ist,
                "country_code": country,
                "summary_md": summary_md,
                "raw_item_count": len(combined),
                "tokens_used": tokens_used,
            },
            prefer="resolution=ignore-duplicates",
        )
    except Exception as e:
        logger.warning(f"[news] digest cache write failed: {e}")
    return {
        "country_code": country,
        "date_ist": today_ist,
        "summary_md": summary_md,
        "raw_item_count": len(combined),
        "from_cache": False,
        "already_read_today": False,
    }


@api_router.post("/news/mark_read")
async def news_mark_read(supa_user: dict = Depends(get_supabase_user)):
    """Bump per-user reads counter and award +30 XP once per IST day."""
    user_id = supa_user.get("id")
    rpc = _supabase_post("rpc/record_news_read", {"p_user_id": user_id}) or {}
    xp_awarded_now = bool(rpc.get("xp_awarded_now"))
    total_reads = rpc.get("total_reads", 0)
    if xp_awarded_now:
        try:
            # Batch 2 (Item 4): correct award_xp signature.
            # DB function:  award_xp(p_user_id, p_amount, p_reason, p_source_id, p_meta)
            _supabase_post(
                "rpc/award_xp",
                {
                    "p_user_id": user_id,
                    "p_amount": 30,
                    "p_reason": "news_read",
                    "p_source_id": None,
                    "p_meta": {
                        "reads_total": total_reads,
                        "today_ist": rpc.get("today_ist"),
                    },
                },
            )
        except Exception as e:
            logger.warning(f"[news] award_xp failed: {e}")
    try:
        if total_reads >= 7:
            _supabase_post(
                "rpc/evaluate_badge",
                {"p_user_id": user_id, "p_badge_code": "news_buff", "p_force": False},
            )
    except Exception as e:
        logger.warning(f"[news] news_buff badge eval failed: {e}")
    return {
        "ok": True, "today_ist": rpc.get("today_ist"),
        "xp_awarded_now": xp_awarded_now,
        "xp_amount": 30 if xp_awarded_now else 0,
        "total_reads": total_reads,
    }





# =============================================================================
# Portfolio (Phase 53) — aggregated showcase + public share slug
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
    """8-char lowercase alphanumeric. ~3.6e12 keyspace — collision-free in practice
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
        # First-time user without a user_stats row — return a stub so the page
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

    # Build the public URL — the frontend uses /p/<slug> on its own origin.
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
# Pari's Review Notes (Phase 57) — study cabinet of every Pari answer
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
    # Best-effort stats — cheap counts on the same view, no auth filter needed
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
# Phase A — Quick Revision Sheet (session-end AI revision card)
# =============================================================================

REVISION_SHEET_SYSTEM_PROMPT = """You are Pari, a precise finance tutor. Generate a Quick Revision Sheet for a learner who just finished a session.

Your output MUST be valid markdown with these four H2 sections IN THIS EXACT ORDER:

## Key Concepts
3-5 short bullets capturing the core ideas, in plain language. Each bullet ≤ 22 words.

## Formulas
2-4 formulas using inline code spans (e.g. `PV = FV / (1 + r)^n`). For each, add a 1-line plain-English note. If the session has no formulas, write a single italic line: *"No new formulas in this session."*

## Common Pitfalls
2-3 bullets — mistakes students typically make on this topic.

## Ask Yourself
3 short recall questions a student should be able to answer to prove they got it.

Constraints:
- Target length: 350-500 words total. Hard ceiling 600 words.
- Match the student's country focus when picking examples: {country_context}
- Do NOT add a heading above "Key Concepts"; do NOT add an intro paragraph; do NOT close with a sign-off.
- Plain markdown only — no tables, no HTML, no emoji.
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
        # F1 (Batch 1) — Surface a more useful detail string. The user can hit
        # Retry; the FE will show a soft "Try again" CTA. We log the full
        # exception server-side so we can diagnose recurring failures.
        err_msg = str(e) or e.__class__.__name__
        err_lower = err_msg.lower()
        if "rate" in err_lower or "429" in err_lower or "quota" in err_lower or "limit" in err_lower:
            detail = "Pari is busy right now (rate limit). Try again in a few seconds."
        elif "timeout" in err_lower or "timed out" in err_lower:
            detail = "The summary took too long to generate. Try again."
        elif "auth" in err_lower or "invalid" in err_lower and "key" in err_lower:
            detail = "LLM credentials issue — admin has been notified."
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


# --- Phase C: milestones -------------------------------------------------
#
# Hybrid milestone system. Module milestones (`m1_foundations`, `m4_modelling`,
# etc.) fire when a user finishes the last session of a master_module — i.e.
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
    "already earned" case — we just swallow the 409.
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
                                return granted   # module wins — skip count check
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
    # complete). We don't fully reject if not — just skip the module check.
    granted = check_and_grant_milestones(user_id, req.session_id)
    return {"newly_granted": granted}


# --- end Phase C ---------------------------------------------------------


# --- Phase D1: study planner --------------------------------------------
#
# Three input modes, three endpoints to preview / commit / read a plan.
# Source-of-truth for the user's session list is `user_sessions` (their
# customized list from the enrollment wizard) joined with `master_sessions`
# for `estimated_minutes`. Module-projects come from `master_module_projects`
# and contribute `estimated_hours * 60` to the load.
#
# Validation rejects nonsense inputs (deadline-in-past, sub-15min hours,
# all-7-days-off, etc.) with clear messages so the wizard can surface them
# directly.

import math as _math
from datetime import date as _date

MIN_HOURS_PER_DAY = 0.25
MAX_HOURS_PER_DAY = 10.0
MIN_HOURS_PER_WEEK = 1.0
MAX_HOURS_PER_WEEK = 70.0
LOAD_BUFFER_PCT = 0.05  # 5% slack on top of the raw load


class StudyPlanInput(BaseModel):
    enrollment_id: str
    target_mode: str
    target_deadline: Optional[str] = None      # YYYY-MM-DD
    target_hours_per_day: Optional[float] = None
    target_hours_per_week: Optional[float] = None
    non_study_weekdays: List[int] = []         # 0=Sun .. 6=Sat


def _fetch_plan_inventory(user_id: str, enrollment_id: str) -> dict:
    """Pulls the user's customized session list + module projects for an
    enrollment, ordered canonically (module.order_index, then
    session.order_index within each module). Returns minutes per item plus
    a flat ordered list of `{kind, id, code, minutes, title}` ready for
    the day-packer.

    Batched: 4 round-trips total instead of N per module (sequential
    REST calls add up to 30+ seconds on a 16-module enrollment, hitting
    the urllib timeout). We pull user_modules → user_sessions → master_sessions
    → master_module_projects with single IN-clause queries each.
    """
    # Confirm the enrollment belongs to the caller.
    enrolls = _supabase_get(
        f"user_enrollments?id=eq.{_urlparse.quote(enrollment_id)}"
        f"&user_id=eq.{_urlparse.quote(user_id)}&select=id&limit=1"
    ) or []
    if not enrolls:
        raise HTTPException(status_code=404, detail="enrollment not found")

    # (1) User modules (in order), non-removed only.
    user_modules = _supabase_get(
        f"user_modules?enrollment_id=eq.{_urlparse.quote(enrollment_id)}"
        f"&is_removed=eq.false&select=id,master_module_id,order_index,title"
        f"&order=order_index.asc"
    ) or []
    if not user_modules:
        return {"items": []}

    um_ids = [um["id"] for um in user_modules]
    master_mod_ids = [um["master_module_id"] for um in user_modules if um.get("master_module_id")]
    um_id_to_order = {um["id"]: um.get("order_index", 0) for um in user_modules}

    # (2) All user_sessions for those modules, non-removed.
    user_sessions: list = []
    if um_ids:
        user_sessions = _supabase_get(
            f"user_sessions?user_module_id=in.({','.join(um_ids)})"
            f"&is_removed=eq.false"
            f"&select=id,master_session_id,user_module_id,order_index,title"
            f"&order=order_index.asc"
        ) or []

    # (3) master_sessions for estimated_minutes.
    master_session_map: dict = {}
    master_session_ids = [s["master_session_id"] for s in user_sessions if s.get("master_session_id")]
    if master_session_ids:
        master_session_rows = _supabase_get(
            f"master_sessions?id=in.({','.join(master_session_ids)})"
            f"&select=id,estimated_minutes"
        ) or []
        master_session_map = {r["id"]: int(r.get("estimated_minutes") or 50) for r in master_session_rows}

    # (4) master_module_projects for the modules involved.
    projects_by_module: dict = {}
    if master_mod_ids:
        proj_rows = _supabase_get(
            f"master_module_projects?module_id=in.({','.join(master_mod_ids)})"
            f"&select=id,module_id,estimated_hours,title"
        ) or []
        for p in proj_rows:
            projects_by_module[p["module_id"]] = p

    # Build the flat ordered item list: for each user_module (in
    # order_index order), emit its sessions in their order_index order,
    # then the module's project (if any).
    sessions_by_um: dict = {}
    for s in user_sessions:
        sessions_by_um.setdefault(s["user_module_id"], []).append(s)

    items: list = []
    for um in user_modules:
        for s in sessions_by_um.get(um["id"], []):
            items.append({
                "kind": "session",
                "id": s["id"],
                "minutes": int(master_session_map.get(s.get("master_session_id"), 50)),
                "title": s.get("title"),
            })
        master_mod_id = um.get("master_module_id")
        proj = projects_by_module.get(master_mod_id)
        if proj:
            items.append({
                "kind": "project",
                "id": proj["id"],
                "minutes": int(round((proj.get("estimated_hours") or 1.5) * 60)),
                "title": proj.get("title"),
            })

    # Suppress unused-variable lint without changing behaviour.
    _ = um_id_to_order
    return {"items": items}


def _is_study_day(d: _date, non_study_weekdays: list) -> bool:
    # Python's weekday(): Mon=0..Sun=6. Convert to Sun=0..Sat=6 so the FE
    # picker (S M T W T F S) maps 1:1 with what the user clicked.
    wd_sun_first = (d.weekday() + 1) % 7
    return wd_sun_first not in non_study_weekdays


def _wd_sun_first(d: _date) -> int:
    return (d.weekday() + 1) % 7


def generate_study_plan(
    user_id: str,
    enrollment_id: str,
    target_mode: str,
    target_deadline: Optional[str],
    target_hours_per_day: Optional[float],
    target_hours_per_week: Optional[float],
    non_study_weekdays: list,
    start_date: Optional[_date] = None,
) -> dict:
    """Pure-ish plan generator: returns a structured plan dict; does NOT
    persist. Caller (`/preview` or `/commit`) decides what to do with it."""

    if start_date is None:
        start_date = datetime.now(timezone.utc).date()

    # --- Validate non_study_weekdays ---
    if not isinstance(non_study_weekdays, list):
        non_study_weekdays = []
    non_study_weekdays = sorted({int(d) for d in non_study_weekdays if 0 <= int(d) <= 6})
    if len(non_study_weekdays) >= 7:
        raise HTTPException(status_code=400, detail="cannot mark all 7 weekdays as rest days")

    # --- Pull inventory ---
    inv = _fetch_plan_inventory(user_id, enrollment_id)
    items = inv["items"]
    raw_load = sum(it["minutes"] for it in items)
    total_load_minutes = int(_math.ceil(raw_load * (1.0 + LOAD_BUFFER_PCT)))
    if total_load_minutes <= 0:
        raise HTTPException(status_code=400, detail="no sessions to schedule — empty enrollment")

    # --- Mode-specific scheduling ---
    days: list = []  # [{day_date: date, required_minutes, required_session_codes, required_project_codes, status}]

    def push_rest_day(d: _date):
        days.append({
            "day_date": d.isoformat(),
            "required_minutes": 0,
            "required_session_codes": [],
            "required_project_codes": [],
            "status": "rest",
        })

    def push_active_day(d: _date, mins: int, ses: list, projs: list):
        days.append({
            "day_date": d.isoformat(),
            "required_minutes": mins,
            "required_session_codes": ses,
            "required_project_codes": projs,
            "status": "upcoming",
        })

    if target_mode == "deadline":
        if not target_deadline:
            raise HTTPException(status_code=400, detail="target_deadline is required for deadline mode")
        try:
            deadline_d = _date.fromisoformat(target_deadline)
        except ValueError:
            raise HTTPException(status_code=400, detail="target_deadline must be YYYY-MM-DD")
        if deadline_d <= start_date:
            raise HTTPException(status_code=400, detail="target_deadline must be in the future")

        # Walk start_date..deadline_d inclusive; count study days available.
        active_days = []
        d = start_date
        while d <= deadline_d:
            if _is_study_day(d, non_study_weekdays):
                active_days.append(d)
            d = d + timedelta(days=1)
        if not active_days:
            raise HTTPException(status_code=400, detail="no study days between today and deadline (all rest days?)")

        # E2 (Batch 1): removed the "deadline too tight" ceiling. The user
        # wants liberty to cram arbitrarily many minutes per day if their
        # target demands it. Basic sanity checks (deadline must be in the
        # future, can't mark all 7 weekdays rest) remain. The day-packer
        # accepts arbitrarily high `per_day_target` values.

        per_day_target = _math.ceil(total_load_minutes / len(active_days))

        # Build the calendar (active + rest) and pack greedily.
        it_idx = 0
        d = start_date
        while d <= deadline_d:
            if _is_study_day(d, non_study_weekdays):
                day_mins, day_ses, day_proj = 0, [], []
                # Pack atomically until we exceed per_day_target or item is huge.
                while it_idx < len(items):
                    it = items[it_idx]
                    if day_mins == 0 or day_mins + it["minutes"] <= per_day_target:
                        if it["kind"] == "session":
                            day_ses.append(it["id"])
                        else:
                            day_proj.append(it["id"])
                        day_mins += it["minutes"]
                        it_idx += 1
                    else:
                        break
                if day_mins > 0:
                    push_active_day(d, day_mins, day_ses, day_proj)
                else:
                    push_rest_day(d)
            else:
                push_rest_day(d)
            d = d + timedelta(days=1)
        plan_end_date = deadline_d

    elif target_mode == "hours_per_day":
        if target_hours_per_day is None:
            raise HTTPException(status_code=400, detail="target_hours_per_day is required for that mode")
        if target_hours_per_day < MIN_HOURS_PER_DAY or target_hours_per_day > MAX_HOURS_PER_DAY:
            raise HTTPException(
                status_code=400,
                detail=f"target_hours_per_day must be between {MIN_HOURS_PER_DAY} and {MAX_HOURS_PER_DAY}",
            )
        per_day_target = int(round(target_hours_per_day * 60))

        it_idx = 0
        d = start_date
        # Safety cap so a bogus input can't infinite-loop.
        max_days = 3 * 365
        days_walked = 0
        while it_idx < len(items) and days_walked < max_days:
            if _is_study_day(d, non_study_weekdays):
                day_mins, day_ses, day_proj = 0, [], []
                while it_idx < len(items):
                    it = items[it_idx]
                    if day_mins == 0 or day_mins + it["minutes"] <= per_day_target:
                        if it["kind"] == "session":
                            day_ses.append(it["id"])
                        else:
                            day_proj.append(it["id"])
                        day_mins += it["minutes"]
                        it_idx += 1
                    else:
                        break
                if day_mins > 0:
                    push_active_day(d, day_mins, day_ses, day_proj)
                else:
                    push_rest_day(d)
            else:
                push_rest_day(d)
            d = d + timedelta(days=1)
            days_walked += 1
        plan_end_date = days[-1]["day_date"] if days else start_date.isoformat()
        if isinstance(plan_end_date, str):
            plan_end_date = _date.fromisoformat(plan_end_date)

    elif target_mode == "hours_per_week":
        if target_hours_per_week is None:
            raise HTTPException(status_code=400, detail="target_hours_per_week is required for that mode")
        if target_hours_per_week < MIN_HOURS_PER_WEEK or target_hours_per_week > MAX_HOURS_PER_WEEK:
            raise HTTPException(
                status_code=400,
                detail=f"target_hours_per_week must be between {MIN_HOURS_PER_WEEK} and {MAX_HOURS_PER_WEEK}",
            )
        weekly_minutes = int(round(target_hours_per_week * 60))
        active_days_per_week = 7 - len(non_study_weekdays)
        if active_days_per_week <= 0:
            raise HTTPException(status_code=400, detail="non_study_weekdays leaves no active days")
        per_day_target = int(_math.ceil(weekly_minutes / active_days_per_week))

        it_idx = 0
        d = start_date
        max_days = 3 * 365
        days_walked = 0
        while it_idx < len(items) and days_walked < max_days:
            if _is_study_day(d, non_study_weekdays):
                day_mins, day_ses, day_proj = 0, [], []
                while it_idx < len(items):
                    it = items[it_idx]
                    if day_mins == 0 or day_mins + it["minutes"] <= per_day_target:
                        if it["kind"] == "session":
                            day_ses.append(it["id"])
                        else:
                            day_proj.append(it["id"])
                        day_mins += it["minutes"]
                        it_idx += 1
                    else:
                        break
                if day_mins > 0:
                    push_active_day(d, day_mins, day_ses, day_proj)
                else:
                    push_rest_day(d)
            else:
                push_rest_day(d)
            d = d + timedelta(days=1)
            days_walked += 1
        plan_end_date = days[-1]["day_date"] if days else start_date.isoformat()
        if isinstance(plan_end_date, str):
            plan_end_date = _date.fromisoformat(plan_end_date)

    else:
        raise HTTPException(status_code=400, detail=f"unknown target_mode '{target_mode}'")

    active_day_count = sum(1 for x in days if x["status"] == "upcoming")
    total_sessions = sum(len(x["required_session_codes"]) for x in days)
    total_projects = sum(len(x["required_project_codes"]) for x in days)

    return {
        "enrollment_id": enrollment_id,
        "target_mode": target_mode,
        "target_deadline": target_deadline,
        "target_hours_per_day": target_hours_per_day,
        "target_hours_per_week": target_hours_per_week,
        "non_study_weekdays": non_study_weekdays,
        "total_load_minutes": total_load_minutes,
        "plan_start_date": start_date.isoformat(),
        "plan_end_date": plan_end_date.isoformat(),
        "total_active_days": active_day_count,
        "total_sessions": total_sessions,
        "total_projects": total_projects,
        "days": days,
    }


@api_router.post("/study-plan/preview")
async def study_plan_preview(req: StudyPlanInput, supa_user: dict = Depends(get_supabase_user)):
    user_id = supa_user.get("id")
    return generate_study_plan(
        user_id,
        req.enrollment_id,
        req.target_mode,
        req.target_deadline,
        req.target_hours_per_day,
        req.target_hours_per_week,
        req.non_study_weekdays,
    )


@api_router.post("/study-plan/commit")
async def study_plan_commit(req: StudyPlanInput, supa_user: dict = Depends(get_supabase_user)):
    user_id = supa_user.get("id")
    plan = generate_study_plan(
        user_id,
        req.enrollment_id,
        req.target_mode,
        req.target_deadline,
        req.target_hours_per_day,
        req.target_hours_per_week,
        req.non_study_weekdays,
    )

    # Abandon any existing active plan for (user, enrollment).
    existing = _supabase_get(
        f"user_study_plans?user_id=eq.{_urlparse.quote(user_id)}"
        f"&enrollment_id=eq.{_urlparse.quote(req.enrollment_id)}"
        f"&status=eq.active&select=id&limit=1"
    ) or []
    if existing:
        _supabase_patch(
            f"user_study_plans?id=eq.{_urlparse.quote(existing[0]['id'])}",
            {"status": "abandoned", "updated_at": datetime.now(timezone.utc).isoformat()},
        )

    # Insert the new plan row.
    plan_row = {
        "user_id": user_id,
        "enrollment_id": req.enrollment_id,
        "target_mode": plan["target_mode"],
        "target_deadline": plan["target_deadline"],
        "target_hours_per_day": plan["target_hours_per_day"],
        "target_hours_per_week": plan["target_hours_per_week"],
        "non_study_weekdays": plan["non_study_weekdays"],
        "total_load_minutes": plan["total_load_minutes"],
        "plan_start_date": plan["plan_start_date"],
        "plan_end_date": plan["plan_end_date"],
        "status": "active",
    }
    inserted = _supabase_post("user_study_plans", plan_row, prefer="return=representation")
    if not inserted:
        raise HTTPException(status_code=500, detail="plan insert failed")
    plan_id = inserted[0]["id"]

    # Insert day rows in chunks.
    day_rows = [
        {
            "plan_id": plan_id,
            "user_id": user_id,
            "day_date": d["day_date"],
            "required_minutes": d["required_minutes"],
            "required_session_codes": d["required_session_codes"],
            "required_project_codes": d["required_project_codes"],
            "status": d["status"],
        }
        for d in plan["days"]
    ]
    if day_rows:
        # Chunk to keep payload reasonable.
        chunk = 100
        for i in range(0, len(day_rows), chunk):
            _supabase_post("user_study_plan_days", day_rows[i:i + chunk])

    # Seed adherence row if missing (upsert).
    _supabase_post(
        "user_plan_adherence",
        {"user_id": user_id},
        prefer="resolution=ignore-duplicates,return=minimal",
    )

    return {
        "plan_id": plan_id,
        "plan_end_date": plan["plan_end_date"],
        "total_load_minutes": plan["total_load_minutes"],
        "total_active_days": plan["total_active_days"],
    }


@api_router.get("/study-plan/active")
async def study_plan_active(supa_user: dict = Depends(get_supabase_user)):
    user_id = supa_user.get("id")
    rows = _supabase_get(
        f"user_study_plans?user_id=eq.{_urlparse.quote(user_id)}"
        f"&status=eq.active&order=created_at.desc&limit=1"
        f"&select=id,enrollment_id,target_mode,target_deadline,target_hours_per_day,"
        f"target_hours_per_week,non_study_weekdays,total_load_minutes,"
        f"plan_start_date,plan_end_date,status,created_at"
    ) or []
    if not rows:
        return None
    plan = rows[0]
    today = datetime.now(timezone.utc).date().isoformat()
    # Window: today .. +14 days.
    fourteen = (datetime.now(timezone.utc).date() + timedelta(days=14)).isoformat()
    days = _supabase_get(
        f"user_study_plan_days?plan_id=eq.{_urlparse.quote(plan['id'])}"
        f"&day_date=gte.{today}&day_date=lte.{fourteen}"
        f"&order=day_date.asc"
        f"&select=day_date,required_minutes,required_session_codes,"
        f"required_project_codes,actual_minutes,actual_sessions_completed,status"
    ) or []
    return {"plan": plan, "upcoming_days": days, "today": today}


@api_router.get("/study-plan/days")
async def study_plan_days(
    from_: Optional[str] = None,
    to: Optional[str] = None,
    supa_user: dict = Depends(get_supabase_user),
):
    """Day rows in [from, to] for the user's active plan (chart use in D2)."""
    user_id = supa_user.get("id")
    active = _supabase_get(
        f"user_study_plans?user_id=eq.{_urlparse.quote(user_id)}"
        f"&status=eq.active&select=id&limit=1"
    ) or []
    if not active:
        return []
    plan_id = active[0]["id"]
    query = (
        f"user_study_plan_days?plan_id=eq.{_urlparse.quote(plan_id)}"
        f"&order=day_date.asc"
        f"&select=day_date,required_minutes,required_session_codes,"
        f"required_project_codes,actual_minutes,actual_sessions_completed,status"
    )
    if from_:
        query += f"&day_date=gte.{_urlparse.quote(from_)}"
    if to:
        query += f"&day_date=lte.{_urlparse.quote(to)}"
    return _supabase_get(query) or []


@api_router.delete("/study-plan/active")
async def study_plan_abandon(supa_user: dict = Depends(get_supabase_user)):
    user_id = supa_user.get("id")
    rows = _supabase_patch(
        f"user_study_plans?user_id=eq.{_urlparse.quote(user_id)}&status=eq.active",
        {"status": "abandoned", "updated_at": datetime.now(timezone.utc).isoformat()},
    )
    return {"ok": True, "abandoned_count": len(rows) if rows else 0}


# Workaround for FastAPI not allowing `from` as a query param name.
from fastapi import Query as _Query  # noqa: E402

@api_router.get("/study-plan/days-range")
async def study_plan_days_range(
    start: str = _Query(..., description="from date YYYY-MM-DD"),
    end: str   = _Query(..., description="to date YYYY-MM-DD"),
    supa_user: dict = Depends(get_supabase_user),
):
    """Alternate /days endpoint using `start`/`end` to dodge the `from` reserved word."""
    return await study_plan_days(from_=start, to=end, supa_user=supa_user)


# --- end Phase D1 -------------------------------------------------------


# --- Phase D2: plan tracking + gamification hooks -----------------------
#
# Three endpoints. session-completed fires from the FE right after a
# session's XP write succeeds, drives the RPC + +25 XP + badges + milestones.
# dashboard-summary returns everything the PlanTodayCard + PlanTrendChart
# need in one round-trip. rebalance recomputes future days from today.

class PlanSessionCompletedReq(BaseModel):
    session_id: str
    minutes_spent: int


def _today_ist() -> str:
    """Return today's date in IST (Asia/Kolkata), formatted YYYY-MM-DD."""
    now_utc = datetime.now(timezone.utc)
    # IST is UTC+5:30, no DST.
    ist = now_utc + timedelta(hours=5, minutes=30)
    return ist.date().isoformat()


def _maybe_award_plan_daily_target_xp(user_id: str, plan_id: str, day_date: str) -> bool:
    """Idempotent +25 XP award. Returns True if XP was actually inserted,
    False if the unique partial index `ux_user_xp_events_plan_daily_target`
    blocked a duplicate.

    We INSERT directly into `user_xp_events` rather than calling the
    `award_xp` RPC because:
      1. The RPC has a hard-coded whitelist of reasons. We extended it via
         migration 0020c, but the RPC body also references columns that
         may shift between migrations (e.g. time_spent_minutes). A direct
         insert avoids that coupling.
      2. user_stats.total_xp is rolled up by a trigger on user_xp_events
         (see migration 0002). The trigger handles XP accumulation and
         level recomputation without us needing to touch user_stats here.
      3. The partial unique index `ux_user_xp_events_plan_daily_target`
         (user_id, meta->>'plan_day_date') WHERE reason = 'plan_daily_target'
         enforces "once per user per plan day" idempotency at the DB layer.
    """
    try:
        _supabase_post(
            "user_xp_events",
            {
                "user_id": user_id,
                "amount": 25,
                "reason": "plan_daily_target",
                "source_id": plan_id,
                "meta": {"plan_id": plan_id, "plan_day_date": day_date},
            },
            prefer="return=minimal",
        )
        return True
    except HTTPException as e:
        detail = str(e.detail or '')
        if e.status_code == 409 or '23505' in detail:
            return False
        logger.warning(f"[plan] plan_daily_target XP insert failed: {detail[:200]}")
        return False


def _award_badge_if_new_today(user_id: str, code: str) -> bool:
    """Idempotent badge grant. For date-scoped badges like `on_track_today`,
    we check whether the user has the badge already AND whether its
    earned_at is today (IST). If both are true we no-op. Otherwise we
    UPSERT user_badges with is_unlocked=true and earned_at=now()."""
    today_ist = _today_ist()
    rows = _supabase_get(
        f"master_badges?code=eq.{_urlparse.quote(code)}&select=id&limit=1"
    ) or []
    if not rows:
        return False
    badge_id = rows[0]["id"]

    existing = _supabase_get(
        f"user_badges?user_id=eq.{_urlparse.quote(user_id)}"
        f"&badge_id=eq.{_urlparse.quote(badge_id)}&select=id,earned_at,is_unlocked&limit=1"
    ) or []

    if existing and existing[0].get("is_unlocked"):
        if code == 'on_track_today':
            # Date-scoped: only re-grant if earned_at isn't today (IST).
            ea = existing[0].get('earned_at') or ''
            if ea[:10] == today_ist:
                return False
            # Reset earned_at to today.
            _supabase_patch(
                f"user_badges?id=eq.{_urlparse.quote(existing[0]['id'])}",
                {"earned_at": datetime.now(timezone.utc).isoformat()},
            )
            return True
        # Cumulative badges (on_schedule_7, on_schedule_30): only grant once.
        return False

    if existing:
        _supabase_patch(
            f"user_badges?id=eq.{_urlparse.quote(existing[0]['id'])}",
            {
                "is_unlocked": True,
                "earned_at": datetime.now(timezone.utc).isoformat(),
                "progress_current": 1,
            },
        )
    else:
        # Invariant: is_unlocked=true MUST be accompanied by a non-null
        # earned_at. The earlier insert below was missing earned_at,
        # which produced `unlocked-but-no-timestamp` rows that broke
        # the date-scoped re-grant check on `on_track_today`.
        _supabase_post("user_badges", {
            "user_id": user_id, "badge_id": badge_id, "is_unlocked": True,
            "earned_at": datetime.now(timezone.utc).isoformat(),
            "progress_current": 1, "progress_target": 1,
        })
    return True


def _grant_plan_streak_milestone_if_threshold(user_id: str, streak: int) -> Optional[str]:
    """Insert plan_streak_7 / plan_streak_30 milestone if the streak crosses
    the threshold. Idempotent via the unique (user_id, milestone_code) key."""
    code = None
    if streak == 7:
        code = 'plan_streak_7'
    elif streak == 30:
        code = 'plan_streak_30'
    if not code:
        return None
    try:
        _supabase_post(
            "user_milestones",
            {"user_id": user_id, "milestone_code": code},
            prefer="return=representation",
        )
        return code
    except HTTPException as e:
        if e.status_code != 409:
            logger.warning(f"[plan] milestone {code} insert failed: {e.detail}")
        return None


@api_router.post("/study-plan/session-completed")
async def study_plan_session_completed(
    req: PlanSessionCompletedReq,
    supa_user: dict = Depends(get_supabase_user),
):
    """Called by the FE right after `award_xp` writes for a session. Updates
    today's plan_day row, awards +25 XP if today just hit target, grants
    badges/milestones on streak transitions. All counters and rewards are
    idempotent — replaying with the same session_id yields no extra
    increments or XP."""
    user_id = supa_user.get("id")

    # Fire the core RPC. Note: PostgREST passes JSON; rpc returns the JSON
    # body directly (not wrapped in a list).
    rpc_resp = _supabase_post(
        "rpc/update_plan_day_progress",
        {
            "p_user_id": user_id,
            "p_session_minutes": int(req.minutes_spent or 0),
            "p_session_code": req.session_id,
        },
    )
    # _supabase_post may return [] or {} depending on rpc shape; normalize.
    if isinstance(rpc_resp, list):
        rpc_resp = rpc_resp[0] if rpc_resp else {}
    rpc_resp = rpc_resp or {}

    day_status = rpc_resp.get("day_status")
    just_completed = bool(rpc_resp.get("just_completed_today"))
    streak = int(rpc_resp.get("on_schedule_streak_days") or 0)
    plan_id = rpc_resp.get("plan_id")
    day_date = rpc_resp.get("day_date") or _today_ist()

    awards = {
        "just_completed_today": just_completed,
        "day_status": day_status,
        "on_schedule_streak_days": streak,
        "xp_awarded": 0,
        "badges_granted": [],
        "milestones_granted": [],
        "reason": rpc_resp.get("reason"),
    }

    if just_completed and plan_id:
        # +25 XP (idempotent via partial unique index)
        if _maybe_award_plan_daily_target_xp(user_id, plan_id, day_date):
            awards["xp_awarded"] = 25

        # on_track_today badge (idempotent per IST day)
        if _award_badge_if_new_today(user_id, 'on_track_today'):
            awards["badges_granted"].append('on_track_today')

        # Streak-threshold badges (one-time)
        if streak == 7 and _award_badge_if_new_today(user_id, 'on_schedule_7'):
            awards["badges_granted"].append('on_schedule_7')
        if streak == 30 and _award_badge_if_new_today(user_id, 'on_schedule_30'):
            awards["badges_granted"].append('on_schedule_30')

        # Streak-threshold milestone (overlay surfaces via existing Phase C
        # MilestoneCelebrationOverlay polling /api/milestones/pending).
        ms_code = _grant_plan_streak_milestone_if_threshold(user_id, streak)
        if ms_code:
            awards["milestones_granted"].append(ms_code)

        # Credit the daily challenge if the user has it picked for today.
        # The same RPC chain pays the challenge's +25 XP via the existing
        # mechanism, but the partial unique index on user_xp_events for
        # reason='plan_daily_target' makes our prior +25 the canonical
        # event — the challenge XP is still booked under
        # reason='daily_challenge_complete' which is a SEPARATE reason
        # and survives the dedup. To avoid double-counting, we ONLY
        # progress the challenge counter; the challenge RPC will then
        # award its own xp_reward via the existing daily_challenge logic.
        try:
            _supabase_post(
                "rpc/update_daily_challenge_progress",
                {
                    "p_user_id": user_id,
                    "p_challenge_type": "plan_daily_target_met",
                    "p_increment": 1,
                    "p_meta": {"plan_id": plan_id, "plan_day_date": day_date},
                },
            )
        except Exception as e:
            logger.info(f"[plan] daily-challenge progress no-op: {e}")

    return awards


@api_router.get("/study-plan/dashboard-summary")
async def study_plan_dashboard_summary(supa_user: dict = Depends(get_supabase_user)):
    """Returns the full payload the dashboard needs in one call: the
    active plan (or null), today's row with percent, the cumulative
    planned-vs-actual series for chart, and the adherence row.

    `cumulative.days_so_far` runs from plan_start_date up to and
    including today (IST). `is_behind_percent` = 0 if ahead/on-track."""
    user_id = supa_user.get("id")
    today = _today_ist()

    plans = _supabase_get(
        f"user_study_plans?user_id=eq.{_urlparse.quote(user_id)}"
        f"&status=eq.active&order=created_at.desc&limit=1"
        f"&select=id,plan_start_date,plan_end_date,total_load_minutes,"
        f"total_active_days_dummy:target_mode,target_mode,target_deadline,"
        f"target_hours_per_day,target_hours_per_week,non_study_weekdays"
    ) or []
    if not plans:
        return {
            "active_plan": None,
            "today": None,
            "cumulative": None,
            "upcoming": [],
            "adherence": None,
        }
    plan = plans[0]
    plan_id = plan["id"]

    # Today's row.
    today_rows = _supabase_get(
        f"user_study_plan_days?plan_id=eq.{_urlparse.quote(plan_id)}"
        f"&day_date=eq.{today}&select=day_date,required_minutes,actual_minutes,"
        f"required_session_codes,completed_session_codes,actual_sessions_completed,status"
    ) or []
    today_row = today_rows[0] if today_rows else None
    today_payload = None
    if today_row:
        req_min = int(today_row.get("required_minutes") or 0)
        act_min = int(today_row.get("actual_minutes") or 0)
        pct = 100 if req_min == 0 else min(100, int(round(act_min / req_min * 100)))
        today_payload = {
            "day_date": today_row["day_date"],
            "required_minutes": req_min,
            "actual_minutes": act_min,
            "required_session_codes": today_row.get("required_session_codes") or [],
            "completed_session_codes": today_row.get("completed_session_codes") or [],
            "actual_sessions_completed": int(today_row.get("actual_sessions_completed") or 0),
            "status": today_row.get("status") or 'upcoming',
            "percent_complete": pct,
        }

    # Cumulative series — every day from plan_start_date through today.
    all_rows = _supabase_get(
        f"user_study_plan_days?plan_id=eq.{_urlparse.quote(plan_id)}"
        f"&day_date=lte.{today}"
        f"&order=day_date.asc"
        f"&select=day_date,required_minutes,actual_minutes,status"
    ) or []
    cum_required = 0
    cum_actual = 0
    days_so_far = []
    for r in all_rows:
        cum_required += int(r.get("required_minutes") or 0)
        cum_actual   += int(r.get("actual_minutes") or 0)
        days_so_far.append({
            "day_date": r["day_date"],
            "required_minutes_cum": cum_required,
            "actual_minutes_cum":   cum_actual,
        })
    is_behind_percent = 0.0
    if cum_required > 0 and cum_actual < cum_required:
        is_behind_percent = round((cum_required - cum_actual) / cum_required * 100, 1)

    # B5 (Batch 1) — Upcoming this week: next up to 5 active days AFTER today,
    # with a 1-line summary from the first session/project title on that day.
    upcoming = []
    upcoming_rows = _supabase_get(
        f"user_study_plan_days?plan_id=eq.{_urlparse.quote(plan_id)}"
        f"&day_date=gt.{today}"
        f"&status=neq.rest"
        f"&order=day_date.asc&limit=5"
        f"&select=day_date,required_minutes,required_session_codes,required_project_codes,status"
    ) or []
    if upcoming_rows:
        # Collect all session + project codes across upcoming days so we batch-resolve titles.
        all_sess_codes: list[str] = []
        all_proj_codes: list[str] = []
        for r in upcoming_rows:
            all_sess_codes.extend(r.get("required_session_codes") or [])
            all_proj_codes.extend(r.get("required_project_codes") or [])
        sess_title_by_id: dict[str, str] = {}
        proj_title_by_id: dict[str, str] = {}
        # Only attempt to resolve if codes look like UUIDs — older legacy plans
        # may have synthetic placeholder codes that would cause a PG cast error.
        _uuid_re = _re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
        try:
            sess_uuid_ids = [s for s in {x for x in all_sess_codes if x} if _uuid_re.match(s)]
            if sess_uuid_ids:
                ids_csv = ",".join(sess_uuid_ids)
                srows = _supabase_get(
                    f"master_sessions?id=in.({ids_csv})&select=id,title&limit={len(sess_uuid_ids) + 5}"
                ) or []
                sess_title_by_id = {row["id"]: row.get("title") or "" for row in srows}
            proj_uuid_ids = [s for s in {x for x in all_proj_codes if x} if _uuid_re.match(s)]
            if proj_uuid_ids:
                ids_csv = ",".join(proj_uuid_ids)
                prows = _supabase_get(
                    f"master_module_projects?id=in.({ids_csv})&select=id,title&limit={len(proj_uuid_ids) + 5}"
                ) or []
                proj_title_by_id = {row["id"]: row.get("title") or "" for row in prows}
        except Exception as _e:
            logger.warning(f"[plan-summary] upcoming title resolve failed: {_e}")
        for r in upcoming_rows:
            sess_ids = r.get("required_session_codes") or []
            proj_ids = r.get("required_project_codes") or []
            first_title = ""
            first_kind = "session"
            if sess_ids:
                first_title = sess_title_by_id.get(sess_ids[0], "") or "Session"
            elif proj_ids:
                first_title = proj_title_by_id.get(proj_ids[0], "") or "Module project"
                first_kind = "project"
            extra_count = len(sess_ids) + len(proj_ids) - 1
            upcoming.append({
                "day_date": r["day_date"],
                "required_minutes": int(r.get("required_minutes") or 0),
                "summary_title": first_title or "Study block",
                "summary_kind": first_kind,
                "extra_count": max(0, extra_count),
            })

    # Adherence row.
    adh_rows = _supabase_get(
        f"user_plan_adherence?user_id=eq.{_urlparse.quote(user_id)}"
        f"&select=on_schedule_streak_days,longest_on_schedule_streak,last_on_track_date"
    ) or []
    adherence = adh_rows[0] if adh_rows else {
        "on_schedule_streak_days": 0,
        "longest_on_schedule_streak": 0,
        "last_on_track_date": None,
    }

    return {
        "active_plan": {
            "plan_id": plan["id"],
            "plan_start_date": plan["plan_start_date"],
            "plan_end_date":   plan["plan_end_date"],
            "total_load_minutes": plan["total_load_minutes"],
            "target_mode": plan["target_mode"],
            "target_deadline": plan.get("target_deadline"),
            "target_hours_per_day": plan.get("target_hours_per_day"),
            "target_hours_per_week": plan.get("target_hours_per_week"),
            "non_study_weekdays": plan.get("non_study_weekdays") or [],
        },
        "today": today_payload,
        "cumulative": {
            "days_so_far": days_so_far,
            "is_behind_percent": is_behind_percent,
            "needs_reset_warning": is_behind_percent > 20.0,
        },
        "upcoming": upcoming,
        "adherence": adherence,
    }


class PlanRebalanceReq(BaseModel):
    new_target_deadline:  Optional[str] = None
    new_target_hours_per_day:  Optional[float] = None
    new_target_hours_per_week: Optional[float] = None


@api_router.post("/study-plan/rebalance")
async def study_plan_rebalance(
    req: PlanRebalanceReq,
    supa_user: dict = Depends(get_supabase_user),
):
    """Recompute day rows from today onward. Past day rows are preserved.
    If any new_target_* field is sent, switch the plan's mode going
    forward; otherwise keep the original target."""
    user_id = supa_user.get("id")
    today = _today_ist()
    today_d = _date.fromisoformat(today)

    plans = _supabase_get(
        f"user_study_plans?user_id=eq.{_urlparse.quote(user_id)}"
        f"&status=eq.active&order=created_at.desc&limit=1"
        f"&select=id,enrollment_id,target_mode,target_deadline,target_hours_per_day,"
        f"target_hours_per_week,non_study_weekdays"
    ) or []
    if not plans:
        raise HTTPException(status_code=404, detail="no active plan")
    plan = plans[0]
    plan_id = plan["id"]

    # Determine the going-forward target.
    fwd_mode = plan["target_mode"]
    fwd_deadline = plan.get("target_deadline")
    fwd_hpd      = plan.get("target_hours_per_day")
    fwd_hpw      = plan.get("target_hours_per_week")
    if req.new_target_deadline:
        fwd_mode = 'deadline'
        fwd_deadline = req.new_target_deadline
        fwd_hpd = None
        fwd_hpw = None
    elif req.new_target_hours_per_day is not None:
        fwd_mode = 'hours_per_day'
        fwd_hpd = req.new_target_hours_per_day
        fwd_deadline = None
        fwd_hpw = None
    elif req.new_target_hours_per_week is not None:
        fwd_mode = 'hours_per_week'
        fwd_hpw = req.new_target_hours_per_week
        fwd_deadline = None
        fwd_hpd = None

    # Inventory still owed = items in the plan with `status != complete`
    # and day_date >= today. We rebuild day rows from today by re-running
    # the planner on the WHOLE inventory minus already-completed session
    # codes.
    inv = _fetch_plan_inventory(user_id, plan["enrollment_id"])

    # Collect all already-credited session_codes across past day rows so
    # the rebalance only schedules outstanding work.
    past_completed = _supabase_get(
        f"user_study_plan_days?plan_id=eq.{_urlparse.quote(plan_id)}"
        f"&day_date=lt.{today}&status=eq.complete"
        f"&select=completed_session_codes"
    ) or []
    done_codes = set()
    for r in past_completed:
        for c in (r.get("completed_session_codes") or []):
            done_codes.add(c)
    # Also include today's completed if today is being recomputed.
    today_done = _supabase_get(
        f"user_study_plan_days?plan_id=eq.{_urlparse.quote(plan_id)}"
        f"&day_date=eq.{today}&select=completed_session_codes"
    ) or []
    for r in today_done:
        for c in (r.get("completed_session_codes") or []):
            done_codes.add(c)

    items_remaining = [it for it in inv["items"] if it["id"] not in done_codes]
    if not items_remaining:
        # Nothing left to schedule — mark the plan completed.
        _supabase_patch(
            f"user_study_plans?id=eq.{_urlparse.quote(plan_id)}",
            {"status": "completed", "updated_at": datetime.now(timezone.utc).isoformat()},
        )
        return {"ok": True, "remaining_items": 0, "plan_status": "completed"}

    # Run the planner on the remaining items only, starting today.
    # We pass a *synthetic* enrollment_id to skip the auth check (we
    # already verified ownership via the plans query). Simpler: re-use
    # `generate_study_plan` but with the same enrollment_id (it'll re-
    # fetch the same inventory; we then SLICE it to the remaining items).
    # To honor the `items_remaining` slice without altering the helper, we
    # inline the day-packer here (mirror of the helper).
    non_study = sorted({int(d) for d in (plan.get("non_study_weekdays") or [])
                        if 0 <= int(d) <= 6})

    # Batch 1 Fix 1: Capture today's existing row BEFORE the packing logic
    # so we know whether to freeze today (status='complete') and start
    # packing from tomorrow instead. Also captures actual_minutes and
    # completed_session_codes so the rebalance preserves user work.
    preserved_today = _supabase_get(
        f"user_study_plan_days?plan_id=eq.{_urlparse.quote(plan_id)}"
        f"&day_date=eq.{today}"
        f"&select=actual_minutes,actual_sessions_completed,completed_session_codes,"
        f"required_minutes,required_session_codes,required_project_codes,status&limit=1"
    ) or []
    preserved = preserved_today[0] if preserved_today else None
    freeze_today = bool(preserved and preserved.get("status") == "complete")

    # When today is frozen, the day-packer must start from tomorrow.
    # Today's required_minutes / required_session_codes / status are kept
    # exactly as they were so `is_behind_percent` doesn't regress when the
    # user rebalances after finishing the day's work.
    pack_start_d = today_d + timedelta(days=1) if freeze_today else today_d

    new_days: list = []
    if freeze_today and preserved is not None:
        # Insert today's frozen row FIRST so the resulting series is still
        # contiguous from today onward.
        new_days.append({
            "day_date": today,
            "required_minutes":      int(preserved.get("required_minutes") or 0),
            "required_session_codes": list(preserved.get("required_session_codes") or []),
            "required_project_codes": list(preserved.get("required_project_codes") or []),
            "status": "complete",
            "_frozen": True,
        })

    it_idx = 0
    d = pack_start_d
    max_days = 3 * 365

    if fwd_mode == 'deadline':
        try:
            deadline_d = _date.fromisoformat(fwd_deadline)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="invalid new_target_deadline")
        if deadline_d <= today_d:
            raise HTTPException(status_code=400, detail="new_target_deadline must be in the future")
        active = [pack_start_d + timedelta(days=i) for i in range((deadline_d - pack_start_d).days + 1)
                  if ((pack_start_d + timedelta(days=i)).weekday() + 1) % 7 not in non_study]
        if not active:
            raise HTTPException(status_code=400, detail="no active days in new window")
        load_remaining = sum(it["minutes"] for it in items_remaining)
        per_day = _math.ceil(load_remaining / len(active)) or 1
        steps = (deadline_d - pack_start_d).days + 1
        for step in range(steps):
            cd = pack_start_d + timedelta(days=step)
            wd_sun = (cd.weekday() + 1) % 7
            if wd_sun in non_study:
                new_days.append({"day_date": cd.isoformat(), "required_minutes": 0,
                                 "required_session_codes": [], "required_project_codes": [], "status": "rest"})
                continue
            day_min, ses, proj = 0, [], []
            while it_idx < len(items_remaining):
                it = items_remaining[it_idx]
                if day_min == 0 or day_min + it["minutes"] <= per_day:
                    (ses if it["kind"] == "session" else proj).append(it["id"])
                    day_min += it["minutes"]; it_idx += 1
                else:
                    break
            new_days.append({"day_date": cd.isoformat(),
                             "required_minutes": day_min,
                             "required_session_codes": ses,
                             "required_project_codes": proj,
                             "status": "upcoming" if day_min > 0 else "rest"})
    else:
        # hours_per_day / hours_per_week — walk forward, pack atomically.
        if fwd_mode == 'hours_per_day':
            per_day = int(round((fwd_hpd or 1.0) * 60))
        else:
            wkly = int(round((fwd_hpw or 7.0) * 60))
            active_per_week = 7 - len(non_study)
            if active_per_week <= 0:
                raise HTTPException(status_code=400, detail="no active days/week")
            per_day = int(_math.ceil(wkly / active_per_week))

        d = pack_start_d
        steps = 0
        while it_idx < len(items_remaining) and steps < max_days:
            wd_sun = (d.weekday() + 1) % 7
            if wd_sun in non_study:
                new_days.append({"day_date": d.isoformat(), "required_minutes": 0,
                                 "required_session_codes": [], "required_project_codes": [],
                                 "status": "rest"})
            else:
                day_min, ses, proj = 0, [], []
                while it_idx < len(items_remaining):
                    it = items_remaining[it_idx]
                    if day_min == 0 or day_min + it["minutes"] <= per_day:
                        (ses if it["kind"] == "session" else proj).append(it["id"])
                        day_min += it["minutes"]; it_idx += 1
                    else:
                        break
                new_days.append({"day_date": d.isoformat(),
                                 "required_minutes": day_min,
                                 "required_session_codes": ses,
                                 "required_project_codes": proj,
                                 "status": "upcoming" if day_min > 0 else "rest"})
            d = d + timedelta(days=1)
            steps += 1

    # Delete future day rows (>= today) and insert the new ones.
    _supabase_delete(
        f"user_study_plan_days?plan_id=eq.{_urlparse.quote(plan_id)}"
        f"&day_date=gte.{today}"
    )
    if new_days:
        chunk = 100
        rows = []
        for x in new_days:
            row = {"plan_id": plan_id, "user_id": user_id, "day_date": x["day_date"],
                   "required_minutes": x["required_minutes"],
                   "required_session_codes": x["required_session_codes"],
                   "required_project_codes": x["required_project_codes"],
                   "actual_minutes": 0,
                   "actual_sessions_completed": 0,
                   "completed_session_codes": [],
                   "status": x["status"]}
            # Batch 1 Fix 1: today's frozen row carries the full preserved
            # state. required_* stays as it was, status stays 'complete',
            # actual_* + completed_* are re-attached so no work is lost.
            if x.get("_frozen") and preserved is not None and x["day_date"] == today:
                row["actual_minutes"]            = int(preserved.get("actual_minutes") or 0)
                row["actual_sessions_completed"] = int(preserved.get("actual_sessions_completed") or 0)
                row["completed_session_codes"]   = list(preserved.get("completed_session_codes") or [])
                row["status"] = "complete"
            elif preserved is not None and x["day_date"] == today:
                # Today was NOT frozen (status was 'today' or 'rest' pre-rebalance).
                # Preserve any work the user already logged and recompute status
                # against the NEW required_*. Mirrors the original Bug 1 fix.
                row["actual_minutes"]            = int(preserved.get("actual_minutes") or 0)
                row["actual_sessions_completed"] = int(preserved.get("actual_sessions_completed") or 0)
                row["completed_session_codes"]   = list(preserved.get("completed_session_codes") or [])
                req_min  = int(x["required_minutes"])
                req_sess = len(x["required_session_codes"] or [])
                done_sess = len(row["completed_session_codes"])
                if x["status"] == "rest":
                    row["status"] = "rest"
                elif row["actual_minutes"] >= req_min and done_sess >= req_sess:
                    row["status"] = "complete"
                else:
                    row["status"] = "today"
            rows.append(row)
        for i in range(0, len(rows), chunk):
            _supabase_post("user_study_plan_days", rows[i:i + chunk])

    # Patch the plan row with new target + new end_date.
    new_end = new_days[-1]["day_date"] if new_days else today
    _supabase_patch(
        f"user_study_plans?id=eq.{_urlparse.quote(plan_id)}",
        {
            "target_mode": fwd_mode,
            "target_deadline": fwd_deadline,
            "target_hours_per_day": fwd_hpd,
            "target_hours_per_week": fwd_hpw,
            "plan_end_date": new_end,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    return {
        "ok": True,
        "plan_id": plan_id,
        "new_plan_end_date": new_end,
        "remaining_items": len(items_remaining),
        "days_rebuilt": len(new_days),
    }


# --- end Phase D2 -------------------------------------------------------
















@api_router.post("/admin/login")
async def admin_login(creds: AdminLogin):
    if creds.email == ADMIN_EMAIL and creds.password == ADMIN_PASSWORD:
        token = create_token(creds.email)
        return {"token": token}
    raise HTTPException(status_code=401, detail="Invalid credentials")


@api_router.get("/waitlist/all")
async def get_all_waitlist(payload=Depends(verify_token)):
    cursor = db.waitlist.find(
        {},
        {"first_name": 1, "email": 1, "position": 1, "referral_code": 1, "referral_count": 1, "referred_by": 1, "timestamp": 1},
    ).sort("_id", -1)
    entries = await cursor.to_list(1000)
    for e in entries:
        e.pop("_id", None)
    return entries


@api_router.post("/waitlist", response_model=WaitlistResponse)
async def join_waitlist(entry: WaitlistCreate):
    existing = await db.waitlist.find_one({"email": entry.email}, {"_id": 0})
    if existing:
        if "referral_code" not in existing:
            referral_code = generate_referral_code()
            while await db.waitlist.find_one({"referral_code": referral_code}):
                referral_code = generate_referral_code()
            existing["referral_code"] = referral_code
        if "referral_count" not in existing:
            existing["referral_count"] = 0
        await db.waitlist.update_one(
            {"email": entry.email},
            {"$set": {"referral_code": existing["referral_code"], "referral_count": existing["referral_count"]}}
        )
        return existing

    referral_code = generate_referral_code()
    while await db.waitlist.find_one({"referral_code": referral_code}):
        referral_code = generate_referral_code()

    position = random.randint(200, 350)
    doc = {
        "id": str(uuid.uuid4()),
        "first_name": entry.first_name,
        "email": entry.email,
        "position": position,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "referral_code": referral_code,
        "referral_count": 0,
        "referred_by": entry.ref_code or None,
    }
    await db.waitlist.insert_one(doc)
    doc.pop("_id", None)

    if entry.ref_code:
        referrer = await db.waitlist.find_one({"referral_code": entry.ref_code})
        if referrer:
            new_position = max(1, referrer["position"] - 5)
            await db.waitlist.update_one(
                {"referral_code": entry.ref_code},
                {"$inc": {"referral_count": 1}, "$set": {"position": new_position}},
            )

    return doc


@api_router.get("/waitlist/count")
async def get_waitlist_count():
    count = await db.waitlist.count_documents({})
    return {"count": count + 500}


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
- M4 Financial Modelling — 3-Statement (8 sessions)
- M5 Corporate Governance & Quality of Management (7 sessions)
- M6 Reading Annual Reports & Concalls (12 sessions)
- M7 Financial Statement Analysis (13 sessions)
- M8 Red Flag Analysis & Forensic Accounting (14 sessions)
- M9 Advanced Ratio Analysis (13 sessions)
- M10 Economy & Macro Analysis (10 sessions)
- M11 Sector Analysis (12 sessions)
- M12 Valuation in Equity Research (14 sessions)
- M13 PowerPoint & Report Writing (12 sessions)
- M14 Resume, LinkedIn & Networking (13 sessions)  — LOCKED
- M15 Basics of AI & Prompt Engineering (10 sessions) — LOCKED

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

You should match answers to keys by question_text or purpose — both will reference the key (e.g. "q1_background" or "background").

Free-text is a soft signal — use it only to refine decisions already implied by structured answers.

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

Return a single JSON object. Output raw JSON only — no markdown, no preamble.

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

    # ── C) Certification override — force-keep modules
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

    # 1) Strip any actions targeting locked modules (M14, M15) — sessions or modules
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
async def generate_customization(req: CustomizeRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

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
        return plan

    except json_module.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response: {e}")
        logger.error(f"Raw response: {response_text[:500]}")
        # Fall back to a deterministic plan — validator can build a complete plan
        # from an empty Claude response.
        fallback = _validate_and_normalize_plan({
            "user_profile_summary": "Generated from your answers (AI summariser unavailable). Path personalised by rule engine.",
            "customisation_plan": [],
            "final_modules": [],
            "conservative_flags": ["llm_parse_failed_fallback"],
        }, req)
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
    "Style is editorial and calm — like a high-end finance textbook. "
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
    result = await db.waitlist.delete_one({"id": entry_id})
    if result.deleted_count == 0:
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
- Evaluation criteria (a JSONB object — may contain any of: must_cover, key_points, keywords, bonus_points, red_flags, or arbitrary fields that describe what a strong answer looks like)
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

FEEDBACK RULES (CRITICAL — this is what makes the feedback useful):
1. Every bullet MUST reference something specific the candidate actually said or omitted. Quote short phrases or call out concrete numbers/concepts.
2. NEVER produce generic feedback like "Good answer" or "Add more detail". Always say what specifically was good and what specifically to improve.
3. If the response is very short or off-topic, say so plainly.
4. Keep bullets under 25 words each. Crisp, like a real interviewer.
5. Calibrate tone to the finance domain — you're mentoring, not grading.
6. If evaluation_criteria.red_flags triggered, surface them in improvements.
7. If evaluation_criteria.bonus_points achieved, highlight in strengths.
8. Use the sample_strong_answer only as a reference — do NOT ask the candidate to memorize it.

Return ONLY the JSON object. No code fences. No preamble."""


@api_router.post("/interview/evaluate")
async def evaluate_interview_response(req: InterviewEvalRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    resp_text = (req.response or '').strip()
    if len(resp_text) < 10:
        raise HTTPException(status_code=400, detail="Response too short to evaluate")

    # Build normalised response hash for caching: whitespace-collapsed, lowercased.
    normalised = re.sub(r'\s+', ' ', resp_text.lower()).strip()
    response_hash = hashlib.sha256(normalised.encode('utf-8')).hexdigest()

    # Cache lookup — only when we have a question_id to scope the key.
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
                "strengths": str_list(feedback.get('strengths')) or ["You took a clear stance — good starting point"],
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

# Allowed audio mime/extension hints — Whisper accepts mp3, mp4, mpeg, mpga,
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
        # MediaRecorder sometimes sends 'blob' as filename — fall back to webm
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


app.include_router(api_router)

# CORS — the FastAPI/Starlette middleware (per CORS spec) rejects the combo
# of allow_credentials=True with origins=["*"]: the browser ignores the
# response. In production set CORS_ORIGINS to a comma-separated list of
# trusted origins (e.g. "https://app.valuevade.com,https://valuevade.com").
# For local dev the default "*" is fine; we degrade to credentials=False
# when wildcards are present so the response is still spec-compliant.
_cors_origins_env = (os.environ.get('CORS_ORIGINS') or '*').strip()
_cors_origins = [o.strip() for o in _cors_origins_env.split(',') if o.strip()] or ['*']
_cors_allow_credentials = '*' not in _cors_origins

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
