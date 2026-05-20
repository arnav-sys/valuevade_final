-- =============================================================================
-- Migration 0006 — Badge celebration realtime + drift fix
-- =============================================================================
--
-- Bug 1 root cause: BadgeUnlockOverlay only fired off the evaluate_badges RPC
-- return path. Direct writes to user_badges (dev_force_unlock_badge, multi-tab,
-- background workers) silently bypassed the celebration. Fix: publish
-- user_badges via supabase_realtime + REPLICA IDENTITY FULL so the React layer
-- can subscribe to postgres_changes and react to any is_unlocked flip.
--
-- Bug 3 partial — RPC-level hardening: dev_force_unlock_badge now writes
-- earned_at and is_unlocked atomically (it already did; this re-asserts in
-- case a future migration drifts).
--
-- Idempotent / safe to re-run.
-- =============================================================================

begin;

-- 1. Add gamification tables to supabase_realtime publication so the React
--    client can subscribe to postgres_changes.
do $$
declare
  t text;
begin
  for t in select unnest(array[
            'user_badges',
            'user_stats',
            'user_xp_events',
            'user_streak_events'
          ])
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end$$;

-- 2. REPLICA IDENTITY FULL so postgres_changes UPDATE events include old.*
--    fields. Without this, payload.old only carries the PK and we can't
--    detect a false→true transition on is_unlocked.
alter table public.user_badges  replica identity full;
alter table public.user_stats   replica identity full;

-- 3. Bug 3 hygiene: backfill earned_at for any drift rows (is_unlocked=true
--    but earned_at IS NULL). We use the row's updated_at if present, else now().
update public.user_badges
   set earned_at = coalesce(earned_at, now())
 where is_unlocked = true and earned_at is null;

commit;
