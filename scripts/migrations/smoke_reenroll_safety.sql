-- Simulate the new flow against the test user's existing M0 enrollment.
-- Step 1: snapshot user_stats BEFORE.
-- Step 2: clear child user_modules (cascades down to user_sessions, user_module_projects).
-- Step 3: update the enrollment row in place.
-- Step 4: snapshot user_stats AFTER — must still exist with same total_xp.

with before_stats as (
  select user_id, total_xp, current_level, current_streak_days,
         daily_champion_glow_until, p3_catchup_done
    from public.user_stats
   where user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid
),
enrollment as (
  select id, user_id, master_path_id
    from public.user_enrollments
   where user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid
   limit 1
),
clear_children as (
  delete from public.user_modules
   where enrollment_id = (select id from enrollment)
  returning enrollment_id
),
touch_enrollment as (
  update public.user_enrollments
     set updated_at = now(),
         status = 'active'
   where id = (select id from enrollment)
  returning id
),
after_stats as (
  select user_id, total_xp, current_level, current_streak_days,
         daily_champion_glow_until, p3_catchup_done
    from public.user_stats
   where user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid
)
select 'before' as snap, * from before_stats
union all
select 'after'  as snap, * from after_stats;
