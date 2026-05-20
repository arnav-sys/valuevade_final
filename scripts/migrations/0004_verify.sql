-- Verification for migration 0004 — badges engine.
with
expected_columns(table_name, col) as (values
  ('master_badges', 'progress_target'),
  ('master_badges', 'display_order'),
  ('user_badges',   'last_progress_seen'),
  ('user_badges',   'near_miss_acknowledged_at')
),
missing_cols as (
  select 'MISSING COLUMN ' || ec.table_name || '.' || ec.col as finding
    from expected_columns ec
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = ec.table_name and column_name = ec.col
   )
),

expected_rpcs(fn_name, args) as (values
  ('evaluate_badges',          'p_user_id uuid, p_context jsonb'),
  ('dev_force_unlock_badge',   'p_user_id uuid, p_badge_code text')
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

badge_count as (
  select 'EXPECTED 23 BADGES, GOT ' || count(*)::text as finding
    from public.master_badges
   having count(*) <> 23
),

rpc_grants as (
  select 'RPC ' || er.fn_name || ' NOT EXECUTABLE BY authenticated' as finding
    from expected_rpcs er
   where not exists (
     select 1
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       join information_schema.role_routine_grants g
         on g.routine_schema = n.nspname and g.routine_name = p.proname
        and g.grantee = 'authenticated' and g.privilege_type = 'EXECUTE'
      where n.nspname = 'public' and p.proname = er.fn_name
   )
),

rls_check as (
  select 'RLS NOT ENABLED ON: ' || t.relname as finding
    from pg_class t
   where t.relname in ('master_badges', 'user_badges')
     and t.relnamespace = 'public'::regnamespace
     and t.relrowsecurity = false
),

all_findings as (
  select finding from missing_cols   union all
  select finding from missing_rpcs   union all
  select finding from badge_count    union all
  select finding from rpc_grants     union all
  select finding from rls_check
)
select case
         when count(*) = 0 then 'ALL CHECKS PASSED'
         else 'FAIL: ' || count(*) || ' issue(s)'
       end as overall_status,
       array_agg(finding) filter (where finding is not null) as findings
  from all_findings;
