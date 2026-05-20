-- Simulate the p3_catchup sweep for the test user so we know the count
-- the BadgeContext bootstrap effect will report on next sign-in.
-- This is idempotent — already-unlocked badges short-circuit inside the RPC.

select jsonb_pretty(
  public.evaluate_badges(
    '13a690c4-96d7-4827-8117-fde4f696e999'::uuid,
    jsonb_build_object('source_event', 'p3_catchup_main_agent_smoke')
  )
) as catchup_result;
