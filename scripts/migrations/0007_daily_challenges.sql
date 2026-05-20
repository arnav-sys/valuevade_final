-- =============================================================================
-- Migration 0007 — Daily Challenges + Daily Champion (Phase 4)
-- =============================================================================
--
-- A. Seed master_daily_challenges with 15 module-agnostic templates.
-- B. RPC pick_daily_challenges(uuid)  - idempotent per-day picker, returns 3.
-- C. RPC update_daily_challenge_progress(uuid, text, int, jsonb) - single
--    funnel for all progress mutations; awards XP, triggers Daily Champion
--    bonus + 24-hr glow when the 3rd challenge of the IST day completes.
-- D. Add user_daily_challenges to supabase_realtime publication; REPLICA
--    IDENTITY FULL so payload.old carries old progress_current/is_completed.
-- E. Update evaluate_badges → daily_champion case to count IST-days with 3
--    completed challenges and unlock the badge when gte threshold is met.
-- F. Dev RPCs: dev_force_complete_daily_challenge(uuid, text) and
--    dev_reset_daily_challenges(uuid), gated by allow_dev_rpcs='true'.
--
-- Idempotent; safe to re-run. Uses ON CONFLICT for seed rows and
-- CREATE OR REPLACE FUNCTION for the RPCs.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- A0. Extend challenge_type CHECK to include new P4 types.
--     Drop + recreate is the idempotent pattern PG supports here.
-- -----------------------------------------------------------------------------
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
    'capstone_task_complete'
  ]));

-- -----------------------------------------------------------------------------
-- A. Seed master_daily_challenges (15 templates, all module_scope=null = global)
-- -----------------------------------------------------------------------------

insert into public.master_daily_challenges
  (code, title, description, challenge_type, target_value, xp_reward, module_scope)
values
  ('daily_quiz_3',       'Quick Quizzer',       'Answer 3 quiz questions today',           'quiz_questions_answered', 3,  10, null),
  ('daily_quiz_5',       'Quiz Marathon',       'Answer 5 quiz questions today',           'quiz_questions_answered', 5,  15, null),
  ('daily_quiz_10',      'Quiz Beast',          'Answer 10 quiz questions today',          'quiz_questions_answered', 10, 25, null),
  ('daily_quiz_perfect', 'Sharpshooter',        'Score 80%+ on a quiz today',              'quiz_score_threshold',    80, 20, null),
  ('daily_session_1',    'Daily Driver',        'Complete 1 session today',                'sessions_completed',      1,  15, null),
  ('daily_session_2',    'Power Session',       'Complete 2 sessions today',               'sessions_completed',      2,  30, null),
  ('daily_notes_1',      'Notes Reader',        'Complete the notes phase of 1 session',   'notes_completed',         1,  10, null),
  ('daily_notes_3',      'Card Sharp',          'Review 3 flashcards today',               'flashcards_reviewed',     3,  10, null),
  ('daily_sim_1',        'Sim Pro',             'Complete 1 simulation today',             'simulation_completed',    1,  20, null),
  ('daily_sim_2',        'Sim Master',          'Complete 2 simulations today',            'simulation_completed',    2,  40, null),
  ('daily_time_10',      '10-Minute Habit',     'Spend 10 minutes learning today',         'minutes_spent',           10, 10, null),
  ('daily_time_15',      'Steady Studier',      'Spend 15 minutes learning today',         'minutes_spent',           15, 15, null),
  ('daily_time_30',      'Deep Diver',          'Spend 30 minutes learning today',         'minutes_spent',           30, 25, null),
  ('daily_interview_1',  'Interview Sharpener', 'Complete 1 interview phase today',        'interview_completed',     1,  15, null),
  ('daily_capstone_step','Capstone Progress',   'Make progress on the capstone today',     'capstone_task_complete',  1,  20, null)
on conflict (code) do update set
  title          = excluded.title,
  description    = excluded.description,
  challenge_type = excluded.challenge_type,
  target_value   = excluded.target_value,
  xp_reward      = excluded.xp_reward,
  module_scope   = excluded.module_scope;

