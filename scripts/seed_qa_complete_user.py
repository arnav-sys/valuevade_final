"""
Seed a dedicated QA user with an active enrollment + all 3 capstones marked
completed so the CourseCompletePage's "Congratulations" branch can be
visually QA'd via the screenshot tool.

Usage:
    python3 /app/scripts/seed_qa_complete_user.py
"""
import os
import sys
import json
import uuid
from urllib import request, parse, error

SUPABASE_URL = os.environ.get("REACT_APP_SUPABASE_URL")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: REACT_APP_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from env.")
    sys.exit(1)

QA_EMAIL = "qa-complete@valuevade.test"
QA_PASSWORD = "QaComplete2026!"
QA_FULL_NAME = "Priya Kapoor"


def _req(method, path, body=None, extra_headers=None):
    url = f"{SUPABASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    req = request.Request(url, data=data, method=method, headers=headers)
    try:
        with request.urlopen(req, timeout=30) as r:
            raw = r.read().decode("utf-8")
            return r.status, (json.loads(raw) if raw else None)
    except error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}


def find_user_by_email(email):
    status, body = _req(
        "GET", f"/auth/v1/admin/users?page=1&per_page=200"
    )
    if status != 200:
        print(f"list users failed {status}: {body}")
        return None
    for u in body.get("users", []):
        if u.get("email") == email:
            return u
    return None


def ensure_user():
    existing = find_user_by_email(QA_EMAIL)
    if existing:
        print(f"[user] already exists: {existing['id']}")
        return existing["id"]
    status, body = _req(
        "POST",
        "/auth/v1/admin/users",
        body={
            "email": QA_EMAIL,
            "password": QA_PASSWORD,
            "email_confirm": True,
            "user_metadata": {"full_name": QA_FULL_NAME},
        },
    )
    if status not in (200, 201):
        print(f"[user] create failed {status}: {body}")
        sys.exit(1)
    uid = body["id"] if "id" in body else body.get("user", {}).get("id")
    print(f"[user] created: {uid}")
    return uid


def ensure_profile(uid):
    status, body = _req(
        "POST",
        "/rest/v1/profiles?on_conflict=id",
        body={
            "id": uid,
            "full_name": QA_FULL_NAME,
            "email": QA_EMAIL,
        },
        extra_headers={"Prefer": "resolution=merge-duplicates,return=representation"},
    )
    if status not in (200, 201):
        print(f"[profile] upsert non-fatal {status}: {body}")
    else:
        print(f"[profile] upserted for {uid}")


def get_master_path_id():
    status, body = _req(
        "GET",
        "/rest/v1/master_capstone_projects?select=path_id&limit=1",
    )
    if status == 200 and body:
        return body[0]["path_id"]
    return None


def ensure_enrollment(uid, master_path_id):
    # Check for existing
    status, body = _req(
        "GET",
        f"/rest/v1/user_enrollments?user_id=eq.{uid}&select=id,status",
    )
    if status == 200 and body:
        eid = body[0]["id"]
        print(f"[enrollment] existing: {eid}")
        return eid
    status, body = _req(
        "POST",
        "/rest/v1/user_enrollments",
        body={
            "user_id": uid,
            "master_path_id": master_path_id,
            "title": "Equity Research Analyst",
            "status": "active",
        },
        extra_headers={"Prefer": "return=representation"},
    )
    if status not in (200, 201):
        print(f"[enrollment] create failed {status}: {body}")
        sys.exit(1)
    eid = body[0]["id"]
    print(f"[enrollment] created: {eid}")
    return eid


def list_master_capstones():
    status, body = _req(
        "GET",
        "/rest/v1/master_capstone_projects?select=id,title",
    )
    if status != 200:
        print(f"[capstones] fetch failed {status}: {body}")
        sys.exit(1)
    return body


def ensure_capstone_completions(enrollment_id, capstones):
    # Wipe existing rows for this enrollment first so is_completed=true is idempotent
    status, body = _req(
        "GET",
        f"/rest/v1/user_capstone_projects?enrollment_id=eq.{enrollment_id}&select=id,master_capstone_id,is_completed",
    )
    existing = {r["master_capstone_id"]: r for r in (body if status == 200 else [])}

    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()

    for cap in capstones:
        cap_id = cap["id"]
        row = {
            "enrollment_id": enrollment_id,
            "master_capstone_id": cap_id,
            "is_completed": True,
            "started_at": now_iso,
            "completed_at": now_iso,
            "phases_progress": [],
        }
        if cap_id in existing:
            # Update
            rid = existing[cap_id]["id"]
            status, resp = _req(
                "PATCH",
                f"/rest/v1/user_capstone_projects?id=eq.{rid}",
                body={"is_completed": True, "completed_at": now_iso},
                extra_headers={"Prefer": "return=representation"},
            )
            action = "updated"
        else:
            status, resp = _req(
                "POST",
                "/rest/v1/user_capstone_projects",
                body=row,
                extra_headers={"Prefer": "return=representation"},
            )
            action = "inserted"
        if status not in (200, 201):
            print(f"[capstone {cap['title'][:40]}] {action} failed {status}: {resp}")
        else:
            print(f"[capstone {cap['title'][:40]}] {action} OK")


def main():
    print("=== Seeding QA Complete user ===")
    uid = ensure_user()
    ensure_profile(uid)
    master_path_id = get_master_path_id()
    if not master_path_id:
        print("ERROR: no master_capstone_projects rows found")
        sys.exit(1)
    enrollment_id = ensure_enrollment(uid, master_path_id)
    capstones = list_master_capstones()
    print(f"Found {len(capstones)} master capstones")
    ensure_capstone_completions(enrollment_id, capstones)
    print("\n=== DONE ===")
    print(f"Email:    {QA_EMAIL}")
    print(f"Password: {QA_PASSWORD}")
    print(f"User ID:  {uid}")
    print(f"Enrollment ID: {enrollment_id}")


if __name__ == "__main__":
    main()
