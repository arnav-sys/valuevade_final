-- =============================================================================
-- Migration 0017 — Phase B: Session Doubts + Extended Pari Re-do Chat
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A. user_session_doubts — one open doubt per (user, session)
-- ---------------------------------------------------------------------------
create table if not exists public.user_session_doubts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  session_id   uuid not null references public.user_sessions(id) on delete cascade,
  module_id    text not null,
  reason       text not null check (reason in ('doubt','difficult')),
  status       text not null default 'open' check (status in ('open','resolved')),
  redo_count   int  not null default 0,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create unique index if not exists ux_user_session_doubts_user_session
  on public.user_session_doubts (user_id, session_id);

create index if not exists idx_user_session_doubts_user_status_created
  on public.user_session_doubts (user_id, status, created_at desc);

alter table public.user_session_doubts enable row level security;

drop policy if exists user_session_doubts_select_own on public.user_session_doubts;
create policy user_session_doubts_select_own on public.user_session_doubts
  for select using (auth.uid() = user_id);

drop policy if exists user_session_doubts_update_own on public.user_session_doubts;
create policy user_session_doubts_update_own on public.user_session_doubts
  for update using (auth.uid() = user_id);

-- INSERT only via service role (backend) — keeps session-ownership validation
-- centralised in the API.

-- ---------------------------------------------------------------------------
-- B. user_doubt_sessions — add extended-chat columns
-- ---------------------------------------------------------------------------
alter table public.user_doubt_sessions
  add column if not exists kind text not null default 'quick'
    check (kind in ('quick','extended'));

alter table public.user_doubt_sessions
  add column if not exists linked_session_doubt_id uuid
    references public.user_session_doubts(id) on delete set null;

create index if not exists idx_user_doubt_sessions_user_kind_created
  on public.user_doubt_sessions (user_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- C. user_xp_events — partial unique index for redo dedupe
-- One doubt × one redo_count can earn redo XP at most once per reason.
-- ---------------------------------------------------------------------------
create unique index if not exists ux_user_xp_events_redo_dedup
  on public.user_xp_events (
    user_id,
    ((meta->>'redo_doubt_id')),
    ((meta->>'redo_count')),
    reason
  )
  where meta ? 'redo_doubt_id';

-- ---------------------------------------------------------------------------
-- D. start_extended_doubt_session(uuid, uuid)
-- Daily quota: 3 extended sessions per user per IST day.
-- ---------------------------------------------------------------------------
create or replace function public.start_extended_doubt_session(
  p_user_id           uuid,
  p_session_doubt_id  uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_today    date := (now() at time zone 'Asia/Kolkata')::date;
  v_count    int;
  v_doubt    record;
  v_session  record;
  v_id       uuid;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'start_extended_doubt_session: caller % cannot act for %', v_caller, p_user_id
      using errcode = '42501';
  end if;

  -- Validate the session_doubt exists and belongs to the user.
  select * into v_doubt from public.user_session_doubts
    where id = p_session_doubt_id and user_id = p_user_id;
  if not found then
    raise exception 'start_extended_doubt_session: doubt % not found for user %', p_session_doubt_id, p_user_id
      using errcode = '02000';
  end if;

  -- Daily quota — only count extended sessions for today.
  select count(*) into v_count
    from public.user_doubt_sessions
   where user_id = p_user_id and ist_date = v_today and kind = 'extended';

  if v_count >= 3 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota_exhausted',
      'sessions_today', v_count,
      'limit', 3
    );
  end if;

  -- Pull the underlying user_session to anchor the chat context.
  select us.user_module_id, um.master_module_id into v_session
    from public.user_sessions us
    join public.user_modules um on um.id = us.user_module_id
   where us.id = v_doubt.session_id;

  insert into public.user_doubt_sessions (
    user_id, course_session_id, phase, module_code, ist_date,
    kind, linked_session_doubt_id
  )
  values (
    p_user_id, v_doubt.session_id, 'extended_doubt', v_doubt.module_id, v_today,
    'extended', p_session_doubt_id
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'doubt_session_id', v_id,
    'turns_remaining', 15,
    'daily_remaining', 3 - (v_count + 1),
    'session_id', v_doubt.session_id,
    'module_id', v_doubt.module_id
  );
end;
$$;

grant execute on function public.start_extended_doubt_session(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- E. record_extended_doubt_turn(uuid, text, text, int, int)
-- Like record_doubt_turn but with a 15-turn cap and no token budget gate.
-- ---------------------------------------------------------------------------
create or replace function public.record_extended_doubt_turn(
  p_doubt_session_id    uuid,
  p_user_msg            text,
  p_assistant_msg       text,
  p_user_tokens         int default 0,
  p_assistant_tokens    int default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller    uuid := auth.uid();
  v_row       public.user_doubt_sessions%rowtype;
  v_new_turn  int;
  v_ended     bool := false;
  v_end_reason text;
begin
  select * into v_row from public.user_doubt_sessions where id = p_doubt_session_id;
  if not found then
    raise exception 'record_extended_doubt_turn: unknown session %', p_doubt_session_id using errcode = '02000';
  end if;
  if v_caller is not null and v_caller <> v_row.user_id then
    raise exception 'record_extended_doubt_turn: caller % cannot act for %', v_caller, v_row.user_id using errcode = '42501';
  end if;
  if v_row.kind <> 'extended' then
    raise exception 'record_extended_doubt_turn: session % is not an extended-doubt session', p_doubt_session_id using errcode = '22023';
  end if;
  if v_row.ended_at is not null then
    raise exception 'record_extended_doubt_turn: session already ended (reason: %)', v_row.end_reason using errcode = '22023';
  end if;

  v_new_turn := v_row.turn_count + 1;

  insert into public.doubt_messages (doubt_session_id, role, content, tokens, is_cached)
  values (p_doubt_session_id, 'user', p_user_msg, p_user_tokens, false);
  insert into public.doubt_messages (doubt_session_id, role, content, tokens, is_cached)
  values (p_doubt_session_id, 'assistant', p_assistant_msg, p_assistant_tokens, false);

  if v_new_turn >= 15 then
    v_ended := true;
    v_end_reason := 'turn_cap_reached';
  end if;

  update public.user_doubt_sessions
     set turn_count = v_new_turn,
         tokens_used = coalesce(tokens_used,0) + p_user_tokens + p_assistant_tokens,
         ended_at    = case when v_ended then now() else ended_at end,
         end_reason  = case when v_ended then v_end_reason else end_reason end,
         updated_at  = now()
   where id = p_doubt_session_id;

  return jsonb_build_object(
    'ok', true,
    'turn_count', v_new_turn,
    'turns_remaining', greatest(0, 15 - v_new_turn),
    'session_ended', v_ended,
    'end_reason', v_end_reason
  );
end;
$$;

grant execute on function public.record_extended_doubt_turn(uuid, text, text, int, int) to authenticated, service_role;

commit;
