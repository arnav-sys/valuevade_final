# Test Credentials

## Admin Dashboard (/referral)
- Email: info@valuevade.com
- Password: aa1aa2sam3

## Supabase Test User (use for any gamification / learning flow QA)
- Email: testagent2026@gmail.com
- Password: TestPass123!
- Name: Test Agent User

Notes for testing agent:
- Frontend URL: read REACT_APP_BACKEND_URL from /app/frontend/.env (do NOT hardcode).
- Backend health: GET /api/ returns {"message":"Valuevade API"}.
- This Supabase test user already has an enrollment seeded so the dashboard /
  modules / sessions render. Use it for end-to-end flows.


## Test user UUID & badge engine notes (Phase 45)
- Supabase user_id: `13a690c4-96d7-4827-8117-fde4f696e999`
- After Phase 45 wiring, first authenticated load fires the one-time
  `p3_catchup` evaluator (persisted via `user_stats.p3_catchup_done`). For the
  seeded test user this is a no-op (already at 7/23; remaining 16 need
  milestones they haven't hit yet).
- Dev-only RPC for overlay rarity rendering (gated by
  `app_settings.allow_dev_rpcs='true'`):
    `select public.dev_force_unlock_badge('<user_id>'::uuid, 'first_blood');`
  Available badge codes: see `select code, rarity from public.master_badges
  order by display_order;`. Calling the RPC enqueues a real unlock through
  `evaluate_badges` so the celebration overlay + sound + queue gap fire end-to-end.
- Health endpoint: `GET /api/health/badges?user_id=<uuid>` returns counts by
  rarity & category, `p3_catchup_done`, near-miss top-5, recent unlocked top-10.

## Phase 45 fix-pass — reset state for Bug 2 retest (May 2026)

The test user has exactly ONE session ("Time Value of Money",
`5e0c2a88-d864-4827-9a95-5aedd8d27ffd`). Its quiz state has been reset to
fresh (`quiz_completed=false, is_completed=false, quiz_score=null`) so the
tester can exercise the fresh-quiz XP path. To reset again later:

```sql
update public.user_sessions
   set quiz_completed=false, is_completed=false, quiz_score=null, completed_at=null
 where id = '5e0c2a88-d864-4827-9a95-5aedd8d27ffd';
```

## Bug 1 retest — overlay celebration (Phase 45 fix-pass)

The BadgeContext now subscribes to `postgres_changes` on `public.user_badges`
filtered by `user_id`. ANY write that flips `is_unlocked` `false→true` fires
the overlay. To validate:

```sql
-- Force unlock; the celebration must appear within 1-2 seconds.
select public.dev_force_unlock_badge(
  '13a690c4-96d7-4827-8117-fde4f696e999'::uuid,
  'sprint_quiz'
);

-- Cleanup pattern — set BOTH columns together so /api/health/badges doesn't drift:
update public.user_badges
   set is_unlocked=false, earned_at=null, progress_current=0
 where user_id='13a690c4-96d7-4827-8117-fde4f696e999'::uuid
   and badge_id=(select id from public.master_badges where code='sprint_quiz');
```

Invariant: `is_unlocked` and `earned_at` must move together. The
`/api/health/badges` endpoint counts only rows where both are non-null.

## Phase 46 — Daily Challenges + Daily Champion (May 2026)

### Today's fresh test pick (prepped via prep_p4_tester.sql)

Test user `13a690c4-96d7-4827-8117-fde4f696e999` has these 3 fresh
`user_daily_challenges` rows for today's IST date (codes will rotate on
`dev_reset_daily_challenges` + re-pick):

| code               | type                      | target | XP  |
|--------------------|---------------------------|--------|-----|
| daily_notes_1      | notes_completed           | 1      | +10 |
| daily_quiz_3       | quiz_questions_answered   | 3      | +10 |
| daily_quiz_perfect | quiz_score_threshold      | 80     | +20 |

Daily Champion badge has been reverted so it can unlock fresh during the test pass.

### Test recipe — Daily Champion flow (no UI play-through needed)

```sql
-- Resets today's picks AND clears the 24-hr glow window.
select public.dev_reset_daily_challenges(
  '13a690c4-96d7-4827-8117-fde4f696e999'::uuid
);

-- Optionally inspect what was just picked:
select public.pick_daily_challenges(
  '13a690c4-96d7-4827-8117-fde4f696e999'::uuid
);

-- Force-complete all 3. The 3rd call returns:
--   {daily_champion_triggered: true,
--    badges: {newly_unlocked: [{code:"daily_champion", rarity:"rare", ...}]}}
-- and atomically:
--  • awards +75 XP (daily_champion_bonus)
--  • sets user_stats.daily_champion_glow_until = now() + 24h
--  • fires evaluate_badges → unlocks daily_champion badge (also surfaces
--    in the BadgeUnlockOverlay via the realtime subscription).
select public.dev_force_complete_daily_challenge(
  '13a690c4-96d7-4827-8117-fde4f696e999'::uuid, 'daily_notes_1');
select public.dev_force_complete_daily_challenge(
  '13a690c4-96d7-4827-8117-fde4f696e999'::uuid, 'daily_quiz_3');
select public.dev_force_complete_daily_challenge(
  '13a690c4-96d7-4827-8117-fde4f696e999'::uuid, 'daily_quiz_perfect');
```

Caveat: if a `dev_force_complete_daily_challenge` is called with a code that
is NOT in today's pick, it inserts a fresh `user_daily_challenges` row for
that code so the call still goes through the canonical update funnel. This
means the Dashboard card can show more than 3 entries during a manual test.
For a clean test, use the codes returned by `pick_daily_challenges`.

## Phase 47 — Constellation Map + Activity Heatmap + Session Summary

- Dashboard now shows `<ModuleConstellationMap />` between Daily Challenges and Stats.
- `/journey` route shows the fullscreen variant.
- Profile shows `<ActivityHeatmap />` below the Badge Cabinet (90-day grid, IST-anchored).
- SessionCompletePage shows `<SessionCompleteSummaryCard />` between phase scores and module callout.
- `GET /api/health/journey?user_id=<uuid>` returns `{modules, heatmap, next_milestone, today_ist}`.

Test user `13a690c4-…` currently has only 1 enrolled module (M0 — Foundations) at 100% completion. To exercise the constellation richness, the tester may want to enroll a fresh test user via the normal signup flow or seed additional `user_modules` rows (one per `master_modules` row in the same `user_enrollments`) — but the current single-node render is also a valid acceptance case for "renders correctly with however many modules the user has".

Realtime heatmap smoke:
```sql
-- Force a heatmap cell to light up for tomorrow (or any date in the 90-day window):
insert into public.user_daily_activity (user_id, activity_date, xp_earned, sessions_completed, minutes_spent, events_count)
values ('13a690c4-96d7-4827-8117-fde4f696e999', current_date - 5, 200, 2, 22, 7)
on conflict (user_id, activity_date) do update set xp_earned = excluded.xp_earned;
-- Profile page heatmap should update within 1-2s without reload (purple high-activity cell).
```



