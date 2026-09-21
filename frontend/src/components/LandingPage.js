import { useState, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { X, ArrowRight } from 'lucide-react';
import CustomCursor from '@/components/CustomCursor';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import SocialProofStrip from '@/components/SocialProofStrip';
import ProblemSection from '@/components/ProblemSection';
import FeaturesSection from '@/components/FeaturesSection';
import ComparisonSection from '@/components/ComparisonSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import AIProofSection from '@/components/AIProofSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import FinalCTASection from '@/components/FinalCTASection';
import FreeTrialCTA from '@/components/FreeTrialCTA';
import WhatYoullLearnSection from '@/components/WhatYoullLearnSection';
import WhoBuiltThisSection from '@/components/WhoBuiltThisSection';
import FacultySection from '@/components/FacultySection';
import Footer from '@/components/Footer';
import FaqAccordion from '@/components/faq/FaqAccordion';
import FaqChatbot from '@/components/faq/FaqChatbot';
import { homeOrgJsonLd } from '@/components/landing/jsonLd';
import LandingIntroSequence from '@/components/landing/LandingIntroSequence';
import { ScrollProgressBar } from '@/components/cinematic/primitives';
import { useTheme } from '@/contexts/ThemeContext';
import '@/components/landing/landing-dark.css';

const LandingHero3D = lazy(() => import('@/components/landing/LandingHero3D'));

export default function LandingPage() {
  const [showMobileBar, setShowMobileBar] = useState(true);

  // Theme is now centrally owned by ThemeContext (single source of truth
  // for both landing AND auth-gated routes). Landing simply derives its
  // dark/light split from `theme` and mirrors the toggle through.
  const { theme, toggleTheme } = useTheme();
  const landingTheme = theme;
  const toggleLandingTheme = toggleTheme;

  // Body class is applied in both modes so iOS overscroll always shows the
  // landing palette (dark or light) — never the default app surface. The
  // CSS branches between dark/light using the `landing-light` companion class.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add('landing-active');
    body.classList.add('landing-active');
    if (landingTheme === 'light') {
      root.classList.add('landing-light');
      body.classList.add('landing-light');
    } else {
      root.classList.remove('landing-light');
      body.classList.remove('landing-light');
    }
    return () => {
      root.classList.remove('landing-active', 'landing-light');
      body.classList.remove('landing-active', 'landing-light');
    };
  }, [landingTheme]);

  return (
    <div
      className={`${landingTheme === 'dark' ? 'landing-dark' : 'landing-light'} bg-[var(--bg-primary)] min-h-screen relative`}
      data-testid="landing-page"
      data-landing-theme={landingTheme}
      style={{ transition: 'background-color 250ms ease, color 250ms ease' }}
    >
      <Helmet>
        <title>Equity Research & Financial Modelling Course — Valuevade</title>
        <meta name="description" content="AI-personalised equity research & financial modelling course for Indian students. 239 hands-on sessions, NISM Series XV prep, certificate — ₹4999 lifetime." />
        <link rel="canonical" href="https://valuevade.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://valuevade.com/" />
        <meta property="og:title" content="Equity Research & Financial Modelling Course — Valuevade" />
        <meta property="og:description" content="AI-personalised equity research and financial modelling course for Indian finance students. 239 hands-on sessions on real Indian companies. ₹4999 lifetime." />
        <meta property="og:image" content="https://valuevade.com/valuevade-logo.png" />
        <meta property="og:site_name" content="Valuevade" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Equity Research & Financial Modelling Course — Valuevade" />
        <meta name="twitter:description" content="AI-personalised equity research and financial modelling course for Indian finance students. 239 hands-on sessions on real Indian companies. ₹4999 lifetime." />
        <meta name="twitter:image" content="https://valuevade.com/valuevade-logo.png" />
        <script type="application/ld+json">{JSON.stringify(homeOrgJsonLd)}</script>
      </Helmet>
      <CustomCursor />
      <ScrollProgressBar />
      <LandingIntroSequence />
      <Navbar
        landingTheme={landingTheme}
        onToggleLandingTheme={toggleLandingTheme}
      />

      {/* Cinematic Three.js background — retired from the above-the-fold
          in Feb 2026 editorial redesign. HeroSection now ships its own
          restrained chart/grid backdrop. Kept lazy import in case we
          bring it back for a section further down the page. */}
      {false && (
        <div className="absolute top-0 left-0 right-0 h-screen overflow-hidden pointer-events-none" aria-hidden="true">
          <Suspense fallback={null}>
            <LandingHero3D
              theme={landingTheme}
              mobile={typeof window !== 'undefined' && window.innerWidth < 768}
            />
          </Suspense>
        </div>
      )}

      <main className="relative z-10">
        <HeroSection />
        <SocialProofStrip />
        <ProblemSection />
        <FeaturesSection />
        <WhatYoullLearnSection />
        <WhoBuiltThisSection />
        <FacultySection />
        <ComparisonSection />
        <TestimonialsSection />
        <HowItWorksSection />
        <AIProofSection />
        <FreeTrialCTA />
        <FaqAccordion />
        <FinalCTASection />
      </main>

      <Footer />
      <FaqChatbot />

      {showMobileBar && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden mobile-sticky-bar"
          data-testid="mobile-sticky-bar"
        >
          <div className="bg-[var(--bg-primary)]/95 backdrop-blur-xl border-t border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
            <p className="text-[var(--color-text-muted)] text-sm font-bricolage flex-1">
              ₹4999 lifetime · Free first session
            </p>
            <Link
              to="/signup"
              className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-full flex items-center gap-1.5"
              data-testid="mobile-bar-cta"
            >
              Start free <ArrowRight size={14} />
            </Link>
            <button
              onClick={() => setShowMobileBar(false)}
              className="ml-2 text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
              data-testid="mobile-bar-dismiss"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
