-- Migration 0042: Preview and free-trial session flags
-- Run ONCE in Supabase Studio before using the preview video / free session features.

ALTER TABLE master_sessions
    ADD COLUMN IF NOT EXISTS is_preview_session BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE master_sessions
    ADD COLUMN IF NOT EXISTS is_free_session BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast public listing of free/preview sessions
CREATE INDEX IF NOT EXISTS idx_master_sessions_preview ON master_sessions (is_preview_session) WHERE is_preview_session = TRUE;
CREATE INDEX IF NOT EXISTS idx_master_sessions_free    ON master_sessions (is_free_session)    WHERE is_free_session    = TRUE;
