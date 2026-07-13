-- 0032_drop_referrals.sql — Nuke the user-referral system (Feb 2026).
-- The user opted to remove all logged-in referral surfaces + drop data.
-- Waitlist referrals (on public.waitlist) are UNAFFECTED — they live in
-- a different table and remain fully functional.
--
-- Apply in Supabase Studio → SQL Editor.
-- This is idempotent (safe to re-run).

begin;

-- 1) Drop payout_requests first (only referenced by payout admin flow).
drop table if exists public.payout_requests cascade;

-- 2) Drop referral_events (and any policies/indexes hanging off it).
drop table if exists public.referral_events cascade;

-- 3) Drop helper RPCs.
drop function if exists public.update_referral_revenue(uuid, numeric);
drop function if exists public.gen_referral_code();

-- 4) Drop the profile columns added by 0026.
alter table public.profiles drop column if exists referral_code;
alter table public.profiles drop column if exists referred_by_user_id;
alter table public.profiles drop column if exists payment_commission_enabled;

-- 5) Drop the 3 referral-milestone badges. Cascade removes any user_badges
--    rows tied to them.
delete from public.user_badges
 where badge_id in (
    select id from public.master_badges
     where code in ('networker', 'influencer', 'talent_scout')
 );

delete from public.master_badges
 where code in ('networker', 'influencer', 'talent_scout');

-- 6) Clean any XP events awarded through the referral flow (reason keys used
--    by 0026-0029). Keep other user_xp_events intact.
delete from public.user_xp_events
 where reason in ('referral_signup', 'referral_enrollment', 'referral_commission');

commit;

-- Sanity summary
select 'profiles.referral_code_exists' as check,
       exists(
         select 1 from information_schema.columns
          where table_schema='public' and table_name='profiles'
            and column_name='referral_code'
       ) as still_present
union all
select 'referral_events_table_exists',
       exists(select 1 from information_schema.tables
               where table_schema='public' and table_name='referral_events')
union all
select 'payout_requests_table_exists',
       exists(select 1 from information_schema.tables
               where table_schema='public' and table_name='payout_requests')
union all
select 'referral_badges_left',
       exists(select 1 from public.master_badges
               where code in ('networker','influencer','talent_scout'));
-- Expected: all four should return false.
