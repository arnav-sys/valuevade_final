import { Target, Brain, Zap, Trophy } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const steps = [
  { num: '01', icon: Target, title: 'Tell Us Your Goal', body: 'Input your dream role and current skills in under 2 minutes.', color: '#246BFD' },
  { num: '02', icon: Brain, title: 'Get Your AI Roadmap', body: 'Valuevade maps your exact skill gap and builds your personalised week-by-week path.', color: '#6A5CFF' },
  { num: '03', icon: Zap, title: 'Learn By Doing', body: 'Interactive notes, simulations, projects, quizzes — all sequenced for your specific path.', color: '#FF6AC1' },
  { num: '04', icon: Trophy, title: 'Land The Role', body: 'Walk into interviews with real skills, real projects, and AI-proof expertise.', color: '#246BFD' },
];

export default function HowItWorksSection() {
  const [sectionRef, isVisible] = useScrollAnimation();

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

        <div className="relative">
          <svg className="absolute top-12 left-0 w-full h-2 hidden lg:block" viewBox="0 0 1200 4" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#246BFD" />
                <stop offset="50%" stopColor="#6A5CFF" />
                <stop offset="100%" stopColor="#FF6AC1" />
              </linearGradient>
            </defs>
            <line x1="150" y1="2" x2="1050" y2="2" stroke="url(#lineGrad)" strokeWidth="2" className={`line-draw ${isVisible ? 'visible' : ''}`} />
          </svg>

          <svg className="absolute top-0 left-8 w-2 h-full lg:hidden" viewBox="0 0 4 800" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lineGradV" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#246BFD" />
                <stop offset="50%" stopColor="#6A5CFF" />
                <stop offset="100%" stopColor="#FF6AC1" />
              </linearGradient>
            </defs>
            <line x1="2" y1="40" x2="2" y2="760" stroke="url(#lineGradV)" strokeWidth="2" className={`line-draw ${isVisible ? 'visible' : ''}`} style={{ strokeDasharray: 800, strokeDashoffset: isVisible ? 0 : 800 }} />
          </svg>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className={`relative flex flex-row lg:flex-col items-start lg:items-center gap-5 lg:gap-0 text-left lg:text-center ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
                  style={{ animationDelay: `${0.2 + i * 0.15}s` }}
                  data-testid={`step-${step.num}`}
                >
                  <div
                    className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 rounded-full flex items-center justify-center flex-shrink-0 lg:mb-6"
                    style={{ background: `${step.color}10`, border: `2px solid ${step.color}40`, boxShadow: `0 0 30px ${step.color}15` }}
                  >
                    <span className="font-clash text-xl lg:text-3xl font-bold" style={{ color: step.color }}>{step.num}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2 lg:justify-center">
                      <Icon size={18} style={{ color: step.color }} />
                      <h3 className="font-clash text-lg text-[var(--color-text)]">{step.title}</h3>
                    </div>
                    <p className="text-[var(--color-text-muted)] text-sm font-bricolage leading-relaxed max-w-[240px] lg:mx-auto">{step.body}</p>
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
