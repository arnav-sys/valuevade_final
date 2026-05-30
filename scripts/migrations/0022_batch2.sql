-- Batch 2 — user_daily_news_summary cache + housekeeping
-- =============================================================================
-- ITEM 3: Per-user, per-day cached LLM news summary
-- =============================================================================
--   Replaces the old per-country `daily_news_cache` model (which was shared
--   across users in the same country and only stored per-item summaries).
--   This new table is per-USER per-day, holding a single markdown summary
--   that combines global + country-specific finance news.
-- =============================================================================

begin;

create table if not exists user_daily_news_summary (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  news_date_ist   date not null,
  country_code    text not null,
  summary_md      text not null,
  raw_item_count  int  not null default 0,
  tokens_used     int  not null default 0,
  generated_at    timestamptz not null default now(),
  constraint uq_user_daily_news_summary unique (user_id, news_date_ist)
);

create index if not exists ix_user_daily_news_summary_user_date
  on user_daily_news_summary (user_id, news_date_ist desc);

-- RLS: owner SELECT only. INSERT/UPDATE done by service-role from the backend.
alter table user_daily_news_summary enable row level security;

drop policy if exists "owner_select_user_daily_news_summary" on user_daily_news_summary;
create policy "owner_select_user_daily_news_summary"
  on user_daily_news_summary
  for select
  using (auth.uid() = user_id);

drop policy if exists "service_role_all_user_daily_news_summary" on user_daily_news_summary;
create policy "service_role_all_user_daily_news_summary"
  on user_daily_news_summary
  for all
  to service_role
  using (true)
  with check (true);

comment on table user_daily_news_summary is
  'Batch 2 — One LLM-generated finance news markdown digest per user per IST day.';

-- =============================================================================
-- ITEM 4: award_xp signature audit (informational)
-- =============================================================================
--   The application code was calling rpc/award_xp with these kw arg names:
--     p_event_type, p_amount, p_event_source_id, p_event_source_label,
--     p_metadata, p_user_id
--   …but the actual SQL function signature in the DB expects:
--     p_user_id, p_amount, p_reason, p_source_id, p_meta
--
--   We are NOT touching the SQL function here — the canonical signature lives
--   in migration 0003 / 0008. We are fixing the application call sites in
--   /app/backend/server.py to use the right kw arg names. This SQL block is
--   left intentionally inert so that re-running the migration is safe.
--
--   Mapping (app → DB):
--     p_event_type         → p_reason
--     p_event_source_id    → p_source_id
--     p_event_source_label → (dropped; fold into p_meta if needed)
--     p_metadata           → p_meta
--     p_amount             → p_amount  (unchanged)
--     p_user_id            → p_user_id (unchanged)
-- =============================================================================

commit;

-- =============================================================================
-- ITEM 4 (continued): Allow 'news_read' as a valid XP reason.
-- =============================================================================
-- The original CHECK constraint on user_xp_events.reason (migration 0001)
-- didn't include 'news_read'. Add it now so the news mark_read flow can
-- finally write its XP event. Also relax the helper function's guard.
-- =============================================================================

begin;

alter table public.user_xp_events drop constraint if exists user_xp_events_reason_check;
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
    'plan_daily_target',
    'news_read'
  ));

-- Refresh the award_xp guard list to mirror the CHECK constraint above.
-- Restored from 0020e (the canonical body) with `news_read` appended.
create or replace function public.award_xp(
  p_user_id   uuid,
  p_amount    int,
  p_reason    text,
  p_source_id uuid default null,
  p_meta      jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller        uuid := auth.uid();
  v_old_level     int;
  v_new_level     int;
  v_new_total_xp  int;
  v_stats         public.user_stats%rowtype;
  v_today         date := (now() at time zone 'Asia/Kolkata')::date;
  v_session_delta int  := 0;
  v_minutes_delta int  := 0;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'award_xp: caller % cannot award XP to %', v_caller, p_user_id
      using errcode = '42501';
  end if;

  if p_reason not in (
    'session_complete','quiz_correct','quiz_attempt','simulation_complete',
    'daily_login','capstone_complete','module_complete','daily_challenge_complete',
    'daily_champion_bonus','signup_bonus','badge_unlock_bonus','streak_milestone',
    'manual_adjust','plan_daily_target','news_read'
  ) then
    raise exception 'award_xp: invalid reason %', p_reason using errcode = '22023';
  end if;

  -- 1) Append ledger event.
  insert into public.user_xp_events (user_id, amount, reason, source_id, meta)
  values (p_user_id, p_amount, p_reason, p_source_id, coalesce(p_meta, '{}'::jsonb));

  -- 2) Ensure user_stats row exists, then bump total_xp.
  select * into v_stats from public.user_stats where user_id = p_user_id limit 1;
  if not found then
    return jsonb_build_object(
      'updated', false,
      'reason', 'no_user_stats_row',
      'event_inserted', true,
      'did_level_up', false
    );
  end if;

  v_old_level := coalesce(v_stats.current_level, 1);
  v_new_total_xp := coalesce(v_stats.total_xp, 0) + p_amount;

  select coalesce(max(level_number), 1)
    into v_new_level
    from public.master_levels
   where xp_threshold <= greatest(v_new_total_xp, 0);

  update public.user_stats
     set total_xp      = v_new_total_xp,
         current_level = v_new_level,
         updated_at    = now()
   where id = v_stats.id
   returning * into v_stats;

  if p_reason = 'session_complete' then
    v_session_delta := 1;
  end if;
  v_minutes_delta := least(240, greatest(0, coalesce((p_meta->>'minutes')::int, 0)));

  insert into public.user_daily_activity
    (user_id, activity_date, xp_earned, sessions_completed, minutes_spent, events_count)
  values
    (p_user_id, v_today, p_amount, v_session_delta, v_minutes_delta, 1)
  on conflict (user_id, activity_date) do update
    set xp_earned          = public.user_daily_activity.xp_earned + excluded.xp_earned,
        sessions_completed = public.user_daily_activity.sessions_completed + excluded.sessions_completed,
        minutes_spent      = public.user_daily_activity.minutes_spent + excluded.minutes_spent,
        events_count       = public.user_daily_activity.events_count + 1,
        updated_at         = now();

  return jsonb_build_object(
    'updated', true,
    'event_inserted', true,
    'did_level_up', v_new_level > v_old_level,
    'old_level', v_old_level,
    'new_level', v_new_level,
    'total_xp', v_new_total_xp,
    'user_stats', to_jsonb(v_stats)
  );
end;
$$;

revoke all on function public.award_xp(uuid, int, text, uuid, jsonb) from public;
grant  execute on function public.award_xp(uuid, int, text, uuid, jsonb) to authenticated;
grant  execute on function public.award_xp(uuid, int, text, uuid, jsonb) to service_role;

commit;
