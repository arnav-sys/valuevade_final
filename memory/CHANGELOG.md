# Valuevade — Implementation History

Current requirements/status are in PRD.md; prioritised next work is in ROADMAP.md.
Historical entries below are preserved verbatim and may describe superseded blockers.

## AI-personalisation marketing sections — 2026-10-29
- Added shared branded personalisation section on student landing and live course detail;
  planned/not-open variant on upcoming student course details. Copy explains AI shaping
  an existing curriculum around background, skills and goals, not generic one-size-fits-all.
- Kept existing enrolment, AI planner, auth, payments, database and enterprise pages unchanged.
- Fixed mobile course syllabus trigger overflow discovered during responsive verification.
- Direct browser and JSX checks pass. See test_reports/personalisation_20261029.md.
- Split the previous 710-line PRD into concise PRD, roadmap and this preserved history.

## Preserved previous PRD / progress history

## Original problem statement
Full-stack educational platform for Indian finance students (Valuevade): courses, AI mock
interviews, PDF notes, timed Mock Exam certification, Gamified Rewards, Admin Panel.
Stack: React (CRA) + FastAPI + Supabase (Auth/Postgres/Storage).
Current visual source of truth: the user's five Valuevade PDF carousels (2026-10-21),
superseding the earlier cream/editorial and forced-dark hero treatments below.
Fonts: Outfit (headings and `font-clash`), Instrument Sans (body, `font-bricolage`),
Spline Sans Mono (mono and `font-jetbrains`). Newsreader retained only for occasional
editorial italic supporting copy, not headings. No Inter/Roboto/Arial defaults.

## Admin uploads, enrolment cache & purchases — 2026-10-26 (current)
User request: upload real Excel/PDF resources through admin; cache `is_enrolled` in
AuthContext; show all purchases and all course-included templates as free, not separate charges.
Choices: **File coming soon** without an upload; purchases/included templates **plus payment history**.

### Implemented
- Admin → Resources: dedicated Upload/Replace actions, real filename/type/size, selected-file
  validation, save/upload progress, retryable errors, publishing without files as coming soon.
- Private Supabase `paid-resources` bucket; XLSX/XLS/PDF and existing document formats, 25 MB
  limit, structural validation (pypdf/openpyxl/olefile), bounded archive expansion. Unique paths,
  conditional metadata replacement, old file preserved on failures, superseded-file cleanup.
- Download endpoint authorises paid enrolment or verified individual purchase before signing
  a 120-second attachment URL. No public external URL passthrough or generated CSV fallback.
  Missing files return 409; retired `/resources/{id}/sample` returns 410. Public responses
  expose `file_available`, never storage paths. Enrolled resource orders do not charge again.
- AuthContext exposes `is_enrolled`, `enrollmentStatus`, loading/error, `refreshEnrollment`.
  `contexts/useEnrollmentCache.js`: per-user localStorage + memory, five-minute TTL, one
  in-flight request, stale-while-revalidate on focus/navigation, logout/user-switch isolation.
  First uncached sign-in still fetches; subsequent pages/reload use cache immediately.
- `/me/enrollment-status` reads payment status/enrolments concurrently. Catalog, detail,
  sidebar and course pages use shared context, not repeated resource-library checks.
  Verified course checkout, trial choice and completed enrolment refresh the cache.
  Cache is display-only: protected download and existing session gates remain server-checked.
- New `/purchases`: active course access with actual recorded payment amount (when present),
  all published bundled templates labelled **Free · Included in course**, original-file
  downloads or disabled **File coming soon**. Individual purchases deduplicated against bundle.
- Separate Payment history tab shows real recorded course/resource orders and statuses,
  including pending/failed/refunded, plus resource Check payment. No fabricated receipts.
  `/my-orders` redirects to history; `/resources/library` to purchases. Nav/sidebar links added.
- `purchase_endpoints.py`: user-scoped `/api/purchases`, paginated ledger reads, no-store;
  shared `resource_access.py`; frontend purchases/detail/editor split into focused components.
