-- Pre-smoke: revert sprint_quiz so dev_force_unlock_badge can re-fire it (5s dedupe window will be reset on page reload anyway).
update public.user_badges ub
   set is_unlocked = false,
       earned_at = null,
       progress_current = 0
  from public.master_badges mb
 where ub.badge_id = mb.id
   and mb.code = 'sprint_quiz'
   and ub.user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid;

select count(*) as reverted from public.user_badges ub join public.master_badges mb on mb.id = ub.badge_id
 where mb.code = 'sprint_quiz' and ub.user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid and ub.is_unlocked = false;
