with my_sessions as (
  select us.id                as user_session_id,
         us.master_session_id,
         us.order_index,
         us.quiz_completed,
         us.is_completed      as session_completed,
         us.quiz_score,
         us.title
    from public.user_sessions us
    join public.user_modules um on um.id = us.user_module_id
    join public.user_enrollments e on e.id = um.enrollment_id
   where e.user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid
     and us.is_removed = false
)
select user_session_id, master_session_id, order_index, quiz_completed,
       session_completed, title
  from my_sessions
 order by quiz_completed asc, order_index asc
 limit 10;