- Existing seven catalogue resources remain published at price_paise=0: HR database,
  financial modelling, equity research, AI workflows, prompt library, projects, interview prep.
  **No professional content supplied yet: all seven show File coming soon until admin uploads.**

### Verification
- `/app/test_reports/iteration_107.json`: backend 16/16; desktop/mobile flows, upload picker,
  private access, missing-file states, navigation, cache request counts and account isolation pass.
- Follow-up 16/16 pass, including fetching signed bytes and opening the XLSX workbook.
  TEST-ONLY MOCKED checkout confirms failed verification never refreshes/grants; verified
  success refreshes cached enrolment. No live charge or runtime mocks added.
- QA DB/storage records cleaned; obsolete CSV test with hardcoded key retired. Credentials unchanged.
- Details: `/app/test_reports/iteration_107_followup.md`; backend tests `test_iter107_resources_purchases.py`.

### Next / backlog
- P0: none known in implemented flows. Admin must upload the real professional files.
- P1: real Razorpay standalone-resource checkout/webhook E2E; enterprise enquiry email integration.
- P2: backend router refactor, legacy hook warnings; retry storage cleanup if provider deletion fails.
- Enhancement: show resource version/update dates so students can spot refreshed templates.


Request: "users can access notes and video lectures of any locked module but they cannot
access quiz and simulations. fix it and make sure all the gamification features like xp
levels and constellation etc. show effect of it and marked the lectures and modules
completed". User chose: **Notes completion = session done. Quiz/simulation become optional
bonus activities (accessible anywhere for extra XP). Gamification updates when notes done.**

### Implemented and verified (code review confirmed correct by testing agent)
- `utils/progress.js`: `allDone = !!updated.notes_completed` — notes alone marks a
  session as `is_completed=true` in `user_sessions`. Session completion XP (50 XP,
  reason: `session_complete`) fires after notes. `checkModuleCompletion` is triggered so
  modules complete when all sessions have notes done. Quiz/simulation still emit bonus XP
  when completed (`quiz_correct`, `simulation_complete`).
- `components/NotesPage.jsx`: Imports `useXP` and `triggerStreakUpdate`. `complete()`
  now captures `markPhaseComplete` return value, loops through `xp_intents`, calls
  `awardXP(intent)` for each, and triggers streak update + session_complete daily challenge.
- `components/NotesCompletePage.jsx`: Title is "Session done!", pill badge says "Session
  complete". Primary CTA: "Back to Dashboard" (Link to /dashboard). Secondary optional
  CTA: "Bonus: Take Quiz for +XP" shown only when `quiz_completed=false`. "Review Notes"
  is a small tertiary link. `getNextPhaseRoute` removed; replaced with `quizPending` flag.
- `components/SessionStartPage.jsx`: New `sessionDoneViaNotes = session?.is_completed &&
  !allDone` variable. When true: shows green banner "Session complete — notes done! Quiz
  & simulation are optional for extra XP.", quiz/simulation phases show label "BONUS" and
  blurb "Optional — earn bonus XP", all phases remain clickable (notes for review, quiz/sim
  as bonus). CTA becomes "Session complete — continue" Link to /dashboard.

### Effect on gamification
- Dashboard `completedSessions` count uses `is_completed` → counts after notes done ✓
- Constellation map reads `v_module_progress_summary.sessions_completed_n` which counts
  `is_completed` rows → updates after notes ✓
- Module `is_completed` flips when all sessions' notes done → constellation gold star ✓
- Daily challenge `sessions_completed` fired after notes via `updateDailyChallengesForPhase` ✓

### Tests
- Code review by testing agent (iteration_105): all 3 key files confirmed CORRECT.
- UI testing partially blocked by pre-existing intermittent Supabase urllib timeout in
  `/api/payments/eligibility` (payment_endpoints.py _lazy_free_session_used). This is
  NOT caused by the notes-completion changes.
- No backend file changes; no database schema changes required.


Exact request: “also in course details page mention you will get access to all resources
include like hr database, financial modelling templates, equity research templates,
ai agents workflows, prompts library, finance projects templates, interview prep
templates etc. and more”. User chose **Full section and enrolment highlight** after
being told this updates both audiences without changing payment/download permissions.

