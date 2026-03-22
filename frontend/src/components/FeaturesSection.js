import { BookOpen, Briefcase, Mic, BarChart3, Award, Gamepad2, BookMarked, Shield } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const features = [
  {
    title: 'Personalised AI Roadmap',
    body: "Tell Valuevade your dream role and current skills. The AI maps your exact gap and builds a week-by-week path — personalised to you, not a generic syllabus.",
    span: 'col-span-12 lg:col-span-7',
    size: 'large',
    gradient: 'from-vblue/10 to-transparent',
    borderColor: 'rgba(36, 107, 253, 0.2)',
  },
  {
    title: 'AI-Proof Your Career',
    body: "Every roadmap includes the AI skills finance professionals need — Python, AI-assisted modelling, prompt engineering for analysts. You won't just land the role. You'll be irreplaceable.",
    icon: Shield,
    span: 'col-span-12 lg:col-span-5',
    size: 'large',
    gradient: 'from-vpurple/10 to-transparent',
    borderColor: 'rgba(106, 92, 255, 0.2)',
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
    title: 'Job Simulations',
    body: "Work through real deal analyses, portfolio reviews, and risk assessments as if you're already in the role.",
    icon: Briefcase,
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    borderColor: 'rgba(106, 92, 255, 0.15)',
  },
  {
    title: 'Interview Prep',
    body: "Role-specific questions, AI mock interviews, and the exact answers that get IB, AM, Big4 interviewers to say yes.",
    icon: Mic,
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    borderColor: 'rgba(255, 106, 193, 0.15)',
  },
  {
    title: 'Quizzes',
    body: 'Adaptive quizzes track your weak spots and fix them.',
    icon: BarChart3,
    span: 'col-span-6 lg:col-span-3',
    size: 'small',
    borderColor: 'rgba(36, 107, 253, 0.12)',
  },
  {
    title: 'Capstone Projects',
    body: 'DCF models, credit memos, risk reports — for your resume.',
    icon: Award,
    span: 'col-span-6 lg:col-span-3',
    size: 'small',
    borderColor: 'rgba(106, 92, 255, 0.12)',
  },
  {
    title: 'Gamified XP',
    body: 'Earn XP, hit streaks, unlock levels. Learning finance should feel like levelling up.',
    icon: Gamepad2,
    span: 'col-span-6 lg:col-span-3',
    size: 'small',
    borderColor: 'rgba(255, 106, 193, 0.12)',
  },
  {
    title: 'Course Modules',
    body: 'Structured learning tracks from zero to job-ready, sequenced for your specific path.',
    icon: BookMarked,
    span: 'col-span-6 lg:col-span-3',
    size: 'small',
    borderColor: 'rgba(36, 107, 253, 0.12)',
  },
];

function RoadmapVisual() {
  return (
    <div className="flex items-center gap-3 mt-6">
      <div className="flex items-center gap-1">
        <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-xs text-white/60 font-jetbrains">
          IN
        </div>
        <div className="w-12 h-px bg-gradient-to-r from-white/20 to-vblue/60" />
      </div>
      <div className="w-10 h-10 rounded-full bg-vblue/20 border border-vblue/40 flex items-center justify-center relative">
        <div className="w-3 h-3 rounded-full bg-vblue animate-pulse" />
      </div>
      <div className="flex items-center gap-1">
        <div className="w-12 h-px bg-gradient-to-r from-vblue/60 to-vpurple/60" />
        <div className="flex gap-1">
          <div className="w-6 h-6 rounded bg-vpurple/20 border border-vpurple/30" />
          <div className="w-6 h-6 rounded bg-vpink/20 border border-vpink/30" />
          <div className="w-6 h-6 rounded bg-vblue/20 border border-vblue/30" />
        </div>
      </div>
    </div>
  );
}

export default function FeaturesSection() {
  const [sectionRef, isVisible] = useScrollAnimation();

  return (
    <section
      id="features"
      className="relative py-24 lg:py-32"
      style={{ background: '#02073D' }}
      data-testid="features-section"
    >
      <div ref={sectionRef} className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className={`section-label ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            WHAT VALUEVADE GIVES YOU
          </p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-white leading-tight ${
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
            return (
              <div
                key={feature.title}
                className={`${feature.span} glass-card glass-card-hover rounded-2xl transition-all duration-300 ${
                  feature.size === 'large' ? 'p-8' : feature.size === 'medium' ? 'p-6' : 'p-5'
                } ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'} ${
                  feature.gradient ? `bg-gradient-to-br ${feature.gradient}` : ''
                }`}
                style={{
                  animationDelay: `${0.1 + i * 0.05}s`,
                  borderColor: feature.borderColor,
                }}
                data-testid={`feature-card-${i}`}
              >
                {Icon && (
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4">
                    <Icon size={feature.size === 'small' ? 18 : 22} className="text-vpurple" />
                  </div>
                )}
                <h3
                  className={`font-clash text-white mb-2 ${
                    feature.size === 'large' ? 'text-2xl' : feature.size === 'medium' ? 'text-lg' : 'text-base'
                  }`}
                >
                  {feature.title}
                </h3>
                <p
                  className={`text-white/50 font-bricolage leading-relaxed ${
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
