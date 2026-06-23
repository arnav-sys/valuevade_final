-- ============================================================================
-- 0030_drift_recovery.sql — Drift Recovery Banner column
-- ============================================================================
-- Adds a single nullable column to user_stats so the banner endpoint can gate
-- re-show on a 24-hour window. No new tables, no triggers, no policies.
-- Re-runnable.
-- ============================================================================

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS drift_banner_dismissed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.user_stats.drift_banner_dismissed_at IS
  'Timestamp of the most recent /dashboard/drift-recovery/dismiss POST. '
  'The endpoint suppresses the banner for 24h after this value.';

-- Sanity check
DO $$
DECLARE
  col_count int;
BEGIN
  SELECT count(*) INTO col_count
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'user_stats'
     AND column_name = 'drift_banner_dismissed_at';
  IF col_count <> 1 THEN
    RAISE EXCEPTION 'drift_banner_dismissed_at column not present after migration';
  END IF;
END $$;
