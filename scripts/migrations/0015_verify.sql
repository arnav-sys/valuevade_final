-- 0015_verify.sql — Phase 57 review notes view
do $$
declare
  v_view_exists bool;
  v_row_count int;
begin
  select exists(
    select 1 from pg_views
     where schemaname = 'public' and viewname = 'v_user_review_notes'
  ) into v_view_exists;
  if not v_view_exists then
    raise notice 'FAIL: v_user_review_notes view missing';
    return;
  end if;
  select count(*) into v_row_count from public.v_user_review_notes;
  raise notice 'ALL CHECKS PASSED — v_user_review_notes ready (% total rows across all users)', v_row_count;
end$$;

-- Show a few sample rows (service-role bypass) to confirm joins resolve.
select user_id, phase, module_code, topic,
       coalesce(left(user_question, 60), '(no paired question)') as user_q_preview,
       left(pari_answer, 60) as pari_preview,
       created_at
  from public.v_user_review_notes
 order by created_at desc
 limit 5;