### Implemented and verified
- Shared `courses/IncludedResources.jsx` and scoped `included-resources.css`: full
  inclusion section with all seven requested categories, plus sector study frameworks
  and valuation/stock pitch templates. Explicit “access to all resources” copy follows
  the user's commercial instruction. No fabricated file counts, download links or values.
- Student course detail: full section after course stats; inclusion jump links beside
  hero enrolment, closing CTA and mobile sticky enrolment. Existing enrolment actions
  retained. All links jump to the resource section.
- Enterprise course detail: B2B descriptions, enrolled-team-member inclusion wording,
  full section, hero highlight and proposal highlight. AI-only form interest hides the
  course inclusion highlight; workflow templates explicitly distinguished from separately
  scoped custom AI agent implementations.
- Upcoming student/enterprise courses show the library as a **planned inclusion at launch**,
  with enrolment/resource access not yet open; no new prices/enrol buttons.
- Legacy `/enterprise/programme` includes matching section and proposal highlight.
- No auth, backend, payment, download permission or actual resource-file changes.
  **This was a content/presentation update, not bundled resource access implementation.**

### Tests
- Direct browser regression, desktop1920×800/mobile390×844: all nine category entries,
  student hero/closing/mobile highlights, enterprise hero/proposal highlights, anchors,
  AI-only conditional, upcoming states and legacy programme pass. No page overflow.
- JSX parse and dev compilation pass. Fixed the touched legacy page's effect dependency;
  unrelated existing `ot-json1` dependency source-map warning remains.
- Report: `/app/test_reports/resource_inclusion_copy_20261025.md`. No database writes,
  emails, payments, runtime mocks or credentials changes. Testing agent not needed for
  this incremental content-only update; verified directly in browser.

### Next / backlog
- P0 for this content request: none known.
- P1: verify/provide bundled resource access for course enrollees before relying on the
  commercial inclusion promise; no entitlements were changed by this request. Existing
  resource purchase/upload/download and saved-lead/email delivery E2E remain pending.
- P2: prior backend and legacy course-detail refactors remain unchanged.
- Potential enhancement: preview a few resource examples alongside the inclusion list.

## Student / Enterprise course navigation — 2026-10-25 (previous)

Exact request: “in students show all courses and course details page and give option
to view all courses in navbar and in enterprise also in navbar show all courses
and course details page but change the content and page to enterprise b2b specific
in course details page and also in navbar add ai agents and show ai agents page
and remove programmer”. User chose **Navigation only** for removing Programmer.

### Implemented
- Student landing, shared public navigation and enterprise navigation now expose
  **All Courses** and **AI Agents**, including mobile menus. Removed the existing
  **Programme** navigation entry; its legacy `/enterprise/programme` URL and content
  remain available. No course records deleted or unpublished.
- `/courses` and `/enterprise/courses` consume the same real published catalogue
  (currently six courses: one live, five coming soon), with search/category filters,
  empty/error/retry states, genuine brand artwork and correct audience-specific links.
  Every card opens details, including upcoming and enrolled courses. Existing student
  enrolment status/continue shortcut preserved; student catalogue supports dark mode.
- Existing live `/course/:courseId` retains learning content, free trial and checkout
  entry points. Shared nav added. Upcoming courses have truthful title-specific detail
  pages, no ER placeholder curriculum, prices or enrol buttons; inactive paths excluded.
- New `/enterprise/course/:courseId`: distinct B2B description, target team roles,
  course-specific business outcomes, illustrative assignment, published module/session
  accordion, rollout plan and team proposal. Uses actual catalogue counts/curriculum.
  Upcoming content explicitly marked proposed; no numeric price/enrol CTA. Unknown ID
  shows not found. No student salary, career-transformation or individual checkout copy.
- Course enquiry context appears in the form and is retained in saved request requirements
  or email drafts. Text length reserves space for context; no real enquiries sent in QA.
