# Valuevade — PRD & Progress

## Original problem statement
Full-stack educational platform for Indian finance students (Valuevade): courses, AI mock
interviews, PDF notes, timed Mock Exam certification, Gamified Rewards, Admin Panel.
Stack: React (CRA) + FastAPI + Supabase (Auth/Postgres/Storage). Editorial-finance /
Bloomberg-terminal design language. Fonts strictly Newsreader (headings, `font-clash`),
Instrument Sans (body, `font-bricolage`), Spline Sans Mono (mono, `font-jetbrains` and now
also Tailwind's default `font-mono`). No Inter/Roboto/Space Grotesk/Arial anywhere.

## What's been implemented (with dates)
- **Sept 2026**: Landing hero rebuilt around 3 pure HTML/CSS animated mockups
  (`MockInterviewUI`, `ExcelModelUI`, `DocSimUI`) inside `HeroProductShowcase.jsx` — tab
  switcher, 6.5s auto-rotate. Global font swap to Newsreader/Instrument Sans/Spline Sans Mono.
- **Sept 2026**: `/courses` page fully redesigned per user-provided reference screenshot —
  wavy blue-gradient hero (brand #246BFD, not the reference's purple), sticky header
  unchanged, responsive 3/2/1-col card grid: 1 real course (Equity Research Analyst, real
  price/hours/modules/sessions from `/api/courses/catalog`) + 5 "Coming Soon" placeholder
  cards (Investment Banking, Private Equity, Financial Modelling, Portfolio Management,
  Wealth Management — clearly marked, disabled CTA, no fabricated ratings/students/avatars).
  Decorative disabled pagination (Prev/1/Next) for layout parity only.
- **Sept 2026**: `/courses` card thumbnails swapped from stock photos to compact live
  mockups (`MiniInterview`/`MiniExcel`/`MiniDoc` in `landing/mocks/MiniMocks.jsx`) — the
  *same* real HTML/CSS mockups from the landing hero, reused at card scale.
  Assignment: Equity Research Analyst & Portfolio Management → interview;
  Investment Banking & Financial Modelling → excel; Private Equity & Wealth Management → doc.
- **Sept 2026**: Landing hero top band ("A new way of mastering finance in the age of AI")
  changed from a dull thin-gray-on-cream look to a hardcoded dark navy `.hero-on-dark` band
  (independent of the site's light/dark theme toggle) with bold WHITE heading, ~46 CSS-only
  twinkling white particles (`HeroParticles.jsx`), and a soft BLUE (brand #246BFD, no
  purple/violet) radial glow. Navbar gets a `navOnDark` prop → `.nav-on-dark-hero` class
  (light text) only while unscrolled at the very top, reverts to normal on scroll.
- Root-cause fix: Tailwind's default `font-mono` key remapped to Spline Sans Mono in
  `tailwind.config.js` (previously only the custom `jetbrains` key had it) — fixes the
  font on all 133 files using Tailwind's `font-mono` class site-wide.
- Fixed a pink "Advanced" difficulty-badge kerning artifact (removed `tracking-wide`).
- Fixed an unrelated pre-existing webpack/eslint cache glitch that briefly blocked
  compilation (stale `node_modules/.cache`) — cleared, unrelated to app code.

Both changes verified by `testing_agent`: iteration_90.json (~98%, 1 minor font-mono issue,
fixed) and iteration_91.json (~99%, 1 minor kerning issue, fixed).

- **Sept 2026 (reversal)**: User asked to revert `/courses` mini-mockups back to real
  photos, and swap the landing hero's coded mockups for real photos too. Implemented:
  - `HeroProductShowcase.jsx` tabs now render real Unsplash/Pexels photos (interview,
    Excel modelling, document review) in the same browser-chrome window, with an
    `onError` fallback to the first tab's image if a CDN photo fails to load.
  - `/courses` cards render `course.image_url || FALLBACK_IMAGE_BY_CATEGORY[...] ||
    DEFAULT_FALLBACK_IMAGE`, also with an `onError` fallback. Removed hardcoded
    `MOCK_COURSES` array; "Coming Soon" cards are now data-driven via `is_coming_soon`.
  - New admin capability: Admin > Courses tab has a per-course photo upload button
    (`POST /api/admin/courses/{id}/photo`, uploads to Supabase storage bucket
    `session-videos`, patches `master_paths.image_url`).
  - New migration `/app/scripts/migrations/0046_courses_media.sql` (P0, PENDING user
    action) adds `image_url`/`category`/`is_coming_soon` to `master_paths` and seeds the
    5 "Coming Soon" placeholder rows so they become real, admin-editable DB records.
    Until run, admin photo upload cleanly 503s with a migration hint (verified, not a bug).
  Verified by testing_agent: iteration_92.json (100% pass, both backend + frontend).
- **Sept 2026 (course details expansion)**: Course details page (`/course/{id}`) now
  admin-editable end-to-end. Title/description/what-you-learn switched from hardcoded
  JSX to `course.title`/`long_description`/`what_you_learn` (with fallback). Removed the
  old "How Valuevade compares" comparison table entirely. Added: a big-number
  "What happens after this course" before/after section (₹4 LPA → up to ₹12 LPA), a
  "Career opportunities" grid (driven by `career_outcomes`), and reused the landing
  page's exact `PracticalSkillsSection`, `FacultySection`, `TestimonialsSection`
  components on the details page too. Added brochure-PDF download link and intro-video
  player (both conditionally shown, admin-uploadable). Admin > Courses tab got a new
  "Edit Details" modal (description/what-you-learn/prerequisites/career-outcomes/skills,
  one-item-per-line textareas) plus 2 new upload buttons (Brochure PDF, Intro video)
  next to the existing cover-photo button.
  Backend: `GET/PATCH /api/admin/courses`, new `POST /api/admin/courses/{id}/brochure`
  (PDF, 15MB max) and `POST /api/admin/courses/{id}/intro-video` (mp4/webm/mov, 200MB
  max), all uploading to the `session-videos` Supabase bucket.
  New migration `/app/scripts/migrations/0047_course_brochure.sql` (P0, PENDING) adds
  `brochure_url`/`intro_video_url` columns — until run, those upload buttons show a
  clean 503 hint (verified, not a bug).
  Two real bugs found + fixed during self-testing: (1) `GET /api/admin/courses` used a
  single combined Supabase select that failed entirely (silently dropping
  is_coming_soon/image_url/etc.) when brochure_url/intro_video_url didn't exist yet —
  fixed with a proper 2-tier fallback; (2) admin modals (`CourseDetailsModal` and the
  pre-existing `PreviewSessionsModal`) were transparent/see-through because
  `bg-[var(--color-bg)]` referenced an undefined CSS variable — fixed by switching to
  the correct `bg-[var(--color-bg-elevated)]`.
  Verified by testing_agent: iteration_93.json (100% pass, both backend + frontend).
- **Sept 2026 (roadmap)**: Added a "Your Roadmap" step-by-step section (7 steps:
  personalised path → learn by doing → AI for finance → NISM prep → real-world
  projects → resume/LinkedIn/soft skills → AI mock interviews) right between the
  Before/After transformation section and Career Opportunities on the course details
  page. Pure frontend, no backend/data changes; self-tested via screenshot at 1920px
  and 390px, no overflow.

- **Sept 2026 (roadmap v2 + enrollment choice + AI loader)**: `0047_course_brochure.sql`
  confirmed run by user. Rebuilt the roadmap section on Course Details from a vertical
  text list into a horizontal, wrapping grid of 7 clickable image cards (stock photos),
  each opening a full-screen preview modal (`RoadmapStepModal`) with a larger image +
  full body text. Redesigned the Enrollment page CTA: replaced the old "pay first, AI
  as secondary link" layout with an equal-prominence 2-card choice
  (`enrollment-choice-grid`) — "Customise my path with AI" (purple, "Recommended"
  ribbon, primary) and "Start the standard curriculum" (still one click to Razorpay),
  shown side-by-side when the admin's `ai_customization_mode` setting is `optional`
  (current default). Built a new reusable on-brand `AILoader` component
  (`common/AILoader.jsx`, ticker-bar + spinning ring, cycling status messages, all
  colors via CSS vars so it auto-adapts light/dark) and wired it into 5 AI-wait
  screens: `MockInterviewPage` (round-transition/finalize overlay),
  `MockInterviewResults` (results-loading), `SimulationPage`, `QuizPage`,
  `MockExamPage` (initial page-load spinners). Added `ai-loader-spin`/`ai-loader-bar`
  keyframes to `App.css`. Verified by testing_agent: iteration_94.json (100% pass on
  all 3 scoped features; 1 minor mobile padding issue found + fixed same session).

## Prioritized backlog

### P1
- Further `server.py` refactor: extract `portfolio`, `revision`, `milestones` routes into
  their own endpoint files (currently ~2900+ lines).
- Study Reminder Email via Resend when a student misses their planned study day.

### P2
- Exam Analytics for admins: attempt breakdowns, average scores, hardest questions.

## Key files
- `/app/frontend/src/components/CoursesPage.jsx` — redesigned courses listing
- `/app/frontend/src/components/HeroSection.js` — dark hero band + product stage
- `/app/frontend/src/components/landing/HeroParticles.jsx`, `landing/mocks/MiniMocks.jsx`
- `/app/frontend/src/components/landing/hero-showcase.css`, `landing/landing-dark.css`
- `/app/frontend/src/components/Navbar.js` (navOnDark prop)
- `/app/frontend/tailwind.config.js`
- `/app/backend/server.py` — needs refactor (see P1)

## Testing status
- testing_agent used after each significant change (iteration_90, iteration_91)
- No known regressions; both UI tasks self-tested + agent-verified
