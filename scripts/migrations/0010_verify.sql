do $$
declare
  v_findings text[] := '{}'::text[];
  v_confdeltype "char";
  v_defn text;
  v_nullable bool;
begin
  select c.confdeltype, pg_get_constraintdef(c.oid)
    into v_confdeltype, v_defn
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname='public' and t.relname='user_stats'
     and c.conname='user_stats_enrollment_id_fkey';
  if v_confdeltype is null then
    v_findings := array_append(v_findings, 'user_stats_enrollment_id_fkey FK is missing');
  elsif v_confdeltype <> 'n' then
    v_findings := array_append(v_findings,
      format('FK confdeltype expected n (SET NULL), got %s. defn=%s', v_confdeltype, v_defn));
  end if;

  select not a.attnotnull into v_nullable
    from pg_attribute a
    join pg_class t on t.oid = a.attrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname='public' and t.relname='user_stats' and a.attname='enrollment_id';
  if not v_nullable then
    v_findings := array_append(v_findings, 'user_stats.enrollment_id must be nullable for SET NULL to work');
  end if;

  if array_length(v_findings,1) is null then
    raise notice 'ALL CHECKS PASSED — user_stats.enrollment_id FK is ON DELETE SET NULL, column is nullable';
  else
    raise notice 'FINDINGS: %', array_to_string(v_findings, E'\n  - ');
  end if;
end$$;

select c.conname, pg_get_constraintdef(c.oid) as defn, c.confdeltype
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
 where n.nspname='public' and t.relname='user_stats'
   and c.conname='user_stats_enrollment_id_fkey';
