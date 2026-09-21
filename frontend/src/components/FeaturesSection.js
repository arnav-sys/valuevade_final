import { BookOpen, Briefcase, Mic, BarChart3, Award, Gamepad2, BookMarked, Shield, Sparkles, FileText, Brain, Hammer, CalendarRange, Compass } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* "One platform" section (redesigned Jun 2026) — the 14 units are arranged
 * around a central Valuevade logo hub as one unified constellation (no separate
 * grid). The hub is an original CSS/SVG graphic (logo + pulse rings). */

const features = [
  { icon: Compass, title: 'Personalised AI Roadmap', short: 'Maps your exact gap and sequences your path.' },
  { icon: BookOpen, title: 'Interactive Notes', short: 'Clickable, visual, first-principles — no PDF dumps.' },
  { icon: Sparkles, title: 'Pari — 24/7 AI Tutor', short: 'In-context help on any note, quiz or simulation.' },
  { icon: Briefcase, title: '239 Hands-on Sessions', short: 'Concept + auto-graded simulation, every session.' },
  { icon: Mic, title: 'AI Mock Interviews', short: '3 rounds, voice or text, real verdict + feedback.' },
  { icon: CalendarRange, title: 'Study Planner', short: 'Auto-schedules all 239 sessions around your timetable.' },
  { icon: Hammer, title: 'AI Capstone Project', short: 'A portfolio recruiters can actually open.' },
  { icon: Award, title: 'NISM Prep + Certificate', short: 'Series XV preparation and a completion certificate.' },
  { icon: FileText, title: 'Resume + LinkedIn Prep', short: 'Recruiter-tuned CV and an outreach playbook.' },
  { icon: Shield, title: 'AI-Proof Skills', short: 'Python and AI-assisted modelling built in.' },
  { icon: Brain, title: 'Top-Analyst Mindset', short: "The judgment and habits AI can't replace." },
  { icon: BarChart3, title: 'Adaptive Quizzes', short: 'Find your weak spots and patch them automatically.' },
  { icon: BookMarked, title: 'CV-Ready Projects', short: 'Every artefact lands straight on your resume.' },
  { icon: Gamepad2, title: 'Gamified XP', short: 'Streaks, levels and momentum that keep you going.' },
];

const LEFT = features.slice(0, 7);
const RIGHT = features.slice(7);

function Node({ f, align, isVisible, delay }) {
  const Icon = f.icon;
  const right = align === 'right';
  return (
    <div
      className={`flex items-start gap-3 ${right ? 'lg:flex-row-reverse lg:text-right' : ''} ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 lv-feature-node"
        style={{ background: 'color-mix(in oklab, var(--color-primary) 14%, transparent)', border: '1px solid color-mix(in oklab, var(--color-primary) 30%, transparent)' }}>
        <Icon size={18} style={{ color: 'var(--color-primary)' }} />
      </span>
      <div className="min-w-0">
        <h3 className="text-[15px] text-[var(--color-text)] leading-tight" style={{ letterSpacing: '-0.01em' }}>{f.title}</h3>
        <p className="text-[12.5px] text-[var(--color-text-muted)] font-bricolage leading-snug mt-1">{f.short}</p>
      </div>
    </div>
  );
}

function Hub() {
  return (
    <div className="relative w-56 h-56 lg:w-72 lg:h-72 mx-auto flex items-center justify-center shrink-0" aria-hidden="true">
      <span className="lv-hub-ring" style={{ animationDelay: '0s' }} />
      <span className="lv-hub-ring" style={{ animationDelay: '1.3s' }} />
      <span className="lv-hub-ring" style={{ animationDelay: '2.6s' }} />
      <div className="relative w-32 h-32 lg:w-40 lg:h-40 rounded-full flex items-center justify-center"
        style={{ background: 'radial-gradient(circle at 50% 35%, rgba(36,107,253,0.30), rgba(10,15,28,0.92))', border: '1px solid color-mix(in oklab, var(--color-primary) 45%, transparent)', boxShadow: '0 0 70px -8px rgba(36,107,253,0.55)' }}>
        <img src="/valuevade-logo.svg" alt="Valuevade" className="w-14 h-14 lg:w-20 lg:h-20 object-contain lv-hub-logo" />
      </div>
    </div>
  );
}

export default function FeaturesSection() {
  const [sectionRef, isVisible] = useScrollAnimation();

  return (
    <section id="features" className="relative py-24 lg:py-28 bg-[var(--bg-primary)] overflow-hidden" data-testid="features-section">
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-30" aria-hidden="true" />

      <div ref={sectionRef} className="relative max-w-7xl mx-auto px-6">
        {/* Centered header */}
        <div className="text-center max-w-3xl mx-auto mb-14 lg:mb-16">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[12px] font-semibold uppercase tracking-[0.14em] mb-6"
            style={{ background: 'color-mix(in oklab, var(--color-primary) 14%, transparent)', color: 'var(--color-primary)', fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
            The Platform · 14 Units
          </span>
          <h2 className={`text-4xl sm:text-5xl lg:text-[56px] text-[var(--color-text)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.03em' }}>
            One platform.{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 500, color: 'var(--color-primary)' }}>Your</span>{' '}
            entire finance career journey.
          </h2>
          <p className="mt-6 text-[14.5px] font-bricolage text-[var(--color-text-muted)] leading-relaxed">
            Everything you need to go from student to hired analyst — all fourteen units, in one place,
            personalised to you.
          </p>
        </div>

        {/* 14 units arranged around the central logo hub */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-y-7 gap-x-10 lg:gap-x-14">
          <div className="flex flex-col gap-6 lg:gap-7 order-2 lg:order-1">
            {LEFT.map((f, i) => <Node key={f.title} f={f} align="right" isVisible={isVisible} delay={0.12 + i * 0.05} />)}
          </div>
          <div className="order-1 lg:order-2 py-4"><Hub /></div>
          <div className="flex flex-col gap-6 lg:gap-7 order-3">
            {RIGHT.map((f, i) => <Node key={f.title} f={f} align="left" isVisible={isVisible} delay={0.12 + i * 0.05} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
