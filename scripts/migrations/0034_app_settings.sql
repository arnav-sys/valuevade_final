-- 0034_app_settings.sql — Simple key/value store for admin-toggleable
-- runtime flags. Seeds the AI customisation mode toggle.
--
-- Apply in Supabase Studio → SQL Editor. Idempotent (safe to re-run).

begin;

create extension if not exists "pgcrypto";

create table if not exists public.app_settings (
    key         text primary key,
    value_json  jsonb not null default '{}'::jsonb,
    updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
      where schemaname='public' and tablename='app_settings'
  loop execute format('drop policy if exists %I on public.app_settings', pol.policyname); end loop;
end$$;

-- Anon + authenticated can read (frontend needs to know the AI mode to
-- decide whether to show the "Customise with AI" button on the enrollment
-- page). Writes go through the backend service_role only.
create policy "app_settings_public_read"
  on public.app_settings for select to anon, authenticated
  using (true);

grant select on public.app_settings to anon, authenticated;
grant select, insert, update, delete on public.app_settings to service_role;

-- Seed the AI customisation mode:
--   'off'       -> only the standard one-click enrol button shows
--   'optional'  -> both one-click AND "customise with AI" buttons show
--   'mandatory' -> only the "customise with AI" flow, no one-click
insert into public.app_settings (key, value_json)
values ('ai_customization_mode', '{"mode": "off"}'::jsonb)
on conflict (key) do nothing;

commit;

select * from public.app_settings;
