import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { loadRazorpayCheckout, fmtINR } from '../../utils/razorpay';
import { toast } from 'sonner';
import { CheckCircle2, X, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

async function authedFetch(path, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
      ...(opts.headers || {}),
    },
  });
}

/**
 * Drives the full Razorpay (or mock) payment flow.
 *   const { startPayment, mockModal } = usePaymentFlow();
 *   startPayment('upfront' | 'post_trial')
 * Renders a mock-success modal inline when in mock mode.
 */
export function usePaymentFlow({ onSuccess } = {}) {
  const [busy, setBusy] = useState(false);
  const [mockOrder, setMockOrder] = useState(null); // {order_id, amount_inr}
  const [showSuccess, setShowSuccess] = useState(false);

  // Shows the success screen for a moment before handing off to onSuccess
  // (enrollment write / navigation), avoids the jarring feel of a hard
  // page reload right after payment.
  const celebrateThenContinue = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onSuccess?.();
    }, 1700);
  };

  const startPayment = async (pricing_tier) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await authedFetch('/api/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({ pricing_tier }),
      });
      if (!r.ok) {
        const err = await r.text();
        toast.error(`Could not create order: ${err}`);
        return;
      }
      const order = await r.json();
      if (order.mock_mode) {
        setMockOrder(order);
        return;
      }
      // Real Razorpay flow
      const Razorpay = await loadRazorpayCheckout();
      const { data: { session } } = await supabase.auth.getSession();
      const checkout = new Razorpay({
        key: order.key_id,
        amount: order.amount_paise,
        currency: 'INR',
        name: 'Valuevade',
        description: pricing_tier === 'upfront' ? 'Lifetime access (upfront)' : 'Lifetime access',
        order_id: order.razorpay_order_id,
        prefill: { email: session?.user?.email || '' },
        theme: { color: '#6E56CF' },
        handler: async (resp) => {
          const v = await authedFetch('/api/payments/verify', {
            method: 'POST',
            body: JSON.stringify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          if (v.ok) {
            celebrateThenContinue();
          } else toast.error('Payment verification failed.');
        },
        modal: {
          ondismiss: () => toast.info('Payment cancelled.'),
        },
      });
      checkout.open();
    } catch (e) {
      toast.error(`Payment error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const completeMockPayment = async () => {
    if (!mockOrder) return;
    setBusy(true);
    try {
      const r = await authedFetch('/api/payments/mock-success', {
        method: 'POST',
        body: JSON.stringify({ order_id: mockOrder.order_id }),
      });
      if (r.ok) {
        setMockOrder(null);
        celebrateThenContinue();
      } else {
        toast.error('Mock payment failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelMockPayment = () => {
    setMockOrder(null);
    toast.info('Mock payment cancelled.');
  };

  const successOverlay = showSuccess ? (
    <div
      data-testid="payment-success-overlay"
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 rounded-full bg-[var(--color-primary)]/20 animate-ping" />
          <div className="absolute inset-0 rounded-full bg-[var(--color-primary)] flex items-center justify-center scale-100 animate-in zoom-in duration-500">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white font-bricolage mb-1" data-testid="payment-success-title">
          Payment successful!
        </h2>
        <p className="text-sm text-white/70 font-bricolage">Unlocking your course…</p>
      </div>
    </div>
  ) : null;

  const mockModal = mockOrder ? (
    <div
      data-testid="mock-payment-modal"
      className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
    >
      <div className="bg-[var(--color-bg-card)] rounded-2xl max-w-md w-full p-6 border border-dashed border-[var(--color-primary)]">
        <div className="flex items-center justify-between mb-3">
          <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-semibold uppercase tracking-wider">
            Mock Mode
          </span>
          <button onClick={cancelMockPayment} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <h3 className="text-2xl font-bold text-[var(--color-text)] font-bricolage mb-2">
          Simulate payment of {fmtINR(mockOrder.amount_inr)}
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          Razorpay isn&apos;t wired with live keys yet, this confirms the full flow end-to-end without
          charging any card. The order, payment record, and unlock all get written exactly like a
          live transaction.
        </p>
        <div className="flex gap-3">
          <button
            data-testid="mock-payment-success-btn"
            onClick={completeMockPayment}
            disabled={busy}
            className="flex-1 px-4 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Simulate Success
          </button>
          <button
            data-testid="mock-payment-cancel-btn"
            onClick={cancelMockPayment}
            disabled={busy}
            className="px-4 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { startPayment, busy, mockModal, successOverlay };
}
