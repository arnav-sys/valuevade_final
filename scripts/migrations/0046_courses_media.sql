-- Adds admin-editable cover photo + category + coming-soon flag to master_paths,
-- and seeds the 5 "Coming Soon" placeholder programs as real rows so they can be
-- managed (title, photo) from the admin Courses tab instead of a hardcoded array.
-- Run this in the Supabase SQL editor.

ALTER TABLE master_paths ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE master_paths ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE master_paths ADD COLUMN IF NOT EXISTS is_coming_soon boolean NOT NULL DEFAULT false;

UPDATE master_paths SET category = 'Equity Research'
WHERE slug = 'equity-research-analyst' AND category IS NULL;

INSERT INTO master_paths (title, slug, description, difficulty, category, is_active, is_coming_soon, created_at)
SELECT 'Investment Banking Fundamentals', 'investment-banking-fundamentals',
       'Launching soon, join the waitlist from your dashboard.', 'Intermediate',
       'Investment Banking', true, true, now()
WHERE NOT EXISTS (SELECT 1 FROM master_paths WHERE slug = 'investment-banking-fundamentals');

INSERT INTO master_paths (title, slug, description, difficulty, category, is_active, is_coming_soon, created_at)
SELECT 'Private Equity & Deal Structuring', 'private-equity-deal-structuring',
       'Launching soon, join the waitlist from your dashboard.', 'Advanced',
       'Private Equity', true, true, now()
WHERE NOT EXISTS (SELECT 1 FROM master_paths WHERE slug = 'private-equity-deal-structuring');

INSERT INTO master_paths (title, slug, description, difficulty, category, is_active, is_coming_soon, created_at)
SELECT 'Financial Modelling in Excel', 'financial-modelling-excel',
       'Launching soon, join the waitlist from your dashboard.', 'Beginner',
       'Financial Modelling', true, true, now()
WHERE NOT EXISTS (SELECT 1 FROM master_paths WHERE slug = 'financial-modelling-excel');

INSERT INTO master_paths (title, slug, description, difficulty, category, is_active, is_coming_soon, created_at)
SELECT 'Portfolio Management Essentials', 'portfolio-management-essentials',
       'Launching soon, join the waitlist from your dashboard.', 'Intermediate',
       'Portfolio Management', true, true, now()
WHERE NOT EXISTS (SELECT 1 FROM master_paths WHERE slug = 'portfolio-management-essentials');

INSERT INTO master_paths (title, slug, description, difficulty, category, is_active, is_coming_soon, created_at)
SELECT 'Wealth Management for Advisors', 'wealth-management-for-advisors',
       'Launching soon, join the waitlist from your dashboard.', 'Beginner',
       'Wealth Management', true, true, now()
WHERE NOT EXISTS (SELECT 1 FROM master_paths WHERE slug = 'wealth-management-for-advisors');
