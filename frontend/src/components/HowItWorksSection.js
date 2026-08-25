import { useEffect, useRef, useState } from 'react';
import { Target, Brain, Zap, Trophy } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { TimelinePath } from '@/components/landing/CinematicSections';

/* Editorial finance / Bloomberg-terminal HowItWorksSection (Feb 2026).
 * - Chapter rail §04 // THE PROCESS.
 * - Sharp 1px lv-panel steps replacing pillowy circles.
 * - Mono NN prefix, framed icons, hairline connector rails between cards.
 * - TimelinePath decor retained but dialled back (opacity: 0.5).
 * Content copy verbatim from previous version. */

const steps = [
  { num: '01', tag: 'INPUT',    icon: Target,  title: 'Tell Us Your Goal',      body: 'Input your dream role and current skills in under 2 minutes.',                                     accent: 'var(--color-primary)' },
  { num: '02', tag: 'ROADMAP',  icon: Brain,   title: 'Get Your AI Roadmap',    body: 'Valuevade maps your exact skill gap and builds your personalised week-by-week path.',           accent: 'var(--color-accent-purple)' },
  { num: '03', tag: 'BUILD',    icon: Zap,     title: 'Learn By Doing',         body: 'Interactive notes, simulations, projects, quizzes — all sequenced for your specific path.',    accent: 'var(--color-accent-pink)' },
  { num: '04', tag: 'DEPLOY',   icon: Trophy,  title: 'Land The Role',          body: 'Walk into interviews with real skills, real projects, and AI-proof expertise.',                accent: 'var(--color-primary)' },
];

export default function HowItWorksSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  const containerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [layout, setLayout] = useState(
    () => (typeof window !== 'undefined' && window.matchMedia
      ? (window.matchMedia('(min-width: 1024px)').matches ? 'horizontal' : 'vertical')
      : 'horizontal')
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setLayout(e.matches ? 'horizontal' : 'vertical');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setProgress(1); return undefined; }
    const onScroll = () => {
      const rect = node.getBoundingClientRect();
      const start = window.innerHeight * 0.9;
      const end   = -rect.height + window.innerHeight * 0.2;
      const range = start - end;
      if (range <= 0) { setProgress(1); return; }
      const p = (start - rect.top) / range;
      setProgress(Math.max(0, Math.min(1, p)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  return (
    <section
      id="how-it-works"
      className="relative py-24 lg:py-28 bg-[var(--bg-secondary)]"
      data-testid="how-it-works-section"
    >
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-30" aria-hidden="true" />

      <div ref={sectionRef} className="relative max-w-7xl mx-auto px-6">
        {/* Chapter rail */}
        <div className="flex items-center gap-3 mb-10 lg:mb-12">
          <span className="lv-chapter">§04 // PROCESS</span>
          <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
          <span className="lv-chapter">04 STEPS · 2 MONTHS · 1 HR/DAY</span>
        </div>

        <div className="max-w-3xl mb-12 lg:mb-14">
          <p className={`lv-chapter mb-4 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            THE PROCESS
          </p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-[52px] text-[var(--color-text)] ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.02em' }}
          >
            From where you are.{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-primary)' }}>
              To
            </span>{' '}
            where you want to be.
          </h2>
          <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />
        </div>

        {/* Container that owns the scroll-driven progress + holds the
            milestone path behind the step cards. */}
        <div ref={containerRef} className="relative" data-testid="how-it-works-timeline-wrap">
          {/* Timeline path — dialled back to editorial vibe */}
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.4 }}>
            <TimelinePath progress={progress} stepCount={steps.length} layout={layout} />
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.num}
                  className={`lv-panel p-6 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
                  style={{ animationDelay: `${0.2 + i * 0.12}s` }}
                  data-testid={`step-${step.num}`}
                >
                  {/* Mono step prefix */}
                  <div className="flex items-center justify-between mb-6">
                    <span
                      className="font-jetbrains text-[26px] font-bold tracking-tight"
                      style={{ color: step.accent }}
                    >
                      {step.num}
                    </span>
                    <span
                      className="inline-flex items-center justify-center w-9 h-9 border border-[var(--color-border)]"
                      style={{ borderRadius: 2 }}
                    >
                      <Icon size={16} style={{ color: step.accent }} />
                    </span>
                  </div>

                  <span className="font-jetbrains text-[10.5px] uppercase tracking-[0.2em] text-[var(--color-text-faint)] mb-2 block">
                    STEP · {step.tag}
                  </span>
                  <h3 className="font-clash text-lg text-[var(--color-text)] mb-3" style={{ lineHeight: 1.2 }}>
                    {step.title}
                  </h3>
                  <p className="text-[var(--color-text-muted)] text-[13.5px] font-bricolage leading-relaxed">
                    {step.body}
                  </p>

                  {/* Hairline data footer */}
                  <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                    <span className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
                      PHASE · {i + 1}/4
                    </span>
                    <span
                      className="font-jetbrains text-[10px] uppercase tracking-[0.2em]"
                      style={{ color: step.accent }}
                    >
                      {i === steps.length - 1 ? 'OUTCOME' : 'NEXT →'}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
