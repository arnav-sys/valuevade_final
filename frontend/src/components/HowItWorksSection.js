import { useEffect, useRef, useState } from 'react';
import { Target, Brain, Zap, Trophy } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { TimelinePath } from '@/components/landing/CinematicSections';

const steps = [
  { num: '01', icon: Target, title: 'Tell Us Your Goal', body: 'Input your dream role and current skills in under 2 minutes.', color: '#246BFD' },
  { num: '02', icon: Brain, title: 'Get Your AI Roadmap', body: 'Valuevade maps your exact skill gap and builds your personalised week-by-week path.', color: '#6A5CFF' },
  { num: '03', icon: Zap, title: 'Learn By Doing', body: 'Interactive notes, simulations, projects, quizzes — all sequenced for your specific path.', color: '#FF6AC1' },
  { num: '04', icon: Trophy, title: 'Land The Role', body: 'Walk into interviews with real skills, real projects, and AI-proof expertise.', color: '#246BFD' },
];

export default function HowItWorksSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  // Scroll progress within this section drives the violet path's stroke-
  // dashoffset. Manual rAF loop is cheaper than Framer Motion's useScroll
  // here because the section is short and we only need one number.
  const containerRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setProgress(1); return undefined; }
    const onScroll = () => {
      const rect = node.getBoundingClientRect();
      // Map [bottom enters viewport ... top leaves viewport] → [0 ... 1]
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
      className="relative py-24 lg:py-32 bg-[var(--bg-secondary)]"
      data-testid="how-it-works-section"
    >
      <div ref={sectionRef} className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className={`section-label ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            THE PROCESS
          </p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text)] leading-tight ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.1s' }}
          >
            From where you are. To where you want to be.
          </h2>
        </div>

        {/* Container that owns the scroll-driven progress + holds the
            milestone path SVG behind the step cards. */}
        <div ref={containerRef} className="relative" data-testid="how-it-works-timeline-wrap">
          {/* Scroll-drawn violet bezier path with milestone spheres.
              Sits behind the cards (z-0), cards sit at z-10. */}
          <TimelinePath progress={progress} stepCount={steps.length} />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-8 lg:gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className={`relative w-full flex flex-col items-center text-center gap-0 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
                  style={{ animationDelay: `${0.2 + i * 0.15}s` }}
                  data-testid={`step-${step.num}`}
                >
                  <div
                    className="relative z-10 w-20 h-20 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full flex items-center justify-center flex-shrink-0 mb-5 md:mb-6 mx-auto"
                    style={{ background: `${step.color}10`, border: `2px solid ${step.color}40`, boxShadow: `0 0 30px ${step.color}15` }}
                  >
                    <span className="font-clash text-2xl md:text-2xl lg:text-3xl font-bold" style={{ color: step.color }}>{step.num}</span>
                  </div>
                  <div className="w-full max-w-[280px] mx-auto">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Icon size={18} style={{ color: step.color }} />
                      <h3 className="font-clash text-lg text-[var(--color-text)]">{step.title}</h3>
                    </div>
                    <p className="text-[var(--color-text-muted)] text-sm font-bricolage leading-relaxed mx-auto">{step.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
