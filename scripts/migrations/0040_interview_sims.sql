-- 0040 — Module 20 Full Interview Simulations
-- 1) Flag interview modules on master_modules
-- 2) master_interview_sims: the 5 firm processes (seeded via scripts/seed_interview_sims.py)
-- 3) user_interview_attempts: one row per user × firm × attempt (max 2)

alter table public.master_modules
  add column if not exists is_interview_module boolean not null default false;

update public.master_modules
   set is_interview_module = true
 where id = '755956dd-51e8-47b9-8e22-fbbed253127a';

create table if not exists public.master_interview_sims (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.master_modules(id) on delete cascade,
  firm_slug text not null unique,
  firm_name text not null,
  firm_type text not null default 'global' check (firm_type in ('global','india')),
  role_title text not null,
  location text,
  salary_band text,
  about_md text,
  brand jsonb not null default '{}'::jsonb,
  process jsonb not null default '{}'::jsonb,
  case_config jsonb not null default '{}'::jsonb,
  order_index int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists master_interview_sims_module_idx
  on public.master_interview_sims (module_id, order_index);

create table if not exists public.user_interview_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sim_id uuid not null references public.master_interview_sims(id) on delete cascade,
  attempt_number int not null default 1 check (attempt_number between 1 and 2),
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  current_stage text not null default 'application'
    check (current_stage in ('application','aptitude','behavioural','technical','case_study','decision')),
  stage_data jsonb not null default '{}'::jsonb,
  final_score numeric,
  verdict text check (verdict in ('offer','rejected')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, sim_id, attempt_number)
);

create index if not exists user_interview_attempts_user_idx
  on public.user_interview_attempts (user_id, sim_id);

-- RLS
alter table public.master_interview_sims enable row level security;
alter table public.user_interview_attempts enable row level security;

drop policy if exists "interview sims readable" on public.master_interview_sims;
create policy "interview sims readable" on public.master_interview_sims
  for select to authenticated using (is_active = true);

drop policy if exists "own interview attempts readable" on public.user_interview_attempts;
create policy "own interview attempts readable" on public.user_interview_attempts
  for select to authenticated using (auth.uid() = user_id);

-- All writes go through the backend with service_role (bypasses RLS).
