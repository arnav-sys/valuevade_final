# Valuevade — MVP 2.0 PRD (Live)

## Original problem statement
Continuing the existing Valuevade project (equity-research / financial-modelling course, Supabase-backed FastAPI+React).

## Architecture
- **Backend**: FastAPI (uvicorn) at 8001, routes prefixed `/api`.
- **Frontend**: React (CRA/craco) at 3000, Tailwind + shadcn/ui, `lucide-react` icons.
- **Data**: Supabase (Postgres + Storage). `master_sessions`, `master_simulations`, `master_modules`. `session-videos`, `session-notes` buckets.
- **AI**: Emergent Universal LLM key → Claude Sonnet 4.5 via `emergentintegrations`.

### Dynamic Hours in Stats Bar (Added Feb 2026)
- `totalHours` now uses `totalMinutes / 60` (dynamic, from `effectiveMinutes()`) instead of the static `course.estimated_hours` DB field
- When `video_duration_minutes` is null: shows estimated hours based on 25 min/session default
- When `video_duration_minutes` is populated: shows accurate hours derived from real video lengths
- Stats bar label switches `"Hours (est.)"` → `"Hours of Content"` automatically once real video durations are present
- Hero pill shows a `video` suffix to make the source clear

## Feb 2026 — Preview Videos + Free Trial Sessions

### Features Added
1. **Preview Video Modal** (CourseDetailsPage): admin-marked sessions show a "▶ Preview" play button in the syllabus. Clicking opens inline video modal. Max 2 preview sessions at a time.
2. **Free Trial Sessions** (CourseDetailsPage + GuestSessionPage): admin marks up to 2 sessions as "free". A "Try Free" strip appears on the course page with CTAs to `/try-free/:sessionId`. 
3. **GuestSessionPage** (`/try-free/:sessionId`): full session experience (video → notes → quiz → simulation) for anonymous visitors. No account required. Progress in localStorage only. After completing both free sessions → enrollment paywall CTA.
4. **Admin toggles**: CurriculumTab shows "preview" and "free" toggle buttons on each session row. Max 2 each enforced server-side.

### DB Migrations Required (Supabase Studio)
- `0041_video_duration_minutes.sql` — adds `video_duration_minutes NUMERIC` to `master_sessions`
- `0042_preview_and_free_sessions.sql` — adds `is_preview_session BOOLEAN DEFAULT FALSE` and `is_free_session BOOLEAN DEFAULT FALSE` to `master_sessions`
- `0040_notes_pdf_card_type.sql` — updates `master_notes_cards.card_type` check constraint to include `pdf_document`

### Backend graceful fallbacks
All new endpoints fall back gracefully if migrations haven't been applied yet (return empty arrays, not 500 errors).

## Feb 2026 — Mock Exam System (NISM-style, Module-level)

### Features Added
1. **Admin MockExamModal**: `ClipboardList` icon on every module row → opens modal with Settings (title, time limit, pass %) + full question CRUD (add/edit/delete MCQ questions with topic tags, difficulty, options, correct answer, explanation).
2. **Student exam flow** (3 pages):
   - `MockExamStartPage` (`/module/:id/mock-exam/start`) — info card with question count, timer, pass mark, previous attempts history.
   - `MockExamPage` (`/module/:id/mock-exam`) — countdown timer (red when < 10 min), question navigator pill grid (green = answered, amber = flagged), MCQ card, flag-for-review button, auto-submit on timeout.
   - `MockExamResultPage` (`/module/:id/mock-exam/result`) — score ring animation, pass/fail badge, per-question review accordion with explanations, retake button.
3. **Backend endpoints** (10 total): admin CRUD + student get/start/submit/attempts.
4. **DB Migration** `0043_mock_exams.sql` — creates `master_mock_exams`, `master_mock_exam_questions`, `user_mock_exam_attempts` tables.

### DB Migration Required
Run `/app/scripts/migrations/0043_mock_exams.sql` in Supabase Studio to activate the mock exam system.
- Admin can upload a PDF or PPTX for each session (replaces card-based notes for students)
- Storage bucket: `session-notes` (public)
- Card type: `pdf_document` in `master_notes_cards`
- Student view: DocumentViewer component in NotesPage
- Requires migration 0040 for the new card type

## Feb 2026 — Dynamic Session Timing
- `effective_minutes(session) = round(video_duration_minutes || 15) + 10`
- Study planner uses this formula instead of `estimated_minutes`
- VideoEditor admin auto-extracts duration via `<video>` element on file pick
- Requires migration 0041 for `video_duration_minutes` column
- `src/utils/sessionTime.js` exports `effectiveMinutes()` and `formatDuration()`

## Feb 2026 — Delete/reorder, CFI cleanup, mobile fixes, Forgot Password, Pari chat fix
- Delete module (cascade warning), delete session, session reorder
- Removed CFI certification references
- Mobile UI fix in ProblemSection
- Forgot Password + Reset Password via Supabase native auth
- Added root `/health` endpoint for K8s liveness probes
- Added Retry UX button to Pari chat

## Prioritized Backlog

### P0 (Security — RESOLVED Feb 2026)
- ~~`GET /api/_download/codebase` — removed unauthenticated codebase download endpoint~~

### P1 (RESOLVED Feb 2026)
- ~~Broken `/referral` admin login — added ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SECRET to backend/.env~~

### P1 (Soon)
- Module Reorder: up/down arrows for module ordering (currently only sessions)
- Apply DB migrations 0041, 0042 in Supabase Studio to enable timing + preview/free features

### P2 (RESOLVED Feb 2026)
- ~~Password Strength Meter on reset screen~~ ✅
- ~~Auto-Retry Once in Pari chat before showing error~~ ✅
- ~~Session Expiry Banner for Supabase token lapses~~ ✅
- ~~Device-Blocked Filter in Free Trials tab~~ ✅
- ~~Referral admin login fix~~ ✅

### P2 — Upcoming
- Module Reorder: up/down arrows for module ordering (code done, test pending)

## Key Files
- `/app/backend/server.py` — FastAPI setup, study planner
- `/app/backend/wave_endpoints.py` — curriculum CRUD, admin endpoints
- `/app/backend/guest_session_endpoints.py` — public guest session endpoints (no auth)
- `/app/frontend/src/components/GuestSessionPage.jsx` — free trial page
- `/app/frontend/src/components/CourseDetailsPage.jsx` — preview modal + free strip
- `/app/frontend/src/components/admin/CurriculumTab.jsx` — admin curriculum + flags
- `/app/frontend/src/components/admin/NotesEditor.jsx` — PDF/PPT upload
- `/app/frontend/src/utils/sessionTime.js` — timing helpers
- `/app/scripts/migrations/` — SQL migrations to apply in Supabase Studio

## Original problem statement
Continuing the existing Valuevade project (equity-research / financial-modelling course, Supabase-backed FastAPI+React).

**Part A** — Auto-detect sessions missing simulations and generate one (Decision-Making / Book / Excel) per session using topic classification + Claude Sonnet 4.5.
**Part B** — Rebuild the Excel simulation on HyperFormula + react-window virtualization, with SUM/AVG/MIN/MAX/COUNT/IF/VLOOKUP/ROUND/CONCAT, absolute/relative refs, drag-fill, multi-sheet, copy/paste, undo/redo, and auto-grader. Cap 100×26.

Mid-session bug: Supabase Storage returns 413 for video uploads > 50 MB (Free-tier cap). User needed to upload a 30-min lecture.

## User persona
- Admin uploading lecture videos & course content.
- Student (aspiring equity analyst) working through modules, sessions, and simulations.

## Architecture
- **Backend**: FastAPI (uvicorn) at 8001, routes prefixed `/api`.
- **Frontend**: React (CRA/craco) at 3000, Tailwind + shadcn/ui, `lucide-react` icons.
- **Data**: Supabase (Postgres + Storage). `master_sessions`, `master_simulations`, `master_modules`. `session-videos` bucket.
- **AI**: Emergent Universal LLM key → Claude Sonnet 4.5 (`anthropic/claude-sonnet-4-5-20250929`) via `emergentintegrations`.
- **Excel engine**: HyperFormula 3.3.0 (GPL-v3 headless). Grid virtualization: react-window 1.8.11 (`FixedSizeGrid`).

## Feb 2026 — Editorial terminal language: light-mode audit

Appended a `.landing-light` override block to `landing-dark.css` so the whole `lv-*` language reads cleanly on the cream-pink light palette:

