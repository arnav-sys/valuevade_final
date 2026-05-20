-- Patch update_daily_challenge_progress to fire the badge evaluator when
-- daily_champion is triggered. This makes the daily_champion badge unlock
-- atomically with the +75 XP bonus + glow activation, without requiring the
-- frontend to explicitly call evaluate_badges after the daily challenge RPC.

create or replace function public.update_daily_challenge_progress(
  p_user_id        uuid,
  p_challenge_type text,
  p_increment      int default 1,
  p_meta           jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller        uuid := auth.uid();
  v_today         date := (now() at time zone 'Asia/Kolkata')::date;
  v_row           record;
  v_new_progress  int;
  v_updated       jsonb := '[]'::jsonb;
  v_newly         jsonb := '[]'::jsonb;
  v_completed_cnt int;
  v_champion      boolean := false;
  v_glow_active   timestamptz;
  v_badges        jsonb := '{}'::jsonb;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'update_daily_challenge_progress: caller % cannot act for %', v_caller, p_user_id
      using errcode = '42501';
  end if;

  if p_increment is null or p_increment < 0 then p_increment := 0; end if;

  for v_row in
    select udc.id, udc.challenge_id, udc.progress_current, udc.target_value,
           mdc.code, mdc.challenge_type, mdc.xp_reward
      from public.user_daily_challenges udc
      join public.master_daily_challenges mdc on mdc.id = udc.challenge_id
     where udc.user_id = p_user_id
       and udc.challenge_date = v_today
       and udc.is_completed = false
       and mdc.challenge_type = p_challenge_type
  loop
    if v_row.challenge_type = 'quiz_score_threshold' then
      if coalesce((p_meta->>'quiz_score')::int, -1) >= v_row.target_value then
        v_new_progress := v_row.target_value;
      else
        v_new_progress := v_row.progress_current;
      end if;
    else
      v_new_progress := least(v_row.progress_current + p_increment, v_row.target_value);
    end if;

    if v_new_progress <> v_row.progress_current then
      update public.user_daily_challenges
         set progress_current = v_new_progress,
             is_completed     = (v_new_progress >= v_row.target_value),
             completed_at     = case when v_new_progress >= v_row.target_value then now() else completed_at end
       where id = v_row.id;

      v_updated := v_updated || jsonb_build_object(
        'code', v_row.code,
        'progress_current', v_new_progress,
        'target_value', v_row.target_value
      );

      if v_new_progress >= v_row.target_value then
        v_newly := v_newly || jsonb_build_object(
          'code', v_row.code,
          'challenge_id', v_row.challenge_id,
          'xp_reward', v_row.xp_reward
        );
        if v_row.xp_reward > 0 then
          perform public.award_xp(
            p_user_id,
            v_row.xp_reward,
            'daily_challenge_complete',
            v_row.id,
            jsonb_build_object('challenge_code', v_row.code)
          );
        end if;
      end if;
    end if;
  end loop;

  select count(*) into v_completed_cnt
    from public.user_daily_challenges
   where user_id = p_user_id and challenge_date = v_today and is_completed = true;

  if v_completed_cnt >= 3 then
    select daily_champion_glow_until into v_glow_active
      from public.user_stats where user_id = p_user_id limit 1;
    if v_glow_active is null or v_glow_active < now() then
      v_champion := true;
      perform public.award_xp(
        p_user_id,
        75,
        'daily_champion_bonus',
        null,
        jsonb_build_object('date', v_today)
      );
      update public.user_stats
         set daily_champion_glow_until = now() + interval '24 hours',
             updated_at = now()
       where user_id = p_user_id;
      -- Daily Champion badge: trigger evaluator so the badge unlocks and
      -- the realtime subscriber fires the BadgeUnlockOverlay.
      v_badges := coalesce(public.evaluate_badges(
        p_user_id,
        jsonb_build_object('source_event', 'daily_champion_triggered',
                           'date', v_today)
      ), '{}'::jsonb);
    end if;
  end if;

  return jsonb_build_object(
    'today_ist', v_today,
    'challenges_updated', v_updated,
    'newly_completed', v_newly,
    'daily_champion_triggered', v_champion,
    'completed_count', v_completed_cnt,
    'badges', v_badges
  );
end;
$$;

grant execute on function public.update_daily_challenge_progress(uuid, text, int, jsonb) to authenticated, service_role;
