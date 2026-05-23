-- 0020c — extend award_xp reason whitelist for Phase D2's plan_daily_target.
--
-- The base award_xp RPC has a hard-coded list of valid reasons. Adding
-- 'plan_daily_target' (the +25 XP bonus for hitting today's plan target)
-- without disturbing the rest of the function body.

begin;

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
  v_today          date := (now() at time zone 'Asia/Kolkata')::date;
  v_session_delta  int := 0;
  v_total_xp       int;
  v_new_level      int;
  v_threshold      record;
  v_old_level      int;
begin
  if p_amount is null or p_amount = 0 then
    return jsonb_build_object('ok', false, 'reason', 'zero_or_null_amount');
  end if;

  if p_reason not in (
    'session_complete','quiz_correct','quiz_attempt','simulation_complete',
    'daily_login','capstone_complete','module_complete','daily_challenge_complete',
    'daily_champion_bonus','signup_bonus','badge_unlock_bonus','streak_milestone',
    'manual_adjust','plan_daily_target'
  ) then
    raise exception 'award_xp: invalid reason %', p_reason using errcode = '22023';
  end if;

  -- 1) Append ledger event
  insert into public.user_xp_events (user_id, amount, reason, source_id, meta)
  values (p_user_id, p_amount, p_reason, p_source_id, coalesce(p_meta, '{}'::jsonb));

  -- 2) Session-time delta accounting (skip — handled by Phase 2's metadata logic)
  if (p_meta ? 'minutes') and (p_meta->>'minutes') ~ '^[0-9]+$' then
    v_session_delta := (p_meta->>'minutes')::int;
  end if;

  -- 3) Roll up to user_stats + user_xp_days. Use UPSERT semantics.
  insert into public.user_stats (user_id, total_xp, current_level, time_spent_minutes)
  values (p_user_id, p_amount, 1, v_session_delta)
  on conflict (user_id) do update set
    total_xp           = public.user_stats.total_xp + excluded.total_xp,
    time_spent_minutes = public.user_stats.time_spent_minutes + excluded.time_spent_minutes,
    updated_at         = now()
  returning total_xp into v_total_xp;

  -- Daily roll-up
  insert into public.user_xp_days (user_id, day_date, xp_earned, minutes_logged, sessions_completed)
  values (p_user_id, v_today, p_amount, v_session_delta, 1)
  on conflict (user_id, day_date) do update set
    xp_earned          = public.user_xp_days.xp_earned + excluded.xp_earned,
    minutes_logged     = public.user_xp_days.minutes_logged + excluded.minutes_logged,
    sessions_completed = public.user_xp_days.sessions_completed + excluded.sessions_completed,
    updated_at         = now();

  -- 4) Recompute level
  select current_level into v_old_level from public.user_stats where user_id = p_user_id;
  select level_number into v_new_level
    from public.master_levels
   where xp_threshold <= v_total_xp
   order by level_number desc
   limit 1;

  if v_new_level is not null and v_new_level <> coalesce(v_old_level, 1) then
    update public.user_stats set current_level = v_new_level where user_id = p_user_id;
  end if;

  return jsonb_build_object('ok', true, 'total_xp', v_total_xp, 'level', v_new_level);
end;
$$;

grant execute on function public.award_xp(uuid, int, text, uuid, jsonb)
  to authenticated, service_role;

commit;
