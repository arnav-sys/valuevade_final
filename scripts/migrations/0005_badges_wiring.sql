-- =============================================================================
-- Migration 0005 — Badge Engine Wiring helpers (Phase 3 cleanup)
-- =============================================================================
--
-- Adds:
--   * user_stats.p3_catchup_done (bool) — set true the first time the
--     frontend fires evaluate_badges({source_event:'p3_catchup'}) for a user,
--     so the catch-up sweep is a one-time event and doesn't replay on every
--     authenticated load.
--   * Ensures app_settings.allow_dev_rpcs='true' so the QA tester can use
--     dev_force_unlock_badge to validate overlay rendering per rarity.
--
-- Idempotent; safe to re-run.
-- =============================================================================

begin;

alter table public.user_stats
  add column if not exists p3_catchup_done boolean not null default false;

insert into public.app_settings (key, value)
values ('allow_dev_rpcs', 'true')
on conflict (key) do update set value = excluded.value;

commit;
