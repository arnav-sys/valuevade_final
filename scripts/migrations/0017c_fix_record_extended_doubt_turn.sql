-- 0017c — fix record_extended_doubt_turn (drop nonexistent updated_at)
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
         end_reason  = case when v_ended then v_end_reason else end_reason end
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
