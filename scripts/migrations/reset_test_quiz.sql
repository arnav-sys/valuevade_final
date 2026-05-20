-- Reset the test user's single quiz to "never completed" so the tester can
-- exercise the fresh-quiz XP path (Bug 2 disambiguation). Also reset session
-- completion so the session-complete +50 XP intent fires.
update public.user_sessions
   set quiz_completed = false,
       quiz_score     = null,
       is_completed   = false,
       completed_at   = null
 where id = '5e0c2a88-d864-4827-9a95-5aedd8d27ffd'
   and exists (
     select 1 from public.user_modules um
              join public.user_enrollments e on e.id = um.enrollment_id
       where um.id = public.user_sessions.user_module_id
         and e.user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid
   );

-- Echo the resulting state so we can confirm.
select us.id, us.quiz_completed, us.is_completed, us.quiz_score, us.title
  from public.user_sessions us
 where us.id = '5e0c2a88-d864-4827-9a95-5aedd8d27ffd';
