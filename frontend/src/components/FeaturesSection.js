import { useState } from 'react';
import { BookOpen, Briefcase, Mic, BarChart3, Award, Gamepad2, BookMarked, Shield, Sparkles, FileText, Brain, Hammer } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import FeatureMicro3D from '@/components/landing/FeatureMicro3D';

const features = [
  {
    title: 'Personalised AI Roadmap',
    body: "Tell Valuevade your dream role and current skills. The AI maps your exact gap and builds a week-by-week path — personalised to you, not a generic syllabus.",
    span: 'col-span-12 lg:col-span-7',
    size: 'large',
    gradient: 'from-[var(--color-primary)]/10 to-transparent',
    borderColor: 'rgba(36, 107, 253, 0.2)',
  },
  {
    title: 'AI-Proof Your Career',
    body: "Every roadmap includes the AI skills finance professionals need — Python, AI-assisted modelling, prompt engineering for analysts. You won't just land the role. You'll be irreplaceable.",
    icon: Shield,
    span: 'col-span-12 lg:col-span-5',
    size: 'large',
    gradient: 'from-[var(--color-accent-purple)]/10 to-transparent',
    borderColor: 'rgba(106, 92, 255, 0.2)',
  },
  {
    title: 'Pari — Your 24/7 AI Tutor',
    body: "Stuck on a DCF cell or a CFA concept? Ask Pari. She sees your exact notes, simulation, or quiz answer and replies like a senior analyst pair-debugging with you.",
    icon: Sparkles,
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    borderColor: 'rgba(36, 107, 253, 0.15)',
  },
  {
    title: 'Interactive Notes',
    body: "Live, clickable, visual notes built around CFA, FRM, and finance fundamentals — not PDFs.",
    icon: BookOpen,
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    borderColor: 'rgba(36, 107, 253, 0.15)',
  },
  {
    title: 'Real-World Simulations',
    body: "Build a DCF on Reliance. Ratio-analyse HDFC. Model an LBO on Tata Steel. 68 hands-on Excel sims, not toy problems.",
    icon: Briefcase,
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    borderColor: 'rgba(106, 92, 255, 0.15)',
  },
  {
    title: 'AI Mock Interviews',
    body: "3-round equity-research interviewer with voice or text. You speak, it grills, you get verdict + feedback.",
    icon: Mic,
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    borderColor: 'rgba(255, 106, 193, 0.15)',
  },
  {
    title: 'Resume + LinkedIn Networking',
    body: "Recruiter-tuned resume reviewer, AI-skill highlighting guide, plus the outreach playbook to get warm replies — not just qualified, hired.",
    icon: FileText,
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    borderColor: 'rgba(36, 107, 253, 0.15)',
  },
  {
    title: 'NISM + CFI Certifications',
    body: "The only program bundling skills with the certifications recruiters actually look for. SEBI-recognised NISM + CFI partner certs at no extra cost.",
    icon: Award,
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    borderColor: 'rgba(106, 92, 255, 0.15)',
  },
  {
    title: 'AI Capstone Project',
    body: "Build a real finance tool with AI, ship it to your portfolio. Recruiters want builders now, not just learners.",
    icon: Hammer,
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    borderColor: 'rgba(255, 106, 193, 0.15)',
  },
  {
    title: 'Top-Analyst Mindset',
    body: "Frameworks, soft skills, and thinking habits AI can't replace. Don't get replaced — become the analyst who deploys AI.",
    icon: Brain,
    span: 'col-span-6 lg:col-span-3',
    size: 'small',
    borderColor: 'rgba(36, 107, 253, 0.12)',
  },
  {
    title: 'Adaptive Quizzes',
    body: 'Quizzes that track weak spots and patch them — automatically.',
    icon: BarChart3,
    span: 'col-span-6 lg:col-span-3',
    size: 'small',
    borderColor: 'rgba(106, 92, 255, 0.12)',
  },
  {
    title: 'CV-Ready Projects',
    body: 'DCF models, credit memos, risk reports — every artefact lands on your resume.',
    icon: BookMarked,
    span: 'col-span-6 lg:col-span-3',
    size: 'small',
    borderColor: 'rgba(255, 106, 193, 0.12)',
  },
  {
    title: 'Gamified XP',
    body: 'Earn XP, hit streaks, unlock levels. Learning finance should feel like levelling up.',
    icon: Gamepad2,
    span: 'col-span-6 lg:col-span-3',
    size: 'small',
    borderColor: 'rgba(36, 107, 253, 0.12)',
  },
];