- **Terminal grid** softened (12%→8% dot opacity) so the dot-matrix doesn't feel gritty on cream.
- **CRT scanline** hidden in light mode (dark-mode-only signature).
- **`.lv-panel`** re-tuned: `rgba(255,255,255,0.78)` fill + `rgba(26,26,46,0.10)` border + subtle backdrop-blur so the terminal frame actually reads as a card on cream. Corner-tick bracket opacity bumped from 55% → 75%.
- **`.lv-chapter` / `.lv-nav-link` / mono meta labels** shifted from a 40% white token (invisible on cream) to explicit `rgba(26,26,46,0.55/.68)` navy so section rails and nav links stay readable.
- **`.lv-statusbar`** switched from color-mixed muddy-black to `rgba(255,255,255,0.82)` glass + navy text; up/down ticker colours darkened (`#22c55e→#16a34a`, `#ef4444→#dc2626`) for cream contrast.
- **`.lv-cta`** forced to a punchy `#1e56d4` (with `#246BFD` hover) — the dark-mode `color-mix(--color-primary, black)` had produced a pale washed-out button against the light `--color-primary` (#246BFD).
- **`.lv-live-dot`** switched from the dark-mode lavender-pink to `#E53E5C` deeper rose so it stays visible on cream.
- **Emotional italic pink lines** (ProblemSection "Valuevade was built to close all three gaps at once" and AI-Proof "Don't just land the role. Make yourself impossible to replace.") were washing out against cream — overridden to `#d02891` darker rose.
- **Hero ticker up/down** colours also darkened via testid-scoped selectors.
- **`--color-text-faint` overrides** — the 40% cream faint token was near-invisible against the cream bg; bumped to `rgba(26,26,46,0.48)` for readability.

Verified section-by-section (hero, problem, features, ai-proof, comparison, faq, final-cta, footer) at 1440×900 in light mode. Terminal look now works on both palettes without dark-mode assumptions leaking through.


## Feb 2026 — Terminal continuity: remaining sections converted

Closed the loop — the whole landing now reads as one editorial finance product from hero to footer. Every section carries the `§NN // TAG` chapter rail, `lv-panel` sharp cards, mono uppercase labels, and one italic serif accent in the H2.

- **WhatYoullLearnSection** (`WhatYoullLearnSection.jsx`): `§06 // CURRICULUM · 21 MODULES · 239 SESSIONS` chapter rail. H2 "What you'll learn — *from zero to analyst*". Layout switched from centered to editorial left-aligned. CTA converted to text-with-arrow-and-rule.
- **WhoBuiltThisSection** (`WhoBuiltThisSection.jsx`): `§07 // TRUST · TRANSPARENCY · INSTRUCTOR · STANDARDS` chapter rail. H2 "Who built this — and *why* you can trust it". Two pillowy glass-cards converted to sharp `lv-panel` cards with `01 · INSTRUCTOR` / `02 · STANDARDS` mono prefixes, framed square icons, and hairline data footers (`CA · CMA US · ACCA (UK) — ~5 YRS · TEACHING` / `NISM SERIES XV · CFI — EXTERNALLY ANCHORED`).
- **AIProofSection** (`AIProofSection.js`): `§08 // AI-PROOF` chapter rail. Retired the pill-shaped centred badge; kept the "THE SKILL NO ONE IS TEACHING" strapline as a mono chapter tag. H2 "Finance jobs are changing. *Your* skills should too." NeuralNetBg dialled back to 40% opacity. The two-column comparison card converted to `lv-panel` datagrid: `ROLES · REPLACED` (with `01/02/03` mono row prefixes and `STATUS · AUTOMATED` footer) vs `SKILLS · IRREPLACEABLE` (with mono prefixes and `STATUS · HIRING SIGNAL` footer).
- **FreeTrialCTA** (`FreeTrialCTA.jsx`): `§ // TRIAL · FREE · ONE-TIME · NO SIGNUP` chapter rail. Retired the 3xl rounded gradient panel + glow shadow. H2 "Try a full analyst mock interview. *Free.*". Bullet strip converted to mono uppercase. Email input squared (2px), submit button converted to `.lv-cta`.
- **TestimonialsSection** (`TestimonialsSection.js`): `§09 // PROOF · FROM STUDENTS IN THE GRIND` chapter rail. H2 "Built by a finance student. *For* finance students." Stats bar redesigned: `lv-panel` split into 4 monospace readouts — `MOD 21`, `SIM 239`, `VID 42h`, `PRS 100%` — each with a `LIVE` tag. Retired the misleading "500+ Students on Waitlist" figure (waitlist is dead).
- **FaqAccordion** (`FaqAccordion.jsx`): `§10 // FAQ · LAST UPDATED · 25 AUG 2026` chapter rail. Retired the gradient bg-clip-text "answered" heading in favour of italic serif accent. Retired the "shadow-glow when open" halo. Categories converted to sharp mono terminal chips (2px radius). Accordion rows are now datagrid-style inside a single `lv-panel` with `Q01 … QN` mono row prefixes and a hairline divider between rows. Trailing "still stuck" line converted to mono uppercase status line.
- **FinalCTASection** (`FinalCTASection.js`): `§11 // ENROL · ₹1,500 · LIFETIME · NO CARD REQUIRED` chapter rail. Retired the pink/violet gradient CTA + breathing halo + Three.js convergence bg. Content wrapped in an `lv-panel` with `ENROL · OPEN NOW` LIVE dot header. H2 "…It starts *today*." Sharp mono `.lv-cta` "START THE PROGRAM · ₹1,500 LIFETIME" primary. Added a data-bar footer with PRICE / ACCESS / MODULES / SESSIONS.
- **Footer** (`Footer.js`): `§∞ // FOOTER · VALUEVADE · IND · EQUITY RESEARCH SW` chapter rail. Column grid with `EXPLORE` + `CHANNELS` mono labels. Nav links converted to `.lv-nav-link`. Social icons converted to 9×9 square-bordered buttons (2px radius). Copyright and legal links converted to mono uppercase. Added `ENROLMENT · OPEN` LIVE-dot status under the logo tagline.

All content copy, links, and data-testids preserved verbatim (except the honest stats-bar refresh in TestimonialsSection). Verified end-to-end at 1440×900 via screenshot pass across every section (curriculum, trust, ai-proof, free-trial, testimonials, faq, final-cta, footer).


## Feb 2026 — Editorial terminal language extended (Features / HowItWorks / Comparison)

Follow-up to the hero redesign. Rolled the same `lv-panel` / `lv-chapter` / mono uppercase / framed-icon language down through the mid-landing so the whole product reads as one editorial finance surface.

- **FeaturesSection** (`FeaturesSection.js`) rewritten: `§03 // FEATURES` chapter rail + 14-UNITS suffix. H2 "One platform. *Your* entire finance career journey." with serif italic accent. 14 bento cards converted from pillowy `glass-card rounded-2xl` to sharp `lv-panel` (2px radius, corner ticks). Every card now carries a mono `FT-NN · TAG` prefix (FT-01 ROADMAP through FT-14 XP) and a framed 9×9 square icon (no more gradient washes). Large cards get a hairline data footer ("MODULE · CORE  SHIPPED · IN PLATFORM"). Retired the `FeatureMicro3D` + `RoadmapVisual` decorations — they read as AI-slop, no longer imported here.
- **HowItWorksSection** (`HowItWorksSection.js`) rewritten: `§04 // PROCESS · 04 STEPS · 2 MONTHS · 1 HR/DAY` chapter rail. H2 "From where you are. *To* where you want to be." with italic serif accent. 4 pillowy circle-and-glow step nodes replaced with 4 sharp `lv-panel` step cards showing big mono `01/02/03/04` numeric prefixes, `STEP · INPUT/ROADMAP/BUILD/DEPLOY` mono labels, framed icons, and a `PHASE · N/4  NEXT →/OUTCOME` hairline footer. Kept the sticky-scroll `TimelinePath` bezier but dialled back to 40% opacity.
- **ComparisonSection** (`ComparisonSection.js`) rewritten: `§05 // BENCHMARK · SIDE-BY-SIDE · 5 PROVIDERS` chapter rail. H2 "Why pay *30×* more for less?" with italic serif accent. Table converted to a Bloomberg-style datagrid — mono uppercase column headers, hairline row borders, Valuevade column highlighted with `color-mix()` primary rails, `YES / NO` cell markers now use mono uppercase labels alongside the check/minus icon. Added a datagrid footer strip ("SRC · PUBLIC LISTINGS · REVIEWED Q1 2026 · 10 ROWS · 5 COLS"). Pricing wedge converted from rounded glass-card to `lv-panel` with mono `THEIRS / VALUEVADE` readouts and serif italic "30× less." pull-quote.

All content copy, data rows, and data-testids preserved verbatim. Verified via screenshots at 1440×900 — the entire visible landing now reads as a cohesive editorial finance product.


## Feb 2026 — Editorial finance / Bloomberg-terminal redesign (above-the-fold)

User feedback: "misaligned and ugly on laptop screen … website looks vibe coded … change landing page design to more visual cinematic". Confirmed scope: hero + all above-the-fold (Navbar, HeroSection, ProblemSection). Direction: Bloomberg-terminal / editorial finance. Content unchanged; only visuals.

Design blueprint (from `design_agent_full_stack` → `/app/design_guidelines.json`) implemented:

- **Global utility CSS** appended to `landing-dark.css`: `.lv-terminal-grid` (2-layer dot-matrix backdrop), `.lv-crt-scan` (scanline overlay), `.lv-panel` (sharp 1px card with Bloomberg-style corner tick marks), `.lv-live-dot` (pink 6px pulse), `.lv-ticker-track` (60s marquee, pauses on hover), `.lv-sparkline-path` (path-draw + drift animation), `.lv-chapter` (mono uppercase section rail), `.lv-cta` (2px-radius mono uppercase CTA), `.lv-nav-link` (mono uppercase link with 1px underline reveal), `.lv-statusbar` (top status row), `.lv-progress-readout`. Strict `prefers-reduced-motion` guards.
- **Navbar** (`Navbar.js`) rewritten: added a top Bloomberg-style status bar with live-dot + NIFTY / SENSEX / USD-INR / GOLD tickers + timestamp. Nav links converted to mono-uppercase (`.lv-nav-link`). Sign-up CTA converted to sharp 2px-radius `.lv-cta` pill with mono label. Mobile overlay kept identical (out of scope).
- **HeroSection** (`HeroSection.js`) rewritten: replaced page-eating 96px H1 + floating blobs / orbitals / twinkling stars / blinking cursor with a **12-col editorial grid** (7-col headline / 5-col terminal panel). H1 clamped to `clamp(38px, 5.4vw, 76px)`. Serif italic accent "Financial" retained but with a coloured 2px underline for editorial signature. Motion restrained to word fade-in. Backdrop: dot-matrix grid + CRT scanline + a single low-opacity SVG chart line with animated dash-draw. Right side: **Bloomberg terminal-style Roadmap panel** with `LIVE` dot, `ROADMAP // STUDENT PATH` header, mono `FROM / BUILD / TARGET` sections, mid-panel sparkline, numeric `PROGRESS · 68% · 143/210` readout. CTAs: sharp mono `START FREE SESSION →` primary and text-arrow secondary. Trust strip converted to mono uppercase with pipe dividers. Bottom-of-hero: 10-symbol equity ticker marquee.
- **ProblemSection** (`ProblemSection.js`) rewritten: matching `§02 // WHY VALUEVADE` chapter rail. H2 kept verbatim ("Your college prepared you for exams. Not for a finance career.") with "Not" now serif-italic in primary colour. 3 cards converted from pillowy `glass-card` (2xl radius) to sharp `.lv-panel` (2px radius, corner ticks, 1px borders) with `01 · ROADMAP` / `02 · MARKET` / `03 · AI` mono prefixes, framed square icons (no gradient wash), and a hairline data footer per card ("GAP · 01" / "CLOSED BY VALUEVADE"). Retained the sticky-scroll Three.js assembly scene but dialled back to 50% opacity so it doesn't compete with copy.
- **LandingPage.js**: the always-on `<LandingHero3D />` (constellation particles that were colliding with the italic "Financial" word) is now gated off (`{false && (...)`). Editorial hero ships its own restrained backdrop.

All data-testids preserved. All copy verbatim. All Link targets unchanged. Verified at 1440×900, 1920×900, and 390×900 mobile via screenshot tool — all three viewports render cleanly, italic accent aligns, roadmap panel sits within grid, ticker scrolls, dot-matrix grid subtle enough not to compete.


## Feb 2026 — Competitor table filled + landing cleanup + module casing fix

Follow-up to the 4-prompt SEO/GEO rebuild, closing out the P0/P1/P2 backlog items:

- **P0 — Competitor comparison table (CourseDetailsPage.jsx)**: Replaced the 8 "—" placeholder cells with verified, directional figures for WallStreet School, IFMC, Coursera, and Imarticus / Upgrad across 9 feature rows (added new "Format" row). Pricing figures per user brief: WSS ₹45,000+ · IFMC ₹10,000–₹35,000+ · Coursera ₹4,000–₹7,000/month · Imarticus / Upgrad ₹1,00,000+. Footnote rewritten from "founder will fill later" to a directional-figures disclaimer telling readers to verify on each provider's site. Verified via preview screenshot on `/course/5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c`.
- **P1 — Dead waitlist code stripped from LandingPage.js**: Removed `showConfirmation`/`waitlistData`/`refCode` state, the unreachable `handleWaitlistSubmit` axios call to `/api/waitlist`, `scrollToWaitlist`, the `WaitlistConfirmation` early-return branch, unused `axios` and `API` imports, and the `WaitlistConfirmation` component import. Also dropped the dead `onJoinWaitlist` prop declarations from `Navbar.js` and `HeroSection.js`, and the dead `onSubmit` prop passing to `FinalCTASection`. Lint clean. Landing page verified rendering.
- **P2 — ALL-CAPS module titles normalized in Supabase `master_modules`**: One-off idempotent migration script `/app/backend/_normalize_module_titles.py` PATCHes 7 modules (M3, M7, M8, M9, M10, M11, M20) from ALL-CAPS to Title Case, matching the casing convention of the other 14 modules. Script only updates rows whose current title exactly matches the old ALL-CAPS value, so re-running is safe. Verified in Supabase + on the live syllabus screenshot.


## Aug 25 2026 — Post-rebuild trims + dedicated Free Mock page

Follow-up work after the 4-prompt SEO/GEO rebuild:

- **Saarthak's credential clause filled in** (WhoBuiltThisSection.jsx + homepage "Who teaches the course?" FAQ answer in Supabase + static faqs.js). Clause reads: qualified CA + CMA US + ACCA (UK), close to 5 years teaching finance faculty roles at Grant Thornton Bharat / FinTram Global / Zell Education / QuintEdge and earlier at The Narayana Group and Byju's Learning App. Source: LinkedIn profile confirmed by founder. TODO comment removed.
- **Arnav Aggarwal founder paragraph REMOVED** from WhoBuiltThisSection.jsx (2 blocks remaining: instructor credentials + NISM/CFI external standards). Founder mention also removed from the "Who teaches the course?" FAQ answer (both static and Supabase).
- **New public page /free-mock-interview** — dedicated marketing landing for the 1-time free equity-research mock interview trial. New file `FreeMockInterviewPage.jsx` wraps the existing `FreeTrialCTA` section with:
  * SEO-optimised H1 "Try a full analyst mock interview. Free." + verbatim 5-rounds paragraph + trust strip ("30-45 min · Voice + Excel · Instant AI scorecard")
  * 5-round walkthrough grid (Application / Aptitude / HR / Technical / Case study)
  * embedded FreeTrialCTA (email-capture, no new backend surface)
  * "What you walk away with" 4-bullet outcomes list
  * Fine-print eligibility strip
  * Secondary CTA → paid course details page ("Liked the trial? See the full course · ₹1,500 lifetime")
  * Full Navbar + Footer chrome (unlike the chromeless guest player)
  * Per-route Helmet: title / description / self-canonical / OG / Twitter
- **Navbar link added** — "Free Mock" with a small pink pulse dot for lead-gen prominence, on both desktop (data-testid `nav-link-free-mock`) and mobile menu (data-testid `mobile-nav-free-mock`). Placed second in the primary nav order (after Courses).
- **Sitemap.xml + llms.txt updated** to include /free-mock-interview.
- **Preview verified** — H1 renders, canonical `https://valuevade.com/free-mock-interview`, 5 rounds render, embedded FreeTrialCTA form present, navbar link works, Arnav absent from Who Built This section, NISM Series XV present.


## Feb/Aug 2026 — Full public-page SEO/GEO rebuild (Prompts 1-4)

**Prompt 1** (technical foundation): Per-route Helmet titles/descriptions/self-canonicals across /, /courses, /course/:id. Fixed /courses→homepage canonical bug (removed the global canonical from public/index.html; each route now sets its own). `useCountUp` initializes to target value so prerender snapshot shows real numbers (was "0"). Removed public/index.html `<meta keywords>`. Footer year updated to 2026. Blinking H1 cursor "|" now gated on client-mount so prerender snapshot has clean headline. robots.txt allows OAI-SearchBot/ChatGPT-User/Claude-SearchBot/Claude-User/PerplexityBot/Perplexity-User/Googlebot/Bingbot and keeps GPTBot/ClaudeBot/Google-Extended/CCBot allowed. sitemap.xml lists /, /courses, /course/5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c with lastmod 2026-08-25. /llms.txt created. Data surface: 21 active modules · 239 sessions in DB. User chose reconciliation (a): ship "21 modules" everywhere.

**Prompt 2** (homepage): Full copy replacement. New Helmet + hero (H1: "The Equity Research & Financial Modelling Course Built for Indian Finance Students", verbatim subhead + paragraph + CTAs + trust line). Beta badge / waitlist form / "500+ students" social proof / "CFA Institute aligned" trust text / "68 finance simulations" Twitter description all removed. "DSP Blackrock" → "top Indian AMC". Problem section + FeaturesSection all cards rewritten verbatim. NEW: WhatYoullLearnSection + WhoBuiltThisSection (with instructor/founder/standards paragraphs; TODO comment marks where Saarthak's credential clause goes). Comparison table's Valuevade column updated (price, duration, sims, cert-prep row + label rename). Free Trial CTA retitled + JPM references removed. Final CTA rebuilt around signup link. Footer socials: Instagram + LinkedIn (linkedin.com/company/valuevade) + X (x.com/valuevade); YouTube icon (was `#`) removed. Homepage FAQ rebuilt to 11 verbatim entries — 8 new + 3 preserved — in Supabase `faqs` table (DELETE+INSERT) AND in static /app/frontend/src/data/faqs.js. "Last updated: 25 August 2026" line added to FAQ header. Mobile sticky bar retargeted from waitlist scroll to /signup with "₹1,500 lifetime · Free first session".

**Prompt 3** (courses catalog + course details): /courses duplicate "Choose Your Career Path" H2 removed. Course details page fully rebuilt: new Helmet (title/desc), breadcrumb Home > Courses > Program, static H1 "Equity Research Analyst Program — Financial Modelling & Valuation Course", verbatim description + audience line + CTA + "₹1,500 lifetime · No subscription" trust, syllabus renamed with 3 named capstone deliverable rows appended, "What you'll be able to do" 8-bullet outcomes list, "How the course works" paragraph, "Certificate & external standards" 3-card block, embedded `WhoBuiltThisSection`, "What you'll walk away with" 3-card capstone showcase (with `TODO: embed real sample excerpt` markers), "Frequently asked questions" 13-Q accordion (data-driven from module-scope `COURSE_DETAILS_FAQS`), 8-row "How Valuevade compares" deep table (competitor cells "—", founder to fill after verification).

**Prompt 4** (schema + legal + QA): JSON-LD rewrite. Homepage now ships ONLY EducationalOrganization + FAQPage (sameAs = IG + LinkedIn + X; FAQPage from same Supabase source as visible accordion via `buildFaqPageJsonLd(faqs)`). Course details ships Course + BreadcrumbList + FAQPage (all via `landing/jsonLd.js` builders; FAQPage from same `COURSE_DETAILS_FAQS` constant). Removed conflicting legacy WebSite + Organization JSON-LD blocks from public/index.html. NO aggregateRating, NO Review markup anywhere. Legal pages created at /privacy /terms /refund-policy — all DRAFTs with `DRAFT - requires founder review before production` HTML comment inside; wired into App.js routing and linked from Footer. Privacy policy honestly covers: Supabase auth+DB, Razorpay (no card data stored), no 3rd-party analytics currently, LLMs via Emergent key (no training path), DPDP-Act 30-day delete SLA, governed by India / Delhi jurisdiction. Terms of Service covers: ₹1,500 personal-use lifetime licence, no job guarantees, IP, limitation of liability up to ₹1,500. Refund Policy uses the "free first session as trial → no-refund-after-access by default → case-by-case exceptions (duplicate charges, our-side outages, regulatory)" model.

**NISM correction (mid-Prompt 4)**: user clarified NISM Series XV (Research Analyst), not Series VIII. Batch replaced across all frontend files + static faqs.js + Supabase `faqs` table (3 rows patched) + llms.txt. Doc's canonical fact set was wrong; DB module title was right.

**Numeric corrections found in final QA sweep** (Prompt 4 step 3): CourseCompletePage.jsx and AdminPanel.jsx still said "22 modules / 246 sessions" from the pre-rebuild era — fixed to 21/239. 

**Known accepted trade-offs**:
- Waitlist dead code (WaitlistConfirmation import, handleWaitlistSubmit, axios.post(/waitlist) call, `id="waitlist"` anchor) still lives in `LandingPage.js` and `FinalCTASection.js` — the trigger form is deleted so it never fires, but grep matches. Left per no-over-refactor rule; safe to clean up later.
- TestimonialsSection stat "500+ Students on Waitlist" untouched (user's `{TESTIMONIALS}` slot was unanswered → "leave unchanged" rule).
- "Prices last verified: …" line under comparison table omitted (user's slot value "1500rs" didn't semantically fit the "date" field).
- Instructor credential clause omitted per instructions (TODO comment placed).
- Module titles in DB are inconsistent (some ALL-CAPS, some Title Case) — displayed as stored; not touched.
- Deep comparison table competitor cells left as "—" for founder to fill after verification.
- Legal pages are DRAFTS marked with `DRAFT - requires founder review before production` HTML comments.


## Feb 2026 — Guest (no-signup) free trial mock interview at /free-trial/{trialId} (iteration_56)

- REPLACED the old auto-signup free-trial flow: /free-trial/{trialId} now renders `GuestInterviewPlayer` directly — no Supabase account creation, no dashboard, no hub, no sidebar.
- New backend module `/app/backend/guest_interview_sim_endpoints.py` — stateless endpoints under `/api/guest-sim/{trial_id}/*` (sim, application, aptitude/start, aptitude/submit, interview/begin, interview/answer, case/submit, tts). Aptitude answers held in an in-memory LRU cache keyed by trial_id (TTL 30 min, cap 500).
- New frontend `/app/frontend/src/components/GuestInterviewPlayer.jsx` — persists full state in `localStorage['guest-sim:{trialId}']` and reuses the existing stage components via a new `simApi` prop indirection.
- New `/app/frontend/src/components/interview-sim/simApi.js` — `buildAuthSimApi(attemptId)` (default for existing hub player) and `buildGuestSimApi(trialId, onStageComplete)` (new).
- Refactored ApplicationStage / AptitudeStage / InterviewStage / CaseStage to consume `simApi.endpoints.X` + `simApi.fetch` instead of hardcoded URLs + `interviewSimFetch`. DecisionStage accepts a `guestMode` prop to swap the "Back" destination between /interview-sims (auth) and / (guest). Backward-compatible: auth flow unchanged.
- useInterviewerVoice now accepts optional `ttsUrl` + `fetchFn` options — guest player passes `/api/guest-sim/{tid}/tts` + plain fetch.
- Test artifacts: `/app/backend/tests/test_guest_sim.py`, `/app/test_reports/iteration_56.json`.
- Known trade-offs (accepted): (1) aptitude cache is per-backend-worker — if backend restarts mid-aptitude, user must restart the round; (2) guest endpoints have no per-IP rate limit yet — a scraper could burn LLM quota via /guest-sim/*/tts. Consider adding a signed trial token + rate limit in a follow-up.


## Feb 2026 — Free Trial mock interview flow VERIFIED (iteration_55)

- Landing FreeTrialCTA + /free-trial/{trialId} auto-signup + /provision endpoint verified end-to-end.
- Backend `POST /api/free-trial/start` returns 200 with trial_id (400 on invalid email). Uses `waitlist` fallback when `free_mock_trials` table missing.
- Backend `POST /api/free-trial/{trial_id}/provision` (auth required): idempotently sets up M20 enrollment + user_module + 3 completed sessions + `user_payment_status.paid=true` (pricing_tier='trial'). Hub renders UNLOCKED after this call.
- InterviewSimHub recovery button (`hub-unlock-trial-btn`) rendered inside `hub-locked-banner` only when `localStorage.vv_free_trial_id` exists.
- Test artifacts: `/app/backend/tests/test_free_trial.py`, `/app/test_reports/iteration_55.json`.
- Known perf note: first paint of /interview-sims after fresh signup takes ~10-15s due to badge/enrollment prefetch chain. Flow works but funnel-perceived latency is high — future optimization.
- Known abuse-guard: `/free-trial/start` returns 409 when same IP-hash bucket has an existing trial. Could soft-block legitimate shared-wifi users; consider fingerprint-only bypass in future.


## What's been implemented (2026-07-10)

### Video-upload bug fix (verified via testing_agent iteration_21 — 9/9 pytest pass)
- Backend `POST /api/admin/sessions/{id}/video-url` now accepts ANY https URL (previously required Supabase bucket path). Enables externally-hosted videos (YouTube / Vimeo / Cloudflare Stream / Mux / BunnyCDN).
- Backend `_MAX_VIDEO_BYTES` raised 500 MB → 5 GB.
- Frontend `VideoEditor.jsx`: added **"Use URL"** button + panel with `data-testid=video-url-{btn,panel,input,save,close}`.
- Frontend `AdminPanel.jsx` Session-Videos tab: per-row **"URL"** button (`admin-video-url-{id}`) that prompts and saves.
- 413 response now shows a clearer message directing admin to the URL workaround.
- Updated `tests/test_admin_video_signed_url.py` — external-URL branch now expects 200 (not 400) and max_bytes = 5 GB.

### MVP 2.0 Part A — missing sims (14 sims generated so far, script running in background)
- Script: `/app/scripts/generate_missing_sims.py`
  - Audit: 148 sessions missing sims across 22 modules.
  - Heuristic classifier maps title/desc/module → `excel` / `decision_making` / `book`.
  - LLM: Claude Sonnet 4.5 generates JSON per type (decision points, book chapters, Excel workbook + expected answers).
  - `book` stored as `sim_type='document'` with `config.format='book'` because the DB CHECK constraint on `master_simulations.sim_type` forbids `'book'`.
- Frontend router (`SimulationPage.jsx`) picks `BookSim` when `sim_type='document' && config.format==='book'`, else `DocumentSim`.

### MVP 2.0 Part B — Excel rebuild
- New `/app/frontend/src/components/simulations/HyperFormulaSpreadsheet.jsx`
  - HyperFormula engine for formula parsing & evaluation.
  - Virtualized grid via `FixedSizeGrid` (react-window 1.8.11).
  - Formulas: SUM/AVG/MIN/MAX/COUNT/IF/VLOOKUP/ROUND/CONCAT + arithmetic.
  - Absolute/relative refs (`$A$1`, `$A1`, `A$1`), ranges (`A1:B10`).
  - Drag-fill (autofill) w/ series detection + relative formula shifting.
  - Multi-sheet (add / rename / delete / switch).
  - Copy/paste, undo/redo, keyboard nav (arrows, Enter, Tab, F2, Delete).
  - Auto-grader (per-cell expected_value + tolerance + points).
  - Cap 100 rows × 26 cols; errors render as `#REF!` / `#DIV/0!` / `#NAME?`.
- `ExcelSim.jsx` swapped `SpreadsheetSim` → `HyperFormulaSpreadsheet`.
- `BookSim.jsx` — chaptered read-through with reflection prompts + MCQ checkpoints + final reflection.

### Env changes
- `/app/backend/.env` — added `REACT_APP_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EMERGENT_LLM_KEY`.
- `/app/frontend/.env` — added `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`.

## Backlog / Next tasks
- P0: Let the background script finish generating the remaining ~130 sims. Verify a few of each type render correctly.
- P0: Manual QA of the Excel rebuild (drag-fill vertical/horizontal, VLOOKUP, IF, undo/redo, multi-sheet).
- P1: Delete the now-unused `SpreadsheetSim.jsx` + `excelFormula.js` + `excelSimAdapter.js` once the new engine is confirmed stable across all existing Excel sims.
- P1: Book renderer regression test on legacy `sim_type='document'` sims (should still use `DocumentSim`).
- P2: Optionally upgrade Supabase project to Pro so direct video uploads > 50 MB work without external URL.

## Feb 2026 update — Course Complete QA seed + confetti polish

- Created `/app/scripts/seed_qa_complete_user.py` — idempotent seed for a
  dedicated QA user (`qa-complete@valuevade.test` / `QaComplete2026!`,
  full_name "Priya Kapoor", user_id `d0ab804b-...`) with an active
  enrollment and all 3 `master_capstone_projects` marked `is_completed=true`
  on their `user_capstone_projects` rows. Enrollment ID
  `c179f15d-2177-44b3-a855-8e6881139e93`.
- Fixed a latent detection bug in `CourseCompletePage.jsx`:
  the query selected `capstone_id` (nonexistent column) — replaced with
  `master_capstone_id`. Without this fix the "Congratulations" branch could
  never render for a real user.
- Added `canvas-confetti` burst on the Congratulations branch: center
  burst + two side cannons + a soft trailing burst, colors matched to
  brand palette. Fires exactly once (guarded by ref), respects
  `prefers-reduced-motion`.
- Test credentials file updated with the QA account (§ "QA — Course Complete").
- Visually verified via screenshot tool: headline renders, 3/3 capstones
  tile, cert panel shows "issued to Priya Kapoor · dated 12 July 2026",
  confetti particles visible mid-animation.

## Feb 2026 — Waitlist migration Mongo → Supabase (bug fix)

**Bug**: `/admin-panel?tab=waitlist` on production only showed 3 signups instead
of 15+. Root cause: waitlist was stored in the deploy container's Mongo
(`db.waitlist`), which is ephemeral on Emergent redeploys, so historical
entries were wiped every redeploy.

**Fix**:
- New SQL migration `/app/scripts/migrations/0031_waitlist.sql` — creates
  `public.waitlist` with the same column shape as the old Mongo docs
  (`id, first_name, email, position, timestamp, referral_code, referral_count,
  referred_by`), unique indexes on `lower(email)` and `referral_code`, RLS
  enabled + service-role-only access.
- Backend endpoints migrated from `db.waitlist` → `_supabase_*` helpers:
    - `POST /api/waitlist` (join, idempotent on email)
    - `GET  /api/waitlist/all` (legacy JWT-protected)
    - `GET  /api/waitlist/count` (uses PostgREST HEAD + count=exact)
    - `DELETE /api/waitlist/{id}`
    - `GET  /api/admin/waitlist` (Supabase auth)
- **New endpoint**: `POST /api/admin/waitlist/import` — takes `{csv: "..."}`
  body, batch-inserts to Supabase, skips existing emails, regenerates
  colliding referral codes, returns `{inserted, skipped_existing, errors[]}`.
- Frontend `WaitlistTab` gained an **Import CSV** button + modal
  (`waitlist-import-btn`, `waitlist-import-modal`, `waitlist-import-textarea`,
  `waitlist-import-submit`).

**Deployment required**: SQL migration must be applied to Supabase before the
production backend can serve any waitlist route. Two ways:
1. Supabase Studio → SQL Editor → paste `0031_waitlist.sql` → Run.
2. `SUPABASE_MGMT_PAT=sbp_... python3 scripts/migrations/apply_migration_via_api.py 0031_waitlist.sql`

After that, user redeploys the app + uses the new "Import CSV" button to
paste the Mongo export.


## Feb 2026 — LLM Limits + Capstone Bug Fix + Pari Focus Mode

**User requirements (this session)**:
1. Personalised path generation capped at **4 lifetime** per user.
2. Pari chatbot cumulative LLM cost capped at **₹500** per user; once
   exceeded, Pari is disabled everywhere.
3. Capstones **locked** until every session + module project is done.
4. Pari **hidden** during quiz / interview / simulation active pages.
5. **Bug fix**: capstone pages were rendering "No capstone configured"
   because the multi-capstone (CAP-01/02/03) flow only checked for a
   single legacy user_capstone_projects row.

**Implementation**:
- Migration `0036_llm_limits.sql`: adds
  `profiles.customize_generations_count`, `profiles.pari_total_cost_inr`,
  RPCs `increment_customize_generations(uuid)` and
  `add_pari_cost(uuid, numeric)`, plus a backfill of
  `user_capstone_projects` for every (enrollment, master capstone).
  **NOT applied automatically** — requires Supabase Studio SQL Editor.
- Backend (`server.py`):
  - Helpers `_profile_snapshot`, `_pari_is_over_budget`, `_bump_pari_cost`,
    `_bump_customize_generations` (graceful degradation on missing columns).
  - New endpoint `GET /api/pari/status` returns
    `{pari:{total_cost_inr, limit_inr, over_budget, remaining_inr},
      customize:{generations_used, generations_limit, generations_remaining, exhausted}}`.
  - `/api/customize/generate` now requires `Authorization: Bearer`.
    Returns HTTP 429 with `detail.reason='customize_generation_limit_reached'`
    once count ≥ 4.
  - `/api/doubts/start`, `/api/doubts/ask`,
    `/api/doubts/extended/start`, `/api/doubts/extended/ask` return HTTP
    402 with `detail.reason='pari_cost_limit_reached'` when
    `pari_total_cost_inr ≥ 500`.
  - Every non-cached LLM turn calls `_bump_pari_cost` with a Claude
    Haiku 4.5 pricing estimate (input $1/M, output $5/M @ INR 85/USD).
- Frontend:
  - New hook `useIsPariBlocked` matches `/session/:id/{quiz|interview|simulation}`
    and `/mock-interview[/:id]`.
  - `DoubtsLauncherProvider` fetches `/api/pari/status` on mount, blocks
    `openDoubts` on those routes or when over-budget, and surfaces a
    toast to the user.
  - `AvatarPersona` (fixed positions) and `AskPariButton` both return
    null when `pariBlocked` — no floating chat trigger on graded surfaces.
  - `DoubtsSession` handles HTTP 402 inline (turns the session into an
    error state, blocks further messages).
  - `CustomizePage` shows a counter chip
    (`data-testid=customize-generation-counter`) with used/limit/remaining
    on the final wizard step. Button disabled when exhausted.
  - `PreviewPage` sends the Supabase Bearer token and handles 401/429.
  - `CapstonesListPage` fully locks the capstone grid behind an amber
    banner until every module + module project is complete. Card clicks
    now route to `/capstone/<masterCapstoneId>/start`.
  - `CapstoneStartPage` and `CapstoneTasksPage` accept `:capstoneId`,
    filter `user_capstone_projects` by (enrollment_id,
    master_capstone_id), and **auto-seed** a missing row so CAP-02/03
    never fall back to "No capstone configured".
  - `App.js` exposes new routes `/capstone/:capstoneId/start` and
    `/capstone/:capstoneId/tasks` (legacy routes preserved).

**Testing**: `iteration_33.json` (9/9 backend PASS, capstone bug + Pari
focus-mode verified) → `iteration_34.json` (regression on locked/unlocked
`/capstones` gate — 100% PASS).

**Deploy note**: For the cost / generation caps to actually enforce,
apply `0036_llm_limits.sql` via Supabase Studio → SQL Editor. Until then
the counters read 0 and every call passes through (graceful degradation
is intentional — no user gets locked out because of a missing column).



## Feb 2026 — Session-level Interview phase disabled (cost reduction)

**Rationale**: `/api/interview/evaluate` was the platform's only Claude
Sonnet 4.5 (5× the price of Haiku) call path. Hiding the phase for
learners cuts per-user AI cost by **~40-45%** with zero data loss — all
126 interview-bearing sessions also have quiz + simulation + notes, so
nothing gets stranded. Session-interviews previously awarded 0 direct
XP (comment: "interview pays via overall feedback"), so no XP
redistribution was required.

**Implementation** (fully reversible via a single feature flag):
- New flag `SESSION_INTERVIEW_ENABLED = false` in
  `frontend/src/utils/sessionPhases.js`. Also exports
  `SESSION_PHASE_ORDER = ['notes','quiz','simulation']`.
- `utils/progress.js`: `allDone` gate no longer requires
  `interview_completed`; `PHASE_ORDER = ['notes','quiz','simulation']`.
  `getNextPhaseRoute` naturally skips interview.
- `SessionPhaseGuard.jsx`: `PREV_PHASE.simulation = 'quiz'`; the
  legacy `interview` key redirects forward to `simulation/start`.
- `QuizCompletePage.jsx`: default `nextRoute` = Simulation.
- `DashboardPage.jsx`, `SessionStartPage.jsx`, `SessionCompletePage.jsx`,
  `useSessionTimer.js`: interview phase removed from all phase lists
  and progress bars. Copy updated to "3-phase journey" / "all 3 phases".
- `NotesCompletePage.jsx`: badge says "Phase 1 of 3 done".
- `App.js`: `/session/:sessionId/interview[/start|/complete]` routes
  replaced with an `InterviewToSimulation` wrapper that reads
  `useParams().sessionId` and Navigates absolutely to
  `/session/${sessionId}/simulation/start` (avoids the React Router v6
  flat-route `..` pitfall which was flagged as CRITICAL in
  iteration_35 and fixed in iteration_36).
- Backend `server.py::evaluate_interview_response`: raises HTTP 410
  Gone with `detail.reason='session_interview_disabled'`. Legacy body
  preserved unreachable so re-enable is a one-line revert.

**What was deliberately NOT touched**:
- `master_interview_questions` Supabase table — data preserved.
- Admin panel interview-question CRUD — still fully functional.
- `InterviewPage.jsx`, `InterviewStartPage.jsx`,
  `InterviewCompletePage.jsx` — code intact on disk.
- Existing `user_sessions` rows with `interview_completed=true` — the
  new `allDone` gate ignores that column gracefully.
- `/api/mock-interview/*` (Haiku) — untouched and still the recommended
  interview practice surface.

**Testing**: `iteration_35.json` (found 1 CRITICAL Navigate bug + 2
copy issues) → `iteration_36.json` (100% pass on all 3 fixes).

**Expected per-user cost after this ship**:
| Profile | Before | After |
|---|---|---|
| Typical user | ~₹165 | **~₹90** (~45% cheaper) |
| Power user | ~₹425 | **~₹250** (~40% cheaper) |
| Absolute worst-case with existing caps | ~₹600 | **~₹380** |

To fully close the gap, next step is extending the ₹500 profile-level
cap to also attribute mock-interview cost (currently only Pari doubts
+ customise contribute). That would yield a true single ceiling.



## Feb 2026 — LinkedIn-share Rewards Engine

**User request**: When a learner completes a module project (defaults:
Module 1, Module 10, Module 23 / final) or the first capstone (CAP-01),
show a card offering a free resource (resume template, IB toolkit, etc.)
in exchange for sharing the milestone on LinkedIn. Admin can add/edit/
reorder/delete rewards, re-attach them to different modules, and upload
files up to 25MB (pdf/docx/xlsx/zip).

**Implementation**:
- **DB migration `0037_rewards.sql`** — `master_rewards`
  (trigger_type = module_complete | capstone_complete, trigger_ref_id,
  resource_file_path, linkedin_message, order_index, is_active) +
  `user_reward_claims` (unique per user × reward) + private storage
  bucket `rewards`. RLS: learners read active rewards + read/insert
  their own claims; service_role writes.
- **Backend** (`wave_endpoints.py` +240 lines) —
  learner API: `GET /api/rewards/eligible`, `POST /api/rewards/claim`,
  `GET /api/rewards/{id}/download` (re-issues signed URL);
  admin API: `GET/POST/PATCH/DELETE /api/admin/rewards`,
  `GET /api/admin/rewards/triggers` (populates dropdowns),
  `POST /api/admin/rewards/upload` (25MB max + MIME whitelist,
  service_role → Supabase Storage). Server-side eligibility check on
  every claim so the FE can never fake it. All endpoints degrade
  gracefully if the migration hasn't run (return `table_ready:false`
  with a hint).
- **Frontend** —
  new shared `components/rewards/RewardCard.jsx` handles the whole
  "Share on LinkedIn → I've shared → download" flow. Uses a standard
  (non-AI) post template — admin can override per reward.
  Wired into `ModuleProjectCompletePage.jsx` (fetches
  `master_module_id` from `user_modules`) and `CapstoneCompletePage.jsx`
  (uses `capstone.master_capstone_id`).
- **AdminPanel** — new "Rewards" tab (alongside FAQ, Customisation,
  Feedback). Full CRUD + upload + toggle active + reorder via
  `order_index`. Editor modal populates trigger-target dropdowns from
  `/api/admin/rewards/triggers` and validates before save.

**Bug found & fixed during testing (iteration_37)**:
FastAPI 422 on every `/api/rewards/claim` because
`_RewardClaimReq(BaseModel)` was declared *inside* the
`register_wave_endpoints()` closure — FastAPI's dependency inspector
can't classify function-locally-defined BaseModels as request bodies,
so it fell back to treating them as query params. Fixed by switching
to the `body: dict` + explicit `.get(...)` pattern used by every
sibling endpoint in the same file. Reproducible with a plain curl.

**Testing**: `iteration_37.json` — 100 % pass on 16 backend tests
(auth guards, admin-CRUD gating, upload, graceful-degradation, abuse
guards, idempotency) + 100 % pass on the admin-panel Rewards tab +
RewardCard null-when-no-reward FE checks. Full E2E (LinkedIn share →
claim → download) blocked only until the user applies migration 0037.

**Deploy note**: apply `/app/scripts/migrations/0037_rewards.sql` via
Supabase Studio → SQL Editor. Then in AdminPanel → Rewards tab, click
"Add Reward" for each of Module 1 / Module 10 / Module 23 / CAP-01,
upload the file, and set the LinkedIn post. Learners on those trigger
events see the reward card automatically.


## Jun 2026 — Excel simulation rebuilt on Univer (real-Excel experience)

**User request (previously missed, P0)**: "create the full excel simulation
like a real excel with all the real excel functionalities accurately...
it should work perfectly and operate smoothly". Pain points: formulas not
calculating, drag-fill not working, paste failing.

**Implementation**:
- New `/app/frontend/src/components/simulations/UniverSpreadsheet.jsx`
  built on **Univer 0.25.1** (`@univerjs/presets` + core/filter/sort/
  find-replace presets, `rxjs` peer dep added). Real Excel UI out of the
  box: ribbon toolbar (Start/Formulas/Data), formula bar + name box,
  500+ functions, cross-sheet refs (`Data!B2:B11`), cell formatting,
  number formats, column/row resize, merge, freeze, filters, sorting,
  find & replace, drag-fill/autofill, clipboard paste (incl. from real
  Excel), undo/redo, multi-sheet tabs, right-click menus, dark mode
  (auto-detected from the app's `.dark` class).
- `ExcelSim.jsx` + `DevSimPreview.jsx` swapped from
  `HyperFormulaSpreadsheet` → `UniverSpreadsheet` (identical props
  contract; old component left on disk).
- Canonical workbook → Univer `IWorkbookData` converter with styles:
  bold headers (violet), read-only cells (grey), answer cells (amber).
- **Read-only protection**: `BeforeSheetEditStart` cancel on protected
  cells; `BeforeClipboardPaste` cancel when paste lands on protected
  ranges; `BeforeCommandExecute` soft-cancel (`event.cancel = true`,
  NEVER throw — throwing surfaced CRA's error overlay, found in
  iteration_38) for structural commands (remove/rename sheet,
  insert/remove rows/cols, move) on exercise sheets and all mutations
  after submit.
- **Auto-grader kept**: reads computed values via facade
  `getRange(addr).getValue()`, same tolerance/points logic, colours
  graded cells green/red, same score banner + testids
  (`spreadsheet-submit-btn`, `spreadsheet-score-banner`, ...).
- **Autosave/restore kept**: state v2 = `{version:2, univer_snapshot,
  pivot_states}` via existing `/api/simulations/workbook*` endpoints;
  legacy v1 drafts (`{sheets:[{name,cells}]}`) merge into the canonical
  workbook before conversion. Verified E2E on
  `/session/:id/simulation` (typed value → autosave → reload → restored).
- Pivot sheets (1 sim) render via an outer tab strip → `PivotTableSheet`
  (previously they rendered as an empty grid — regression fixed for free).
- **StrictMode gotcha**: Univer must be disposed *synchronously* in the
  effect cleanup. A deferred (`setTimeout`) dispose kills the second
  StrictMode mount's canvas → blank grid. The resulting React
  "synchronously unmount a root" console warning is dev-only noise.

**Testing**: `iteration_38.json` (~92% pass; 1 HIGH: throw-based command
guard triggered error overlay → fixed with `event.cancel`) + manual
verification of the fix, autosave/restore on the real session route, and
post-submit lock without overlay. Test user session
`7b6958fc-e468-427a-b4cd-514ebe8d4cfd` (M1 "Navigate the Grid") has
notes/quiz flags set true to allow direct simulation-phase access.


## 2026-02-XX — LinkedIn Rewards: mandatory post-URL proof

**Goal**: A reward can no longer be unlocked by merely "clicking share".
The learner must paste the actual URL of the LinkedIn post they published,
which the backend validates and persists for admin audit.

**Migration** `0038_reward_claim_post_url.sql` — applied to production
Supabase via Management API:
- Adds `user_reward_claims.linkedin_post_url text` (nullable at DB level;
  backend enforces required for new claims → keeps forward-compat with any
  historical rows).
- Adds `user_reward_claims_reward_idx (reward_id)` for the new
  `/admin/rewards/{id}/claims` audit endpoint.

**Backend** (`wave_endpoints.py`):
- `_LINKEDIN_POST_RE` regex accepts `linkedin.com/{posts|feed/update|pulse
  |embed/feed/update}/…` (with or without subdomain / www).
- `POST /api/rewards/claim` now requires `linkedin_post_url` in the body,
  validates it (400 + `reason: linkedin_post_url_required` /
  `linkedin_post_url_invalid`), and stores it via an upsert on the
  composite unique constraint (`?on_conflict=user_id,reward_id`,
  `resolution=merge-duplicates`) so a re-submission can correct a mistyped
  URL.
- `GET /api/rewards/eligible` now returns `linkedin_post_url` on claimed
  rewards so the FE can render a "View your shared post" link.
- `GET /api/admin/rewards` — each reward row now includes `claim_count`.
- New `GET /api/admin/rewards/{reward_id}/claims` — admin-only, returns
  all claim rows with `linkedin_post_url` + resolved `user_email` /
  `user_name` for spot-checking.

**Frontend** (`RewardCard.jsx`):
- Adds a required URL input (`reward-post-url-input`) between the
  Share button and the Unlock button.
- Client-side regex mirrors the backend; the Unlock button stays disabled
  until (a) the share intent was opened AND (b) a valid LinkedIn post URL
  is pasted.
- Backend 400 responses with `reason: linkedin_post_url_invalid` /
  `linkedin_post_url_required` are surfaced inline against the input.
- Claimed-state now shows a `Linkedin`-icon "View your shared post" link
  pointing at the stored URL.

**Verified**:
- 11/11 regex cases pass (posts, feed/update, pulse, subdomains, empty,
  profile URL, twitter URL, etc.).
- Backend restarts clean, `/api/rewards/claim` 401s without auth,
  ESLint + ruff clean on both files.

## 2026-02-XX — LinkedIn URL sanity-check + User-driven bug reports

### 1. LinkedIn URL content verification for rewards
The reward flow already required the learner to paste their LinkedIn post URL.
We now ALSO fetch that URL server-side to confirm it actually mentions
Valuevade (or the reward's own hashtag), which blocks learners from pasting
any random public LinkedIn post to farm the free resource.

- New helper `_verify_linkedin_post_content(url, keywords)` in
  `wave_endpoints.py` — fetches with a bot User-Agent
  (`ValuevadeRewardsBot/1.0 … facebookexternalhit/1.1`) that LinkedIn serves
  OpenGraph tags to; body is scanned for any keyword.
- Keywords come from `_reward_expected_keywords(reward)`: `{"valuevade"} ∪ #hashtags` parsed from `reward.linkedin_message`.
- Verifier is wrapped in `asyncio.to_thread` so blocking I/O doesn't stall the loop.
- Three outcomes:
  - `verified` → claim upserted with `linkedin_post_verified=true`.
  - `content_mismatch` (2xx but no keyword) → **REJECT** claim with 403 +
    `reason: linkedin_post_content_mismatch`.
  - `unreachable` (timeout / login wall / 5xx) → claim allowed but
    `linkedin_post_verified=false` so admin can review.
- Migration `0039_bug_reports_and_linkedin_verify.sql` adds
  `user_reward_claims.linkedin_post_verified boolean NOT NULL DEFAULT false`.
- `/api/admin/rewards/{id}/claims` now returns this flag for spot-checking.

### 2. User-driven bug reports
Extended the existing `error_reports` observability pipeline so users can
actively report bugs (not just uncaught crashes).

- Migration `0039` adds `error_reports.user_description text` and mirrors
  it on `error_report_events` (per-occurrence ledger).
- `error_type` CHECK constraint extended to include `'user_report'`.
- `POST /api/errors/report` now accepts `user_description` — for repeat
  reports on the same signature, descriptions are appended chronologically
  (newest first) so multiple learners can pile on one bug.
- New `BugReportButton.jsx` — floating pill (bottom-left, above the FAQ
  chatbot) visible only to authenticated users. Opens a compact panel with
  a required textarea + Send button. Uses `error_type='user_report'` so
  admins can filter these from crashes.
- `ErrorBoundary.jsx` now shows a **"Help us fix this"** panel on crash
  with a textarea → learner can add colour ("what were you doing?") and
  submit. Result is `{ok, id}` and a friendly success state.
- `errorReporter.js` — `reportError()` accepts `user_description` and
  bypasses the 5-second throttle when a description is present (user
  intent overrides noise-suppression).
- Admin `ErrorsTab.jsx` — added a **user** badge on rows where
  `error_type='user_report'`, a purple "User description" panel in the
  drawer, and description-based fuzzy search.

**End-to-end verified**:
- Curl → `POST /api/errors/report` with `user_description` returns 200 +
  row persisted with correct fields.
- Playwright login → click floating "Report a bug" → fill textarea →
  submit → "Thanks — our team has been notified." confirmation → row
  visible in Supabase with the correct URL and description.
- 11/11 LinkedIn URL regex cases still pass; verifier helper tested
  standalone with a real HTTP fetch.

## 2026-02-XX — Admin Errors Tab: noise-filter cleanup (iteration_39)

**Symptom**: 6 stale rows cluttering AdminPanel → Errors tab:
- 2× QA smoke-test `user_report` entries from own testing
- 1× "Submitted — the workbook is locked." (`promise`) — fixed in iteration_38 but the pre-fix report persisted
- 3× "Script error." (`runtime`) — cross-origin browser noise (browser strips message+stack for security)
- 2× "Loading chunk 7020 failed." (`react_boundary`) — chunk-load failure that already self-heals via `ErrorBoundary` hard-reload
- 4× "ReferenceError: Can't find variable: `_AutofillCallbackHandler`" — Safari iOS autofill bug (WebKit leaks the internal callback name)

**Fix (frontend-only, no backend change)**:
1. **`errorReporter.js`** — added `NOISE_PATTERNS` regex list + `isNoise(message, stack)` helper. Any error matching is silently dropped BEFORE the POST to `/api/errors/report`. Patterns:
   - `/^Script error\.?$/i` (cross-origin)
   - `/_AutofillCallbackHandler/i` (Safari)
   - `/^ResizeObserver/i` (framework spam)
   - `/Loading chunk [\w-]+ failed/i`, `/Loading CSS chunk/i`, `/Failed to fetch dynamically imported module/i`, `/Importing a module script failed/i`
   - Extension-origin stacks (`chrome-extension:`, `moz-extension:`, `safari-extension:`)
2. **User-driven reports bypass the filter** — when `user_description` is present, the reporter always sends (user intent > noise heuristics).
3. **`ErrorBoundary.componentDidCatch`** now checks `isChunkLoadError(error)` FIRST and skips `reportError` for chunk failures — they're deploy noise handled by the existing one-shot `sessionStorage`-flagged hard reload.
4. Silenced the 6 stale rows in Supabase (marked `resolved_at` + explanatory `resolution_notes` — using resolve instead of hard-silence so if any signature *does* recur it will regress and surface).

**Verified (testing_agent iteration_39, 7/7 pass)**:
- Dispatching synthetic `Script error.`, `_AutofillCallbackHandler`, and `Loading chunk 9999 failed.` ErrorEvents → **zero** rows created in `error_reports`.
- Dispatching a real `TestingAgent verification` runtime error → row created as expected.
- BugReportButton flow (login → click pill → fill description → submit) → row created with `error_type='user_report'` and correct description.
- Previously-resolved noise signatures still have `resolved_at NOT NULL` and `regressed_at NULL` (no regressions).
- ErrorsTab admin drawer render path still exposes `error-boundary-report-desc` + `error-boundary-report-submit` testids.

**Note (informational, not a bug)**: In dev/preview mode, CRA's runtime-error overlay activates on any `window.error` event and can obscure the UI until dismissed. Does not affect production builds where the overlay is stripped by CRACO.

---

## Module 20 — Full Interview Simulations (2026-07-27, verified via testing_agent iteration_40 — 100% pass)

### Requirement (user)
Module 20 "EQUITY RESEARCH INTERVIEW MASTERY" is a special mock-interview module: sessions are video+notes only (no quizzes/simulations — existing 75 quiz Qs + 7 sims HIDDEN, not deleted). After all video lectures, 5 FULL interview simulations (J.P. Morgan, Morgan Stanley, Goldman Sachs, Motilal Oswal, Kotak Institutional Equities), each replicating a real top-firm hiring process with AI feedback at every step and voice-answered interviews. Module completion REQUIRES all 5 sims finished. Admin panel marks the module as mock-interview.

### Pipeline per firm (max 2 attempts/firm, rejection counts as "finished")
application form → AI recruiter screening feedback → timed aptitude test (12 LLM-generated MCQs, 15 min, 40% cutoff, fail = realistic rejection) → HR/behavioural interview (4 Q&A, voice via existing Whisper VoiceInputButton or text) → technical interview (5 Q&A) → case study (firm-specific case brief + Univer Excel modelling task auto-graded + 150-300 word written recommendation, 50/50 blend) → hiring-committee decision (weights: apt 15% / HR 25% / tech 30% / case 30%; offer ≥65) with offer/rejection letter + personalized debrief (Sonnet 4.5; all other turns Haiku 4.5).

### DB (migration 0040 applied via mgmt API + /app/scripts/seed_interview_sims.py)
- master_modules.is_interview_module bool (M20 = true)
- master_interview_sims: 5 firms {firm_slug, brand, process(persona/focus/counts), case_config(brief_md, workbook canonical, expected_summary)}
- user_interview_attempts: {user_id, sim_id, attempt_number 1-2, status, current_stage, stage_data jsonb (full state machine), final_score, verdict offer|rejected}. RLS: own-select; writes via service role.

### Key files
- Backend: /app/backend/interview_sim_endpoints.py — /api/interview-sim/{overview,start,attempt/*,application,aptitude/*,interview/*,case/submit}; flips user_modules.is_completed when 5th sim finishes (_maybe_complete_module).
- Frontend: /app/frontend/src/components/interview-sim/ (Hub at /interview-sims, Player at /interview-sim/:attemptId + Application/Aptitude/Interview/Case/Decision stages, simShared.jsx)
- utils/interviewSim.js (cached interview-module detection + sim gate), progress.js checkModuleCompletion gates interview modules on sims
- NotesPage auto-completes quiz/sim flags for interview sessions; SessionStartPage shows 1-phase journey; NotesCompletePage CTA now dynamic (Finish Session when no next phase)
- DashboardPage: notes-only phase icons for M20, "Final round — Interview simulations x/5" row, FINAL ROUND hero card blocks progression to M21 until sims done
- Admin CurriculumTab: Mock Interview badge + mic toggle (PATCH is_interview_module); Pari blocked on /interview-sim/:id (useIsPariBlocked)

### QA account
qa-interview@valuevade.test / QaInterview2026! (M20-only enrollment, videos complete, sims unlocked; reset: python3 /app/scripts/seed_qa_interview_user.py)

## Backlog additions
- P2: persist mid-case spreadsheet drafts (case workbook state resets if the learner leaves the case stage before submitting)
- P2: admin analytics for interview sims (avg scores per stage/firm, offer rate)
- P3: /admin → /admin-panel redirect (testing agent noted /admin 404s; curriculum tab lives at /admin-panel?tab=curriculum)

## Feb 2026 (Jul 30) — Admin Mock Interviews CRUD tab

Admin can now fully manage the 5 firm interview simulations (`master_interview_sims`) from `/admin-panel?tab=mock` — no more editing `seed_interview_sims.py` for content changes.

### Backend endpoints (all `_ensure_admin` gated)
- `GET  /api/admin/interview-sims` — list all firms + per-sim `attempts_count`
- `GET  /api/admin/interview-sims/{id}` — full row for edit
- `POST /api/admin/interview-sims` — create new firm (unique slug enforced)
- `PATCH /api/admin/interview-sims/{id}` — partial update any field (firm meta / brand / process / case_config / order_index / is_active)
- `DELETE /api/admin/interview-sims/{id}[?hard=true]` — default soft (is_active=false, preserves attempts); `?hard=true` cascades via FK
- `POST /api/admin/interview-sims/{id}/duplicate` — clones with new firm_slug
- `POST /api/admin/interview-sims/reorder` — batch order_index update
- `POST /api/admin/interview-sims/rebuild-workbook` — regenerates the Excel case workbook + expected_summary from friendly numeric params (mirrors `seed_interview_sims.build_case_workbook`)

### Frontend — /app/frontend/src/components/admin/MockInterviewsTab.jsx
- Table view: rank, firm badge, role, location, slug, attempts count, active toggle, edit/duplicate/reorder/delete
- 5-tab modal editor: Firm • Brand (with color picker + live preview badge) • Rounds (persona + aptitude/behavioural/technical/case configs) • Case Study (markdown brief + friendly params form → Rebuild button → expected FY27 outputs preview) • Raw JSON (advanced escape hatch for brand/process/case_config)
- Delete flow: modal offers Hide (soft, recommended) vs Hard delete with clear cascade impact + attempts count
- Data-testids everywhere for automation (`mock-sim-row-*`, `mock-edit-*`, `mock-editor-modal`, `edit-case-*` etc)

### Wired into AdminPanel
- New tab "Mock Interviews" (Building2 icon) between "View Course" and "AI Customisation"

## 2026-08-26 — Admin Curriculum tab: delete module, delete session, reorder sessions
- Added visible delete-module trash icon (wires the pre-existing askDeleteModule() + impact-preview confirm modal — backend endpoints were already built, just unwired in UI).
- Added delete-session trash icon (new askDeleteSession(); same confirm modal, no cascade-impact block for sessions).
- Added up/down chevron reorder buttons per session row (new moveSession(); swaps order_index via 2x PATCH /api/admin/sessions/{id}, using a transient sentinel value on the target row first so no two sessions ever share an order_index mid-swap — testing agent flagged the naive 2-step swap as non-atomic, fixed before finishing).
- No backend changes needed — DELETE /api/admin/modules/{id}, DELETE /api/admin/sessions/{id}, PATCH .../order_index already existed from earlier phases.
- File: /app/frontend/src/components/admin/CurriculumTab.jsx
- Tested via testing_agent: 5/5 flows passed (delete module w/ cascade preview using throwaway ZZZ-named module, delete session, up/down reorder + restore on M1, editor tabs regression). Report: /app/test_reports/iteration_57.json

## 2026-08-26 — Removed all CFI mentions site-wide
- Removed "CFI certification"/"CFI prep" text from: faqs.js, WhoBuiltThisSection.jsx, FeaturesSection.js, HeroSection.js, CourseDetailsPage.jsx (incl. removing the whole CFI card, grid-cols-3 -> grid-cols-2), ComparisonSection.js, FeatureMicro3D.jsx icon map, jsonLd.js, TermsPage.jsx.
- Kept all NISM Series XV mentions (only CFI was in scope).
- Also patched the 3 live Supabase `faqs` DB rows (source of truth for GET /api/faqs; the frontend faqs.js file is only an offline fallback) that still had CFI text, and removed the stray "cfi" tag.
- Verified via grep (frontend source) + supabase REST query (master_paths/modules/sessions/module_projects/capstones + faqs table) — zero remaining CFI hits anywhere live. Only /app/frontend/src/components/landing/LandingPageV2.archived.jsx still mentions CFI — confirmed dead/unimported file, left as-is.

## 2026-08-26 — Fixed mobile Problem-section clipping + built real Forgot/Reset Password flow
- BUG FIX (production, mobile only): ProblemSection.js used a desktop-only scroll-hijack pattern (`sticky top-0 h-screen overflow-hidden` + `minHeight:170vh` always-on) that clipped the 3 stacked cards on phone screens. Fixed by gating sticky/overflow-hidden/min-height/3D-bg-scene behind `lg:` breakpoint — mobile now flows naturally, desktop parallax pin unchanged (regression-clean, verified).
- NEW FEATURE: Forgot/Reset Password using Supabase native auth email (user chose this over custom email provider).
  - LoginPage.jsx: "Forgot Password?" now routes to /forgot-password instead of a stub toast.
  - New /app/frontend/src/components/ForgotPasswordPage.jsx: calls supabase.auth.resetPasswordForEmail(), generic "check your inbox" state regardless of whether account exists (no enumeration leak).
  - New /app/frontend/src/components/ResetPasswordPage.jsx: listens for PASSWORD_RECOVERY auth event, then supabase.auth.updateUser({password}); falls back to an "expired link" state after 4s if no recovery session found.
  - App.js: /forgot-password wrapped in PublicOnlyRoute (like /login); /reset-password intentionally NOT wrapped (Supabase creates a temp session during recovery which would otherwise get redirected away by PublicOnlyRoute).
- Tested via testing_agent: 13/13 assertions passed (mobile no-clip, desktop regression, forgot-password anti-enumeration, invalid reset-link fallback, admin login regression). Report: /app/test_reports/iteration_58.json
- ACTION NEEDED FROM USER (cannot be done from code): In the Supabase dashboard → Authentication → URL Configuration → Redirect URLs, add both `https://valuevade.com/reset-password` and the current preview origin + `/reset-password`. Without this, the emailed reset link will not land on the app's reset-password page. Full email-link happy path was not executed end-to-end (would require reading the admin inbox and risks changing real prod credentials) — only the send + invalid-link fallback were verified.

## 2026-08-26 — Fixed Ask Pari "Network error" bug + added Retry UX + root /health endpoint
- User reported intermittent "Network error — try again." dead-end in the quick Ask Pari doubt chat on PRODUCTION (dashboard pill). RCA: DoubtsSession.jsx swallowed all failures (auth-token race, real network blip, backend restart) into one unhelpful message with no retry and the typed text was lost.
- FIX: DoubtsSession.jsx now tracks `lastFailedMsg` and renders a "Retry" button (data-testid=doubts-retry-button) on ANY failure path (start-session failure, ask failure, catch-all) that re-sends the exact original message with no retyping. Auth-expiry errors now show a distinct message from true network errors.
- Also added a root-level (non-/api) `GET /health` in backend/server.py — deployment_agent flagged the platform pod liveness probe hits /health directly on :8001 (bypassing the /api ingress prefix) and was 404ing/timing out, a plausible cause of intermittent mid-chat connection drops from pod restarts.
- Cleaned up /app/.gitignore (was duplicated ~7x from repeated appends across sessions); removed `.env`/`.env.*`/`*.env` ignore entries per deployment_agent policy (env files must ship to the deploy pipeline) and added `memory/test_credentials.md` to the ignore list.
- REGRESSION CAUGHT + FIXED: first patch attempt passed `overrideMsg` straight into `.trim()`, but the Send button's onClick={send} makes React pass a MouseEvent as the first arg, crashing every button-click send (Enter-key path was unaffected). Fixed with `typeof overrideMsg === 'string' ? overrideMsg : input` guard. Caught by testing_agent (iteration_59), verified fixed (iteration_60, 4/4 pass).
- OTHER DEPLOYMENT FINDINGS from deployment_agent scan (flagged to user, NOT yet fixed — need explicit decision): (1) `/api/admin/login` (legacy /referral admin dashboard, separate from the Supabase-based /admin-panel) will always 401 because ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_SECRET are missing from backend/.env; (2) an unauthenticated `/api/_download/codebase` endpoint in server.py serves the whole codebase tarball — should likely be removed before further prod exposure.
