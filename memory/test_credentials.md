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
