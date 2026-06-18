-- Wave 2 — Mock Interview capstone (3 rounds: technical, behavioral, fit)
--
-- 3 tables:
--   user_mock_interviews       — one row per attempt
--   mock_interview_turns       — every Q & A turn (interviewer + candidate)
--   user_mock_interview_scores — per-round scores after finalize

begin;

create table if not exists public.user_mock_interviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  status          text not null default 'in_progress'
                    check (status in ('in_progress', 'completed', 'abandoned')),
  current_round   int  not null default 1
                    check (current_round between 1 and 3),
  final_score     numeric(5,2),
  verdict         text check (verdict in ('pass', 'fail', 'strong_pass', 'marginal')),
  feedback_md     text,
  attempt_number  int  not null default 1,
  created_at      timestamptz not null default now()
);

create index if not exists ix_user_mock_interviews_user
  on public.user_mock_interviews (user_id, started_at desc);
create index if not exists ix_user_mock_interviews_status
  on public.user_mock_interviews (user_id, status);

-- Turn-by-turn transcript
create table if not exists public.mock_interview_turns (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references public.user_mock_interviews(id) on delete cascade,
  round         int  not null check (round between 1 and 3),
  turn_idx      int  not null,
  role          text not null check (role in ('interviewer', 'candidate')),
  content       text not null,
  input_method  text check (input_method in ('voice', 'text')),
  created_at    timestamptz not null default now()
);

create index if not exists ix_mock_turns_interview
  on public.mock_interview_turns (interview_id, round, turn_idx);

-- Per-round scoring
create table if not exists public.user_mock_interview_scores (
  interview_id      uuid not null references public.user_mock_interviews(id) on delete cascade,
  round             int  not null check (round between 1 and 3),
  round_name        text not null,
  score             numeric(5,2) not null,
  feedback_bullets  text[] not null default '{}',
  strengths         text[] default '{}',
  gaps              text[] default '{}',
  primary key (interview_id, round)
);

-- RLS
alter table public.user_mock_interviews       enable row level security;
alter table public.mock_interview_turns       enable row level security;
alter table public.user_mock_interview_scores enable row level security;

drop policy if exists "own_select_mi"          on public.user_mock_interviews;
drop policy if exists "own_select_mi_turns"    on public.mock_interview_turns;
drop policy if exists "own_select_mi_scores"   on public.user_mock_interview_scores;

create policy "own_select_mi"
  on public.user_mock_interviews
  for select to authenticated
  using (auth.uid() = user_id);

create policy "own_select_mi_turns"
  on public.mock_interview_turns
  for select to authenticated
  using (interview_id in (select id from public.user_mock_interviews where user_id = auth.uid()));

create policy "own_select_mi_scores"
  on public.user_mock_interview_scores
  for select to authenticated
  using (interview_id in (select id from public.user_mock_interviews where user_id = auth.uid()));

commit;
