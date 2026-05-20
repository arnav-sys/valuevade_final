-- =============================================================================
-- Verification SQL for Migration 0001 — Gamification Foundation
--
-- Run this against the Supabase project (e.g. via the SQL Editor or after
-- 0001_gamification_foundation.sql is applied via apply_migration.py).
--
-- All checks return rows ONLY when something is wrong. A fully successful
-- migration emits a single "ALL CHECKS PASSED" row at the end and nothing
-- else. Any other output is an actionable finding.
-- =============================================================================

with
-- 1) All 7 new tables exist in public
expected_tables(name) as (values
  ('master_levels'),
  ('user_xp_events'),
  ('master_badges'),
  ('user_badges'),
  ('master_daily_challenges'),
  ('user_daily_challenges'),
  ('user_daily_activity')
),
missing_tables as (
  select 'MISSING TABLE: ' || et.name as finding
    from expected_tables et
   where not exists (
     select 1 from information_schema.tables
      where table_schema = 'public' and table_name = et.name
   )
),

-- 2) All 9 new columns on user_stats exist
expected_cols(name) as (values
  ('total_xp'),
  ('current_level'),
  ('current_streak_days'),
  ('longest_streak_days'),
  ('streak_freeze_tokens'),
  ('last_streak_freeze_earned_at'),
  ('daily_goal_minutes'),
  ('last_login_at_ist'),
  ('daily_champion_glow_until')
),
missing_cols as (
  select 'MISSING COLUMN user_stats.' || ec.name as finding
    from expected_cols ec
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name   = 'user_stats'
        and column_name  = ec.name
   )
),

-- 3) master_levels has exactly 6 rows with the right thresholds
expected_levels(level_number, xp_threshold) as (values
  (1, 0),
  (2, 500),
  (3, 1500),
  (4, 3500),
  (5, 7000),
  (6, 12000)
),
level_seed_findings as (
  select 'WRONG/MISSING LEVEL: level_number=' || el.level_number
       || ' expected xp_threshold=' || el.xp_threshold as finding
    from expected_levels el
    left join public.master_levels ml on ml.level_number = el.level_number
   where ml.xp_threshold is distinct from el.xp_threshold
),

-- 4) RLS is enabled on every new table
rls_findings as (
  select 'RLS NOT ENABLED ON: ' || et.name as finding
    from expected_tables et
    join pg_class c on c.relname = et.name and c.relnamespace = 'public'::regnamespace
   where c.relrowsecurity = false
),

-- 5) award_xp(uuid,int,text,uuid,jsonb) RPC exists and is callable by `authenticated`
rpc_existence as (
  select 'MISSING RPC: public.award_xp(uuid,int,text,uuid,jsonb)' as finding
   where not exists (
     select 1
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname  = 'award_xp'
        and pg_get_function_identity_arguments(p.oid)
            = 'p_user_id uuid, p_amount integer, p_reason text, p_source_id uuid, p_meta jsonb'
   )
),
rpc_grant as (
  select 'award_xp NOT EXECUTABLE BY authenticated' as finding
   where not exists (
     select 1
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       join information_schema.role_routine_grants g
         on g.routine_schema = n.nspname
        and g.routine_name   = p.proname
        and g.grantee = 'authenticated'
        and g.privilege_type = 'EXECUTE'
      where n.nspname = 'public' and p.proname = 'award_xp'
   )
),

all_findings as (
  select finding from missing_tables       union all
  select finding from missing_cols         union all
  select finding from level_seed_findings  union all
  select finding from rls_findings         union all
  select finding from rpc_existence        union all
  select finding from rpc_grant
)
select case
         when count(*) = 0 then 'ALL CHECKS PASSED'
         else 'FAIL: ' || count(*) || ' issue(s)'
       end as overall_status,
       array_agg(finding) filter (where finding is not null) as findings
  from all_findings;
