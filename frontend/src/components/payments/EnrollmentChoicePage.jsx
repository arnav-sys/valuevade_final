import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { fmtINR } from '../../utils/razorpay';
import { usePaymentFlow } from './usePaymentFlow';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { Check, Sparkles, Loader2, ChevronDown } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * First stop after signup. Forces every new user to choose:
 *   (a) Pay ₹4999 upfront (mock or real Razorpay)
 *   (b) Try free, 1 session free, then ₹4999 after.
 * Both paths land at /courses to pick a course and customise.
 */
export default function EnrollmentChoicePage() {
  const { refreshEnrollment } = useAuth();
  const navigate = useNavigate();
  const [startingTrial, setStartingTrial] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  const goNext = async () => {
    // Bust the EnrollmentGate cache so it sees the new payment_status row immediately.
    try { sessionStorage.removeItem('vv:enrollment-status'); } catch { /* ignore */ }
    await refreshEnrollment();
    navigate('/courses', { replace: true });
  };

  const { startPayment, busy: payBusy, mockModal, successOverlay } = usePaymentFlow({
    onSuccess: goNext,
  });

  const startFreeTrial = async () => {
    if (startingTrial) return;
    setStartingTrial(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/payments/start-free-trial`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (!r.ok) {
        toast.error('Could not start free trial. Try again?');
        return;
      }
      toast.success('Free trial started! Pick a course →');
      goNext();
    } finally {
      setStartingTrial(false);
    }
  };

  const benefits = [
    'Lifetime access to all 15+ modules',
    '68 hands-on Excel finance simulations',
    'AI tutor "Pari", unlimited questions',
    '3-round mock interview capstone',
    'Daily challenges + streaks',
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center px-4 py-10" data-testid="enrollment-choice-page">
      <img src="/valuevade-logo.svg" alt="Valuevade" className="w-12 h-12 mb-5" />
      <h1 className="text-3xl md:text-5xl font-bold text-[var(--color-text)] font-bricolage text-center mb-2">
        Welcome to Valuevade.
      </h1>
      <p className="text-base md:text-lg text-[var(--color-text-muted)] text-center mb-2">
        Choose how you&apos;d like to start.
      </p>
      <p className="text-xs text-[var(--color-text-muted)] text-center mb-10 max-w-xl">
        CFA / FRM-grade prep · Real Indian-market data · AI tutor included
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
        {/* Pay Upfront */}
        <div className="relative rounded-2xl p-6 border bg-[var(--color-bg-card)] border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/10" data-testid="choice-upfront-card">
          <span className="absolute -top-2 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[var(--color-primary)] text-white">
            Limited offer
          </span>
          <h3 className="text-xl font-bold text-[var(--color-text)] font-bricolage mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--color-primary)]" /> Pay ₹4999, Start Now
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Lock in lifetime access at the best rate.
          </p>
          <div className="mb-5">
            <span className="text-4xl font-bold text-[var(--color-text)] font-bricolage">{fmtINR(999)}</span>
            <span className="text-sm text-[var(--color-text-muted)] ml-1">one-time</span>
          </div>
          <ul className="space-y-2 mb-6">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--color-primary)]" /> {b}
              </li>
            ))}
          </ul>
          <button
            onClick={() => startPayment('upfront')}
            disabled={payBusy}
            data-testid="choice-upfront-cta"
            className="w-full px-4 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {payBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            Pay ₹4999 Now
          </button>
        </div>

        {/* Free Trial */}
        <div className="relative rounded-2xl p-6 border bg-[var(--color-bg-card-hover)] border-dashed border-[var(--color-border)]" data-testid="choice-trial-card">
          <h3 className="text-xl font-bold text-[var(--color-text)] font-bricolage mb-1">
            Free Trial, 1 Session Free
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">Then ₹4999 after.</p>
          <div className="mb-5">
            <span className="text-4xl font-bold text-[var(--color-text)] font-bricolage">Free</span>
            <span className="text-sm text-[var(--color-text-muted)] ml-2">to start</span>
          </div>
          <ul className="space-y-2 mb-6">
            <li className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <Check className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" /> Full session #1: notes, quiz, interview, simulation
            </li>
            <li className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <Check className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" /> No card required
            </li>
            <li className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <Check className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" /> Upgrade anytime to unlock the rest
            </li>
            <li className="flex items-start gap-2 text-sm text-[var(--color-text-muted)] italic">
              Sessions 2+ require ₹4999 lifetime upgrade
            </li>
          </ul>
          <button
            onClick={startFreeTrial}
            disabled={startingTrial}
            data-testid="choice-trial-cta"
            className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-text)] font-semibold hover:bg-[var(--color-bg-card)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {startingTrial && <Loader2 className="w-4 h-4 animate-spin" />}
            Start Free Session
          </button>
        </div>
      </div>

      {/* Explainer */}
      <button
        onClick={() => setShowWhy(s => !s)}
        data-testid="choice-explain-toggle"
        className="mt-8 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] inline-flex items-center gap-1"
      >
        What&apos;s the difference?
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showWhy ? 'rotate-180' : ''}`} />
      </button>
      {showWhy && (
        <div className="mt-3 max-w-2xl text-sm text-[var(--color-text-muted)] text-center" data-testid="choice-explain-body">
          Both options unlock the exact same course content for life. Paying upfront costs just ₹4999
          one-time. The free trial includes session 1 fully (notes + quiz + AI interview + simulation).
          If you upgrade later, the price is still ₹4999.
        </div>
      )}

      {mockModal}
      {successOverlay}
    </div>
  );
}
