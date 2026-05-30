-- Batch 3 (Item 2) — user_doubt_sessions.current_focus
--
-- Captures what the student is looking at the MOMENT they open Pari chat.
-- The FE computes this at click-time on each surface (notes/quiz/interview/
-- simulation) and passes it to /api/doubts/start (and /api/doubts/extended/
-- start). The backend persists it on the session row so that every turn in
-- the conversation can reference the same anchor without re-passing it.
--
-- Snippet is capped at 1500 chars on the FE side; this column is just JSONB
-- so any reasonable shape works. Typical payload:
--   {
--     "surface": "notes",
--     "module_id":  "<uuid>",
--     "session_id": "<uuid>",
--     "anchor": {
--       "type":    "card" | "heading" | "question" | "cell" | "selection",
--       "label":   "<heading / question / cell ref / selected text>",
--       "snippet": "<2-3 sentences of surrounding context>"
--     }
--   }

begin;

alter table public.user_doubt_sessions
  add column if not exists current_focus jsonb;

create index if not exists ix_user_doubt_sessions_current_focus
  on public.user_doubt_sessions ((current_focus->>'surface'))
  where current_focus is not null;

comment on column public.user_doubt_sessions.current_focus is
  'Batch 3 (Item 2) — Surface + anchor snapshot captured when the chat was opened.';

-- RLS owner-SELECT is already in place from migration 0008 (user_doubt_sessions).
-- The new column inherits the existing policy since we did not touch table-level
-- security. No additional policy needed.

commit;
