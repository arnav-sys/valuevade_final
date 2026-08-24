-- Migration 0041 — free landing-page mock interview trial
create table if not exists free_mock_trials (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  firm_slug text not null default 'jpmorgan',
  ip_hash text,
  fingerprint_hash text,
  user_agent text,
  attempt_id uuid,             -- fk to user_interview_attempts once started
  status text default 'started',  -- started / completed / rejected / abandoned
  verdict text,                    -- offer / rejected once decision made
  final_score int,
  stage_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  completed_at timestamptz,
  ref_source text,             -- utm/landing source
  unique (email)
);

create index if not exists idx_fmt_email        on free_mock_trials (email);
create index if not exists idx_fmt_ip_hash      on free_mock_trials (ip_hash);
create index if not exists idx_fmt_fingerprint  on free_mock_trials (fingerprint_hash);
create index if not exists idx_fmt_created      on free_mock_trials (created_at desc);