- `/ai-agents` and `/enterprise/ai-agents` show existing FP&A, Bookkeeping and Excel
  governance offerings with selectors, illustrative Three.js workflow, review boundaries
  and correct training/proposal links. These are scoped business offerings, not newly
  implemented live agents or services included in tuition.
- Audience switching now preserves catalogue, exact course ID and agents-page context.
  Enterprise preference no longer collapses all course links into the generic programme.
- No backend business logic, auth, payment configuration, database or credentials changed.

### Verification / current setup status
- `/app/test_reports/iteration_104.json`: backend 4/4 passes; browser core flows passed,
  including six-course listings, details, navigation, enquiry payload, responsive widths
  320/390/768/1024/1440/1920 and legacy programme accessibility.
- Tester found duplicate React keys. Root cause was **two sibling detail components**
  (curriculum and pricing) keyed identically, not duplicate catalogue data. Namespaced
  keys fixed it. Three repeated student/enterprise detail switches preserve ID; follow-up
  has zero duplicate-key warnings. Catalogue and curriculum failure/retry paths verified
  against real responses after test-only 503 injection; no runtime API mocks added.
- Follow-up `/app/test_reports/iteration_104_followup.md`. Desktop/mobile screenshots
  show no overflow. Mobile agent canvas nonblank: 350×208, 844 opaque sampled pixels,
  295 colours; selector changes work. Initial Helmet mixed-title-child error corrected
  before QA. Current JSX parses and dev compilation works.
- **Previous migration blocker no longer reproduced:** `/api/resources` returns 200;
  `/api/enterprise/config` returns `enquiries_available: true`. Do not tell the user
  migration 0048 is still blocking these reads. Storage/upload/purchase/download E2E
  and actual saved lead/email delivery were NOT verified in this navigation task.
- Enterprise sample prices still labelled sample. Managed email provisioning/delivery
  remains previously pending/unverified. No payments executed. Testing-only enquiry
  interception returned a MOCKED response solely to inspect payload without saving a lead.

### Next Action Items / backlog
- P0 for this request: none known. User review of new public navigation and B2B content.
- P1: validate real resource CRUD/upload/publish, Razorpay test purchase/recovery/webhook
  and signed downloads now that public schema reads respond. Verify saved leads and
  resolve/check managed enquiry email provisioning; no live delivery claim.
- P2: existing backend router refactor; split legacy `CourseDetailsPage.jsx` into modules.
- Potential enhancement: course comparison to help students and teams choose a path.

Files: `components/courses/` (catalog hook/cards, editorial business content, enterprise
details/curriculum, upcoming student details and scoped styles), `CoursesPage.jsx`,
`CourseDetailsPage.jsx`, `enterprise/{AudienceContext,BusinessNav,AIAgentsPage,
BusinessAgentsContent,EnterprisePricing}.jsx`, `enterprise.css`, `LandingNav.jsx`,
`immersive.css`, `Navbar.js`, `App.js`. No auth credentials changed.

## Business landing expansion — 2026-10-25 (previous)

Exact request: “in business Landing page the first landing page add more 3d elements
and make the background lavender just like in student and also segregate between
course and ai agents and make it more clear and add more content. the page is too
small right now”. User explicitly chose **Course / AI agents tabs**.

### Implemented and verified
- `/enterprise` now renders the new `EnterpriseLanding.jsx`. Scoped lavender background
  **#F5ECFF**, matching the student theme. Existing student, resources, admin and separate
  `/enterprise/programme` routes preserved; no unrelated theme changes.
- Accessible Radix Course / AI Agents tabs, exclusive panels and contextual hero/CTA copy.
  Selection persists in `?view=course` / `?view=agents`, including reload/back navigation.
- Course view expanded with outcomes, four curriculum areas, illustrative financial
  research workspace, three example deliverables, four learning stages and five FAQs.
- AI Agents view expanded with selectable Deep FP&A / Bookkeeping / Excel governance
  products; each has inputs, AI work, output, human reviewer and illustrative case.
  Added rollout stages, governance requirements, in-house-course CTA and six FAQs.
