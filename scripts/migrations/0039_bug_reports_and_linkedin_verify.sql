-- 0039_bug_reports_and_linkedin_verify.sql — Feb 2026
--
-- Two small additions:
--   (1) `error_reports.user_description` — free-text field the learner can
--       fill in from the crash-screen or the floating "Report a bug" button
--       so the admin knows *what the user was doing* when the bug hit.
--   (2) `user_reward_claims.linkedin_post_verified` — set to true when the
--       backend was able to fetch the LinkedIn post URL and confirm it
--       mentions Valuevade / the reward's expected hashtag. Lets admins
--       spot unverified claims that need manual review.

BEGIN;

ALTER TABLE public.error_reports
  ADD COLUMN IF NOT EXISTS user_description text;

ALTER TABLE public.error_report_events
  ADD COLUMN IF NOT EXISTS user_description text;

COMMENT ON COLUMN public.error_reports.user_description IS
  'Optional free-text description of what the user was doing when the '
  'error occurred, captured either from the crash screen or the site-wide '
  '"Report a bug" button.';

ALTER TABLE public.user_reward_claims
  ADD COLUMN IF NOT EXISTS linkedin_post_verified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_reward_claims.linkedin_post_verified IS
  'True when the backend could fetch the LinkedIn post URL and confirm '
  'it mentions Valuevade (or the reward-specific hashtag). False when the '
  'URL was syntactically valid but content verification failed / timed out. '
  'Admins can use this to spot suspicious claims.';

COMMIT;
