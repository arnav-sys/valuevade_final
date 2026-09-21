import { LineChart, FileCheck2, BarChart3, Layers, Bot } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* Practical Skills — the modular, portfolio-grade projects students actually
 * build, shown as a bento of cards with small original vignettes. Dark navy +
 * blue to stay cohesive with the rest of the landing. All content is Valuevade's
 * own (real Indian companies, Ind AS) — vignettes are original illustrations. */

/* ---- vignettes (pure JSX, original) ---- */
function DcfVignette() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--bg-secondary)] p-3 w-full" aria-hidden="true">
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 16 }).map((_, i) => {
          const hot = i === 13;
          return <div key={i} className="h-5 rounded"
            style={{ background: hot ? 'var(--color-primary)' : 'color-mix(in oklab, var(--color-text) 8%, transparent)' }} />;
        })}
      </div>
      <div className="flex items-center justify-between mt-3 text-[11px]" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
        <span className="text-[var(--color-text-muted)]">Enterprise value</span>
        <span className="text-[var(--color-primary)] font-bold">₹18.4L Cr</span>
      </div>
    </div>
  );
}
function CoverageVignette() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--bg-secondary)] p-3 w-full" aria-hidden="true">
      <div className="flex items-center justify-between mb-2">
        <div className="h-2 w-20 rounded bg-[color-mix(in_oklab,var(--color-text)_14%,transparent)]" />
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: 'var(--color-primary)' }}>BUY</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-2 w-full rounded bg-[color-mix(in_oklab,var(--color-text)_8%,transparent)]" />
        <div className="h-2 w-4/5 rounded bg-[color-mix(in_oklab,var(--color-text)_8%,transparent)]" />
      </div>
      <div className="flex items-center justify-between mt-3 text-[11px]" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
        <span className="text-[var(--color-text-muted)]">Target price</span>
        <span className="text-[var(--color-text)] font-bold">₹1,540</span>
      </div>
    </div>
  );
}
function RatioVignette() {
  const bars = [45, 70, 55, 90, 62];
  return (
    <div className="flex items-end gap-2 h-16 mt-1" aria-hidden="true">
      {bars.map((h, i) => (
        <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 3 ? 'var(--color-primary)' : 'color-mix(in oklab, var(--color-primary) 32%, transparent)' }} />
      ))}
    </div>
  );
}
function LboVignette() {
  return (
    <div className="space-y-2 mt-1" aria-hidden="true">
      {['Entry', 'Debt schedule', 'Exit · IRR'].map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: 'var(--color-primary)' }}>{i + 1}</span>
          <div className="h-2 rounded bg-[color-mix(in_oklab,var(--color-text)_10%,transparent)]" style={{ width: `${70 - i * 12}%` }} />
        </div>
      ))}
    </div>
  );
}
function CopilotVignette() {
  return (
    <div className="space-y-2 mt-1" aria-hidden="true">
      <div className="ml-auto w-4/5 rounded-lg rounded-tr-none px-2.5 py-1.5 text-[10px] text-white" style={{ background: 'var(--color-primary)' }}>Summarise this filing</div>
      <div className="w-4/5 rounded-lg rounded-tl-none px-2.5 py-1.5 text-[10px] text-[var(--color-text-secondary)] border border-[var(--color-border)] bg-[var(--bg-secondary)]">Revenue +14% YoY, margins steady…</div>
    </div>
  );
}

const projects = [
  { icon: LineChart, tag: 'Valuation', title: 'Build a full DCF model', body: 'Build a discounted-cash-flow valuation on Reliance from its Ind AS statements — forecasts, WACC, terminal value and a defensible fair value.', span: 'sm:col-span-7', Vignette: DcfVignette },
  { icon: FileCheck2, tag: 'Research', title: 'Initiating-coverage report', body: 'Write a full coverage note with a rating, target price and investment thesis — the kind a desk actually publishes.', span: 'sm:col-span-5', Vignette: CoverageVignette },
  { icon: BarChart3, tag: 'Analysis', title: 'Financial ratio analysis', body: 'Ratio-analyse HDFC Bank across profitability, leverage and efficiency, then defend what the numbers mean.', span: 'sm:col-span-4', Vignette: RatioVignette },
  { icon: Layers, tag: 'Deals', title: 'LBO & M&A model', body: 'Model an LBO on Tata Steel with debt schedules and returns — and read the story the IRR tells.', span: 'sm:col-span-4', Vignette: LboVignette },
  { icon: Bot, tag: 'AI Capstone', title: 'AI research copilot', body: 'Build a working AI copilot that pulls filings and drafts first-cut notes — proof you direct AI, not compete with it.', span: 'sm:col-span-4', Vignette: CopilotVignette },
];

export default function PracticalSkillsSection() {
  const [ref, isVisible] = useScrollAnimation();

  return (
    <section id="practical-skills" className="relative py-24 lg:py-28 bg-[var(--bg-secondary)]" data-testid="practical-skills-section">
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-25" aria-hidden="true" />
      <div ref={ref} className="relative max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mb-12 lg:mb-14">
          <p className={`lv-chapter mb-5 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>PRACTICAL SKILLS</p>
          <h2 className={`text-4xl sm:text-5xl lg:text-[56px] text-[var(--color-text)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.03em' }}>
            Skills you actually build.{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 500, color: 'var(--color-primary)' }}>On real projects.</span>
          </h2>
          <p className="mt-6 text-[14.5px] font-bricolage text-[var(--color-text-muted)] max-w-2xl leading-relaxed">
            Every module ends in a portfolio-grade project on a real Indian company — not a quiz score, but something a recruiter can open.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 lg:gap-5">
          {projects.map((p, i) => {
            const Icon = p.icon;
            const V = p.Vignette;
            return (
              <article key={p.title}
                className={`${p.span} lv-panel lv-feature-card-hover p-6 flex flex-col ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
                style={{ animationDelay: `${0.15 + i * 0.07}s` }}
                data-testid={`practical-project-${i}`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{ background: 'color-mix(in oklab, var(--color-primary) 14%, transparent)', border: '1px solid color-mix(in oklab, var(--color-primary) 30%, transparent)' }}>
                    <Icon size={18} style={{ color: 'var(--color-primary)' }} />
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-faint)] font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>{p.tag}</span>
                </div>
                <h3 className="text-xl text-[var(--color-text)] mb-2" style={{ letterSpacing: '-0.02em', lineHeight: 1.2 }}>{p.title}</h3>
                <p className="text-[13.5px] text-[var(--color-text-muted)] font-bricolage leading-relaxed mb-5">{p.body}</p>
                <div className="mt-auto"><V /></div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
