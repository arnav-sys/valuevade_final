import { GraduationCap, Users, ShieldCheck } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/**
 * "Who built this — and why you can trust it" — a founder + instructor
 * transparency block introduced by Prompt-2 of the Aug-2026 SEO/GEO rebuild.
 *
 * IMPORTANT (from Prompt 2): the instructor credential clause is intentionally
 * omitted here — an HTML comment marks the exact spot to paste it once the
 * founder verifies Saarthak's credentials. Do not invent one.
 */
export default function WhoBuiltThisSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  return (
    <section
      id="who-built-this"
      className="relative py-20 lg:py-28 bg-[var(--bg-primary)]"
      data-testid="who-built-this-section"
    >
      <div ref={sectionRef} className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className={`section-label ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            TRANSPARENCY
          </p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text)] leading-tight ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.08s' }}
            data-testid="who-built-this-heading"
          >
            Who built this — and why you can trust it
          </h2>
        </div>

        <div className="space-y-6">
          <div
            className={`glass-card rounded-2xl p-6 lg:p-8 flex gap-4 ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.14s', borderColor: 'rgba(36, 107, 253, 0.18)' }}
            data-testid="who-instructor-card"
          >
            <div className="shrink-0 w-11 h-11 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 flex items-center justify-center">
              <GraduationCap size={20} className="text-[var(--color-primary)]" />
            </div>
            <p className="text-sm lg:text-base text-[var(--color-text-muted)] font-bricolage leading-relaxed">
              The program&apos;s 42 hours of video lectures are designed and taught by Saarthak Bhatia,
              who built the full course content end-to-end. Every module is scripted and recorded
              before release.
              {/* TODO: add instructor credential clause */}
            </p>
          </div>

          <div
            className={`glass-card rounded-2xl p-6 lg:p-8 flex gap-4 ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.20s', borderColor: 'rgba(106, 92, 255, 0.18)' }}
            data-testid="who-founder-card"
          >
            <div className="shrink-0 w-11 h-11 rounded-xl bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 flex items-center justify-center">
              <Users size={20} className="text-[var(--color-accent-purple)]" />
            </div>
            <p className="text-sm lg:text-base text-[var(--color-text-muted)] font-bricolage leading-relaxed">
              Valuevade itself was built end-to-end by Arnav Aggarwal, a B.Com (Hons) student at Delhi
              University — the curriculum architecture, the AI tutor and the platform. Before
              Valuevade, he built a 30-page financial modelling and valuation study on TCS
              (three-statement model, DCF, comparable companies, DuPont and Altman Z-score analysis)
              and a full equity research report on Infosys. He built Valuevade to close the exact gap
              he faced: no affordable, India-specific path from a B.Com classroom to analyst-grade
              skills.
            </p>
          </div>

          <div
            className={`glass-card rounded-2xl p-6 lg:p-8 flex gap-4 ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.26s', borderColor: 'rgba(255, 106, 193, 0.18)' }}
            data-testid="who-standards-card"
          >
            <div className="shrink-0 w-11 h-11 rounded-xl bg-[var(--color-accent-pink)]/10 border border-[var(--color-accent-pink)]/25 flex items-center justify-center">
              <ShieldCheck size={20} className="text-[var(--color-accent-pink)]" />
            </div>
            <p className="text-sm lg:text-base text-[var(--color-text-muted)] font-bricolage leading-relaxed">
              The curriculum maps to the NISM Series-VIII (Equity Research) exam syllabus and CFI
              certification content — so what you learn is checked against external standards, not
              just our own.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
