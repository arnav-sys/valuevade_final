import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import PaywallModal from './PaywallModal';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Wraps any session/* phase route. Calls /api/payments/eligibility?session_id=<id>;
 * if the requested session is gated (not free + not paid) → shows PaywallModal.
 */
export default function SessionPaymentGate({ children }) {
  const { sessionId } = useParams();
  const [state, setState] = useState({ loading: true, data: null });

  const fetchEligibility = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const r = await fetch(`${API}/api/payments/eligibility?session_id=${encodeURIComponent(sessionId || '')}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      const j = r.ok ? await r.json() : null;
      setState({ loading: false, data: j });
    } catch {
      setState({ loading: false, data: null });
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      try {
        const r = await fetch(`${API}/api/payments/eligibility?session_id=${encodeURIComponent(sessionId || '')}`, {
          headers: { Authorization: `Bearer ${session?.access_token || ''}` },
        });
        const j = r.ok ? await r.json() : null;
        if (alive) setState({ loading: false, data: j });
      } catch {
        if (alive) setState({ loading: false, data: null });
      }
    })();
    return () => { alive = false; };
  }, [sessionId]);

  if (state.loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]" data-testid="payment-gate-loading">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] animate-spin" />
      </div>
    );
  }
  const d = state.data;
  if (d && !d.session_allowed) {
    return (
      <PaywallModal
        amountInr={d.amount_inr || 1700}
        tierAvailable={d.pricing_tier_available || 'post_trial'}
        onPaid={fetchEligibility}
      />
    );
  }
  return children;
}
