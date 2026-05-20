-- =============================================================================
-- Migration 0004 — Badge & Achievement Engine
-- Phase 3 of Valuevade gamification.
--
-- Adds:
--   • New columns on master_badges: progress_target, display_order
--   • New columns on user_badges: last_progress_seen, near_miss_acknowledged_at
--   • 22 master_badges rows seeded (idempotent via ON CONFLICT)
--   • New RPC: evaluate_badges(p_user_id, p_context) — the single mutation
--     funnel for badge state. Iterates 22 criteria types, awards new unlocks,
--     fires bonus XP, surfaces near-miss transitions (crossed 60%).
--   • New dev RPC: dev_force_unlock_badge(p_user_id, p_badge_code) — gated
--     by app_settings.allow_dev_rpcs='true'.
--
-- Idempotent: every CREATE / ALTER uses IF NOT EXISTS or OR REPLACE; seeds
-- use ON CONFLICT (code) DO UPDATE so re-running keeps the catalog fresh.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 3.1B  master_badges new columns
-- -----------------------------------------------------------------------------
alter table public.master_badges add column if not exists progress_target int not null default 1;
alter table public.master_badges add column if not exists display_order   int not null default 0;

-- -----------------------------------------------------------------------------
-- 3.1C  user_badges new columns
-- -----------------------------------------------------------------------------
alter table public.user_badges add column if not exists last_progress_seen        int not null default 0;
alter table public.user_badges add column if not exists near_miss_acknowledged_at timestamptz;

