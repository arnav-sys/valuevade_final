import { BookOpen, Briefcase, Mic, BarChart3, Award, Gamepad2, BookMarked, Shield, Sparkles, FileText, Brain, Hammer, CalendarRange, Compass, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* "One platform" section, Jun 2026 editorial rebuild: sticky rail beside a
 * hairline quote-board of the 14 units; the CTA takes the final cell. */

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

export default function FeaturesSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  const fade = isVisible ? 'animate-fade-up visible' : 'animate-fade-up';

  return (
    <section id="features" className="relative py-24 lg:py-32" data-testid="features-section">
      <div ref={sectionRef} className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-14">
          <div className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <p className="lv-chapter mb-6" data-testid="features-eyebrow">The Platform · 14 Units</p>
            <h2
              className={`text-4xl sm:text-5xl lg:text-[56px] text-[var(--color-text)] ${fade}`}
              style={{ animationDelay: '0.08s', lineHeight: 1.02 }}
            >
              One platform. <span className="lv-italic">Your</span> entire finance career journey.
            </h2>
            <div className="mt-8 lv-rule-ink w-16" aria-hidden="true" />
            <p className="mt-6 text-[15px] leading-relaxed max-w-md" style={{ color: 'var(--color-text-muted)' }}>
              Fourteen units, one file on you. Every card below is a working part of the product, not a
              feature promise, and they all read from the same personalised plan.
            </p>
          </div>

          <div className={`lg:col-span-8 lv-hairgrid grid-cols-2 lg:grid-cols-3 ${fade}`} style={{ animationDelay: '0.12s' }} data-testid="features-wall">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <article key={f.title} className="lv-unit" data-testid={`feature-node-${i}`}>
                  <div className="lv-unit__top">
                    <span className="lv-folio">{String(i + 1).padStart(2, '0')}</span>
                    <Icon size={20} strokeWidth={1.7} className="lv-unit__icon" />
                  </div>
                  <h3 className="lv-unit__title">{f.title}</h3>
                  <p className="lv-unit__copy">{f.short}</p>
                </article>
              );
            })}
            <Link to="/signup" className="lv-unit lv-unit--cta group" data-testid="features-cta">
              <span className="lv-folio" style={{ color: 'inherit', opacity: 0.6 }}>15 · Next</span>
              <span className="lv-unit__title flex items-center gap-2" style={{ color: 'inherit' }}>
                Open your file
                <ArrowRight size={18} strokeWidth={2.2} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
