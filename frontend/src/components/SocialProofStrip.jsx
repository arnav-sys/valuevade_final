import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* Social-proof strip beneath the hero. Truthful framing only:
 * the companies are those the curriculum builds models on (per hero/features
 * copy: "Build a DCF on Reliance. Ratio-analyse HDFC Bank. Model an LBO on
 * Tata Steel."), and the roles are the target roles stated across the site.
 * No placement/alumni claims are made. */

const COMPANIES = ['RELIANCE', 'HDFC BANK', 'INFOSYS', 'TCS', 'TATA STEEL', 'ICICI BANK'];
const ROLES = [
  { r: 'Equity Research', d: 'Coverage notes & valuation' },
  { r: 'Investment Banking', d: 'LBO, DCF & deal models' },
  { r: 'Asset Management', d: 'Portfolio & risk analysis' },
];

export default function SocialProofStrip() {
  const [ref, isVisible] = useScrollAnimation();

  return (
    <section
      className="relative bg-[var(--bg-primary)] py-16 lg:py-20"
      data-testid="social-proof-strip"
    >
      <div ref={ref} className="max-w-6xl mx-auto px-6">
        {/* Companies row */}
        <div className={`text-center ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
          <p className="lv-chapter justify-center mb-6" data-testid="social-proof-eyebrow">
            BUILT ON REAL MARKETS
          </p>
          <p className="font-bricolage text-[var(--color-text-muted)] text-[15px] lg:text-base mb-8 max-w-2xl mx-auto">
            You practise on the Indian companies you&rsquo;ll actually cover as an analyst &mdash;
            Ind AS statements, SEBI filings and NSE/BSE data.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 lg:gap-x-12" data-testid="social-proof-companies">
            {COMPANIES.map((c) => (
              <span
                key={c}
                className="font-bold tracking-[0.12em] text-[var(--color-text-secondary)] text-sm lg:text-[15px] opacity-80 hover:opacity-100 transition-opacity"
                style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="my-12 h-px w-full bg-[var(--color-border)]" aria-hidden="true" />

        {/* Roles row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 lg:gap-6" data-testid="social-proof-roles">
          {ROLES.map((role, i) => (
            <div
              key={role.r}
              className={`lv-panel px-6 py-6 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
              style={{ animationDelay: `${0.1 + i * 0.08}s` }}
              data-testid={`social-proof-role-${i}`}
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-primary)] font-semibold mb-2"
                style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
                Prep for
              </div>
              <h3 className="text-xl text-[var(--color-text)] mb-1" style={{ letterSpacing: '-0.02em' }}>
                {role.r}
              </h3>
              <p className="text-[13.5px] text-[var(--color-text-muted)] font-bricolage">
                {role.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
