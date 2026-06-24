import { useState, lazy, Suspense } from 'react';
import { Lock, Check, Star } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

// Lazy three.js convergence — only loads when the section approaches view.
const FinalCTAConvergence = lazy(() => import('@/components/landing/FinalCTAConvergence'));

export default function FinalCTASection({ onSubmit }) {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sectionRef, isVisible] = useScrollAnimation();
  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !email.trim()) { setError('Please fill in both fields.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email.'); return; }
    setError('');
    setLoading(true);
    try { await onSubmit(firstName.trim(), email.trim()); } catch { setError('Something went wrong. Please try again.'); setLoading(false); }
  };

  return (
    <section
      id="waitlist"
      className="relative py-24 lg:py-32 overflow-hidden light-rays bg-[var(--bg-primary)]"
      data-testid="final-cta-section"
    >
      {/* Particle convergence behind the CTA — gravity-well feel */}
      <Suspense fallback={null}>
        <FinalCTAConvergence mobile={mobile} />
      </Suspense>
      <div ref={sectionRef} className="max-w-3xl mx-auto px-6 relative z-10 text-center">
        <h2 className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text)] leading-tight mb-6 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}>
          Your finance career doesn't<br />start at placement season.
        </h2>

        <p className={`text-[var(--color-text-muted)] font-bricolage text-base lg:text-lg mb-12 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`} style={{ animationDelay: '0.1s' }}>
          It starts the day you decide to stop being generic.
        </p>

        <form
          onSubmit={handleSubmit}
          className={`flex flex-col sm:flex-row gap-3 mb-6 max-w-xl mx-auto relative ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
          style={{ animationDelay: '0.2s' }}
          data-testid="waitlist-form"
        >
          {/* Breathing-glow halo behind the form — particle gravity well anchor */}
          <div
            aria-hidden="true"
            data-testid="final-cta-breathing-halo"
            className="pointer-events-none absolute left-1/2 top-1/2 w-[480px] h-[280px] -z-10"
            style={{
              background: 'radial-gradient(closest-side, rgba(139,92,246,0.45), transparent 70%)',
              filter: 'blur(36px)',
              animation: 'cta-breathe 4.5s ease-in-out infinite',
            }}
          />
          <input type="text" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
            className="flex-1 px-5 py-4 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-faint)] font-bricolage text-sm focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/30 transition-all"
            data-testid="waitlist-first-name-input"
          />
          <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-5 py-4 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-faint)] font-bricolage text-sm focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/30 transition-all"
            data-testid="waitlist-email-input"
          />
          <button type="submit" disabled={loading}
            className="px-6 py-4 rounded-full font-semibold text-white text-sm whitespace-nowrap transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #FF6AC1, #6A5CFF)', boxShadow: '0 0 24px rgba(255, 106, 193, 0.3)' }}
            data-testid="waitlist-submit-btn"
          >
            {loading ? 'Joining...' : 'Claim My Spot →'}
          </button>
        </form>

        {error && <p className="text-red-400 text-sm mb-4 font-bricolage" data-testid="waitlist-error">{error}</p>}

        <p className={`text-[var(--color-text-faint)] text-sm font-bricolage mb-6 ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`} style={{ animationDelay: '0.3s' }}>
          No spam. Early access. Free forever for founding members.
        </p>

        <div className={`flex items-center justify-center gap-6 text-[var(--color-text-faint)] text-xs font-jetbrains ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`} style={{ animationDelay: '0.35s' }} data-testid="trust-row">
          <span className="flex items-center gap-1.5"><Lock size={12} /> Private</span>
          <span className="flex items-center gap-1.5"><Check size={12} /> Free to Join</span>
          <span className="flex items-center gap-1.5"><Star size={12} /> Early Access Perks</span>
        </div>
      </div>
      <style>{`
        @keyframes cta-breathe {
          0%,100% { opacity: 0.45; transform: translate(-50%, -50%) scale(0.94); }
          50%     { opacity: 0.85; transform: translate(-50%, -50%) scale(1.06); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="final-cta-breathing-halo"] { animation: none !important; opacity: 0.55; }
        }
      `}</style>
    </section>
  );
}
