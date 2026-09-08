# Valuevade — Product Requirements Document

## Original Problem Statement
Full-stack educational platform for Indian finance students with a cinematic "Bloomberg-terminal" aesthetic. Core features: Courses with AI-personalised paths, AI Mock Interviews, PDF Notes, Timed Mock Exam certification, Gamified Rewards (XP, streaks, badges, milestones), and a comprehensive Admin Panel.

## User Personas
- Indian finance students (B.Com, BBA, early-career) seeking equity research / financial modelling skills
- Admin: info@valuevade.com (Saarthak Bhatia, founder)

## Core Pricing
- **₹4999 one-time lifetime access** (updated from ₹999 — Sep 2026)
- Free first session (no card required)

---

## Architecture

### Tech Stack
- **Frontend**: React (CRA), Tailwind CSS, Shadcn/UI, React Router DOM
- **Backend**: FastAPI (Python), uvicorn, supervisor
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Payments**: Razorpay (Test Mode)
- **Email**: Resend API
- **AI**: Emergent LLM Key (Claude Haiku 4.5 for Pari tutor, Claude Sonnet 4.5 for customize)
- **Storage**: Emergent Object Storage

### File Structure
```
/app/
├── backend/
│   ├── server.py                   (~2922 lines — Auth, Courses, Welcome Email, Health, Portfolio, Revision, Milestones, Admin routes)
│   ├── wave_endpoints.py           (Admin panel, LinkedIn claims, mock interview admin)
│   ├── doubt_endpoints.py          (~1094 lines — all /doubts/* and /health/doubts routes — EXTRACTED Sep 2026)
│   ├── study_plan_endpoints.py     (~1446 lines — all /study-plan/* and /dashboard/drift-recovery* — EXTRACTED Sep 2026)
│   ├── payment_endpoints.py        (Razorpay logic, pricing = 4999)
│   ├── interview_sim_endpoints.py  (AI mock interview simulations)
│   ├── free_trial_endpoints.py     (Free trial management)
│   ├── guest_interview_sim_endpoints.py
│   └── guest_session_endpoints.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminPanel.jsx      (Thin shell — refactored Sep 2026)
│   │   │   ├── admin/              (15+ extracted admin tab components)
│   │   │   ├── payments/
│   │   │   │   ├── PricingCards.jsx (price=4999, ctaLabel='Pay ₹4999 Now')
│   │   │   │   └── EnrollmentChoicePage.jsx
│   │   │   ├── ProtectedRoute.jsx  (with state:{from:location.pathname} redirect fix)
│   │   │   └── LoginPage.jsx       (reads state.from for proper return redirect)
│   │   └── data/faqs.js            (₹4999 in all FAQ answers)
```

### Key API Endpoints
| Endpoint | Purpose |
|---|---|
| `GET /api/courses/catalog` | Fast backend-driven course catalog (bypasses Supabase rate limits) |
| `GET /api/payments/eligibility` | Returns pricing tier + amount (4999) |
| `POST /api/payments/create-order` | Create Razorpay order |
| `GET /api/me/pari_welcome` | Welcome modal state |
| `POST /api/me/send-welcome-email` | Resend welcome email trigger |
| `POST /api/doubts/start` | Open Pari doubt session |
| `POST /api/doubts/ask` | Send message to Pari |
| `POST /api/study-plan/commit` | Save study plan |
| `GET /api/study-plan/active` | Get active study plan |
| `POST /api/study-plan/session-completed` | Mark session done |

### Key DB Schema
- `user_payment_status`: {user_id, paid, paid_amount_inr, paid_at, pricing_tier}
- `user_enrollments`: {user_id, master_path_id, status, ai_customization_plan}
- `user_study_plans`: {user_id, enrollment_id, target_mode, plan_end_date}
- `user_doubt_sessions`: {user_id, phase, module_code, turns}
- `user_milestones`: {user_id, milestone_code, earned_at}

---

## What's Been Implemented

### MVP Features (Complete)
- [x] Supabase Auth (email/password signup + login)
- [x] AI-personalised course paths (Gemini/Claude customization wizard)
- [x] Razorpay checkout (Test Mode)
- [x] Gamified rewards: XP, streaks, badges, milestones
- [x] AI Mock Interviews (3-round with scoring)
- [x] Pari AI Tutor (quick doubts + extended sessions)
- [x] Study Planner (deadline / hours-per-day / hours-per-week modes)
- [x] Mock Exam with timed certification
- [x] Admin Panel (waitlist, users, LinkedIn claims, session feedback, FAQs, customization questions)
- [x] Portfolio/Share (public shareable student portfolio page)
- [x] Guest session (free trial without auth)

### Recent Completed Work
- [x] **Welcome Email** via Resend — `GET /api/me/pari_welcome` + `POST /api/me/send-welcome-email` in server.py; hooked to SignupPage.jsx (2026-09)
- [x] **LinkedIn Claims Tab** — standalone admin tab in wave_endpoints.py + LinkedInClaimsTab.jsx (2026-09)
- [x] **AdminPanel.jsx refactor** — broke 2600-line monolith into 15+ components under `/admin/` (2026-09)
- [x] **Course page timeout fix** — `GET /api/courses/catalog` backend endpoint (2026-09)
- [x] **Admin login redirect loop fix** — ProtectedRoute.jsx passes `state:{from}` + LoginPage reads it (2026-09)
- [x] **Pricing update ₹999 → ₹4999** — Updated all frontend components (15+ files), backend validation, welcome email, and FAQ static data (2026-09)
- [x] **server.py refactor** — Extracted doubts routes (1094 lines) to `doubt_endpoints.py` and study-plan routes (1446 lines) to `study_plan_endpoints.py`. server.py reduced from 5349 → 2922 lines (2026-09)

---

## Prioritized Backlog

### P0 — Immediate
_(none outstanding)_

### P1 — Next Sprint
- Refactor remaining large blocks in server.py (portfolio, revision, milestones could be extracted)

### P2 — Upcoming
- **Exam Analytics**: Admin view of student exam attempt breakdowns, average scores, hardest questions
- Further server.py extraction: portfolio_endpoints.py, revision_endpoints.py, milestones_endpoints.py

### P3 — Future / Backlog
- Real Razorpay live mode (pending account verification)
- Live Resend welcome email (verify domain on Resend dashboard)
- Push notifications for study plan reminders
- Social proof: live enrollment counts, testimonials
