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

- P1: Build session Simulation phase player (phase 4 of 4 — interview done)
- P1: Module project + Capstone project pages
- P1: Profile + Settings pages (currently sidebar links to placeholders)
- P1: CSV Export from Admin Dashboard
- P1: Email confirmation/notification on waitlist signup
- P2: Post-login redirect logic review (currently /courses; consider /dashboard)
- P2: Dynamic SEO meta tags
- P2: Refactor ConfirmPage.jsx client-side enrollment → backend RPC for atomic transactions
- P2: Add phase-specific data-testids on SessionStartPage (phase-quiz-status=DONE|TODO) for deterministic regression testing
- P2: Refactor NotesPage.jsx (1360 lines) — extract 8 card renderers into /components/notes_cards/
- P3: Analytics integration
- P3: Migrate waitlist from MongoDB to Supabase
- P3: Refactor DashboardPage.jsx (~670 lines) — extract ContinueLearningCard / ModuleCard / StatCard into /components/dashboard/
- P3: Use useRef-based lock in QuizCompletePage save() instead of state flag (StrictMode double-mount hardening)
