-- =============================================================================
-- Migration 0013 — User Portfolio (Phase 53)
-- =============================================================================
--
-- Adds:
--   • master_modules.skill_tags text[]            (idempotent, seeded for 15 modules)
--   • profiles.portfolio_public bool default false
--   • profiles.portfolio_share_slug text unique
--   • VIEW v_user_portfolio (security_invoker=true)
--
-- Idempotent; safe to re-run.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A. master_modules.skill_tags + seed 15 modules
-- ---------------------------------------------------------------------------
alter table public.master_modules
  add column if not exists skill_tags text[] not null default '{}'::text[];

-- Idempotent seed — only sets tags when the existing column is empty so we
-- don't clobber any future edits made via the admin UI.
update public.master_modules m
   set skill_tags = v.tags
  from (values
    (1,  array['Finance Foundations','Accounting Basics','Economics','Time Value of Money']),
    (2,  array['Capital Markets','IPO Mechanics','Indian Market Structure','SEBI Regulation']),
    (3,  array['Excel for Finance','Spreadsheet Modelling','Keyboard Shortcuts','VLOOKUP & PivotTables']),
    (4,  array['3-Statement Modelling','Financial Modelling','Forecasting','Modeling Best Practices']),
    (5,  array['Corporate Governance','Management Quality','Ind AS Disclosures','Promoter Analysis']),
    (6,  array['Annual Report Reading','Concall Analysis','MDA Decoding','Footnote Forensics']),
    (7,  array['Financial Statement Analysis','Income Statement','Balance Sheet','Cash Flow Statement']),
    (8,  array['Forensic Accounting','Red Flag Detection','Earnings Quality','Accrual Analysis']),
    (9,  array['Ratio Analysis','DuPont Framework','Leverage & Liquidity','Working Capital Cycle']),
    (10, array['Macroeconomics','GDP & Inflation','Monetary Policy','Yield Curves']),
    (11, array['Sector Analysis','Porter Five Forces','Industry Lifecycle','Competitive Moats']),
    (12, array['Equity Valuation','DCF','Relative Valuation','Multiples Analysis']),
    (13, array['Investment Memos','PowerPoint','Report Writing','Pitch Decks']),
    (14, array['Resume Building','LinkedIn Strategy','Finance Networking','Interview Prep']),
    (15, array['AI for Finance','Prompt Engineering','ChatGPT for Analysts','LLM Workflows'])
  ) as v(order_index, tags)
 where m.order_index = v.order_index
   and (m.skill_tags is null or array_length(m.skill_tags,1) is null);

-- ---------------------------------------------------------------------------
-- B. profiles: public-share opt-in
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists portfolio_public bool not null default false;

alter table public.profiles
  add column if not exists portfolio_share_slug text;

-- Unique only when set; partial unique index avoids the null-clash problem.
create unique index if not exists ux_profiles_portfolio_share_slug
  on public.profiles(portfolio_share_slug)
  where portfolio_share_slug is not null;

-- RLS policy so the OWNER can flip the toggle / slug; service-role bypasses.
drop policy if exists profiles_update_own_portfolio on public.profiles;
create policy profiles_update_own_portfolio on public.profiles
  for update using (auth.uid() = id);

-- Public read of the slug + opt-in flag for /p/<slug> resolution.
-- This is a NARROW select policy that only exposes columns useful for the
-- public portfolio view; full profile reads still require auth.uid() = id
-- via the existing profiles_select_own policy.
drop policy if exists profiles_public_portfolio_slug on public.profiles;
create policy profiles_public_portfolio_slug on public.profiles
  for select to anon
  using (portfolio_public = true and portfolio_share_slug is not null);

-- ---------------------------------------------------------------------------
-- C. VIEW v_user_portfolio  (security_invoker=true → inherits caller RLS)
-- ---------------------------------------------------------------------------
drop view if exists public.v_user_portfolio;

