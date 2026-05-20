-- Smoke test: pick today's challenges for the test user; should be idempotent.
select public.pick_daily_challenges('13a690c4-96d7-4827-8117-fde4f696e999'::uuid) as picked;
