-- Wave 3 — Referral commission/earnings columns + admin overview helpers.
--
-- Adds payment-ready columns to referral_events. Payment processing isn't
-- live yet, so columns default to 0 and a placeholder commission_pct of 10%.

begin;

alter table public.referral_events
  add column if not exists commission_pct numeric(5,2) not null default 10.00;

alter table public.referral_events
  add column if not exists referred_user_revenue numeric(10,2) not null default 0;

-- Generated stored column for commission. PG14+ syntax.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'referral_events'
      and column_name = 'commission_amount'
  ) then
    alter table public.referral_events
      add column commission_amount numeric(10,2)
      generated always as (round(referred_user_revenue * commission_pct / 100.0, 2)) stored;
  end if;
end $$;

alter table public.referral_events
  add column if not exists payout_status text not null default 'pending'
  check (payout_status in ('pending','approved','paid'));

alter table public.referral_events
  add column if not exists paid_at timestamptz;

alter table public.referral_events
  add column if not exists notes text;

-- Idempotent RPC — bumps referred_user_revenue. Future payment flow calls this.
create or replace function public.update_referral_revenue(
  p_referred_user_id uuid,
  p_amount           numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount is null or p_amount <= 0 then
    return;
  end if;
  update public.referral_events
     set referred_user_revenue = referred_user_revenue + p_amount
   where referred_user_id = p_referred_user_id;
end $$;

revoke all on function public.update_referral_revenue(uuid, numeric) from public;
grant execute on function public.update_referral_revenue(uuid, numeric) to service_role;

commit;
