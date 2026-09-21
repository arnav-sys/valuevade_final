import { useEffect, useState, useCallback } from 'react';
import { Compass, Layers, Cpu, Award, Mic, Wrench, FileText, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* Gaps section, fanned card carousel (Jun 2026). The active gap sits sharp in
 * the centre; neighbouring cards fan out behind it, rotated, scaled-down and
 * blurred. Auto-advances; pauses on hover; side cards + arrows are clickable. */

const problems = [
  { idx: '01', tag: 'ROADMAP', icon: Compass, title: 'No clear roadmap',
    points: ['Theory over skills', 'No target-role path', 'Interviews test doing'],
    body: "B.Com and BBA syllabi test theory; analyst interviews test whether you can build a model, defend a valuation and write a coverage note, and nobody maps that path for you." },
  { idx: '02', tag: 'MARKET', icon: Layers, title: 'Built for the wrong market',
    points: ['US GAAP & 10-Ks', 'S&P 500 case studies', 'Not Ind AS / SEBI'],
    body: "Most courses teach US GAAP and S&P 500 case studies. Indian analysts work with Ind AS, SEBI filings and NSE/BSE data, and Indian interviews test exactly that." },
  { idx: '03', tag: 'AI', icon: Cpu, title: 'AI is reshaping entry roles',
    points: ['Screening automated', 'First-draft models automated', 'Direct AI, or compete'],
    body: "Screening, data pulls and first-draft models are being automated. The juniors still getting hired direct AI tools, they don't compete with them." },
  { idx: '04', tag: 'PROOF', icon: Award, title: 'No certs or real projects',
    points: ['Video library only', 'Certificate nobody checks', 'Nothing to show'],
    body: "Most courses hand you a video library and a certificate nobody verifies, but no graded, portfolio-grade projects a recruiter can actually open and judge." },
  { idx: '05', tag: 'INTERVIEW', icon: Mic, title: 'No mock-interview practice',
    points: ['Revise, never rehearse', 'No live grilling', 'No real feedback'],
    body: "You revise theory endlessly but never rehearse the real thing, a live analyst grilling you on your DCF, your assumptions and your thesis under pressure." },
  { idx: '06', tag: 'PRACTICE', icon: Wrench, title: 'No hands-on learning',
    points: ['Passive lectures', "Doesn't stick", 'No real building'],
    body: "Passive lectures don't build skill. Without building models, analysing real filings and defending your own numbers, none of it survives a real interview." },
  { idx: '07', tag: 'CAREER', icon: FileText, title: 'No resume / LinkedIn prep',
    points: ['No ATS resume', 'No outreach playbook', 'No soft-skill coaching'],
    body: "Even skilled students get filtered out, no ATS-ready resume, no LinkedIn outreach playbook, and no coaching on how to communicate like an analyst." },
  { idx: '08', tag: 'PERSONAL', icon: Sparkles, title: 'Generic, one-size-fits-all',
    points: ['Same syllabus for all', 'Ignores your level', 'Wastes your weeks'],
    body: "Everyone gets the same syllabus regardless of target role or current level, so you waste weeks on things you know and skip the gaps that get you hired." },
];

const N = problems.length;

export default function ProblemSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((dir) => setActive((a) => ((a + dir) % N + N) % N), []);

  useEffect(() => {
    if (paused) return undefined;
    const t = setInterval(() => setActive((a) => (a + 1) % N), 3200);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <section className="relative bg-[var(--bg-primary)] py-24 lg:py-28 overflow-hidden" data-testid="problem-section">
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-30" aria-hidden="true" />

      <div ref={sectionRef} className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-14 lg:mb-16">
          <p className={`lv-chapter justify-center mb-5 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            THE GAP NO ONE TALKS ABOUT
          </p>
          <h2
            className={`text-4xl sm:text-5xl lg:text-[56px] text-[var(--color-text)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.03em' }}
          >
            Your college prepared you for exams.{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 500, color: 'var(--color-primary)' }}>Not</span>{' '}
            for a finance career.
          </h2>
        </div>

        {/* Fanned card stage */}
        <div
          className="relative mx-auto"
          style={{ height: 440, maxWidth: 1000 }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          data-testid="gaps-carousel"
        >
          {problems.map((p, i) => {
            let pos = i - active;
            if (pos > N / 2) pos -= N;
            if (pos < -N / 2) pos += N;
            const abs = Math.abs(pos);
            const hidden = abs > 2;
            const isCenter = pos === 0;
            const Icon = p.icon;
            return (
              <button
                key={p.title}
                onClick={() => setActive(i)}
                aria-label={p.title}
                tabIndex={isCenter ? 0 : -1}
                className="absolute top-0 left-1/2 rounded-3xl text-left focus:outline-none"
                data-testid={`problem-card-${i}`}
                style={{
                  width: 300,
                  height: 420,
                  marginLeft: -150,
                  transform: `translateX(${pos * 210}px) scale(${1 - abs * 0.1}) rotate(${pos * 5}deg)`,
                  filter: `blur(${abs * 2.2}px)`,
                  opacity: hidden ? 0 : 1 - abs * 0.34,
                  zIndex: 50 - abs,
                  pointerEvents: hidden ? 'none' : 'auto',
                  cursor: isCenter ? 'default' : 'pointer',
                  transition: 'transform 600ms cubic-bezier(0.22,1,0.36,1), opacity 600ms ease, filter 600ms ease',
                  background: 'var(--color-bg-card)',
                  border: isCenter
                    ? '2px solid var(--color-primary)'
                    : '1px solid var(--color-border)',
                  boxShadow: isCenter ? '0 30px 80px -30px rgba(36,107,253,0.45)' : 'none',
                  padding: '32px 26px',
                }}
              >
                <span
                  className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6"
                  style={{ background: 'color-mix(in oklab, var(--color-primary) 16%, transparent)', border: '1px solid color-mix(in oklab, var(--color-primary) 32%, transparent)' }}
                >
                  <Icon size={26} style={{ color: 'var(--color-primary)' }} />
                </span>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-faint)] font-semibold mb-1" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
                  {p.idx} · {p.tag}
                </div>
                <h3 className="text-[22px] text-[var(--color-text)] mb-3" style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}>{p.title}</h3>
                <div className="h-px w-10 bg-[var(--color-primary)] mb-4" aria-hidden="true" />
                <ul className="space-y-2 mb-4">
                  {p.points.map((pt) => (
                    <li key={pt} className="text-[13.5px] text-[var(--color-text-secondary)] font-bricolage flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <p className="text-[12.5px] text-[var(--color-text-muted)] font-bricolage leading-relaxed">{p.body}</p>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-10">
          <button onClick={() => go(-1)} className="w-10 h-10 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors" data-testid="gaps-prev" aria-label="Previous gap">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2" data-testid="gaps-dots">
            {problems.map((p, i) => (
              <button
                key={p.title}
                onClick={() => setActive(i)}
                aria-label={`Go to ${p.title}`}
                className="rounded-full transition-all"
                style={{
                  width: i === active ? 22 : 8, height: 8,
                  background: i === active ? 'var(--color-primary)' : 'var(--color-border)',
                }}
              />
            ))}
          </div>
          <button onClick={() => go(1)} className="w-10 h-10 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors" data-testid="gaps-next" aria-label="Next gap">
            <ChevronRight size={18} />
          </button>
        </div>

        <p className="mt-10 text-center text-[var(--color-primary)] font-bricolage text-base lg:text-lg" style={{ fontStyle: 'italic' }} data-testid="problem-transition-line">
          Valuevade was built to close every one of these gaps at once.
        </p>
      </div>
    </section>
  );
}
