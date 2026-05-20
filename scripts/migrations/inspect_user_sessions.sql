-- Inspect user_sessions schema then probe data
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'user_sessions'
 order by ordinal_position;
