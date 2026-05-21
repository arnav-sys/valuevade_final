-- =============================================================================
-- Migration 0014 — Phase 54 (Pari rename + Welcome + Doubts attempt_context
--                            + Country + Daily News + news_buff badge)
-- =============================================================================
-- Idempotent; safe to re-run.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A. profiles: P1 (welcome modal gate), P7a (country)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists pari_welcomed_at timestamptz;

alter table public.profiles
  add column if not exists country_code text;

-- ---------------------------------------------------------------------------
-- B. user_doubt_sessions: P4 (attempt context for personalized doubts)
-- ---------------------------------------------------------------------------
alter table public.user_doubt_sessions
  add column if not exists attempt_context jsonb;

-- ---------------------------------------------------------------------------
-- C. Daily News cache + per-user reads (P7b)
-- ---------------------------------------------------------------------------
create table if not exists public.daily_news_cache (
  id           uuid primary key default gen_random_uuid(),
  country_code text not null,
  date_ist     date not null,
  items        jsonb not null,
  source       text,
  fetched_at   timestamptz not null default now(),
  unique (country_code, date_ist)
);

create table if not exists public.user_news_reads (
  user_id        uuid not null references auth.users(id) on delete cascade,
  news_date_ist  date not null,
  read_at        timestamptz not null default now(),
  read_count     int  not null default 1,
  xp_awarded     bool not null default false,
  primary key (user_id, news_date_ist)
);

alter table public.daily_news_cache enable row level security;
alter table public.user_news_reads  enable row level security;

drop policy if exists daily_news_cache_select on public.daily_news_cache;
create policy daily_news_cache_select on public.daily_news_cache
  for select to authenticated, anon
  using (true);

drop policy if exists user_news_reads_select_own on public.user_news_reads;
create policy user_news_reads_select_own on public.user_news_reads
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- D. news_buff badge (P7b)
-- ---------------------------------------------------------------------------
insert into public.master_badges (code, name, description, rarity, category, icon_slug, criteria_json)
values (
  'news_buff',
  'News Buff',
  'Read the daily finance news 7 times.',
  'common',
  'consistency',
  'newspaper',
  '{"type":"news_reads_gte","gte":7}'::jsonb
)
on conflict (code) do update set
  description  = excluded.description,
  rarity       = excluded.rarity,
  category     = excluded.category,
  icon_slug    = excluded.icon_slug,
  criteria_json = excluded.criteria_json;

-- ---------------------------------------------------------------------------
-- E. RPC: record_news_read — atomic upsert + XP-once gate
-- ---------------------------------------------------------------------------
create or replace function public.record_news_read(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_xp_awarded_now bool := false;
  v_total_reads int;
  v_xp_already bool;
begin
  insert into public.user_news_reads (user_id, news_date_ist, read_count, xp_awarded)
  values (p_user_id, v_today, 1, false)
  on conflict (user_id, news_date_ist) do update
    set read_count = public.user_news_reads.read_count + 1,
        read_at = now()
  returning xp_awarded into v_xp_already;

  -- Award XP once per IST day.
  if not v_xp_already then
    update public.user_news_reads
       set xp_awarded = true
     where user_id = p_user_id and news_date_ist = v_today;
    v_xp_awarded_now := true;
  end if;

  select count(*) into v_total_reads
    from public.user_news_reads
   where user_id = p_user_id;

  return jsonb_build_object(
    'today_ist',      v_today,
    'xp_awarded_now', v_xp_awarded_now,
    'total_reads',    v_total_reads
  );
end$$;

grant execute on function public.record_news_read(uuid) to authenticated, service_role;

commit;
