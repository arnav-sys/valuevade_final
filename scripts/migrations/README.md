# Supabase migrations

This is the home for **versioned, idempotent** SQL migrations that change the
Supabase Postgres schema (DDL only — DML lives in `/app/scripts/*.py`).

## Why a folder, not the Supabase dashboard?

Historically the project has applied DDL ad-hoc via the Supabase Studio SQL
editor and DML via PostgREST + service-role key (`urllib` scripts in the
parent `/app/scripts/` directory). That works, but it leaves no audit trail
in the repo. Anything that introduces new tables / columns / policies / RPCs
should be checked in here so:

1. The schema can be re-created from scratch on a fresh project.
2. Schema changes are reviewable in PRs.
3. The testing agent (and future devs) can read the contract.

## Convention

* File names use a 4-digit prefix that mirrors the phase number:
  `0001_gamification_foundation.sql`, `0001_verify.sql`, ...
* Every migration is **idempotent**: wrap CREATEs with `if not exists`, ALTERs
  with `add column if not exists`, policies with `drop policy if exists` →
  `create policy ...`, RPCs with `create or replace function ...`.
* Each migration ships with a matching `..._verify.sql` that returns a single
  `ALL CHECKS PASSED` row when everything is in place. Anything else is an
  actionable finding.

## Applying a migration

Two supported paths:

### Option A — programmatic (preferred, leaves a CLI trail)

```bash
# 1. Get the pooler connection URI from Supabase Dashboard:
#    Project Settings → Database → Connection string → URI (use POOLER).
#    Format: postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres

# 2. Apply
SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres' \
    python3 /app/scripts/migrations/apply_migration.py 0001_gamification_foundation.sql

# 3. Verify (read-only; rolls back on completion)
SUPABASE_DB_URL='...' \
    python3 /app/scripts/migrations/apply_migration.py 0001_verify.sql --verify-only
```

`apply_migration.py` uses `psycopg2-binary` (already installed in the venv).

### Option B — Supabase Studio SQL editor

Open the project in the dashboard → SQL editor → paste the contents of
`0001_gamification_foundation.sql` → Run. Then repeat with `0001_verify.sql`
and check the output is the single `ALL CHECKS PASSED` row.

## Why not PostgREST?

The service-role key has full DB access in theory, but the PostgREST REST API
only exposes whitelisted tables and SECURITY DEFINER RPCs — it cannot run
arbitrary DDL. To run DDL you need a real Postgres connection (the pooler).
