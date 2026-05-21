-- =============================================================================
-- Migration 0012 — Doubts Session (Phase 52)
-- =============================================================================
--
-- Tables:
--   user_doubt_sessions  : one row per doubt thread (max 5 per user per IST day)
--   doubt_messages       : ledger of every user + assistant message in a thread
--   doubt_qa_cache       : global FAQ cache keyed on normalised question hash +
--                          module scope; populated by the backend after each
--                          fresh LLM call, hit by future identical questions
--
-- RPCs:
--   start_doubt_session         : daily-quota-aware insert (gate at 5/day)
--   end_doubt_session           : idempotent close with reason
--   record_doubt_turn           : append user+assistant message rows, update
--                                 counters, auto-end on turn/token/strike caps
--   dev_reset_daily_doubts      : gated dev RPC for tester quota reset
--
-- Idempotent; safe to re-run.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A. user_doubt_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.user_doubt_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  course_session_id     uuid null references public.user_sessions(id) on delete set null,
  phase                 text not null check (phase in (
                          'notes','quiz','interview','simulation',
                          'project','capstone','dashboard','module_complete'
                        )),
  module_code           text null,
  ist_date              date not null default ((now() at time zone 'Asia/Kolkata')::date),
  turn_count            int  not null default 0,
  off_topic_strikes     int  not null default 0,
  tokens_used           int  not null default 0,
  cache_hits            int  not null default 0,
  started_at            timestamptz not null default now(),
  ended_at              timestamptz null,
  end_reason            text null check (end_reason in (
                          'turn_cap_reached','off_topic_kicked','manual_end',
                          'quota_exhausted','error','timeout'
                        )),
  created_at            timestamptz not null default now()
);

create index if not exists idx_user_doubt_sessions_user_ist on public.user_doubt_sessions(user_id, ist_date);
create index if not exists idx_user_doubt_sessions_user_started on public.user_doubt_sessions(user_id, started_at desc);

alter table public.user_doubt_sessions enable row level security;

drop policy if exists user_doubt_sessions_select_own on public.user_doubt_sessions;
create policy user_doubt_sessions_select_own on public.user_doubt_sessions
  for select using (auth.uid() = user_id);

drop policy if exists user_doubt_sessions_insert_own on public.user_doubt_sessions;
create policy user_doubt_sessions_insert_own on public.user_doubt_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists user_doubt_sessions_update_own on public.user_doubt_sessions;
create policy user_doubt_sessions_update_own on public.user_doubt_sessions
  for update using (auth.uid() = user_id);

-- No delete policy (DELETE blocked for end users; service role bypasses RLS).

