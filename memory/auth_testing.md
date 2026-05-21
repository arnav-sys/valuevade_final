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



## Phase 52 — `/api/doubts/*` Bearer convention

The Doubts Session endpoints are the **first** Valuevade APIs that require
the end-user's Supabase JWT as a Bearer token. (All prior `/api/*` routes
were either public or service-role-on-the-server.)

### Endpoints affected

* `POST /api/doubts/start`
* `POST /api/doubts/ask`
* `POST /api/doubts/end`

(`GET /api/health/doubts?user_id=<uuid>` is the **exception** — it uses the
service role on the server, no Bearer needed, for ops + tester convenience.)

### Required header

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Where to harvest `<access_token>` (Playwright / tester)

After driving the login form, read `localStorage.getItem('sb-yuadeybycbfqlkdpxbkv-auth-token')`,
parse it as JSON, and use `.access_token`. Example Playwright snippet:

```python
raw = await page.evaluate("() => localStorage.getItem('sb-yuadeybycbfqlkdpxbkv-auth-token')")
token = json.loads(raw)["access_token"]
```

If you have to drive the form anyway, **a cleaner approach** is to let the
React app open the DoubtsSession modal itself (which already harvests the
token correctly via `supabase.auth.getSession()`); then your assertions
just need to watch for `[data-testid="doubts-session-modal"]`,
`[data-testid="doubts-thread"]`, `[data-testid="doubts-msg-assistant"]`,
`[data-testid="doubts-send"]`, etc.

### Error envelope

The FastAPI dependency `get_supabase_user` (defined in `/app/backend/server.py`)
resolves the JWT by calling `GET <SUPABASE_URL>/auth/v1/user` with the user
token. Failure modes:

* No Authorization header / not `Bearer …` → **401 `missing bearer token`**
* Invalid / expired token → **401 `invalid or expired token`**
* Quota exhausted (`/start` only) → **429** with body `{"detail":{"reason":"quota_exhausted","sessions_today":5,"limit":5}}`

Server-side never trusts a `user_id` body field on these routes — the
authoritative `user_id` is always the `id` claim from the resolved JWT.
This means the tester can't "log in as A but pass body user_id of B"; any
such attempt would just act for user A.
