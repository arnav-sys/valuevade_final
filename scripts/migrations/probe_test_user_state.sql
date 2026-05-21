-- Non-destructive: confirm the test user has exactly one enrollment row and
-- user_stats is wired to it (post-refactor it MUST survive a re-enrollment).

select 'enrollments' as table_,
       count(*) as rows,
       array_agg(distinct status) as statuses
  from public.user_enrollments
 where user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid;

select 'user_stats_link' as table_,
       us.user_id is not null as has_stats_row,
       us.enrollment_id is not null as has_enrollment_fk,
       us.total_xp,
       us.daily_champion_glow_until > now() as champion_active
  from public.user_stats us
 where us.user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid;

select 'user_modules' as table_,
       count(*) as rows
  from public.user_modules um
  join public.user_enrollments ue on ue.id = um.enrollment_id
 where ue.user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid;
