-- 0044_faculty.sql — Persistent faculty/teacher profiles for the landing page.
-- Apply in Supabase Studio → SQL Editor. Idempotent (safe to re-run).

begin;

create extension if not exists "pgcrypto";

create table if not exists public.faculty (
    id            uuid primary key default gen_random_uuid(),
    name          text not null,
    title         text not null default '',
    bio           text not null default '',
    photo_url     text not null default '',
    order_index   integer not null default 100,
    is_published  boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists ix_faculty_order on public.faculty (order_index);

alter table public.faculty enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
      where schemaname='public' and tablename='faculty'
  loop execute format('drop policy if exists %I on public.faculty', pol.policyname); end loop;
end$$;

create policy "faculty_public_read"
  on public.faculty for select to anon, authenticated
  using (is_published);

grant select on public.faculty to anon, authenticated;
grant select, insert, update, delete on public.faculty to service_role;

-- Seed a few starter faculty (idempotent on lower(name)).
create unique index if not exists ux_faculty_name on public.faculty (lower(name));

insert into public.faculty (name, title, bio, photo_url, order_index) values
  ('Aarav Mehta', 'Lead Faculty · Equity Research · Ex-Buy Side', 'Former equity research analyst covering Indian financials and consumer. Builds every valuation module from real Ind AS filings — not textbook templates.', '', 10),
  ('Sneha Iyer', 'Financial Modelling · CFA Charterholder', 'Spent years building 3-statement and LBO models on the sell side. Leads the modelling and DCF curriculum with a first-principles approach.', '', 20),
  ('Rohan Kulkarni', 'Career & Interview Prep · Ex-IB', 'Ran analyst hiring at a boutique investment bank. Designs the mock-interview rounds, resume reviews and LinkedIn outreach playbooks.', '', 30)
on conflict (lower(name)) do nothing;

commit;

select 'faculty_rows' as check, count(*) as value from public.faculty;