- New real Three.js hero workspace: course research/model/review objects plus books,
  coins and chart elements; agent source/processor/approval objects with animated data
  connections. Second 3D agent workbench. Focus controls, drag, reset, pause, reduced
  motion, offscreen render suspension, resource cleanup and bitmap fallbacks.
- Preserved truthful 10x ambition with measurement criteria, not guaranteed productivity.
  No invented client outcomes, available ERP connectors, tenant guarantees or service SLAs.
- Course calculator and agent quotations are visibly separate. Agent view does NOT show
  training prices. Shared enquiry preselects the relevant interest, preserves contact
  values, clears stale drafts and rotates request UUID when switching offerings.
- Agent-only saved-lead estimates use `quote_type: scope_based`, rather than fabricated
  course prices; admin lead display handles that shape. Existing setup blockers unchanged.

### Tests / remaining status
- `/app/test_reports/iteration_103.json`: 18/18 backend regression tests pass; deep browser
  checks pass for tabs/keyboard/URL history, anchors, agent selectors, FAQs, enquiry
  drafts, sample pricing, in-house CTA and existing-route regressions.
- No overflow at 320/390/768/1024/1440/1920 on tested views. Screenshots at1920x800/390x844.
- 3D pixel/frame checks, pause, drag/reset and repeated-tab canvas cleanup pass.
- Tester reported a fallback issue. Main-agent reproduction with BOTH WebGL1 and WebGL2
  disabled confirmed existing fallback worked (both images, zero canvases). Additionally
  hardened post-constructor context validation, render exceptions and context-loss handling;
  disabled unavailable 3D controls. Follow-up verified normal motion, static reduced-motion,
  mid-session context loss and fully blocked WebGL fallbacks on desktop/mobile.
- Full follow-up: `/app/test_reports/iteration_103_followup.md`. No known open regression
  in this redesign. No auth credentials changed. No new integrations or deployment.
- **Unchanged P0 setup:** database migration 0048 and managed email provisioning remain
  pending. Saved leads, resource CRUD/checkout/downloads still unavailable; `/api/resources`
  intentionally returns503 with truthful preview UI. Manual enquiry email drafts work;
  no email/payment was executed during testing.
- Next: user review of the expanded landing. Prior setup work remains separately pending.
  Potential enhancement: track Course vs AI Agents enquiry conversion.

New files: `components/enterprise/{EnterpriseLanding,BusinessScene,BusinessCourseContent,
BusinessAgentsContent,BusinessFAQ}.jsx`, `businessSceneObjects.js`, `business-landing.css`.
Modified: `App.js`, `EnterprisePricing.jsx`, `admin/EnterpriseTab.jsx`,
`backend/enterprise_endpoints.py`.

## Approved expansion — 2026-10-25 (Enterprise + resources marketplace)

User approved these decisions in the clarification response:
- Enterprise enquiry notifications: **Emergent Managed Email, powered by Resend**, to
  `info@valuevade.com`; retain enquiries in Supabase for admins.
- Enterprise pricing: tiered seat slabs. Exact amounts not supplied; use editable,
  explicitly labelled sample INR prices, not purported approved commercial rates.
- AI agents: both Valuevade-built products and training to build/use agents in-house.
- Resources: Excel financial models, equity research report templates, AI prompt packs,
  sector study frameworks, interview prep kits. Payments via existing **Razorpay**.
- Student/Enterprise first-visit choice on landing/catalog/course detail; persistent
  audience switch; separate enterprise landing/course details while preserving students.
- Enterprise content: AI automation, aspirational 10x productivity (not proven ROI),
  valuation, illustrative concall/statement-analysis workflows, FP&A, bookkeeping,
  Excel-native governance. Preserve existing branded 3D visual language.

### Implemented — 2026-10-25
- Persistent Student/Enterprise audience switch and first-visit gateway on `/`, `/courses`,
  `/course/:courseId`. Student learning/auth routes are preserved. Enterprise preferences
  route visitors to `/enterprise` or `/enterprise/programme`; switches available in both
  desktop and mobile navigation. Resources linked from student and enterprise headers.