-- -----------------------------------------------------------------------------
-- 3.1A  Seed master_badges (22 rows). Idempotent via ON CONFLICT (code).
-- -----------------------------------------------------------------------------
insert into public.master_badges (code, name, description, category, rarity, icon_slug, is_secret, criteria_json, bonus_xp, progress_target, display_order)
values
  -- KNOWLEDGE (6)
  ('equity_apprentice',   'Equity Apprentice',  'Complete your very first finance module — Module 1.',                     'knowledge', 'common',    'graduation-cap', false, '{"type":"module_complete","module_order":1}'::jsonb,         0,  1, 10),
  ('sql_wizard',          'SQL Wizard',         'Crush Module 6 — SQL & data wrangling for analysts.',                    'knowledge', 'rare',      'database',       false, '{"type":"module_complete","module_order":6}'::jsonb,         0,  1, 11),
  ('ratio_monk',          'Ratio Monk',         'Master Module 9 — financial ratios decoded.',                            'knowledge', 'rare',      'calculator',     false, '{"type":"module_complete","module_order":9}'::jsonb,         0,  1, 12),
  ('module_master',       'Module Master',      'Finish any module end-to-end. The journey starts here.',                  'knowledge', 'rare',      'book-open',      false, '{"type":"any_module_complete","count":1}'::jsonb,            0,  1, 13),
  ('quiz_perfectionist',  'Quiz Perfectionist', 'Score 100% on any quiz. No partial credit, just precision.',              'knowledge', 'rare',      'check-circle-2', false, '{"type":"quiz_score","gte":100}'::jsonb,                     0,  1, 14),
  ('capstone_champion',   'Capstone Champion',  'Ship the full capstone project. The crown of the program.',               'knowledge', 'legendary', 'trophy',         false, '{"type":"capstone_complete"}'::jsonb,                       50,  1, 15),

  -- SPEED (3)
  ('sprint_quiz',         'Sprint Quiz',        'Finish a quiz in under 3 minutes — without rushing your accuracy.',       'speed',     'common',    'zap',            false, '{"type":"quiz_complete_time","lte_seconds":180}'::jsonb,     0,  1, 20),
  ('speed_analyst',       'Speed Analyst',      'Complete a full session (all 4 phases) in under 8 minutes.',              'speed',     'rare',      'rocket',         false, '{"type":"session_complete_time","lte_seconds":480}'::jsonb,  0,  1, 21),
  ('marathon_session',    'Marathon Session',   'Stay locked in for an hour-plus on a single session.',                    'speed',     'rare',      'timer',          false, '{"type":"session_complete_time","gte_seconds":3600}'::jsonb, 0,  1, 22),

  -- CONSISTENCY (9)
  ('first_blood',         'First Blood',        'Submit your first quiz. The first one is always the hardest.',           'consistency','common',   'sparkles',       false, '{"type":"first_event","reason":"quiz_correct"}'::jsonb,      0,  1, 30),
  ('goal_setter',         'Goal Setter',        'Commit to a daily learning goal — even 5 minutes counts.',                'consistency','common',   'flag',           false, '{"type":"daily_goal_set"}'::jsonb,                           0,  1, 31),
  ('streak_saver',        'Streak Saver',       'Use a streak freeze to keep the run alive.',                              'consistency','common',   'snowflake',      false, '{"type":"freeze_consumed","gte":1}'::jsonb,                  0,  1, 32),
  ('fire_starter',        'Fire Starter',       'Three days in a row. The habit is taking root.',                          'consistency','common',   'flame',          false, '{"type":"streak_days","gte":3}'::jsonb,                      0,  3, 33),
  ('five_day_grinder',    '5-Day Grinder',      'Five consecutive days. Discipline is building.',                          'consistency','rare',     'mountain',       false, '{"type":"streak_days","gte":5}'::jsonb,                      0,  5, 34),
  ('gold_flame',          'Gold Flame',         'Seven days unbroken — a full week of focused work.',                      'consistency','rare',     'flame',          false, '{"type":"streak_days","gte":7}'::jsonb,                      0,  7, 35),
  ('iron_discipline',     'Iron Discipline',    '30 consecutive days. Compounding is real and it lives here.',             'consistency','legendary','shield-check',   false, '{"type":"streak_days","gte":30}'::jsonb,                    50, 30, 36),
  ('sim_specialist',      'Simulation Specialist','Complete 10 simulations — applied skill, not just theory.',             'consistency','rare',     'beaker',         false, '{"type":"event_count","reason":"simulation_complete","gte":10}'::jsonb, 0, 10, 37),
  ('daily_champion',      'Daily Champion',     'Top of the dailies. Earned by the most XP gained in a single day.',       'consistency','rare',     'crown',          false, '{"type":"daily_champion"}'::jsonb,                           0,  1, 38),

  -- SOCIAL (2)
  ('profile_complete',    'Profile Complete',   'Set your name, avatar, and daily goal. We know who you are.',             'social',    'common',    'user-check',     false, '{"type":"profile_complete"}'::jsonb,                         0,  1, 50),
  ('pioneer',             'Pioneer',            'You joined Valuevade in the first month. Early adopter energy.',          'social',    'rare',      'compass',        false, '{"type":"signed_up_before","date":"2026-07-01"}'::jsonb,     0,  1, 51),

  -- SECRET (3)
  ('night_owl',           'Night Owl',          'Hidden achievement.',                                                     'secret',    'rare',      'moon',           true,  '{"type":"session_completed_hour_ist","in":[0,1,2,3]}'::jsonb,0,  1, 90),
  ('weekend_warrior',     'Weekend Warrior',    'Hidden achievement.',                                                     'secret',    'rare',      'sun',            true,  '{"type":"weekend_sessions_same_week"}'::jsonb,               0,  1, 91),
  ('comeback_kid',        'Comeback Kid',       'Hidden achievement.',                                                     'secret',    'epic',      'heart-pulse',    true,  '{"type":"streak_broken_then_recovered","times_gte":3}'::jsonb, 0, 3, 92)

on conflict (code) do update
  set name           = excluded.name,
      description    = excluded.description,
      category       = excluded.category,
      rarity         = excluded.rarity,
      icon_slug      = excluded.icon_slug,
      is_secret      = excluded.is_secret,
      criteria_json  = excluded.criteria_json,
      bonus_xp       = excluded.bonus_xp,
      progress_target= excluded.progress_target,
      display_order  = excluded.display_order;

