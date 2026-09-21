-- 0045_testimonials.sql — Persistent student testimonials (proof wall) for the landing.
-- Apply in Supabase Studio → SQL Editor. Idempotent (safe to re-run).

begin;

create extension if not exists "pgcrypto";

create table if not exists public.testimonials (
    id            uuid primary key default gen_random_uuid(),
    name          text not null,
    role          text not null default '',
    quote         text not null,
    order_index   integer not null default 100,
    is_published  boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists ix_testimonials_order on public.testimonials (order_index);

alter table public.testimonials enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
      where schemaname='public' and tablename='testimonials'
  loop execute format('drop policy if exists %I on public.testimonials', pol.policyname); end loop;
end$$;

create policy "testimonials_public_read"
  on public.testimonials for select to anon, authenticated
  using (is_published);

grant select on public.testimonials to anon, authenticated;
grant select, insert, update, delete on public.testimonials to service_role;

create unique index if not exists ux_testimonials_quote on public.testimonials (lower(quote));

insert into public.testimonials (name, role, quote, order_index) values
  ('Priya S.', 'CFA L1 Candidate, Delhi', 'Finally a platform that doesn''t just dump content at me. The roadmap showed me exactly what I was missing for my AM interviews.', 10),
  ('Arjun M.', 'MBA Finance, Mumbai', 'The job simulation for equity research was the closest thing to actual work I''d done before my internship. My interviewer was genuinely impressed.', 20),
  ('Tanvi R.', 'B.Com Final Year, Pune', 'I wasted 6 months on random YouTube courses. Valuevade gave me a clear path in 10 minutes.', 30),
  ('Karthik V.', 'Aspiring Risk Analyst, Bengaluru', 'The AI mock interview grilled me harder than my real interview did. By the time I sat in the actual room, nothing surprised me.', 40),
  ('Ananya D.', 'Non-finance grad, Hyderabad', 'I came from a non-finance background and still built a full DCF on Reliance. The capstone is now the best thing on my resume.', 50),
  ('Rahul B.', 'CA Inter, Jaipur', 'Practising on Ind AS statements and SEBI filings made the difference — my modelling finally looked like real deal work.', 60)
on conflict (lower(quote)) do nothing;

commit;

select 'testimonials_rows' as check, count(*) as value from public.testimonials;
