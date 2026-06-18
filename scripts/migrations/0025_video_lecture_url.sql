-- Wave 1 / Item 1B — video lecture URL column on master_sessions
--
-- The video-lecture tab UI ships in placeholder mode now. When the team
-- sources real lecture URLs, populating this column flips the tab from
-- "Coming soon" to a YouTube embed / HTML5 video player.

begin;

alter table public.master_sessions
  add column if not exists lecture_url text;

comment on column public.master_sessions.lecture_url is
  'Optional video lecture URL (YouTube embed or direct video). When null, the FE shows a "Coming soon" placeholder in the Video Lecture tab.';

commit;