-- -----------------------------------------------------------------------------
-- 3.1D  evaluate_badges(p_user_id, p_context)
--
-- Iterates 22 master_badges criteria; awards new unlocks; fires bonus_xp via
-- the existing award_xp RPC (reason=badge_unlock_bonus); updates progress for
-- progressable badges; surfaces near-miss transitions (crossed 60%).
--
-- Context object passed by the caller (mostly the frontend):
--   {
--     session_id:                  uuid,
--     quiz_score:                  int (0-100),
--     quiz_duration_seconds:       int,
--     session_duration_seconds:    int,
--     session_completed_at_ist:    text (ISO timestamp, IST tz),
--     hour_ist:                    int 0-23,
--     source_event:                text
--   }
-- All keys optional. Missing keys just mean those badges can't be evaluated
-- on this call (they'll be evaluated next time the right context flows in).
--
-- Returns: jsonb { newly_unlocked: [...], near_miss: [...] }
-- -----------------------------------------------------------------------------
create or replace function public.evaluate_badges(p_user_id uuid, p_context jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller         uuid := auth.uid();
  v_badge          record;
  v_user_badge     record;
  v_met            boolean;
  v_progress       int;
  v_target         int;
  v_was_unlocked   boolean;
  v_new_unlocks    jsonb := '[]'::jsonb;
  v_near_miss      jsonb := '[]'::jsonb;
  v_module_count   int;
  v_event_count    int;
  v_freeze_count   int;
  v_broken_count   int;
  v_profile_row    record;
  v_stats_row      public.user_stats%rowtype;
  v_quiz_score     int;
  v_quiz_secs      int;
  v_sess_secs      int;
  v_hour_ist       int;
  v_session_ts     timestamptz;
  v_sat_exists     boolean;
  v_sun_exists     boolean;
  v_today          date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'evaluate_badges: cannot evaluate for another user'
      using errcode = '42501';
  end if;

  -- Pull commonly-needed user state once.
  select * into v_stats_row from public.user_stats where user_id = p_user_id limit 1;
  select id, full_name, avatar_url, created_at into v_profile_row
    from public.profiles where id = p_user_id limit 1;

  v_quiz_score := nullif(p_context->>'quiz_score', '')::int;
  v_quiz_secs  := nullif(p_context->>'quiz_duration_seconds', '')::int;
  v_sess_secs  := nullif(p_context->>'session_duration_seconds', '')::int;
  v_hour_ist   := nullif(p_context->>'hour_ist', '')::int;
  v_session_ts := nullif(p_context->>'session_completed_at_ist', '')::timestamptz;

  for v_badge in
    select * from public.master_badges order by display_order
  loop
    -- Ensure user_badges row exists
    insert into public.user_badges
      (user_id, badge_id, progress_target, is_unlocked, progress_current)
    values
      (p_user_id, v_badge.id, v_badge.progress_target, false, 0)
    on conflict (user_id, badge_id) do nothing;

    select * into v_user_badge
      from public.user_badges
     where user_id = p_user_id and badge_id = v_badge.id;
    v_was_unlocked := v_user_badge.is_unlocked;
    if v_was_unlocked then
      continue;
    end if;

    v_met      := false;
    v_progress := coalesce(v_user_badge.progress_current, 0);
    v_target   := greatest(1, v_badge.progress_target);

    case v_badge.criteria_json->>'type'
      when 'module_complete' then
        -- user_modules is keyed by enrollment_id (not user_id directly); join via user_enrollments
        v_met := exists (
          select 1
            from public.user_modules um
            join public.user_enrollments ue on ue.id = um.enrollment_id
            join public.master_modules mm on mm.id = um.master_module_id
           where ue.user_id = p_user_id
             and mm.order_index = (v_badge.criteria_json->>'module_order')::int
             and um.is_completed = true
        );
        v_progress := case when v_met then 1 else 0 end;

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
        -- Use longest_streak so the badge is monotonic — once earned, can't be lost.
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

      when 'session_completed_hour_ist' then
        if v_hour_ist is not null then
          v_met := v_hour_ist = any (
            select jsonb_array_elements_text(v_badge.criteria_json->'in')::int
          );
        end if;
        v_progress := case when v_met then 1 else v_progress end;

      when 'weekend_sessions_same_week' then
        -- Check if user has at least one session_complete event on a Sat AND
        -- a Sun within the most recent ISO week.
        select exists (
          select 1 from public.user_xp_events
           where user_id = p_user_id and reason = 'session_complete'
             and extract(isodow from (created_at at time zone 'Asia/Kolkata')) = 6
             and (created_at at time zone 'Asia/Kolkata')::date >= v_today - 7
        ) into v_sat_exists;
        select exists (
          select 1 from public.user_xp_events
           where user_id = p_user_id and reason = 'session_complete'
             and extract(isodow from (created_at at time zone 'Asia/Kolkata')) = 7
             and (created_at at time zone 'Asia/Kolkata')::date >= v_today - 7
        ) into v_sun_exists;
        v_met := v_sat_exists and v_sun_exists;
        v_progress := case when v_met then 1 else 0 end;

      when 'streak_broken_then_recovered' then
        select count(*)::int into v_broken_count
          from public.user_streak_events
         where user_id = p_user_id and event_type = 'broken';
        v_progress := least(v_broken_count, v_target);
        v_met := v_broken_count >= coalesce((v_badge.criteria_json->>'times_gte')::int, 3);

      when 'daily_champion' then
        -- P4 will populate; for now badge is unlockable only via dev_force_unlock_badge.
        v_met := false;
        v_progress := 0;

      else
        -- Unknown criteria type — skip.
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
          jsonb_build_object('badge_code', v_badge.code, 'minutes', 0)
        );
      end if;
    else
      -- Update progress + detect near-miss (newly crossed 60%)
      if v_progress <> coalesce(v_user_badge.progress_current, 0) then
        update public.user_badges
           set progress_current = v_progress
         where user_id = p_user_id and badge_id = v_badge.id;
      end if;

      if v_progress >= ceil(v_target * 0.6)
         and coalesce(v_user_badge.last_progress_seen, 0) < ceil(v_target * 0.6)
         and not v_badge.is_secret then
        v_near_miss := v_near_miss || jsonb_build_object(
          'code', v_badge.code,
          'name', v_badge.name,
          'icon_slug', v_badge.icon_slug,
          'progress_current', v_progress,
          'progress_target', v_target
        );
      end if;

      if v_progress > coalesce(v_user_badge.last_progress_seen, 0) then
        update public.user_badges
           set last_progress_seen = v_progress
         where user_id = p_user_id and badge_id = v_badge.id;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'newly_unlocked', v_new_unlocks,
    'near_miss', v_near_miss
  );
