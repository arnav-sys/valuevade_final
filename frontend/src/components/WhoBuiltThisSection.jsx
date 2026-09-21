import { GraduationCap, ShieldCheck } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/**
 * Who built this, editorial terminal treatment (Feb 2026).
 * Copy verbatim.
 */
export default function WhoBuiltThisSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  return (
    <section
      id="who-built-this"
      className="relative py-20 lg:py-24 bg-[var(--bg-primary)]"
      data-testid="who-built-this-section"
    >
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-30" aria-hidden="true" />

      <div ref={sectionRef} className="relative max-w-4xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-10 lg:mb-12">
          <span className="lv-chapter">§07 // TRUST</span>
          <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
          <span className="lv-chapter">TRANSPARENCY · INSTRUCTOR · STANDARDS</span>
        </div>

        <div className="mb-10 lg:mb-12">
          <p className={`lv-chapter mb-4 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            TRANSPARENCY
          </p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-[52px] text-[var(--color-text)] ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.08s', lineHeight: 1.06, letterSpacing: '-0.02em' }}
            data-testid="who-built-this-heading"
          >
            Who built this, and{' '}
            <span style={{ fontFamily: '"Newsreader", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-primary)' }}>
              why
            </span>{' '}
            you can trust it
          </h2>
          <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />
        </div>

        <div className="space-y-4">
          <article
            className={`lv-panel p-6 lg:p-7 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.14s' }}
            data-testid="who-instructor-card"
          >
            <div className="flex items-center justify-between mb-5">
              <span className="font-jetbrains text-[10.5px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
                01 · INSTRUCTOR
              </span>
              <span
                className="inline-flex items-center justify-center w-9 h-9 border border-[var(--color-border)]"
                style={{ borderRadius: 2 }}
              >
                <GraduationCap size={16} className="text-[var(--color-primary)]" />
              </span>
            </div>
            <p className="text-[13.5px] lg:text-[14.5px] text-[var(--color-text-muted)] font-bricolage leading-relaxed">
              The program&apos;s 42 hours of video lectures are designed and taught by Saarthak Bhatia,
              who built the full course content end-to-end. Every module is scripted and recorded
              before release. Saarthak is a qualified Chartered Accountant (CA), US Certified
              Management Accountant (CMA US) and ACCA (UK), a triple-credential accounting and
              finance stack, with close to five years of teaching experience across Grant Thornton
              Bharat (Learning GT), FinTram Global, Zell Education and QuintEdge, and earlier at The
              Narayana Group and Byju&apos;s Learning App.
            </p>
            <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
              <span className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
                CA · CMA US · ACCA (UK)
              </span>
              <span className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-primary)]">
                ~5 YRS · TEACHING
              </span>
            </div>
          </article>

          <article
            className={`lv-panel p-6 lg:p-7 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.2s' }}
            data-testid="who-standards-card"
          >
            <div className="flex items-center justify-between mb-5">
              <span className="font-jetbrains text-[10.5px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
                02 · STANDARDS
              </span>
              <span
                className="inline-flex items-center justify-center w-9 h-9 border border-[var(--color-border)]"
                style={{ borderRadius: 2 }}
              >
                <ShieldCheck size={16} className="text-[var(--color-accent-pink)]" />
              </span>
            </div>
            <p className="text-[13.5px] lg:text-[14.5px] text-[var(--color-text-muted)] font-bricolage leading-relaxed">
              The curriculum maps to the NISM Series XV (Research Analyst) exam syllabus, so
              what you learn is checked against external standards, not just our own.
            </p>
            <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
              <span className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
                NISM SERIES XV
              </span>
              <span className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent-pink)]">
                EXTERNALLY ANCHORED
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
