-- Wave 4 — Full payment processing schema (Razorpay-ready, mock-mode default).
-- Tables: pricing_tiers, user_payment_status, razorpay_orders, razorpay_payments,
--         payout_requests. + bumps referral commission default 10% → 20%.
-- Idempotent: safe to re-run.

begin;

create extension if not exists pgcrypto;

-- 1) pricing_tiers (seed table)
create table if not exists public.pricing_tiers (
  code         text primary key,
  amount_inr   integer not null check (amount_inr > 0),
  display_name text not null,
  description  text
);

insert into public.pricing_tiers(code, amount_inr, display_name, description)
values
  ('upfront',    1500, 'Pay Upfront',
   'Full lifetime access — locked in before the free session. Save ₹200.'),
  ('post_trial', 1700, 'Pay After Free Session',
   'Full lifetime access after you''ve sampled session #1.')
on conflict (code) do nothing;

-- 2) user_payment_status — one row per user
create table if not exists public.user_payment_status (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  paid               boolean not null default false,
  paid_amount_inr    integer not null default 0,
  paid_at            timestamptz,
  pricing_tier       text references public.pricing_tiers(code),
  free_session_used  boolean not null default false,
  created_at         timestamptz not null default now()
);

alter table public.user_payment_status enable row level security;

drop policy if exists ups_owner_select on public.user_payment_status;
create policy ups_owner_select on public.user_payment_status
  for select using (auth.uid() = user_id);

-- 3) razorpay_orders
create table if not exists public.razorpay_orders (
  id                 uuid primary key default gen_random_uuid(),
  razorpay_order_id  text unique,
  user_id            uuid not null references auth.users(id) on delete cascade,
  amount_inr         integer not null check (amount_inr > 0),
  pricing_tier       text not null references public.pricing_tiers(code),
  status             text not null default 'created'
                     check (status in ('created','attempted','paid','failed','cancelled')),
  mock_mode          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists razorpay_orders_user_id_idx on public.razorpay_orders(user_id);
create index if not exists razorpay_orders_status_idx on public.razorpay_orders(status);

-- 4) razorpay_payments
create table if not exists public.razorpay_payments (
  id                    uuid primary key default gen_random_uuid(),
  razorpay_payment_id   text unique,
  razorpay_order_id     text not null,
  user_id               uuid not null references auth.users(id) on delete cascade,
  amount_inr            integer not null check (amount_inr > 0),
  method                text,
  status                text not null check (status in ('captured','failed','refunded')),
  webhook_signature     text,
  raw_payload           jsonb,
  created_at            timestamptz not null default now()
);
create index if not exists razorpay_payments_user_id_idx on public.razorpay_payments(user_id);
create index if not exists razorpay_payments_order_idx on public.razorpay_payments(razorpay_order_id);

-- 5) payout_requests
create table if not exists public.payout_requests (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  amount_inr                integer not null check (amount_inr >= 500),
  payout_method             text not null check (payout_method in ('upi','bank_transfer')),
  payout_details_encrypted  text not null,
  status                    text not null default 'pending'
                            check (status in ('pending','approved','paid','rejected')),
  admin_notes               text,
  covers_event_ids          uuid[] not null default '{}',
  txn_reference             text,
  requested_at              timestamptz not null default now(),
  approved_at               timestamptz,
  paid_at                   timestamptz,
  rejected_at               timestamptz
);
create index if not exists payout_requests_user_id_idx on public.payout_requests(user_id);
create index if not exists payout_requests_status_idx on public.payout_requests(status);

alter table public.payout_requests enable row level security;
drop policy if exists pr_owner_select on public.payout_requests;
create policy pr_owner_select on public.payout_requests
  for select using (auth.uid() = user_id);

-- 6) referral_events — bump default commission from 10% → 20% + backfill
alter table public.referral_events
  alter column commission_pct set default 20.00;

update public.referral_events
   set commission_pct = 20.00
 where commission_pct = 10.00;

commit;
