-- =============================================================================
-- Migration 0009 — P5 polish: Constellation map view + heatmap realtime
-- =============================================================================
--
-- A. Add user_daily_activity to supabase_realtime publication + REPLICA
--    IDENTITY FULL so the heatmap re-renders today's cell live.
-- B. View v_module_progress_summary — joins master_modules + user_modules +
--    aggregates user_sessions per (auth-scoped) user. Used by the constellation
--    map + /api/health/journey.
-- =============================================================================

begin;

-- A. Realtime for daily activity
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'user_daily_activity'
  ) then
    execute 'alter publication supabase_realtime add table public.user_daily_activity';
  end if;
end$$;

alter table public.user_daily_activity replica identity full;

-- B. Module progress summary view
--
-- Each row = ONE user_module (per-enrollment, per-user). Filters via RLS on
-- user_modules; the joins downstream see only authorised rows. The frontend
-- queries it via PostgREST so `auth.uid()` is bound automatically.
--
-- Prerequisite policy (P5): linear chain by order_index. Module N's prereq
-- is module N-1 within the same enrollment. We expose `prerequisite_order`
-- (int) + `is_unlocked` (bool) computed from is_completed of the previous
-- user_module row in the same enrollment.
--
-- Aggregations:
--   sessions_total        — count of user_sessions under this user_module
--   sessions_completed_n  — count where is_completed = true
--   completion_percent    — round(100 * sessions_completed_n / sessions_total)
--   last_activity_at      — max(completed_at) of any phase across sessions
--   time_spent_minutes    — sum of estimated_minutes for completed sessions
--                           (falls back to 0 — accurate per-session time
--                           tracking lives in user_daily_activity at a
--                           per-day granularity, not per-module).
--   xp_earned_in_module   — sum of user_xp_events.amount whose source_id
--                           matches a user_session.id under this user_module
--                           (best-effort traceability; quiz/sim/session
--                           events use the session_id as source_id).

drop view if exists public.v_module_progress_summary;

create view public.v_module_progress_summary
with (security_invoker = true)
as
select
  um.id                                     as user_module_id,
  ue.user_id                                as user_id,
  ue.id                                     as enrollment_id,
  um.master_module_id                       as master_module_id,
  um.order_index                            as order_index,
  ('M' || um.order_index)::text             as module_code,
  coalesce(um.title, mm.title)              as module_title,
  coalesce(um.description, mm.description)  as module_description,
  um.is_completed                           as is_completed,
  um.completed_at                           as completed_at,
  um.is_added_by_ai                         as is_added_by_ai,
  (um.order_index - 1)                      as prerequisite_order,
  case
    when um.order_index <= 0 then true
    when not exists (
      select 1 from public.user_modules um_prev
       where um_prev.enrollment_id = um.enrollment_id
         and um_prev.order_index < um.order_index
         and um_prev.is_removed = false
    ) then true
    else exists (
      select 1
        from public.user_modules um_prev
       where um_prev.enrollment_id = um.enrollment_id
         and um_prev.order_index = um.order_index - 1
         and um_prev.is_removed = false
         and um_prev.is_completed = true
    )
  end                                       as is_unlocked,
  (
    select count(*)::int
      from public.user_sessions us
     where us.user_module_id = um.id and us.is_removed = false
  )                                         as sessions_total,
  (
    select count(*)::int
      from public.user_sessions us
     where us.user_module_id = um.id and us.is_removed = false and us.is_completed = true
  )                                         as sessions_completed_n,
  (
    select case
             when count(*) = 0 then 0
             else round(100.0 * sum(case when is_completed then 1 else 0 end)::numeric / count(*)::numeric)::int
           end
      from public.user_sessions us
     where us.user_module_id = um.id and us.is_removed = false
  )                                         as completion_percent,
  (
    select max(us.completed_at)
      from public.user_sessions us
     where us.user_module_id = um.id and us.is_removed = false and us.completed_at is not null
  )                                         as last_activity_at,
  coalesce((
    select sum(coalesce(ms.estimated_minutes, 0))::int
      from public.user_sessions us
      join public.master_sessions ms on ms.id = us.master_session_id
     where us.user_module_id = um.id and us.is_removed = false and us.is_completed = true
  ), 0)                                     as time_spent_minutes,
  coalesce((
    select sum(uxp.amount)::int
      from public.user_xp_events uxp
     where uxp.user_id = ue.user_id
       and uxp.source_id in (
         select us.id from public.user_sessions us
          where us.user_module_id = um.id and us.is_removed = false
       )
  ), 0)                                     as xp_earned_in_module
from public.user_modules um
join public.user_enrollments ue on ue.id = um.enrollment_id
left join public.master_modules mm on mm.id = um.master_module_id
where um.is_removed = false;

grant select on public.v_module_progress_summary to authenticated, service_role;

commit;
