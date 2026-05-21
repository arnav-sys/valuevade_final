-- 0013_verify.sql — Phase 53 portfolio
do $$
declare
  v_skill_modules int;
  v_total_modules int;
  v_profile_cols int;
  v_view_exists bool;
  v_findings text[] := '{}'::text[];
begin
  -- master_modules.skill_tags column exists and is populated for the standard path
  select count(*) into v_skill_modules
    from public.master_modules
   where coalesce(array_length(skill_tags,1),0) > 0;
  select count(*) into v_total_modules
    from public.master_modules
   where order_index between 1 and 15;
  if v_skill_modules < v_total_modules then
    v_findings := array_append(v_findings,
      format('skill_tags populated for only %s/%s modules', v_skill_modules, v_total_modules));
  end if;

  -- profiles columns added
  select count(*) into v_profile_cols
    from information_schema.columns
   where table_schema='public' and table_name='profiles'
     and column_name in ('portfolio_public','portfolio_share_slug');
  if v_profile_cols < 2 then
    v_findings := array_append(v_findings,
      format('profiles missing portfolio columns (got %s/2)', v_profile_cols));
  end if;

  -- view exists
  select exists(select 1 from pg_views
                 where schemaname='public' and viewname='v_user_portfolio')
    into v_view_exists;
  if not v_view_exists then
    v_findings := array_append(v_findings, 'v_user_portfolio view missing');
  end if;

  if array_length(v_findings,1) is null then
    raise notice 'ALL CHECKS PASSED — portfolio schema ready';
  else
    raise notice 'FINDINGS: %', array_to_string(v_findings, E'\n  - ');
  end if;
end$$;

-- Show seeded skill_tags for visual confirmation
select order_index, title, skill_tags
  from public.master_modules
 where order_index between 1 and 15
 order by order_index;
