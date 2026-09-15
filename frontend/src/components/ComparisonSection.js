import { Check, Minus } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* Editorial finance / Bloomberg-terminal ComparisonSection (Feb 2026).
 * - Chapter rail §05 // SIDE-BY-SIDE.
 * - Datagrid restyled: sharp corners, mono column headers, hairline rows,
 *   Valuevade column highlighted with a left/right primary rail.
 * - Pricing wedge → lv-panel with mono readout.
 * Content copy and data verbatim from the previous version. */

const COMPETITORS = ['Valuevade', 'WallStreet School', 'IFMC Institute', 'Coursera', 'Imarticus/Upgrad'];

const ROWS = [
  { label: 'AI personalised path',             vv: true, v: [false, false, false, false] },
  { label: 'Live AI tutor (24/7)',             vv: true, v: [false, false, false, false] },
  { label: 'AI-proofing curriculum',           vv: true, v: [false, false, false, false] },
  { label: 'Price',                            vv: '₹4999 lifetime, one-time',   v: ['₹50k–80k', '₹25k–40k', '₹4k–15k/yr', '₹50k–2L'] },
  { label: 'Duration',                         vv: 'Lifetime access · ~2 months at 1 hr/day', v: ['3–6 months', '3–4 months', '6–12 months', '6–18 months'] },
  { label: 'AI mock interviews + feedback',    vv: true, v: ['manual', 'manual', false, 'manual'] },
  { label: 'Simulations',                      vv: '239, auto-graded, Indian companies', v: ['partial', 'partial', false, 'partial'] },
  { label: 'Job-ready portfolio projects',     vv: true, v: ['partial', false, false, 'partial'] },
  { label: 'NISM certification prep',           vv: 'NISM Series XV prep', v: ['partial', 'extra cost', false, 'partial'] },
  { label: 'Resume + LinkedIn guide',          vv: true, v: [false, false, false, 'partial'] },
];

const Cell = ({ value, vv }) => {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Check size={13} strokeWidth={2.5} className={vv ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'} aria-hidden="true" />
        <span className={`font-jetbrains text-[10px] uppercase tracking-[0.16em] ${vv ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>YES</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Minus size={12} strokeWidth={2.5} className="text-[var(--color-text-faint)]" aria-hidden="true" />
        <span className="font-jetbrains text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-faint)]">NO</span>
      </span>
    );
  }
  return <span className={`text-[12.5px] ${vv ? 'text-[var(--color-text)] font-semibold' : 'text-[var(--color-text-muted)]'} font-bricolage`}>{value}</span>;
};

export default function ComparisonSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  return (
    <section
      id="compare"
      className="relative py-24 lg:py-28 bg-[var(--bg-primary)]"
      data-testid="comparison-section"
    >
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-40" aria-hidden="true" />

      <div ref={sectionRef} className="relative max-w-6xl mx-auto px-6">
        {/* Chapter rail */}
        <div className="flex items-center gap-3 mb-10 lg:mb-12">
          <span className="lv-chapter">§05 // BENCHMARK</span>
          <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
          <span className="lv-chapter">SIDE-BY-SIDE · 5 PROVIDERS</span>
        </div>

        <div className="max-w-3xl mb-12 lg:mb-14">
          <p className={`lv-chapter mb-4 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
            SIDE-BY-SIDE
          </p>
          <h2
            className={`font-clash text-4xl sm:text-5xl lg:text-[60px] text-[var(--color-text)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.02em' }}
          >
            Why pay{' '}
            <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-primary)' }}>
              30×
            </span>{' '}
            more for less?
          </h2>
          <p
            className={`mt-5 text-[var(--color-text-muted)] font-bricolage max-w-2xl text-[14.5px] leading-relaxed ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.18s' }}
          >
            We benchmarked Valuevade against the four programs most Indian finance students consider.
          </p>
          <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />
        </div>

        {/* Datagrid — Bloomberg terminal aesthetic */}
        <div
          className={`lv-panel overflow-hidden ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
          style={{ animationDelay: '0.26s' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]" data-testid="comparison-table">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]/60">
                  <th className="px-5 py-3 text-left font-jetbrains text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-faint)]">
                    Feature
                  </th>
                  {COMPETITORS.map((c, i) => (
                    <th
                      key={c}
                      className={`px-4 py-3 text-left font-jetbrains text-[10.5px] uppercase tracking-[0.18em] ${
                        i === 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
                      }`}
                      style={i === 0 ? {
                        borderLeft: '1px solid color-mix(in oklab, var(--color-primary) 55%, transparent)',
                        borderRight: '1px solid color-mix(in oklab, var(--color-primary) 55%, transparent)',
                        background: 'color-mix(in oklab, var(--color-primary) 12%, transparent)',
                      } : {}}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, idx) => (
                  <tr key={r.label} className="border-t border-[var(--color-border)]" data-testid={`compare-row-${idx}`}>
                    <td className="px-5 py-3.5 text-[13px] text-[var(--color-text)] font-bricolage">{r.label}</td>
                    <td
                      className="px-4 py-3.5"
                      style={{
                        background: 'color-mix(in oklab, var(--color-primary) 6%, transparent)',
                        borderLeft: '1px solid color-mix(in oklab, var(--color-primary) 40%, transparent)',
                        borderRight: '1px solid color-mix(in oklab, var(--color-primary) 40%, transparent)',
                      }}
                    >
                      <Cell value={r.vv} vv />
                    </td>
                    {r.v.map((v, i) => (
                      <td key={i} className="px-4 py-3.5">
                        <Cell value={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Datagrid footer with source line */}
          <div className="px-5 py-2.5 border-t border-[var(--color-border)] flex items-center justify-between bg-[var(--bg-primary)]/40">
            <span className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
              SRC · PUBLIC LISTINGS · REVIEWED Q1 2026
            </span>
            <span className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
              10 ROWS · 5 COLS
            </span>
          </div>
        </div>

        {/* Pricing wedge — editorial panel */}
        <div
          className={`mt-8 lv-panel px-7 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
          style={{ animationDelay: '0.34s' }}
          data-testid="pricing-wedge"
        >
          <div className="min-w-0">
            <p className="lv-chapter mb-2">THE PRICING WEDGE</p>
            <h3 className="font-clash text-2xl text-[var(--color-text)]" style={{ lineHeight: 1.15 }}>
              Same skills. Same certifications.{' '}
              <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-primary)' }}>
                30× less.
              </span>
            </h3>
            <p className="text-[var(--color-text-muted)] font-bricolage text-[13.5px] mt-2 leading-relaxed">
              WallStreet School ₹50,000 · Imarticus ₹1,20,000 · Valuevade{' '}
              <strong className="text-[var(--color-text)] font-semibold">₹4999 lifetime.</strong>
            </p>
          </div>
          <div className="flex items-center gap-5 shrink-0">
            <div className="text-right">
              <div className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">THEIRS</div>
              <div className="font-jetbrains text-2xl text-[var(--color-text-muted)] line-through mt-1">₹50k+</div>
            </div>
            <div className="w-px h-10 bg-[var(--color-border)]" aria-hidden="true" />
            <div className="text-right">
              <div className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-primary)]">VALUEVADE</div>
              <div className="font-jetbrains text-3xl text-[var(--color-text)] font-bold mt-1">₹4999</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
