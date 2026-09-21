import { Compass, Layers, Cpu, Award, Mic, Wrench, FileText, Sparkles } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* Gaps section (redesigned Jun 2026) — clean 8-card editorial grid on navy,
 * blue accents, no sticky-scroll / 3D. Copy for the first three gaps is
 * verbatim from the previous version; five new gaps added per product brief. */

const problems = [
  {
    idx: '01', tag: 'ROADMAP', icon: Compass,
    title: 'No clear roadmap',
    body: "You know you want equity research, investment banking or asset management — but nobody shows you the exact skills, projects and credentials that get you there. B.Com and BBA syllabi test theory; analyst interviews test whether you can build a model, defend a valuation and write a coverage note.",
  },
  {
    idx: '02', tag: 'MARKET', icon: Layers,
    title: 'Courses built for the wrong market',
    body: "Most online finance courses teach US GAAP, 10-Ks and S&P 500 case studies. Indian analysts work with Ind AS, SEBI filings and NSE/BSE data — and Indian interviews test exactly that.",
  },
  {
    idx: '03', tag: 'AI', icon: Cpu,
    title: 'AI is changing entry-level finance',
    body: "Screening, data pulls and first-draft models are being automated. The junior analysts still getting hired are the ones who can direct AI tools — not the ones competing with them.",
  },
  {
    idx: '04', tag: 'PROOF', icon: Award,
    title: 'No certification or real-world projects',
    body: "Most courses hand you a video library and a certificate nobody verifies — but no graded, portfolio-grade projects a recruiter can actually open and judge. You finish with nothing real to show.",
  },
  {
    idx: '05', tag: 'INTERVIEW', icon: Mic,
    title: 'No AI mock-interview practice',
    body: "You revise theory endlessly but never rehearse the real thing — a live analyst grilling you on your DCF, your assumptions and your thesis under time pressure, then telling you exactly where you fell short.",
  },
  {
    idx: '06', tag: 'PRACTICE', icon: Wrench,
    title: 'No practical, hands-on learning',
    body: "Passive lectures don't build skill. Without building models, analysing real filings and defending your own numbers, none of it survives contact with an actual interview.",
  },
  {
    idx: '07', tag: 'CAREER', icon: FileText,
    title: 'No resume, LinkedIn or soft-skill prep',
    body: "Even skilled students get filtered out — no ATS-ready resume, no LinkedIn outreach playbook, and no coaching on how to communicate like an analyst in the room.",
  },
  {
    idx: '08', tag: 'PERSONAL', icon: Sparkles,
    title: 'Generic, one-size-fits-all courses',
    body: "Everyone gets the same syllabus regardless of their target role or current level — so you waste weeks on things you already know and skip the exact gaps that would get you hired.",
  },
];

export default function ProblemSection() {
  const [sectionRef, isVisible] = useScrollAnimation();

  return (
    <section
      className="relative bg-[var(--bg-primary)] py-24 lg:py-28"
      data-testid="problem-section"
    >
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-30" aria-hidden="true" />

      <div ref={sectionRef} className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-12 lg:mb-14">
          <p className={`lv-chapter mb-5 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            THE GAP NO ONE TALKS ABOUT
          </p>
          <h2
            className={`text-4xl sm:text-5xl lg:text-[56px] text-[var(--color-text)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.03em' }}
          >
            Your college prepared you for exams.{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 500, color: 'var(--color-primary)' }}>
              Not
            </span>{' '}
            for a finance career.
          </h2>
          <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {problems.map((problem, i) => {
            const Icon = problem.icon;
            return (
              <article
                key={problem.title}
                className={`lv-panel p-6 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
                style={{ animationDelay: `${0.15 + i * 0.06}s` }}
                data-testid={`problem-card-${i}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl"
                    style={{
                      background: 'color-mix(in oklab, var(--color-primary) 14%, transparent)',
                      border: '1px solid color-mix(in oklab, var(--color-primary) 30%, transparent)',
                    }}
                  >
                    <Icon size={20} style={{ color: 'var(--color-primary)' }} />
                  </span>
                  <span className="text-2xl font-bold text-[var(--color-text-faint)]" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
                    {problem.idx}
                  </span>
                </div>
                <h3 className="text-lg text-[var(--color-text)] mb-2" style={{ lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                  {problem.title}
                </h3>
                <p className="text-[13px] text-[var(--color-text-muted)] font-bricolage leading-relaxed">
                  {problem.body}
                </p>
              </article>
            );
          })}
        </div>

        <p
          className={`mt-10 text-[var(--color-primary)] font-bricolage text-base lg:text-lg ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
          style={{ animationDelay: '0.6s', fontStyle: 'italic' }}
          data-testid="problem-transition-line"
        >
          Valuevade was built to close every one of these gaps at once.
        </p>
      </div>
    </section>
  );
}
