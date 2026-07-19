-- 0034_app_settings.sql — Key/value settings store. Handles the case where
-- an older version of this table already exists with a different schema
-- (e.g. only had a `value` text column) — we ADD the missing columns
-- rather than silently skipping via `create table if not exists`.
--
-- Apply in Supabase Studio → SQL Editor. Idempotent (safe to re-run).

begin;

create extension if not exists "pgcrypto";

create table if not exists public.app_settings (
    key         text primary key,
    value_json  jsonb not null default '{}'::jsonb,
    updated_at  timestamptz not null default now()
);

-- Defensive: fill in columns on any pre-existing table shape.
alter table public.app_settings
    add column if not exists value_json jsonb not null default '{}'::jsonb;
alter table public.app_settings
    add column if not exists updated_at timestamptz not null default now();

-- Best-effort migrate any legacy `value` column into value_json, THEN drop
-- it so future inserts don't hit its (usually NOT NULL) constraint.
do $$
declare has_value_col boolean;
begin
    select exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='app_settings'
        and column_name='value'
    ) into has_value_col;
    if has_value_col then
        update public.app_settings
        set value_json = case
            when value_json = '{}'::jsonb and value is not null then
                jsonb_build_object('legacy_value', value::text)
            else value_json
        end;
        execute 'alter table public.app_settings drop column value';
    end if;
end$$;

alter table public.app_settings enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
      where schemaname='public' and tablename='app_settings'
  loop execute format('drop policy if exists %I on public.app_settings', pol.policyname); end loop;
end$$;

create policy "app_settings_public_read"
  on public.app_settings for select to anon, authenticated
  using (true);

grant select on public.app_settings to anon, authenticated;
grant select, insert, update, delete on public.app_settings to service_role;

-- Seed the AI customisation mode (only overwrites an empty row).
insert into public.app_settings (key, value_json)
values ('ai_customization_mode', '{"mode": "off"}'::jsonb)
on conflict (key) do update set value_json = excluded.value_json
    where public.app_settings.value_json = '{}'::jsonb;

commit;

select key, value_json, updated_at from public.app_settings;
