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
- **Sept 2026 (re-reversal)**: User then asked the landing hero specifically to go back
  to the coded HTML/CSS mockups instead of photos. `HeroProductShowcase.jsx` reverted to
  render `MockInterviewUI`/`ExcelModelUI`/`DocSimUI` again inside the same browser-chrome
  window/tab-switcher (self-tested via screenshot, no overflow at 1920px). `/courses`
  photos + admin upload from the previous item were NOT reverted, that change stands.

## Prioritized backlog

### P0
- **Execute pending Supabase SQL migrations** (3 pending now):
  1. `0044_faculty.sql` — Faculty/Instructors admin panel
  2. `0045_testimonials.sql` — Testimonials admin panel
  3. `0046_courses_media.sql` — Course cover photos + "Coming Soon" placeholder rows
     (needed for admin course photo uploads to work, and for the 5 placeholder
     courses to reappear on `/courses`)

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
