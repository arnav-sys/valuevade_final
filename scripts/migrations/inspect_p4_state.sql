-- Check existing P0 daily-challenges schema before extending in 0007.

select 'tables_present' as scope, table_name
  from information_schema.tables
 where table_schema='public'
   and table_name in ('master_daily_challenges','user_daily_challenges');

select 'master_dc_columns' as scope, column_name, data_type
  from information_schema.columns
 where table_schema='public' and table_name='master_daily_challenges'
 order by ordinal_position;

select 'user_dc_columns' as scope, column_name, data_type
  from information_schema.columns
 where table_schema='public' and table_name='user_daily_challenges'
 order by ordinal_position;

-- Existing CHECK constraints
select 'check_constraints' as scope,
       tc.table_name, tc.constraint_name, cc.check_clause
  from information_schema.table_constraints tc
  join information_schema.check_constraints cc on cc.constraint_name = tc.constraint_name
 where tc.table_schema='public'
   and tc.table_name in ('master_daily_challenges','user_daily_challenges');

select 'daily_champion_badge' as scope, code, criteria_json
  from public.master_badges where code='daily_champion';

select 'app_settings' as scope, key, value from public.app_settings where key='allow_dev_rpcs';

-- Existing rows
select 'master_dc_count' as scope, count(*) as n from public.master_daily_challenges;