function RoadmapVisual() {
  return (
    <div className="flex items-center gap-3 mt-6">
      <div className="flex items-center gap-1">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-xs text-[var(--color-text-muted)] font-jetbrains">
          IN
        </div>
        <div className="w-12 h-px bg-gradient-to-r from-[var(--color-border)] to-[var(--color-primary)]/60" />
      </div>
      <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/40 flex items-center justify-center relative">
        <div className="w-3 h-3 rounded-full bg-[var(--color-primary)] animate-pulse" />
      </div>
      <div className="flex items-center gap-1">
        <div className="w-12 h-px bg-gradient-to-r from-[var(--color-primary)]/60 to-[var(--color-accent-purple)]/60" />
        <div className="flex gap-1">
          <div className="w-6 h-6 rounded bg-[var(--color-accent-purple)]/20 border border-[var(--color-accent-purple)]/30" />
          <div className="w-6 h-6 rounded bg-[var(--color-accent-pink)]/20 border border-[var(--color-accent-pink)]/30" />
          <div className="w-6 h-6 rounded bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/30" />
        </div>
      </div>
    </div>
  );
}

export default function FeaturesSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <section
      id="features"
      className="relative py-24 lg:py-32 bg-[var(--bg-primary)]"
      data-testid="features-section"
    >
      <div ref={sectionRef} className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className={`section-label ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            WHAT VALUEVADE GIVES YOU
          </p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text)] leading-tight ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.1s' }}
          >
            One platform. Your entire finance career journey.
          </h2>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            const useMicro3D = feature.size !== 'small';
            const isHover = hoveredIdx === i;
            return (
              <div
                key={feature.title}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`${feature.span} glass-card glass-card-hover rounded-2xl transition-all duration-300 ${
                  feature.size === 'large' ? 'p-8' : feature.size === 'medium' ? 'p-6' : 'p-5'
                } ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'} ${
                  feature.gradient ? `bg-gradient-to-br ${feature.gradient}` : ''
                } ${isHover ? 'shadow-[0_18px_60px_rgba(139,92,246,0.32)] -translate-y-1.5' : ''}`}
                style={{
                  animationDelay: `${0.1 + i * 0.05}s`,
                  borderColor: isHover ? 'rgba(167,139,250,0.55)' : feature.borderColor,
                  willChange: 'transform',
                }}
                data-testid={`feature-card-${i}`}
              >
                {useMicro3D ? (
                  <div className="mb-4 -ml-2" data-testid={`feature-card-${i}-3d-wrap`}>
                    <FeatureMicro3D title={feature.title} hovered={isHover} />
                  </div>
                ) : (Icon && (
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-surface)] flex items-center justify-center mb-4">
                    <Icon size={feature.size === 'small' ? 18 : 22} className="text-[var(--color-accent-purple)]" />
                  </div>
                ))}
                <h3
                  className={`font-clash text-[var(--color-text)] mb-2 ${
                    feature.size === 'large' ? 'text-2xl' : feature.size === 'medium' ? 'text-lg' : 'text-base'
                  }`}
                >
                  {feature.title}
                </h3>
                <p
                  className={`text-[var(--color-text-muted)] font-bricolage leading-relaxed ${
                    feature.size === 'small' ? 'text-xs' : 'text-sm'
                  }`}
                >
                  {feature.body}
                </p>
                {i === 0 && <RoadmapVisual />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
