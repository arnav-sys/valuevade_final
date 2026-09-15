import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Compass, Layers, Cpu } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* Editorial-finance ProblemSection (Feb 2026 redesign).
 * - Mono chapter + section labels aligned with hero.
 * - 3-column editorial grid, sharp 1px cards, numeric "01/02/03" prefixes.
 * - Icons framed in bordered squares (no gradient wash).
 * - Three.js assembly scene retained but dialed back with a stronger fade.
 * Content copy verbatim from previous version. */

const ProblemAssemblyScene = lazy(() => import('@/components/landing/ProblemAssemblyScene'));

const problems = [
  {
    idx: '01',
    tag: 'ROADMAP',
    icon: Compass,
    title: 'No clear roadmap',
    body: "You know you want equity research, investment banking or asset management — but nobody shows you the exact skills, projects and credentials that get you there. B.Com and BBA syllabi test theory; analyst interviews test whether you can build a model, defend a valuation and write a coverage note.",
    color: 'var(--color-primary)',
  },
  {
    idx: '02',
    tag: 'MARKET',
    icon: Layers,
    title: 'Courses built for the wrong market',
    body: "Most online finance courses teach US GAAP, 10-Ks and S&P 500 case studies. Indian analysts work with Ind AS, SEBI filings and NSE/BSE data — and Indian interviews test exactly that.",
    color: 'var(--color-accent-purple)',
  },
  {
    idx: '03',
    tag: 'AI',
    icon: Cpu,
    title: 'AI is changing entry-level finance',
    body: "Screening, data pulls and first-draft models are being automated. The junior analysts still getting hired are the ones who can direct AI tools — not the ones competing with them.",
    color: 'var(--color-accent-pink)',
  },
];

export default function ProblemSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  const lockRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [mountScene, setMountScene] = useState(false);

  useEffect(() => {
    const node = lockRef.current;
    if (!node) return undefined;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setProgress(1);
      setMountScene(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setMountScene(true); },
      { rootMargin: '120% 0px 120% 0px' }
    );
    io.observe(node);
    const onScroll = () => {
      const rect = node.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) { setProgress(1); return; }
      const scrolled = -rect.top;
      const p = Math.max(0, Math.min(1, scrolled / total));
      setProgress(p);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <section
      ref={lockRef}
      className="relative bg-[var(--bg-primary)] lg:min-h-[170vh]"
      data-testid="problem-section"
    >
      <div className="relative lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden flex items-center py-16 lg:py-0">
        {/* Terminal grid + faint 3D scene — dialled back */}
        <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-40" aria-hidden="true" />
        <div className="absolute inset-0 z-0 pointer-events-none hidden lg:block" data-testid="problem-bg-wrap" style={{ opacity: 0.5 }}>
          {mountScene && (
            <Suspense fallback={null}>
              <ProblemAssemblyScene progress={progress} />
            </Suspense>
          )}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              background:
                'linear-gradient(180deg, rgba(8,8,15,0.75) 0%, transparent 22%, transparent 78%, rgba(8,8,15,0.9) 100%)',
            }}
          />
        </div>

        <div ref={sectionRef} className="relative z-10 max-w-7xl mx-auto px-6 py-16 lg:py-20 w-full">
          {/* Chapter rail — matches hero */}
          <div className="flex items-center gap-3 mb-10 lg:mb-12">
            <span className="lv-chapter">§02 // WHY VALUEVADE</span>
            <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
            <span className="lv-chapter">PROBLEM · MARKET GAP</span>
          </div>

          <div className="mb-12 lg:mb-14 max-w-3xl">
            <p className={`lv-chapter mb-4 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
              THE GAP NO ONE TALKS ABOUT
            </p>
            <h2
              className={`font-clash text-4xl sm:text-5xl lg:text-[60px] text-[var(--color-text)] ${
                isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
              }`}
              style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.02em' }}
            >
              Your college prepared you for exams.
              <br />
              <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-primary)' }}>
                Not
              </span>{' '}
              for a finance career.
            </h2>
            <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
            {problems.map((problem, i) => {
              const Icon = problem.icon;
              return (
                <article
                  key={problem.title}
                  className={`lv-panel p-6 lg:p-7 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
                  style={{ animationDelay: `${0.2 + i * 0.1}s` }}
                  data-testid={`problem-card-${i}`}
                >
                  {/* Numeric prefix rail */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-jetbrains text-[10.5px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
                      {problem.idx} · {problem.tag}
                    </span>
                    <span
                      className="inline-flex items-center justify-center w-9 h-9 border border-[var(--color-border)]"
                      style={{ borderRadius: 2 }}
                    >
                      <Icon size={16} style={{ color: problem.color }} />
                    </span>
                  </div>

                  <h3 className="font-clash text-xl lg:text-[22px] text-[var(--color-text)] mb-3" style={{ lineHeight: 1.15 }}>
                    {problem.title}
                  </h3>
                  <p className="text-[var(--color-text-muted)] font-bricolage leading-relaxed text-[13.5px]">
                    {problem.body}
                  </p>

                  {/* Bottom hairline data footer */}
                  <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                    <span className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
                      GAP · {problem.idx}
                    </span>
                    <span
                      className="font-jetbrains text-[10px] uppercase tracking-[0.2em]"
                      style={{ color: problem.color }}
                    >
                      CLOSED BY VALUEVADE
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          <p
            className={`mt-10 text-[var(--color-accent-pink)] font-bricolage text-base lg:text-lg ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.5s', fontStyle: 'italic' }}
            data-testid="problem-transition-line"
          >
            Valuevade was built to close all three gaps at once.
          </p>
        </div>
      </div>
    </section>
  );
}
