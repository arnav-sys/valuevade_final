import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtINR } from '../../utils/razorpay';
import { usePaymentFlow } from './usePaymentFlow';
import { Check, Sparkles, Lock, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Pricing cards — 1500 (upfront) + 1700 (post-trial) — driven by
 * /api/payments/eligibility. Server decides which tier is available;
 * the FE just renders cleanly.
 */
export default function PricingCards({ onPaid }) {
  const [data, setData] = useState(null);
  const { startPayment, busy, mockModal } = usePaymentFlow({
    onSuccess: async () => {
      // refresh eligibility
      await loadEligibility();
      onPaid?.();
    },
  });

  const loadEligibility = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(`${API}/api/payments/eligibility`, {
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    });
    if (r.ok) setData(await r.json());
  };

  useEffect(() => { loadEligibility(); }, []);

  if (!data) {
    return (
      <div className="p-8 flex items-center justify-center text-[var(--color-text-muted)]">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading pricing…
      </div>
    );
  }

  if (data.paid) {
    return (
      <div data-testid="pricing-already-paid" className="rounded-2xl p-6 bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center">
        <Check className="w-10 h-10 mx-auto mb-3 text-green-500" />
        <h3 className="text-xl font-semibold text-[var(--color-text)]">You&apos;re already enrolled with lifetime access.</h3>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">No further payment needed.</p>
      </div>
    );
  }

  const showUpfront = !data.free_session_used;
  const showPostTrial = data.free_session_used;
  const benefits = [
    'Lifetime access to all 15+ modules',
    '68 hands-on Excel finance simulations',
    'AI tutor "Pari" — unlimited questions',
    '3-round mock interview capstone',
    'Live news + daily challenges',
    'Earn 20% commission on every referral',
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="pricing-cards">
        {showUpfront && (
          <PricingCard
            tier="upfront"
            highlight
            badge="Save ₹200 — limited"
            title="Pay Upfront"
            price={1500}
            sub="Lock in before sampling session 1"
            benefits={benefits}
            onPay={() => startPayment('upfront')}
            disabled={busy}
            ctaLabel="Pay ₹1,500 Now"
            testid="pricing-upfront-card"
          />
        )}
        {showPostTrial && (
          <PricingCard
            tier="post_trial"
            highlight
            badge="Unlock all sessions"
            title="Continue After Trial"
            price={1700}
            sub="One-time payment, lifetime access"
            benefits={benefits}
            onPay={() => startPayment('post_trial')}
            disabled={busy}
            ctaLabel="Pay ₹1,700 Now"
            testid="pricing-post-trial-card"
          />
        )}
        {showUpfront && (
          <PricingCard
            tier="trial"
            title="Try Free First"
            price={0}
            priceLabel="Free"
            sub="Then ₹1,700 after session 1"
            benefits={[
              'Full session #1 — notes + quiz + interview + simulation',
              'No card required',
              'Upgrade anytime',
            ]}
            onPay={() => onPaid?.()}
            disabled={busy}
            ctaLabel="Start Free Session"
            testid="pricing-trial-card"
            soft
          />
        )}
      </div>
      {data.mock_mode && (
        <div data-testid="mock-mode-banner" className="mt-4 px-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-muted)] inline-flex items-center gap-2">
          <Lock className="w-3.5 h-3.5" />
          Running in mock-payment mode. Razorpay keys not configured — clicking Pay opens a simulated success modal.
        </div>
      )}
      {mockModal}
    </>
  );
}

function PricingCard({ tier, title, price, priceLabel, sub, benefits, onPay, disabled, ctaLabel, badge, highlight, soft, testid }) {
  return (
    <div
      data-testid={testid}
      className={`relative rounded-2xl p-6 border transition-all ${
        highlight
          ? 'bg-[var(--color-bg-card)] border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/10'
          : soft
            ? 'bg-[var(--color-bg-card-hover)] border-dashed border-[var(--color-border)]'
            : 'bg-[var(--color-bg-card)] border-[var(--color-border)]'
      }`}
    >
      {badge && (
        <span className="absolute -top-2 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[var(--color-primary)] text-white">
          {badge}
        </span>
      )}
      <h3 className="text-xl font-bold text-[var(--color-text)] font-bricolage mb-1 flex items-center gap-2">
        {highlight && <Sparkles className="w-4 h-4 text-[var(--color-primary)]" />} {title}
      </h3>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">{sub}</p>
      <div className="mb-5">
        <span className="text-4xl font-bold text-[var(--color-text)] font-bricolage">
          {priceLabel || fmtINR(price)}
        </span>
        {!priceLabel && <span className="text-sm text-[var(--color-text-muted)] ml-1">one-time</span>}
      </div>
      <ul className="space-y-2 mb-6">
        {benefits.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text)]">
            <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${highlight ? 'text-[var(--color-primary)]' : 'text-green-500'}`} /> {b}
          </li>
        ))}
      </ul>
      <button
        onClick={onPay}
        disabled={disabled}
        data-testid={`${testid}-cta`}
        className={`w-full px-4 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 ${
          highlight
            ? 'bg-[var(--color-primary)] text-white hover:opacity-90'
            : 'border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-card-hover)]'
        }`}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
