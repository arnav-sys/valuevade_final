select schemaname, tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and tablename in ('user_badges','user_stats','user_xp_events','user_streak_events')
 order by tablename;
