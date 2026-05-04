# Valuevade - PRD

## Problem Statement
Premium landing page + waitlist + AI-powered career learning platform for finance professionals. Light/dark theme support with warm pink default. React frontend + Supabase backend + MongoDB (legacy waitlist).

## Architecture
- **Frontend**: React with Tailwind CSS, Supabase JS client, custom CSS animations, Shadcn UI components
- **Backend (Legacy)**: FastAPI (server.py) with MongoDB for waitlist storage + JWT admin auth
- **Backend (New)**: Supabase (PostgreSQL) for user auth, profiles, enrollments, courses
- **Database**: MongoDB (waitlist), Supabase PostgreSQL (profiles, user_enrollments, master_paths, master_modules, master_sessions)

## What's Been Implemented

### Phase 1 - Landing Page MVP
- Full landing page with 8 sections: Hero, Problem, Features Bento Grid, How It Works, AI-Proof, Testimonials, Final CTA, Footer
- Waitlist form submission stored in MongoDB with email validation
- Waitlist confirmation page with confetti, animated checkmark, position display
- Custom cursor, star particles, orbital ellipses, glassmorphism cards
- Scroll reveal animations, stats counter, mobile responsive
- Full SEO meta tags, OG tags, schema markup

### Phase 2 - Logo Update & Footer
- SVG logo replacement in Navbar and Footer
- Instagram link added, Blog/Contact removed from footer

### Phase 3 - Admin Dashboard
- JWT-authenticated admin dashboard at `/referral`
- View all waitlist entries, delete individual entries

### Phase 4 - Data Cleanup (Feb 2026)
- Removed all test entries from waitlist collection

### Phase 5 - Supabase Auth & Routing (Feb 2026)
- Supabase client initialized (src/lib/supabase.js)
- AuthContext with signUp, signIn, signOut, session persistence
- Optimized auth initialization with safety timeout (no more stuck loading)
- Profile fetch non-blocking for faster page loads
- Signup page (/signup): Full Name, Email, Password, Confirm Password with validation
- Login page (/login): Email/Password with enrollment-based redirect logic
- ProtectedRoute component with loading spinner
- Navbar: Login/Signup when logged out, Courses/Dashboard/user name/logout when logged in (desktop + mobile)
- Brand CSS variables system applied globally
- Toaster (sonner) for notifications

### Phase 6 - Courses & Course Details Pages (Feb 2026)
- All Courses page (/courses): Fetches active courses from Supabase master_paths, shows enrollment status, module/session counts
- Course cards with title, description (truncated with Read more), stats row, difficulty badge, CTA (View Details / Continue Learning / Completed)
- Empty state: "More career paths coming soon" with Investment Banking, Private Equity teaser
- Loading skeletons, error state with retry button
- Course Details page (/course/:courseId): Hero section with title, long description, stats, Customize & Enroll CTA
- "What You'll Learn" visual grid with checkmark icons from course data
- Accordion modules section (first expanded by default) showing sessions with titles and estimated minutes
- Sidebar: Prerequisites, Career Outcomes, Skills tags
- Sticky mobile CTA bar at bottom
- All protected routes requiring authentication

### Phase 7 - Light/Dark Theme System (Feb 2026)
- ThemeContext with localStorage persistence (key: vv-theme)
- Light mode default: #F2E6EE background, dark text, white glass cards
- Dark mode: Original cosmic #02073D theme preserved
- Theme toggle (sun/moon icon) in: landing navbar, courses header, course details header
- All 15+ components updated from hardcoded dark colors to CSS variable references
- Courses page upgraded: gradient accent bar, sparkles icon, colored stat pills, gradient CTA button
- Smooth 0.3s transitions between themes

### Phase 8 - Course Customization Wizard — Phase A (Feb 2026)
- Multi-step wizard at /course/:courseId/customize
- Fetches customization questions from Supabase master_customization_questions
- Dynamic step grouping (3 questions per step, auto-groups)
- 4 question type renderers: single_select (radio), multi_select (checkbox), slider (range), rating_grid (circle grid)
- Progress bar with gradient fill and step dots
- Validation: Next button disabled until all questions answered
- Free-text final step with 1000 char limit and character count
- "Generate My Personalized Path" CTA navigates to /course/:id/preview with full state
- Back navigation through steps and to course details

