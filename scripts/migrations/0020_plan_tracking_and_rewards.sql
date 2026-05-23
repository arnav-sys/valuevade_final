-- 0020 — Phase D2: plan tracking + gamification hooks
--
-- Wires the auto-tracking RPC, the +25 XP daily-target reward (with a
-- partial unique index for idempotency), 3 new badges (on_track_today,
-- on_schedule_7, on_schedule_30), 2 new milestones (plan_streak_7,
-- plan_streak_30 — a new milestone kind), 1 new daily-challenge template
-- (`daily_plan_complete`), and modifies `pick_daily_challenges` to prefer
-- the plan challenge for users with an active study plan.
--
-- All idempotent — uses ON CONFLICT and CREATE OR REPLACE so a re-run is
-- safe.

begin;

-- ---------------------------------------------------------------------------
-- A. Add `completed_session_codes text[]` to user_study_plan_days so the
--    RPC can deduplicate "did this session already credit today's row?"
-- ---------------------------------------------------------------------------
alter table public.user_study_plan_days
  add column if not exists completed_session_codes text[] not null default '{}';


-- ---------------------------------------------------------------------------
-- B. Partial unique index on user_xp_events for the +25 plan_daily_target
--    XP, keyed by (user_id, meta->>'plan_day_date'). The Python handler
--    swallows the 23505 unique violation = "already paid today, no-op".
-- ---------------------------------------------------------------------------
create unique index if not exists ux_user_xp_events_plan_daily_target
  on public.user_xp_events (
    user_id,
    ((meta->>'plan_day_date'))
  )
  where reason = 'plan_daily_target';


-- ---------------------------------------------------------------------------
-- C. master_daily_challenges — extend the challenge_type check to allow
--    the new `plan_daily_target_met` type, then seed the template row.
-- ---------------------------------------------------------------------------
alter table public.master_daily_challenges
  drop constraint if exists master_daily_challenges_challenge_type_check;
alter table public.master_daily_challenges
  add constraint master_daily_challenges_challenge_type_check
  check (challenge_type = any (array[
    'quiz_questions_answered',
    'sessions_completed',
    'flashcards_reviewed',
    'quiz_score_threshold',
    'minutes_spent',
    'simulation_completed',
    'notes_completed',
    'interview_completed',
    'capstone_task_complete',
    'plan_daily_target_met'
  ]));

insert into public.master_daily_challenges
  (code, title, description, challenge_type, target_value, xp_reward, module_scope)
values
  ('daily_plan_complete', 'On the rails',
   'Complete today''s study plan target', 'plan_daily_target_met', 1, 25, null)
on conflict (code) do update set
  title          = excluded.title,
  description    = excluded.description,
  challenge_type = excluded.challenge_type,
  target_value   = excluded.target_value,
  xp_reward      = excluded.xp_reward,
  module_scope   = excluded.module_scope;


-- ---------------------------------------------------------------------------
-- D. Re-define `pick_daily_challenges`: for users with an active study
--    plan, slot 1 is FORCED to be the plan challenge; the other 2 are
--    random non-plan templates. For users without an active plan, the
--    plan challenge is excluded from the random pool (so they don't draw
--    something they can't progress).
-- ---------------------------------------------------------------------------
create or replace function public.pick_daily_challenges(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_today    date := (now() at time zone 'Asia/Kolkata')::date;
  v_count    int;
  v_rows     jsonb;
  v_has_plan boolean;
  v_plan_id  uuid;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'pick_daily_challenges: caller % cannot act for %', v_caller, p_user_id
      using errcode = '42501';
  end if;

  select count(*) into v_count
    from public.user_daily_challenges
   where user_id = p_user_id and challenge_date = v_today;

  if v_count = 0 then
    -- Does the user have an active study plan?
    select id into v_plan_id
      from public.user_study_plans
     where user_id = p_user_id and status = 'active'
     order by created_at desc limit 1;
    v_has_plan := v_plan_id is not null;

    if v_has_plan then
      -- Slot 1: the plan challenge.
      insert into public.user_daily_challenges
        (user_id, challenge_id, challenge_date, progress_current, target_value, is_completed)
      select p_user_id, m.id, v_today, 0, m.target_value, false
        from public.master_daily_challenges m
       where m.code = 'daily_plan_complete'
      on conflict (user_id, challenge_id, challenge_date) do nothing;

      -- Slots 2 + 3: random non-plan templates.
      insert into public.user_daily_challenges
        (user_id, challenge_id, challenge_date, progress_current, target_value, is_completed)
      select p_user_id, m.id, v_today, 0, m.target_value, false
        from (
          select id, target_value
            from public.master_daily_challenges
           where code <> 'daily_plan_complete'
           order by random()
           limit 2
        ) m
      on conflict (user_id, challenge_id, challenge_date) do nothing;
    else
      -- No active plan: 3 random non-plan templates.
      insert into public.user_daily_challenges
        (user_id, challenge_id, challenge_date, progress_current, target_value, is_completed)
      select p_user_id, m.id, v_today, 0, m.target_value, false
        from (
          select id, target_value
            from public.master_daily_challenges
           where code <> 'daily_plan_complete'
           order by random()
           limit 3
        ) m
      on conflict (user_id, challenge_id, challenge_date) do nothing;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',                udc.id,
    'challenge_id',      udc.challenge_id,
    'code',              mdc.code,
    'title',             mdc.title,
    'description',       mdc.description,
    'challenge_type',    mdc.challenge_type,
    'progress_current',  udc.progress_current,
    'target_value',      udc.target_value,
    'is_completed',      udc.is_completed,
    'completed_at',      udc.completed_at,
    'xp_reward',         mdc.xp_reward,
    'challenge_date',    udc.challenge_date
  ) order by mdc.code), '[]'::jsonb)
    into v_rows
    from public.user_daily_challenges udc
    join public.master_daily_challenges mdc on mdc.id = udc.challenge_id
   where udc.user_id = p_user_id and udc.challenge_date = v_today;

  return jsonb_build_object('today_ist', v_today, 'challenges', v_rows);
