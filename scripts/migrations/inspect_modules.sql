select column_name, data_type
  from information_schema.columns
 where table_schema='public' and table_name in ('master_modules','user_modules','master_sessions','user_sessions','master_capstone_projects','user_capstone_projects')
 order by table_name, ordinal_position;
