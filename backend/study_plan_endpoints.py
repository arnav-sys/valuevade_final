"""
Study planner endpoints (preview / commit / active / days / session-completed /
dashboard-summary / drift-recovery / rebalance).
Extracted from server.py. Registered via register_study_plan_endpoints(api_router, deps).
"""
from __future__ import annotations

import logging
import math as _math
import re as _re
import urllib.parse as _urlparse
from datetime import datetime, timezone, timedelta
from datetime import date as _date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ─── Injected by register_study_plan_endpoints ───────────────────────────────
_supabase_get = None
_supabase_post = None
_supabase_patch = None
_supabase_delete = None
get_supabase_user = None


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


def _session_effective_minutes(video_duration_minutes) -> int:
    """Real video length (rounded) + 10 min fixed for quiz+sim, or a 15+10=25
    default when no video exists yet. Mirrors frontend `effectiveMinutes()`
    in utils/sessionTime.js so planner load always matches the course page."""
    if video_duration_minutes is not None:
        try:
            vd = float(video_duration_minutes)
            video_part = max(1, round(vd)) if vd > 0 else 15
        except (TypeError, ValueError):
            video_part = 15
    else:
        video_part = 15
    return video_part + 10


def _resolve_plan_day_items(rows: list) -> list:
    """Batch-resolve session/project titles + individual effective minutes
    for a list of `user_study_plan_days` rows (each with
    required_session_codes/required_project_codes) so charts can show a
    per-session tooltip. Returns a list of `items` arrays, same order/
    length as `rows` — one item per row: [{kind, id, title, minutes}, ...]."""
    _uuid_re = _re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
    all_sess_ids, all_proj_ids = set(), set()
    for r in rows:
        all_sess_ids.update(x for x in (r.get("required_session_codes") or []) if x and _uuid_re.match(x))
        all_proj_ids.update(x for x in (r.get("required_project_codes") or []) if x and _uuid_re.match(x))
    sess_map, proj_map = {}, {}
    try:
        if all_sess_ids:
            # `required_session_codes` stores `user_sessions.id` (the per-user copy,
            # not the master template) — resolve title from user_sessions, then
            # duration from the linked master_sessions row.
            usrows = _supabase_get(
                f"user_sessions?id=in.({','.join(all_sess_ids)})&select=id,title,master_session_id"
            ) or []
            master_ids = {u["master_session_id"] for u in usrows if u.get("master_session_id")}
            dur_by_master_id = {}
            if master_ids:
                mrows = _supabase_get(
                    f"master_sessions?id=in.({','.join(master_ids)})&select=id,video_duration_minutes"
                ) or []
                dur_by_master_id = {m["id"]: m.get("video_duration_minutes") for m in mrows}
            sess_map = {
                u["id"]: {"title": u.get("title") or "Session",
                          "minutes": _session_effective_minutes(dur_by_master_id.get(u.get("master_session_id")))}
                for u in usrows
            }
        if all_proj_ids:
            prows = _supabase_get(
                f"master_module_projects?id=in.({','.join(all_proj_ids)})&select=id,title,estimated_hours"
            ) or []
            proj_map = {r["id"]: {"title": r.get("title") or "Module project",
                                   "minutes": int(round((r.get("estimated_hours") or 1.5) * 60))}
                        for r in prows}
    except Exception as exc:
        logger.warning(f"[plan-summary] day-items title resolve failed: {exc}")
    out = []
    for r in rows:
        row_items = []
        for sid in (r.get("required_session_codes") or []):
            m = sess_map.get(sid)
            if m:
                row_items.append({"kind": "session", "id": sid, "title": m["title"], "minutes": m["minutes"]})
        for pid in (r.get("required_project_codes") or []):
            m = proj_map.get(pid)
            if m:
                row_items.append({"kind": "project", "id": pid, "title": m["title"], "minutes": m["minutes"]})
        out.append(row_items)
    return out


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

    # (3) master_sessions for video_duration_minutes → effective_minutes.
    # Formula: effective_minutes = round(video_duration_minutes or 15) + 10
    #   - video part  : actual video length (or 15 min when no video)
    #   - fixed part  : 10 min reserved for quiz + simulation
    master_session_map: dict = {}
    master_session_ids = [s["master_session_id"] for s in user_sessions if s.get("master_session_id")]
    if master_session_ids:
        try:
            master_session_rows = _supabase_get(
                f"master_sessions?id=in.({','.join(master_session_ids)})"
                f"&select=id,video_duration_minutes,estimated_minutes"
            ) or []
        except Exception:
            # Migration 0041 not yet applied — fall back to estimated_minutes only
            master_session_rows = _supabase_get(
                f"master_sessions?id=in.({','.join(master_session_ids)})"
                f"&select=id,estimated_minutes"
            ) or []
        master_session_map = {r["id"]: _session_effective_minutes(r.get("video_duration_minutes")) for r in master_session_rows}

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
            "items": [],
            "status": "rest",
        })

    def push_active_day(d: _date, mins: int, day_items: list):
        days.append({
            "day_date": d.isoformat(),
            "required_minutes": mins,
            "required_session_codes": [it["id"] for it in day_items if it["kind"] == "session"],
            "required_project_codes": [it["id"] for it in day_items if it["kind"] == "project"],
            "items": [
                {"kind": it["kind"], "id": it["id"],
                 "title": it.get("title") or ("Session" if it["kind"] == "session" else "Module project"),
                 "minutes": it["minutes"]}
                for it in day_items
            ],
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
                day_mins, day_items = 0, []
                # Pack atomically until we exceed per_day_target or item is huge.
                while it_idx < len(items):
                    it = items[it_idx]
                    if day_mins == 0 or day_mins + it["minutes"] <= per_day_target:
                        day_items.append(it)
                        day_mins += it["minutes"]
                        it_idx += 1
                    else:
                        break
                if day_mins > 0:
                    push_active_day(d, day_mins, day_items)
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
                day_mins, day_items = 0, []
                while it_idx < len(items):
                    it = items[it_idx]
                    if day_mins == 0 or day_mins + it["minutes"] <= per_day_target:
                        day_items.append(it)
                        day_mins += it["minutes"]
                        it_idx += 1
                    else:
                        break
                if day_mins > 0:
                    push_active_day(d, day_mins, day_items)
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
                day_mins, day_items = 0, []
                while it_idx < len(items):
                    it = items[it_idx]
                    if day_mins == 0 or day_mins + it["minutes"] <= per_day_target:
                        day_items.append(it)
                        day_mins += it["minutes"]
                        it_idx += 1
                    else:
                        break
                if day_mins > 0:
                    push_active_day(d, day_mins, day_items)
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


class PlanSessionCompletedReq(BaseModel):
    session_id: str
    minutes_spent: int


class PlanRebalanceReq(BaseModel):
    new_target_deadline:  Optional[str] = None
    new_target_hours_per_day:  Optional[float] = None
    new_target_hours_per_week: Optional[float] = None


def register_study_plan_endpoints(api_router: APIRouter, deps: dict):
    """Register all /study-plan/* and /dashboard/drift-recovery* routes."""
    global _supabase_get, _supabase_post, _supabase_patch, _supabase_delete, get_supabase_user

    _supabase_get = deps["supabase_get"]
    _supabase_post = deps["supabase_post"]
    _supabase_patch = deps["supabase_patch"]
    _supabase_delete = deps["supabase_delete"]
    get_supabase_user = deps["get_supabase_user"]

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
            f"&select=day_date,required_minutes,actual_minutes,status,"
            f"required_session_codes,required_project_codes"
        ) or []
        day_items_list = _resolve_plan_day_items(all_rows)
        cum_required = 0
        cum_actual = 0
        days_so_far = []
        for r, day_items in zip(all_rows, day_items_list):
            cum_required += int(r.get("required_minutes") or 0)
            cum_actual   += int(r.get("actual_minutes") or 0)
            days_so_far.append({
                "day_date": r["day_date"],
                "required_minutes_cum": cum_required,
                "actual_minutes_cum":   cum_actual,
                "required_minutes": int(r.get("required_minutes") or 0),
                "items": day_items,
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
            upcoming_items_list = _resolve_plan_day_items(upcoming_rows)
            for r, day_items in zip(upcoming_rows, upcoming_items_list):
                first = day_items[0] if day_items else None
                extra_count = len(day_items) - 1
                upcoming.append({
                    "day_date": r["day_date"],
                    "required_minutes": int(r.get("required_minutes") or 0),
                    "summary_title": (first["title"] if first else "Study block"),
                    "summary_kind": (first["kind"] if first else "session"),
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


    # ============================================================================
    # Sequential P2 — Step 5/5: Drift Recovery Banner
    # ============================================================================
    # Detect a >=70% weekly XP drop-off vs the prior 7-day window, and surface a
    # single soft-tone banner that links straight to the user's next-up session.
    # Dismissal sets `user_stats.drift_banner_dismissed_at = now()`; banner stays
    # hidden for 24h.
    #
    # Thresholds (per product spec, not knobs):
    #   PRIOR_XP_FLOOR = 100   # ignore users who were never active to begin with
    #   DROP_RATIO     = 0.30  # show only when recent_xp <= 30% of prior_xp
    #   COOLDOWN_HOURS = 24
    # ============================================================================

    _DRIFT_PRIOR_XP_FLOOR = 100
    _DRIFT_DROP_RATIO = 0.30
    _DRIFT_COOLDOWN_HOURS = 24


    def _drift_next_session(user_id: str) -> Optional[dict]:
        """Return the user's next-up session in the same shape the constellation
        map's white 'next-up' node points at: first non-completed session of the
        first unlocked-and-not-completed module in the active enrollment.

        Returns None when nothing is unlocked-and-incomplete (e.g. fresh user
        with no enrollment, or curriculum fully completed)."""
        uid_q = _urlparse.quote(user_id)
        # 1. Active enrollment.
        enrolls = _supabase_get(
            f"user_enrollments?user_id=eq.{uid_q}&status=eq.active"
            f"&select=id&order=enrolled_at.desc&limit=1"
        ) or []
        if not enrolls:
            return None
        enrollment_id = enrolls[0]["id"]
        # 2. v_module_progress_summary for this enrollment, picking the first
        #    unlocked-not-completed module by order_index.
        mods = _supabase_get(
            f"v_module_progress_summary?user_id=eq.{uid_q}"
            f"&enrollment_id=eq.{_urlparse.quote(enrollment_id)}"
            f"&is_unlocked=eq.true&is_completed=eq.false"
            f"&select=user_module_id,order_index,module_code,module_title"
            f"&order=order_index.asc&limit=1"
        ) or []
        if not mods:
            return None
        mod = mods[0]
        user_module_id = mod["user_module_id"]
        # 3. First non-completed user_session under that module by order_index.
        sessions = _supabase_get(
            f"user_sessions?user_module_id=eq.{_urlparse.quote(user_module_id)}"
            f"&is_completed=eq.false&is_removed=eq.false"
            f"&select=id,order_index,title&order=order_index.asc&limit=1"
        ) or []
        if not sessions:
            return None
        sess = sessions[0]
        module_order = int(mod.get("order_index") or 0)
        sess_order = int(sess.get("order_index") or 1)
        return {
            "id": sess["id"],
            "module_number": module_order,
            "session_number": f"{module_order}.{sess_order}",
            "title": sess.get("title") or "Continue session",
            "module_code": mod.get("module_code"),
            "module_title": mod.get("module_title"),
        }


    def _drift_xp_sums(user_id: str) -> tuple[int, int]:
        """Sum of `user_xp_events.amount` for the user split into two adjacent
        7-day windows: [now-7d, now] (recent) and [now-14d, now-7d) (prior).

        We compute in UTC; the IST nuance is irrelevant for a 7-day window
        comparison and the table doesn't store an IST timestamp directly."""
        uid_q = _urlparse.quote(user_id)
        now_utc = datetime.now(timezone.utc)
        cut_7d  = (now_utc - timedelta(days=7)).isoformat()
        cut_14d = (now_utc - timedelta(days=14)).isoformat()
        # Pull rows for the full 14-day window in a single round-trip; split in
        # Python. The table is keyed on created_at and amount, so this is cheap.
        rows = _supabase_get(
            f"user_xp_events?user_id=eq.{uid_q}"
            f"&created_at=gte.{_urlparse.quote(cut_14d)}"
            f"&select=amount,created_at&limit=2000"
        ) or []
        recent = 0
        prior  = 0
        for r in rows:
            try:
                amt = int(r.get("amount") or 0)
            except (TypeError, ValueError):
                amt = 0
            # created_at is ISO; lexicographic compare works because both are UTC.
            ts = r.get("created_at") or ""
            if ts >= cut_7d:
                recent += amt
            elif ts >= cut_14d:
                prior += amt
        return recent, prior


    @api_router.get("/dashboard/drift-recovery")
    async def dashboard_drift_recovery(supa_user: dict = Depends(get_supabase_user)):
        """Return whether the soft-tone drift banner should appear for the
        authenticated user, plus the data the banner needs to render.

        Eligibility (ALL must be true):
          • prior_xp >= 100         (was meaningfully active two weeks ago)
          • recent_xp <= prior_xp*.3 (dropped ≥70%)
          • next-up session resolvable
          • drift_banner_dismissed_at is NULL or older than 24h
        """
        user_id = supa_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="unknown user")

        # Cooldown gate first — cheapest check, also short-circuits the XP pull
        # for the 24h after a dismissal.
        stats = _supabase_get(
            f"user_stats?user_id=eq.{_urlparse.quote(user_id)}"
            f"&select=drift_banner_dismissed_at&limit=1"
        ) or []
        dismissed_at = (stats[0] if stats else {}).get("drift_banner_dismissed_at")
        if dismissed_at:
            try:
                dt = datetime.fromisoformat(dismissed_at.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) - dt < timedelta(hours=_DRIFT_COOLDOWN_HOURS):
                    return {"show": False, "reason": "dismissed_recently"}
            except (ValueError, TypeError):
                pass  # malformed → treat as not dismissed

        recent_xp, prior_xp = _drift_xp_sums(user_id)
        if prior_xp < _DRIFT_PRIOR_XP_FLOOR:
            return {"show": False, "reason": "prior_below_floor",
                    "recent_xp": recent_xp, "prior_xp": prior_xp}
        if recent_xp > int(prior_xp * _DRIFT_DROP_RATIO):
            return {"show": False, "reason": "not_drifting",
                    "recent_xp": recent_xp, "prior_xp": prior_xp}

        nxt = _drift_next_session(user_id)
        if not nxt:
            return {"show": False, "reason": "no_next_session",
                    "recent_xp": recent_xp, "prior_xp": prior_xp}

        return {
            "show": True,
            "recent_xp": recent_xp,
            "prior_xp":  prior_xp,
            "next_session": nxt,
        }


    @api_router.post("/dashboard/drift-recovery/dismiss")
    async def dashboard_drift_recovery_dismiss(supa_user: dict = Depends(get_supabase_user)):
        """Stamp `user_stats.drift_banner_dismissed_at = now()` so the banner is
        suppressed for the next 24h. Idempotent — upsert pattern matches the
        rest of the user_stats writes (Phase D2 followed the same shape)."""
        user_id = supa_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="unknown user")
        now_iso = datetime.now(timezone.utc).isoformat()
        # PATCH first; if no row exists, fall back to a tiny insert. This avoids
        # forcing a full upsert payload that would trample the streak/level columns.
        existing = _supabase_get(
            f"user_stats?user_id=eq.{_urlparse.quote(user_id)}&select=user_id&limit=1"
        ) or []
        if existing:
            _supabase_patch(
                f"user_stats?user_id=eq.{_urlparse.quote(user_id)}",
                {"drift_banner_dismissed_at": now_iso},
            )
        else:
            _supabase_post(
                "user_stats",
                {"user_id": user_id, "drift_banner_dismissed_at": now_iso},
                prefer="resolution=ignore-duplicates",
            )
        return {"ok": True, "drift_banner_dismissed_at": now_iso}









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
