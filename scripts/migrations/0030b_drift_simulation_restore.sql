-- Restore testagent's XP event timestamps after drift simulation. Reverses
-- 0030a_drift_simulation_setup.sql. Idempotent — leaves no rows behind.

BEGIN;

UPDATE public.user_xp_events e
   SET created_at = b.original_created_at
  FROM public._drift_sim_backup b
 WHERE e.id = b.id;

DROP TABLE IF EXISTS public._drift_sim_backup;

COMMIT;
