import { useEffect, useState } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* Faculty section, pulls from /api/faculty (admin-managed). Falls back to a
 * small static roster if the Supabase table isn't provisioned yet. */

const API = process.env.REACT_APP_BACKEND_URL;

const FALLBACK = [
  { id: 'f1', name: 'Aarav Mehta', title: 'Lead Faculty · Equity Research · Ex-Buy Side', bio: 'Former equity research analyst covering Indian financials and consumer. Builds every valuation module from real Ind AS filings, not textbook templates.', photo_url: '' },
  { id: 'f2', name: 'Sneha Iyer', title: 'Financial Modelling · CFA Charterholder', bio: 'Spent years building 3-statement and LBO models on the sell side. Leads the modelling and DCF curriculum with a first-principles approach.', photo_url: '' },
  { id: 'f3', name: 'Rohan Kulkarni', title: 'Career & Interview Prep · Ex-IB', bio: 'Ran analyst hiring at a boutique investment bank. Designs the mock-interview rounds, resume reviews and LinkedIn outreach playbooks.', photo_url: '' },
];

const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function FacultySection() {
  const [ref, isVisible] = useScrollAnimation();
  const [faculty, setFaculty] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/faculty`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const rows = Array.isArray(d.faculty) ? d.faculty : [];
        if (rows.length) setFaculty(rows);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="faculty" className="relative bg-[var(--bg-primary)] py-24 lg:py-28" data-testid="faculty-section">
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-30" aria-hidden="true" />
      <div ref={ref} className="relative max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-12 lg:mb-14">
          <p className={`lv-chapter mb-5 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>YOUR INSTRUCTORS</p>
          <h2
            className={`text-4xl sm:text-5xl lg:text-[56px] text-[var(--color-text)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.03em' }}
          >
            Learn from people who&rsquo;ve{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 500, color: 'var(--color-primary)' }}>
              done the job.
            </span>
          </h2>
          <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />
          <p className="mt-6 text-[14.5px] font-bricolage text-[var(--color-text-muted)] max-w-2xl leading-relaxed">
            Not full-time content creators &mdash; practitioners who build models, run coverage and hire analysts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {faculty.map((f, i) => (
            <article
              key={f.id}
              className={`lv-panel p-6 lg:p-7 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
              style={{ animationDelay: `${0.15 + i * 0.08}s` }}
              data-testid={`faculty-card-${i}`}
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
                  style={{ background: 'color-mix(in oklab, var(--color-primary) 16%, transparent)', border: '1px solid color-mix(in oklab, var(--color-primary) 30%, transparent)' }}>
                  {f.photo_url
                    ? <img src={f.photo_url} alt={f.name} className="w-full h-full object-cover" />
                    : <span className="text-lg font-bold text-[var(--color-primary)]" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>{initials(f.name)}</span>}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg text-[var(--color-text)]" style={{ letterSpacing: '-0.02em' }}>{f.name}</h3>
                  <p className="text-[12.5px] text-[var(--color-primary)] font-semibold mt-0.5" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>{f.title}</p>
                </div>
              </div>
              <p className="text-[13.5px] text-[var(--color-text-muted)] font-bricolage leading-relaxed">{f.bio}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
