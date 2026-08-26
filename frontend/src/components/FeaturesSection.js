import { useState } from 'react';
import { BookOpen, Briefcase, Mic, BarChart3, Award, Gamepad2, BookMarked, Shield, Sparkles, FileText, Brain, Hammer, CalendarRange, Compass } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* Editorial finance / Bloomberg-terminal FeaturesSection (Feb 2026).
 * - Chapter rail §03 // WHAT VALUEVADE GIVES YOU.
 * - Sharp 1px lv-panel cards with corner ticks (no rounded pillowy glass).
 * - Numeric FT-NN / TAG prefix on every card. Framed square icons.
 * - Bento grid retained; hover treatment restrained.
 * Content and copy are verbatim from the previous version. */

const features = [
  {
    idx: 'FT-01', tag: 'ROADMAP', icon: Compass,
    title: 'Personalised AI Roadmap',
    body: "Tell it your target role and current skills; it maps your exact gap and sequences your path through the program — personalised to you, not a generic syllabus.",
    span: 'col-span-12 lg:col-span-7',
    size: 'large',
    accent: 'var(--color-primary)',
  },
  {
    idx: 'FT-02', tag: 'AI-PROOF', icon: Shield,
    title: 'AI-Proof Your Career',
    body: "Every roadmap includes the AI skills finance professionals need — Python, AI-assisted modelling, prompt engineering for analysts. You won't just land the role. You'll be irreplaceable.",
    span: 'col-span-12 lg:col-span-5',
    size: 'large',
    accent: 'var(--color-accent-purple)',
  },
  {
    idx: 'FT-03', tag: 'TUTOR', icon: Sparkles,
    title: 'Pari — Your 24/7 AI Tutor',
    body: "Stuck on a DCF cell or a ratio question? Ask Pari. She sees the exact note, quiz or simulation you're on and answers in context — like a senior analyst pair-working with you.",
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    accent: 'var(--color-primary)',
  },
  {
    idx: 'FT-04', tag: 'NOTES', icon: BookOpen,
    title: 'Interactive Notes',
    body: "Live, clickable, visual notes covering financial modelling and valuation concepts from first principles — built for beginners, not PDF dumps.",
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    accent: 'var(--color-primary)',
  },
  {
    idx: 'FT-05', tag: 'SIMULATIONS', icon: Briefcase,
    title: '239 hands-on sessions',
    body: "Build a DCF on Reliance. Ratio-analyse HDFC Bank. Model an LBO on Tata Steel. Every session pairs a concept with a simulation — interactive Excel, decision scenarios, or applied reading — all auto-graded.",
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    accent: 'var(--color-accent-purple)',
  },
  {
    idx: 'FT-06', tag: 'INTERVIEW', icon: Mic,
    title: 'AI Mock Interviews',
    body: "3-round equity-research interviewer with voice or text. You speak, it grills, you get verdict + feedback.",
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    accent: 'var(--color-accent-pink)',
  },
  {
    idx: 'FT-07', tag: 'PLANNER', icon: CalendarRange,
    title: 'Study Planner',
    body: "Pick a deadline or an hours-per-day budget and it auto-schedules all 239 sessions around your college timetable.",
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    accent: 'var(--color-primary)',
  },
  {
    idx: 'FT-08', tag: 'CAREER', icon: FileText,
    title: 'Resume + LinkedIn Networking',
    body: "Recruiter-tuned resume reviewer, AI-skill highlighting guide, plus the outreach playbook to get warm replies — not just qualified, hired.",
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    accent: 'var(--color-primary)',
  },
  {
    idx: 'FT-09', tag: 'CERT', icon: Award,
    title: 'NISM certification prep, certificate included',
    body: "Structured preparation for the NISM Series XV (Research Analyst) exam, mapped into the curriculum — plus Valuevade's own Certificate of Completion when you finish all three capstones.",
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    accent: 'var(--color-accent-purple)',
  },
  {
    idx: 'FT-10', tag: 'CAPSTONE', icon: Hammer,
    title: 'AI Capstone Project',
    body: "Finish with a full initiating-coverage report, a sector coverage note, and a working AI research copilot — a portfolio recruiters can actually open, not just a certificate.",
    span: 'col-span-12 sm:col-span-6 lg:col-span-4',
    size: 'medium',
    accent: 'var(--color-accent-pink)',
  },
  {
    idx: 'FT-11', tag: 'MINDSET', icon: Brain,
    title: 'Top-Analyst Mindset',
    body: "Frameworks, soft skills, and thinking habits AI can't replace. Don't get replaced — become the analyst who deploys AI.",
    span: 'col-span-6 lg:col-span-3',
    size: 'small',
    accent: 'var(--color-primary)',
  },
  {
    idx: 'FT-12', tag: 'QUIZ', icon: BarChart3,
    title: 'Adaptive Quizzes',
    body: 'Quizzes that track weak spots and patch them — automatically.',
    span: 'col-span-6 lg:col-span-3',
    size: 'small',
    accent: 'var(--color-accent-purple)',
  },
  {
    idx: 'FT-13', tag: 'PORTFOLIO', icon: BookMarked,
    title: 'CV-Ready Projects',
    body: 'DCF models, credit memos, risk reports — every artefact lands on your resume.',
    span: 'col-span-6 lg:col-span-3',
    size: 'small',
    accent: 'var(--color-accent-pink)',
  },
  {
    idx: 'FT-14', tag: 'XP', icon: Gamepad2,
    title: 'Gamified XP',
    body: 'Earn XP, hit streaks, unlock levels. Learning finance should feel like levelling up.',
    span: 'col-span-6 lg:col-span-3',
    size: 'small',
    accent: 'var(--color-primary)',
  },
];

