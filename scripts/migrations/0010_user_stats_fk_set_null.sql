-- =============================================================================
-- Migration 0010 — user_stats.enrollment_id FK: ON DELETE CASCADE → SET NULL
-- =============================================================================
--
-- Rationale: a user dropping or replacing a course should NOT wipe their
-- gamification state (XP, level, streak, badges, Daily Champion glow,
-- p3_catchup_done). The user_stats row tracks the user, not the enrollment;
-- the enrollment_id is a soft pointer to "their primary path". When that
-- path goes away, the pointer should null out, not take the whole stats row
-- with it.
--
-- Idempotent: drop + recreate the FK so re-running is safe.
-- =============================================================================

begin;

alter table public.user_stats
  drop constraint if exists user_stats_enrollment_id_fkey;

alter table public.user_stats
  add constraint user_stats_enrollment_id_fkey
  foreign key (enrollment_id) references public.user_enrollments(id)
  on delete set null;

commit;
