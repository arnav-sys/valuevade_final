import { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

// Lazy three.js convergence — only loads when the section approaches view.
const FinalCTAConvergence = lazy(() => import('@/components/landing/FinalCTAConvergence'));

/**
 * Final CTA — rebuilt by Prompt-2 of the Aug-2026 SEO/GEO overhaul.
 * The old waitlist form is gone; the primary CTA now links straight into
 * signup, and the pricing promise "₹1,500 lifetime · no card required" is
 * front-and-centre.
 */
export default function FinalCTASection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <section
      id="waitlist"
      className="relative py-24 lg:py-32 overflow-hidden light-rays bg-[var(--bg-primary)]"
      data-testid="final-cta-section"
    >
      {/* Particle convergence behind the CTA — gravity-well feel */}
      <Suspense fallback={null}>
        <FinalCTAConvergence mobile={mobile} />
      </Suspense>
      <div ref={sectionRef} className="max-w-3xl mx-auto px-6 relative z-10 text-center">
        <h2
          className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text)] leading-tight mb-6 ${
            isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
          }`}
          data-testid="final-cta-heading"
        >
          Your finance career doesn&apos;t start at placement season.
          <br className="hidden sm:block" />
          It starts today.
        </h2>

        <div
          className={`flex flex-col items-center gap-4 mt-10 ${
            isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
          }`}
          style={{ animationDelay: '0.15s' }}
        >
          {/* Breathing halo behind the button — replaces the old form-anchored one */}
          <div className="relative">
            <div
              aria-hidden="true"
              data-testid="final-cta-breathing-halo"
              className="pointer-events-none absolute left-1/2 top-1/2 w-[420px] h-[220px] -z-10"
              style={{
                background: 'radial-gradient(closest-side, rgba(139,92,246,0.45), transparent 70%)',
                filter: 'blur(36px)',
                animation: 'cta-breathe 4.5s ease-in-out infinite',
                transform: 'translate(-50%, -50%)',
              }}
            />
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full font-semibold text-white text-sm sm:text-base transition-all hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #FF6AC1, #6A5CFF)',
                boxShadow: '0 0 24px rgba(255, 106, 193, 0.35)',
              }}
              data-testid="final-cta-button"
            >
              Start the Equity Research Analyst Program — ₹1,500 lifetime
              <ArrowRight size={16} />
            </Link>
          </div>

          <p className="text-[var(--color-text-muted)] font-bricolage text-sm" data-testid="final-cta-trust">
            Try your first session free. No card required.
          </p>
        </div>
      </div>
      <style>{`
        @keyframes cta-breathe {
          0%,100% { opacity: 0.45; transform: translate(-50%, -50%) scale(0.94); }
          50%     { opacity: 0.85; transform: translate(-50%, -50%) scale(1.06); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="final-cta-breathing-halo"] { animation: none !important; opacity: 0.55; }
        }
      `}</style>
    </section>
  );
}
