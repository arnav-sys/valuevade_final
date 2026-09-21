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
  const fade = isVisible ? 'animate-fade-up visible' : 'animate-fade-up';

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
    <section id="faculty" className="relative py-24 lg:py-28" data-testid="faculty-section">
      <div ref={ref} className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-end mb-14 lg:mb-20 pb-8" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="lg:col-span-7">
            <p className={`lv-chapter mb-5 ${fade}`}>YOUR INSTRUCTORS</p>
            <h2
              className={`text-4xl sm:text-5xl lg:text-[64px] text-[var(--color-text)] ${fade}`}
              style={{ animationDelay: '0.1s', lineHeight: 1.0 }}
            >
              Learn from people who&rsquo;ve <span className="lv-italic">done the job.</span>
            </h2>
          </div>
          <p className={`lg:col-span-5 text-[15px] leading-relaxed max-w-md lg:justify-self-end ${fade}`} style={{ color: 'var(--color-text-muted)', animationDelay: '0.15s' }}>
            Not full-time content creators. Practitioners who build models, run coverage and hire analysts.
          </p>
        </div>

        <div
          className={
            faculty.length === 1
              ? 'grid grid-cols-1 max-w-sm mx-auto'
              : faculty.length === 2
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-14 max-w-3xl mx-auto justify-center'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-14'
          }
        >
          {faculty.map((f, i) => (
            <article
              key={f.id}
              className={`${fade} ${faculty.length >= 3 && i % 3 === 1 ? 'lg:mt-14' : ''}`}
              style={{ animationDelay: `${0.15 + i * 0.08}s` }}
              data-testid={`faculty-card-${i}`}
            >
              <div className="lv-portrait mx-auto sm:mx-0 mr-3">
                {f.photo_url
                  ? <img src={f.photo_url} alt={f.name} />
                  : <span className="lv-serif" style={{ fontSize: 'clamp(64px, 7vw, 96px)', color: 'var(--color-text-faint)', lineHeight: 1 }}>{initials(f.name)}</span>}
              </div>
              <div className="mt-8 flex items-baseline gap-4">
                <span className="lv-folio" style={{ color: 'var(--color-primary)' }}>{String(i + 1).padStart(2, '0')}</span>
                <div className="lv-rule flex-1" />
              </div>
              <h3 className="mt-4 text-[26px] text-[var(--color-text)]">{f.name}</h3>
              <p className="lv-folio mt-2" style={{ color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'none', fontSize: 12 }}>{f.title}</p>
              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{f.bio}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