export default function FeaturesSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <section
      id="features"
      className="relative py-24 lg:py-28 bg-[var(--bg-primary)]"
      data-testid="features-section"
    >
      {/* Terminal grid — subtle continuation of the editorial thread */}
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-40" aria-hidden="true" />

      <div ref={sectionRef} className="relative max-w-7xl mx-auto px-6">
        {/* Chapter rail */}
        <div className="flex items-center gap-3 mb-10 lg:mb-12">
          <span className="lv-chapter">§03 // FEATURES</span>
          <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
          <span className="lv-chapter">WHAT VALUEVADE GIVES YOU · 14 UNITS</span>
        </div>

        <div className="max-w-3xl mb-12 lg:mb-14">
          <p className={`lv-chapter mb-4 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            THE PLATFORM
          </p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-[52px] text-[var(--color-text)] ${
              isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
            }`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.02em' }}
          >
            One platform.{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-primary)' }}>
              Your
            </span>{' '}
            entire finance career journey.
          </h2>
          <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />
        </div>

        <div className="grid grid-cols-12 gap-3 lg:gap-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            const isHover = hoveredIdx === i;
            return (
              <article
                key={feature.title}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`${feature.span} lv-panel ${
                  feature.size === 'large' ? 'p-7' : feature.size === 'medium' ? 'p-5' : 'p-4'
                } ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'} transition-transform duration-300`}
                style={{
                  animationDelay: `${0.1 + i * 0.04}s`,
                  transform: isHover ? 'translateY(-2px)' : 'none',
                  willChange: 'transform',
                }}
                data-testid={`feature-card-${i}`}
              >
                {/* Mono prefix rail */}
                <div className="flex items-center justify-between mb-4">
                  <span className="font-jetbrains text-[10.5px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
                    {feature.idx} · {feature.tag}
                  </span>
                  {Icon && (
                    <span
                      className={`inline-flex items-center justify-center border border-[var(--color-border)] ${
                        feature.size === 'small' ? 'w-7 h-7' : 'w-9 h-9'
                      }`}
                      style={{ borderRadius: 2 }}
                    >
                      <Icon size={feature.size === 'small' ? 14 : 16} style={{ color: feature.accent }} />
                    </span>
                  )}
                </div>

                <h3
                  className={`font-clash text-[var(--color-text)] mb-2 ${
                    feature.size === 'large' ? 'text-2xl' : feature.size === 'medium' ? 'text-lg' : 'text-[15px]'
                  }`}
                  style={{ lineHeight: 1.2, letterSpacing: '-0.01em' }}
                >
                  {feature.title}
                </h3>
                <p
                  className={`text-[var(--color-text-muted)] font-bricolage leading-relaxed ${
                    feature.size === 'small' ? 'text-xs' : 'text-[13.5px]'
                  }`}
                >
                  {feature.body}
                </p>

                {/* Hairline data footer — feature.large only for editorial weight */}
                {feature.size === 'large' && (
                  <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                    <span className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
                      MODULE · CORE
                    </span>
                    <span
                      className="font-jetbrains text-[10px] uppercase tracking-[0.2em]"
                      style={{ color: feature.accent }}
                    >
                      SHIPPED · IN PLATFORM
                    </span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