end;
$$;

grant execute on function public.pick_daily_challenges(uuid) to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- E. master_badges — seed 3 new Consistency-category badges
-- ---------------------------------------------------------------------------
insert into public.master_badges
  (code, name, description, category, rarity, icon_slug, is_secret,
   criteria_json, bonus_xp, progress_target, display_order)
values
  ('on_track_today', 'On Track Today',
   'Hit today''s study plan target',
   'consistency', 'common', 'check-circle', false,
   '{"trigger":"plan_daily_target_met"}'::jsonb, 0, 1, 5050),
  ('on_schedule_7', '7 Days on Schedule',
   'Held a one-week study cadence',
   'consistency', 'rare', 'flame', false,
   '{"trigger":"plan_streak","threshold":7}'::jsonb, 25, 7, 5070),
  ('on_schedule_30', '30 Days on Schedule',
   'Unbreakable — 30 days on plan',
   'consistency', 'legendary', 'crown', false,
   '{"trigger":"plan_streak","threshold":30}'::jsonb, 100, 30, 5100)
on conflict (code) do update set
  name           = excluded.name,
  description    = excluded.description,
  category       = excluded.category,
  rarity         = excluded.rarity,
  icon_slug      = excluded.icon_slug,
  criteria_json  = excluded.criteria_json,
  bonus_xp       = excluded.bonus_xp,
  progress_target= excluded.progress_target,
  display_order  = excluded.display_order;


-- ---------------------------------------------------------------------------
-- F. master_milestones — extend kind check to include `plan_streak`, then
--    seed plan_streak_7 + plan_streak_30. plan_streak rows use
--    `trigger_count` to encode the streak threshold (7, 30); the existing
--    `kind=count` check_and_grant helper never matches these because it
--    filters by `kind=count`.
-- ---------------------------------------------------------------------------
alter table public.master_milestones
  drop constraint if exists master_milestones_kind_check;
alter table public.master_milestones
  add constraint master_milestones_kind_check
  check (kind in ('module','count','plan_streak'));

-- Update the XOR: plan_streak uses trigger_count too, so the rule is
-- "if kind in (count, plan_streak) then trigger_count not null and
-- trigger_module_id is null; if kind=module then trigger_module_id not
-- null and trigger_count is null".
alter table public.master_milestones
  drop constraint if exists master_milestones_trigger_xor;
alter table public.master_milestones
  add constraint master_milestones_trigger_xor check (
    (kind = 'module'      and trigger_module_id is not null and trigger_count is null) or
    (kind = 'count'       and trigger_module_id is null     and trigger_count is not null) or
    (kind = 'plan_streak' and trigger_module_id is null     and trigger_count is not null)
  );

insert into public.master_milestones
  (code, kind, trigger_module_id, trigger_count, title, body, icon, rarity, display_order)
values
  ('plan_streak_7',  'plan_streak', null, 7,
   'On the rails — 7 days',
   'You''ve held a one-week study cadence. Consistency beats intensity every time on the desk.',
   '🚂', 'rare', 2007),
  ('plan_streak_30', 'plan_streak', null, 30,
   'Unbreakable — 30 days on plan',
   '30 days. Every day. No slip. This is the cadence professional research analysts run on.',
   '⛓️', 'legendary', 2030)
