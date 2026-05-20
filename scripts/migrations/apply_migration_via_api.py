#!/usr/bin/env python3
"""
Apply (or verify) a Supabase migration via the Supabase Management API.

Requires a Supabase Personal Access Token (PAT) — set via env var
`SUPABASE_MGMT_PAT` or read from /app/backend/.env automatically.

The Management API endpoint runs arbitrary SQL on the project database with
service-role-equivalent privileges, which is the cleanest path when:
  - The direct postgres host has been retired in favour of IPv6-only
  - The pooler is reachable but the DB password isn't available
  - The team prefers a PAT (rotatable, revocable) over the postgres password

Usage
-----
    SUPABASE_MGMT_PAT=sbp_... python3 apply_migration_via_api.py 0001_gamification_foundation.sql
    SUPABASE_MGMT_PAT=sbp_... python3 apply_migration_via_api.py 0001_verify.sql

If you omit the env var the script will try to read SUPABASE_MGMT_PAT from
/app/backend/.env.
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

PROJECT_REF = "yuadeybycbfqlkdpxbkv"
API = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
HERE = Path(__file__).resolve().parent
ENV_PATH = Path("/app/backend/.env")


def load_pat() -> str:
    pat = os.environ.get("SUPABASE_MGMT_PAT")
    if pat:
        return pat
    if ENV_PATH.is_file():
        for line in ENV_PATH.read_text().splitlines():
            if line.startswith("SUPABASE_MGMT_PAT="):
                return line.split("=", 1)[1].strip().strip('"')
    sys.stderr.write(
        "ERROR: SUPABASE_MGMT_PAT not set in env and not present in "
        "/app/backend/.env.\n"
    )
    sys.exit(2)


def run_query(pat: str, query: str) -> tuple[int, str]:
    req = urllib.request.Request(
        API,
        method="POST",
        data=json.dumps({"query": query}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {pat}",
            "Content-Type": "application/json",
            "User-Agent": "valuevade-migrations/1.0 (+https://valuevade.com)",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("sql_file", help="Filename inside scripts/migrations/")
    args = p.parse_args()

    sql_path = HERE / args.sql_file
    if not sql_path.is_file():
        sys.stderr.write(f"ERROR: SQL file not found: {sql_path}\n")
        return 2
    sql_text = sql_path.read_text(encoding="utf-8")
    print(f"--- Loaded {sql_path.name}: {len(sql_text):,} bytes")

    pat = load_pat()
    print(f"--- Using PAT: {pat[:12]}…{pat[-4:]} (length={len(pat)})")
    print(f"--- POST {API}")
    status, body = run_query(pat, sql_text)
    print(f"--- HTTP {status}")
    # The Management API returns either a JSON array of rows or an error object
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        print(body)
        return 1 if status >= 400 else 0

    if status >= 400:
        print(json.dumps(parsed, indent=2))
        return 1

    if isinstance(parsed, list):
        print(f"--- Result: {len(parsed)} row(s)")
        # Pretty-print first 25 rows max
        for r in parsed[:25]:
            print("    " + json.dumps(r, default=str))
        if len(parsed) > 25:
            print(f"    ... and {len(parsed) - 25} more")
    else:
        print(json.dumps(parsed, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
