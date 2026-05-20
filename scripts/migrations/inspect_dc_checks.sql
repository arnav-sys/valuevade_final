select tc.constraint_name, cc.check_clause
  from information_schema.table_constraints tc
  join information_schema.check_constraints cc on cc.constraint_name = tc.constraint_name
 where tc.table_schema='public' and tc.table_name='master_daily_challenges';