on conflict (code) do update set
  kind          = excluded.kind,
  trigger_count = excluded.trigger_count,
  title         = excluded.title,
  body          = excluded.body,
  icon          = excluded.icon,
  rarity        = excluded.rarity,
  display_order = excluded.display_order;


-- ---------------------------------------------------------------------------
-- G. The CORE RPC — update_plan_day_progress
--    Idempotent on (plan_id, day_date, session_code): a replay with the
--    same session_code does NOT re-increment counters.
-- ---------------------------------------------------------------------------
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
  v_plan            record;
  v_day             record;
  v_just_completed  boolean := false;
  v_was_complete    boolean;
  v_streak          int := 0;
  v_longest         int := 0;
  v_last_on_track   date;
begin
  -- (1) Find active plan.
  select id, plan_start_date, plan_end_date
    into v_plan
    from public.user_study_plans
   where user_id = p_user_id and status = 'active'
   order by created_at desc
   limit 1;

  if v_plan.id is null then
    return jsonb_build_object(
      'day_status', null,
      'on_schedule_streak_days', 0,
      'just_completed_today', false,
      'reason', 'no_active_plan'
    );
  end if;

  -- (2) Find today's day row.
  select id, required_minutes, actual_minutes, actual_sessions_completed,
         required_session_codes, completed_session_codes, status
    into v_day
    from public.user_study_plan_days
   where plan_id = v_plan.id and day_date = v_today
   for update;

  if v_day.id is null then
    return jsonb_build_object(
      'day_status', null,
      'on_schedule_streak_days', 0,
      'just_completed_today', false,
      'reason', 'no_day_row'
    );
  end if;

  -- (3) Rest day → don't touch counters, still credit streak via a NO-OP.
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

  -- (4) Idempotent: if this session_code was already credited today, skip.
  if p_session_code is not null
     and p_session_code <> ''
     and p_session_code = any(coalesce(v_day.completed_session_codes, '{}')) then
    return jsonb_build_object(
      'day_status', v_day.status,
      'on_schedule_streak_days', coalesce(
        (select on_schedule_streak_days from public.user_plan_adherence where user_id = p_user_id), 0),
      'just_completed_today', false,
      'reason', 'already_credited'
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
   where id = v_day.id
   returning required_minutes, actual_minutes, actual_sessions_completed,
             required_session_codes, completed_session_codes
   into v_day;

  -- (6) Recompute status: complete iff actual >= required minutes AND
  --     completed >= required sessions.
  if v_day.actual_minutes >= v_day.required_minutes
     and coalesce(array_length(v_day.completed_session_codes, 1), 0)
         >= coalesce(array_length(v_day.required_session_codes, 1), 0) then
    update public.user_study_plan_days set status = 'complete' where id = (
      select id from public.user_study_plan_days where plan_id = v_plan.id and day_date = v_today
    );
    if not v_was_complete then
      v_just_completed := true;
    end if;
  else
    update public.user_study_plan_days set status = 'today' where id = (
      select id from public.user_study_plan_days where plan_id = v_plan.id and day_date = v_today
    );
  end if;

  -- (7) Streak update — only on the FIRST flip to complete today.
  if v_just_completed then
    insert into public.user_plan_adherence (user_id, on_schedule_streak_days, longest_on_schedule_streak, last_on_track_date)
    values (p_user_id, 1, 1, v_today)
    on conflict (user_id) do nothing;

    select on_schedule_streak_days, longest_on_schedule_streak, last_on_track_date
      into v_streak, v_longest, v_last_on_track
      from public.user_plan_adherence where user_id = p_user_id;

    if v_last_on_track is null or v_last_on_track < v_today - interval '1 day' then
      -- Either first-ever or there was a gap → reset to 1.
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
    -- Just read current streak so caller has it.
    select coalesce(on_schedule_streak_days, 0) into v_streak
      from public.user_plan_adherence where user_id = p_user_id;
    if v_streak is null then v_streak := 0; end if;
  end if;

  return jsonb_build_object(
    'day_status',              (select status from public.user_study_plan_days where id = v_day.id),
    'on_schedule_streak_days', v_streak,
    'just_completed_today',    v_just_completed,
    'day_date',                v_today,
    'actual_minutes',          v_day.actual_minutes,
    'required_minutes',        v_day.required_minutes,
    'plan_id',                 v_plan.id
  );

exception
  when others then
    -- Defensive: surface RPC errors but never block the caller's flow.
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
