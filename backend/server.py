from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
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

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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
