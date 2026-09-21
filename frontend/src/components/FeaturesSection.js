import { BookOpen, Briefcase, Mic, BarChart3, Award, Gamepad2, BookMarked, Shield, Sparkles, FileText, Brain, Hammer, CalendarRange, Compass, GraduationCap, Rocket } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* "One platform" section (redesigned Jun 2026) — centered intro + four pillars
 * arranged around a central Valuevade hub, then the full feature grid below.
 * The hub is an original CSS/SVG graphic (logo + pulse rings). */

const pillars = [
  { icon: GraduationCap, title: 'Learn from first principles', body: 'Interactive notes, adaptive quizzes and Pari — your 24/7 AI tutor who sees the exact thing you\u2019re stuck on.', align: 'right' },
  { icon: Hammer, title: 'Practise like the job', body: '239 hands-on simulations on real Indian companies, plus three portfolio-grade capstone projects.', align: 'right' },
  { icon: Rocket, title: 'Get hired', body: 'AI mock interviews, an ATS-ready resume review and a LinkedIn outreach playbook — all the way to the offer.', align: 'left' },
  { icon: Shield, title: 'Stay AI-proof', body: 'Python and AI-assisted modelling, a top-analyst mindset and gamified XP so the skills actually stick.', align: 'left' },
];

const features = [
  { idx: 'FT-01', tag: 'ROADMAP', icon: Compass, title: 'Personalised AI Roadmap', body: "Tell it your target role and current skills; it maps your exact gap and sequences your path — personalised to you, not a generic syllabus.", span: 'col-span-12 lg:col-span-7', size: 'large' },
  { idx: 'FT-02', tag: 'AI-PROOF', icon: Shield, title: 'AI-Proof Your Career', body: "Every roadmap includes the AI skills finance professionals need — Python, AI-assisted modelling, prompt engineering. You won't just land the role. You'll be irreplaceable.", span: 'col-span-12 lg:col-span-5', size: 'large' },
  { idx: 'FT-03', tag: 'TUTOR', icon: Sparkles, title: 'Pari — Your 24/7 AI Tutor', body: "Stuck on a DCF cell or a ratio question? Ask Pari. She sees the exact note, quiz or simulation you're on and answers in context.", span: 'col-span-12 sm:col-span-6 lg:col-span-4', size: 'medium' },
  { idx: 'FT-04', tag: 'NOTES', icon: BookOpen, title: 'Interactive Notes', body: "Live, clickable, visual notes covering financial modelling and valuation from first principles — built for beginners, not PDF dumps.", span: 'col-span-12 sm:col-span-6 lg:col-span-4', size: 'medium' },
  { idx: 'FT-05', tag: 'SIMULATIONS', icon: Briefcase, title: '239 hands-on sessions', body: "Build a DCF on Reliance. Ratio-analyse HDFC Bank. Model an LBO on Tata Steel. Every session pairs a concept with a simulation — all auto-graded.", span: 'col-span-12 sm:col-span-6 lg:col-span-4', size: 'medium' },
  { idx: 'FT-06', tag: 'INTERVIEW', icon: Mic, title: 'AI Mock Interviews', body: "3-round equity-research interviewer with voice or text. You speak, it grills, you get verdict + feedback.", span: 'col-span-12 sm:col-span-6 lg:col-span-4', size: 'medium' },
  { idx: 'FT-07', tag: 'PLANNER', icon: CalendarRange, title: 'Study Planner', body: "Pick a deadline or an hours-per-day budget and it auto-schedules all 239 sessions around your college timetable.", span: 'col-span-12 sm:col-span-6 lg:col-span-4', size: 'medium' },
  { idx: 'FT-08', tag: 'CAREER', icon: FileText, title: 'Resume + LinkedIn Networking', body: "Recruiter-tuned resume reviewer, AI-skill highlighting guide, plus the outreach playbook to get warm replies — not just qualified, hired.", span: 'col-span-12 sm:col-span-6 lg:col-span-4', size: 'medium' },
  { idx: 'FT-09', tag: 'CERT', icon: Award, title: 'NISM certification prep, certificate included', body: "Structured preparation for the NISM Series XV exam, mapped into the curriculum — plus Valuevade's own Certificate of Completion.", span: 'col-span-12 sm:col-span-6 lg:col-span-4', size: 'medium' },
  { idx: 'FT-10', tag: 'CAPSTONE', icon: Hammer, title: 'AI Capstone Project', body: "Finish with a full initiating-coverage report, a sector coverage note, and a working AI research copilot — a portfolio recruiters can actually open.", span: 'col-span-12 sm:col-span-6 lg:col-span-4', size: 'medium' },
  { idx: 'FT-11', tag: 'MINDSET', icon: Brain, title: 'Top-Analyst Mindset', body: "Frameworks, soft skills, and thinking habits AI can't replace. Become the analyst who deploys AI.", span: 'col-span-6 lg:col-span-3', size: 'small' },
  { idx: 'FT-12', tag: 'QUIZ', icon: BarChart3, title: 'Adaptive Quizzes', body: 'Quizzes that track weak spots and patch them — automatically.', span: 'col-span-6 lg:col-span-3', size: 'small' },
  { idx: 'FT-13', tag: 'PORTFOLIO', icon: BookMarked, title: 'CV-Ready Projects', body: 'DCF models, credit memos, risk reports — every artefact lands on your resume.', span: 'col-span-6 lg:col-span-3', size: 'small' },
  { idx: 'FT-14', tag: 'XP', icon: Gamepad2, title: 'Gamified XP', body: 'Earn XP, hit streaks, unlock levels. Learning finance should feel like levelling up.', span: 'col-span-6 lg:col-span-3', size: 'small' },
];

