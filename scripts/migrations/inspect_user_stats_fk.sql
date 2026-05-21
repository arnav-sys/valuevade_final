-- Find the FK constraint name on user_stats.enrollment_id
select c.conname, pg_get_constraintdef(c.oid) as defn, c.confdeltype, a.attnotnull as enrollment_id_not_null
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
 where n.nspname='public' and t.relname='user_stats' and c.contype='f' and a.attname='enrollment_id';
