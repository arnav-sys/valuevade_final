-- Migration 0041: Add video_duration_minutes to master_sessions
-- Run ONCE in Supabase Studio before using the dynamic session timing feature.
-- After applying, the study planner and session timings will automatically
-- use: effective_minutes = round(video_duration_minutes || 15) + 10

ALTER TABLE master_sessions
    ADD COLUMN IF NOT EXISTS video_duration_minutes NUMERIC;

-- Optional: backfill sessions that already have lecture_url with a placeholder
-- so they show 15+10=25 min (same as no-video default) until duration is set.
-- UPDATE master_sessions SET video_duration_minutes = NULL WHERE video_duration_minutes IS NULL;
-- (no-op — just illustrates the default behaviour)
