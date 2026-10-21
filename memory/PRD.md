# Valuevade — PRD & Progress

## Original problem statement
Full-stack educational platform for Indian finance students (Valuevade): courses, AI mock
interviews, PDF notes, timed Mock Exam certification, Gamified Rewards, Admin Panel.
Stack: React (CRA) + FastAPI + Supabase (Auth/Postgres/Storage).
Current visual source of truth: the user's five Valuevade PDF carousels (2026-10-21),
superseding the earlier cream/editorial and forced-dark hero treatments below.
Fonts: Outfit (headings and `font-clash`), Instrument Sans (body, `font-bricolage`),
Spline Sans Mono (mono and `font-jetbrains`). Newsreader retained only for occasional
editorial italic supporting copy, not headings. No Inter/Roboto/Arial defaults.

## Latest approved request — 2026-10-21 (landing-only 3D redesign)
User: "redesign only first landing page only to be more 3d interactive and more conversion".
On scope clarification, user chose **"The entire landing page"**. Preserve the previous
PDF-derived branding and leave all other pages unchanged.

### Implemented
- New isolated landing module: `src/components/landing/immersive/` (12 files), mounted
  exclusively by `LandingPage.js`. No shared brand CSS, auth, backend, payment, or other
  page components changed for this request. No new dependencies required.
- New conversion-focused page sequence: 3D hero → course stats → interactive practice →
  company coverage → portfolio outcomes → six-stage learning journey → AI toolkit →
  published faculty/reviews → transparent pricing → comparison → FAQ → closing CTA.
- Actual Three.js financial workspace: research report, working-model laptop illustration,
  interview screen and extruded chart bars. Mode controls, pointer drag, reset, pause,
  responsive scene composition, off-screen render throttling, reduced-motion support,
  and original-art fallback on unavailable/lost WebGL. Textures are illustrative sample
  screens, not real market feeds or a functioning spreadsheet inside the canvas.
- Hands-on, explicitly labeled sample exercises: five-year DCF with growth/discount
  sliders (₹100 cr starting cash flow, 3% terminal growth), financial-report signals,
  and a sample interview question with deterministic educational feedback. No AI API
  calls or fabricated AI scores in these previews.
- Three perspective-tilting outcome cards, six interactive curriculum stages with
  next/previous controls, and retained course links. All stated total-hours labels remain
  100+ hrs; full course remains ₹4,999 lifetime and first session remains free.
- Landing faculty/reviews consume existing APIs with no invented static fallback people
  or reviews. Profile bios expand/collapse. Existing FAQ and comparison retained.
- Isolated landing navigation and mobile Radix Sheet with accessible description and
  explicit close. Signup CTAs throughout. Mobile sticky CTA and help mount only after
  the hero has scrolled away, not on first load or over the 3D controls.
- Removed landing-only intro interstitial/custom cursor from this new page to avoid
  delaying the primary action. Existing signup, login, course, enrollment, free-mock,
  footer and legal destinations retained.

### Verification
- Iteration 97 tested all new interactions, actual canvas pixel/frame differences,
  drag/pause/reset/modes, reduced-motion, fallback, formulas, keyboard tab controls,
  roadmap, published content, pricing links, FAQ/comparison, and non-landing isolation.
- Fixed all reported layout defects: scene now follows copy in normal document flow;
  mobile help no longer covers reset; sticky visibility uses measured hero bounds rather
  than an initial IntersectionObserver result; mobile sentence spacing restored; Sheet
  description added. Canvas screen colors corrected to preserve source texture contrast.
- `/app/test_reports/iteration_98.json`: all acceptance checks pass, no UI/design bugs,
  no style leakage. Tested 1920x800 and 390x844 screenshots; additional responsive checks
  at 320/768/1024/1440 show no horizontal overflow or hero/scene overlaps.
