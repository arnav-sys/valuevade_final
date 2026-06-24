import { Check, Minus } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { ComparisonSplitDecor } from '@/components/landing/CinematicSections';

/* Comparison + Pricing Wedge — light, minimal, matches the existing
 * landing aesthetic (var(--bg-primary), glass-card, primary accent). */

const COMPETITORS = ['Valuevade', 'WallStreet School', 'IFMC Institute', 'Coursera', 'Imarticus/Upgrad'];

const ROWS = [
  { label: 'AI personalised path',             vv: true, v: [false, false, false, false] },
  { label: 'Live AI tutor (24/7)',             vv: true, v: [false, false, false, false] },
  { label: 'AI-proofing curriculum',           vv: true, v: [false, false, false, false] },
  { label: 'Price',                            vv: '₹1,500 lifetime',     v: ['₹50k–80k', '₹25k–40k', '₹4k–15k/yr', '₹50k–2L'] },
  { label: 'Duration',                         vv: '4–12 weeks · self-paced', v: ['3–6 months', '3–4 months', '6–12 months', '6–18 months'] },
  { label: 'AI mock interviews + feedback',    vv: true, v: ['manual', 'manual', false, 'manual'] },
  { label: 'Real Indian-market simulations',   vv: true, v: ['partial', 'partial', false, 'partial'] },
  { label: 'Job-ready portfolio projects',     vv: true, v: ['partial', false, false, 'partial'] },
  { label: 'NISM + CFI certifications',        vv: true, v: ['partial', 'extra cost', false, 'partial'] },
  { label: 'Resume + LinkedIn guide',          vv: true, v: [false, false, false, 'partial'] },
];

const Cell = ({ value, vv }) => {
  if (value === true) {
    return <Check size={18} className={vv ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'} aria-label="yes" />;
  }
  if (value === false) {
    return <Minus size={16} className="text-[var(--color-text-faint)]" aria-label="no" />;
  }
  return <span className="text-xs sm:text-sm text-[var(--color-text-muted)]">{value}</span>;
};

export default function ComparisonSection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  return (
    <section
      id="compare"
      className="relative py-24 lg:py-32 bg-[var(--bg-primary)]"
      data-testid="comparison-section"
    >
      <div ref={sectionRef} className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className={`section-label ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>SIDE-BY-SIDE</p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text)] leading-tight ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s' }}
          >
            Why pay 30× more for less?
          </h2>
          <p
            className={`mt-4 text-[var(--color-text-muted)] font-bricolage max-w-2xl mx-auto text-base ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.18s' }}
          >
            We benchmarked Valuevade against the four programs most Indian finance students consider.
          </p>
        </div>

        <ComparisonSplitDecor />

        <div
          className={`glass-card rounded-2xl overflow-hidden ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
          style={{ animationDelay: '0.26s', borderColor: 'rgba(36, 107, 253, 0.15)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]" data-testid="comparison-table">
              <thead>
                <tr className="text-left">
                  <th className="px-6 py-5 text-xs uppercase tracking-wider text-[var(--color-text-faint)] font-medium">Feature</th>
                  {COMPETITORS.map((c, i) => (
                    <th
                      key={c}
                      className={`px-4 py-5 text-xs uppercase tracking-wider font-semibold ${
                        i === 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-faint)]'
                      }`}
                      style={i === 0 ? {
                        background: 'linear-gradient(180deg, rgba(36,107,253,0.06), transparent)',
                        borderLeft: '1px solid rgba(36,107,253,0.18)',
                        borderRight: '1px solid rgba(36,107,253,0.18)',
                      } : {}}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, idx) => (
                  <tr key={r.label} className="border-t border-[var(--color-border)]">
                    <td className="px-6 py-4 text-sm text-[var(--color-text)] font-medium">{r.label}</td>
                    <td
                      className="px-4 py-4 text-sm text-[var(--color-text)] font-semibold"
                      style={{
                        background: idx % 2 === 0
                          ? 'linear-gradient(180deg, rgba(36,107,253,0.04), rgba(36,107,253,0.02))'
                          : 'linear-gradient(180deg, rgba(36,107,253,0.025), rgba(36,107,253,0.01))',
                        borderLeft: '1px solid rgba(36,107,253,0.18)',
                        borderRight: '1px solid rgba(36,107,253,0.18)',
                      }}
                    >
                      <Cell value={r.vv} vv />
                    </td>
                    {r.v.map((v, i) => (
                      <td key={i} className="px-4 py-4 text-sm">
                        <Cell value={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing wedge */}
        <div
          className={`mt-10 glass-card rounded-2xl px-8 py-7 flex flex-col md:flex-row items-center justify-between gap-5 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
          style={{ animationDelay: '0.34s', borderColor: 'rgba(36, 107, 253, 0.15)' }}
          data-testid="pricing-wedge"
        >
          <div>
            <p className="section-label" style={{ animation: 'none' }}>THE PRICING WEDGE</p>
            <h3 className="font-clash text-2xl text-[var(--color-text)] mt-1">
              Same skills. Same certifications. <span className="text-[var(--color-primary)]">30× less.</span>
            </h3>
            <p className="text-[var(--color-text-muted)] font-bricolage text-sm mt-1">
              WallStreet School ₹50,000 · Imarticus ₹1,20,000 · Valuevade <strong className="text-[var(--color-text)]">₹1,500 lifetime.</strong>
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm font-bricolage">
            <div className="text-center">
              <div className="text-xs text-[var(--color-text-faint)] uppercase tracking-wider">Theirs</div>
              <div className="font-clash text-2xl text-[var(--color-text-muted)] line-through">₹50k+</div>
            </div>
            <div className="w-px h-10 bg-[var(--color-border)]" />
            <div className="text-center">
              <div className="text-xs text-[var(--color-primary)] uppercase tracking-wider font-semibold">Valuevade</div>
              <div className="font-clash text-3xl text-[var(--color-text)] font-bold">₹1,500</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
