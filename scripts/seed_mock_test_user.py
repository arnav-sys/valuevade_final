"""Seed a fresh QA test user that has ONLY the Mock Interview module (M20).

Account: mocktest@valuevade.test / MockTest2026!

State:
  - Enrolled in the Equity Research path
  - user_modules ONLY has M20 (no other module clutter)
  - All 3 M20 sessions marked video+notes+quiz complete so the 5 interview
    simulations are unlocked from the moment the user logs in
  - Payment status set to `paid` so the paywall never appears
  - Any prior interview attempts wiped for a clean run
  - M20 completion reset so the user can play through all 5 firms fresh

Idempotent — safe to re-run any time.

Run: python3 /app/scripts/seed_mock_test_user.py
"""
import json
import os
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
URL = os.environ["REACT_APP_SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

EMAIL = "mocktest@valuevade.test"
PASSWORD = "MockTest2026!"
FULL_NAME = "Mock Interview Tester"
M20 = "755956dd-51e8-47b9-8e22-fbbed253127a"


def req(method, path, body=None, base="rest/v1", prefer=None):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}",
               "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    r = urllib.request.Request(
        f"{URL}/{base}/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers, method=method,
    )
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code} on {method} {path}: {e.read().decode()[:250]}")
        raise


def main():
    # 1) Auth user
    users = req("GET", f"users?email={EMAIL}", base="auth/v1/admin") or {}
    existing = [u for u in users.get("users", []) if u.get("email") == EMAIL]
    if existing:
        uid = existing[0]["id"]
        req("PUT", f"users/{uid}",
            {"password": PASSWORD, "email_confirm": True},
            base="auth/v1/admin")
        print(f"✓ auth user exists  → {uid}")
    else:
        u = req("POST", "users",
                {"email": EMAIL, "password": PASSWORD, "email_confirm": True},
                base="auth/v1/admin")
        uid = u["id"]
        print(f"✓ auth user created → {uid}")

    # 2) Profile
    prof = req("GET", f"profiles?id=eq.{uid}&select=id")
    if not prof:
        req("POST", "profiles",
            {"id": uid, "email": EMAIL, "full_name": FULL_NAME},
            prefer="return=minimal")
        print("✓ profile created")
    else:
        print("✓ profile exists")

    # 3) payment_status = paid (bypass paywall)
    ps = req("GET", f"user_payment_status?user_id=eq.{uid}&select=user_id")
    payment_body = {"user_id": uid, "paid": True, "pricing_tier": "upfront"}
    if ps:
        req("PATCH", f"user_payment_status?user_id=eq.{uid}",
            {"paid": True, "pricing_tier": "upfront"})
        print("✓ payment_status → paid (patched)")
    else:
        try:
            req("POST", "user_payment_status", payment_body, prefer="return=minimal")
            print("✓ payment_status → paid (created)")
        except urllib.error.HTTPError:
            # column shape may differ across envs — ignore, not critical
            print("… payment_status insert skipped (schema differs)")

    # 4) Enrollment
    path_row = req("GET", f"master_modules?id=eq.{M20}&select=path_id")[0]
    enr = req("GET",
              f"user_enrollments?user_id=eq.{uid}&status=eq.active&select=id")
    if enr:
        enr_id = enr[0]["id"]
        print(f"✓ enrollment exists → {enr_id}")
    else:
        row = req("POST", "user_enrollments", {
            "user_id": uid, "master_path_id": path_row["path_id"],
            "title": "Equity Research Analyst", "status": "active",
        }, prefer="return=representation")
        enr_id = row[0]["id"]
        print(f"✓ enrollment created → {enr_id}")

    # 5) Wipe any OTHER user_modules — only M20 should remain
    others = req("GET",
                 f"user_modules?enrollment_id=eq.{enr_id}"
                 f"&master_module_id=neq.{M20}&select=id")
    for om in (others or []):
        req("DELETE", f"user_modules?id=eq.{om['id']}")
    if others:
        print(f"✓ removed {len(others)} non-M20 user_modules")

    # 6) M20 user_module
    m = req("GET",
            f"master_modules?id=eq.{M20}&select=title,description,"
            "module_number,order_index")[0]
    um = req("GET",
             f"user_modules?enrollment_id=eq.{enr_id}"
             f"&master_module_id=eq.{M20}&select=id")
    if um:
        um_id = um[0]["id"]
        print(f"✓ M20 user_module exists → {um_id}")
    else:
        row = req("POST", "user_modules", {
            "enrollment_id": enr_id, "master_module_id": M20,
            "title": m["title"], "description": m.get("description"),
            "module_number": m.get("module_number"),
            "order_index": m.get("order_index"),
            "is_removed": False, "is_completed": False,
        }, prefer="return=representation")
        um_id = row[0]["id"]
        print(f"✓ M20 user_module created → {um_id}")

    # 7) 3 M20 sessions, all phases complete → interview sims unlocked
    ms = req("GET",
             f"master_sessions?module_id=eq.{M20}"
             "&select=id,title,description,order_index"
             "&order=order_index&limit=3")
    have = req("GET",
               f"user_sessions?user_module_id=eq.{um_id}"
               "&select=id,master_session_id")
    have_ids = {h["master_session_id"] for h in have}
    created = 0
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
        created += 1
    # ensure all M20 sessions are marked complete
    req("PATCH", f"user_sessions?user_module_id=eq.{um_id}", {
        "notes_completed": True, "quiz_completed": True,
        "simulation_completed": True, "is_completed": True,
    })
    print(f"✓ M20 sessions ready ({len(ms)} total, {created} newly created)")

    # 8) Reset for a clean interview simulation run
    req("DELETE", f"user_interview_attempts?user_id=eq.{uid}")
    req("PATCH", f"user_modules?id=eq.{um_id}",
        {"is_completed": False, "completed_at": None})
    print("✓ prior interview attempts cleared, M20 completion reset")

    print()
    print("=" * 56)
    print(" Mock Interview test account ready to log in:")
    print(f"   Email:    {EMAIL}")
    print(f"   Password: {PASSWORD}")
    print("=" * 56)


if __name__ == "__main__":
    main()