-- ---------------------------------------------------------------------------
-- B. doubt_messages
-- ---------------------------------------------------------------------------
create table if not exists public.doubt_messages (
  id                  uuid primary key default gen_random_uuid(),
  doubt_session_id    uuid not null references public.user_doubt_sessions(id) on delete cascade,
  role                text not null check (role in ('user','assistant','system')),
  content             text not null,
  tokens              int  not null default 0,
  is_cached           boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists idx_doubt_messages_session_created on public.doubt_messages(doubt_session_id, created_at);

alter table public.doubt_messages enable row level security;

drop policy if exists doubt_messages_select_own on public.doubt_messages;
create policy doubt_messages_select_own on public.doubt_messages
  for select using (
    exists (
      select 1 from public.user_doubt_sessions s
       where s.id = doubt_messages.doubt_session_id and s.user_id = auth.uid()
    )
  );

-- Inserts go through the service-role RPC; end users don't INSERT directly.

-- ---------------------------------------------------------------------------
-- C. doubt_qa_cache  (backend-only; users never read this directly)
-- ---------------------------------------------------------------------------
create table if not exists public.doubt_qa_cache (
  id                     uuid primary key default gen_random_uuid(),
  question_hash          text not null,
  normalized_question    text not null,
  answer                 text not null,
  module_code            text null,
  tokens_at_creation     int  not null,
  reused_count           int  not null default 0,
  last_reused_at         timestamptz null,
  created_at             timestamptz not null default now()
);

-- Unique on (hash, module_scope) — coalesce to '' so the index treats nulls
-- as a distinct scope rather than collapsing all null rows into one key.
create unique index if not exists ux_doubt_qa_cache_hash_module
  on public.doubt_qa_cache(question_hash, coalesce(module_code, ''));

create index if not exists idx_doubt_qa_cache_hash on public.doubt_qa_cache(question_hash);

alter table public.doubt_qa_cache enable row level security;

-- No SELECT policy for end users — service role bypasses RLS so backend reads work.
-- Without a permissive policy, authenticated users get 0 rows on direct REST read.

-- ---------------------------------------------------------------------------
-- D. start_doubt_session(uuid, text, uuid, text)
-- ---------------------------------------------------------------------------
create or replace function public.start_doubt_session(
  p_user_id            uuid,
  p_phase              text,
  p_course_session_id  uuid default null,
  p_module_code        text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
  v_count  int;
  v_id     uuid;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'start_doubt_session: caller % cannot act for %', v_caller, p_user_id
      using errcode = '42501';
  end if;

  select count(*) into v_count
    from public.user_doubt_sessions
   where user_id = p_user_id and ist_date = v_today;

  if v_count >= 5 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota_exhausted',
      'sessions_today', v_count,
      'limit', 5
    );
  end if;

  insert into public.user_doubt_sessions
    (user_id, course_session_id, phase, module_code, ist_date)
  values (p_user_id, p_course_session_id, p_phase, p_module_code, v_today)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'doubt_session_id', v_id,
    'turns_left', 3,
    'tokens_left', 1500,
    'sessions_left_today', 5 - (v_count + 1)
  );
end;
$$;

