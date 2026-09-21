import { Compass, Layers, Cpu, Award, Mic, Wrench, FileText, Sparkles } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* Gaps section, Jun 2026 editorial rebuild: a sticky headline column beside
 * a hairline "ledger" of the eight gaps (folio, tag, title, points, body). */

const problems = [
  { idx: '01', tag: 'ROADMAP', icon: Compass, title: 'No clear roadmap',
    points: ['Theory over skills', 'No target-role path', 'Interviews test doing'],
    body: "B.Com and BBA syllabi test theory; analyst interviews test whether you can build a model, defend a valuation and write a coverage note, and nobody maps that path for you." },
  { idx: '02', tag: 'MARKET', icon: Layers, title: 'Built for the wrong market',
    points: ['US GAAP & 10-Ks', 'S&P 500 case studies', 'Not Ind AS / SEBI'],
    body: "Most courses teach US GAAP and S&P 500 case studies. Indian analysts work with Ind AS, SEBI filings and NSE/BSE data, and Indian interviews test exactly that." },
  { idx: '03', tag: 'AI', icon: Cpu, title: 'AI is reshaping entry roles',
    points: ['Screening automated', 'First-draft models automated', 'Direct AI, or compete'],
    body: "Screening, data pulls and first-draft models are being automated. The juniors still getting hired direct AI tools, they don't compete with them." },
  { idx: '04', tag: 'PROOF', icon: Award, title: 'No certs or real projects',
    points: ['Video library only', 'Certificate nobody checks', 'Nothing to show'],
    body: "Most courses hand you a video library and a certificate nobody verifies, but no graded, portfolio-grade projects a recruiter can actually open and judge." },
  { idx: '05', tag: 'INTERVIEW', icon: Mic, title: 'No mock-interview practice',
    points: ['Revise, never rehearse', 'No live grilling', 'No real feedback'],
    body: "You revise theory endlessly but never rehearse the real thing, a live analyst grilling you on your DCF, your assumptions and your thesis under pressure." },
  { idx: '06', tag: 'PRACTICE', icon: Wrench, title: 'No hands-on learning',
    points: ['Passive lectures', "Doesn't stick", 'No real building'],
    body: "Passive lectures don't build skill. Without building models, analysing real filings and defending your own numbers, none of it survives a real interview." },
  { idx: '07', tag: 'CAREER', icon: FileText, title: 'No resume / LinkedIn prep',
    points: ['No ATS resume', 'No outreach playbook', 'No soft-skill coaching'],
    body: "Even skilled students get filtered out, no ATS-ready resume, no LinkedIn outreach playbook, and no coaching on how to communicate like an analyst." },
  { idx: '08', tag: 'PERSONAL', icon: Sparkles, title: 'Generic, one-size-fits-all',
    points: ['Same syllabus for all', 'Ignores your level', 'Wastes your weeks'],
    body: "Everyone gets the same syllabus regardless of target role or current level, so you waste weeks on things you know and skip the gaps that get you hired." },
];

export default function ProblemSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  const fade = isVisible ? 'animate-fade-up visible' : 'animate-fade-up';

  return (
    <section className="relative py-24 lg:py-28" data-testid="problem-section">
      <div ref={sectionRef} className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16">
          <div className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <p className={`lv-chapter mb-6 ${fade}`}>THE GAP NO ONE TALKS ABOUT</p>
            <h2
              className={`text-4xl sm:text-5xl lg:text-[56px] text-[var(--color-text)] ${fade}`}
              style={{ animationDelay: '0.1s', lineHeight: 1.02 }}
            >
              Your college prepared you for exams. <span className="lv-italic">Not</span> for a finance career.
            </h2>
            <div className="mt-8 lv-rule-ink w-16" aria-hidden="true" />
            <p className={`mt-6 text-[17px] leading-snug lv-serif ${fade}`} style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--color-primary)', animationDelay: '0.2s' }} data-testid="problem-transition-line">
              Valuevade was built to close every one of these gaps at once.
            </p>
            <p className="lv-folio mt-10 hidden lg:block">08 gaps · indexed</p>
          </div>

          <div className="lg:col-span-8" data-testid="gaps-ledger">
            {problems.map((p, i) => {
              const Icon = p.icon;
              return (
                <article
                  key={p.title}
                  className={`lv-gap ${fade}`}
                  style={{ animationDelay: `${0.1 + i * 0.05}s` }}
                  data-testid={`problem-card-${i}`}
                >
                  <div className="lv-gap__idx">{p.idx}</div>
                  <div>
                    <div className="flex items-center gap-2 lv-folio">
                      <Icon size={13} strokeWidth={1.8} style={{ color: 'var(--color-primary)' }} />
                      {p.tag}
                    </div>
                    <h3 className="mt-2 text-[24px] text-[var(--color-text)]" style={{ lineHeight: 1.12 }}>{p.title}</h3>
                    <div className="lv-gap__pts mt-3">
                      {p.points.map((pt) => <span key={pt}>{pt}</span>)}
                    </div>
                  </div>
                  <p className="col-start-2 lg:col-start-3 mt-4 lg:mt-0 text-[14px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    {p.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
