-- =============================================================================
-- Migration 0002 — Streak Engine + Daily Goal + minutes_spent on award_xp
-- Phase 2 of Valuevade gamification.
--
-- Adds:
--   • 1 new table: user_streak_events (append-only ledger)
--   • New columns on user_stats: auto_spend_freeze, daily_goal_modal_dismissed,
--     last_streak_break_at, last_streak_break_lost_days
--   • Updated award_xp() RPC: now also bumps user_daily_activity.minutes_spent
--     from meta.minutes (defaults to 0 if not provided)
--   • New RPC: update_streak_on_activity(p_user_id uuid) — single mutation
--     funnel for streak state changes
--   • New RPC: consume_streak_freeze(p_user_id uuid) — manual freeze use
--   • New RPC: backfill_streak_from_history(p_user_id uuid) — one-time per user
--   • New dev RPC: dev_simulate_streak_day(p_user_id uuid, p_days_back int)
--     gated by current_setting('app.allow_dev_rpcs', true) = 'true'
--   • RLS policies on new table
--   • GUC app.allow_dev_rpcs = 'true' set at database level (tester can use
--     dev_simulate_streak_day to exercise transitions)
--
-- Idempotent: every CREATE / ALTER uses IF NOT EXISTS or OR REPLACE; policies
-- use DROP IF EXISTS → CREATE. Safe to re-run.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 2.2 user_streak_events (append-only)
-- -----------------------------------------------------------------------------
create table if not exists public.user_streak_events (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  event_type             text not null check (event_type in (
    'incremented',
    'broken',
    'freeze_consumed',
    'freeze_earned',
    'milestone_hit',
    'manual_freeze_used',
    'backfill_complete'
  )),
  streak_days_at_event   int  not null default 0,
  freeze_tokens_at_event int  not null default 0,
  meta                   jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now()
);

create index if not exists idx_user_streak_events_user_created
  on public.user_streak_events (user_id, created_at desc);

create index if not exists idx_user_streak_events_user_type
  on public.user_streak_events (user_id, event_type);

alter table public.user_streak_events enable row level security;
drop policy if exists "user_streak_events select"   on public.user_streak_events;
drop policy if exists "user_streak_events block_write" on public.user_streak_events;
create policy "user_streak_events select"
  on public.user_streak_events for select to authenticated
  using (auth.uid() = user_id);
-- NO insert / update / delete policy: writes flow ONLY through SECURITY DEFINER
-- RPCs (update_streak_on_activity, consume_streak_freeze, backfill_streak_from_history,
-- dev_simulate_streak_day). The lack of an INSERT policy is intentional — under
-- RLS, omitted operations are denied for non-superusers.

-- -----------------------------------------------------------------------------
-- 2.13 + supporting: user_stats columns
-- -----------------------------------------------------------------------------
alter table public.user_stats add column if not exists auto_spend_freeze            boolean not null default true;
alter table public.user_stats add column if not exists daily_goal_modal_dismissed   boolean not null default false;
alter table public.user_stats add column if not exists last_streak_break_at         timestamptz;
alter table public.user_stats add column if not exists last_streak_break_lost_days  int not null default 0;

-- -----------------------------------------------------------------------------
-- One-row settings table used to gate dev-only RPCs.
-- (Supabase doesn't permit ALTER DATABASE for GUC persistence, so we use a
-- regular table that anyone with service-role access can flip.)
-- -----------------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
drop policy if exists "app_settings read" on public.app_settings;
create policy "app_settings read"
  on public.app_settings for select to authenticated using (true);
-- No write policy — service_role bypasses, authenticated cannot flip the flag.