grant execute on function public.start_doubt_session(uuid, text, uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- E. end_doubt_session(uuid, text)  — idempotent
-- ---------------------------------------------------------------------------
create or replace function public.end_doubt_session(
  p_doubt_session_id uuid,
  p_reason           text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_row    public.user_doubt_sessions%rowtype;
begin
  select * into v_row from public.user_doubt_sessions where id = p_doubt_session_id;
  if not found then
    raise exception 'end_doubt_session: unknown session %', p_doubt_session_id using errcode = '02000';
  end if;
  if v_caller is not null and v_caller <> v_row.user_id then
    raise exception 'end_doubt_session: caller % cannot act for %', v_caller, v_row.user_id using errcode = '42501';
  end if;
  if p_reason not in ('turn_cap_reached','off_topic_kicked','manual_end','quota_exhausted','error','timeout') then
    raise exception 'end_doubt_session: invalid reason %', p_reason using errcode = '22023';
  end if;
  if v_row.ended_at is not null then
    return jsonb_build_object('ok', true, 'already_ended', true,
                              'ended_at', v_row.ended_at, 'end_reason', v_row.end_reason);
  end if;
  update public.user_doubt_sessions
     set ended_at = now(), end_reason = p_reason
   where id = p_doubt_session_id;
  return jsonb_build_object('ok', true, 'already_ended', false, 'end_reason', p_reason);
end;
$$;

grant execute on function public.end_doubt_session(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- F. record_doubt_turn(uuid, text, text, int, int, bool, bool)
-- ---------------------------------------------------------------------------
create or replace function public.record_doubt_turn(
  p_doubt_session_id uuid,
  p_user_msg         text,
  p_assistant_msg    text,
  p_user_tokens      int,
  p_assistant_tokens int,
  p_is_cached        boolean,
  p_off_topic        boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller       uuid := auth.uid();
  v_row          public.user_doubt_sessions%rowtype;
  v_new_turn     int;
  v_new_tokens   int;
  v_new_strikes  int;
  v_new_hits     int;
  v_ended        boolean := false;
  v_end_reason   text := null;
  v_turns_left   int;
  v_tokens_left  int;
begin
  select * into v_row from public.user_doubt_sessions where id = p_doubt_session_id;
  if not found then
    raise exception 'record_doubt_turn: unknown session %', p_doubt_session_id using errcode = '02000';
  end if;
  if v_caller is not null and v_caller <> v_row.user_id then
    raise exception 'record_doubt_turn: caller % cannot act for %', v_caller, v_row.user_id using errcode = '42501';
  end if;
  if v_row.ended_at is not null then
    raise exception 'record_doubt_turn: session already ended at %', v_row.ended_at using errcode = '22023';
  end if;

  insert into public.doubt_messages (doubt_session_id, role, content, tokens, is_cached)
  values (p_doubt_session_id, 'user',      coalesce(p_user_msg, ''),      coalesce(p_user_tokens, 0),      false),
         (p_doubt_session_id, 'assistant', coalesce(p_assistant_msg, ''), coalesce(p_assistant_tokens, 0), coalesce(p_is_cached, false));

  v_new_turn    := v_row.turn_count + 1;
  v_new_tokens  := v_row.tokens_used + coalesce(p_user_tokens, 0) + coalesce(p_assistant_tokens, 0);
  v_new_strikes := v_row.off_topic_strikes + case when coalesce(p_off_topic, false) then 1 else 0 end;
  v_new_hits    := v_row.cache_hits + case when coalesce(p_is_cached, false) then 1 else 0 end;

  if v_new_strikes >= 2 then
    v_ended := true; v_end_reason := 'off_topic_kicked';
  elsif v_new_turn >= 3 then
    v_ended := true; v_end_reason := 'turn_cap_reached';
  elsif v_new_tokens >= 1500 then
    v_ended := true; v_end_reason := 'turn_cap_reached';
  end if;

  update public.user_doubt_sessions
     set turn_count        = v_new_turn,
         tokens_used       = v_new_tokens,
         off_topic_strikes = v_new_strikes,
         cache_hits        = v_new_hits,
         ended_at          = case when v_ended then now() else ended_at end,
         end_reason        = case when v_ended then v_end_reason else end_reason end
   where id = p_doubt_session_id;

  v_turns_left  := greatest(0, 3 - v_new_turn);
  v_tokens_left := greatest(0, 1500 - v_new_tokens);

  return jsonb_build_object(
    'ok', true,
    'turn_count', v_new_turn,
    'off_topic_strikes', v_new_strikes,
    'tokens_used', v_new_tokens,
    'cache_hits', v_new_hits,
    'turns_left', v_turns_left,
    'tokens_left', v_tokens_left,
    'session_ended', v_ended,
    'end_reason', v_end_reason
  );
end;
$$;

grant execute on function public.record_doubt_turn(uuid, text, text, int, int, boolean, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- G. dev_reset_daily_doubts(uuid)  — gated by app_settings.allow_dev_rpcs
-- ---------------------------------------------------------------------------
create or replace function public.dev_reset_daily_doubts(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow boolean := false;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_count int;
begin
  select (value::text = 'true') into v_allow from public.app_settings where key = 'allow_dev_rpcs' limit 1;
  if not v_allow then
    raise exception 'dev_reset_daily_doubts: dev RPCs disabled' using errcode = '42501';
  end if;
  update public.user_doubt_sessions
     set ended_at = coalesce(ended_at, now()),
         end_reason = coalesce(end_reason, 'manual_end'),
         ist_date = v_today - interval '1 day'
   where user_id = p_user_id and ist_date = v_today;
  get diagnostics v_count = row_count;
  return jsonb_build_object('reset', v_count, 'today_ist', v_today);
end;
$$;

grant execute on function public.dev_reset_daily_doubts(uuid) to authenticated, service_role;

commit;
