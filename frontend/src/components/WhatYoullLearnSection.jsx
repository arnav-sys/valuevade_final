import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/**
 * Curriculum snapshot — sits between the feature grid and the comparison
 * table. Introduced by Prompt-2 of the Aug-2026 SEO/GEO rebuild.
 */
export default function WhatYoullLearnSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  return (
    <section
      id="curriculum-snapshot"
      className="relative py-20 lg:py-28 bg-[var(--bg-primary)]"
      data-testid="whatll-learn-section"
    >
      <div ref={sectionRef} className="max-w-4xl mx-auto px-6">
        <div className="text-center">
          <p className={`section-label ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            THE CURRICULUM
          </p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text)] leading-tight max-w-3xl mx-auto ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.08s' }}
            data-testid="whatll-learn-heading"
          >
            What you&apos;ll learn — from zero to analyst
          </h2>
          <p
            className={`mt-6 text-base lg:text-lg text-[var(--color-text-muted)] font-bricolage leading-relaxed max-w-3xl mx-auto ${
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
              className="inline-flex items-center gap-2 text-sm font-semibold font-bricolage text-[var(--color-primary)] hover:text-[var(--color-accent-purple)] transition-colors"
              data-testid="whatll-learn-cta"
            >
              <BookOpen size={16} />
              See the full equity research and financial modelling curriculum
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
