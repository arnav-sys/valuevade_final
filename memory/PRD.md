# Valuevade - PRD

## Problem Statement
Premium landing page + waitlist for "Valuevade" — AI-powered career copilot for finance students. Dark cosmic premium aesthetic. React + FastAPI + MongoDB.

## Architecture
- **Backend**: FastAPI (server.py) with MongoDB for waitlist storage + referral system
- **Frontend**: React with Tailwind CSS, custom CSS animations, Shadcn UI components
- **Database**: MongoDB (waitlist collection with referral tracking)

## What's Been Implemented (Dec 2025)
### Phase 1 - Landing Page MVP
- Full landing page with 8 sections: Hero, Problem, Features Bento Grid, How It Works, AI-Proof, Testimonials, Final CTA, Footer
- Waitlist form submission stored in MongoDB with email validation
- Waitlist confirmation page with confetti, animated checkmark, position display
- Custom cursor, star particles, orbital ellipses, glassmorphism cards
- Scroll reveal animations, stats counter, mobile responsive
- Full SEO meta tags, OG tags, schema markup

### Phase 2 - Referral System & Logo Update
- Referral code generation (6-char alphanumeric) for each waitlist entry
- Referral link sharing with copy-to-clipboard
- Position boost: each referral moves user 5 spots up
- Referral leaderboard (top 10 referrers)
- Referral stats API per user
- SVG logo replacement in Navbar and Footer
- Migration logic for existing entries without referral fields

## API Endpoints
- POST /api/waitlist - Join waitlist (name, email, optional ref_code) → position + referral_code
- GET /api/waitlist/count - Get total waitlist count
- GET /api/waitlist/leaderboard - Top 10 referrers
- GET /api/waitlist/stats/{referral_code} - Referral stats for a user

## Backlog
- P1: Add actual social media links (Instagram, LinkedIn, YouTube)
- P1: Email confirmation/notification on signup
- P2: Advanced referral tracking (multi-level, time-based bonuses)
- P2: Admin dashboard for waitlist management
- P3: A/B testing for CTA copy
- P3: Analytics integration
