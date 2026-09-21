# Valuevade — PRD (living doc)

## Problem statement
Full-stack educational platform for Indian finance students (Valuevade): AI-personalised
equity research & financial modelling course (21 modules, 239 sessions), AI mock interviews,
PDF notes, timed Mock Exam certification, gamified rewards, capstone projects and an admin panel.
Pricing: one-time ₹4999 lifetime, first session free.

## Stack
React (CRA) + Tailwind + shadcn/ui + framer-motion · FastAPI · Supabase (Auth, Postgres, Storage)
Integrations: Razorpay (test), Resend, Emergent LLM key (Gemini / Claude / OpenAI TTS).

## Design system (current)
- Landing: light "editorial finance" (warm paper #FBF9F5, ink #141414, Valuevade blue #246BFD).
- Typography (site-wide, Jun 2026): **Instrument Sans** (body/UI), **Newsreader** (h1/h2/h3, serif
  editorial), **Spline Sans Mono** (mono/ledger/code). Loaded via one Google Fonts link in
  `public/index.html`. Previous fonts (Inter, Space Grotesk, Bricolage Grotesque, Clash Display,
  Fraunces, JetBrains Mono) fully removed.
- See `/app/design_guidelines.json`.

## Implemented (recent)
- Jun 2026 — Landing hero rebuilt synex-style: centered masthead copy on paper + product showcase
  on a dark grained "stage" with a browser-chrome app window. Three pure HTML/CSS animated mockups
  with tab switcher + 6.5s auto-rotate: AI Mock Interview, Excel/DCF model, Document simulation.
  Files: `components/HeroSection.js`, `components/landing/HeroProductShowcase.jsx`,
  `components/landing/mocks/{MockInterviewUI,ExcelModelUI,DocSimUI}.jsx`,
  `components/landing/hero-showcase.css`. Verified: iteration_89.json (frontend 100%).
- Jun 2026 — Site-wide font swap (see Design system). Verified on /, /login, /signup, /dashboard.
- Earlier — Editorial-finance landing redesign (SocialProofStrip, FacultySection, ProblemSection,
  FeaturesSection), MarketChartCanvas/MarketDeskPanel (no longer used by the hero, still available),
  Admin Faculty + Testimonials management with Supabase Storage photo upload.

## Open / backlog
- P0 — Run pending Supabase migrations `scripts/migrations/0044_faculty.sql` and `0045_testimonials.sql`
  in the Supabase SQL editor; Faculty/Testimonials admin endpoints degrade gracefully until then.
- P1 — Refactor `backend/server.py` (~2900 lines): extract `portfolio`, `revision`, `milestones` routes.
- P1 — Study reminder email (Resend nudge when a planned study day is missed).
- P2 — Exam analytics for admins (attempt breakdowns, average scores, hardest questions).

## Test credentials
See `/app/memory/test_credentials.md` (admin `info@valuevade.com`; test user `testagent2026@gmail.com`).
