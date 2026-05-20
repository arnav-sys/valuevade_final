# Auth Testing Notes (for the testing agent + future devs)

Valuevade's primary auth is **Supabase Auth** (email/password). There is a
separate, much smaller admin JWT used only for `/referral`; ignore that
unless explicitly testing the admin dashboard.

## Test credentials

See `/app/memory/test_credentials.md`. The end-user test account is:

* Email: `testagent2026@gmail.com`
* Password: `TestPass123!`

This user already has an enrollment seeded so the dashboard, modules,
sessions, profile, and gamification UI all render with realistic data.

## How to log in (from the browser side)

1. Navigate to `/login`.
2. There are two `<input>` elements: the email field has `name="email"` and
   the password field has `name="password"` (and matching
   `data-testid="login-email"` / `data-testid="login-password"`).
3. Submit the form. On success the page navigates to `/dashboard` if the
   user is enrolled, or `/courses` otherwise.

## Where the token lives

The Supabase JS SDK stores the session token in `localStorage` under the key:

```
sb-yuadeybycbfqlkdpxbkv-auth-token
```

The value is a JSON-stringified object (`access_token`, `refresh_token`,
`expires_at`, `user`, ...). To check whether a Playwright session is
authenticated, look for this key being present and non-empty after the page
settles.

To set up auth without driving the form (faster), you can:

1. Drive the form once at the start of the suite, then `context.storage_state()`
   to capture cookies + localStorage and reuse it across pages.
2. Or use the Supabase admin sign-in endpoint from your test runner to mint a
   session, then write the localStorage key directly. (Not recommended for
   normal E2E — the form path is more realistic.)

## Gamification (Phase 1) verification helper

The FastAPI app exposes a read-only debug route for the tester:

```
GET /api/health/xp?user_id=<uuid>
```

Returns:

```json
{
  "user_id": "...",
  "user_stats_row_exists": true,
  "total_xp": 35,
  "current_level": 1,
  "events_count": 2,
  "summed_xp_from_events": 35,
  "expected_level_from_sum": 1,
  "matches": true,
  "stats": { ... },
  "ledger_breakdown": {
    "signup_bonus":  { "count": 1, "xp": 10 },
    "daily_login":   { "count": 1, "xp": 25 }
  }
}
```

* `matches=true` — the XP ledger is internally consistent (sum matches
  user_stats.total_xp AND current_level matches what the master_levels
  thresholds would give).
* The endpoint uses the service-role key on the server side, so it works
  even when the tester isn't logged in. The user_id is the Supabase
  `auth.users.id` — you can fish it out of the JWT in localStorage, or from
  the `/profile` page once logged in (it's `useAuth().user.id` in the React
  context, and shown on the page as part of the URL paths for capstone /
  module project once those are unlocked).

## Local URL conventions

Do NOT hardcode anything. Frontend reads the backend URL from
`REACT_APP_BACKEND_URL` in `/app/frontend/.env`. Backend health is
`GET /api/`. The kubernetes ingress maps `/api/*` to backend:8001
automatically.
