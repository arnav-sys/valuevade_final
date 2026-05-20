do $$
declare
  v_findings text[] := '{}'::text[];
  v_master_count int;
  v_realtime bool;
  v_evaluate_exists bool;
  v_pick_exists bool;
  v_update_exists bool;
  v_dev_force_exists bool;
  v_dev_reset_exists bool;
  v_dc_criteria jsonb;
begin
  -- A. 15 templates seeded
  select count(*) into v_master_count from public.master_daily_challenges;
  if v_master_count <> 15 then
    v_findings := array_append(v_findings, format('expected 15 master_daily_challenges, got %s', v_master_count));
  end if;

  -- D. Realtime publication includes user_daily_challenges
  select exists(
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'user_daily_challenges'
  ) into v_realtime;
  if not v_realtime then
    v_findings := array_append(v_findings, 'user_daily_challenges NOT in supabase_realtime publication');
  end if;

  -- B/C/E/F. RPCs exist
  select exists(select 1 from pg_proc where proname='pick_daily_challenges' and pronargs=1) into v_pick_exists;
  if not v_pick_exists then v_findings := array_append(v_findings, 'pick_daily_challenges(uuid) missing'); end if;

  select exists(select 1 from pg_proc where proname='update_daily_challenge_progress' and pronargs=4) into v_update_exists;
  if not v_update_exists then v_findings := array_append(v_findings, 'update_daily_challenge_progress(uuid,text,int,jsonb) missing'); end if;

  select exists(select 1 from pg_proc where proname='evaluate_badges' and pronargs=2) into v_evaluate_exists;
  if not v_evaluate_exists then v_findings := array_append(v_findings, 'evaluate_badges(uuid,jsonb) missing'); end if;

  select exists(select 1 from pg_proc where proname='dev_force_complete_daily_challenge' and pronargs=2) into v_dev_force_exists;
  if not v_dev_force_exists then v_findings := array_append(v_findings, 'dev_force_complete_daily_challenge(uuid,text) missing'); end if;

  select exists(select 1 from pg_proc where proname='dev_reset_daily_challenges' and pronargs=1) into v_dev_reset_exists;
  if not v_dev_reset_exists then v_findings := array_append(v_findings, 'dev_reset_daily_challenges(uuid) missing'); end if;

  -- E. daily_champion criteria_json correctly set
  select criteria_json into v_dc_criteria from public.master_badges where code='daily_champion';
  if v_dc_criteria is null or v_dc_criteria->>'gte' is null then
    v_findings := array_append(v_findings, format('daily_champion criteria missing gte: %s', v_dc_criteria::text));
  end if;

  if array_length(v_findings, 1) is null then
    raise notice 'ALL CHECKS PASSED';
  else
    raise notice 'FINDINGS: %', array_to_string(v_findings, E'\n  - ');
  end if;
end$$;

select 'master_dc' as scope, count(*) as n, jsonb_agg(code order by code) as codes
  from public.master_daily_challenges;
