-- =============================================================================
-- Migration 0016 — Phase A: Quick Revision Sheet (Session End)
-- =============================================================================
--
-- One cached AI-generated revision sheet per (user, user_sessions.id).
-- Service-role inserts (backend only); user-self SELECTs via RLS.
-- =============================================================================

begin;

create table if not exists public.user_revision_sheets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_id    uuid not null references public.user_sessions(id) on delete cascade,
  module_id     text not null,
  content_md    text not null,
  generated_at  timestamptz not null default now(),
  tokens_used   int  not null default 0
);

-- One cached sheet per (user, session). Idempotent re-runs of the generator
-- are blocked at the DB level so we never burn LLM tokens twice.
create unique index if not exists ux_user_revision_sheets_user_session
  on public.user_revision_sheets (user_id, session_id);

create index if not exists idx_user_revision_sheets_user_generated
  on public.user_revision_sheets (user_id, generated_at desc);

alter table public.user_revision_sheets enable row level security;

drop policy if exists user_revision_sheets_select_own on public.user_revision_sheets;
create policy user_revision_sheets_select_own on public.user_revision_sheets
  for select using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for end users — the backend service-role
-- (which bypasses RLS) is the only writer. Keeps cost rails in one place.

comment on table public.user_revision_sheets is
  'Phase A — AI-generated revision sheet, one per (user, user_sessions.id). Backend service-role writes; users SELECT their own.';

commit;
