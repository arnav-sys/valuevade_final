-- 0035_session_feedback.sql — Student feedback on session lectures.
-- Apply in Supabase Studio → SQL Editor. Idempotent.
--
-- Categories:
--   'content_issue'   — factual error / typo / wrong explanation in the video
--   'quality_issue'   — video or audio quality (blurry, muted, cut off, etc.)
--   'other'           — any other feedback (praise, suggestion, feature idea)

begin;

create extension if not exists "pgcrypto";

create table if not exists public.session_feedback (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null,
    session_id     uuid not null,
    category       text not null check (category in ('content_issue','quality_issue','other')),
    message        text not null,
    resolved       boolean not null default false,
    admin_notes    text,
    created_at     timestamptz not null default now(),
    resolved_at    timestamptz
);

create index if not exists ix_session_feedback_session on public.session_feedback (session_id);
create index if not exists ix_session_feedback_user on public.session_feedback (user_id);
create index if not exists ix_session_feedback_open on public.session_feedback (resolved, created_at desc);

alter table public.session_feedback enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
      where schemaname='public' and tablename='session_feedback'
  loop execute format('drop policy if exists %I on public.session_feedback', pol.policyname); end loop;
end$$;

-- Users can INSERT their own feedback and READ their own submissions
-- (nothing else). Everything else routes through the backend service role.
create policy "session_feedback_user_insert"
  on public.session_feedback for insert to authenticated
  with check (user_id = auth.uid());

create policy "session_feedback_user_read_own"
  on public.session_feedback for select to authenticated
  using (user_id = auth.uid());

grant insert, select on public.session_feedback to authenticated;
grant select, insert, update, delete on public.session_feedback to service_role;

commit;

select 'session_feedback_ready' as check, count(*) as row_count
  from public.session_feedback;