-- -----------------------------------------------------------------------------
-- B. pick_daily_challenges(p_user_id)  -  idempotent per-day picker
-- -----------------------------------------------------------------------------
create or replace function public.pick_daily_challenges(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
  v_count  int;
  v_rows   jsonb;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'pick_daily_challenges: caller % cannot act for %', v_caller, p_user_id
      using errcode = '42501';
  end if;

  select count(*) into v_count
    from public.user_daily_challenges
   where user_id = p_user_id and challenge_date = v_today;

  if v_count = 0 then
    -- Pick 3 distinct templates at random (all 15 are module-agnostic in P4).
    insert into public.user_daily_challenges (user_id, challenge_id, challenge_date, progress_current, target_value, is_completed)
    select p_user_id, m.id, v_today, 0, m.target_value, false
      from (
        select id, target_value
          from public.master_daily_challenges
         order by random()
         limit 3
      ) m
    on conflict (user_id, challenge_id, challenge_date) do nothing;
  end if;

  -- Return the full 3-row set, joined with master metadata.
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

-- -----------------------------------------------------------------------------
-- C. update_daily_challenge_progress(p_user_id, p_challenge_type, p_increment, p_meta)
-- -----------------------------------------------------------------------------
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
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'update_daily_challenge_progress: caller % cannot act for %', v_caller, p_user_id
      using errcode = '42501';
  end if;

  if p_increment is null or p_increment < 0 then p_increment := 0; end if;

  -- Loop through every open challenge of this type for today.
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
      -- Threshold semantics: ignore p_increment; complete iff the
      -- p_meta.quiz_score meets or exceeds target_value.
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

  -- After all updates: check if user now has 3 completed challenges for today.
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
    end if;
  end if;

  return jsonb_build_object(
    'today_ist', v_today,
    'challenges_updated', v_updated,
    'newly_completed', v_newly,
    'daily_champion_triggered', v_champion,
    'completed_count', v_completed_cnt
  );
end;
$$;

grant execute on function public.update_daily_challenge_progress(uuid, text, int, jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- D. Realtime: publish user_daily_challenges + REPLICA IDENTITY FULL
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'user_daily_challenges'
  ) then
    execute 'alter publication supabase_realtime add table public.user_daily_challenges';
  end if;
end$$;

alter table public.user_daily_challenges replica identity full;

-- -----------------------------------------------------------------------------
-- E. evaluate_badges → daily_champion case: count IST-days where the user
--    has 3 completed challenges. We patch the body via CREATE OR REPLACE.
-- -----------------------------------------------------------------------------
-- This block re-creates the entire evaluate_badges function with the
-- daily_champion case updated. The rest of the body is identical to 0004.
-- (Keep this version idempotent — running migration twice is a no-op.)

create or replace function public.evaluate_badges(
  p_user_id uuid,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller       uuid := auth.uid();
  v_badge        public.master_badges%rowtype;
  v_user_row     public.user_badges%rowtype;
  v_was_unlocked boolean;
  v_target       int;
  v_progress     int := 0;
  v_met          boolean := false;
  v_module_count int;
  v_event_count  int;
  v_freeze_count int;
  v_broken_count int;
  v_quiz_score   int;
  v_quiz_secs    int;
  v_sess_secs    int;
  v_hour_ist     int;
  v_stats_row    public.user_stats%rowtype;
  v_profile_row  public.profiles%rowtype;
  v_new_unlocks  jsonb := '[]'::jsonb;
  v_near_miss    jsonb := '[]'::jsonb;
  v_dc_count     int;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'evaluate_badges: caller % cannot evaluate badges for %', v_caller, p_user_id
      using errcode = '42501';
  end if;

  v_quiz_score := nullif(p_context->>'quiz_score', '')::int;
  v_quiz_secs  := nullif(p_context->>'quiz_duration_seconds', '')::int;
  v_sess_secs  := nullif(p_context->>'session_duration_seconds', '')::int;
  v_hour_ist   := nullif(p_context->>'hour_ist', '')::int;

  select * into v_stats_row from public.user_stats where user_id = p_user_id limit 1;
  select * into v_profile_row from public.profiles where id = p_user_id limit 1;

  for v_badge in
    select * from public.master_badges order by display_order
  loop
    select * into v_user_row from public.user_badges where user_id = p_user_id and badge_id = v_badge.id limit 1;
    if not found then
      insert into public.user_badges (user_id, badge_id, progress_target)
      values (p_user_id, v_badge.id, coalesce(v_badge.progress_target, 1))
      returning * into v_user_row;
    end if;

    v_was_unlocked := coalesce(v_user_row.is_unlocked, false);
    if v_was_unlocked then continue; end if;

    v_target := coalesce(v_user_row.progress_target, v_badge.progress_target, 1);
    v_progress := coalesce(v_user_row.progress_current, 0);
    v_met := false;

    case v_badge.criteria_json->>'type'
      when 'night_owl' then
        v_met := v_hour_ist is not null and (v_hour_ist >= 22 or v_hour_ist < 4);
        v_progress := case when v_met then 1 else 0 end;

      when 'early_bird' then
        v_met := v_hour_ist is not null and v_hour_ist >= 5 and v_hour_ist < 8;
        v_progress := case when v_met then 1 else 0 end;

      when 'weekend_warrior' then
        v_met := extract(isodow from ((now() at time zone 'Asia/Kolkata')::date)) in (6, 7);
        v_progress := case when v_met then 1 else 0 end;

      when 'all_modules_complete' then
        select count(*)::int into v_module_count
          from public.user_modules um
          join public.user_enrollments ue on ue.id = um.enrollment_id
         where ue.user_id = p_user_id and um.is_completed = true;
        v_met := v_module_count >= coalesce((v_badge.criteria_json->>'count')::int, 13);
        v_progress := least(v_module_count, v_target);

      when 'any_module_complete' then
        select count(*)::int into v_module_count
          from public.user_modules um
          join public.user_enrollments ue on ue.id = um.enrollment_id
         where ue.user_id = p_user_id and um.is_completed = true;
        v_progress := least(v_module_count, v_target);
        v_met := v_module_count >= coalesce((v_badge.criteria_json->>'count')::int, 1);

      when 'quiz_score' then
        if v_quiz_score is not null then
          v_met := v_quiz_score >= (v_badge.criteria_json->>'gte')::int;
        end if;
        v_progress := case when v_met then 1 else v_progress end;

      when 'quiz_complete_time' then
        if v_quiz_secs is not null then
          v_met := v_quiz_secs <= (v_badge.criteria_json->>'lte_seconds')::int;
        end if;
        v_progress := case when v_met then 1 else v_progress end;

      when 'session_complete_time' then
        if v_sess_secs is not null then
          if v_badge.criteria_json ? 'lte_seconds' then
            v_met := v_sess_secs <= (v_badge.criteria_json->>'lte_seconds')::int;
          elsif v_badge.criteria_json ? 'gte_seconds' then
            v_met := v_sess_secs >= (v_badge.criteria_json->>'gte_seconds')::int;
          end if;
        end if;
        v_progress := case when v_met then 1 else v_progress end;

      when 'capstone_complete' then
        v_met := exists (
          select 1
            from public.user_capstone_projects ucp
            join public.user_enrollments ue on ue.id = ucp.enrollment_id
           where ue.user_id = p_user_id and ucp.is_completed = true
        );
        v_progress := case when v_met then 1 else 0 end;

      when 'first_event' then
        v_met := exists (
          select 1 from public.user_xp_events
           where user_id = p_user_id
             and reason = v_badge.criteria_json->>'reason'
          limit 1
        );
        v_progress := case when v_met then 1 else 0 end;

      when 'daily_goal_set' then
        v_met := v_stats_row.daily_goal_minutes is not null;
        v_progress := case when v_met then 1 else 0 end;

      when 'freeze_consumed' then
        select count(*)::int into v_freeze_count
          from public.user_streak_events
         where user_id = p_user_id and event_type = 'freeze_consumed';
        v_progress := least(v_freeze_count, v_target);
        v_met := v_freeze_count >= coalesce((v_badge.criteria_json->>'gte')::int, 1);

      when 'streak_days' then
        v_progress := least(coalesce(v_stats_row.longest_streak_days, 0), v_target);
        v_met := coalesce(v_stats_row.longest_streak_days, 0) >= (v_badge.criteria_json->>'gte')::int;

      when 'event_count' then
        select count(*)::int into v_event_count
          from public.user_xp_events
         where user_id = p_user_id
           and reason = v_badge.criteria_json->>'reason';
        v_progress := least(v_event_count, v_target);
        v_met := v_event_count >= (v_badge.criteria_json->>'gte')::int;

      when 'profile_complete' then
        v_met := v_profile_row.full_name is not null
             and trim(v_profile_row.full_name) <> ''
             and v_stats_row.daily_goal_minutes is not null;
        v_progress := case when v_met then 1 else 0 end;

      when 'signed_up_before' then
        v_met := v_profile_row.created_at is not null
             and v_profile_row.created_at < (v_badge.criteria_json->>'date')::timestamptz;
        v_progress := case when v_met then 1 else 0 end;

      when 'returned_after_gap' then
        v_met := exists (
          select 1
            from public.user_streak_events
           where user_id = p_user_id
             and event_type = 'broken'
             and event_at < now() - interval '7 days'
        );
        v_progress := case when v_met then 1 else 0 end;

      when 'streak_broken_then_recovered' then
        select count(*)::int into v_broken_count
          from public.user_streak_events
         where user_id = p_user_id and event_type = 'broken';
        v_progress := least(v_broken_count, v_target);
        v_met := v_broken_count >= coalesce((v_badge.criteria_json->>'times_gte')::int, 3);

      when 'daily_champion' then
        select count(*)::int into v_dc_count
          from (
            select challenge_date
              from public.user_daily_challenges
             where user_id = p_user_id and is_completed = true
             group by challenge_date
            having count(*) >= 3
          ) s;
        v_progress := least(v_dc_count, v_target);
        v_met := v_dc_count >= coalesce((v_badge.criteria_json->>'gte')::int, 1);

      else
        v_met := false;
    end case;

    if v_met then
      update public.user_badges
         set is_unlocked      = true,
             earned_at        = now(),
             progress_current = v_target,
             last_progress_seen = v_target
       where user_id = p_user_id and badge_id = v_badge.id;

      v_new_unlocks := v_new_unlocks || jsonb_build_object(
        'code', v_badge.code,
        'name', v_badge.name,
        'description', v_badge.description,
        'category', v_badge.category,
        'rarity', v_badge.rarity,
        'icon_slug', v_badge.icon_slug,
        'is_secret', v_badge.is_secret,
        'bonus_xp', v_badge.bonus_xp
      );

      if v_badge.bonus_xp > 0 then
        perform public.award_xp(
          p_user_id,
          v_badge.bonus_xp,
          'badge_unlock_bonus',
          v_badge.id,
          jsonb_build_object('badge_code', v_badge.code)
        );
      end if;
    else
      if v_progress > coalesce(v_user_row.progress_current, 0) then
        update public.user_badges
           set progress_current   = v_progress,
               last_progress_seen = v_progress
         where user_id = p_user_id and badge_id = v_badge.id;

        if not v_badge.is_secret
           and v_target > 0
           and (v_progress::numeric / v_target::numeric) >= 0.5 then
          v_near_miss := v_near_miss || jsonb_build_object(
            'code', v_badge.code,
            'name', v_badge.name,
            'category', v_badge.category,
            'rarity', v_badge.rarity,
            'progress_current', v_progress,
            'progress_target', v_target,
            'progress_pct', round((v_progress::numeric / v_target::numeric) * 100.0, 1)
          );
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'newly_unlocked', v_new_unlocks,
    'near_miss', v_near_miss
  );
end;
$$;

grant execute on function public.evaluate_badges(uuid, jsonb) to authenticated, service_role;

-- daily_champion badge criteria_json: set gte=1 so the first Daily Champion day unlocks it.
update public.master_badges
   set criteria_json = '{"type":"daily_champion","gte":1}'::jsonb,
       progress_target = 1
 where code = 'daily_champion';

-- -----------------------------------------------------------------------------
-- F. Dev-only test helpers (gated by app_settings.allow_dev_rpcs='true')
-- -----------------------------------------------------------------------------

create or replace function public.dev_force_complete_daily_challenge(
  p_user_id uuid,
  p_challenge_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow   boolean := false;
  v_today   date := (now() at time zone 'Asia/Kolkata')::date;
  v_master  public.master_daily_challenges%rowtype;
  v_udc     public.user_daily_challenges%rowtype;
begin
  select (value::text = 'true') into v_allow from public.app_settings where key = 'allow_dev_rpcs' limit 1;
  if not v_allow then
    raise exception 'dev_force_complete_daily_challenge: dev RPCs disabled' using errcode = '42501';
  end if;

  select * into v_master from public.master_daily_challenges where code = p_challenge_code limit 1;
  if not found then
    raise exception 'dev_force_complete_daily_challenge: unknown challenge_code %', p_challenge_code
      using errcode = '22023';
  end if;

  -- Ensure the row exists for today; create it if not.
  insert into public.user_daily_challenges (user_id, challenge_id, challenge_date, progress_current, target_value, is_completed)
  values (p_user_id, v_master.id, v_today, 0, v_master.target_value, false)
  on conflict (user_id, challenge_id, challenge_date) do nothing;

  -- Now route through the canonical update funnel so XP + glow + champion fire.
  -- For threshold types we synthesize a passing quiz_score so the gate trips.
  if v_master.challenge_type = 'quiz_score_threshold' then
    return public.update_daily_challenge_progress(
      p_user_id, v_master.challenge_type, 0,
      jsonb_build_object('quiz_score', v_master.target_value)
    );
  else
    return public.update_daily_challenge_progress(
      p_user_id, v_master.challenge_type, v_master.target_value,
      jsonb_build_object('dev', true, 'challenge_code', v_master.code)
    );
  end if;
end;
$$;

grant execute on function public.dev_force_complete_daily_challenge(uuid, text) to authenticated, service_role;


create or replace function public.dev_reset_daily_challenges(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow boolean := false;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_deleted int := 0;
begin
  select (value::text = 'true') into v_allow from public.app_settings where key = 'allow_dev_rpcs' limit 1;
  if not v_allow then
    raise exception 'dev_reset_daily_challenges: dev RPCs disabled' using errcode = '42501';
  end if;
  delete from public.user_daily_challenges
   where user_id = p_user_id and challenge_date = v_today;
  get diagnostics v_deleted = row_count;
  -- Also clear today's daily_champion glow so re-tests can fire fresh.
  update public.user_stats
     set daily_champion_glow_until = null
   where user_id = p_user_id and daily_champion_glow_until > now();
  return jsonb_build_object('deleted', v_deleted, 'today_ist', v_today);
end;
$$;

grant execute on function public.dev_reset_daily_challenges(uuid) to authenticated, service_role;

commit;
