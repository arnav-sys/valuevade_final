import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import PaywallModal from './PaywallModal';

const API = process.env.REACT_APP_BACKEND_URL;

// Gate for the AI-customisation wizard (/course/:id/customize|preview|confirm).
// Blocks entry with the paywall until the student has paid — previously
// this flow let a student build + confirm a fully customised enrollment for
// free, bypassing the ₹999 payment entirely.
export default function CustomizePaymentGate({ children }) {
  const [state, setState] = useState({ loading: true, data: null });

  const fetchEligibility = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const r = await fetch(`${API}/api/payments/eligibility`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      const j = r.ok ? await r.json() : null;
      setState({ loading: false, data: j });
    } catch {
      setState({ loading: false, data: null });
    }
  }, []);

  useEffect(() => { fetchEligibility(); }, [fetchEligibility]);

  if (state.loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]" data-testid="customize-gate-loading">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] animate-spin" />
      </div>
    );
  }
  const d = state.data;
  // Fail CLOSED: if the eligibility check errored (network/500), treat the
  // student as unpaid rather than silently letting them through — this is
  // the exact revenue leak this gate exists to prevent.
  if (!d || !d.paid) {
    return (
      <PaywallModal
        amountInr={d?.amount_inr || 999}
        tierAvailable={d?.pricing_tier_available || 'upfront'}
        onPaid={fetchEligibility}
      />
    );
  }
  return children;
}
