-- Drift simulation for testagent2026 (P2 Step 5 live test).
-- Backdates 4 recent XP events into the [now-14d, now-7d] window so that:
--   recent_xp (last 7d) drops well below 30% of prior_xp.
-- Reversible via 0030b_drift_simulation_restore.sql.

BEGIN;

-- Save original created_at into a side table so we can restore later.
CREATE TABLE IF NOT EXISTS public._drift_sim_backup (
  id uuid PRIMARY KEY,
  original_created_at timestamptz NOT NULL,
  shifted_at timestamptz NOT NULL DEFAULT now()
);

-- 1. Backdate the four large-ish recent rows for testagent into the prior
--    window (10 days ago, well inside [7d, 14d]).
WITH targets AS (
  SELECT id, created_at
    FROM public.user_xp_events
   WHERE user_id = '13a690c4-96d7-4827-8117-fde4f696e999'
     AND id IN (
       '1c1fc814-e2fa-4224-bb52-3079957a2b9e',  -- 100 badge
       '02df2989-e130-42e9-998f-cebd896126a9',  -- 25 badge
       '49838236-bcc0-4b07-904d-947c4f8aa63a',  -- 25 daily_login (today)
       '9d80ff6e-6db5-4a0d-bed6-51bccc3c19e9'   -- 25 daily_login (3d ago)
     )
)
INSERT INTO public._drift_sim_backup(id, original_created_at)
SELECT id, created_at FROM targets
ON CONFLICT (id) DO NOTHING;

UPDATE public.user_xp_events
   SET created_at = now() - interval '10 days'
 WHERE id IN (
   '1c1fc814-e2fa-4224-bb52-3079957a2b9e',
   '02df2989-e130-42e9-998f-cebd896126a9',
   '49838236-bcc0-4b07-904d-947c4f8aa63a',
   '9d80ff6e-6db5-4a0d-bed6-51bccc3c19e9'
 );

-- 2. Also pull the five "older" rows (currently ~2026-05-30, > 14d back)
--    forward into the prior window so prior_xp climbs further past the
--    100-XP floor with comfortable headroom.
WITH targets2 AS (
  SELECT id, created_at
    FROM public.user_xp_events
   WHERE user_id = '13a690c4-96d7-4827-8117-fde4f696e999'
     AND id IN (
       'd56481c2-8530-4923-9092-8ae8ed267d2f',  -- 100 simulation
       'cb653489-d78e-4001-821c-329a3cacf1c6',  --  30 news_read
       '4dcedf71-3b52-4a70-8906-4afab5a50270',  --  25 daily_challenge
       '1bb3a3e9-b6b3-48e1-9f85-9ffbf4efc4f5',  --  25 plan_daily_target
       'ffb9de9f-8696-46da-b832-4d14fa3809ac'   --  25 daily_login
     )
)
INSERT INTO public._drift_sim_backup(id, original_created_at)
SELECT id, created_at FROM targets2
ON CONFLICT (id) DO NOTHING;

UPDATE public.user_xp_events
   SET created_at = now() - interval '11 days'
 WHERE id IN (
   'd56481c2-8530-4923-9092-8ae8ed267d2f',
   'cb653489-d78e-4001-821c-329a3cacf1c6',
   '4dcedf71-3b52-4a70-8906-4afab5a50270',
   '1bb3a3e9-b6b3-48e1-9f85-9ffbf4efc4f5',
   'ffb9de9f-8696-46da-b832-4d14fa3809ac'
 );

-- Also reset any prior dismissal so the banner is eligible to re-show
-- during the live test.
UPDATE public.user_stats
   SET drift_banner_dismissed_at = NULL
 WHERE user_id = '13a690c4-96d7-4827-8117-fde4f696e999';

COMMIT;
