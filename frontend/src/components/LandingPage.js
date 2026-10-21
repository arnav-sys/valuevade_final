import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { X, ArrowRight } from 'lucide-react';
import SocialProofStrip from '@/components/SocialProofStrip';
import ComparisonSection from '@/components/ComparisonSection';
import Footer from '@/components/Footer';
import FaqAccordion from '@/components/faq/FaqAccordion';
import FaqChatbot from '@/components/faq/FaqChatbot';
import { homeOrgJsonLd } from '@/components/landing/jsonLd';
import { ScrollProgressBar } from '@/components/cinematic/primitives';
import { useTheme } from '@/contexts/ThemeContext';
import '@/components/landing/landing-dark.css';
import LandingNav from './landing/immersive/LandingNav';
import ImmersiveHero from './landing/immersive/ImmersiveHero';
import PracticeStudio from './landing/immersive/PracticeStudio';
import LearningJourney from './landing/immersive/LearningJourney';
import { CourseStats, OutcomeSection, AIEdgeSection } from './landing/immersive/ValueSections';
import LandingPeople from './landing/immersive/LandingPeople';
import PricingSection, { ClosingSection } from './landing/immersive/PricingSection';
import './landing/immersive/immersive.css';

export default function LandingPage() {
  const [showMobileBar, setShowMobileBar] = useState(true);
  const [hasPassedHero, setHasPassedHero] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('hero');
    if (!hero) return;
    let frame = 0;
    const measure = () => {
      const bounds = hero.getBoundingClientRect();
      setHasPassedHero(bounds.height > 0 && window.scrollY > 0 && bounds.bottom <= 0);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(hero);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, []);

  // Theme is now centrally owned by ThemeContext (single source of truth
  // for both landing AND auth-gated routes). Landing simply derives its
  // dark/light split from `theme` and mirrors the toggle through.
  const { theme, toggleTheme } = useTheme();
  const landingTheme = theme;
  const toggleLandingTheme = toggleTheme;

  // Body class is applied in both modes so iOS overscroll always shows the
  // landing palette (dark or light), never the default app surface. The
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
      className={`vv-immersive ${landingTheme === 'dark' ? 'landing-dark' : 'landing-light'} min-h-screen relative`}
      data-testid="landing-page"
      data-landing-theme={landingTheme}
      style={{ transition: 'background-color 250ms ease, color 250ms ease' }}
    >
      <Helmet>
        <title>Equity Research & Financial Modelling Course | Valuevade</title>
        <meta name="description" content="AI-personalised equity research & financial modelling course for Indian students. 239 hands-on sessions, NISM Series XV prep, certificate, ₹4999 lifetime." />
        <link rel="canonical" href="https://valuevade.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://valuevade.com/" />
        <meta property="og:title" content="Equity Research & Financial Modelling Course | Valuevade" />
        <meta property="og:description" content="AI-personalised equity research and financial modelling course for Indian finance students. 239 hands-on sessions on real Indian companies. ₹4999 lifetime." />
        <meta property="og:image" content="https://valuevade.com/valuevade-logo.png" />
        <meta property="og:site_name" content="Valuevade" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Equity Research & Financial Modelling Course | Valuevade" />
        <meta name="twitter:description" content="AI-personalised equity research and financial modelling course for Indian finance students. 239 hands-on sessions on real Indian companies. ₹4999 lifetime." />
        <meta name="twitter:image" content="https://valuevade.com/valuevade-logo.png" />
        <script type="application/ld+json">{JSON.stringify(homeOrgJsonLd)}</script>
      </Helmet>
      <ScrollProgressBar />
      <LandingNav theme={landingTheme} toggleTheme={toggleLandingTheme} />

      <main className="relative z-10">
        <ImmersiveHero theme={landingTheme} />
        <CourseStats />
        <PracticeStudio />
        <SocialProofStrip />
        <OutcomeSection />
        <LearningJourney />
        <AIEdgeSection />
        <LandingPeople />
        <PricingSection />
        <ComparisonSection />
        <FaqAccordion />
        <ClosingSection />
      </main>

      <Footer />
      {hasPassedHero && <FaqChatbot />}

      {showMobileBar && hasPassedHero && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden mobile-sticky-bar"
          data-testid="mobile-sticky-bar"
        >
          <div className="bg-[var(--bg-primary)]/95 backdrop-blur-xl border-t border-[var(--lv-ink)] px-4 py-3 flex items-center justify-between">
            <p className="text-[var(--color-text-muted)] text-sm lv-mono flex-1" style={{ fontSize: 12 }}>
              ₹4999 lifetime · Free first session
            </p>
            <Link
              to="/signup"
              className="lv-cta flex items-center gap-1.5"
              style={{ padding: '9px 14px', fontSize: 13 }}
              data-testid="mobile-bar-cta"
            >
              Start free <ArrowRight size={14} />
            </Link>
            <button
              onClick={() => setShowMobileBar(false)}
              className="ml-2 text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
              data-testid="mobile-bar-dismiss"
              aria-label="Dismiss signup bar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
