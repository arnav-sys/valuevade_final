-- 0020b — fix update_plan_day_progress RPC.
--
-- Bug: after `update … returning required_minutes, actual_minutes, … into v_day`,
-- the v_day record no longer has the `id` field that we reference below.
-- Fix: capture the day id into a separate variable before the UPDATE, and
-- use that variable everywhere (cleaner than including id in RETURNING).

begin;

create or replace function public.update_plan_day_progress(
  p_user_id        uuid,
  p_session_minutes int,
  p_session_code   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today           date := (now() at time zone 'Asia/Kolkata')::date;
  v_plan_id         uuid;
  v_day_id          uuid;
  v_day             record;
  v_just_completed  boolean := false;
  v_was_complete    boolean;
  v_streak          int := 0;
  v_longest         int := 0;
  v_last_on_track   date;
  v_new_status      text;
begin
  -- (1) Find active plan.
  select id into v_plan_id
    from public.user_study_plans
   where user_id = p_user_id and status = 'active'
   order by created_at desc
   limit 1;

  if v_plan_id is null then
    return jsonb_build_object(
      'day_status', null,
      'on_schedule_streak_days', 0,
      'just_completed_today', false,
      'reason', 'no_active_plan'
    );
  end if;

  -- (2) Find today's day row. Capture id in v_day_id so it survives the
  -- later UPDATE...RETURNING into v_day (which would otherwise strip id).
  select id, required_minutes, actual_minutes, actual_sessions_completed,
         required_session_codes, completed_session_codes, status
    into v_day
    from public.user_study_plan_days
   where plan_id = v_plan_id and day_date = v_today
   for update;

  if v_day.id is null then
    return jsonb_build_object(
      'day_status', null,
      'on_schedule_streak_days', 0,
      'just_completed_today', false,
      'reason', 'no_day_row'
    );
  end if;
  v_day_id := v_day.id;

  -- (3) Rest day → no-op (preserve streak via separate read).
  if v_day.status = 'rest' then
    return jsonb_build_object(
      'day_status', 'rest',
      'on_schedule_streak_days', coalesce(
        (select on_schedule_streak_days from public.user_plan_adherence where user_id = p_user_id), 0),
      'just_completed_today', false,
      'reason', 'rest_day'
    );
  end if;

  v_was_complete := (v_day.status = 'complete');

  -- (4) Idempotent: skip if this session_code was already credited today.
  if p_session_code is not null
     and p_session_code <> ''
     and p_session_code = any(coalesce(v_day.completed_session_codes, '{}')) then
    return jsonb_build_object(
      'day_status', v_day.status,
      'on_schedule_streak_days', coalesce(
        (select on_schedule_streak_days from public.user_plan_adherence where user_id = p_user_id), 0),
      'just_completed_today', false,
      'reason', 'already_credited',
      'plan_id', v_plan_id,
      'day_date', v_today
    );
  end if;

  -- (5) Increment counters.
  update public.user_study_plan_days
     set actual_minutes            = actual_minutes + coalesce(p_session_minutes, 0),
         actual_sessions_completed = actual_sessions_completed + 1,
         completed_session_codes   = case
           when p_session_code is null or p_session_code = ''
             then completed_session_codes
           else array_append(coalesce(completed_session_codes, '{}'::text[]), p_session_code)
         end,
         updated_at                = now()
   where id = v_day_id
   returning required_minutes, actual_minutes, actual_sessions_completed,
             required_session_codes, completed_session_codes
   into v_day;

  -- (6) Recompute status (complete iff actual minutes & sessions both met).
  if v_day.actual_minutes >= v_day.required_minutes
     and coalesce(array_length(v_day.completed_session_codes, 1), 0)
         >= coalesce(array_length(v_day.required_session_codes, 1), 0) then
    v_new_status := 'complete';
    if not v_was_complete then v_just_completed := true; end if;
  else
    v_new_status := 'today';
  end if;
  update public.user_study_plan_days set status = v_new_status where id = v_day_id;

  -- (7) Streak update on FIRST flip to complete today.
  if v_just_completed then
    insert into public.user_plan_adherence (user_id, on_schedule_streak_days, longest_on_schedule_streak, last_on_track_date)
    values (p_user_id, 1, 1, v_today)
    on conflict (user_id) do nothing;

    select on_schedule_streak_days, longest_on_schedule_streak, last_on_track_date
      into v_streak, v_longest, v_last_on_track
      from public.user_plan_adherence where user_id = p_user_id;

    if v_last_on_track is null or v_last_on_track < v_today - interval '1 day' then
      v_streak := 1;
    elsif v_last_on_track = v_today - interval '1 day' then
      v_streak := v_streak + 1;
    end if;
    if v_streak > v_longest then v_longest := v_streak; end if;

    update public.user_plan_adherence
       set on_schedule_streak_days    = v_streak,
           longest_on_schedule_streak = v_longest,
           last_on_track_date         = v_today,
           updated_at                 = now()
     where user_id = p_user_id;
  else
    select coalesce(on_schedule_streak_days, 0) into v_streak
      from public.user_plan_adherence where user_id = p_user_id;
    if v_streak is null then v_streak := 0; end if;
  end if;

  return jsonb_build_object(
    'day_status',              v_new_status,
    'on_schedule_streak_days', v_streak,
    'just_completed_today',    v_just_completed,
    'day_date',                v_today,
    'actual_minutes',          v_day.actual_minutes,
    'required_minutes',        v_day.required_minutes,
    'plan_id',                 v_plan_id
  );

exception
  when others then
    raise notice 'update_plan_day_progress error: % %', sqlstate, sqlerrm;
    return jsonb_build_object(
      'day_status', null,
      'on_schedule_streak_days', 0,
      'just_completed_today', false,
      'reason', 'rpc_error: ' || sqlerrm
    );
end;
$$;

grant execute on function public.update_plan_day_progress(uuid, int, text)
  to authenticated, service_role;

commit;
