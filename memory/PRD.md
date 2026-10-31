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

## Latest request — completed 2026-10-31
Exact request: "in dark mode buttons are not visible and in resources I should add
multiple files instead of one and increase per size file limit of 50 mb"

### Implemented
- **Dark-mode fix**: `.biz-button-outline` (Upload/Edit buttons), `.biz-eyebrow`,
  `.biz-fine-print`, `.biz-text-link` and all admin form inputs/selects/textareas now
  have `html.dark .biz-admin ...` overrides using theme CSS variables. The public
  `.biz-page` design (Enterprise/Resources marketing pages) is an intentionally
  always-light editorial system and was left untouched. Verified by testing_agent_v3_fork:
  dark buttons now show light text/icon on a visible border; light mode unchanged.
- **Multi-file resources**: new `resource_files` table (one resource → many files).
  Admin can select/queue multiple files in one go, upload them sequentially, and
  delete any single file independently (with a confirm prompt). Resource list/detail/
  purchases/download endpoints all now expose a `files: [{id,file_name,file_size,
  file_type}]` array instead of single file_name/file_size/file_type columns.
  Per-file private signed download: `POST /api/resources/{id}/files/{file_id}/download`.
- **50MB limit**: per-file cap raised from 25MB to 50MB end-to-end (upload validation,
  error copy, editor label, and the Supabase storage bucket's `file_size_limit`).
- Fixed testing-agent-found bugs: pending-file React key collision + duplicate
  re-upload after a partial save failure (unique `_uid` per queued file, removed
  from the queue as each upload succeeds); small-file size now shows bytes instead
  of "0.0 KB".

### ⚠️ Action required by user (blocker for this feature going live)
A DB migration is required and could **not** be applied automatically (the saved
`SUPABASE_DB_URL` secret is invalid/was skipped when re-requested). Until run, all
`/api/resources*` and `/api/admin/resources*` endpoints return 503 "Enterprise
database setup is pending." — **this is expected**, not a bug.
To apply it: Admin Panel → Resources tab → "Download database setup" button
(serves `/app/scripts/migrations/0048_enterprise_resources.sql` +
`0049_resource_files.sql` combined) → paste into the Supabase project's SQL Editor →
Run → click "Check again" in the admin panel. This is additive/idempotent and safe
to re-run.

### Verification
- Backend: confirmed via curl that `/api/resources` now returns a friendly 503 (not a
  raw 502) pre-migration; `/api/admin/enterprise/status` correctly reports
  `database_ready:false`; `/api/admin/enterprise/setup.sql` download contains both
  migrations with `file_size_limit=52428800` (50MB).
- Frontend: testing_agent_v3_fork confirmed the dark-mode button fix visually (mocked
  API data since the live DB isn't migrated yet) and the multi-file editor flows
  (multi-select, queue, per-file delete, sequential upload, 50MB copy). No regressions
  in Enterprise/Waitlist/Enrolled Users tabs or the public always-light `.biz-page`s.
- Updated regression suite `backend/tests/test_iter107_resources_purchases.py` for the
  new multi-file API shape; it self-skips until `resource_files` exists in Supabase.

### Key files (this change)
- `scripts/migrations/0049_resource_files.sql` (new table + 50MB bucket limit)
- `backend/{resource_endpoints,resource_access,resource_storage,resource_payments,
  purchase_endpoints,enterprise_common,enterprise_endpoints}.py`
- `frontend/src/components/enterprise/enterprise.css` (dark-mode overrides)
- `frontend/src/components/admin/{ResourceEditor,ResourcesTab,EnterpriseSetup}.jsx`
- `frontend/src/components/resources/{ResourceDetailsPage,ResourceDownloadButton}.jsx`
- `frontend/src/components/purchases/{PurchasesPage,PurchaseResourceRow}.jsx`

## Progress / next tasks
- Current P0: user must run the Supabase SQL migration above to unblock resources.
- P1: enterprise enquiry email delivery and standalone Razorpay resource purchase E2E
  (re-verify after the migration, using the updated multi-file flow).
- P2: backend modularisation, existing hook warnings.
- Full prioritised work is in `ROADMAP.md`.
- Prior implementation history and setup caveats are preserved in `CHANGELOG.md`.
  Entries are chronological snapshots: newer verification supersedes old setup blockers.