- Main-agent checks measured an 8px positive scene/copy gap, verified clean mobile first
  load, sticky/help appearing only after scroll-out and disappearing at the top, and
  unobstructed Reset/menu controls. Iteration 98 confirmed these behaviors.
- Hard WebGL-disable simulation varied in the browser harness; fallback was verified
  via forced context-loss in iteration 98 (constructor-failure fallback passed in 97).
  This is a test-harness caveat, not a known application defect.
- Pre-existing XP network warning was not reproducible in stable-load regression.
  Dev build compiles with one existing warning. No production build/deployment claim.
  User received an async deployment notification before this request; no new deployment
  was requested or invoked as part of these landing changes.

### Next action items
- P0: none known for this landing-only request. User visual review is next.
- Potential enhancement: measure free-session CTA clicks and signup completion to test
  actual conversion impact; no conversion lift is claimed from design alone.
- Existing application P1/P2 backlog remains unchanged below.

## Previous approved request — 2026-10-21 (sitewide reference branding)
"I have added some references of valuevade assets take the design language colour palette everything and apply it to all pages of current website. add uis and graphics also in pages just like in documents attached(specially in landing age in a new may of mastering finance in age of ai). mimick them exactly in all pages"

User approved the sitewide design plan with "continue". Original references:
`valuevade-claude-finance-101.pdf`, `valuevade-er-certs-carousel.pdf`,
`valuevade-er-roadmap-carousel.pdf`, `valuevade-finance-career-lies-carousel.pdf`,
`valuevade-finance-certs-carousel.pdf`. Local copies/contact sheet in `/app/design-references`.

### Implemented — 2026-10-21
- Global shared theme in `src/styles/valuevade-brand.css`, imported by App.js:
  exact source palette #F5ECFF canvas, #02073D navy, #5B5F8F muted,
  #246BFD blue, #6A5CFF violet, #FF6AC1 pink, #0F9D78 green. Accessible text variants
  used where needed. Typography, Shadcn tokens, surfaces, borders, forms, navigation,
  and dark-mode equivalents apply across public, account, admin, and learning routes.
- Extracted original PDF illustrations as transparent WebP assets, not stock imitations.
  Six production assets in `/public/brand`, ~289 KB combined. Reusable `BrandArtwork`
  and `AuthBrandPanel` in `components/brand/BrandArtwork.jsx`.
- Rebuilt landing hero around original report → AI → price-chart illustration,
  blue CTAs, violet headline emphasis, reference folios, and a 100+ hrs stats strip.
  Existing working HTML/CSS product preview tabs retained, restyled, and clearly labeled
  illustrative data. No fake live stock feed. Respects reduced-motion preference.
- Added reference graphics to landing feature/roadmap/AI-proof sections, course catalog,
  course details, enrollment, authentication, dashboard, and shared learner sidebar.
  Admin-uploaded custom course images remain supported; stock fallbacks use brand art.
- Mobile comparison uses provider selector + three readable columns instead of overflowing
  an 820px table. Desktop retains full comparison. Navigation anchor destinations fixed,
  sign-up CTAs route to signup, and logo links home. Company ticker now a responsive grid.
- Preserved AI-first enrollment and all learning actions. Standardized visible course,
  landing, and enrollment total-hours labels to 100+ hrs; individual session times unchanged.
- Universal AI loader now uses original AI illustration with animated bars, live status,
  and reduced-motion support. Shared help/report controls no longer overlap sidebar actions.

### Reliability fixes discovered during redesign QA
- Auth subscription now synchronous; profile query deferred outside Supabase auth lock.
  No providers, credentials, or password/session policies changed.
- `SessionPaymentGate` consumes the context session instead of indefinitely waiting on
  `getSession`; 12s timeout, cleanup, explicit error/retry, and fail-closed validation.
  Access still requires explicit backend `session_allowed: true`; existing paywall retained.
- Mock results use context token with timeout/cancellation and working real404 retry.
  Interview startup uses context token, bounded fetch, and catches network failures.
