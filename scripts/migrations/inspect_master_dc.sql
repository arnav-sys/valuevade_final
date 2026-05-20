select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema='public' and table_name='master_daily_challenges'
 order by ordinal_position;
