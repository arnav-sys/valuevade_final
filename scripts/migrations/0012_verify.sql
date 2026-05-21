do $$
declare
  v_findings text[] := '{}'::text[];
  v_tables_ok bool;
  v_rpcs_ok int;
  v_rls_ok int;
begin
  -- 3 tables exist
  v_tables_ok := (
    exists(select 1 from information_schema.tables where table_schema='public' and table_name='user_doubt_sessions')
    and exists(select 1 from information_schema.tables where table_schema='public' and table_name='doubt_messages')
    and exists(select 1 from information_schema.tables where table_schema='public' and table_name='doubt_qa_cache')
  );
  if not v_tables_ok then v_findings := array_append(v_findings, 'one or more doubt tables missing'); end if;

  -- 4 RPCs exist
  select count(*) into v_rpcs_ok from pg_proc where proname in (
    'start_doubt_session','end_doubt_session','record_doubt_turn','dev_reset_daily_doubts'
  );
  if v_rpcs_ok < 4 then
    v_findings := array_append(v_findings, format('expected 4 doubt RPCs, found %s', v_rpcs_ok));
  end if;

  -- RLS enabled on 3 tables
  select count(*) into v_rls_ok
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname='public' and c.relname in ('user_doubt_sessions','doubt_messages','doubt_qa_cache')
     and c.relrowsecurity = true;
  if v_rls_ok < 3 then
    v_findings := array_append(v_findings, format('RLS not enabled on all 3 tables (got %s)', v_rls_ok));
  end if;

  if array_length(v_findings,1) is null then
    raise notice 'ALL CHECKS PASSED — doubts schema ready';
  else
    raise notice 'FINDINGS: %', array_to_string(v_findings, E'\n  - ');
  end if;
end$$;

select 'rpcs' as scope, proname, pg_get_function_identity_arguments(oid) as args
  from pg_proc where proname in (
    'start_doubt_session','end_doubt_session','record_doubt_turn','dev_reset_daily_doubts'
  ) order by proname;