- Dashboard rewards requests abort on unmount and offer error/retry for actual failures.

### Verification
- `/app/test_reports/iteration_95.json`: broad public/account/admin/learning-page checks.
  Found mobile comparison overflow and interview gate blocker; both fixed.
- `/app/test_reports/iteration_96.json`: critical fixes pass, 4/4 backend smoke tests,
  auth login/refresh/signout, fail-closed gate under test-only503/malformed responses,
  actual results404/retry, exact lavender, Outfit headings, desktop/mobile layout checks.
- `/app/test_reports/iteration_96_followup.md`: main-agent browser checks resolved both
  inconclusive report96 items: rewards503 → retry → real200 and real unpaid-session paywall.
- Desktop1920x800 and mobile390x844 screenshots checked. Mobile overflow check is empty.
- Preview dev compile succeeds with two pre-existing warnings. Concurrent production build
  was interrupted by a pod restart/resource contention; do not claim production-build or
  deployment verification for this pass. No deployment requested or performed.
- No new API integration or application API mock added. Landing previews use illustrative
  content; QA failure injection existed only in the test browser. Existing payment mock-mode
  configuration was not changed, and no payment was executed in this design task.

### Next action items
- P0: none known for the approved reference-brand redesign; ready for user visual review.
- Suggested enhancement: matching branded completion certificates and downloadable reports.
- Existing P1/P2 backlog below remains unchanged and was not part of this request.

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

- **Sept 2026 (roadmap v3, matches landing style)**: Per user feedback, dropped the
  stock-photo roadmap cards entirely. Roadmap now reuses the exact visual language of
  the landing page's `HowItWorksSection` — scroll-progress-driven circular icon nodes
  connected by a filling track line (blue), desktop = 2 rows (4+3) each with its own
  local progress, mobile = single vertical track. No images, no click-to-expand
  modal. New components: `RoadmapNode`, `RoadmapCard`, `RoadmapRow`,
  `RoadmapTrackSection` (all local to `CourseDetailsPage.jsx`). Self-tested via
  screenshot at 1920px and 390px scrolling through the section — no overflow, track
  fills correctly, icon nodes flip to filled/checked state in sync with scroll.

## Prioritized backlog

### P1
- Further `server.py` refactor: extract `portfolio`, `revision`, `milestones` routes into
  their own endpoint files (currently ~2900+ lines).
- Study Reminder Email via Resend when a student misses their planned study day.

### P2
- Exam Analytics for admins: attempt breakdowns, average scores, hardest questions.

## Key files
- `/app/frontend/src/components/LandingPage.js` — landing-only immersive page composition
- `/app/frontend/src/components/landing/immersive/` — current 3D landing components and isolated CSS
- `/app/landing_3d_design.md` — design proposal and implementation notes
- `/app/frontend/src/components/CoursesPage.jsx` — redesigned courses listing
- `/app/frontend/src/components/HeroSection.js` — reference-matched lavender hero + original artwork + product previews
- `/app/frontend/src/styles/valuevade-brand.css` — shared route-wide design tokens and responsive rules
- `/app/frontend/src/components/brand/BrandArtwork.jsx` — shared original artwork and auth panel
- `/app/design_guidelines.json` — implementation-aligned reference blueprint
- `/app/frontend/src/components/landing/HeroParticles.jsx`, `landing/mocks/MiniMocks.jsx`
- `/app/frontend/src/components/landing/hero-showcase.css`, `landing/landing-dark.css`
- `/app/frontend/src/components/Navbar.js` — reference header and functional navigation
- `/app/frontend/tailwind.config.js`
- `/app/backend/server.py` — needs refactor (see P1)

## Testing status
- testing_agent used after each significant change (iteration_90, iteration_91)
- Sitewide branding: iterations95–96 and follow-up. Latest landing-only redesign:
  iterations97–98; no remaining known UI regressions.
