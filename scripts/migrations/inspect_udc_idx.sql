select indexname, indexdef from pg_indexes
 where schemaname='public' and tablename='user_daily_challenges';
