#!/usr/bin/env python3
"""
Apply (or verify) a Supabase Postgres migration via psycopg2.

Usage
-----
    # Apply 0001 + run verification:
    SUPABASE_DB_URL='postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres' \
        python3 scripts/migrations/apply_migration.py 0001_gamification_foundation.sql

    # Verify only (no DDL run):
    SUPABASE_DB_URL=... python3 scripts/migrations/apply_migration.py 0001_verify.sql --verify-only

    # Dry-run (parses SQL, opens connection, prints plan):
    SUPABASE_DB_URL=... python3 scripts/migrations/apply_migration.py 0001_gamification_foundation.sql --dry-run

Why we don't use PostgREST:
    Supabase's REST API (PostgREST) only exposes DML on whitelisted tables and
    a handful of SECURITY DEFINER RPCs. It cannot run arbitrary DDL.
    Direct host (db.<project>.supabase.co:5432) requires DNS resolution that
    is disabled on newer Supabase projects, so we use the regional pooler.

Required env vars:
    SUPABASE_DB_URL — full connection URI including password
        Get this from Supabase Dashboard → Project Settings → Database →
        Connection string → URI (use the pooler / "Transaction" mode).

The connection string format looks like:
    postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
"""
import argparse
import os
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2 import sql  # noqa: F401
except ImportError:
    sys.stderr.write(
        "psycopg2 not installed. Run: pip install psycopg2-binary\n"
    )
    sys.exit(2)


HERE = Path(__file__).resolve().parent


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "sql_file",
        help="Filename inside scripts/migrations/ (e.g. 0001_gamification_foundation.sql)",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Open a connection and run the file as SELECT-only; do not COMMIT.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse SQL file + open connection but do not execute any statements.",
    )
    args = parser.parse_args()

    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        sys.stderr.write(
            "ERROR: SUPABASE_DB_URL env var is not set.\n\n"
            "Get the connection URI from the Supabase Dashboard:\n"
            "  Project Settings → Database → Connection string → URI\n"
            "Use the POOLER (Transaction mode, port 6543) since the direct\n"
            "5432 host doesn't have public DNS on new Supabase projects.\n"
        )
        return 2

    sql_path = HERE / args.sql_file
    if not sql_path.is_file():
        sys.stderr.write(f"ERROR: SQL file not found: {sql_path}\n")
        return 2
    sql_text = sql_path.read_text(encoding="utf-8")
    print(f"--- Loaded {sql_path.name}: {len(sql_text):,} bytes")

    # Connect
    print("--- Connecting to Supabase Postgres ...")
    try:
        conn = psycopg2.connect(db_url, connect_timeout=15)
    except Exception as exc:
        sys.stderr.write(f"ERROR: connection failed: {exc}\n")
        return 1

    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            if args.dry_run:
                print("--- DRY RUN: skipping execute")
                cur.execute("select current_database(), current_user, version()")
                row = cur.fetchone()
                print(
                    f"--- Connected to db={row[0]} user={row[1]}\n"
                    f"--- Server: {row[2][:80]}..."
                )
                return 0

            print("--- Executing SQL ...")
            cur.execute(sql_text)

            # Drain any SELECT-style result so we can show verification output
            if cur.description is not None:
                rows = cur.fetchall()
                colnames = [d.name for d in cur.description]
                print(f"--- Result columns: {colnames}")
                for r in rows:
                    print("    " + " | ".join(str(c) for c in r))

            if args.verify_only:
                conn.rollback()
                print("--- VERIFY ONLY: rolled back (no writes persisted).")
            else:
                conn.commit()
                print("--- COMMIT OK.")
        return 0
    except Exception as exc:
        conn.rollback()
        sys.stderr.write(f"ERROR: migration failed: {exc}\n")
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