### Phase 9 - Course Customization — Phase B: AI Preview (Feb 2026)
- Backend `/api/customize/generate` endpoint using Claude Sonnet 4 via Emergent LLM key
- Full system prompt with curriculum design logic (removal, addition, reorder, certification overrides, conservative rules)
- PreviewPage at `/course/:courseId/preview` receives answers via React Router state
- Animated loading screen with 3 progressive steps
- Visual diff display: removed modules (red strikethrough + badge), added sessions (green badge), reordered modules (blue badge), locked modules (lock badge)
- User profile summary, stats (modules/sessions/customizations), conservative flags
- "Accept & Continue" and "Go Back & Modify Answers" navigation
- Error handling with retry button and fallback to modify answers

### Phase 10 - Course Customization — Phase C: Confirm & Enroll (Feb 2026)
- Confirm page (/course/:courseId/confirm) with final course structure, stats, module list
- Client-side Supabase enrollment: inserts into user_enrollments, user_modules, user_sessions
- Applies AI customization plan: remove_module, remove_session, add_session, reorder_module
- Loading page (/course/:courseId/loading) with branded 3-step animation, auto-redirect after 3.6s
- Enrolled success page (/course/:courseId/enrolled) with confetti, "You're all set!", "Start Learning" CTA
- Full flow: Customize → Preview → Confirm → Loading → Enrolled

### Phase 11 - Dashboard + Persistent Sidebar (Feb 2026)
- Persistent left Sidebar (/app/frontend/src/components/Sidebar.jsx): Valuevade logo, 4 nav items (Dashboard, My Course expandable showing enrolled path title only, Profile, Settings), theme toggle, user name, sign-out
- Desktop: fixed 250px, collapsible to 60px icon-only (persisted in localStorage['vv-sidebar-collapsed'])
- Mobile: hamburger top-left opens slide-in drawer with overlay backdrop
- Dashboard page (/dashboard) rebuilt with 4 data states: loading skeleton, error + retry, empty (no enrollment → Browse Courses CTA), populated
- Populated view: Welcome header, Continue Learning card (next session + next phase + resume CTA), Stats grid (sessions / modules / streak / time), Course Progress Map (module timeline w/ progress bars + session expansion showing 4 phase icons + module project indicators), Capstone card
- Supabase fetches in parallel (Promise.all) for: user_enrollments, user_modules, user_sessions, user_stats, user_module_projects, user_capstone_projects — gracefully handles missing tables
- Progress utilities at /app/frontend/src/utils/progress.js: markPhaseComplete, checkModuleCompletion, checkCapstoneUnlock, updateStats, getNextPhase
- Conditional Continue Learning states: normal (resume phase) / module project pending / all modules done → Begin Capstone
- Tested: 95% frontend success, all testids present, no console errors

