-- Bug 2: Find never-completed quizzes for the test user (corrected schema).
-- user_sessions has no user_id; must traverse user_modules → user_enrollments.

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
 limit 8;

select count(*) filter (where quiz_completed)       as quizzes_done,
       count(*) filter (where not quiz_completed)   as quizzes_open,
       count(*)                                     as total_sessions
  from public.user_sessions us
  join public.user_modules um on um.id = us.user_module_id
  join public.user_enrollments e on e.id = um.enrollment_id
 where e.user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid
   and us.is_removed = false;

-- Bug 1: Realtime publication membership
select schemaname, tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and tablename in ('user_badges','user_stats','user_xp_events')
 order by tablename;

-- Bug 3: ground-truth unlocked badge count for the test user
select count(*) filter (where is_unlocked = true)                    as is_unlocked_true,
       count(*) filter (where is_unlocked = true and earned_at is not null) as both_true,
       count(*) filter (where earned_at is not null)                  as earned_at_not_null,
       count(*) filter (where is_unlocked = true and earned_at is null) as drift_rows
  from public.user_badges
 where user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid;
