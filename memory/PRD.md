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

## Backlog
- P1: CSV Export from Admin Dashboard
- P1: Email confirmation/notification on waitlist signup
- P1: Course customization & enrollment flow (/course/:id/customize)
- P2: Build Dashboard with enrollment tracking & progress
- P2: Dynamic SEO meta tags
- P2: Smooth onboarding flow after signup
- P3: Analytics integration
- P3: Migrate waitlist from MongoDB to Supabase
