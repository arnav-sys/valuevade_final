-- 0019 — Phase D1: Study Planner schema
--
-- DESIGN NOTES (read before changing):
--
-- 1. `master_sessions.estimated_minutes` ALREADY EXISTS (default 50) — we DO
--    NOT re-add it. The spec said "if duration data exists, USE IT".
-- 2. There is no `master_capstones` table in this codebase. The closest
--    real-world analogue is `master_module_projects` (one per module, has
--    `estimated_hours`). Our day rows store project ids in
--    `required_project_codes text[]` (renamed from the spec's
--    `required_capstone_codes` to match reality). The plan generator pulls
--    `estimated_hours * 60` for each.
-- 3. The canonical FK for "course" in this schema is
--    `user_enrollments.id` (`uuid`). `user_stats.enrollment_id` already
--    references it. We use the same shape — `enrollment_id uuid`.
-- 4. Source-of-truth for the plan's session list is `user_sessions` (the
--    user's personalized, customized list) NOT `master_sessions`. This
--    respects the customize-wizard removals from the enrollment flow.
--    The plan generator joins user_sessions ⨝ master_sessions for
--    `estimated_minutes`.
-- 5. Day status semantics:
--      upcoming  — a future planned day, work not yet due
--      today     — the current IST day (computed at read-time, not stored)
--      on_track  — finished today (actual >= required)  [Phase D2]
--      behind    — past day with actual < required      [Phase D2]
--      complete  — finished and the plan finalised      [Phase D2]
--      skipped   — user explicitly marked as a rest     [future]
--      rest      — non-study weekday, required_minutes = 0
--    Only `upcoming` and `rest` are written by the generator. Everything
--    else flips later in Phase D2's tracking layer.

begin;

create table if not exists public.user_study_plans (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  enrollment_id           uuid not null references public.user_enrollments(id) on delete cascade,
  target_mode             text not null check (target_mode in ('deadline','hours_per_day','hours_per_week')),
  target_deadline         date,
  target_hours_per_day    numeric(4,2),
  target_hours_per_week   numeric(5,2),
  non_study_weekdays      int[] not null default '{}',
  total_load_minutes      int not null,
  plan_start_date         date not null default current_date,
  plan_end_date           date not null,
  status                  text not null default 'active'
                            check (status in ('active','completed','paused','abandoned')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Exactly one of the three target_* fields must be non-null, and it
  -- must match the chosen target_mode.
  constraint user_study_plans_target_xor check (
    (target_mode = 'deadline'        and target_deadline       is not null
                                     and target_hours_per_day  is null
                                     and target_hours_per_week is null) or
    (target_mode = 'hours_per_day'   and target_hours_per_day  is not null
                                     and target_deadline       is null
                                     and target_hours_per_week is null) or
    (target_mode = 'hours_per_week'  and target_hours_per_week is not null
                                     and target_deadline       is null
                                     and target_hours_per_day  is null)
  )
);

-- One active plan per (user, enrollment). Stale plans flip to 'abandoned'
-- on commit so this partial unique index never fires falsely.
create unique index if not exists ux_user_study_plans_active
  on public.user_study_plans (user_id, enrollment_id)
  where status = 'active';

create index if not exists ix_user_study_plans_user_status
  on public.user_study_plans (user_id, status);


create table if not exists public.user_study_plan_days (
  id                       uuid primary key default uuid_generate_v4(),
  plan_id                  uuid not null references public.user_study_plans(id) on delete cascade,
  user_id                  uuid not null references auth.users(id) on delete cascade,
  day_date                 date not null,
  required_minutes         int  not null default 0,
  required_session_codes   text[] not null default '{}',
  required_project_codes   text[] not null default '{}',
  actual_minutes           int  not null default 0,
  actual_sessions_completed int not null default 0,
  status                   text not null default 'upcoming'
                             check (status in ('upcoming','today','on_track','behind','complete','skipped','rest')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint user_study_plan_days_unique_per_day unique (plan_id, day_date)
);

create index if not exists ix_user_study_plan_days_user_date
  on public.user_study_plan_days (user_id, day_date);


-- Adherence summary — populated in Phase D2 by the tracking job. We seed
-- empty rows for users when their first plan is committed so the FE can
-- safely UPSERT-on-read without checking existence.
create table if not exists public.user_plan_adherence (
  user_id                       uuid primary key references auth.users(id) on delete cascade,
  on_schedule_streak_days       int  not null default 0,
  longest_on_schedule_streak    int  not null default 0,
  last_on_track_date            date,
  updated_at                    timestamptz not null default now()
);

-- RLS
alter table public.user_study_plans      enable row level security;
alter table public.user_study_plan_days  enable row level security;
alter table public.user_plan_adherence   enable row level security;

drop policy if exists usp_select_own on public.user_study_plans;
create policy usp_select_own on public.user_study_plans
  for select using (auth.uid() = user_id);
drop policy if exists usp_update_own on public.user_study_plans;
create policy usp_update_own on public.user_study_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists uspd_select_own on public.user_study_plan_days;
create policy uspd_select_own on public.user_study_plan_days
  for select using (auth.uid() = user_id);
drop policy if exists uspd_update_own on public.user_study_plan_days;
create policy uspd_update_own on public.user_study_plan_days
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists upa_select_own on public.user_plan_adherence;
create policy upa_select_own on public.user_plan_adherence
  for select using (auth.uid() = user_id);

commit;