### Phase 12 - Session Start + Notes Card System (Feb 2026)
- Session Start page (/session/:sessionId/start): breadcrumb (Module X > Session Y), title, description, learning objectives, 4-phase journey list w/ completion status, Begin/Continue CTA → first uncompleted phase, AI-added badge for AI-generated sessions
- Notes page (/session/:sessionId/notes): full-screen one-card-at-a-time carousel fetching from master_notes_cards ordered by order_index
- 8 card renderers (accent-colored, JSONB content): hook (#FF6AC1 gradient), concept (#246BFD w/ key_terms + core_principle), formula (#6A5CFF w/ mono formula + variables + worked example + quick_rule), visual (SVG/image support), deep_dive (expandable sections + bottom_line), example (walkthrough steps + key_insight), mistake (wrong/right comparison panels), summary (gradient border w/ numbered takeaways + interview_tip + next_preview)
- Navigation: Prev/Next buttons, clickable progress dots, keyboard arrows, touch swipe, card counter, animated transitions, top progress bar
- Last card "Next" becomes "Complete Notes" which calls markPhaseComplete(sessionId, 'notes') and navigates to /session/:sessionId/notes/complete
- AI-added session fallback: shows placeholder ("AI-generated notes coming soon") with skip-complete button
- Notes Complete page (/session/:sessionId/notes/complete): CSS confetti, animated checkmark, "Phase 1 of 4 done" badge, stats (cards reviewed, time spent), Continue to Quiz CTA, Review Notes Again link, Back to Dashboard

## Brand System (CSS Variables)
### Light Mode (default)
- --bg-primary: #F2E6EE, --bg-secondary: #EAD9E5
- --color-text: #1A1A2E, --color-text-muted: #6B6B7B
- --glass-bg: rgba(255, 255, 255, 0.65)

### Dark Mode
- --bg-primary: #02073D, --bg-secondary: #050d4a
- --color-text: #E8E6F0, --color-text-muted: #8B8A9E
- --glass-bg: rgba(255, 255, 255, 0.04)

### Shared
- --color-primary: #246BFD, --color-accent-purple: #6A5CFF, --color-accent-pink: #FF6AC1
- Fonts: Clash Display, Bricolage Grotesque, JetBrains Mono

## API Endpoints
- POST /api/waitlist - Join waitlist
- GET /api/waitlist/count - Waitlist count (+ 500 offset)
- POST /api/admin/login - Admin authentication
- GET /api/waitlist/all - Protected: all waitlist entries
- DELETE /api/waitlist/{entry_id} - Protected: delete entry

## Key Files
- /app/frontend/src/contexts/ThemeContext.jsx - Theme provider
- /app/frontend/src/contexts/AuthContext.jsx - Auth context
- /app/frontend/src/lib/supabase.js - Supabase client
- /app/frontend/src/index.css - Light/dark CSS variables
- /app/frontend/src/App.css - Theme-aware styles
- /app/frontend/src/components/Navbar.js - Theme toggle + auth nav
- /app/frontend/src/components/CoursesPage.jsx - Upgraded courses
- /app/frontend/src/components/CourseDetailsPage.jsx - Course details
- /app/frontend/src/components/CustomizePage.jsx - Customization wizard (Phase A)
- /app/frontend/src/components/PreviewPage.jsx - AI preview with visual diff (Phase B)
- /app/frontend/src/App.js - Router with ThemeProvider + AuthProvider
- /app/backend/server.py - FastAPI + MongoDB routes + /api/customize/generate endpoint

### Phase 10 - Session Notes System (Feb 2026)
- NotesPage.jsx: 8 card renderers (Hook, Concept, Formula, Visual, Deep Dive, Example, Mistake, Summary) rendering heterogeneous JSONB schemas from master_notes_cards
- Backend /api/visual/generate endpoint using Gemini Nano Banana for AI images on Visual cards
- localStorage + Supabase caching of generated images
- NotesCompletePage.jsx with confetti celebration + stats

### Phase 11 - Session Quiz System (Feb 2026)
- QuizStartPage.jsx (/session/:id/quiz/start): "Test Your Knowledge" heading, breadcrumb, info grid (questions, est time, 70% passing), tip card, Start Quiz CTA
- QuizPage.jsx (/session/:id/quiz): One question at a time with progress bar, 4 option cards (default/hover/selected/correct-green/wrong-red states), submit → explanation slide-in → forward-only next; keyboard shortcuts (1-4 + Enter); tracks [{question_id, selected_index, is_correct}]
- QuizCompletePage.jsx (/session/:id/quiz/complete): Circular score, pass (>=70%) vs fail states with confetti on pass, collapsible per-question breakdown showing user's answer + correct answer + explanation, Continue to Interview / Review Notes / Retry Quiz / Continue Anyway CTAs
- Persistence: markPhaseComplete('quiz', {quiz_score}) flips quiz_completed=true on pass; fail path updates quiz_score only

### Phase 12 - Session Interview Practice (Feb 2026)
- InterviewStartPage / InterviewPage / InterviewCompletePage with chat-aesthetic UI, "Mock Interview — Senior Analyst" header, typing dots → question bubble → 50-char-min textarea → Evaluating → feedback card flow, collapsed previous exchanges, forward-only navigation
- Three animated score rings on complete page (Technical / Communication / Structure) + per-question recap + Continue to Simulation + Practice Again CTAs
- Persistence: markPhaseComplete('interview', {interview_score: Math.round(overall)}) flips interview_completed=true
- Breadcrumb deduplication fix across SessionStart / QuizStart / InterviewStart ("Module 1: Module 1:" issue resolved)

### Phase 13 - AI-Powered Interview Evaluator (Feb 2026)
- POST /api/interview/evaluate using Claude Sonnet 4 via Emergent LLM Key; accepts question + response + context + evaluation_criteria + model_answer; returns strict JSON with per-dimension 1-5 scores + response-specific Strengths/Improvements bullets that quote candidate phrasing
- Frontend InterviewPage.jsx awaits LLM endpoint as primary path; /app/frontend/src/utils/interviewEval.js template evaluator kept as fallback on LLM failure
- Fixed bug where every answer got identical 3/5 + generic feedback (root cause: Supabase evaluation_criteria used must_cover/bonus_points/red_flags keys, not keywords/key_points expected by the template)
- Tests: /app/backend/tests/test_interview_evaluate.py (8 pytest cases) validated differentiated output across strong/mid/weak answers

### Phase 14 - Session Simulation + Session Complete (Feb 2026)
- SimulationStartPage (/session/:id/simulation/start): fetches master_simulations by master_session_id, renders type badge, scenario, objectives, how-to-play, Start Simulation CTA
- SimulationPage (/session/:id/simulation): dispatches to 1 of 4 type-specific renderers based on sim_type:
  - ExcelSim: dark-themed spreadsheet with JetBrains Mono, zebra rows, editable answer cells, Check Answers validates input against expected_value within tolerance, shows hint/explanation on repeat wrong attempts
  - DocumentSim: white/cream financial statement on dark bg with clickable highlights (tooltips) + sidebar task panel with number/text/free_text answer types
  - DecisionMakingSim: narrative engine with scenario_context, initial_data cards, selectable option cards, consequence reveal with score-impact pills, decision history timeline, terminal outcome with scoring.outcome_mapping + "See optimal path" toggle
  - InteractiveSim: 4 exercise sub-types using @dnd-kit/core + @dnd-kit/sortable — categorize (drag into categories), order (sortable list), match (click-to-connect with SVG lines), label (drag onto template_svg drop zones)
- SimulationCompletePage (/session/:id/simulation/complete): accuracy ring, performance summary, Complete Session CTA; redirects to /session/:id/complete if accessed without state
- SessionCompletePage (/session/:id/complete): "Session Complete!" hero + confetti, 4-phase grid with per-phase scores, dynamic CTA: Next Session if sibling exists → "Module Complete! Start Module Project" if last session → "Back to Dashboard"
- Persistence: markPhaseComplete('simulation', {simulation_score}) flips simulation_completed=true
- Tested: iteration_13.json — all routes, selectors, empty states, navigation verified. InteractiveSim sub-exercises not exercised E2E because live master_simulations seed data lacks config.exercise_type (SEED-DATA gap, not a bug — graceful fallback UI was verified).

### Phase 15 - Module Project + Capstone Systems (Feb 2026)
- ModuleProjectStartPage (/module/:moduleId/project/start): fetches user_module_projects joined with user_modules + master_module_projects; access control (all sessions in module must be completed, else locked state listing remaining sessions with Resume links); title/description/deliverable callout, estimated time + task count pills; "Start Project" CTA flips started_at
- ModuleProjectTasksPage (/module/:moduleId/project/tasks): progress bar X/Y; tasks rendered from master_module_projects.tasks JSONB via reusable TaskCard (checkbox + expandable description + Show Hints toggle + resource links); checked state in user_module_projects.tasks_progress ([{task_index, is_completed}]); optimistic updates with revert on error; tasks completable in any order; "Mark Project as Complete" enabled only when all done; triggers checkCapstoneUnlock on submit
- ModuleProjectCompletePage (/module/:moduleId/project/complete): confetti celebration, skills_demonstrated chips, dynamic CTA — "Begin Capstone" if all modules done, else "Continue to Module N+1 → /dashboard"
- CapstoneStartPage (/capstone/start): premium gradient-border hero card with trophy icon, fetches user_capstone_projects joined with master_capstone_projects; access control (ALL user_modules + ALL user_module_projects is_completed=true else locked with module/project remaining counts); final deliverable callout + estimated hours + phase count; "Begin Capstone" flips started_at
- CapstoneTasksPage (/capstone/tasks): collapsible phase sections from master_capstone_projects.phases (phase_title, phase_description, tasks[]); per-phase progress bar + overall progress bar; tracks [{phase_index, task_index, is_completed}] in user_capstone_projects.phases_progress; "Complete Capstone" flips is_completed=true AND updates user_enrollments.status='completed'
- CapstoneCompletePage (/capstone/complete): full-screen confetti (140 pieces) + cosmic twinkling particles; bouncing trophy medallion with pink→purple→blue gradient glow; custom SVG digital certificate/badge with user name, path title, date; journey summary grid (sessions, modules, projects, time, quiz average, capstone status); "Share Achievement" button using navigator.share with clipboard fallback
- Shared component: /components/projects/TaskCard.jsx (reused across Module Project + Capstone Tasks); includes hints toggle, resource chips with external-link icons, completed strikethrough state
- Wired new routes in App.js; fixed Dashboard ContinueLearningCard links (/module/:id/project → /start, /capstone/:enrId → /capstone/start); fixed SessionCompletePage "Start Module Project" CTA target
- Smoke tested: /capstone/start renders correctly with graceful "No capstone configured" empty state for test enrollment without master row

### Phase 16 - App Integration & Polish (Feb 2026)
- **Routing architecture** consolidated in App.js: lazy-loaded all protected routes (React.lazy + Suspense with branded RouteLoader), reduced initial bundle; public routes (/, /signup, /login, /referral) eager-loaded; 404 catch-all via `path="*"` → NotFoundPage
- **ErrorBoundary** (/components/ErrorBoundary.jsx): class component wrapping entire app; branded error UI with AlertTriangle hero + error message pre-block + "Reload app" + "Back home" CTAs; logs via componentDidCatch
- **EnrollmentGuard** (/components/EnrollmentGuard.jsx): queries user_enrollments for active/completed, redirects to /courses if none; shows branded shimmer loader during check; wraps all learning routes (/dashboard, /session/*, /module/*/project/*, /capstone/*)
- **SessionPhaseGuard** (/components/SessionPhaseGuard.jsx): enforces PHASE_ORDER — /quiz requires notes_completed, /interview requires quiz_completed, /simulation requires interview_completed; redirects to prior phase URL if incomplete; uses replace-navigation so back button stays clean
- **PageTransition** (/components/PageTransition.jsx): CSS fade+slide (translateY 6px → 0, opacity 0 → 1, 280ms) keyed on pathname so every navigation fresh-mounts with animation; respects prefers-reduced-motion
- **RouteLoader** (/components/RouteLoader.jsx): Suspense fallback with logo pulse + shimmer gradient bar
- **SettingsPage** (/settings): "Coming soon" gradient-border hero + 3-item roadmap (Email notifications / Privacy controls / Contact preferences) + Go-to-Profile link; re-added Settings to Sidebar nav
- **NotFoundPage** (catch-all): cosmic theme with orbital rings (30s + 50s animated), 40 deterministic twinkling stars, gradient 404 title (pink→purple→blue), Compass icon + "Lost in space" badge, "Go back" + "Take me home" CTAs
- Fixed CapstoneStartPage + SettingsPage gradient-border inner-card bg: changed bg-[var(--bg-primary)]/95 → bg-[var(--color-surface)] for proper contrast in both themes
- **Tested via iteration_14.json**: 14/14 spec items passed (100%) — public routes, auth guards, 404 catch-all, login flow, Profile (edit name, theme toggle, sign out), Settings (coming-soon + roadmap), Sidebar nav, PageTransition wrapper present on every route. One benign Supabase 400 console warning on sparsely-seeded tables (non-blocking).

### Phase 17 - Formula Card Content Enhancement (Feb 2026)
- **Acquired Supabase service-role key** (stored in /app/backend/.env as SUPABASE_SERVICE_ROLE_KEY) to bypass RLS on master_* tables for admin content edits
- **Three target formula cards rewritten by hand** with comprehensive variable definitions, plain-English meanings, computation steps, and worked Indian examples:
  - Session 2 (Risk & Return, M1 S2, id 444fdbc8): removed Sharpe & CAPM; kept HPR / Expected Return / Standard Deviation only; updated title accordingly
  - Session 6 (Income Statement HUL, M1 S6, id 2a57ec87): all 11 metrics (Gross Profit, Margins, EBITDA, EBIT, EBT, PAT, EPS, ETR…) gained variables, plain-English, computation, per-metric worked examples; preserved card-level HUL worked_example; NO excel_shortcuts field
  - Session 12 (M10 S4 Yield Curve, id c0ff08d9): full 5-formula rewrite — Term Spread (10Y−2Y), Recession Probability (10Y−3M), Real Yield, Equity DCF Sensitivity, OIS-Implied Forward Rate; comprehensive variables / plain-English / computation steps / Indian-context worked examples; NO excel_shortcuts field
- **Bulk-enhanced 116 remaining formula cards** via Claude Haiku 4.5 through emergentintegrations using EMERGENT_LLM_KEY (with concurrency=3 thread executor; Sonnet 4.5 was rejected by gateway with 502s on long generations); 4 large cards re-run with max_tokens=12000 to avoid output truncation
- **FormulaSubCard component updated** (/app/frontend/src/components/NotesPage.jsx): now renders new fields — `plain_english` (purple-tinted callout), `computation` (ordered list under "How to Compute"), `sensitivity` / `analyst_note` / `excel` — while preserving all legacy fields (notes, tells, worked_example)
- Audit trail: per-card before/after JSON snapshots in /app/scripts/enhancement_log/{card_id}.json + run summary in summary.json
- Verified end-to-end: TVM formula card renders Variables, In Plain English, Worked Example sections correctly in the Notes review flow

### Phase 18 - Module 1 Quiz Explanation Enhancement (Feb 2026)
- All 150 Module 1 quiz questions (15 sessions × 10 questions) had their `explanation` field rewritten to a consistent six-section template: Formula (named, general form, variables defined inline) → Step-by-step substitution → Result → Why this is correct → Why the others are wrong (per-option A/B/C/D breakdown) → Intuition (analyst-level mental model)
- Pure-conceptual questions get "Concept:" instead of Formula and skip the calculation steps; rest of the template preserved
- Driven via Claude Haiku 4.5 (emergentintegrations / EMERGENT_LLM_KEY) at concurrency=4; full sweep in ~2 minutes (avg 6.9s/question)
- Verified in DB: 150/150 follow the template; length range 1.2k–3.1k chars (avg 1.8k); audit logs in /app/scripts/quiz_log/{question_id}.json
- Frontend already renders `whitespace-pre-wrap` in QuizPage and QuizCompletePage so section breaks display cleanly without code changes

### Phase 19 - Module 1 / Session 6 Simulation Replacement (Feb 2026)
- DELETED the existing `interactive` sim "The Income Statement Deep Dive" for session_id c3a21f75-... (id ddd47a8d-...)
- INSERTED a new `document`-type simulation: "Income Statement Forensics — Reading BharatBites' P&L Like an Analyst"
- Rich content: fictional Indian biscuits/snacks mid-cap (BharatBites Ltd) FY24 vs FY23 P&L with 6 sections (Revenue, COGS, Operating Expenses, Finance & Exceptional, Profit & Tax, Per Share); 8 interactive line-item highlights (tooltips on Revenue from Operations, Other Income, inventory change, advertising, D&A, finance cost, exceptional item, tax expense)
- 12 tasks covering full income-statement workflow: 9 numerical (gross profit, gross margin, EBITDA, EBITDA margin, EBIT, other-income / PBT %, ETR, normalised PAT, EPS, operating-leverage multiple), 1 text identification (other-income line), 1 free-text Quality-of-Earnings analyst note with sample answer
- All numerical answers are internally consistent (GP = 4820 − 2475 = 2345, GM% = 48.7, EBITDA = 1035, EBITDA% = 21.5, EBIT = 870, ETR = 25.5%, normalised PAT = 759 cr, EPS = ₹34.13)
- DocumentSim.jsx already renders this schema natively (document_data → paper-style P&L with FY24/FY23 columns and section totals; interactive_highlights → click-to-reveal tooltips on underlined items; tasks → right-side panel with submit/feedback/next flow); SimulationStartPage already wired with FileText icon + blue accent for document type — NO frontend code changes needed
- Verified shape via /app/scripts/verify_s6_sim.py: all line-item ids match all highlight ids, all tasks have explanations or sample answers, structural checks pass

### Phase 20 - Module 1 / Sessions 7 & 8 Simulation Replacements (Feb 2026)
- DELETED prior simulations:
  - S7 (Balance Sheet, session 9559a9ba-...): old `decision_making` sim id 2640edac-...
  - S8 (Cash Flow Statement, session 4af45899-...): old `interactive` sim id 499e93bf-...
- INSERTED new `document`-type simulations (both follow the same schema as S6):
  - S7: "Balance Sheet Forensics — Diagnosing TitanWorks' Financial Health" (sim id e6697f5b-...) — fictional jewelry mid-cap TitanWorks Ltd; 6 sections (Equity, Non-Current Liabilities, Current Liabilities, Non-Current Assets, Current Assets, BS Total); 8 line-item highlights; 11 tasks (current ratio, quick ratio, interest-bearing debt, net debt, D/E, NWC, ROU identification, BVPS, inventory days, capital employed, free-text BS quality note with sample answer); all numerics cross-checked (CR=1.88, QR=0.65, Net Debt=−₹700 cr, BVPS=₹129.1, Inv Days=197, Cap Employed=₹14,589 cr)
  - S8: "Cash Flow Forensics — Following the Money at RangoorPaints" (sim id 0e9dfa08-...) — fictional decorative-paints mid-cap RangoorPaints Ltd; 4 sections (CFO indirect-method walk with WC sub-lines, CFI, CFF, Reconciliation); 12 line-item highlights; 12 tasks (Net CFO, cash conversion CFO/PAT, FCF, D&A line ID, net capex, net long-term debt, shareholder payout, WC drag, acquisition spend, closing cash, FCF yield, free-text quality note with sample answer); all numerics cross-checked (CFO=₹4,780, FCF=₹2,980, WC drag=−₹370, closing cash=₹1,800 cr; full statement reconciles)
- DocumentSim.jsx already supports both documents natively — zero frontend changes required
- Verified end-to-end via /app/scripts/verify_s78_sims.py — schema, highlight matching, task explanations, and arithmetic all pass

### Phase 21 - Module 1 / Session 10 Simulation Replacement (Feb 2026)
- DELETED prior decision-making sim "Corporate Finance Essentials — Capital Structure Analyst Simulation" (id 0bbf18c6-..., session 3b749a86-...) which had broken/incomplete config
- INSERTED new `decision_making` sim "Capital Structure Workshop — Funding ChaiBro's National Rollout" (id a2da2ae6-...) — fictional Indian tea/coffee chain ChaiBro Beverages CFO scenario
- Clean 3-decision linear flow (no branching, simple to follow as user requested):
  - D1 Funding Mix (3 options: 100% debt / 100% equity / 60-40 mix)
  - D2 Debt Tenure (3 options: 3yr / 5yr / 7yr)
  - D3 Capex Pacing (3 options: aggressive 12mo / balanced 18mo / conservative 24mo) — all terminal
- Three scoring dimensions: cost_efficiency, financial_flexibility, shareholder_value (consistent across all options)
- Score range: max +8 (all-optimal path C→B→B), min −5 (all-worst path B→A→A); 4 outcome bands mapped at −10/0/4/7 → Capital Structure Damaged → Mixed → Solid → Textbook
- Includes scenario_context, initial_data tiles (capex required, EBITDA, net debt, D/E, outlets, markets), per-option consequence narrative, score_impact triple, and Board-verdict outcome with full narrative
- DecisionMakingSim.jsx already supports this schema natively — zero frontend changes required
- Verified via /app/scripts/replace_s10_simulation.py: structural checks pass; every non-terminal option has valid next_decision link; optimal path totals exactly max_total (8); 4 outcome bands sorted correctly

### Phase 23 - Module 1 Sessions 1, 2, 4, 9, 11, 12, 13 Simulation Replacements (Feb 2026)
- DELETED 7 prior `interactive`-type simulations and replaced with topic-aligned new sims:
  - S1 TVM → `decision_making` "TVM Workshop — Growing ₹10 Lakh for a 5-Year Home Down-Payment" (vehicle / compounding frequency / front-loading; optimal totals 14)
  - S2 Risk & Return → `decision_making` "Risk & Return Workshop — Picking Among Three Stock Scenarios" (compute E(R) / σ / risk-adjusted; aligned with the post-update S2 notes covering only HPR, E(R), σ — no Sharpe/CAPM)
  - S4 Big Three → `document` "The Big Three — Identifying Where Each Line Lives in GreenLeaf Foods" (3 statements side-by-side, 10 tooltips, 10 identification + computation tasks)
  - S9 Linking the Three → `document` "Linking the Three Statements — A FY25 Roll-Forward Exercise" (opening BS + FY25 P&L + FY25 CFS; tasks roll forward closing R&S, PP&E, LT Debt, Cash)
  - S11 WACC → `decision_making` "WACC Workshop — Setting the Discount Rate for an Acquisition" (sector beta / after-tax Rd / market-value weights; converges on WACC ≈ 12.6%)
  - S12 Yield Curve → `decision_making` "Yield Curve Reading Workshop — Three Curve Shapes, Three Signals" (inverted = recession / steepening = reflation / flat = late-cycle warning)
  - S13 Statistics → `decision_making` "Stats Workshop — Three Quick-Fire Calls Every Analyst Faces" (median for skewed / correlation ≠ causation / p-value framing)
- All 5 decision-making sims: 3 sequential linear decisions × 3 options, 4 outcome bands each, scoring dimensions consistent across all decisions per sim
- Both document sims: 3 sections (P&L / BS / CFS or BS-open / P&L / CFS), 7–10 interactive tooltips, 9–10 mixed identification/computation/free-text tasks with sample answers
- DocumentSim.jsx and DecisionMakingSim.jsx already support these schemas natively — zero frontend changes
- Verified via /app/scripts/replace_m1_seven_sims.py: all `next_decision` links valid; optimal paths reach top outcome band; all highlight IDs match line-item IDs; all tasks have explanation or sample_answer

### Phase 22 - Module 1 / Sessions 14 & 15 Simulation Replacements (Feb 2026)
- DELETED prior simulations:
  - S14 Microeconomics: old decision-making sim id 6986ffbc-... (broken/incomplete config)
  - S15 Macroeconomics: old decision-making sim id 34199ce6-... (broken/incomplete config)
- INSERTED new simple, complete `decision_making` sims (3 sequential decisions, all linear, last-decision terminal — same pattern as ChaiBro):
  - S14 (id 89b5ceaf-...): "Industry Position Workshop — Sizing SunChem Paints in Your Coverage" — analyst initiation flow on a fictional Indian decorative-paints mid-cap. D1 Industry Structure (oligopoly vs commodity vs monopoly) → D2 Pricing-Power Signal (read March +8% hike + industry follow-through) → D3 Position Sizing (overweight / equal / underweight). Dimensions: analytical_rigor, moat_signal_read, conviction_quality. Outcome bands: Initiation Withdrawn → Caveated → Solid → Best-in-Class
  - S15 (id 1b3fe7cf-...): "Macro-to-Market Workshop — Trading the RBI's Surprise 50 bps Hike" — Friday-2:30PM trading-floor scenario with curve flattening, INR move, sector rotation. D1 Yield-Curve Read (flattener vs steepener vs parallel) → D2 Sector Rotation (private banks vs growth tech vs wait) → D3 Equity Duration Trim (long-duration growth vs value vs no action). Dimensions: macro_framework, transmission_logic, timing_quality. Outcome bands: Macro Misfired → Mixed → Solid → Top-Decile
- Both include scenario_context, initial_data tiles (industry stats / yield-curve numbers respectively), per-option consequence narrative, score_impact triple, terminal Board/CIO verdict
- DecisionMakingSim.jsx supports both natively — zero frontend changes required
- Verified via /app/scripts/replace_s14_15_simulations.py: structural checks pass; every non-terminal option has valid next_decision; optimal paths reach top outcome band; worst paths reach bottom band


- P1: Email confirmation/notification on waitlist signup
- P1: Seed master_simulations with config.exercise_type for each of the 4 interactive sub-types to enable E2E regression of drag-drop
- P2: Post-login redirect logic review (currently /courses; consider /dashboard)
- P2: Dynamic SEO meta tags
- P2: Refactor ConfirmPage.jsx client-side enrollment → backend RPC for atomic transactions
- P2: Add phase-specific data-testids on SessionStartPage (phase-quiz-status=DONE|TODO) for deterministic regression testing
- P2: Refactor NotesPage.jsx (1360 lines) — extract 8 card renderers into /components/notes_cards/
- P3: Analytics integration
- P3: Migrate waitlist from MongoDB to Supabase
- P3: Refactor DashboardPage.jsx (~670 lines) — extract ContinueLearningCard / ModuleCard / StatCard into /components/dashboard/
- P3: Use useRef-based lock in QuizCompletePage save() instead of state flag (StrictMode double-mount hardening)