create view public.v_user_portfolio
with (security_invoker = true) as
with
-- Per-user enrollment scope (the user's active or latest enrollment).
ue as (
  select distinct on (user_id)
         id as enrollment_id, user_id, master_path_id, status, enrolled_at, completed_at
    from public.user_enrollments
   order by user_id, (case when status='active' then 0 else 1 end), enrolled_at desc nulls last
),
-- Module rollup — completed vs in-progress + XP + time.
mods as (
  select
    user_id,
    count(*) filter (where is_completed)                                  as modules_completed,
    count(*) filter (where not is_completed and (sessions_completed_n > 0
                       or completion_percent > 0))                        as modules_in_progress,
    count(*)                                                              as modules_enrolled,
    coalesce(sum(xp_earned_in_module), 0)                                 as total_xp_in_modules,
    coalesce(sum(time_spent_minutes), 0)                                  as total_time_minutes
  from public.v_module_progress_summary
  group by user_id
),
-- Sessions: counts + avg scores from user_sessions joined via user_modules.
-- Scores are stored as jsonb; rows are either a plain number or an object
-- like {"score": 80}, so we extract via a case+jsonb_typeof guard.
sess as (
  select
    um.enrollment_id,
    ue.user_id,
    count(*) filter (where us.is_completed)                               as sessions_completed,
    count(*)                                                              as sessions_total,
    avg(case
          when jsonb_typeof(us.quiz_score) = 'number'
            then us.quiz_score::text::numeric
          when jsonb_typeof(us.quiz_score) = 'object' and us.quiz_score ? 'score'
            then (us.quiz_score->>'score')::numeric
          else null end)                                                  as avg_quiz_score,
    avg(case
          when jsonb_typeof(us.interview_score) = 'number'
            then us.interview_score::text::numeric
          when jsonb_typeof(us.interview_score) = 'object' and us.interview_score ? 'score'
            then (us.interview_score->>'score')::numeric
          else null end)                                                  as avg_interview_score,
    avg(case
          when jsonb_typeof(us.simulation_score) = 'number'
            then us.simulation_score::text::numeric
          when jsonb_typeof(us.simulation_score) = 'object' and us.simulation_score ? 'score'
            then (us.simulation_score->>'score')::numeric
          else null end)                                                  as avg_simulation_score
  from public.user_sessions us
  join public.user_modules um on um.id = us.user_module_id
  join ue on ue.enrollment_id = um.enrollment_id
  group by um.enrollment_id, ue.user_id
),
-- Module projects completed.
mod_projs as (
  select
    ue.user_id,
    count(*) filter (where ump.is_completed)                              as module_projects_completed,
    max(ump.completed_at)                                                 as last_module_project_at
  from public.user_module_projects ump
  join public.user_modules um on um.id = ump.user_module_id
  join ue on ue.enrollment_id = um.enrollment_id
  group by ue.user_id
),
-- Capstone status.
cap as (
  select
    ue.user_id,
    bool_or(coalesce(c.is_completed, false))                              as capstone_completed,
    max(c.completed_at)                                                   as capstone_completed_at,
    max(c.started_at)                                                     as capstone_started_at
  from public.user_capstone_projects c
  join ue on ue.enrollment_id = c.enrollment_id
  group by ue.user_id
),
-- Badge rollup by rarity + recent unlocks (top 5 by earned_at desc).
badges_rollup as (
  select
    ub.user_id,
    count(*) filter (where ub.is_unlocked)                                as badges_total,
    count(*) filter (where ub.is_unlocked and mb.rarity='common')         as badges_common,
    count(*) filter (where ub.is_unlocked and mb.rarity='rare')           as badges_rare,
    count(*) filter (where ub.is_unlocked and mb.rarity='epic')           as badges_epic,
    count(*) filter (where ub.is_unlocked and mb.rarity='legendary')      as badges_legendary
  from public.user_badges ub
  join public.master_badges mb on mb.id = ub.badge_id
  group by ub.user_id
),
recent_badges as (
  select
    ub.user_id,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'code', mb.code, 'name', mb.name, 'rarity', mb.rarity,
        'category', mb.category, 'icon_slug', mb.icon_slug,
        'earned_at', ub.earned_at
      ) order by ub.earned_at desc
    ) filter (where ub.is_unlocked), '[]'::jsonb)                         as recent_unlocks
  from public.user_badges ub
  join public.master_badges mb on mb.id = ub.badge_id
  group by ub.user_id
),
-- Daily Champion: distinct days where the user completed at least 3 picks.
champ as (
  select user_id, count(*) as daily_champion_days
    from (
      select user_id, challenge_date
        from public.user_daily_challenges
       where is_completed = true
       group by user_id, challenge_date
      having count(*) >= 3
    ) c
   group by user_id
),
-- Active days in last 90.
activity as (
  select
    user_id,
    count(*) filter (where xp_earned > 0)                                 as active_days_90,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'date_ist', activity_date,
        'xp_earned', xp_earned,
        'sessions_completed', sessions_completed,
        'minutes_spent', minutes_spent
      ) order by activity_date desc
    ) filter (where activity_date >= ((now() at time zone 'Asia/Kolkata')::date - interval '90 days')),
    '[]'::jsonb)                                                          as heatmap_90
  from public.user_daily_activity
  group by user_id
),
-- Skill tags rolled up from completed modules.
skills as (
  select
    vmps.user_id,
    coalesce(array_agg(distinct tag), '{}'::text[])                       as skills_earned
  from public.v_module_progress_summary vmps
  join public.master_modules mm on mm.id = vmps.master_module_id
  cross join lateral unnest(coalesce(mm.skill_tags, '{}'::text[])) as t(tag)
  where vmps.is_completed = true
  group by vmps.user_id
),
-- Per-module compact list for the journey block.
mod_list as (
  select
    user_id,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'order_index', order_index,
        'code', module_code,
        'title', module_title,
        'is_completed', is_completed,
        'completion_percent', completion_percent,
        'sessions_total', sessions_total,
        'sessions_completed_n', sessions_completed_n,
        'xp_earned_in_module', xp_earned_in_module,
        'completed_at', completed_at
      ) order by order_index asc
    ), '[]'::jsonb)                                                       as modules
  from public.v_module_progress_summary
  group by user_id
)
select
  us.user_id,
  -- Identity
  p.full_name,
  p.email,
  p.avatar_url,
  p.created_at                            as member_since,
  coalesce(p.portfolio_public, false)     as portfolio_public,
  p.portfolio_share_slug,
  -- Level / XP
  us.total_xp,
  us.current_level,
  ml.name                                 as level_name,
  ml.icon_slug                            as level_icon_slug,
  ml.color_hex                            as level_color_hex,
  ml_next.xp_threshold                    as next_level_threshold,
  ml_next.name                            as next_level_name,
  greatest(coalesce(ml_next.xp_threshold, us.total_xp) - us.total_xp, 0) as xp_to_next,
  -- Streak
  us.current_streak_days,
  us.longest_streak_days,
  us.streak_freeze_tokens,
  -- Daily Champion
  coalesce(champ.daily_champion_days, 0)  as daily_champion_days_total,
  -- Modules
  coalesce(mods.modules_completed, 0)     as modules_completed,
  coalesce(mods.modules_in_progress, 0)   as modules_in_progress,
  coalesce(mods.modules_enrolled, 0)      as modules_enrolled,
  coalesce(mods.total_xp_in_modules, 0)   as total_xp_in_modules,
  coalesce(mods.total_time_minutes, us.total_time_minutes, 0) as total_time_minutes,
  -- Sessions
  coalesce(sess.sessions_completed, 0)    as sessions_completed,
  coalesce(sess.sessions_total, 0)        as sessions_total,
  sess.avg_quiz_score,
  sess.avg_interview_score,
  sess.avg_simulation_score,
  -- Projects
  coalesce(mod_projs.module_projects_completed, 0) as module_projects_completed,
  mod_projs.last_module_project_at,
  coalesce(cap.capstone_completed, false) as capstone_completed,
  cap.capstone_completed_at,
  cap.capstone_started_at,
  -- Badges
  coalesce(badges_rollup.badges_total, 0)      as badges_total,
  coalesce(badges_rollup.badges_common, 0)     as badges_common,
  coalesce(badges_rollup.badges_rare, 0)       as badges_rare,
  coalesce(badges_rollup.badges_epic, 0)       as badges_epic,
  coalesce(badges_rollup.badges_legendary, 0)  as badges_legendary,
  coalesce(recent_badges.recent_unlocks, '[]'::jsonb) as recent_badges,
  -- Skills & modules list (the showcase blocks)
  coalesce(skills.skills_earned, '{}'::text[])    as skills_earned,
  coalesce(mod_list.modules, '[]'::jsonb)         as modules,
  -- Activity
  coalesce(activity.active_days_90, 0)        as active_days_last_90,
  coalesce(activity.heatmap_90, '[]'::jsonb)  as heatmap_90
from public.user_stats us
left join public.profiles p              on p.id = us.user_id
left join public.master_levels ml        on ml.level_number = us.current_level
left join public.master_levels ml_next   on ml_next.level_number = us.current_level + 1
left join mods                           on mods.user_id = us.user_id
left join sess                           on sess.user_id = us.user_id
left join mod_projs                      on mod_projs.user_id = us.user_id
left join cap                            on cap.user_id = us.user_id
left join badges_rollup                  on badges_rollup.user_id = us.user_id
left join recent_badges                  on recent_badges.user_id = us.user_id
left join champ                          on champ.user_id = us.user_id
left join activity                       on activity.user_id = us.user_id
left join skills                         on skills.user_id = us.user_id
left join mod_list                       on mod_list.user_id = us.user_id;

comment on view public.v_user_portfolio is
  'Phase 53 — per-user aggregated portfolio. security_invoker=true → inherits caller RLS, so calling as authenticated user yields only that user''s row. Service-role bypasses RLS and can fetch by user_id.';

commit;