insert into public.app_settings (key, value) values ('allow_dev_rpcs', 'true')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- -----------------------------------------------------------------------------
-- 2.11 Update award_xp() — now also bumps user_daily_activity.minutes_spent
-- from meta->>'minutes' (integer). Other behaviour unchanged from Phase 0.
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
  v_minutes_delta int  := 0;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'award_xp: caller % cannot award XP to %', v_caller, p_user_id
      using errcode = '42501';
  end if;

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

  -- 2) Ensure user_stats row exists, then bump total_xp.
  select * into v_stats from public.user_stats where user_id = p_user_id limit 1;
  if not found then
    return jsonb_build_object(
      'updated', false,
      'reason', 'no_user_stats_row',
      'event_inserted', true,
      'did_level_up', false
    );
  end if;

  v_old_level := coalesce(v_stats.current_level, 1);
  v_new_total_xp := coalesce(v_stats.total_xp, 0) + p_amount;

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

  -- 3) Upsert today's daily activity row (now with minutes bump)
  if p_reason = 'session_complete' then
    v_session_delta := 1;
  end if;
  -- Minutes come from caller via meta.minutes — clamped 0..240 to keep
  -- a single hostile call from bloating the heatmap.
  v_minutes_delta := least(240, greatest(0, coalesce((p_meta->>'minutes')::int, 0)));

  insert into public.user_daily_activity
    (user_id, activity_date, xp_earned, sessions_completed, minutes_spent, events_count)
  values
    (p_user_id, v_today, p_amount, v_session_delta, v_minutes_delta, 1)
  on conflict (user_id, activity_date) do update
    set xp_earned          = public.user_daily_activity.xp_earned + excluded.xp_earned,
        sessions_completed = public.user_daily_activity.sessions_completed + excluded.sessions_completed,
        minutes_spent      = public.user_daily_activity.minutes_spent + excluded.minutes_spent,
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

