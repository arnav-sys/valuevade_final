# Valuevade - PRD

## Problem Statement
Premium landing page + waitlist + AI-powered career learning platform for finance professionals. Dark cosmic premium aesthetic. React frontend + Supabase backend + MongoDB (legacy waitlist).

## Architecture
- **Frontend**: React with Tailwind CSS, Supabase JS client, custom CSS animations, Shadcn UI components
- **Backend (Legacy)**: FastAPI (server.py) with MongoDB for waitlist storage + JWT admin auth
- **Backend (New)**: Supabase (PostgreSQL) for user auth, profiles, enrollments, courses
- **Database**: MongoDB (waitlist), Supabase PostgreSQL (profiles, user_enrollments, courses)

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
- Signup page (/signup): Full Name, Email, Password, Confirm Password with validation
- Login page (/login): Email/Password with enrollment-based redirect logic
- ProtectedRoute component with loading spinner
- Placeholder pages: /courses and /dashboard (behind auth)
- Brand CSS variables system applied globally
- Toaster (sonner) for notifications

## Brand System (CSS Variables)
- --bg-primary: #02073D, --color-primary: #246BFD
- --color-accent-purple: #6A5CFF, --color-accent-pink: #FF6AC1
- --color-text: #E8E6F0, --color-text-muted: #8B8A9E
- Fonts: Clash Display, Bricolage Grotesque, JetBrains Mono

## API Endpoints
- POST /api/waitlist - Join waitlist
- GET /api/waitlist/count - Waitlist count (+ 500 offset)
- POST /api/admin/login - Admin authentication
- GET /api/waitlist/all - Protected: all waitlist entries
- DELETE /api/waitlist/{entry_id} - Protected: delete entry

## Key Files
- /app/frontend/src/lib/supabase.js - Supabase client
- /app/frontend/src/contexts/AuthContext.jsx - Auth context
- /app/frontend/src/components/SignupPage.jsx - Signup page
- /app/frontend/src/components/LoginPage.jsx - Login page
- /app/frontend/src/components/ProtectedRoute.jsx - Auth guard
- /app/frontend/src/components/CoursesPage.jsx - Courses placeholder
- /app/frontend/src/components/DashboardPage.jsx - Dashboard placeholder
- /app/frontend/src/App.js - Router with AuthProvider
- /app/backend/server.py - FastAPI + MongoDB routes

## Backlog
- P1: Build actual Courses page with Supabase course data
- P1: Build Dashboard with enrollment tracking
- P1: CSV Export from Admin Dashboard
- P2: Email confirmation on waitlist signup
- P2: Dynamic SEO meta tags
- P3: Analytics integration
