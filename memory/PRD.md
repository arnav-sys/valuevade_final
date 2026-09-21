# Valuevade — Product Requirements Document

## Hero Rebuild + Em Dash Sweep + Features Dossier Wall (Sep 2026)
- **Hero (`HeroSection.js`)** rebuilt in a minimal "Brainy.Ai" style per user reference: near-black canvas (#05070F), animated **particle candlestick chart** (`landing/CandlestickParticleField.jsx`, canvas 2D, pointer-repelling, no new deps, seeded so it renders identically each load), vertical "Valuevade" brand rail on the left, six scattered stat markers (21 / 239 / 42h / 3 / XV / Rs 4999), mono eyebrow over the field, and the new tagline as the headline: **"A new way of mastering finance in the age of AI"** ("age of AI" in Fraunces italic blue). Old stat band retired, markers carry the numbers. Mobile falls back to a stacked layout with a 3-col marker row.
- **Em dash sweep**: `/app/scripts/strip_em_dashes.py` rewrote every em dash in user-facing copy across 226 frontend + backend files (spaced dash to comma, after punctuation to space, `X, Valuevade` titles to `X | Valuevade`); `&mdash;` entities in SocialProofStrip/FacultySection handled separately; a few FAQ sentences hand-tuned to parentheses. Left untouched: single `'-'`-style empty-state placeholders and the regex char class in `capstonePhases.js`. **Still outstanding: ~6 em dashes live in Supabase course/role description rows** (needs a one-off SQL update, not a file sweep).
- **Features section redesign** (`FeaturesSection.js`): orbit retired. Now a **dossier wall**, sticky editorial rail on the left (eyebrow, headline, copy, "Open your file" CTA) beside 14 clipped-top-right-corner cards on a staggered two-column ladder. Each card: blue spine that grows on hover, tinted icon tile, outlined index number 01-14. Styles live in `landing-dark.css` under `.lv-dossier*`. Verified at 1920x800 and 390x844.

## Faculty + Testimonial Wall + Gaps (Jun 2026)
- **Faculty section** (`FacultySection.jsx`) on the landing (after WhoBuiltThis, before pricing) — admin-managed via new **Faculty** admin tab (`admin/FacultyTab.jsx`) with **photo upload** (stored in the public `session-videos` Supabase bucket under `faculty/`). Public read `GET /api/faculty`; admin CRUD `/api/admin/faculty` (+ `/photo`).
- **Testimonial Wall** — `TestimonialsSection.js` rebuilt into a scrollable masonry proof wall placed right after the pricing/Comparison section; admin-managed via new **Testimonials** admin tab (name + role + quote). Public read `GET /api/testimonials`; admin CRUD `/api/admin/testimonials`.
- **Durability:** both use Supabase tables. **Run `0044_faculty.sql` and `0045_testimonials.sql` in the Supabase SQL editor** to provision + seed them. Until then, endpoints degrade gracefully (`table_ready:false`), the landing shows seeded fallback content, and admin tabs show a "run migration" banner.
- **Gaps section** (`ProblemSection.js`) redesigned: removed the sticky-scroll/3D treatment for a clean 8-card grid on navy with blue accents. Added 5 gaps: no certification+real projects, no AI mock-interview practice, no practical hands-on learning, no resume/LinkedIn/soft-skill prep, generic non-personalised courses.
- Backend endpoints live in `wave_endpoints.py` (mirrors the FAQ pattern; admin verified via `_ensure_admin`).

## Orbit Feature Layout Enlarged (Sep 2026)
- `FeaturesSection.js` orbit re-scaled per user request ("scatter equally, cover full page, elements bigger"): `SIZE` 720→1040, `R` 300→450, node width 116→150, icon boxes 48px→64px (rounded-2xl), icon size 19→26, label 12px→14.5px, hub 176px→224px. Orbit now positioned via percentages inside a `maxWidth: 96vw` wrapper (was capped at `max-w-7xl`) so it spans near full desktop width. Header stayed in `max-w-7xl`; orbit + mobile grid fallback moved to their own full-width wrappers. Verified via screenshot at 1920x800 (all 14 nodes evenly spaced, no overlap) — mobile grid fallback unaffected.

## Landing Design Direction (Jun 2026 — CURRENT)
Landing + full app redesigned to an editorial finance aesthetic: deep **navy** canvas (#0A0F1C) with the **Valuevade logo blue** accent (#246BFD), **bold geometric-sans** headlines (Space Grotesk) + **italic-serif** accent words (Fraunces, blue), **pill** CTAs, section eyebrows (blue caps + leading rule). Terminal/AI gimmicks (CRT scanlines, dot grid, mono ticker, corner-ticks, mono FT-/Q0x/YES-NO rails, sharp 2px corners) stripped for a warm, human feel.
- **App theme match:** the auth-gated `.dark` palette in `index.css` was retimed from violet → navy + logo-blue so dashboard/courses/auth match the landing seamlessly (verified on the login/auth screen).
- **Social-proof strip:** `SocialProofStrip.jsx` sits under the hero — truthful "built on real markets" framing (companies the curriculum models: Reliance/HDFC/Infosys/TCS/Tata Steel/ICICI) + roles you prep for (ER/IB/AM). No placement/alumni claims.
- **Section polish:** Features (rounded tinted icon frames, no mono rails/footers), Comparison (clean check/dash, sans headers, no datagrid footer), FAQ (pill category chips, clean numbers, human footer).
- Accent was originally mint-emerald (first pass) then changed to logo blue per user. Intro accepts `?nointro=1`. Copy unchanged. Key files: `landing-dark.css`, `HeroSection.js`, `Navbar.js`, `SocialProofStrip.jsx`, `ComparisonSection.js`, `FaqAccordion.jsx`, `FeaturesSection.js`, `index.css` (.dark), `App.css`.

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
