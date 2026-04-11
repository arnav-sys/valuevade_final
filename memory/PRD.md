# Valuevade - PRD

## Problem Statement
Premium landing page + waitlist for "Valuevade" — AI-powered career copilot for finance students. Dark cosmic premium aesthetic. React + FastAPI + MongoDB.

## Architecture
- **Backend**: FastAPI (server.py) with MongoDB for waitlist storage + JWT admin auth
- **Frontend**: React with Tailwind CSS, custom CSS animations, Shadcn UI components
- **Database**: MongoDB (waitlist collection)

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
- Login: info@valuevade.com / aa1aa2sam3
- View all waitlist entries (sorted newest first)
- Delete individual entries
- Protected routes with Bearer token auth

### Phase 4 - Data Cleanup (Feb 2026)
- Removed all 16 test entries from waitlist collection
- Database is now clean for production use

## API Endpoints
- POST /api/waitlist - Join waitlist (name, email, optional ref_code)
- GET /api/waitlist/count - Get total waitlist count (+ 500 offset)
- POST /api/admin/login - Admin authentication
- GET /api/waitlist/all - Protected: all waitlist entries
- DELETE /api/waitlist/{entry_id} - Protected: delete entry

## Backlog
- P1: CSV Export from Admin Dashboard
- P1: Email confirmation/notification on signup
- P2: Dynamic SEO meta tags for expanded routing
- P2: Analytics integration
- P3: A/B testing for CTA copy
