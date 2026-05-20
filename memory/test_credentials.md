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