- New enterprise landing/programme pages, interactive illustrative research workspace
  reusing the established Three.js financial desk, concall/valuation/statements examples,
  built-agent vs in-house-training modes, FP&A/bookkeeping/Excel-governance sections.
  No fabricated customers or performance statistics: 10x explicitly an ambition, not a guarantee.
- Team calculator for 1–1,000 seats using volume slabs (one rate for every seat), with
  explicit sample pricing. INR defaults: 1–10 ₹4,999, 11–50 ₹3,999, 51–200 ₹2,999,
  201–1,000 ₹2,499 per person. No enterprise payment collection. Rates/sample label can
  already be edited and persisted in existing Supabase `app_settings.enterprise_pricing`.
- Enquiry form validates contact/company/team/interest/requirements/consent. Since the
  new database is not set up, the current functional fallback prepares a mailto draft
  addressed to info@valuevade.com. Explicitly **not sent or saved**; the visitor must
  open their email app and send. Editing fields clears stale drafts.
- Resource catalog/search/category filters and detail pages across five requested types;
  `/resources/library` for purchases, existing login with return-to-page. Current content
  is explicitly labelled **concept previews**, not paid/downloadable products.
- Admin Enterprise/Resources tabs: setup status, authenticated downloadable SQL setup,
  editable slab prices, lead status/retry controls and resource editor/file/price/publish
  controls. Resource creation is disabled while the schema is missing.
- Isolated FastAPI modules implement Supabase lead persistence, fixed-recipient managed
  email notification status, private resource uploads, public metadata projection, scoped
  purchase records, Razorpay order/signature/capture/amount/currency verification, webhook,
  payment-recovery action, refund checks and 120-second signed downloads. These new
  persisted CRUD/checkout/download paths remain blocked pending setup, not verified E2E.
- Additive migration `scripts/migrations/0048_enterprise_resources.sql`: private
  `enterprise_leads`, `marketplace_resources`, `resource_orders` tables with RLS and
  browser grants revoked, plus private `paid-resources` bucket. No migration to MongoDB
  and no authentication implementation changes. Existing service-role/auth reused.
- Finished M18 sessions 11–20: generation OK=10, FAIL=0. Read-only verification confirms
  **all 20 sessions each have seven valid, nonempty cards** (140 total). Generator now
  validates cards, generates before deleting old notes, keeps local backups and restores
  old cards on insertion failure. Backups in `backend/notes_backups/`; supports session
  ranges and skip-complete. No further generation needed.

### Verification
- `/app/test_reports/iteration_102.json`, backend suite
  `/app/backend/tests/test_iter102_enterprise_resources.py`: **18/18 passing**.
  Main agent reran all 18 after final frontend changes. Tests cover real API access guards,
  admin SQL action/pricing roundtrip/validation, missing-schema handling, M18 Supabase
  data, plus payment reconcile/upload/public-field unit cases using test-only doubles.
- Frontend QA covered gateways/preferences/switching, new pages/tabs, sliders/slab
  boundaries, template filtering/concept notices, existing login return, admin controls.
  No overflow measured at 320/390/768/1024/1440/1920 widths on covered pages.
- One finding (generic 422 validation message) fixed; main-agent desktop/mobile verified
  exact `Slabs must increase and end at 1000 seats` error, no saved price changes.
- Follow-up main-agent test verified functional email-draft fallback, recipient/body,
  explicit unsent/unsaved copy, stale-draft clearing and no overflow at 390/1920.
- WebGL main-agent check: 30,967 opaque pixel samples, 3,098 colours, different successive
  frames; browser QA covered pause/reset/tab controls. Visual assets render nonblank.
- Python compilation passes. Dev app loads. Standalone ESLint could not run because this
  existing repo lacks a compatible ESLint config (v9); do not claim standalone lint or
  production build/deployment verification. No deploy requested or performed.
- No new runtime API mocks. Resource concepts and workflow examples are labelled
  illustrative samples; backend test mocks do not exist in application runtime.

