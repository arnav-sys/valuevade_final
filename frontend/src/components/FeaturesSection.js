import { BookOpen, Briefcase, Mic, BarChart3, Award, Gamepad2, BookMarked, Shield, Sparkles, FileText, Brain, Hammer, CalendarRange, Compass } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* "One platform" section, Sep 2026 redesign: the orbit was retired for a
 * dossier wall, 14 clipped-corner cards on a staggered two-column ladder next
 * to a sticky editorial rail. */

const features = [
  { icon: Compass, title: 'Personalised AI Roadmap', short: 'Maps your exact gap and sequences your path.' },
  { icon: BookOpen, title: 'Interactive Notes', short: 'Clickable, visual, first-principles, no PDF dumps.' },
  { icon: Sparkles, title: 'Pari, AI Tutor', short: 'In-context help on any note, quiz or simulation.' },
  { icon: Briefcase, title: '239 Hands-on Sessions', short: 'Concept + auto-graded simulation, every session.' },
  { icon: Mic, title: 'AI Mock Interviews', short: '3 rounds, voice or text, real verdict + feedback.' },
  { icon: CalendarRange, title: 'Study Planner', short: 'Auto-schedules sessions around your timetable.' },
  { icon: Hammer, title: 'AI Capstone Project', short: 'A portfolio recruiters can actually open.' },
  { icon: Award, title: 'NISM Prep + Certificate', short: 'Series XV prep and a completion certificate.' },
  { icon: FileText, title: 'Resume + LinkedIn Prep', short: 'Recruiter-tuned CV and an outreach playbook.' },
  { icon: Shield, title: 'AI-Proof Skills', short: 'Python and AI-assisted modelling built in.' },
  { icon: Brain, title: 'Top-Analyst Mindset', short: "The judgment and habits AI can't replace." },
  { icon: BarChart3, title: 'Adaptive Quizzes', short: 'Find your weak spots and patch them.' },
  { icon: BookMarked, title: 'CV-Ready Projects', short: 'Every artefact lands on your resume.' },
  { icon: Gamepad2, title: 'Gamified XP', short: 'Streaks, levels and momentum.' },
];

const FeatureCard = ({ f, i, visible }) => {
  const Icon = f.icon;
  return (
    <article
      className={`lv-dossier ${visible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
      style={{ animationDelay: `${0.06 + (i % 2) * 0.05 + Math.floor(i / 2) * 0.05}s` }}
      data-testid={`feature-node-${i}`}
    >
      <div className="lv-dossier__inner">
        <span className="lv-dossier__spine" aria-hidden="true" />
        <span className="lv-dossier__num" aria-hidden="true">
          {String(i + 1).padStart(2, '0')}
        </span>
        <span className="lv-dossier__icon">
          <Icon size={19} strokeWidth={1.9} />
        </span>
        <h3 className="lv-dossier__title">{f.title}</h3>
        <p className="lv-dossier__copy">{f.short}</p>
      </div>
    </article>
  );
};

export default function FeaturesSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  const colA = features.filter((_, i) => i % 2 === 0);
  const colB = features.filter((_, i) => i % 2 === 1);

  return (
    <section id="features" className="relative py-24 lg:py-32 bg-[var(--bg-primary)]" data-testid="features-section">
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-25" aria-hidden="true" />

      <div ref={sectionRef} className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-[minmax(0,34%)_minmax(0,1fr)] gap-12 lg:gap-16">
          {/* Sticky editorial rail */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <span
              className="inline-flex items-center px-4 py-1.5 rounded-full text-[12px] font-semibold uppercase tracking-[0.14em] mb-6"
              style={{
                background: 'color-mix(in oklab, var(--color-primary) 14%, transparent)',
                color: 'var(--color-primary)',
                fontFamily: '"Space Grotesk", Inter, sans-serif',
              }}
              data-testid="features-eyebrow"
            >
              The Platform · 14 Units
            </span>
            <h2
              className={`text-4xl sm:text-5xl lg:text-[52px] text-[var(--color-text)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
              style={{ animationDelay: '0.08s', lineHeight: 1.04, letterSpacing: '-0.03em' }}
            >
              One platform.{' '}
              <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 500, color: 'var(--color-primary)' }}>
                Your
              </span>{' '}
              entire finance career journey.
            </h2>
            <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />
            <p className="mt-6 text-[14.5px] font-bricolage text-[var(--color-text-muted)] leading-relaxed max-w-md">
              Fourteen units, one file on you. Every card below is a working part of the product, not a
              feature promise, and they all read from the same personalised plan.
            </p>
            <Link
              to="/signup"
              className="lv-cta mt-8 inline-flex"
              data-testid="features-cta"
            >
              Open your file
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          </div>

          {/* Dossier wall */}
          <div className="grid sm:grid-cols-2 gap-4 lg:gap-5" data-testid="features-wall">
            <div className="flex flex-col gap-4 lg:gap-5">
              {colA.map((f, k) => (
                <FeatureCard key={f.title} f={f} i={k * 2} visible={isVisible} />
              ))}
            </div>
            <div className="flex flex-col gap-4 lg:gap-5 sm:pt-10">
              {colB.map((f, k) => (
                <FeatureCard key={f.title} f={f} i={k * 2 + 1} visible={isVisible} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
