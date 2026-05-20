do $$
declare
  v_findings text[] := '{}'::text[];
  v_realtime bool;
  v_view_exists bool;
begin
  select exists(
    select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='user_daily_activity'
  ) into v_realtime;
  if not v_realtime then v_findings := array_append(v_findings, 'user_daily_activity NOT in supabase_realtime publication'); end if;

  select exists(
    select 1 from information_schema.views where table_schema='public' and table_name='v_module_progress_summary'
  ) into v_view_exists;
  if not v_view_exists then v_findings := array_append(v_findings, 'v_module_progress_summary view missing'); end if;

  if array_length(v_findings,1) is null then
    raise notice 'ALL CHECKS PASSED';
  else
    raise notice 'FINDINGS: %', array_to_string(v_findings, E'\n  - ');
  end if;
end$$;

select count(*) as test_user_rows from public.v_module_progress_summary
 where user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid;

select module_code, module_title, sessions_total, sessions_completed_n, completion_percent,
       is_completed, is_unlocked, xp_earned_in_module, time_spent_minutes
  from public.v_module_progress_summary
 where user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid
 order by order_index;
