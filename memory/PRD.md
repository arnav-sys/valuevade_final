# Valuevade - PRD

## Problem Statement
Premium landing page + waitlist for "Valuevade" — AI-powered career copilot for finance students. Dark cosmic premium aesthetic. React + FastAPI + MongoDB.

## Architecture
- **Backend**: FastAPI (server.py) with MongoDB for waitlist storage
- **Frontend**: React with Tailwind CSS, custom CSS animations, Shadcn UI components
- **Database**: MongoDB (waitlist collection)

## What's Been Implemented (Dec 2025)
- Full landing page with 8 sections: Hero, Problem, Features Bento Grid, How It Works, AI-Proof, Testimonials, Final CTA, Footer
- Waitlist form submission stored in MongoDB with email validation
- Waitlist confirmation page with confetti, animated checkmark, position display
- Custom cursor (pink dot + trailing ring)
- 80 star particles with twinkle animations
- 3 orbital ellipses with rotation animations
- Glassmorphism cards throughout
- Scroll reveal animations (IntersectionObserver)
- Stats counter animation
- Mobile responsive design with hamburger menu + sticky bar
- Copy-to-clipboard share functionality
- Full SEO meta tags, OG tags, schema markup
- Brand fonts: Clash Display, Bricolage Grotesque, JetBrains Mono

## API Endpoints
- POST /api/waitlist - Join waitlist (name, email) → position
- GET /api/waitlist/count - Get total waitlist count

## Backlog
- P1: Add actual social media links (Instagram, LinkedIn, YouTube)
- P1: Blog page
- P2: Email confirmation/notification on signup
- P2: Referral tracking system
- P3: A/B testing for CTA copy
- P3: Analytics integration
