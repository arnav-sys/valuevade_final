import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Compass, Layers, Cpu } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

// Lazy-mount the Three.js scene only when the section approaches the viewport.
const ProblemAssemblyScene = lazy(() => import('@/components/landing/ProblemAssemblyScene'));

const problems = [
  {
    icon: Compass,
    title: 'No clear roadmap',
    body: "You know you want equity research, investment banking or asset management — but nobody shows you the exact skills, projects and credentials that get you there. B.Com and BBA syllabi test theory; analyst interviews test whether you can build a model, defend a valuation and write a coverage note.",
    color: '#246BFD',
  },
  {
    icon: Layers,
    title: 'Courses built for the wrong market',
    body: "Most online finance courses teach US GAAP, 10-Ks and S&P 500 case studies. Indian analysts work with Ind AS, SEBI filings and NSE/BSE data — and Indian interviews test exactly that.",
    color: '#6A5CFF',
  },
  {
    icon: Cpu,
    title: 'AI is changing entry-level finance',
    body: "Screening, data pulls and first-draft models are being automated. The junior analysts still getting hired are the ones who can direct AI tools — not the ones competing with them.",
    color: '#FF6AC1',
  },
];

export default function ProblemSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  // Sticky scroll-lock pattern: outer container is taller than 100vh; the
  // inner panel is `sticky top-0` and stays pinned while the user scrolls
  // past it. Scroll progress within that range = bg scene assembly state.
  const lockRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [mountScene, setMountScene] = useState(false);

  useEffect(() => {
    const node = lockRef.current;
    if (!node) return undefined;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Reduced motion → freeze at the assembled (1) state and skip lazy mount.
    if (reduced) {
      setProgress(1);
      setMountScene(true);
      return undefined;
    }
    // Lazy-mount when the lock zone is within 1.5x viewport height.
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
      className="relative bg-[var(--bg-primary)]"
      data-testid="problem-section"
      // Lock zone is 1.7x viewport → ~70% of viewport-height of vertical
      // scroll where the inner panel stays pinned. Anything bigger feels
      // dragging; smaller and the assembly animation feels rushed.
      style={{ minHeight: '170vh' }}
    >
      {/* Sticky inner panel — stays pinned while the lock zone is in view. */}
      <div className="sticky top-0 h-screen overflow-hidden flex items-center">
        {/* Bespoke Three.js scene behind the copy */}
        <div className="absolute inset-0 z-0 pointer-events-none" data-testid="problem-bg-wrap">
          {mountScene && (
            <Suspense fallback={null}>
              <ProblemAssemblyScene progress={progress} />
            </Suspense>
          )}
          {/* Soft top + bottom fades so the scene doesn't visually compete
              with the section above/below — keeps the cinematic continuity. */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              background:
                'linear-gradient(180deg, rgba(8,8,15,0.6) 0%, transparent 18%, transparent 82%, rgba(8,8,15,0.85) 100%)',
            }}
          />
        </div>

        <div ref={sectionRef} className="relative z-10 max-w-7xl mx-auto px-6 py-16 lg:py-20 w-full">
          <div className="text-center mb-12 lg:mb-14">
            <p className={`section-label ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
              THE GAP NO ONE TALKS ABOUT
            </p>
            <h2
              className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text)] leading-tight max-w-3xl mx-auto ${
                isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
              }`}
              style={{ animationDelay: '0.1s' }}
            >
              Your college prepared you for exams.
              <br />
              Not for a finance career.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {problems.map((problem, i) => {
              const Icon = problem.icon;
              return (
                <div
                  key={problem.title}
                  className={`glass-card glass-card-hover rounded-2xl p-7 lg:p-8 transition-all duration-300 ${
                    isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
                  }`}
                  style={{
                    animationDelay: `${0.2 + i * 0.1}s`,
                    borderColor: `${problem.color}20`,
                  }}
                  data-testid={`problem-card-${i}`}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${problem.color}15` }}
                  >
                    <Icon size={24} style={{ color: problem.color }} />
                  </div>
                  <h3 className="font-clash text-xl text-[var(--color-text)] mb-3">
                    {problem.title}
                  </h3>
                  <p className="text-[var(--color-text-muted)] font-bricolage leading-relaxed text-sm">
                    {problem.body}
                  </p>
                </div>
              );
            })}
          </div>

          <p
            className={`text-center mt-10 text-[var(--color-accent-pink)] italic font-bricolage text-base lg:text-lg ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.5s' }}
            data-testid="problem-transition-line"
          >
            Valuevade was built to close all three gaps at once.
          </p>
        </div>
      </div>
    </section>
  );
}
