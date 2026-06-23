-- Reset testagent's dismissal so the banner re-appears for the screenshot.
UPDATE public.user_stats
   SET drift_banner_dismissed_at = NULL
 WHERE user_id = '13a690c4-96d7-4827-8117-fde4f696e999';