### P0 remaining / setup limits
- User saved `SUPABASE_DB_URL` as an HTTPS Supabase project URL rather than PostgreSQL
  URI, then **skipped** correcting it. Do not request it again without a new reason.
  Migration 0048 has **not been applied**. Credential-free alternative is ready:
  Admin → Enterprise → Download database setup → run in Supabase SQL Editor → Check again.
  Until applied: no saved enterprise leads, resource metadata CRUD/uploads, checkout or
  secure downloads. Existing student app and sample pricing edits remain operational.
- `EMERGENT_EMAIL_KEY` and `EMAIL_FROM_NAME` are absent. Two integration-guide calls did
  not provision the managed key. Notification code exists but reports `not_configured`.
  Do not ask the user for a managed key, switch providers silently, or claim email delivery.
  Resolve managed provisioning, set brand display name Valuevade, test with delivered@resend.dev
  first, then owner notifications. No email was sent during this work.
- After migration: test real resource CRUD/upload/publish, saved enquiries, Razorpay test
  checkout/recovery/refunds and private signed download end-to-end. Register resource
  webhook `/api/resources/payment/webhook` in the existing Razorpay account when activating.
  Existing course payment configuration was not changed. No payment was executed.
- Confirm final enterprise prices and upload actual resource files before sale.
- Future enhancement: track enquiry-to-proposal conversion. Existing P1/P2 backlog below
  remains unchanged. No auth credentials created or modified.

### New implementation files
- Frontend: `src/components/enterprise/` (audience context, shared nav, enterprise pages,
  calculator/form, workspace, API helper, isolated CSS); `src/components/resources/`;
  admin `EnterpriseSetup.jsx`, `EnterpriseTab.jsx`, `ResourcesTab.jsx`.
- Backend: `enterprise_common.py`, `enterprise_endpoints.py`, `enterprise_email.py`,
  `resource_endpoints.py`, `resource_payments.py`, `resource_storage.py`; registered by
  `server.py`. Migration: `scripts/migrations/0048_enterprise_resources.sql`.

## Previous approved update — 2026-10-24 (Continue Learning shortcut card)
User requested: compact "Continue where you left off" shortcut card on the dashboard.

### Implemented & verified (iteration_101 — 10/10 passed)
- Redesigned `ContinueLearningCard` State 3 (normal in-progress session) from a large padded
  card into a compact horizontal shortcut strip: left gradient accent, phase icon block,
  session title + module breadcrumb, right-side CTA badge. Full `<Link>` to the next phase URL.
- All milestone states (capstone/exam/interview/project) unchanged.
- Verified on desktop and mobile (390px).


## Latest approved update — 2026-10-24 (session search + module progress rings)
User requested: "Jump to Any Session" search bar + "Module Progress Ring" on the dashboard.

### Implemented & verified (iteration_100 — 12/12 passed)
- **`ProgressRing` SVG component**: 40×40 ring on every non-active, non-complete module
  card. Grey track + blue (`--color-primary`) filled arc driven by `pct`
  (completedCount/total). Zero-padded module order index in center (e.g. "02").
  Active module → blue PlayCircle; complete → green CheckCircle2 (unchanged).
- **Session search bar**: above the module list, `data-testid="session-search-input"`.
  Placeholder "Jump to any session across all 239…". Filters sessions by title AND
  module title via `useMemo`. Dropdown shows up to 8 results with session title,
  "Module N · Title" line, and completion status icon. Clicking navigates to
  `/session/:id/start` and clears the search. Outside click closes dropdown.
  Clear button (`data-testid="session-search-clear"`) removes query.
- Mobile (390px): search is full-width (358px), rings render correctly, dropdown works.
- `useRef` + `Search`, `X` icons added to existing imports — no new packages.

## Previous approved update — 2026-10-24 (free module/session access + 100+ hours copy)
User: "right now users can not access all modules and sessions. they have to complete module
and then next module will be available. give them option to access and see each module and
each session."

### Implemented
- `DashboardPage.jsx` line 876: `isLocked` forced to `false` — all modules visible at full
  opacity, no greyout.
