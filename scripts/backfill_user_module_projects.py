#!/usr/bin/env python3
"""
Backfill user_module_projects for every existing user_module.

Background
----------
ConfirmPage.jsx clones master_modules → user_modules and master_sessions →
user_sessions on enrollment, but historically never seeded user_module_projects.
That broke the dashboard's pending-project gate: when M1 finished, the
dashboard jumped straight to M2 S1 because the gate checks
`projectMap[user_module.id] && !project.is_completed`, and `projectMap` was
empty for the user.

This script
-----------
For each user_module whose master_module_id has a master_module_project row,
ensure a corresponding user_module_projects row exists with
is_completed=false and started_at=null.

Idempotent — safe to run repeatedly.
"""
import json
import urllib.request
import urllib.error

SUP = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"


def sb(method, path, body=None, want_json=True):
    url = f"{SUP}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, method=method, data=data, headers={
        "apikey": SR, "Authorization": f"Bearer {SR}",
        "Content-Type": "application/json", "Prefer": "return=representation",
    })
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            t = resp.read().decode()
            return json.loads(t) if want_json and t else t
    except urllib.error.HTTPError as e:
        print("ERR:", e.read().decode())
        raise


def main():
    print("Loading master_module_projects → master_module_id index...")
    master_projects = sb("GET", "master_module_projects?select=id,module_id")
    project_by_module = {p["module_id"]: p["id"] for p in master_projects}
    print(f"  {len(project_by_module)} master modules have a project")

    print("\nLoading existing user_module_projects (to skip already-seeded rows)...")
    existing = sb("GET", "user_module_projects?select=user_module_id")
    seeded_ums = {row["user_module_id"] for row in existing}
    print(f"  {len(seeded_ums)} user_modules already have project rows")

    print("\nLoading all user_modules...")
    # Page through if there are many; PostgREST default returns up to 1000
    user_modules = sb("GET", "user_modules?select=id,enrollment_id,master_module_id,is_removed")
    print(f"  {len(user_modules)} user_modules total")

    to_insert = []
    skipped_no_master = 0
    skipped_no_project = 0
    skipped_removed = 0
    skipped_already = 0
    for um in user_modules:
        if um.get("is_removed"):
            skipped_removed += 1
            continue
        if um["id"] in seeded_ums:
            skipped_already += 1
            continue
        master_id = um.get("master_module_id")
        if not master_id:
            skipped_no_master += 1
            continue
        master_project_id = project_by_module.get(master_id)
        if not master_project_id:
            skipped_no_project += 1
            continue
        to_insert.append({
            "user_module_id": um["id"],
            "master_project_id": master_project_id,
            "is_completed": False,
            "started_at": None,
        })

    print(
        f"\nSkipped: removed={skipped_removed} no-master-id={skipped_no_master} "
        f"no-master-project={skipped_no_project} already-seeded={skipped_already}"
    )
    print(f"To insert: {len(to_insert)} rows")

    if not to_insert:
        print("\nNothing to do. Backfill is up to date.")
        return

    BATCH = 100
    inserted = 0
    for i in range(0, len(to_insert), BATCH):
        chunk = to_insert[i:i + BATCH]
        sb("POST", "user_module_projects", body=chunk, want_json=False)
        inserted += len(chunk)
        print(f"  inserted batch {i // BATCH + 1} ({len(chunk)} rows, total {inserted})")

    print(f"\n✓ Backfill complete. {inserted} user_module_projects rows inserted.")


if __name__ == "__main__":
    main()
