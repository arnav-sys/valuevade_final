import { useNavigate } from 'react-router-dom';
import { Lock, X } from 'lucide-react';
import { usePaymentFlow } from './usePaymentFlow';
import { fmtINR } from '../../utils/razorpay';

/**
 * Full-screen paywall, fired when user tries to access a non-free session
 * while user_payment_status.paid is false.
 */
export default function PaywallModal({ amountInr = 999, tierAvailable = 'post_trial', onPaid }) {
  const navigate = useNavigate();
  const { startPayment, busy, mockModal, successOverlay } = usePaymentFlow({
    onSuccess: onPaid || (() => navigate('/dashboard', { replace: true })),
  });

  return (
    <div
      data-testid="paywall-modal"
      className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-[var(--color-bg-card)] rounded-2xl max-w-lg w-full p-7 border border-[var(--color-primary)] shadow-2xl shadow-[var(--color-primary)]/20">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-[var(--color-primary)]" />
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            data-testid="paywall-dismiss"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <h2 className="text-2xl font-bold text-[var(--color-text)] font-bricolage mb-2">
          Trial complete. Upgrade to continue.
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          You&apos;ve finished session 1. Upgrade now to unlock every module, simulation, mock-interview
          round, and the AI tutor, lifetime access, one-time payment.
        </p>

        <div className="rounded-xl p-4 bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] mb-5">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            One-time payment
          </div>
          <div className="text-4xl font-bold text-[var(--color-text)] font-bricolage">
            {fmtINR(amountInr)}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            Lifetime access · No subscription
          </div>
        </div>

        <div className="flex gap-3">
          <button
            data-testid="paywall-pay-now"
            onClick={() => startPayment(tierAvailable)}
            disabled={busy}
            className="flex-1 px-4 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Loading…' : `Pay ${fmtINR(amountInr)} Now`}
          </button>
          <button
            data-testid="paywall-later"
            onClick={() => navigate('/dashboard')}
            className="px-4 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-bg-card-hover)]"
          >
            Maybe later
          </button>
        </div>
      </div>
      {mockModal}
      {successOverlay}
    </div>
  );
}
