-- Smoke: force-complete all 3 of today's picks to trigger Daily Champion.
-- Returns: jsonb with daily_champion_triggered=true on the 3rd call.

select 'fire_1' as step, public.dev_force_complete_daily_challenge(
  '13a690c4-96d7-4827-8117-fde4f696e999'::uuid,
  'daily_quiz_10'
) as result;

select 'fire_2' as step, public.dev_force_complete_daily_challenge(
  '13a690c4-96d7-4827-8117-fde4f696e999'::uuid,
  'daily_capstone_step'
) as result;

select 'fire_3' as step, public.dev_force_complete_daily_challenge(
  '13a690c4-96d7-4827-8117-fde4f696e999'::uuid,
  'daily_notes_3'
) as result;
