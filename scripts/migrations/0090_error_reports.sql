-- =============================================================================
-- Migration 0090 — Error Reports (client-side crash / uncaught error capture)
-- =============================================================================
--
-- Table:
--   error_reports  : grouped by signature (hash of message + first stack frame).
--                    Each unique signature = one row; occurrences increment
--                    `occurrence_count`. Admin can Mark Resolved / Silence /
--                    Reopen from AdminPanel > Errors tab. If a signature reappears
--                    after being resolved, `regressed_at` is set so admin sees it.
--
-- Idempotent; safe to re-run.
-- =============================================================================

begin;

create table if not exists public.error_reports (
  id                uuid primary key default gen_random_uuid(),
  signature         text not null unique,
  error_message     text not null,
  error_stack       text,
  error_type        text default 'runtime' check (error_type in ('runtime','promise','react_boundary')),
  url               text,
  user_agent        text,
  user_id           uuid null references auth.users(id) on delete set null,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  occurrence_count  int not null default 1,
  unique_users      int not null default 0,
  is_silenced       boolean not null default false,
  resolved_at       timestamptz,
  resolved_by       uuid null references auth.users(id) on delete set null,
  resolution_notes  text,
  regressed_at      timestamptz
);

create index if not exists error_reports_last_seen_idx  on public.error_reports (last_seen_at desc);
create index if not exists error_reports_signature_idx  on public.error_reports (signature);
create index if not exists error_reports_status_idx     on public.error_reports (is_silenced, resolved_at);

-- Occurrence rows — trimmed ledger of the most recent N per signature so the
-- admin drawer can show sample URLs / user_agents / users hit.
create table if not exists public.error_report_events (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.error_reports(id) on delete cascade,
  user_id      uuid null references auth.users(id) on delete set null,
  url          text,
  user_agent   text,
  occurred_at  timestamptz not null default now()
);
create index if not exists error_report_events_report_idx on public.error_report_events (report_id, occurred_at desc);

-- Public-write ingest policy (uncaught errors happen before login, so we can't
-- gate on auth). Reads restricted to admin via service-role.
alter table public.error_reports enable row level security;
alter table public.error_report_events enable row level security;

drop policy if exists error_reports_public_insert on public.error_reports;
drop policy if exists error_events_public_insert on public.error_report_events;

-- The FastAPI backend uses the service role and bypasses RLS anyway. We add a
-- narrow policy so anon can never SELECT the table directly (only via backend).
-- No policy for insert/update → service role is the only writer.

commit;
