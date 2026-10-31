-- Valuevade resources: support multiple files per resource, 50MB per file.
-- Additive, rerunnable; existing enterprise/resource data untouched.
begin;
create table if not exists public.resource_files (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.marketplace_resources(id) on delete cascade,
  file_path text not null, file_name text not null, file_size bigint not null, file_type text not null,
  created_at timestamptz not null default now()
);
create index if not exists resource_files_resource_idx on public.resource_files(resource_id);
alter table public.resource_files enable row level security;
revoke all on public.resource_files from anon, authenticated;
grant all on public.resource_files to service_role;
update storage.buckets set file_size_limit = 52428800 where id = 'paid-resources';
notify pgrst, 'reload schema';
commit;