- `DashboardPage.jsx` line 78 (`ModuleCard`): `headerInteractive = !isLocked` (now always
  `true`) — every module card is clickable to expand its session list, regardless of completion
  state. Previously only completed modules were expandable.
- Net effect: users can now click any module to see all its sessions, and click any session
  to navigate to it, without needing to complete prior modules.
- Gamification / XP / progress tracking remain fully intact.
- No backend changes required (access was frontend-gated only).

Also in the same session: all "1 hour a day / 2 months / 42 hours" references updated to
"100+ hours" in FAQs (`CourseDetailsPage.jsx`, `faqs.js`), comparison table (`ComparisonSection.js`).

## Previous approved update — 2026-10-21 (landing contrast + desktop side space)
User: "fix this and also just in this landing page I have attached in desktop in left and right it looks blank do something".
The screenshots showed washed-out AI Advantage text and empty desktop hero wings.
User selected **"Course benefits and outcomes"** for the side spaces. Scope remained
landing-only; no changes to other pages, backend, authentication, or payments.

### Implemented and verified
- Reproduced the exact contrast failure: legacy `landing-dark.css` forces every section
  background transparent with `!important`, leaving the AI section's light text on lavender.
  Fixed with `.vv-immersive section.vvi-ai-edge { background: #02073D !important; }`
  in the landing-only stylesheet. Explicit heading/tool label colors preserve readability.
- Added `HeroBenefits.jsx`: left rail explains 100+ hrs of practical learning, AI-personalised
  study and NISM XV preparation; right rail highlights three capstones, portfolio work,
  mock interviews and career preparation. Uses only existing course facts.
- Rails flank the central hero in a three-column layout at >=1200px and stay hidden on
  smaller viewports. Links scroll to practice and the learning roadmap. Canvas stays below
  the entire intro, with an 8px gap and no overlap. Mobile hero remains unchanged.
- `/app/test_reports/iteration_99.json` verifies exact navy background and white text in
  both themes and desktop/mobile. Measured contrast: heading 17.18, body 9.95, kicker 9.05.
  All six tool labels readable; AI CTA, rail links, hero scene/controls and signup routes pass.
- Tested 320/390/768/1024/1199/1200/1280/1440/1920 widths; no horizontal overflow or
  hero overlaps. No style leakage to `/login` or `/courses`. No credentials or data changed.
- No functional/UI blocker remains. Rapid-navigation request aborts and screenshot-heavy
  WebGL ReadPixels warnings are test-runtime notes, not reproduced user-visible failures.

Next: user visual review. Optional enhancement: measure engagement with hero outcome links.
Existing P1/P2 application backlog remains unchanged.

## Previous approved request — 2026-10-21 (landing-only 3D redesign)
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
- `/app/frontend/src/components/landing/immersive/HeroBenefits.jsx` — desktop-only benefits/outcomes rails
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
  iterations97–98; screenshot-reported contrast issue subsequently fixed and verified
  alongside desktop hero benefits in iteration99. No remaining known UI regression.

## Razorpay Payment Infrastructure (Feb 2026)
- Admin Payments tab now has a full Razorpay Configuration panel:
  - Shows TEST MODE / LIVE MODE badge based on key prefix
  - Displays both webhook URLs (course & resource) with copy buttons
  - Shows setup status: API keys configured, webhook secret not set
  - "How to switch to live keys" step-by-step guide
  - Backend endpoint: GET /api/admin/payments/setup-status
- Enrollment price page (/start) now fetches real price from /api/payments/eligibility — no more hardcoded ₹999 bug, all price references use the server-side value
- Resource purchase button disabled-state fixed: no longer permanently disabled when ownership check errors
- Standalone resource purchases via Razorpay fully wired in backend (resource_payments.py); admin must set price_paise > 0 AND upload a file to enable a resource for standalone purchase
- Webhook endpoints (/api/payments/webhook and /api/resources/payment/webhook) return 503 when RAZORPAY_WEBHOOK_SECRET is empty — configured behavior
- iteration_108 testing: 8/8 backend passed, 100% frontend passed

