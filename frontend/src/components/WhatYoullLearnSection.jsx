import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/**
 * Curriculum snapshot — editorial terminal treatment (Feb 2026).
 * Content copy verbatim.
 */
export default function WhatYoullLearnSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  return (
    <section
      id="curriculum-snapshot"
      className="relative py-20 lg:py-24 bg-[var(--bg-primary)]"
      data-testid="whatll-learn-section"
    >
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-30" aria-hidden="true" />

      <div ref={sectionRef} className="relative max-w-4xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-10 lg:mb-12">
          <span className="lv-chapter">§06 // CURRICULUM</span>
          <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
          <span className="lv-chapter">21 MODULES · 239 SESSIONS</span>
        </div>

        <div>
          <p className={`lv-chapter mb-4 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            THE CURRICULUM
          </p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-[52px] text-[var(--color-text)] ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.08s', lineHeight: 1.06, letterSpacing: '-0.02em' }}
            data-testid="whatll-learn-heading"
          >
            What you&apos;ll learn —{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-primary)' }}>
              from zero to analyst
            </span>
          </h2>
          <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />

          <p
            className={`mt-8 text-[15px] lg:text-base text-[var(--color-text-muted)] font-bricolage leading-relaxed max-w-3xl ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.14s' }}
          >
            The Equity Research Analyst Program takes you from accounting and economics foundations
            through financial statement analysis, ratio and forensic analysis, three-statement financial
            modelling, and valuation (DCF, comparable companies, SOTP) — finishing with industry
            analysis and three capstone projects you keep as a portfolio.
          </p>

          <div
            className={`mt-8 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.22s' }}
          >
            <Link
              to="/course/5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c"
              className="inline-flex items-center gap-2 text-sm font-semibold font-bricolage text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
              data-testid="whatll-learn-cta"
            >
              <ArrowUpRight size={14} strokeWidth={2.4} />
              See the full equity research and financial modelling curriculum
              <span className="h-px w-6 bg-[var(--color-text-muted)]" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
