import { useEffect, useState } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* Testimonial Wall — a scrollable proof wall of student reviews, pulled from
 * /api/testimonials (admin-managed). Falls back to a static set when the
 * Supabase table isn't provisioned yet. Placed near pricing to lift conversion. */

const API = process.env.REACT_APP_BACKEND_URL;

const FALLBACK = [
  { id: 't1', name: 'Priya S.', role: 'CFA L1 Candidate, Delhi', quote: "Finally a platform that doesn't just dump content at me. The roadmap showed me exactly what I was missing for my AM interviews." },
  { id: 't2', name: 'Arjun M.', role: 'MBA Finance, Mumbai', quote: "The job simulation for equity research was the closest thing to actual work I'd done before my internship. My interviewer was genuinely impressed." },
  { id: 't3', name: 'Tanvi R.', role: 'B.Com Final Year, Pune', quote: 'I wasted 6 months on random YouTube courses. Valuevade gave me a clear path in 10 minutes.' },
  { id: 't4', name: 'Karthik V.', role: 'Aspiring Risk Analyst, Bengaluru', quote: 'The AI mock interview grilled me harder than my real interview did. By the time I sat in the actual room, nothing surprised me.' },
  { id: 't5', name: 'Ananya D.', role: 'Non-finance grad, Hyderabad', quote: 'I came from a non-finance background and still built a full DCF on Reliance. The capstone is now the best thing on my resume.' },
  { id: 't6', name: 'Rahul B.', role: 'CA Inter, Jaipur', quote: 'Practising on Ind AS statements and SEBI filings made the difference — my modelling finally looked like real deal work.' },
];

const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function Card({ t }) {
  return (
    <figure
      className="lv-panel p-6 mb-5 break-inside-avoid"
      data-testid={`testimonial-card-${t.id}`}
    >
      <svg width="26" height="20" viewBox="0 0 26 20" className="mb-4" aria-hidden="true" style={{ color: 'var(--color-primary)', opacity: 0.5 }}>
        <path fill="currentColor" d="M0 20V11.2C0 5 3.6 1 10 0l1.2 3.4C7.6 4.3 6 6 5.8 8.6H10V20H0Zm15 0v-8.8C15 5 18.6 1 25 0l1 3.4C22.4 4.3 20.8 6 20.6 8.6H25V20H15Z" />
      </svg>
      <blockquote className="text-[14.5px] text-[var(--color-text-secondary)] font-bricolage leading-relaxed mb-5">
        {t.quote}
      </blockquote>
      <figcaption className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--color-primary) 16%, transparent)', border: '1px solid color-mix(in oklab, var(--color-primary) 30%, transparent)' }}>
          <span className="text-[12px] font-bold text-[var(--color-primary)]" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>{initials(t.name)}</span>
        </div>
        <div className="min-w-0">
          <div className="text-[var(--color-text)] text-sm font-semibold">{t.name}</div>
          <div className="text-[var(--color-text-muted)] text-[12px]">{t.role}</div>
        </div>
      </figcaption>
    </figure>
  );
}

export default function TestimonialsSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  const [items, setItems] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/testimonials`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const rows = Array.isArray(d.testimonials) ? d.testimonials : [];
        if (rows.length) setItems(rows);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <section
      id="testimonials"
      className="relative py-24 lg:py-28 bg-[var(--bg-secondary)]"
      data-testid="testimonials-section"
    >
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-25" aria-hidden="true" />

      <div ref={sectionRef} className="relative max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-12 lg:mb-14">
          <p className={`lv-chapter mb-5 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>THE PROOF WALL</p>
          <h2
            className={`text-4xl sm:text-5xl lg:text-[56px] text-[var(--color-text)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.03em' }}
          >
            Real students.{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 500, color: 'var(--color-primary)' }}>
              Real wins.
            </span>
          </h2>
          <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />
        </div>

        {/* Masonry proof wall */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5" data-testid="testimonial-wall">
          {items.map((t) => <Card key={t.id} t={t} />)}
        </div>
      </div>
    </section>
  );
}
