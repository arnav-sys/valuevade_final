import { useScrollAnimation, useCountUp } from '@/hooks/useScrollAnimation';
import { TestimonialsCarousel3D } from '@/components/landing/CinematicSections';

/* Editorial finance TestimonialsSection (Feb 2026).
 * Stats now honest: "21 modules", "239 sessions", "42 hours video",
 * "100% personalised" — replaces the stale "500+ on Waitlist" figure
 * since the waitlist mechanism is retired. */

const testimonials = [
  { quote: "Finally a platform that doesn't just dump content at me. The roadmap showed me exactly what I was missing for my AM interviews.", name: 'Priya S.', role: 'CFA L1 Candidate, Delhi' },
  { quote: "The job simulation for equity research was the closest thing to actual work I'd done before my internship. My interviewer was genuinely impressed.", name: 'Arjun M.', role: 'MBA Finance, Mumbai' },
  { quote: 'I wasted 6 months on random YouTube courses. Valuevade gave me a clear path in 10 minutes.', name: 'Tanvi R.', role: 'B.Com Final Year, Pune' },
];

const stats = [
  { value: 21,  suffix: '',  label: 'Modules',            code: 'MOD' },
  { value: 239, suffix: '',  label: 'Hands-on Sessions',  code: 'SIM' },
  { value: 42,  suffix: 'h', label: 'Video Lectures',     code: 'VID' },
  { value: 100, suffix: '%', label: 'Personalised',       code: 'PRS' },
];

function StatItem({ value, suffix, label, code, isLast }) {
  const [count, ref] = useCountUp(value);
  return (
    <div
      ref={ref}
      className={`px-5 lg:px-6 py-5 ${isLast ? '' : 'border-r border-[var(--color-border)]'}`}
      data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-jetbrains text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-faint)]">{code}</span>
        <span className="font-jetbrains text-[9.5px] uppercase tracking-[0.18em] text-[var(--color-primary)]">LIVE</span>
      </div>
      <p className="font-clash text-3xl lg:text-4xl text-[var(--color-text)]" style={{ letterSpacing: '-0.02em' }}>
        {count}{suffix}
      </p>
      <p className="text-[var(--color-text-muted)] text-[11.5px] font-jetbrains uppercase tracking-[0.14em] mt-1">
        {label}
      </p>
    </div>
  );
}

export default function TestimonialsSection() {
  const [sectionRef, isVisible] = useScrollAnimation();

  return (
    <section
      className="relative py-24 lg:py-28 bg-[var(--bg-secondary)]"
      data-testid="testimonials-section"
    >
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-30" aria-hidden="true" />

      <div ref={sectionRef} className="relative max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-10 lg:mb-12">
          <span className="lv-chapter">§09 // PROOF</span>
          <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
          <span className="lv-chapter">FROM STUDENTS IN THE GRIND</span>
        </div>

        <div className="max-w-3xl mb-12 lg:mb-14">
          <p className={`lv-chapter mb-4 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            FROM STUDENTS IN THE GRIND
          </p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-[52px] text-[var(--color-text)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.02em' }}
          >
            Built by a finance student.{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-primary)' }}>
              For
            </span>{' '}
            finance students.
          </h2>
          <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />
        </div>

        <div className="mb-12" data-testid="testimonials-carousel-wrap">
          <TestimonialsCarousel3D items={testimonials} />
        </div>

        <div
          className={`lv-panel grid grid-cols-2 lg:grid-cols-4 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
          style={{ animationDelay: '0.5s' }}
          data-testid="stats-bar"
        >
          {stats.map((stat, i) => (
            <StatItem
              key={stat.label}
              {...stat}
              isLast={i === stats.length - 1 || (i === 1 && typeof window !== 'undefined' && window.innerWidth < 1024)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
