-- 0031_waitlist.sql — Persistent waitlist storage in Supabase (Feb 2026).
-- Was previously in ephemeral Mongo inside the deploy container, which meant
-- signups were lost every redeploy. This table lives on Supabase Postgres and
-- persists across every redeploy.
--
-- Apply in Supabase Studio → SQL Editor, OR via:
--   SUPABASE_MGMT_PAT=sbp_... python3 scripts/migrations/apply_migration_via_api.py 0031_waitlist.sql

create extension if not exists "pgcrypto";

create table if not exists public.waitlist (
    id              uuid primary key default gen_random_uuid(),
    first_name      text not null,
    email           text not null,
    position        integer not null,
    -- Kept the legacy column name "timestamp" so the existing FastAPI + FE
    -- code that reads `row.timestamp` continues to work with zero rename.
    "timestamp"     timestamptz not null default now(),
    referral_code   text not null,
    referral_count  integer not null default 0,
    referred_by     text
);

-- Idempotency: same email may not sign up twice
create unique index if not exists ux_waitlist_email
    on public.waitlist (lower(email));

-- Referral code lookup for the /waitlist POST flow that finds the referrer
create unique index if not exists ux_waitlist_referral_code
    on public.waitlist (referral_code);

-- Admin list is always sorted by newest first
create index if not exists ix_waitlist_timestamp_desc
    on public.waitlist ("timestamp" desc);

-- Lock this down: only the service role reads/writes. No direct client access.
alter table public.waitlist enable row level security;

-- Wipe any accidental permissive policies (safe no-ops on first run).
do $$
declare pol record;
begin
    for pol in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = 'waitlist'
    loop
        execute format('drop policy if exists %I on public.waitlist', pol.policyname);
    end loop;
end$$;

-- Explicitly deny anon/authenticated everything; the backend uses
-- service_role which bypasses RLS.
grant select, insert, update, delete on public.waitlist to service_role;
revoke all on public.waitlist from anon, authenticated;

-- Sanity summary
select
    'public.waitlist' as table_name,
    count(*)          as row_count
from public.waitlist;
