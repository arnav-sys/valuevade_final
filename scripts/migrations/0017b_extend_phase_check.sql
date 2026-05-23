-- 0017b — extend phase check on user_doubt_sessions to include 'extended_doubt'
alter table public.user_doubt_sessions
  drop constraint if exists user_doubt_sessions_phase_check;

alter table public.user_doubt_sessions
  add constraint user_doubt_sessions_phase_check
  check (phase in (
    'notes','quiz','interview','simulation',
    'project','capstone','dashboard','module_complete',
    'extended_doubt'
  ));
