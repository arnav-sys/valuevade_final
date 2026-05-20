select c.conname as constraint_name, pg_get_constraintdef(c.oid) as defn
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
 where n.nspname='public' and t.relname='master_daily_challenges' and c.contype='c';
