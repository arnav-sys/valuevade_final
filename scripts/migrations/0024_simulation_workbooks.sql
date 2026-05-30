-- Batch 5 — user_simulation_workbooks
-- Persists the per-user spreadsheet state for Excel simulations so they
-- can leave and come back without losing work. Mirrors the canonical
-- workbook shape produced by /app/frontend/src/components/simulations/
-- excelSimAdapter.js (sheets[].cells[]).

begin;

create table if not exists user_simulation_workbooks (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  master_simulation_id  uuid not null references master_simulations(id) on delete cascade,
  user_session_id       uuid references user_sessions(id) on delete cascade,
  workbook_state        jsonb not null,
  last_score            jsonb,
  status                text not null default 'in_progress'
                          check (status in ('in_progress', 'submitted')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint uq_user_sim_workbook unique (user_id, master_simulation_id, user_session_id)
);

create index if not exists ix_user_sim_workbooks_user_updated
  on user_simulation_workbooks (user_id, updated_at desc);

-- RLS: owner SELECT/UPDATE/INSERT. Service role bypasses for backend.
alter table user_simulation_workbooks enable row level security;

drop policy if exists "owner_select_user_simulation_workbooks" on user_simulation_workbooks;
create policy "owner_select_user_simulation_workbooks"
  on user_simulation_workbooks for select using (auth.uid() = user_id);

drop policy if exists "owner_insert_user_simulation_workbooks" on user_simulation_workbooks;
create policy "owner_insert_user_simulation_workbooks"
  on user_simulation_workbooks for insert with check (auth.uid() = user_id);

drop policy if exists "owner_update_user_simulation_workbooks" on user_simulation_workbooks;
create policy "owner_update_user_simulation_workbooks"
  on user_simulation_workbooks for update using (auth.uid() = user_id);

drop policy if exists "service_role_all_user_simulation_workbooks" on user_simulation_workbooks;
create policy "service_role_all_user_simulation_workbooks"
  on user_simulation_workbooks for all to service_role using (true) with check (true);

-- Touch updated_at on update.
create or replace function public.touch_user_sim_workbook_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_user_sim_workbook on user_simulation_workbooks;
create trigger trg_touch_user_sim_workbook
  before update on user_simulation_workbooks
  for each row execute function public.touch_user_sim_workbook_updated_at();

comment on table user_simulation_workbooks is
  'Batch 5 — Per-user persisted spreadsheet state for Excel simulations.';

commit;
