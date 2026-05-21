-- Probe FKs that could block user_modules / user_sessions deletes during
-- a re-enrollment (the symptom of "duplicate key" is the upstream delete
-- silently failing because Supabase JS doesn't throw on PostgREST errors).

select tc.table_name      as referencing_table,
       kcu.column_name    as referencing_column,
       ccu.table_name     as referenced_table,
       ccu.column_name    as referenced_column,
       rc.delete_rule
  from information_schema.referential_constraints rc
  join information_schema.table_constraints tc
    on tc.constraint_name = rc.constraint_name and tc.table_schema = rc.constraint_schema
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = rc.unique_constraint_name and ccu.table_schema = rc.unique_constraint_schema
 where ccu.table_name in ('user_enrollments','user_modules','user_sessions')
 order by ccu.table_name, tc.table_name;
