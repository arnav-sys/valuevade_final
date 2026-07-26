-- 0038_reward_claim_post_url.sql — Feb 2026
--
-- Make sharing on LinkedIn *provable*: every reward claim must now include the
-- URL of the LinkedIn post the learner published. The URL is validated in the
-- backend (must be a real linkedin.com post/pulse/feed-update URL) so we can
-- audit claims from the admin panel.
--
-- The column is nullable at DB-level for backwards compatibility with any
-- pre-existing claim rows (there were none in prod at migration time, but we
-- keep the constraint at the backend for forward-compat). No existing rows
-- are back-filled.

BEGIN;

ALTER TABLE public.user_reward_claims
  ADD COLUMN IF NOT EXISTS linkedin_post_url text;

COMMENT ON COLUMN public.user_reward_claims.linkedin_post_url IS
  'URL of the LinkedIn post the learner shared before claiming this reward. '
  'Validated + required by /api/rewards/claim (server.py). Must be a real '
  'linkedin.com posts / pulse / feed update URL.';

CREATE INDEX IF NOT EXISTS user_reward_claims_reward_idx
  ON public.user_reward_claims(reward_id);

COMMIT;
