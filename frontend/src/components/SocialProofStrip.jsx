import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* Social-proof strip beneath the hero. Truthful framing only: the companies
 * are those the curriculum builds models on; the roles are the target roles
 * stated across the site. No placement/alumni claims. */

const COMPANIES = ['RELIANCE', 'HDFC BANK', 'INFOSYS', 'TCS', 'TATA STEEL', 'ICICI BANK'];
const ROLES = [
  { r: 'Equity Research', d: 'Coverage notes & valuation', k: 'I' },
  { r: 'Investment Banking', d: 'LBO, DCF & deal models', k: 'II' },
  { r: 'Asset Management', d: 'Portfolio & risk analysis', k: 'III' },
];

export default function SocialProofStrip() {
  const [ref, isVisible] = useScrollAnimation();
  const fade = isVisible ? 'animate-fade-up visible' : 'animate-fade-up';

  return (
    <section className="relative py-16 lg:py-20" data-testid="social-proof-strip">
      <div ref={ref} className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className={`grid lg:grid-cols-12 gap-6 lg:gap-10 items-end ${fade}`}>
          <p className="lv-chapter lg:col-span-4" data-testid="social-proof-eyebrow">BUILT ON REAL MARKETS</p>
          <p className="lg:col-span-8 text-[15px] lg:text-[16px] leading-relaxed max-w-2xl" style={{ color: 'var(--color-text-secondary)' }}>
            You practise on the Indian companies you&rsquo;ll actually cover as an analyst:
            Ind AS statements, SEBI filings and NSE/BSE data.
          </p>
        </div>
      </div>

      <div className={`mt-10 py-6 border-y ${fade}`} style={{ borderColor: 'var(--color-border)', animationDelay: '0.1s' }} data-testid="social-proof-companies">
        <div className="vv-company-grid">
          {COMPANIES.map((c, i) => (
            <span key={c} className="vv-company-name" data-testid={`curriculum-company-${i}`}>
              {c}<small>NSE</small>
            </span>
          ))}
        </div>
      </div>

      {/* role columns */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 mt-12">
        <div className="grid grid-cols-1 sm:grid-cols-3" data-testid="social-proof-roles">
          {ROLES.map((role, i) => (
            <div
              key={role.r}
              className={`lv-column py-6 sm:py-2 sm:px-8 first:pl-0 last:pr-0 flex gap-5 ${fade}`}
              style={{ animationDelay: `${0.15 + i * 0.08}s` }}
              data-testid={`social-proof-role-${i}`}
            >
              <span className="lv-serif text-[34px] leading-none" style={{ color: 'var(--color-primary)', minWidth: 40 }}>{role.k}</span>
              <div>
                <div className="lv-folio mb-1.5">Prep for</div>
                <h3 className="text-[22px] text-[var(--color-text)]">{role.r}</h3>
                <p className="mt-1 text-[13.5px]" style={{ color: 'var(--color-text-muted)' }}>{role.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
