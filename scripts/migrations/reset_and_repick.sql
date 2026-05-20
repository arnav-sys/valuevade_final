-- Reset to clean state and verify badge unlock fires via update_daily_challenge_progress.

select 'reset' as step, public.dev_reset_daily_challenges('13a690c4-96d7-4827-8117-fde4f696e999'::uuid) as out;

-- Re-revert the daily_champion badge so it's unlockable again.
update public.user_badges ub
   set is_unlocked = false, earned_at = null, progress_current = 0
  from public.master_badges mb
 where ub.badge_id = mb.id
   and mb.code = 'daily_champion'
   and ub.user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid;

-- Re-pick today's challenges (idempotent).
select 'pick' as step, public.pick_daily_challenges('13a690c4-96d7-4827-8117-fde4f696e999'::uuid) as picked;