end;
$$;

revoke all on function public.evaluate_badges(uuid, jsonb) from public;
grant  execute on function public.evaluate_badges(uuid, jsonb) to authenticated;
grant  execute on function public.evaluate_badges(uuid, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- dev_force_unlock_badge(p_user_id, p_badge_code) — gated dev RPC
-- -----------------------------------------------------------------------------
create or replace function public.dev_force_unlock_badge(p_user_id uuid, p_badge_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed text;
  v_badge   public.master_badges%rowtype;
begin
  select value into v_allowed from public.app_settings where key = 'allow_dev_rpcs' limit 1;
  if coalesce(v_allowed, 'false') <> 'true' then
    raise exception 'dev_force_unlock_badge disabled (set app_settings.allow_dev_rpcs=true)'
      using errcode = '42501';
  end if;

  select * into v_badge from public.master_badges where code = p_badge_code limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'badge_not_found', 'code', p_badge_code);
  end if;

  insert into public.user_badges
    (user_id, badge_id, progress_target, is_unlocked, progress_current, earned_at)
  values
    (p_user_id, v_badge.id, v_badge.progress_target, true, v_badge.progress_target, now())
  on conflict (user_id, badge_id) do update
    set is_unlocked      = true,
        earned_at        = coalesce(public.user_badges.earned_at, now()),
        progress_current = excluded.progress_target,
        last_progress_seen = excluded.progress_target;

  if v_badge.bonus_xp > 0 then
    perform public.award_xp(
      p_user_id, v_badge.bonus_xp, 'badge_unlock_bonus', v_badge.id,
      jsonb_build_object('badge_code', v_badge.code, 'minutes', 0, 'forced', true)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'badge', jsonb_build_object(
      'code', v_badge.code,
      'name', v_badge.name,
      'rarity', v_badge.rarity,
      'icon_slug', v_badge.icon_slug,
      'is_secret', v_badge.is_secret,
      'bonus_xp', v_badge.bonus_xp
    )
  );
end;
$$;

revoke all on function public.dev_force_unlock_badge(uuid, text) from public;
grant  execute on function public.dev_force_unlock_badge(uuid, text) to authenticated;
grant  execute on function public.dev_force_unlock_badge(uuid, text) to service_role;

commit;
