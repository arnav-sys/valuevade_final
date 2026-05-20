-- Prep test user for Phase 46 tester: reset today's challenges so the next
-- /dashboard load picks a fresh trio. Also revert daily_champion badge so it
-- can re-unlock during the test.

select 'reset_dc' as step, public.dev_reset_daily_challenges('13a690c4-96d7-4827-8117-fde4f696e999'::uuid) as out;

update public.user_badges ub
   set is_unlocked = false, earned_at = null, progress_current = 0, last_progress_seen = 0
  from public.master_badges mb
 where ub.badge_id = mb.id
   and mb.code = 'daily_champion'
   and ub.user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid;

-- Re-pick today's set so the user_daily_challenges table is non-empty.
select 'repick' as step, public.pick_daily_challenges('13a690c4-96d7-4827-8117-fde4f696e999'::uuid) as picked;
