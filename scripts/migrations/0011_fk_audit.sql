-- =============================================================================
-- Migration 0011 — Read-only FK CASCADE audit (Phase 50)
-- =============================================================================
--
-- Enumerates every ON DELETE CASCADE foreign key in the database whose
-- referenced table is in the gamification graph (or auth.users / profiles
-- upstream of it). Returns nothing changed; this is a SELECT-only audit.
--
-- Safe / idempotent. Re-running is a no-op.
-- =============================================================================

with cascade_fks as (
  select
    c.conname                                                       as constraint_name,
    cl_src.relnamespace::regnamespace::text || '.' || cl_src.relname as table_with_fk,
    a_src.attname                                                   as column_with_fk,
    cl_tgt.relnamespace::regnamespace::text || '.' || cl_tgt.relname as references_table,
    a_tgt.attname                                                   as references_column,
    case c.confdeltype
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'd' then 'SET DEFAULT'
      when 'r' then 'RESTRICT'
      when 'a' then 'NO ACTION'
      else c.confdeltype::text
    end                                                             as on_delete,
    case c.confupdtype
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'd' then 'SET DEFAULT'
      when 'r' then 'RESTRICT'
      when 'a' then 'NO ACTION'
      else c.confupdtype::text
    end                                                             as on_update
  from pg_constraint c
  join pg_class cl_src on cl_src.oid = c.conrelid
  join pg_class cl_tgt on cl_tgt.oid = c.confrelid
  -- Expand multi-column FKs row-per-column. Most gamification FKs are
  -- single-column but this stays correct for any future composite key.
  cross join lateral unnest(c.conkey, c.confkey) with ordinality as cols(src_col, tgt_col, ord)
  join pg_attribute a_src
    on a_src.attrelid = c.conrelid and a_src.attnum = cols.src_col
  join pg_attribute a_tgt
    on a_tgt.attrelid = c.confrelid and a_tgt.attnum = cols.tgt_col
  where c.contype = 'f'
    and c.confdeltype = 'c'
)
select
  constraint_name,
  table_with_fk,
  column_with_fk,
  references_table,
  references_column,
  on_delete,
  on_update
from cascade_fks
where references_table in (
    'public.user_enrollments',
    'public.user_stats',
    'public.user_xp_events',
    'public.user_streak_events',
    'public.user_badges',
    'public.user_daily_challenges',
    'public.user_daily_activity',
    'public.user_modules',
    'public.user_sessions',
    'public.user_module_projects',
    'public.user_capstone_projects',
    'public.profiles',
    'auth.users'
  )
order by references_table, table_with_fk, column_with_fk;
