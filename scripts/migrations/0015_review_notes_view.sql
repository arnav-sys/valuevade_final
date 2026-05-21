-- =============================================================================
-- Migration 0015 — Phase 57: Pari's Review Notes view
-- =============================================================================
--
-- Surfaces every assistant reply Pari has given the student as a study-card
-- ledger. Joins user_doubt_sessions + doubt_messages, pairs each assistant
-- message with the preceding user message (via LAG window function), and
-- resolves a human-friendly topic label from attempt_context.
-- =============================================================================

begin;

drop view if exists public.v_user_review_notes;

create view public.v_user_review_notes
with (security_invoker = true) as
with
paired as (
  -- LAG by created_at within each doubt_session to attach the previous user
  -- message to each assistant message.
  select
    dm.id,
    dm.doubt_session_id,
    dm.role,
    dm.content,
    dm.is_cached,
    dm.created_at,
    lag(dm.content) over (
      partition by dm.doubt_session_id
      order by dm.created_at, dm.id
    ) as prev_content,
    lag(dm.role) over (
      partition by dm.doubt_session_id
      order by dm.created_at, dm.id
    ) as prev_role
  from public.doubt_messages dm
)
select
  p.id,
  uds.user_id,
  p.doubt_session_id,
  uds.phase,
  uds.module_code,
  -- Best-available topic label:
  --   1. attempt_context.card_title (notes)
  --   2. attempt_context.question_text (quiz / interview)
  --   3. attempt_context.sim_brief (simulation)
  --   4. fallback: "<phase> in <module_code or session>"
  coalesce(
    nullif(uds.attempt_context->>'card_title', ''),
    nullif(uds.attempt_context->>'question_text', ''),
    nullif(uds.attempt_context->>'sim_brief', ''),
    case
      when uds.module_code is not null
        then initcap(uds.phase) || ' — ' || uds.module_code
      else initcap(uds.phase) || ' session'
    end
  ) as topic,
  -- Paired user question if the immediately-preceding message was a user turn.
  case when p.prev_role = 'user' then p.prev_content else null end as user_question,
  p.content as pari_answer,
  p.is_cached,
  p.created_at
from paired p
join public.user_doubt_sessions uds on uds.id = p.doubt_session_id
where p.role = 'assistant'
  and length(coalesce(p.content, '')) > 12
order by p.created_at desc;

comment on view public.v_user_review_notes is
  'Phase 57 — per-user "Pari''s Review Notes" study cabinet. security_invoker=true → RLS-aware; service-role bypass.';

commit;