-- -----------------------------------------------------------------------------
-- 2.1 update_streak_on_activity(p_user_id)
--
-- Sourcing the streak's "last touched" day from user_streak_events (not from
-- user_daily_activity) makes this RPC idempotent within a day even when called
-- multiple times during the same session_complete flow.
-- -----------------------------------------------------------------------------
create or replace function public.update_streak_on_activity(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller            uuid := auth.uid();
  v_today             date := (now() at time zone 'Asia/Kolkata')::date;
  v_stats             public.user_stats%rowtype;
  v_last_event_date   date;
  v_gap               int;
  v_missed_days       int;
  v_current           int;
  v_longest           int;
  v_tokens            int;
  v_auto_spend        boolean;
  v_last_earn         timestamptz;
  v_was_broken        boolean := false;
  v_lost_days         int := 0;
  v_lost_xp           int := 0;
  v_tokens_consumed   int := 0;
  v_freeze_earned     boolean := false;
  v_milestone_hit     text := 'none';
  v_days_since_earn   int;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'update_streak_on_activity: cannot affect another user'
      using errcode = '42501';
  end if;

  select * into v_stats from public.user_stats where user_id = p_user_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_user_stats_row');
  end if;

  v_current     := coalesce(v_stats.current_streak_days, 0);
  v_longest     := coalesce(v_stats.longest_streak_days, 0);
  v_tokens      := coalesce(v_stats.streak_freeze_tokens, 0);
  v_auto_spend  := coalesce(v_stats.auto_spend_freeze, true);
  v_last_earn   := v_stats.last_streak_freeze_earned_at;

  -- "When was the streak last touched in a way that counts for the run?"
  -- We deliberately EXCLUDE 'backfill_complete' from this lookup — that event
  -- only marks the idempotency anchor for the backfill function itself.
  -- The backfill RPC writes a separate synthetic 'incremented' event dated to
  -- the anchor day, so a backfill on day X with anchor=X-1 still allows
  -- today's activity to correctly increment from the backfilled value.
  select (created_at at time zone 'Asia/Kolkata')::date
    into v_last_event_date
    from public.user_streak_events
   where user_id = p_user_id
     and event_type in ('incremented','freeze_consumed','broken')
   order by created_at desc
   limit 1;

  -- Idempotency: already touched today? no-op.
  if v_last_event_date = v_today then
    return jsonb_build_object(
      'ok', true,
      'no_op', true,
      'current_streak_days', v_current,
      'longest_streak_days', v_longest,
      'streak_freeze_tokens', v_tokens,
      'milestone_hit', 'none',
      'was_broken', false,
      'lost_days', 0,
      'lost_xp_value', 0
    );
  end if;

  if v_last_event_date is null then
    -- First activity ever (no prior backfill / no prior events)
    v_current := 1;
    v_longest := greatest(v_longest, 1);
    insert into public.user_streak_events
      (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
    values
      (p_user_id, 'incremented', v_current, v_tokens, jsonb_build_object('reason','first_activity'));
  else
    v_gap := (v_today - v_last_event_date);
    if v_gap = 1 then
      v_current := v_current + 1;
      if v_current > v_longest then v_longest := v_current; end if;
      insert into public.user_streak_events
        (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
      values
        (p_user_id, 'incremented', v_current, v_tokens, jsonb_build_object('prev_streak', v_current - 1));
    else
      v_missed_days := v_gap - 1; -- e.g. gap=2 → 1 missed day
      if v_auto_spend and v_tokens >= v_missed_days and v_missed_days > 0 then
        v_tokens          := v_tokens - v_missed_days;
        v_tokens_consumed := v_missed_days;
        v_current         := v_current + 1;
        if v_current > v_longest then v_longest := v_current; end if;
        insert into public.user_streak_events
          (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
        values
          (p_user_id, 'freeze_consumed', v_current, v_tokens,
           jsonb_build_object('tokens_consumed', v_tokens_consumed, 'gap_days', v_missed_days));
      else
        v_was_broken := true;
        v_lost_days  := v_current;
        v_lost_xp    := v_current * 25;
        insert into public.user_streak_events
          (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
        values
          (p_user_id, 'broken', v_current, v_tokens,
           jsonb_build_object('lost_days', v_lost_days, 'lost_xp_value', v_lost_xp, 'gap_days', v_gap));
        v_current := 1;
        if v_current > v_longest then v_longest := v_current; end if;
      end if;
    end if;
  end if;

  -- 4) Freeze accrual: +1 token every 10 days, cap 5.
  v_days_since_earn := case
    when v_last_earn is null then 9999
    else (v_today - (v_last_earn at time zone 'Asia/Kolkata')::date)
  end;
  if v_days_since_earn >= 10 and v_tokens < 5 then
    v_tokens := v_tokens + 1;
    v_last_earn := now();
    v_freeze_earned := true;
    insert into public.user_streak_events
      (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
    values
      (p_user_id, 'freeze_earned', v_current, v_tokens, jsonb_build_object('days_since_last', v_days_since_earn));
  end if;

  -- 5) Milestones (only on exact transitions)
  if v_current = 3 then
    v_milestone_hit := 'fire_3';
  elsif v_current = 7 then
    v_milestone_hit := 'flame_7';
  elsif v_current = 30 then
    v_milestone_hit := 'legendary_30';
  end if;
  if v_milestone_hit <> 'none' then
    insert into public.user_streak_events
      (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
    values
      (p_user_id, 'milestone_hit', v_current, v_tokens, jsonb_build_object('tier', v_milestone_hit));
  end if;

  -- 6) Persist
  update public.user_stats
     set current_streak_days = v_current,
         longest_streak_days = v_longest,
         streak_freeze_tokens = v_tokens,
         last_streak_freeze_earned_at = v_last_earn,
         last_streak_break_at = case when v_was_broken then now() else last_streak_break_at end,
         last_streak_break_lost_days = case when v_was_broken then v_lost_days else last_streak_break_lost_days end,
         updated_at = now()
   where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'current_streak_days', v_current,
    'longest_streak_days', v_longest,
    'streak_freeze_tokens', v_tokens,
    'milestone_hit', v_milestone_hit,
    'was_broken', v_was_broken,
    'lost_days', v_lost_days,
    'lost_xp_value', v_lost_xp,
    'tokens_consumed', v_tokens_consumed,
    'freeze_earned', v_freeze_earned
  );
end;
$$;

revoke all on function public.update_streak_on_activity(uuid) from public;
grant  execute on function public.update_streak_on_activity(uuid) to authenticated;
grant  execute on function public.update_streak_on_activity(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 2.3 consume_streak_freeze(p_user_id) — manual freeze use
--
-- Only valid when the streak was broken TODAY (IST). Restores
-- current_streak_days to last_streak_break_lost_days + 1 (today counts).
-- -----------------------------------------------------------------------------
create or replace function public.consume_streak_freeze(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller          uuid := auth.uid();
  v_today           date := (now() at time zone 'Asia/Kolkata')::date;
  v_stats           public.user_stats%rowtype;
  v_break_today     boolean;
  v_restored        int;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'consume_streak_freeze: cannot affect another user'
      using errcode = '42501';
  end if;

  select * into v_stats from public.user_stats where user_id = p_user_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_user_stats_row');
  end if;

  v_break_today := v_stats.last_streak_break_at is not null
    and (v_stats.last_streak_break_at at time zone 'Asia/Kolkata')::date = v_today;
  if not v_break_today then
    return jsonb_build_object('ok', false, 'reason', 'no_recent_break');
  end if;
  if coalesce(v_stats.streak_freeze_tokens, 0) < 1 then
    return jsonb_build_object('ok', false, 'reason', 'no_tokens');
  end if;

  v_restored := coalesce(v_stats.last_streak_break_lost_days, 0) + 1;

  update public.user_stats
     set current_streak_days   = v_restored,
         longest_streak_days   = greatest(coalesce(longest_streak_days, 0), v_restored),
         streak_freeze_tokens  = streak_freeze_tokens - 1,
         last_streak_break_at  = null,
         last_streak_break_lost_days = 0,
         updated_at            = now()
   where user_id = p_user_id;

  insert into public.user_streak_events
    (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
  values
    (p_user_id, 'manual_freeze_used', v_restored, v_stats.streak_freeze_tokens - 1,
     jsonb_build_object('restored_to', v_restored, 'broken_lost_days', v_stats.last_streak_break_lost_days));

  return jsonb_build_object(
    'ok', true,
    'current_streak_days', v_restored,
    'streak_freeze_tokens', v_stats.streak_freeze_tokens - 1
  );
end;
$$;

revoke all on function public.consume_streak_freeze(uuid) from public;
grant  execute on function public.consume_streak_freeze(uuid) to authenticated;
grant  execute on function public.consume_streak_freeze(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 2.5 backfill_streak_from_history(p_user_id) — one-time per user
--
-- Mirrors the JS computeStreak() helper:
--   - Anchor at today if today has session activity, else yesterday (grace).
--   - Count consecutive prior days that have session activity.
--   - Anchor latest = greatest(activity_date) → if older than yesterday, streak=0.
-- Writes a "backfill_complete" event so the function is idempotent.
-- -----------------------------------------------------------------------------
create or replace function public.backfill_streak_from_history(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller         uuid := auth.uid();
  v_today          date := (now() at time zone 'Asia/Kolkata')::date;
  v_yesterday      date := v_today - 1;
  v_anchor         date;
  v_cursor         date;
  v_streak         int := 0;
  v_longest        int := 0;
  v_existing       record;
  v_row_count      int;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'backfill_streak_from_history: cannot affect another user'
      using errcode = '42501';
  end if;

  -- Idempotency
  if exists (
    select 1 from public.user_streak_events
     where user_id = p_user_id and event_type = 'backfill_complete'
  ) then
    return jsonb_build_object('ok', true, 'no_op', true, 'reason', 'already_backfilled');
  end if;

  -- Collect distinct IST activity dates from user_sessions.completed_at
  create temp table _activity_dates(d date primary key) on commit drop;
  insert into _activity_dates(d)
  select distinct (us.completed_at at time zone 'Asia/Kolkata')::date
    from public.user_sessions us
   where us.user_id = p_user_id
     and us.completed_at is not null
  on conflict (d) do nothing;

  -- Also fold in any user_daily_activity rows that already exist (those were created by award_xp).
  insert into _activity_dates(d)
  select activity_date from public.user_daily_activity
   where user_id = p_user_id
  on conflict (d) do nothing;

  select count(*) into v_row_count from _activity_dates;
  if v_row_count = 0 then
    -- No history at all → leave streak at 0 but mark backfill done.
    insert into public.user_streak_events
      (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
    values
      (p_user_id, 'backfill_complete', 0, 0, jsonb_build_object('no_history', true));
    update public.user_stats
       set current_streak_days = 0,
           longest_streak_days = greatest(coalesce(longest_streak_days, 0), 0),
           updated_at = now()
     where user_id = p_user_id;
    return jsonb_build_object('ok', true, 'current_streak_days', 0, 'longest_streak_days', 0);
  end if;

  -- Pick anchor: today if present, else yesterday if present, else streak 0
  if exists (select 1 from _activity_dates where d = v_today) then
    v_anchor := v_today;
  elsif exists (select 1 from _activity_dates where d = v_yesterday) then
    v_anchor := v_yesterday;
  else
    v_anchor := null;
  end if;

  if v_anchor is not null then
    v_cursor := v_anchor;
    while exists (select 1 from _activity_dates where d = v_cursor) loop
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
    end loop;
  end if;

  -- Longest streak across all history (scan all_dates in order)
  -- Optimisation note: cheap because user_sessions is bounded per user.
  declare
    v_prev date := null;
    v_run  int := 0;
  begin
    for v_existing in (select d from _activity_dates order by d asc) loop
      if v_prev is null or v_existing.d = v_prev + 1 then
        v_run := v_run + 1;
      else
        v_run := 1;
      end if;
      if v_run > v_longest then v_longest := v_run; end if;
      v_prev := v_existing.d;
    end loop;
  end;
  v_longest := greatest(v_longest, v_streak);

  update public.user_stats
     set current_streak_days = v_streak,
         longest_streak_days = greatest(coalesce(longest_streak_days, 0), v_longest),
         updated_at = now()
   where user_id = p_user_id;

  -- Synthetic 'incremented' event dated at the anchor day so a subsequent
  -- update_streak_on_activity correctly resumes from the backfilled value
  -- (instead of treating today's activity as the first-ever).
  if v_anchor is not null and v_streak > 0 then
    insert into public.user_streak_events
      (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta, created_at)
    values
      (p_user_id, 'incremented', v_streak, 0,
       jsonb_build_object('source', 'backfill_synthetic'),
       (v_anchor::text || ' 12:00:00 Asia/Kolkata')::timestamptz);
  end if;

  -- Mark idempotent (so subsequent calls no-op).
  insert into public.user_streak_events
    (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
  values
    (p_user_id, 'backfill_complete', v_streak, 0,
     jsonb_build_object('computed_streak', v_streak, 'computed_longest', v_longest, 'anchor', v_anchor));

  return jsonb_build_object(
    'ok', true,
    'current_streak_days', v_streak,
    'longest_streak_days', v_longest,
    'anchor', v_anchor
  );
end;
$$;

revoke all on function public.backfill_streak_from_history(uuid) from public;
grant  execute on function public.backfill_streak_from_history(uuid) to authenticated;
grant  execute on function public.backfill_streak_from_history(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- DEV-ONLY: dev_simulate_streak_day(p_user_id, p_days_back)
--
-- Inserts (or upserts) a user_daily_activity row at "today - p_days_back" IST
-- AND a corresponding incremented user_streak_events row dated the same.
-- This lets the tester force "yesterday's activity" or "3 days ago" without
-- waiting real wall-clock days, so update_streak_on_activity behaviour can be
-- exercised end-to-end.
--
-- Gated by current_setting('app.allow_dev_rpcs', true) = 'true'. The migration
-- sets this GUC at database level (see end of file). Flip to 'false' or unset
-- when we want to harden for prod.
-- -----------------------------------------------------------------------------
create or replace function public.dev_simulate_streak_day(p_user_id uuid, p_days_back int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_date date;
  v_ts          timestamptz;
  v_allowed     text;
begin
  select value into v_allowed from public.app_settings where key = 'allow_dev_rpcs' limit 1;
  if coalesce(v_allowed, 'false') <> 'true' then
    raise exception 'dev_simulate_streak_day disabled (set app_settings.allow_dev_rpcs=true)'
      using errcode = '42501';
  end if;
  if p_days_back < 0 then
    raise exception 'p_days_back must be >= 0' using errcode='22023';
  end if;

  v_target_date := (now() at time zone 'Asia/Kolkata')::date - p_days_back;
  -- Construct a timestamptz at noon IST on the target date so the (created_at AT TIME ZONE 'Asia/Kolkata')::date
  -- math in update_streak_on_activity unambiguously resolves to v_target_date.
  v_ts := (v_target_date::text || ' 12:00:00 Asia/Kolkata')::timestamptz;

  -- Insert (or upsert) user_daily_activity row at target_date
  insert into public.user_daily_activity
    (user_id, activity_date, xp_earned, sessions_completed, minutes_spent, events_count, created_at, updated_at)
  values
    (p_user_id, v_target_date, 25, 0, 5, 1, v_ts, v_ts)
  on conflict (user_id, activity_date) do update
    set events_count = public.user_daily_activity.events_count + 1,
        updated_at   = excluded.updated_at;

  -- Insert a streak event dated the same so update_streak_on_activity sees the
  -- last touched IST date as v_target_date.
  insert into public.user_streak_events
    (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta, created_at)
  values
    (p_user_id, 'incremented', 1, 0, jsonb_build_object('source', 'dev_simulate', 'days_back', p_days_back), v_ts);

  return jsonb_build_object(
    'ok', true,
    'activity_date', v_target_date,
    'inserted_at', v_ts
  );
end;
$$;

revoke all on function public.dev_simulate_streak_day(uuid, int) from public;
grant  execute on function public.dev_simulate_streak_day(uuid, int) to authenticated;
grant  execute on function public.dev_simulate_streak_day(uuid, int) to service_role;

commit;

-- =============================================================================
-- end of migration 0002
-- =============================================================================
