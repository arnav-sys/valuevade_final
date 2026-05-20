-- =============================================================================
-- Verification SQL for Migration 0002 — Streak Engine
--
-- All checks return rows ONLY when something is wrong. A fully successful
-- migration emits a single "ALL CHECKS PASSED" row at the end.
-- =============================================================================

with
-- 1) user_streak_events table exists
missing_tables as (
  select 'MISSING TABLE: user_streak_events' as finding
   where not exists (
     select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'user_streak_events'
   )
),

-- 2) New user_stats columns exist
expected_cols(name) as (values
  ('auto_spend_freeze'),
  ('daily_goal_modal_dismissed'),
  ('last_streak_break_at'),
  ('last_streak_break_lost_days')
),
missing_cols as (
  select 'MISSING COLUMN user_stats.' || ec.name as finding
    from expected_cols ec
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_stats'
        and column_name = ec.name
   )
),

-- 3) RPCs exist with right signatures
expected_rpcs(fn_name, args) as (values
  ('update_streak_on_activity',    'p_user_id uuid'),
  ('consume_streak_freeze',        'p_user_id uuid'),
  ('backfill_streak_from_history', 'p_user_id uuid'),
  ('dev_simulate_streak_day',      'p_user_id uuid, p_days_back integer'),
  ('award_xp',                     'p_user_id uuid, p_amount integer, p_reason text, p_source_id uuid, p_meta jsonb')
),
missing_rpcs as (
  select 'MISSING RPC public.' || er.fn_name || '(' || er.args || ')' as finding
    from expected_rpcs er
   where not exists (
     select 1
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname  = er.fn_name
        and pg_get_function_identity_arguments(p.oid) = er.args
   )
),

-- 4) Each new RPC is callable by `authenticated`
rpc_grants as (
  select 'RPC ' || er.fn_name || ' NOT EXECUTABLE BY authenticated' as finding
    from expected_rpcs er
   where er.fn_name in ('update_streak_on_activity','consume_streak_freeze','backfill_streak_from_history','dev_simulate_streak_day')
     and not exists (
       select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         join information_schema.role_routine_grants g
           on g.routine_schema = n.nspname and g.routine_name = p.proname
          and g.grantee = 'authenticated' and g.privilege_type = 'EXECUTE'
        where n.nspname = 'public' and p.proname = er.fn_name
     )
),

-- 5) RLS enabled on user_streak_events
rls_findings as (
  select 'RLS NOT ENABLED ON: user_streak_events' as finding
   where not exists (
     select 1 from pg_class c
      where c.relname = 'user_streak_events'
        and c.relnamespace = 'public'::regnamespace
        and c.relrowsecurity = true
   )
),

-- 6) Dev RPC flag is set in app_settings table
guc_check as (
  select 'app_settings.allow_dev_rpcs is not "true"' as finding
   where not exists (
     select 1 from public.app_settings
      where key = 'allow_dev_rpcs' and value = 'true'
   )
),

all_findings as (
  select finding from missing_tables  union all
  select finding from missing_cols    union all
  select finding from missing_rpcs    union all
  select finding from rpc_grants      union all
  select finding from rls_findings    union all
  select finding from guc_check
)
select case
         when count(*) = 0 then 'ALL CHECKS PASSED'
         else 'FAIL: ' || count(*) || ' issue(s)'
       end as overall_status,
       array_agg(finding) filter (where finding is not null) as findings
  from all_findings;
