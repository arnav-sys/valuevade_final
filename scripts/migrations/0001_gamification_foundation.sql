-- =============================================================================
-- Migration 0001 — Gamification Foundation
-- Phase 0 of Valuevade gamification layer.
--
-- Adds:
--   • 7 new tables (1 user-XP ledger, 2 master+user badge tables,
--     2 master+user daily-challenge tables, 1 user-daily-activity heatmap,
--     1 master levels lookup)
--   • 9 new columns on existing user_stats table
--   • RLS policies on every new table (auth.uid() = user_id pattern)
--   • award_xp() SECURITY DEFINER RPC — the single XP mutation funnel
--
-- Conventions matched against existing user_modules / user_sessions:
--   • uuid PKs via gen_random_uuid()
--   • user_id references auth.users(id) ON DELETE CASCADE
--   • created_at timestamptz default now()
--   • RLS enabled, four explicit policies (select/insert/update/delete)
--   • Indexes on (user_id, *_date|*_at) for heatmap / ledger reads
--
-- Idempotent: every CREATE / ALTER uses IF NOT EXISTS or OR REPLACE.
-- Safe to re-run.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0.2.1  master_levels (seed table)
-- -----------------------------------------------------------------------------
create table if not exists public.master_levels (
  id           uuid primary key default gen_random_uuid(),
  level_number int  not null unique check (level_number >= 1),
  name         text not null,
  xp_threshold int  not null check (xp_threshold >= 0),
  icon_slug    text,
  color_hex    text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_master_levels_threshold
  on public.master_levels (xp_threshold);

-- Seed the 6 canonical levels (idempotent via ON CONFLICT)
insert into public.master_levels (level_number, name, xp_threshold, icon_slug, color_hex)
values
  (1, 'Junior Analyst',     0,     'level-junior-analyst',     '#9CA3AF'),
  (2, 'Research Associate', 500,   'level-research-associate', '#246BFD'),
  (3, 'Equity Analyst',     1500,  'level-equity-analyst',     '#6A5CFF'),
  (4, 'Senior Analyst',     3500,  'level-senior-analyst',     '#FF6AC1'),
  (5, 'Portfolio Manager',  7000,  'level-portfolio-manager',  '#F59E0B'),
  (6, 'CIO',                12000, 'level-cio',                '#10B981')
on conflict (level_number) do update
  set name         = excluded.name,
      xp_threshold = excluded.xp_threshold,
      icon_slug    = excluded.icon_slug,
      color_hex    = excluded.color_hex;

-- -----------------------------------------------------------------------------
-- 0.2.2  user_xp_events (append-only XP ledger)
-- -----------------------------------------------------------------------------
create table if not exists public.user_xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     int  not null,
  reason     text not null check (reason in (
    'session_complete',
    'quiz_correct',
    'quiz_attempt',
    'simulation_complete',
    'daily_login',
    'capstone_complete',
    'module_complete',
    'daily_challenge_complete',
    'daily_champion_bonus',
    'signup_bonus',
    'badge_unlock_bonus',
    'streak_milestone',
    'manual_adjust'
  )),
  source_id  uuid,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_xp_events_user_created
  on public.user_xp_events (user_id, created_at desc);

create index if not exists idx_user_xp_events_user_reason
  on public.user_xp_events (user_id, reason);

-- -----------------------------------------------------------------------------
-- 0.2.3  master_badges (definitions only; rows seeded in Phase 3)
-- -----------------------------------------------------------------------------
create table if not exists public.master_badges (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  description   text not null,
  category      text not null check (category in (
    'knowledge', 'speed', 'consistency', 'social', 'secret'
  )),
  rarity        text not null check (rarity in (
    'common', 'rare', 'epic', 'legendary'
  )),
  icon_slug     text,
  is_secret     boolean not null default false,
  criteria_json jsonb   not null default '{}'::jsonb,
  bonus_xp      int     not null default 0 check (bonus_xp >= 0),
  created_at    timestamptz not null default now()
);

create index if not exists idx_master_badges_category
  on public.master_badges (category);

-- -----------------------------------------------------------------------------
-- 0.2.4  user_badges (per-user progress + unlock state)
-- -----------------------------------------------------------------------------
create table if not exists public.user_badges (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  badge_id         uuid not null references public.master_badges(id) on delete cascade,
  earned_at        timestamptz,
  progress_current int  not null default 0,
  progress_target  int,
  is_unlocked      boolean not null default false,
  meta             jsonb  not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (user_id, badge_id)
);

create index if not exists idx_user_badges_user
  on public.user_badges (user_id);

create index if not exists idx_user_badges_user_unlocked
  on public.user_badges (user_id, is_unlocked);

-- -----------------------------------------------------------------------------
-- 0.2.5  master_daily_challenges (templates only; rows seeded in Phase 4)
-- -----------------------------------------------------------------------------
create table if not exists public.master_daily_challenges (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  title          text not null,
  description    text not null,
  challenge_type text not null check (challenge_type in (
    'quiz_questions_answered',
    'sessions_completed',
    'flashcards_reviewed',
    'quiz_score_threshold',
    'minutes_spent',
    'simulation_completed',
    'notes_completed'
  )),
  target_value   int  not null check (target_value > 0),
  xp_reward      int  not null default 0 check (xp_reward >= 0),
  module_scope   uuid references public.master_modules(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_master_daily_challenges_type
  on public.master_daily_challenges (challenge_type);

-- -----------------------------------------------------------------------------
-- 0.2.6  user_daily_challenges (per-day instances)
-- -----------------------------------------------------------------------------
create table if not exists public.user_daily_challenges (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  challenge_id     uuid not null references public.master_daily_challenges(id) on delete cascade,
  challenge_date   date not null,
  progress_current int  not null default 0,
  target_value     int  not null,
  is_completed     boolean not null default false,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, challenge_id, challenge_date)
);

create index if not exists idx_user_daily_challenges_user_date
  on public.user_daily_challenges (user_id, challenge_date desc);

create index if not exists idx_user_daily_challenges_open
  on public.user_daily_challenges (user_id, challenge_date)
  where is_completed = false;

-- -----------------------------------------------------------------------------
-- 0.2.7  user_daily_activity (heatmap + streak source of truth)
-- -----------------------------------------------------------------------------
create table if not exists public.user_daily_activity (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  activity_date       date not null,
  xp_earned           int  not null default 0,
  sessions_completed  int  not null default 0,
  minutes_spent       int  not null default 0,
  events_count        int  not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, activity_date)
);

create index if not exists idx_user_daily_activity_user_date
  on public.user_daily_activity (user_id, activity_date desc);

-- -----------------------------------------------------------------------------
-- 0.3  user_stats — additive columns (idempotent, defaults preserve old reads)
-- -----------------------------------------------------------------------------
-- Note: current_streak_days and longest_streak_days already exist in this DB.
-- Using IF NOT EXISTS for safety; the no-op cases are intentional.
alter table public.user_stats add column if not exists total_xp                       int not null default 0;
alter table public.user_stats add column if not exists current_level                  int not null default 1;
alter table public.user_stats add column if not exists current_streak_days            int not null default 0;
alter table public.user_stats add column if not exists longest_streak_days            int not null default 0;
alter table public.user_stats add column if not exists streak_freeze_tokens           int not null default 0;
alter table public.user_stats add column if not exists last_streak_freeze_earned_at   timestamptz;
alter table public.user_stats add column if not exists daily_goal_minutes             int;
alter table public.user_stats add column if not exists last_login_at_ist              timestamptz;
alter table public.user_stats add column if not exists daily_champion_glow_until      timestamptz;

-- -----------------------------------------------------------------------------
-- 0.4  Row-Level Security policies (mirrors existing user_modules / user_sessions)
-- -----------------------------------------------------------------------------

-- master_levels: public-read for any authenticated user; writes only via service role
alter table public.master_levels enable row level security;
drop policy if exists "master_levels read"        on public.master_levels;
drop policy if exists "master_levels write"       on public.master_levels;
create policy "master_levels read"
  on public.master_levels for select to authenticated using (true);

-- master_badges: same pattern
alter table public.master_badges enable row level security;
drop policy if exists "master_badges read"        on public.master_badges;
drop policy if exists "master_badges write"       on public.master_badges;
create policy "master_badges read"
  on public.master_badges for select to authenticated using (true);

-- master_daily_challenges: same pattern
alter table public.master_daily_challenges enable row level security;
drop policy if exists "master_daily_challenges read"  on public.master_daily_challenges;
drop policy if exists "master_daily_challenges write" on public.master_daily_challenges;
create policy "master_daily_challenges read"
  on public.master_daily_challenges for select to authenticated using (true);

-- user_xp_events: owner CRU (no D)
alter table public.user_xp_events enable row level security;
drop policy if exists "user_xp_events select" on public.user_xp_events;
drop policy if exists "user_xp_events insert" on public.user_xp_events;
drop policy if exists "user_xp_events update" on public.user_xp_events;
create policy "user_xp_events select"
  on public.user_xp_events for select to authenticated
  using (auth.uid() = user_id);
create policy "user_xp_events insert"
  on public.user_xp_events for insert to authenticated
  with check (auth.uid() = user_id);
create policy "user_xp_events update"
  on public.user_xp_events for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_badges: owner CRU (no D)
alter table public.user_badges enable row level security;
drop policy if exists "user_badges select" on public.user_badges;
drop policy if exists "user_badges insert" on public.user_badges;
drop policy if exists "user_badges update" on public.user_badges;
create policy "user_badges select"
  on public.user_badges for select to authenticated
  using (auth.uid() = user_id);
create policy "user_badges insert"
  on public.user_badges for insert to authenticated
  with check (auth.uid() = user_id);
create policy "user_badges update"
  on public.user_badges for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_daily_challenges: owner CRU (no D)
alter table public.user_daily_challenges enable row level security;
drop policy if exists "user_daily_challenges select" on public.user_daily_challenges;
drop policy if exists "user_daily_challenges insert" on public.user_daily_challenges;
drop policy if exists "user_daily_challenges update" on public.user_daily_challenges;
create policy "user_daily_challenges select"
  on public.user_daily_challenges for select to authenticated
  using (auth.uid() = user_id);
create policy "user_daily_challenges insert"
  on public.user_daily_challenges for insert to authenticated
  with check (auth.uid() = user_id);
create policy "user_daily_challenges update"
  on public.user_daily_challenges for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_daily_activity: owner CRU (no D)
alter table public.user_daily_activity enable row level security;
drop policy if exists "user_daily_activity select" on public.user_daily_activity;
drop policy if exists "user_daily_activity insert" on public.user_daily_activity;
drop policy if exists "user_daily_activity update" on public.user_daily_activity;
create policy "user_daily_activity select"
  on public.user_daily_activity for select to authenticated
  using (auth.uid() = user_id);
create policy "user_daily_activity insert"
  on public.user_daily_activity for insert to authenticated
  with check (auth.uid() = user_id);
create policy "user_daily_activity update"
  on public.user_daily_activity for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 0.5  award_xp() RPC — single mutation funnel
--
-- Inserts XP event, updates user_stats.total_xp, recomputes current_level from
-- master_levels.xp_threshold, upserts today's user_daily_activity row.
-- Returns the updated user_stats row + did_level_up flag.
--
-- SECURITY DEFINER so it can write to user_stats / user_daily_activity even
-- under the calling user's RLS scope (we still enforce that p_user_id matches
-- auth.uid() inside the function so users can't award XP to other users).
-- -----------------------------------------------------------------------------
create or replace function public.award_xp(
  p_user_id   uuid,
  p_amount    int,
  p_reason    text,
  p_source_id uuid default null,
  p_meta      jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller        uuid := auth.uid();
  v_old_level     int;
  v_new_level     int;
  v_new_total_xp  int;
  v_stats         public.user_stats%rowtype;
  v_today         date := (now() at time zone 'Asia/Kolkata')::date;
  v_session_delta int  := 0;
begin
  -- Auth guard: callers can only award XP to themselves (except service role,
  -- which has v_caller = null and bypasses).
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'award_xp: caller % cannot award XP to %', v_caller, p_user_id
      using errcode = '42501';
  end if;

  -- Validate reason matches the user_xp_events CHECK constraint
  if p_reason not in (
    'session_complete','quiz_correct','quiz_attempt','simulation_complete',
    'daily_login','capstone_complete','module_complete','daily_challenge_complete',
    'daily_champion_bonus','signup_bonus','badge_unlock_bonus','streak_milestone',
    'manual_adjust'
  ) then
    raise exception 'award_xp: invalid reason %', p_reason using errcode = '22023';
  end if;

  -- 1) Append ledger event
  insert into public.user_xp_events (user_id, amount, reason, source_id, meta)
  values (p_user_id, p_amount, p_reason, p_source_id, coalesce(p_meta, '{}'::jsonb));

  -- 2) Ensure a user_stats row exists, then bump total_xp.
  --    user_stats has a non-null enrollment_id; if the row doesn't exist yet
  --    we skip the stats update gracefully (Phase 1 wires the upsert path).
  select * into v_stats from public.user_stats where user_id = p_user_id limit 1;
  if not found then
    -- No stats row yet (user not enrolled). Track XP via the ledger only.
    return jsonb_build_object(
      'updated', false,
      'reason', 'no_user_stats_row',
      'event_inserted', true,
      'did_level_up', false
    );
  end if;

  v_old_level := coalesce(v_stats.current_level, 1);
  v_new_total_xp := coalesce(v_stats.total_xp, 0) + p_amount;

  -- 3) Recompute level from master_levels.xp_threshold (largest threshold ≤ XP)
  select coalesce(max(level_number), 1)
    into v_new_level
    from public.master_levels
   where xp_threshold <= greatest(v_new_total_xp, 0);

  update public.user_stats
     set total_xp      = v_new_total_xp,
         current_level = v_new_level,
         updated_at    = now()
   where id = v_stats.id
   returning * into v_stats;

  -- 4) Upsert today's daily activity row
  if p_reason = 'session_complete' then
    v_session_delta := 1;
  end if;

  insert into public.user_daily_activity
    (user_id, activity_date, xp_earned, sessions_completed, events_count)
  values
    (p_user_id, v_today, p_amount, v_session_delta, 1)
  on conflict (user_id, activity_date) do update
    set xp_earned          = public.user_daily_activity.xp_earned + excluded.xp_earned,
        sessions_completed = public.user_daily_activity.sessions_completed + excluded.sessions_completed,
        events_count       = public.user_daily_activity.events_count + 1,
        updated_at         = now();

  return jsonb_build_object(
    'updated', true,
    'event_inserted', true,
    'did_level_up', v_new_level > v_old_level,
    'old_level', v_old_level,
    'new_level', v_new_level,
    'total_xp', v_new_total_xp,
    'user_stats', to_jsonb(v_stats)
  );
end;
$$;

revoke all on function public.award_xp(uuid, int, text, uuid, jsonb) from public;
grant  execute on function public.award_xp(uuid, int, text, uuid, jsonb) to authenticated;
grant  execute on function public.award_xp(uuid, int, text, uuid, jsonb) to service_role;

commit;

-- =============================================================================
-- end of migration 0001
-- =============================================================================
