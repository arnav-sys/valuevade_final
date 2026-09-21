import { useEffect, useRef, useState } from 'react';
import { Target, Brain, Zap, Trophy, Check } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* Process section (redesigned Jun 2026) — a real roadmap UI. A progress line
 * fills as the section scrolls into view; milestone nodes light up in sequence.
 * Horizontal roadmap on desktop, vertical on mobile. Copy verbatim. */

const steps = [
  { num: '01', tag: 'Input', icon: Target, title: 'Tell Us Your Goal', body: 'Input your dream role and current skills in under 2 minutes.' },
  { num: '02', tag: 'Roadmap', icon: Brain, title: 'Get Your AI Roadmap', body: 'Valuevade maps your exact skill gap and builds your personalised week-by-week path.' },
  { num: '03', tag: 'Build', icon: Zap, title: 'Learn By Doing', body: 'Interactive notes, simulations, projects, quizzes — all sequenced for your specific path.' },
  { num: '04', tag: 'Deploy', icon: Trophy, title: 'Land The Role', body: 'Walk into interviews with real skills, real projects, and AI-proof expertise.' },
];

export default function HowItWorksSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  const trackRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = trackRef.current;
    if (!node) return undefined;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setProgress(1); return undefined; }
    const onScroll = () => {
      const rect = node.getBoundingClientRect();
      const start = window.innerHeight * 0.82;
      const end = window.innerHeight * 0.32 - rect.height;
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

  const nodeThreshold = (i) => (i + 0.35) / steps.length;

  return (
    <section id="how-it-works" className="relative py-24 lg:py-28 bg-[var(--bg-secondary)]" data-testid="how-it-works-section">
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-25" aria-hidden="true" />

      <div ref={sectionRef} className="relative max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 lg:mb-20">
          <p className={`lv-chapter justify-center mb-5 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>THE ROADMAP</p>
          <h2 className={`text-4xl sm:text-5xl lg:text-[56px] text-[var(--color-text)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.03em' }}>
            From where you are.{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 500, color: 'var(--color-primary)' }}>To</span>{' '}
            where you want to be.
          </h2>
        </div>

        <div ref={trackRef} className="relative" data-testid="how-it-works-roadmap">
          {/* ---------- Desktop horizontal roadmap ---------- */}
          <div className="hidden lg:block">
            {/* Track line */}
            <div className="absolute top-[34px] left-[12.5%] right-[12.5%] h-[3px] rounded-full bg-[var(--color-border)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${progress * 100}%`, transition: 'width 140ms linear' }} />
            </div>
            {/* Traveling pulse */}
            <div className="absolute top-[30px] w-[11px] h-[11px] rounded-full bg-[var(--color-primary)] lv-road-pulse"
              style={{ left: `calc(12.5% + ${progress * 75}%)`, transform: 'translateX(-50%)', opacity: progress > 0.02 && progress < 0.99 ? 1 : 0, transition: 'left 140ms linear, opacity 300ms ease' }} aria-hidden="true" />

            <div className="grid grid-cols-4">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const active = progress >= nodeThreshold(i);
                const done = progress >= (i + 1) / steps.length;
                return (
                  <div key={step.num} className="flex flex-col items-center px-3" data-testid={`step-${step.num}`}>
                    <div className={`relative z-10 w-[68px] h-[68px] rounded-full flex items-center justify-center mb-6 transition-all duration-500 ${active ? 'lv-road-node-on' : ''}`}
                      style={{
                        background: active ? 'var(--color-primary)' : 'var(--color-bg-card)',
                        border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        boxShadow: active ? '0 0 40px -6px rgba(36,107,253,0.6)' : 'none',
                      }}>
                      {done ? <Check size={26} strokeWidth={2.6} className="text-white" /> : <Icon size={24} className={active ? 'text-white' : 'text-[var(--color-text-muted)]'} />}
                    </div>
                    <article className={`lv-panel p-6 w-full text-center transition-opacity duration-500 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
                      style={{ animationDelay: `${0.2 + i * 0.12}s`, opacity: active ? 1 : 0.55 }}>
                      <div className="text-[11px] uppercase tracking-[0.16em] font-semibold mb-2" style={{ color: active ? 'var(--color-primary)' : 'var(--color-text-faint)', fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
                        Step {step.num} · {step.tag}
                      </div>
                      <h3 className="text-lg text-[var(--color-text)] mb-2" style={{ lineHeight: 1.2 }}>{step.title}</h3>
                      <p className="text-[13px] text-[var(--color-text-muted)] font-bricolage leading-relaxed">{step.body}</p>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---------- Mobile vertical roadmap ---------- */}
          <div className="lg:hidden relative pl-16">
            <div className="absolute left-[26px] top-2 bottom-2 w-[3px] rounded-full bg-[var(--color-border)] overflow-hidden">
              <div className="w-full rounded-full bg-[var(--color-primary)]" style={{ height: `${progress * 100}%`, transition: 'height 140ms linear' }} />
            </div>
            <div className="space-y-6">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const active = progress >= nodeThreshold(i);
                const done = progress >= (i + 1) / steps.length;
                return (
                  <div key={step.num} className="relative" data-testid={`step-mobile-${step.num}`}>
                    <div className={`absolute -left-16 top-0 w-[54px] h-[54px] rounded-full flex items-center justify-center transition-all duration-500`}
                      style={{ background: active ? 'var(--color-primary)' : 'var(--color-bg-card)', border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`, boxShadow: active ? '0 0 30px -6px rgba(36,107,253,0.6)' : 'none' }}>
                      {done ? <Check size={22} strokeWidth={2.6} className="text-white" /> : <Icon size={20} className={active ? 'text-white' : 'text-[var(--color-text-muted)]'} />}
                    </div>
                    <article className="lv-panel p-5" style={{ opacity: active ? 1 : 0.6 }}>
                      <div className="text-[11px] uppercase tracking-[0.16em] font-semibold mb-1.5" style={{ color: active ? 'var(--color-primary)' : 'var(--color-text-faint)', fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
                        Step {step.num} · {step.tag}
                      </div>
                      <h3 className="text-base text-[var(--color-text)] mb-1.5" style={{ lineHeight: 1.2 }}>{step.title}</h3>
                      <p className="text-[13px] text-[var(--color-text-muted)] font-bricolage leading-relaxed">{step.body}</p>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
