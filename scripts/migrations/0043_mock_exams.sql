-- Migration 0043: Mock Exams
-- Adds mock exam tables for module-level timed examinations (e.g. NISM XV)
-- Run this in Supabase Studio → SQL Editor

-- One mock exam per module
CREATE TABLE IF NOT EXISTS master_mock_exams (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id           UUID        NOT NULL REFERENCES master_modules(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL DEFAULT 'Mock Exam',
  description         TEXT,
  time_limit_minutes  INTEGER     NOT NULL DEFAULT 120,
  pass_percentage     NUMERIC     NOT NULL DEFAULT 60,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mock_exam_module ON master_mock_exams(module_id);

-- Questions for the exam
CREATE TABLE IF NOT EXISTS master_mock_exam_questions (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id               UUID        NOT NULL REFERENCES master_mock_exams(id) ON DELETE CASCADE,
  question              TEXT        NOT NULL DEFAULT '',
  options               JSONB       NOT NULL DEFAULT '[]',
  correct_answer_index  INTEGER     NOT NULL DEFAULT 0,
  explanation           TEXT,
  difficulty            TEXT        DEFAULT 'medium',
  topic_tag             TEXT,
  order_index           INTEGER     DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Student attempt log
CREATE TABLE IF NOT EXISTS user_mock_exam_attempts (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID        NOT NULL,
  exam_id             UUID        NOT NULL REFERENCES master_mock_exams(id) ON DELETE CASCADE,
  answers             JSONB       DEFAULT '[]',
  score               NUMERIC,
  total_questions     INTEGER,
  correct_count       INTEGER,
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  time_taken_seconds  INTEGER,
  passed              BOOLEAN
);

-- is_exam_module flag on master_modules (marks module as exam-type, hides project CTA)
ALTER TABLE master_modules
  ADD COLUMN IF NOT EXISTS is_exam_module BOOLEAN DEFAULT FALSE;

-- Enable RLS (read-only for authenticated users on the exam tables)
ALTER TABLE master_mock_exams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_mock_exam_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mock_exam_attempts        ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read exam meta and questions
CREATE POLICY IF NOT EXISTS "anon read mock exams"
  ON master_mock_exams FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY IF NOT EXISTS "anon read mock exam questions"
  ON master_mock_exam_questions FOR SELECT TO authenticated USING (TRUE);

-- Users can insert/select their own attempts
CREATE POLICY IF NOT EXISTS "users manage own attempts"
  ON user_mock_exam_attempts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
