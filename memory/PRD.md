# Valuevade — Product Requirements & Current Status

## Original problem statement
Full-stack education platform for Indian finance students: finance courses, AI mock
interviews, PDF notes, timed mock exams and certification, gamified learning and an
admin panel. The product also has Student and Enterprise public journeys, an AI-agent
offering and a resource marketplace.

## Personas / core requirements
- Students: discover courses, enrol, personalise a learning path, learn through notes,
  lectures, quizzes and simulations, build finance projects and practise interviews.
- Enterprise buyers: explore B2B training and AI-agent offerings and request a proposal.
- Admins: maintain courses/resources, manage enrolments, leads and payment configuration.
- Private learning progress and paid files must remain protected; payment verification
  and downloads remain server-authorised. Public marketing must distinguish available
  courses from upcoming courses and illustrative examples from live capabilities.

## Architecture / established design
- Frontend: React/CRA + CRACO, React Router, Tailwind, Shadcn UI, Framer Motion, Three.js.
- Backend: FastAPI. Existing application data/auth/storage are Supabase (Postgres,
  Auth and private Storage); this update made no database or authentication changes.
- Payments: existing Razorpay course/resource checkout and webhooks.
- API base is `REACT_APP_BACKEND_URL` from frontend environment. Never reuse old
  fork preview URLs; read the current environment.
- Preserve build script: `node --max-old-space-size=4096 node_modules/.bin/craco build`.
- User-supplied Valuevade PDF branding: lavender #F5ECFF, navy #02073D, blue #246BFD,
  violet #6A5CFF, pink #FF6AC1 and green accents. Outfit headings, Instrument Sans body,
  Spline Sans Mono labels. Reuse original bitmap brand assets in `public/brand`.
- Main landing is `components/LandingPage.js`, not archived `LandingPageV2`.

## Latest request — completed 2026-10-29
Exact request: "in landing page and course details page add a section of personalisation
and tailored according to you and that it is not generic and uses ai to make the course for you"

### Implemented
- Shared `courses/PersonalisationSection.jsx` + isolated `personalisation.css`.
- Landing: new section immediately after CourseStats, before interactive practice.
- Live course details: section after stats and before included resources.
- Heading: **Not a generic course. A course tailored to you.**
- Explains background/skills/goals → AI-tailored modules and sessions → review your
  personalised path. Explicitly describes tailoring the existing course curriculum,
  not generating every lecture or continuous automatic adaptation.
- Uses original AI brand artwork, three numbered steps, theme-aware colours and a
  working landing “Find your course” link to `/courses`.
- Upcoming student course details show a shorter version, explicitly planned and not
  yet available, with enrolment still closed. Enterprise pages were not changed.
- Corrected an existing mobile syllabus accordion overflow via `min-w-0` on the
  course module trigger; added unique module-toggle test IDs.
- No new AI service, API mock, authentication, payment, enrolment or database changes.

### Verification
- Direct Playwright checks using the external preview: desktop 1920×800 and mobile
  390×844 on landing, live course and upcoming course; zero horizontal overflow.
- Light/dark styles, loaded artwork, copy, three steps, unique section IDs and course
  navigation pass. Mobile syllabus expands after the width correction. Upcoming
  section has planned copy and no new enrolment action.
- JSX parsing passes for all four touched component files. Existing catalogue API
  returns 200. No paid generation, checkout or account writes were needed.
- Report: `test_reports/personalisation_20261029.md`. No known blocker for this request.
- Auth credentials were not created or modified. This fork did not need authenticated
  testing; do not fabricate accounts if prior credential notes are missing.

## Key files
- `frontend/src/components/LandingPage.js`
- `frontend/src/components/CourseDetailsPage.jsx`
- `frontend/src/components/courses/{PersonalisationSection.jsx,personalisation.css,UpcomingCoursePage.jsx}`
- `frontend/src/components/brand/BrandArtwork.jsx`
- `frontend/src/styles/valuevade-brand.css`
- `backend/server.py` contains the existing customisation planner; untouched this task.

## Progress / next tasks
- Current P0: no known issue in the requested presentation update; user visual review next.
- P1: enterprise enquiry email delivery and standalone Razorpay resource purchase E2E.
- P2: backend modularisation, existing hook warnings, optional sample personalised-path preview.
- Full prioritised work is in `ROADMAP.md`.
- Prior implementation history and setup caveats are preserved in `CHANGELOG.md`.
  Entries are chronological snapshots: newer verification supersedes old setup blockers.