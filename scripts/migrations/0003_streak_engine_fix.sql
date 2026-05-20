-- =============================================================================
-- Migration 0003 — Streak engine fix pass
--
-- Phase 44 fix pass.  Rewrites update_streak_on_activity to derive the streak
-- from user_daily_activity rows (the heatmap) instead of trusting the cached
-- user_stats.current_streak_days counter.  The cached counter becomes a
-- RESULT of the RPC, not an INPUT.  This fixes Bug 1 reported by the tester:
-- dev_simulate_streak_day was inserting activity rows + synthetic ledger
-- entries but never bumping the cached counter, so the production engine
-- mis-computed transitions when given dev fixture state.
--
-- Idempotent: uses CREATE OR REPLACE FUNCTION.  Re-applying is safe.
-- =============================================================================

begin;

create or replace function public.update_streak_on_activity(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller             uuid := auth.uid();
  v_today              date := (now() at time zone 'Asia/Kolkata')::date;
  v_stats              public.user_stats%rowtype;
  v_prior_current      int;
  v_prior_longest      int;
  v_tokens             int;
  v_auto_spend         boolean;
  v_last_earn          timestamptz;
  v_most_recent_prior  date;
  v_gap                int;
  v_missed             int;
  v_new_streak         int := 0;
  v_new_longest        int;
  v_prior_streak       int := 0;
  v_was_broken         boolean := false;
  v_lost_days          int := 0;
  v_lost_xp            int := 0;
  v_tokens_consumed    int := 0;
  v_freeze_earned      boolean := false;
  v_milestone_hit      text := 'none';
  v_days_since_earn    int;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'update_streak_on_activity: cannot affect another user'
      using errcode = '42501';
  end if;

  select * into v_stats from public.user_stats where user_id = p_user_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_user_stats_row');
  end if;

  v_prior_current := coalesce(v_stats.current_streak_days, 0);
  v_prior_longest := coalesce(v_stats.longest_streak_days, 0);
  v_tokens        := coalesce(v_stats.streak_freeze_tokens, 0);
  v_auto_spend    := coalesce(v_stats.auto_spend_freeze, true);
  v_last_earn     := v_stats.last_streak_freeze_earned_at;

  -- 1) Defensive upsert: ensure today is in user_daily_activity.  award_xp
  -- usually inserts this row, but the engine should be self-contained.
  insert into public.user_daily_activity
    (user_id, activity_date, xp_earned, sessions_completed, minutes_spent, events_count)
  values
    (p_user_id, v_today, 0, 0, 0, 0)
  on conflict (user_id, activity_date) do nothing;

  -- 2) Most recent prior activity (strictly before today).
  select max(activity_date) into v_most_recent_prior
    from public.user_daily_activity
   where user_id = p_user_id and activity_date < v_today;

  -- 3) Literal streak: count consecutive days walking back from today.
  -- "row_number ordered desc" gives 0 for today, 1 for yesterday, ...; if
  -- days_back == rn for every row, those rows are consecutive.  The COUNT(*)
  -- is the size of that consecutive run starting at today.
  with all_dates as (
    select activity_date
      from public.user_daily_activity
     where user_id = p_user_id
       and activity_date <= v_today
       and activity_date > v_today - 365
     order by activity_date desc
  ),
  numbered as (
    select activity_date,
           (v_today - activity_date) as days_back,
           (row_number() over (order by activity_date desc) - 1) as rn
      from all_dates
  )
  select count(*) into v_new_streak
    from numbered
   where days_back = rn;

  -- 4) Gap handling — auto-spend freezes vs declare broken.
  if v_most_recent_prior is not null then
    v_gap := v_today - v_most_recent_prior; -- 1 = consecutive, >=2 = gap
    if v_gap > 1 then
      v_missed := v_gap - 1;

      -- prior_streak = consecutive days ending at v_most_recent_prior
      with all_prior as (
        select activity_date
          from public.user_daily_activity
         where user_id = p_user_id
           and activity_date <= v_most_recent_prior
           and activity_date > v_most_recent_prior - 365
         order by activity_date desc
      ),
      pnum as (
        select activity_date,
               (v_most_recent_prior - activity_date) as days_back,
               (row_number() over (order by activity_date desc) - 1) as rn
          from all_prior
      )
      select count(*) into v_prior_streak
        from pnum
       where days_back = rn;

      if v_auto_spend and v_tokens >= v_missed and v_missed > 0 then
        -- Bridge: prior consecutive run + missed days + today.
        v_tokens := v_tokens - v_missed;
        v_tokens_consumed := v_missed;
        v_new_streak := v_prior_streak + v_missed + 1;
      else
        v_was_broken := true;
        v_lost_days := v_prior_streak;
        v_lost_xp := v_prior_streak * 25;
        -- v_new_streak stays = 1 (only today in the consecutive run from today).
      end if;
    end if;
  end if;

  -- 5) Longest tracking.
  v_new_longest := greatest(v_prior_longest, v_new_streak);

  -- 6) Freeze accrual: +1 token per 10 IST days, cap 5.
  v_days_since_earn := case
    when v_last_earn is null then 9999
    else (v_today - (v_last_earn at time zone 'Asia/Kolkata')::date)
  end;
  if v_days_since_earn >= 10 and v_tokens < 5 then
    v_tokens := v_tokens + 1;
    v_last_earn := now();
    v_freeze_earned := true;
  end if;

  -- 7) Milestone — fires only on transition up to 3/7/30.
  if v_new_streak in (3,7,30) and v_new_streak > v_prior_current then
    if v_new_streak = 3 then v_milestone_hit := 'fire_3';
    elsif v_new_streak = 7 then v_milestone_hit := 'flame_7';
    else v_milestone_hit := 'legendary_30';
    end if;
  end if;

  -- 8) Ledger events — only on real transitions.  Repeat calls same day with
  -- no change emit zero events.
  if v_was_broken then
    insert into public.user_streak_events
      (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
    values
      (p_user_id, 'broken', v_lost_days, v_tokens,
       jsonb_build_object('lost_days', v_lost_days, 'lost_xp_value', v_lost_xp, 'gap_days', v_gap));
  end if;
  if v_tokens_consumed > 0 then
    insert into public.user_streak_events
      (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
    values
      (p_user_id, 'freeze_consumed', v_new_streak, v_tokens,
       jsonb_build_object('tokens_consumed', v_tokens_consumed, 'gap_days', v_gap));
  end if;
  if (not v_was_broken) and v_tokens_consumed = 0 and v_new_streak > v_prior_current then
    insert into public.user_streak_events
      (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
    values
      (p_user_id, 'incremented', v_new_streak, v_tokens,
       jsonb_build_object('prev_streak', v_prior_current));
  end if;
  if v_freeze_earned then
    insert into public.user_streak_events
      (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
    values
      (p_user_id, 'freeze_earned', v_new_streak, v_tokens,
       jsonb_build_object('days_since_last', v_days_since_earn));
  end if;
  if v_milestone_hit <> 'none' then
    insert into public.user_streak_events
      (user_id, event_type, streak_days_at_event, freeze_tokens_at_event, meta)
    values
      (p_user_id, 'milestone_hit', v_new_streak, v_tokens, jsonb_build_object('tier', v_milestone_hit));
  end if;

  -- 9) Persist user_stats.
  update public.user_stats
     set current_streak_days = v_new_streak,
         longest_streak_days = v_new_longest,
         streak_freeze_tokens = v_tokens,
         last_streak_freeze_earned_at = v_last_earn,
         last_streak_break_at = case when v_was_broken then now() else last_streak_break_at end,
         last_streak_break_lost_days = case when v_was_broken then v_lost_days else last_streak_break_lost_days end,
         updated_at = now()
   where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'current_streak_days', v_new_streak,
    'longest_streak_days', v_new_longest,
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

commit;
