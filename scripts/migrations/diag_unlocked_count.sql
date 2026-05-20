select count(*) filter (where is_unlocked = true)                            as is_unlocked_true,
       count(*) filter (where is_unlocked = true and earned_at is not null) as both_true,
       count(*) filter (where earned_at is not null)                        as earned_at_not_null,
       count(*) filter (where is_unlocked = true and earned_at is null)     as drift_rows
  from public.user_badges
 where user_id = '13a690c4-96d7-4827-8117-fde4f696e999'::uuid;
