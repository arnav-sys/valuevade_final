-- Wave 1 / Item 3 — Referral program (signup-link based, no payment yet)
--
-- Schema:
--   profiles.referral_code         — auto-generated 6-char uppercase code
--   profiles.referred_by_user_id   — set when a new signup arrives with ?ref=
--   profiles.payment_commission_enabled — placeholder flag for future paid tier
--   referral_events                — ledger of referrer→referred pairs +
--                                     idempotency flags for the two XP grants

begin;

-- 1) profiles columns -------------------------------------------------------
alter table public.profiles
  add column if not exists referral_code text;

alter table public.profiles
  add column if not exists referred_by_user_id uuid references auth.users(id);

alter table public.profiles
  add column if not exists payment_commission_enabled boolean not null default false;

-- Unique referral codes (case-insensitive enforcement via upper()).
create unique index if not exists ux_profiles_referral_code
  on public.profiles (upper(referral_code))
  where referral_code is not null;

-- Helper: generate a 6-char alphanumeric uppercase code, retry on collision.
create or replace function public.gen_referral_code()
returns text language plpgsql as $$
declare
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I confusion
  v_exists boolean;
  v_tries int := 0;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    select exists(select 1 from public.profiles where upper(referral_code) = v_code)
      into v_exists;
    exit when not v_exists or v_tries > 12;
    v_tries := v_tries + 1;
  end loop;
  return v_code;
end $$;

-- Backfill any existing rows missing a code (idempotent).
update public.profiles
   set referral_code = public.gen_referral_code()
 where referral_code is null;

-- 2) referral_events --------------------------------------------------------
create table if not exists public.referral_events (
  id                       uuid primary key default gen_random_uuid(),
  referrer_user_id         uuid not null references auth.users(id) on delete cascade,
  referred_user_id         uuid not null references auth.users(id) on delete cascade,
  created_at               timestamptz not null default now(),
  signup_xp_awarded        boolean not null default false,
  enrollment_xp_awarded    boolean not null default false,
  constraint uq_referral_pair unique (referrer_user_id, referred_user_id),
  constraint ck_not_self_ref check (referrer_user_id <> referred_user_id)
);

create index if not exists ix_referral_events_referrer
  on public.referral_events (referrer_user_id, created_at desc);

create index if not exists ix_referral_events_referred
  on public.referral_events (referred_user_id);

-- RLS — backend uses service role, so deny by default and only allow read of
-- own-as-referrer rows.
alter table public.referral_events enable row level security;

drop policy if exists "own_referrer_select" on public.referral_events;
create policy "own_referrer_select"
  on public.referral_events
  for select to authenticated
  using (auth.uid() = referrer_user_id);

-- 3) Badge seeds ------------------------------------------------------------
-- Three milestone badges in the social/consistency family. Idempotent on code.
insert into public.master_badges (code, name, description, category, rarity, icon_slug, progress_target, criteria_json, display_order, bonus_xp)
values
  ('networker',    'Networker',    'Referred 5 friends to Valuevade — your network is growing.',     'social', 'rare',      'users',    5,  '{"metric":"referral_signups","threshold":5}'::jsonb,  300, 250),
  ('influencer',   'Influencer',   'Referred 15 friends — you''re shaping the community.',           'social', 'epic',      'megaphone', 15, '{"metric":"referral_signups","threshold":15}'::jsonb, 301, 750),
  ('talent_scout', 'Talent Scout', 'Referred 50 friends — legendary advocate for finance literacy.', 'social', 'legendary', 'sparkles', 50, '{"metric":"referral_signups","threshold":50}'::jsonb, 302, 2500)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    rarity = excluded.rarity,
    icon_slug = excluded.icon_slug,
    progress_target = excluded.progress_target,
    criteria_json = excluded.criteria_json;

commit;
