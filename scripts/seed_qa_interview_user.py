"""Seed a QA account for the M20 interview simulations (idempotent).

Account: qa-interview@valuevade.test / QaInterview2026!
State: active enrollment with ONLY Module 20 (3 sessions, all video+notes
complete) so the interview simulations are unlocked immediately.

Run: python3 /app/scripts/seed_qa_interview_user.py
"""
import json
import os
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
URL = os.environ["REACT_APP_SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
EMAIL = "qa-interview@valuevade.test"
PASSWORD = "QaInterview2026!"
M20 = "755956dd-51e8-47b9-8e22-fbbed253127a"


def req(method, path, body=None, base="rest/v1", prefer=None):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    r = urllib.request.Request(f"{URL}/{base}/{path}",
                               data=json.dumps(body).encode() if body is not None else None,
                               headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code} on {method} {path}: {e.read().decode()[:200]}")
        raise


def main():
    # 1. auth user
    users = req("GET", f"users?email={EMAIL}", base="auth/v1/admin") or {}
    existing = [u for u in users.get("users", []) if u.get("email") == EMAIL]
    if existing:
        uid = existing[0]["id"]
        req("PUT", f"users/{uid}", {"password": PASSWORD}, base="auth/v1/admin")
        print("auth user exists:", uid)
    else:
        u = req("POST", "users", {"email": EMAIL, "password": PASSWORD, "email_confirm": True},
                base="auth/v1/admin")
        uid = u["id"]
        print("auth user created:", uid)

    # 2. profile
    prof = req("GET", f"profiles?id=eq.{uid}&select=id")
    if not prof:
        req("POST", "profiles", {"id": uid, "email": EMAIL, "full_name": "QA Interview"},
            prefer="return=minimal")
        print("profile created")

    # 3. enrollment
    path_row = req("GET", "master_modules?id=eq." + M20 + "&select=path_id")[0]
    enr = req("GET", f"user_enrollments?user_id=eq.{uid}&status=eq.active&select=id")
    if enr:
        enr_id = enr[0]["id"]
        print("enrollment exists:", enr_id)
    else:
        row = req("POST", "user_enrollments", {
            "user_id": uid, "master_path_id": path_row["path_id"],
            "title": "Equity Research Analyst", "status": "active",
        }, prefer="return=representation")
        enr_id = row[0]["id"]
        print("enrollment created:", enr_id)

    # 4. M20 user_module
    m = req("GET", f"master_modules?id=eq.{M20}&select=title,description,module_number,order_index")[0]
    um = req("GET", f"user_modules?enrollment_id=eq.{enr_id}&master_module_id=eq.{M20}&select=id")
    if um:
        um_id = um[0]["id"]
        print("user_module exists:", um_id)
    else:
        row = req("POST", "user_modules", {
            "enrollment_id": enr_id, "master_module_id": M20,
            "title": m["title"], "description": m.get("description"),
            "module_number": m.get("module_number"), "order_index": m.get("order_index"),
            "is_removed": False, "is_completed": False,
        }, prefer="return=representation")
        um_id = row[0]["id"]
        print("user_module created:", um_id)

    # 5. 3 sessions, fully complete (video+notes done → sims unlocked)
    ms = req("GET", f"master_sessions?module_id=eq.{M20}&select=id,title,description,order_index&order=order_index&limit=3")
    have = req("GET", f"user_sessions?user_module_id=eq.{um_id}&select=id,master_session_id")
    have_ids = {h["master_session_id"] for h in have}
    for s in ms:
        if s["id"] in have_ids:
            continue
        req("POST", "user_sessions", {
            "user_module_id": um_id, "master_session_id": s["id"],
            "title": s["title"], "description": s.get("description"),
            "order_index": s["order_index"], "is_removed": False,
            "notes_completed": True, "quiz_completed": True,
            "simulation_completed": True, "is_completed": True,
            "completed_at": "2026-06-01T00:00:00Z",
        }, prefer="return=minimal")
    # ensure all marked complete
    req("PATCH", f"user_sessions?user_module_id=eq.{um_id}", {
        "notes_completed": True, "quiz_completed": True,
        "simulation_completed": True, "is_completed": True,
    })
    print("sessions ready")

    # 6. reset any previous attempts + module completion for a clean slate
    req("DELETE", f"user_interview_attempts?user_id=eq.{uid}")
    req("PATCH", f"user_modules?id=eq.{um_id}", {"is_completed": False, "completed_at": None})
    print("attempts cleared — QA account ready:", EMAIL, "/", PASSWORD)


if __name__ == "__main__":
    main()
