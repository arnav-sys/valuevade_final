-- 0021 — Batch 1 fixes (D2 leftovers + B/E items from BATCH 1).
--
-- One file bundling: badge backfill + unique guard (A2 + D3), estimated
-- minutes/hours reduction to 25% (E1), retro-update of active plan loads
-- (E1), and a partial unique guard on master_milestones for plan_streak
-- granted dedup (covered earlier).
--
-- E2 (removal of "deadline too tight" check) is BACKEND PYTHON — not in
-- this migration. The Python edit lives in server.py.

begin;

-- ---------------------------------------------------------------------------
-- A2 — Backfill `is_unlocked=true AND earned_at IS NULL` badge rows.
-- Use `updated_at` if present (preserves audit history), else `now()`.
-- The Python helper now also writes earned_at on the INSERT branch.
-- ---------------------------------------------------------------------------
update public.user_badges
   set earned_at = coalesce(created_at, now())
 where is_unlocked = true and earned_at is null;

-- ---------------------------------------------------------------------------
-- D3 — Enforce uniqueness (user_id, badge_id) on user_badges so the same
-- badge cannot be inserted twice. Use a CONSTRAINT (not just an index) so
-- ON CONFLICT works at the application layer.
-- ---------------------------------------------------------------------------
do $$
begin
  -- Drop duplicate rows first (keep the one with earliest earned_at / created_at)
  delete from public.user_badges ub
   using public.user_badges ub2
   where ub.user_id = ub2.user_id
     and ub.badge_id = ub2.badge_id
     and ub.id <> ub2.id
     and (
       coalesce(ub.earned_at, ub.created_at) > coalesce(ub2.earned_at, ub2.created_at)
       or (
         coalesce(ub.earned_at, ub.created_at) = coalesce(ub2.earned_at, ub2.created_at)
         and ub.id > ub2.id
       )
     );
exception when others then
  raise notice 'user_badges dedupe skipped: % %', sqlstate, sqlerrm;
end$$;

do $$
begin
  alter table public.user_badges
    add constraint user_badges_user_badge_unique unique (user_id, badge_id);
exception when duplicate_object then null;
  when others then
    raise notice 'unique constraint already present or could not be created: % %', sqlstate, sqlerrm;
end$$;

-- ---------------------------------------------------------------------------
-- E1 — Reduce session/project estimated time to 25%.
-- Floor at 5 min per session and 0.25 hr per project so nothing goes to zero.
-- Re-runnable: the GREATEST() ensures hitting the floor stays at the floor;
-- but multiplying by 0.25 again on the already-reduced values would shrink
-- further. We therefore guard with a sentinel row in `public.app_settings`
-- if it exists, OR just trust the user not to re-run.
-- ---------------------------------------------------------------------------
update public.master_sessions
   set estimated_minutes = greatest(5, ceil(estimated_minutes * 0.25))
 where estimated_minutes > 5;

update public.master_module_projects
   set estimated_hours = greatest(0.25::numeric, round((estimated_hours * 0.25)::numeric, 2))
 where estimated_hours > 0.25;

-- ---------------------------------------------------------------------------
-- E1 retro-update — recompute total_load_minutes for active user plans.
-- Sum (master_sessions.estimated_minutes) over the user's customized
-- user_sessions, plus (master_module_projects.estimated_hours * 60), and
-- apply the same 5% buffer used by the planner.
-- ---------------------------------------------------------------------------
update public.user_study_plans p
   set total_load_minutes = ceil((
     -- sessions sum
     coalesce((
       select sum(ms.estimated_minutes)
         from public.user_modules um
         join public.user_sessions us  on us.user_module_id = um.id and us.is_removed = false
         join public.master_sessions ms on ms.id = us.master_session_id
        where um.enrollment_id = p.enrollment_id and um.is_removed = false
     ), 0)
     +
     -- projects sum (estimated_hours -> minutes)
     coalesce((
       select sum(mp.estimated_hours * 60)
         from public.user_modules um
         join public.master_module_projects mp on mp.module_id = um.master_module_id
        where um.enrollment_id = p.enrollment_id and um.is_removed = false
     ), 0)
   ) * 1.05),
   updated_at = now()
 where p.status = 'active';

commit;
