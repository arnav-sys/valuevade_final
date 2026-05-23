-- 0018 — Phase C: Milestone Achievement Cards
--
-- Hybrid milestone system:
--   * Module milestones: hand-curated, fire when a user finishes the last
--     session of a module (all sessions in the user_module are complete).
--   * Count milestones: fallback, fire at specific cumulative completed-
--     session counts (3, 7, 12, 18, 25, 35, 50, 75, 100) when no module
--     milestone is due in that same triggering.
--
-- Granted exactly once per user per milestone (unique index). The grant
-- happens in the backend helper `check_and_grant_milestones` which the
-- frontend hits via POST /api/milestones/check after a session completes.

begin;

create table if not exists public.master_milestones (
  code               text primary key,
  kind               text not null check (kind in ('module','count')),
  trigger_module_id  uuid references public.master_modules(id) on delete cascade,
  trigger_count      int  check (trigger_count > 0),
  title              text not null,
  body               text not null,
  icon               text not null,
  rarity             text not null default 'epic'
                       check (rarity in ('common','rare','epic','legendary')),
  display_order      int  default 0,
  created_at         timestamptz not null default now(),
  -- Exactly one of the two trigger fields must be non-null.
  constraint master_milestones_trigger_xor check (
    (trigger_module_id is not null and trigger_count is null) or
    (trigger_module_id is null     and trigger_count is not null)
  )
);

-- Helpful lookup indexes
create index if not exists ix_master_milestones_trigger_module
  on public.master_milestones (trigger_module_id) where trigger_module_id is not null;
create index if not exists ix_master_milestones_trigger_count
  on public.master_milestones (trigger_count) where trigger_count is not null;


create table if not exists public.user_milestones (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  milestone_code  text not null references public.master_milestones(code) on delete cascade,
  earned_at       timestamptz not null default now(),
  dismissed_at    timestamptz,
  -- Idempotent: each milestone is earned at most once per user.
  constraint user_milestones_user_code_unique unique (user_id, milestone_code)
);

create index if not exists ix_user_milestones_user_pending
  on public.user_milestones (user_id, earned_at)
  where dismissed_at is null;

-- RLS: owner can SELECT/UPDATE; INSERT only via service role (i.e. the
-- backend helper, never directly from a Supabase JS client).
alter table public.user_milestones enable row level security;

drop policy if exists user_milestones_select_own on public.user_milestones;
create policy user_milestones_select_own on public.user_milestones
  for select using (auth.uid() = user_id);

drop policy if exists user_milestones_update_own on public.user_milestones;
create policy user_milestones_update_own on public.user_milestones
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- master_milestones is world-readable (no PII).
alter table public.master_milestones enable row level security;
drop policy if exists master_milestones_read_all on public.master_milestones;
create policy master_milestones_read_all on public.master_milestones
  for select using (true);

commit;
