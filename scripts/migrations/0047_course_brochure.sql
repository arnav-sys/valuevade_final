-- Adds admin-uploadable brochure PDF + intro video per course. Run this in
-- the Supabase SQL editor (after 0046_courses_media.sql).

ALTER TABLE master_paths ADD COLUMN IF NOT EXISTS brochure_url text;
ALTER TABLE master_paths ADD COLUMN IF NOT EXISTS intro_video_url text;
