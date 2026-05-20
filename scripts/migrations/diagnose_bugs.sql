-- Diagnose Bug 2: find never-completed quizzes for the test user
-- and check supabase_realtime publication membership for user_badges.

-- 1) Never-completed quizzes for the test user (ordered for picking the highest)
select us.id                as user_session_id,
       us.session_id        as master_session_id,
       us.order_index,
       us.quiz_completed,
       us.is_completed      as session_completed,
       us.quiz_score,
       ms.title,
       ms.module_index,
       ms.session_index
  from public.user_sessions us
  join public.master_sessions ms on ms.id = us.session_id
 where us.user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid
   and us.quiz_completed = false
   and us.is_removed = false
 order by us.order_index
 limit 5;

-- 2) Quiz-attempted-but-completed (to confirm the tester's "0 XP" hypothesis)
select count(*) filter (where quiz_completed)       as quizzes_done,
       count(*) filter (where not quiz_completed)   as quizzes_open,
       count(*)                                     as total_sessions
  from public.user_sessions
 where user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid
   and is_removed = false;

-- 3) Realtime publication: confirm user_badges is published
select schemaname, tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and tablename in ('user_badges','user_stats','user_xp_events')
 order by tablename;