function Pillar({ pillar, isVisible, delay }) {
  const Icon = pillar.icon;
  const right = pillar.align === 'right';
  return (
    <div
      className={`flex flex-col ${right ? 'lg:items-end lg:text-right' : 'lg:items-start lg:text-left'} ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
        style={{ background: 'color-mix(in oklab, var(--color-primary) 14%, transparent)', border: '1px solid color-mix(in oklab, var(--color-primary) 30%, transparent)' }}>
        <Icon size={22} style={{ color: 'var(--color-primary)' }} />
      </span>
      <h3 className="text-lg text-[var(--color-text)] mb-1.5" style={{ letterSpacing: '-0.02em' }}>{pillar.title}</h3>
      <p className="text-[13.5px] text-[var(--color-text-muted)] font-bricolage leading-relaxed max-w-xs">{pillar.body}</p>
    </div>
  );
}

function Hub() {
  return (
    <div className="relative w-52 h-52 lg:w-60 lg:h-60 mx-auto flex items-center justify-center shrink-0" aria-hidden="true">
      <span className="lv-hub-ring" style={{ animationDelay: '0s' }} />
      <span className="lv-hub-ring" style={{ animationDelay: '1.3s' }} />
      <span className="lv-hub-ring" style={{ animationDelay: '2.6s' }} />
      <div className="relative w-28 h-28 lg:w-32 lg:h-32 rounded-full flex items-center justify-center"
        style={{ background: 'radial-gradient(circle at 50% 35%, rgba(36,107,253,0.28), rgba(10,15,28,0.9))', border: '1px solid color-mix(in oklab, var(--color-primary) 45%, transparent)', boxShadow: '0 0 60px -10px rgba(36,107,253,0.5)' }}>
        <img src="/valuevade-logo.svg" alt="Valuevade" className="w-12 h-12 lg:w-14 lg:h-14 object-contain" />
      </div>
    </div>
  );
}

export default function FeaturesSection() {
  const [sectionRef, isVisible] = useScrollAnimation();

  return (
    <section id="features" className="relative py-24 lg:py-28 bg-[var(--bg-primary)]" data-testid="features-section">
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-30" aria-hidden="true" />

      <div ref={sectionRef} className="relative max-w-7xl mx-auto px-6">
        {/* Centered header */}
        <div className="text-center max-w-3xl mx-auto mb-14 lg:mb-16">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[12px] font-semibold uppercase tracking-[0.14em] mb-6"
            style={{ background: 'color-mix(in oklab, var(--color-primary) 14%, transparent)', color: 'var(--color-primary)', fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
            The Platform
          </span>
          <h2 className={`text-4xl sm:text-5xl lg:text-[56px] text-[var(--color-text)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.03em' }}>
            One platform.{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 500, color: 'var(--color-primary)' }}>Your</span>{' '}
            entire finance career journey.
          </h2>
          <p className="mt-6 text-[14.5px] font-bricolage text-[var(--color-text-muted)] leading-relaxed">
            Everything you need to go from student to hired analyst — notes, simulations, an AI tutor,
            mock interviews, capstones and career prep — in one place, personalised to you.
          </p>
        </div>

        {/* Pillars around the hub */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-10 lg:gap-14 mb-20 lg:mb-24">
          <div className="flex flex-col gap-10 order-2 lg:order-1">
            <Pillar pillar={pillars[0]} isVisible={isVisible} delay={0.15} />
            <Pillar pillar={pillars[1]} isVisible={isVisible} delay={0.25} />
          </div>
          <div className="order-1 lg:order-2"><Hub /></div>
          <div className="flex flex-col gap-10 order-3">
            <Pillar pillar={pillars[2]} isVisible={isVisible} delay={0.2} />
            <Pillar pillar={pillars[3]} isVisible={isVisible} delay={0.3} />
          </div>
        </div>

        {/* Full feature grid */}
        <div className="text-center mb-8">
          <p className="lv-chapter justify-center">EVERYTHING INCLUDED · 14 UNITS</p>
        </div>
        <div className="grid grid-cols-12 gap-3 lg:gap-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className={`${feature.span} lv-panel lv-feature-card-hover ${feature.size === 'large' ? 'p-7' : feature.size === 'medium' ? 'p-5' : 'p-4'} ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
                style={{ animationDelay: `${0.1 + i * 0.04}s` }}
                data-testid={`feature-card-${i}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  {Icon && (
                    <span className={`inline-flex items-center justify-center rounded-xl ${feature.size === 'small' ? 'w-9 h-9' : 'w-11 h-11'}`}
                      style={{ background: 'color-mix(in oklab, var(--color-primary) 14%, transparent)', border: '1px solid color-mix(in oklab, var(--color-primary) 30%, transparent)' }}>
                      <Icon size={feature.size === 'small' ? 16 : 20} style={{ color: 'var(--color-primary)' }} />
                    </span>
                  )}
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-faint)] font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
                    {feature.tag}
                  </span>
                </div>
                <h3 className={`text-[var(--color-text)] mb-2 ${feature.size === 'large' ? 'text-2xl' : feature.size === 'medium' ? 'text-lg' : 'text-[15px]'}`} style={{ lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                  {feature.title}
                </h3>
                <p className={`text-[var(--color-text-muted)] font-bricolage leading-relaxed ${feature.size === 'small' ? 'text-xs' : 'text-[13.5px]'}`}>
                  {feature.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
