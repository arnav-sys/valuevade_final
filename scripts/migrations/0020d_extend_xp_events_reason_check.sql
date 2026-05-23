-- 0020d — extend user_xp_events.reason CHECK to allow 'plan_daily_target'.
--
-- Phase D2's +25 bonus reason got rejected by the column CHECK constraint
-- (defined in 0001). The constraint is unnamed; we discover it by
-- introspecting pg_constraint, drop it, and add a new one with the
-- extended whitelist.

begin;

do $$
declare
  v_constraint_name text;
begin
  select c.conname into v_constraint_name
    from pg_constraint c
    join pg_class      t on t.oid = c.conrelid
    join pg_namespace  n on n.oid = t.relnamespace
   where n.nspname = 'public' and t.relname = 'user_xp_events'
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) ilike '%reason%session_complete%';
  if v_constraint_name is not null then
    execute format('alter table public.user_xp_events drop constraint %I', v_constraint_name);
  end if;
end$$;

alter table public.user_xp_events
  add constraint user_xp_events_reason_check
  check (reason in (
    'session_complete',
    'quiz_correct',
    'quiz_attempt',
    'simulation_complete',
    'daily_login',
    'capstone_complete',
    'module_complete',
    'daily_challenge_complete',
    'daily_champion_bonus',
    'signup_bonus',
    'badge_unlock_bonus',
    'streak_milestone',
    'manual_adjust',
    'plan_daily_target'
  ));

commit;
