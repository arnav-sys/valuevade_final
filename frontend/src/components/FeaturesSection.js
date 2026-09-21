import { BookOpen, Briefcase, Mic, BarChart3, Award, Gamepad2, BookMarked, Shield, Sparkles, FileText, Brain, Hammer, CalendarRange, Compass } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* "One platform" section (redesigned Jun 2026), all 14 units orbit the central
 * Valuevade logo hub in a full ring (desktop). Falls back to a compact 2-col
 * grid on smaller screens. Hub is an original CSS/SVG graphic. */

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

const N = features.length;
const SIZE = 1040;
const C = SIZE / 2;
const R = 450;

function Hub({ size = 'lg' }) {
  const big = size === 'lg';
  return (
    <div className={`relative ${big ? 'w-56 h-56' : 'w-40 h-40'} flex items-center justify-center`} aria-hidden="true">
      <span className="lv-hub-ring" style={{ animationDelay: '0s' }} />
      <span className="lv-hub-ring" style={{ animationDelay: '1.3s' }} />
      <span className="lv-hub-ring" style={{ animationDelay: '2.6s' }} />
      <div className={`relative ${big ? 'w-40 h-40' : 'w-32 h-32'} rounded-full flex items-center justify-center`}
        style={{ background: 'radial-gradient(circle at 50% 35%, rgba(36,107,253,0.30), rgba(10,15,28,0.92))', border: '1px solid color-mix(in oklab, var(--color-primary) 45%, transparent)', boxShadow: '0 0 70px -8px rgba(36,107,253,0.55)' }}>
        <img src="/valuevade-logo.svg" alt="Valuevade" className={`${big ? 'w-20 h-20' : 'w-16 h-16'} object-contain lv-hub-logo`} />
      </div>
    </div>
  );
}

export default function FeaturesSection() {
  const [sectionRef, isVisible] = useScrollAnimation();

  const positions = features.map((_, i) => {
    const ang = (-90 + i * (360 / N)) * (Math.PI / 180);
    return { x: C + R * Math.cos(ang), y: C + R * Math.sin(ang) };
  });

  return (
    <section id="features" className="relative py-24 lg:py-28 bg-[var(--bg-primary)] overflow-hidden" data-testid="features-section">
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-30" aria-hidden="true" />

      <div ref={sectionRef} className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
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
            All fourteen units revolve around one place, personalised to you, from first note to first offer.
          </p>
        </div>
      </div>

      {/* Orbit (desktop), full-bleed so the ring spans the page */}
      <div className="hidden lg:flex justify-center w-full px-6">
        <div className="relative" style={{ width: SIZE, maxWidth: '96vw', aspectRatio: '1 / 1' }} data-testid="platform-orbit">
          {/* Spokes */}
          <svg className="absolute inset-0" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }} aria-hidden="true">
            {positions.map((p, i) => (
              <line key={i} x1={C} y1={C} x2={p.x} y2={p.y} stroke="var(--color-primary)" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="3 5" />
            ))}
            <circle cx={C} cy={C} r={R} fill="none" stroke="var(--color-primary)" strokeOpacity="0.08" strokeWidth="1" />
          </svg>
          {/* Hub */}
          <div className="absolute" style={{ left: `${(C / SIZE) * 100}%`, top: `${(C / SIZE) * 100}%`, transform: 'translate(-50%, -50%)' }}><Hub /></div>
          {/* Nodes */}
          {features.map((f, i) => {
            const Icon = f.icon;
            const p = positions[i];
            return (
              <div key={f.title}
                className={`absolute flex flex-col items-center text-center ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
                style={{ left: `${(p.x / SIZE) * 100}%`, top: `${(p.y / SIZE) * 100}%`, width: 150, transform: 'translate(-50%, -50%)', animationDelay: `${0.15 + i * 0.045}s` }}
                data-testid={`feature-node-${i}`}
              >
                <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 lv-feature-node"
                  style={{ background: 'color-mix(in oklab, var(--color-primary) 16%, transparent)', border: '1px solid color-mix(in oklab, var(--color-primary) 32%, transparent)' }}>
                  <Icon size={26} style={{ color: 'var(--color-primary)' }} />
                </span>
                <span className="text-[14.5px] text-[var(--color-text-secondary)] leading-tight font-medium" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>{f.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid fallback (mobile / tablet) */}
      <div className="lg:hidden max-w-7xl mx-auto px-6">
        <div className="flex justify-center mb-10"><Hub size="sm" /></div>
        <div className="grid grid-cols-2 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="lv-panel p-4" data-testid={`feature-node-m-${i}`}>
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3"
                  style={{ background: 'color-mix(in oklab, var(--color-primary) 16%, transparent)', border: '1px solid color-mix(in oklab, var(--color-primary) 32%, transparent)' }}>
                  <Icon size={18} style={{ color: 'var(--color-primary)' }} />
                </span>
                <h3 className="text-[14.5px] text-[var(--color-text)] leading-tight mb-1">{f.title}</h3>
                <p className="text-[12.5px] text-[var(--color-text-muted)] font-bricolage leading-snug">{f.short}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
