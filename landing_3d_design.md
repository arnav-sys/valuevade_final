# Valuevade 3D Interactive Landing Page & Conversion Blueprint

## Implementation status — 2026-10-21
Latest screenshot follow-up: desktop hero now includes course-benefit and portfolio-outcome
rails at >=1200px. The AI Advantage band explicitly overrides the legacy transparent-section
rule to retain its navy surface in both themes. Verified real text contrast and responsive
isolation in iteration99; see PRD.md for details.

The proposal below informed the design; the implemented source of truth is
`frontend/src/components/landing/immersive/` and PRD.md. Implementation deliberately
uses a concrete Three.js finance desk rather than ambient orbital nodes, keeps
all letter spacing at zero, and uses clearly labeled deterministic practice examples
rather than claiming live AI scoring or stock data. Only vanilla Three.js was needed;
no Fiber/Drei or additional dependencies were added. All styles are scoped to the
landing page. QA iterations 97–98 verified the final page and non-landing isolation.

## Executive Summary & Design Vision
Valuevade is an AI-personalised equity research and financial modelling education platform tailored for Indian students and young professionals. The entire landing page redesign transforms the static presentation into an **immersive, 3D interactive, high-converting cinematic experience**.

By combining **Three.js canvas interactive stages**, **tactile financial simulations (AI Mock Interview, Live Excel Valuation Model, 3D Document Simulation)**, and **conversion-first visual hierarchy**, this redesign creates immediate trust, emotional engagement, and frictionless onboarding into the ₹4,999 lifetime course (or Free First Session signup).

---

## Brand Identity & Aesthetic Foundations
- **Primary Brand Palette (from PDF Spec & Tokens)**:
  - Lavender Background: `#F5ECFF` (Light) / `#0A0D28` (Dark)
  - Deep Navy Ink: `#02073D` (Light) / `#F5F1FF` (Dark)
  - Interactive Electric Blue: `#246BFD` (Primary CTA)
  - Deep Violet Accent: `#6A5CFF` (Hero headings & highlights)
  - Vibrant Magenta Accent: `#FF6AC1` (Interactive states & glow)
  - Financial Success Emerald: `#0F9D78` (Data indicators & badges)
- **Typography Pairing**:
  - Headings & Display: `Outfit` (Bold / SemiBold, tight letter spacing)
  - Body & Microcopy: `Instrument Sans` (Clean, highly legible)
  - Metrics, Tickers & Code: `Spline Sans Mono` (Technical precision)
- **Theme Support**: Complete Light (`landing-light`) and Dark (`landing-dark`) dual-theme preservation with glassmorphism backdrop-blurs (`backdrop-blur-xl bg-white/80` or `bg-[#0A0D28]/80`).

---

## 3D Interactive Visual Direction & Canvas Strategy

### 1. Hero 3D Kinetic Financial Mesh Canvas (`LandingHero3D` Re-activation)
- **Concept**: A real-time 3D ambient canvas behind/adjacent to the hero copy depicting a dynamic 3D financial data ribbon, floating volumetric candle bars, and interactive node orbits representing AI equity analysis.
- **Interactivity**: Mouse movement triggers subtle rotation and depth tilt (parallax). Clicking nodes reveals micro tooltips (e.g., "DCF Valuation", "AI Pitch Feedback").
- **Lighting & Material**: Soft metallic glass shaders with physical rim lighting matching `#246BFD` and `#6A5CFF`.
- **Theme Adaptability**: In Light mode, renders with high-refraction soft lavender-tinted crystal mesh. In Dark mode, renders illuminated neon violet/blue nodes against `#0A0D28`.

### 2. Interactive Product Preview Stage (`HeroProductShowcase` 3D Enhancement)
- **Mode 1: AI Mock Interviewer**: Interactive 3D avatar pulse & audio wave visualizer. Users can click sample student answers to see real-time AI scoring and sentiment breakdowns.
- **Mode 2: Dynamic Excel DCF Valuation Studio**: Interactive 3D tilt-card displaying live financial formula nodes, sensitivity matrix sliders, and real Indian stock ticker toggles (e.g., Reliance, TCS, HDFC Bank).
- **Mode 3: Document Analysis & Redline Simulator**: 3D page flip effect over annual reports (10-K / DRHP) with interactive AI text-highlighting and key risk extraction.

### 3. Interactive Curriculum 3D Module Orbit
- 3D interactive carousel wheel where users can rotate through the 21 Modules & 239 Sessions, with hover depth elevation and capstone preview badges.

---

## Page Architecture & Conversion Flow (Top to Bottom)

1. **Top Navigation Bar**:
   - Logo, Navigation Links (Curriculum, Interactive Demo, Faculty, Pricing, FAQ), Theme Switcher, and Sticky "Start Free Session" CTA.
2. **Interactive 3D Hero Section**:
   - Headline: *"A new way of mastering finance in the age of AI."*
   - Interactive 3D Financial Node Canvas.
   - Dual CTAs: "Start Free Session" (Primary Blue) + "Explore Curriculum" (Ghost).
   - Trust/Access Badge: ₹4,999 lifetime access · Free first session · No subscription.
3. **Key Stats Ledger Strip**:
   - 21 Modules | 239 Sessions | 100+ hrs Learning | 3 Capstones | NISM XV Prep | ₹4,999 Lifetime.
4. **Interactive Practice Ground (Product Preview Studio)**:
   - Live tabbed 3D interactive preview of AI Mock Interview, Excel Modeling, and Report Analysis.
5. **Social Proof & Company Coverage**:
   - Interactive company grid covering Indian conglomerates analysed in class (TCS, Reliance, HDFC, Infosys, ICICI, L&T).
6. **Faculty & Industry Mentors Section**:
   - Interactive mentor cards with bio expansions, LinkedIn verification links, and domain expertise tags.
7. **Problem vs. Solution Comparison Section**:
   - Interactive split view: Traditional Finance Coaching vs. Valuevade AI-Driven Real Practice.
8. **Curriculum & Learning Path Explorer**:
   - Searchable, collapsible accordion with hands-on capstone project previews and skill badges.
9. **Practical Skills Matrix**:
   - Dynamic skill tags and real-world outcome cards.
10. **Interactive ROI & Price Transparency Comparison**:
    - Valuevade (₹4,999 lifetime) vs. Executive MBAs / Offline Coaching (₹1,50,000+).
11. **Student Success Stories & Testimonials**:
    - Real, authentic student reviews and career progression cards without fabricated numbers.
12. **FAQ Accordion with AI Search Bot**:
    - Instant question lookup + embedded dynamic AI helper chatbot.
13. **Final Conversion CTA Banner**:
    - High-impact glassmorphic card with instant signup trigger and lifetime access guarantee.
14. **Mobile Conversion Sticky Dock**:
    - Fixed bottom conversion bar for mobile viewports with quick "Start free" button.

---

## Technical Performance & Accessibility Standards
- **Performance**: Lazy loading for Three.js canvases, low-polygon geometries for mobile GPUs, `prefers-reduced-motion` fallbacks.
- **Accessibility**: WCAG AA contrast compliance across both light and dark modes, keyboard navigable 3D controls, `aria-labels` and `data-testid` attributes on all interactive elements.
