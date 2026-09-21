import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/**
 * Final CTA, editorial finance treatment (Feb 2026).
 * Copy verbatim. Retired the pink/violet gradient CTA and the
 * three.js convergence bg; replaced with lv-panel + lv-cta + terminal grid.
 */
export default function FinalCTASection() {
  const [sectionRef, isVisible] = useScrollAnimation();

  return (
    <section
      id="waitlist"
      className="relative py-24 lg:py-28 overflow-hidden bg-[var(--bg-primary)]"
      data-testid="final-cta-section"
    >
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-40" aria-hidden="true" />

      {/* Faint editorial chart line as backdrop */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        style={{ opacity: 0.18 }}
      >
        <defs>
          <linearGradient id="cta-chart-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="var(--color-primary)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--color-primary)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--color-accent-pink)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,320 L120,300 L240,240 L360,260 L480,180 L600,200 L720,120 L840,140 L960,90 L1080,120 L1200,60 L1320,80 L1440,40"
          fill="none"
          stroke="url(#cta-chart-grad)"
          strokeWidth="1.5"
        />
      </svg>

      <div ref={sectionRef} className="relative z-10 max-w-4xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-10 lg:mb-12">
          <span className="lv-chapter">§11 // ENROL</span>
          <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
          <span className="lv-chapter">₹4999 · LIFETIME · NO CARD REQUIRED</span>
        </div>

        <div
          className={`lv-panel px-6 py-10 lg:px-10 lg:py-14 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
          style={{ animationDelay: '0.08s' }}
        >
          <div className="flex items-center gap-2 mb-6">
            <span className="lv-live-dot" aria-hidden="true" />
            <span className="font-jetbrains text-[10.5px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              ENROL · OPEN NOW
            </span>
          </div>

          <h2
            className={`font-clash text-4xl sm:text-5xl lg:text-[60px] text-[var(--color-text)] mb-6 ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.12s', lineHeight: 1.06, letterSpacing: '-0.02em' }}
            data-testid="final-cta-heading"
          >
            Your finance career doesn&apos;t start at placement season.
            <br className="hidden sm:block" />
            It starts{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-primary)' }}>
              today
            </span>
            .
          </h2>

          <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />

          <div
            className={`flex flex-col sm:flex-row items-start sm:items-center gap-6 mt-10 ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.18s' }}
          >
            <Link
              to="/signup"
              className="lv-cta"
              data-testid="final-cta-button"
            >
              Start The Program · ₹4999 Lifetime
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
            <p className="font-jetbrains text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]" data-testid="final-cta-trust">
              TRY FIRST SESSION FREE · NO CARD REQUIRED
            </p>
          </div>

          {/* Data-bar footer */}
          <div className="mt-10 pt-6 border-t border-[var(--color-border)] grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ["PRICE", "₹4999"],
              ['ACCESS', 'LIFETIME'],
              ['MODULES', '21'],
              ['SESSIONS', '239'],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="font-jetbrains text-[9.5px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">{k}</div>
                <div className="font-jetbrains text-lg text-[var(--color-text)] mt-1" style={{ letterSpacing: '-0.01em' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
